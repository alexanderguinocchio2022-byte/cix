/* utils.js — formato, fechas, escape de HTML y utilidades generales.
   Mejoras: soporte multi-moneda, UUID seguro, validación tipada, debounce. */
(function(App){
  "use strict";

  /* ── Formateo numérico/moneda ───────────────────────────────── */
  let _fmt = null;

  function obtenerFmt(){
    const cfg = App.config.MONEDAS[App.estado?.moneda || App.config.MONEDA_DEFAULT];
    return new Intl.NumberFormat(cfg.locale, { style: "currency", currency: cfg.currency });
  }

  function money(v){
    if (!_fmt) _fmt = obtenerFmt();
    return _fmt.format(Number.isFinite(v) ? v : 0);
  }

  function resetFmt(){ _fmt = null; }   // llamar al cambiar moneda

  /* ── Fechas ─────────────────────────────────────────────────── */
  function iso(d){
    return d.getFullYear() + "-"
      + String(d.getMonth() + 1).padStart(2, "0") + "-"
      + String(d.getDate()).padStart(2, "0");
  }

  function addDays(f, n){
    const d = new Date(f + "T00:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  /* Días entre dos fechas ISO, ambas inclusive (mínimo 1) */
  function diasEntre(a, b){
    const A = new Date(a + "T00:00:00"), B = new Date(b + "T00:00:00");
    return Math.max(1, Math.round((B - A) / 86400000) + 1);
  }

  function diaSemana(f){ return new Date(f + "T00:00:00").getDay(); }
  function nombreDia(i){ return App.config.DIAS[i]; }

  /* Convierte "2026-11-27" → "27 nov 2026" para mostrar */
  function fechaLegible(f){
    if (!f) return "";
    const d = new Date(f + "T00:00:00");
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  }

  /* ── Seguridad / Escape ─────────────────────────────────────── */
  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s){ return String(s).replace(/[&<>"']/g, c => ESC_MAP[c]); }

  /* ── IDs únicos ─────────────────────────────────────────────── */
  function uid(){
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    // fallback para entornos sin crypto.randomUUID
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ── Validación de gasto ────────────────────────────────────── */
  const CATS_VALIDAS = () => App.config.CATS.map(c => c.nombre);

  function validarGasto(obj){
    const errores = [];
    if (!obj.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(obj.fecha)) errores.push("Fecha inválida.");
    if (!Number.isFinite(obj.monto) || obj.monto <= 0) errores.push("Monto debe ser mayor a 0.");
    if (!obj.monto || obj.monto > 999999) errores.push("Monto fuera de rango.");
    const prod = String(obj.producto || "").trim();
    if (!prod || prod.length < 1) errores.push("El producto o servicio es requerido.");
    if (prod.length > 80) errores.push("El producto no puede superar 80 caracteres.");
    if (!CATS_VALIDAS().includes(obj.categoria)) errores.push("Categoría no válida.");
    return { ok: errores.length === 0, errores };
  }

  /* ── DOM helpers ────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  function pct(v){ return (Number.isFinite(v) ? v : 0).toFixed(1) + " %"; }

  /* Auto-ocultar mensajes de feedback */
  function showMsg(el, tipo, texto){
    el.innerHTML = `<div class="msg ${tipo}">${esc(texto)}</div>`;
    if (tipo === "ok"){
      setTimeout(() => { if (el) el.innerHTML = ""; }, App.config.MSG_TIMEOUT);
    }
  }

  /* Debounce para inputs de búsqueda */
  function debounce(fn, ms){
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  App.utils = {
    $, money, resetFmt, pct, esc, uid,
    hoy: () => iso(new Date()),
    iso, addDays, diasEntre, diaSemana, nombreDia, fechaLegible,
    validarGasto, showMsg, debounce
  };
})(window.App);
