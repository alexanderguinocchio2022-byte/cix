/* datos.js — estado global, almacenamiento y operaciones sobre los gastos.
   Mejoras: validación al cargar, migración de schema v1→v2, IDs seguros,
            presupuestos por categoría, búsqueda full-text, pub/sub básico. */
(function(App){
  "use strict";

  /* ── Estado inicial ─────────────────────────────────────────── */
  App.estado = {
    gastos: [],
    plan: {},
    presupuestos: {},   // { "Comida": 300, "Transporte": 150, ... }
    moneda: App.config.MONEDA_DEFAULT,
    _version: App.config.SCHEMA_VERSION
  };

  /* ── Pub/Sub para render selectivo ─────────────────────────── */
  const _listeners = {};
  function on(evento, fn){ (_listeners[evento] = _listeners[evento] || []).push(fn); }
  function emit(evento, data){ (_listeners[evento] || []).forEach(fn => fn(data)); }

  /* ── Funciones puras sobre listas ───────────────────────────── */
  const sum = lista => lista.reduce((s, x) => s + (Number.isFinite(x.monto) ? x.monto : 0), 0);

  const enRango = (lista, desde, hasta) =>
    lista.filter(x => (!desde || x.fecha >= desde) && (!hasta || x.fecha <= hasta));

  /* Búsqueda full-text: texto libre sobre producto, categoría, notas */
  function buscar(lista, texto){
    if (!texto) return lista;
    const q = texto.trim().toLowerCase();
    return lista.filter(x =>
      (x.producto || "").toLowerCase().includes(q) ||
      (x.categoria || "").toLowerCase().includes(q) ||
      (x.notas || "").toLowerCase().includes(q)
    );
  }

  /* Agrupa por campo; normaliza claves de producto a minúsculas */
  function agrupar(lista, campo){
    const t = sum(lista), mapa = {};
    lista.forEach(x => {
      const k = campo === "producto" ? x.producto.trim().toLowerCase() : x[campo];
      if (!mapa[k]) mapa[k] = {
        nombre: campo === "producto"
          ? (k.charAt(0).toUpperCase() + k.slice(1))
          : x[campo],
        veces: 0, total: 0
      };
      mapa[k].veces++;
      mapa[k].total = Math.round((mapa[k].total + x.monto) * 100) / 100;
    });
    return Object.values(mapa)
      .map(o => ({ ...o, pct: t ? o.total / t * 100 : 0, promedio: o.total / o.veces }))
      .sort((a, b) => b.total - a.total);
  }

  /* ── Sanitización y validación al cargar ────────────────────── */
  const CATS_VALIDAS = () => App.config.CATS.map(c => c.nombre);

  function sanitizarGasto(x){
    if (!x || typeof x !== "object") return null;
    const monto = Number(x.monto);
    if (!Number.isFinite(monto) || monto <= 0 || monto > 999999) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.fecha)) return null;
    const prod = String(x.producto || "").trim();
    if (!prod) return null;
    const cat = CATS_VALIDAS().includes(x.categoria) ? x.categoria : "Otros";
    return {
      id: x.id || App.utils.uid(),
      fecha: x.fecha,
      monto: Math.round(monto * 100) / 100,
      producto: prod.slice(0, 80),
      categoria: cat,
      notas: String(x.notas || "").slice(0, 200)
    };
  }

  /* ── Migración de schema v1 → v2 ────────────────────────────── */
  function migrarV1(){
    try {
      const raw = localStorage.getItem(App.config.KEY_OLD);
      if (!raw) return null;
      const v1 = JSON.parse(raw);
      if (!v1 || !Array.isArray(v1.gastos)) return null;
      console.info("[datos] Migrando datos de schema v1 → v2");
      return {
        gastos: v1.gastos,
        plan: v1.plan || {},
        presupuestos: {},
        moneda: App.config.MONEDA_DEFAULT,
        _version: 2
      };
    } catch(e){ return null; }
  }

  /* ── Almacenamiento ─────────────────────────────────────────── */
  function guardar(){
    try {
      App.estado._version = App.config.SCHEMA_VERSION;
      localStorage.setItem(App.config.KEY, JSON.stringify(App.estado));
    } catch(e){
      console.warn("[datos] No se pudo guardar en localStorage:", e.message);
    }
  }

  function cargar(){
    try {
      let raw = localStorage.getItem(App.config.KEY);
      let parsed = raw ? JSON.parse(raw) : migrarV1();
      if (!parsed) return; // primera vez

      App.estado.gastos = Array.isArray(parsed.gastos)
        ? parsed.gastos.map(sanitizarGasto).filter(Boolean)
        : [];
      App.estado.plan        = (parsed.plan && typeof parsed.plan === "object") ? parsed.plan : {};
      App.estado.presupuestos = (parsed.presupuestos && typeof parsed.presupuestos === "object") ? parsed.presupuestos : {};
      App.estado.moneda       = parsed.moneda || App.config.MONEDA_DEFAULT;
    } catch(e){
      console.error("[datos] Error al cargar datos:", e);
      App.estado.gastos = [];
    }
  }

  /* ── API pública de datos ────────────────────────────────────── */
  App.datos = {
    sum, enRango, agrupar, buscar,
    on, emit,

    cargar,
    guardar,

    agregar(gasto){
      const limpio = sanitizarGasto(gasto);
      if (!limpio) throw new Error("Gasto inválido");
      App.estado.gastos.push(limpio);
      guardar();
      emit("gastoAgregado", limpio);
    },

    eliminar(id){
      const antes = App.estado.gastos.length;
      App.estado.gastos = App.estado.gastos.filter(x => x.id !== id);
      if (App.estado.gastos.length !== antes){
        guardar();
        emit("gastoEliminado", { id });
      }
    },

    actualizar(id, cambios){
      const idx = App.estado.gastos.findIndex(x => x.id === id);
      if (idx === -1) return;
      const actualizado = sanitizarGasto({ ...App.estado.gastos[idx], ...cambios });
      if (!actualizado) return;
      App.estado.gastos[idx] = actualizado;
      guardar();
      emit("gastoActualizado", actualizado);
    },

    guardarPlan(plan){
      App.estado.plan = plan;
      guardar();
    },

    guardarPresupuesto(categoria, monto){
      App.estado.presupuestos[categoria] = Number(monto) || 0;
      guardar();
      emit("presupuestoActualizado", { categoria, monto });
    },

    setMoneda(codigo){
      if (!App.config.MONEDAS[codigo]) return;
      App.estado.moneda = codigo;
      App.utils.resetFmt();
      guardar();
      emit("monedaCambiada", { codigo });
    },

    /* Importar backup JSON completo */
    importar(jsonStr){
      try {
        const data = JSON.parse(jsonStr);
        if (!Array.isArray(data.gastos)) throw new Error("Formato inválido");
        const gastos = data.gastos.map(sanitizarGasto).filter(Boolean);
        App.estado.gastos      = gastos;
        App.estado.plan        = data.plan || {};
        App.estado.presupuestos = data.presupuestos || {};
        guardar();
        emit("importado", { n: gastos.length });
        return { ok: true, n: gastos.length };
      } catch(e){
        return { ok: false, error: e.message };
      }
    },

    /* Exportar backup JSON */
    exportarJSON(){
      return JSON.stringify(App.estado, null, 2);
    }
  };
})(window.App);
