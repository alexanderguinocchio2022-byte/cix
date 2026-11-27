/* registro.js — formulario, lista paginada, búsqueda, edición inline y eliminación con confirmación.
   Mejoras: paginación, búsqueda full-text, edición, confirmación al borrar, notas, fechas legibles,
            mensajes de éxito auto-ocultos, categorías con emoji, render solo cuando tab activa. */
(function(App){
  "use strict";
  const { $, money, esc, hoy, fechaLegible, uid, showMsg, debounce, validarGasto } = App.utils;

  let paginaActual = 1;
  let filtroBusqueda = "";
  let gastoEnEdicion = null;   // id del gasto siendo editado (null = modo alta)

  /* ── Tabla de gastos (reutilizable) ─────────────────────────── */
  function tablaGastos(lista, conAcciones){
    if (!lista.length) return '<p class="empty">Sin registros en este período.</p>';

    const catEmoji = {};
    App.config.CATS.forEach(c => { catEmoji[c.nombre] = c.emoji; });

    const filas = lista.map(x => `
      <tr data-id="${esc(x.id)}" class="fila-gasto">
        <td>${esc(fechaLegible(x.fecha))}</td>
        <td>
          <span class="producto-txt">${esc(x.producto)}</span>
          ${x.notas ? `<span class="nota-txt" title="${esc(x.notas)}">📝</span>` : ""}
        </td>
        <td><span class="cat-badge">${catEmoji[x.categoria] || ""} ${esc(x.categoria)}</span></td>
        <td class="num">${money(x.monto)}</td>
        ${conAcciones ? `
          <td class="acciones">
            <button class="btn-icon" data-accion="editar" data-id="${esc(x.id)}" title="Editar" aria-label="Editar gasto">✏️</button>
            <button class="btn-icon del" data-accion="eliminar" data-id="${esc(x.id)}" title="Eliminar" aria-label="Eliminar gasto">🗑️</button>
          </td>` : ""}
      </tr>`).join("");

    const total = App.datos.sum(lista);
    return `
      <table role="grid" aria-label="Lista de gastos">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Producto / Servicio</th>
            <th scope="col">Categoría</th>
            <th scope="col" class="num">Monto</th>
            ${conAcciones ? '<th scope="col" class="sr-only">Acciones</th>' : ""}
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Total (${lista.length} registro${lista.length !== 1 ? "s" : ""})</td>
            <td class="num">${money(total)}</td>
            ${conAcciones ? "<td></td>" : ""}
          </tr>
        </tfoot>
      </table>`;
  }

  /* ── Render del select de categorías ───────────────────────── */
  function renderCategorias(){
    $("f-cat").innerHTML = App.config.CATS.map(c =>
      `<option value="${esc(c.nombre)}">${c.emoji} ${esc(c.nombre)}</option>`
    ).join("");
  }

  /* ── Presupuesto diario en el encabezado de la tab ─────────── */
  function renderResumenHoy(){
    const hoyStr = hoy();
    const gastosHoy = App.estado.gastos.filter(x => x.fecha === hoyStr);
    const totalHoy = App.datos.sum(gastosHoy);
    const banner = $("banner-hoy");
    if (!banner) return;
    if (!gastosHoy.length){
      banner.innerHTML = "";
      return;
    }
    banner.innerHTML = `<div class="kpi-inline"><small>Gasto de hoy</small><strong>${money(totalHoy)}</strong></div>`;
  }

  /* ── Lista paginada con búsqueda ────────────────────────────── */
  function renderLista(){
    const todosSorted = [...App.estado.gastos]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.id).localeCompare(String(a.id)));

    const filtrados = App.datos.buscar(todosSorted, filtroBusqueda);
    const ppp = App.config.REGISTROS_POR_PAGINA;
    const totalPags = Math.max(1, Math.ceil(filtrados.length / ppp));
    paginaActual = Math.min(paginaActual, totalPags);

    const pagina = filtrados.slice((paginaActual - 1) * ppp, paginaActual * ppp);

    // Tabla
    $("lista-recientes").innerHTML = tablaGastos(pagina, true);

    // Paginación
    const pag = $("paginacion-registro");
    if (!pag) return;
    if (totalPags <= 1){
      pag.innerHTML = "";
      return;
    }
    let btns = "";
    if (paginaActual > 1) btns += `<button class="btn sec btn-sm" data-pag="${paginaActual - 1}">‹ Anterior</button>`;
    btns += `<span class="pag-info">${paginaActual} / ${totalPags}</span>`;
    if (paginaActual < totalPags) btns += `<button class="btn sec btn-sm" data-pag="${paginaActual + 1}">Siguiente ›</button>`;
    pag.innerHTML = `<div class="row pag-row">${btns}</div>`;
  }

  function render(){
    renderResumenHoy();
    renderLista();
  }

  /* ── Modo edición ──────────────────────────────────────────── */
  function entrarModoEdicion(id){
    const g = App.estado.gastos.find(x => x.id === id);
    if (!g) return;
    gastoEnEdicion = id;

    $("f-fecha").value    = g.fecha;
    $("f-monto").value    = g.monto;
    $("f-producto").value = g.producto;
    $("f-cat").value      = g.categoria;
    $("f-notas").value    = g.notas || "";

    $("btn-submit").textContent = "💾 Guardar cambios";
    $("btn-cancelar-edicion").classList.remove("hidden");
    $("form-titulo").textContent = "Editar gasto";

    // Scroll al formulario
    $("form-gasto").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function salirModoEdicion(){
    gastoEnEdicion = null;
    $("form-gasto").reset();
    $("f-fecha").value = hoy();
    $("btn-submit").textContent = "➕ Agregar gasto";
    $("btn-cancelar-edicion").classList.add("hidden");
    $("form-titulo").textContent = "Nuevo gasto";
    $("msg-registro").innerHTML = "";
  }

  /* ── Submit del formulario ──────────────────────────────────── */
  function onSubmit(e){
    e.preventDefault();
    const fecha     = $("f-fecha").value;
    const monto     = parseFloat($("f-monto").value);
    const producto  = $("f-producto").value.trim();
    const categoria = $("f-cat").value;
    const notas     = ($("f-notas").value || "").trim();
    const msg       = $("msg-registro");

    const v = validarGasto({ fecha, monto, producto, categoria, notas });
    if (!v.ok){
      msg.innerHTML = `<div class="msg bad" role="alert">${v.errores.map(esc).join("<br>")}</div>`;
      return;
    }

    if (gastoEnEdicion){
      App.datos.actualizar(gastoEnEdicion, { fecha, monto: Math.round(monto * 100) / 100, producto, categoria, notas });
      showMsg(msg, "ok", "✅ Gasto actualizado correctamente.");
      salirModoEdicion();
    } else {
      App.datos.agregar({ id: uid(), fecha, monto: Math.round(monto * 100) / 100, producto, categoria, notas });
      $("f-monto").value   = "";
      $("f-producto").value = "";
      $("f-notas").value   = "";
      showMsg(msg, "ok", "✅ Gasto registrado.");
    }
    App.renderAll();
  }

  /* ── Delegación de eventos en la lista ─────────────────────── */
  function onClickLista(e){
    const btn = e.target.closest("[data-accion]");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.accion === "eliminar"){
      // Confirmación modal nativa (no-destructiva sin confirmación)
      const g = App.estado.gastos.find(x => x.id === id);
      const nombre = g ? `"${g.producto}" (${money(g.monto)})` : "este gasto";
      if (!confirm(`¿Eliminar ${nombre}?\n\nEsta acción no se puede deshacer.`)) return;
      App.datos.eliminar(id);
      App.renderAll();
    }

    if (btn.dataset.accion === "editar"){
      entrarModoEdicion(id);
    }
  }

  /* ── Paginación ─────────────────────────────────────────────── */
  function onClickPaginacion(e){
    const btn = e.target.closest("[data-pag]");
    if (!btn) return;
    paginaActual = parseInt(btn.dataset.pag, 10);
    renderLista();
    $("lista-recientes").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── Inicialización ─────────────────────────────────────────── */
  function init(){
    renderCategorias();
    $("f-fecha").value = hoy();

    $("form-gasto").addEventListener("submit", onSubmit);
    $("lista-recientes").addEventListener("click", onClickLista);

    const pag = $("paginacion-registro");
    if (pag) pag.addEventListener("click", onClickPaginacion);

    const btnCancelar = $("btn-cancelar-edicion");
    if (btnCancelar) btnCancelar.addEventListener("click", salirModoEdicion);

    // Búsqueda con debounce
    const inputBusq = $("registro-busqueda");
    if (inputBusq){
      inputBusq.addEventListener("input", debounce(e => {
        filtroBusqueda = e.target.value;
        paginaActual = 1;
        renderLista();
      }, 300));
    }
  }

  App.registro = { init, render, tablaGastos };
})(window.App);
