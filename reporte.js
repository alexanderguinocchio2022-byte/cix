/* reporte.js — detalle de gastos con filtros, resumen por producto y exportación real.
   Mejoras: descarga CSV real (Blob), filtros rápidos (semana/mes/año), columna de notas,
            feedback cuando no hay datos, búsqueda en reporte. */
(function(App){
  "use strict";
  const { $, money, pct, esc, hoy, addDays, fechaLegible, debounce } = App.utils;

  let filtroBusquedaRep = "";

  /* ── Filtros rápidos ────────────────────────────────────────── */
  function setFiltroRapido(tipo){
    const h = hoy();
    switch(tipo){
      case "hoy":
        $("r-desde").value = h;
        $("r-hasta").value = h;
        break;
      case "semana": {
        const d = new Date(h + "T00:00:00");
        const dow = d.getDay();
        const lunes = addDays(h, -dow + (dow === 0 ? -6 : 1));
        $("r-desde").value = lunes;
        $("r-hasta").value = h;
        break;
      }
      case "mes": {
        const d = new Date(h + "T00:00:00");
        const primerDia = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
        $("r-desde").value = primerDia;
        $("r-hasta").value = h;
        break;
      }
      case "año": {
        const year = new Date(h + "T00:00:00").getFullYear();
        $("r-desde").value = year + "-01-01";
        $("r-hasta").value = h;
        break;
      }
      case "todo":
        $("r-desde").value = "";
        $("r-hasta").value = "";
        break;
    }
    render();
  }

  /* ── Obtener lista filtrada ─────────────────────────────────── */
  function filtrar(){
    const base = App.datos.enRango(App.estado.gastos, $("r-desde").value, $("r-hasta").value);
    const buscados = App.datos.buscar(base, filtroBusquedaRep);
    return buscados.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.id).localeCompare(String(a.id)));
  }

  /* ── Render principal ───────────────────────────────────────── */
  function render(){
    const lista = filtrar();
    $("reporte-detalle").innerHTML = App.registro.tablaGastos(lista, false);

    // Resumen visual del período
    const resumen = $("reporte-resumen-kpis");
    if (resumen){
      if (!lista.length){
        resumen.innerHTML = "";
      } else {
        const total = App.datos.sum(lista);
        const prom  = total / lista.length;
        const max   = Math.max(...lista.map(x => x.monto));
        resumen.innerHTML = `
          <div class="kpis">
            <div class="kpi"><small>Total del período</small><strong>${money(total)}</strong></div>
            <div class="kpi"><small>Registros</small><strong>${lista.length}</strong></div>
            <div class="kpi"><small>Promedio por compra</small><strong>${money(prom)}</strong></div>
            <div class="kpi"><small>Compra mayor</small><strong>${money(max)}</strong></div>
          </div>`;
      }
    }

    if (!lista.length){
      $("reporte-productos").innerHTML = '<p class="empty">Sin datos en el período seleccionado.</p>';
      return;
    }

    const prods = App.datos.agrupar(lista, "producto");
    const total = App.datos.sum(lista);

    $("reporte-productos").innerHTML = `
      <table role="grid">
        <thead>
          <tr>
            <th scope="col">Producto / Servicio</th>
            <th scope="col" class="num">Veces</th>
            <th scope="col" class="num">Total</th>
            <th scope="col">% del total</th>
            <th scope="col" class="num">Prom. por compra</th>
          </tr>
        </thead>
        <tbody>${prods.map(p => `
          <tr>
            <td>${esc(p.nombre)}</td>
            <td class="num">${p.veces}</td>
            <td class="num">${money(p.total)}</td>
            <td>
              <div class="bar-row">
                <div class="bar" role="progressbar" aria-valuenow="${p.pct.toFixed(1)}" aria-valuemin="0" aria-valuemax="100">
                  <span style="width:${p.pct.toFixed(1)}%"></span>
                </div>
                ${pct(p.pct)}
              </div>
            </td>
            <td class="num">${money(p.promedio)}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="num">${lista.length}</td>
            <td class="num">${money(total)}</td>
            <td>100.0 %</td>
            <td></td>
          </tr>
        </tfoot>
      </table>`;
  }

  /* ── Exportación CSV real (Blob download) ───────────────────── */
  function exportarCSV(){
    const lista = filtrar();
    if (!lista.length){
      alert("No hay datos en el período seleccionado para exportar.");
      return;
    }
    const cabecera = "Fecha,Producto,Categoría,Monto,Notas";
    const filas = lista.map(x =>
      `${x.fecha},"${(x.producto || "").replace(/"/g, '""')}","${(x.categoria || "").replace(/"/g, '""')}",${x.monto.toFixed(2)},"${(x.notas || "").replace(/"/g, '""')}"`
    );
    const contenido = [cabecera, ...filas].join("\n");
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `gastos_${hoy()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Exportar / Importar backup JSON ───────────────────────── */
  function exportarJSON(){
    const json = App.datos.exportarJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `backup_finanzas_${hoy()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importarJSON(){
    const inp = document.createElement("input");
    inp.type   = "file";
    inp.accept = ".json,application/json";
    inp.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const res = App.datos.importar(ev.target.result);
        if (res.ok){
          App.renderAll();
          alert(`✅ Importados ${res.n} gastos correctamente.`);
        } else {
          alert("❌ Error al importar: " + res.error);
        }
      };
      reader.readAsText(file, "utf-8");
    };
    inp.click();
  }

  /* ── Inicialización ─────────────────────────────────────────── */
  function init(){
    $("r-desde").addEventListener("change", render);
    $("r-hasta").addEventListener("change", render);

    $("r-limpiar").addEventListener("click", () => setFiltroRapido("todo"));
    $("r-csv").addEventListener("click", exportarCSV);

    const btnJSON   = $("r-json");
    const btnImport = $("r-import");
    if (btnJSON)   btnJSON.addEventListener("click",   exportarJSON);
    if (btnImport) btnImport.addEventListener("click", importarJSON);

    // Filtros rápidos
    document.querySelectorAll("[data-filtro-rapido]").forEach(btn => {
      btn.addEventListener("click", () => setFiltroRapido(btn.dataset.filtroRapido));
    });

    // Búsqueda en reporte
    const inputBusq = $("reporte-busqueda");
    if (inputBusq){
      inputBusq.addEventListener("input", debounce(e => {
        filtroBusquedaRep = e.target.value;
        render();
      }, 300));
    }
  }

  App.reporte = { init, render };
})(window.App);
