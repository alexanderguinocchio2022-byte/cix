/* plan.js — cálculo del plan de ahorro con análisis mejorado y barra de progreso visual.
   Mejoras: barra de progreso en cronograma, corrección de diarioProm, ingreso requerido estimado,
            porcentaje de ahorro sobre ingreso, validación mejorada. */
(function(App){
  "use strict";
  const { $, money, pct } = App.utils;
  const { ESENCIALES, TASAS_RECORTE, MAX_MESES } = App.config;

  function cargarInputs(){
    const p = App.estado.plan || {};
    if (p.meta   !== undefined) $("p-meta").value   = p.meta;
    if (p.plazo  !== undefined) $("p-plazo").value  = p.plazo;
    if (p.actual !== undefined) $("p-actual").value = p.actual;
    if (p.ingreso!== undefined) $("p-ingreso").value= p.ingreso;
  }

  /* Guarda los valores del formulario sin calcular (para persistir al cambiar tab) */
  function persistirInputs(){
    const meta    = parseFloat($("p-meta").value)   || 0;
    const plazo   = parseFloat($("p-plazo").value)  || 0;
    const actual  = parseFloat($("p-actual").value) || 0;
    const ingreso = parseFloat($("p-ingreso").value)|| 0;
    if (meta > 0 && plazo > 0){
      App.datos.guardarPlan({ meta, plazo, actual, ingreso });
    }
  }

  function calcular(){
    const meta      = parseFloat($("p-meta").value)   || 0;
    const plazoRaw  = parseFloat($("p-plazo").value)  || 0;
    const actual    = parseFloat($("p-actual").value) || 0;
    const ingreso   = parseFloat($("p-ingreso").value)|| 0;
    const box       = $("plan-out");

    if (!(meta > 0) || !(plazoRaw > 0)){
      box.innerHTML = '<div class="msg bad" role="alert">⚠️ Ingresa una meta mayor a 0 y un plazo en meses.</div>';
      return;
    }

    const plazo = Math.max(1, Math.min(Math.round(plazoRaw), MAX_MESES));
    App.datos.guardarPlan({ meta, plazo, actual, ingreso });

    const restante = Math.max(meta - actual, 0);
    const necesarioMes = restante / plazo;

    if (restante === 0){
      box.innerHTML = '<div class="msg ok">🎉 ¡Ya alcanzaste tu meta con el ahorro actual! Puedes establecer una nueva meta.</div>';
      return;
    }

    const a = App.analisis.calcular();
    if (!a){
      box.innerHTML = `
        <div class="kpis">
          <div class="kpi"><small>Falta por ahorrar</small><strong>${money(restante)}</strong></div>
          <div class="kpi"><small>Ahorro necesario al mes</small><strong>${money(necesarioMes)}</strong></div>
          <div class="kpi"><small>Avance actual</small>
            <strong>${pct(actual / meta * 100)}</strong>
            <div class="bar" style="margin-top:6px"><span style="width:${Math.min(actual / meta * 100, 100).toFixed(1)}%"></span></div>
          </div>
        </div>
        <div class="msg warn">📋 Registra tus gastos para que el plan calcule recortes personalizados según tus patrones de consumo.</div>`;
      return;
    }

    const gastoMensual = a.gastoMensual;

    // Recortes por categoría no esencial
    let idx = 0;
    const recortes = a.porCat.map(c => {
      const mensual = c.total / a.dias * 30;
      const esEsencial = ESENCIALES.includes(c.nombre);
      const tasa = esEsencial ? 0 : TASAS_RECORTE[Math.min(idx++, TASAS_RECORTE.length - 1)];
      return { nombre: c.nombre, mensual, tasa, ahorro: mensual * tasa, esEsencial };
    });

    const ahorroPot = recortes.reduce((s, r) => s + r.ahorro, 0);
    const brecha    = necesarioMes - ahorroPot;
    const viable    = brecha <= 0;
    const mesesReales = ahorroPot > 0 ? Math.ceil(restante / ahorroPot) : null;

    const aporte = viable ? necesarioMes : ahorroPot;
    const meses  = Math.min(plazo, MAX_MESES);

    // Cronograma
    let acum = actual;
    const filas = [];
    for (let m = 1; m <= meses; m++){
      acum = Math.min(acum + aporte, meta);
      const progreso = (acum / meta * 100).toFixed(1);
      const metaAlcanzada = acum >= meta;
      filas.push(`
        <tr class="${metaAlcanzada ? "fila-meta" : ""}">
          <td>${m}</td>
          <td class="num">${money(aporte)}</td>
          <td class="num">${money(acum)}</td>
          <td>
            <div class="bar-row">
              <div class="bar" style="flex:1" role="progressbar" aria-valuenow="${progreso}" aria-valuemax="100">
                <span style="width:${progreso}%;background:${metaAlcanzada ? "var(--ok)" : "var(--accent)"}"></span>
              </div>
              <span style="font-size:.82rem">${pct(acum / meta * 100)}</span>
            </div>
          </td>
        </tr>`);
      if (metaAlcanzada) break;
    }

    const msgEstado = viable
      ? `<div class="msg ok">🎯 Meta alcanzable en ${plazo} mes(es) ahorrando ${money(necesarioMes)}/mes. Los recortes te generan ${money(ahorroPot)}/mes, con margen de ${money(-brecha)}.</div>`
      : `<div class="msg bad">📌 Con los recortes sugeridos ahorrarías ${money(ahorroPot)}/mes, pero necesitas ${money(necesarioMes)}/mes. Faltan ${money(brecha)}/mes. Con este ritmo la meta tomaría ~${mesesReales} meses.</div>`;

    const pctAhorroIngreso = ingreso > 0 ? (aporte / ingreso * 100) : null;
    const ingresoTxt = ingreso > 0
      ? `<div class="kpis" style="margin-top:0">
          <div class="kpi"><small>Margen sin recortes</small><strong>${money(ingreso - gastoMensual)}</strong></div>
          <div class="kpi"><small>% ahorro sobre ingreso</small><strong>${pct(pctAhorroIngreso)}</strong></div>
        </div>
        <p class="muted">Referencia: los expertos recomiendan ahorrar entre el 10 % y 20 % del ingreso mensual.</p>`
      : "";

    box.innerHTML = `
      <div class="kpis">
        <div class="kpi"><small>Falta por ahorrar</small><strong>${money(restante)}</strong></div>
        <div class="kpi"><small>Necesario al mes</small><strong>${money(necesarioMes)}</strong></div>
        <div class="kpi"><small>Gasto mensual est.</small><strong>${money(gastoMensual)}</strong></div>
        <div class="kpi"><small>Ahorro posible</small><strong>${money(ahorroPot)}</strong></div>
        <div class="kpi" style="grid-column: 1/-1">
          <small>Avance actual hacia la meta</small>
          <strong>${pct(actual / meta * 100)}</strong>
          <div class="bar" style="margin-top:6px"><span style="width:${Math.min(actual / meta * 100, 100).toFixed(1)}%"></span></div>
        </div>
      </div>

      ${msgEstado}
      ${ingresoTxt}

      <div class="card">
        <h2>✂️ Recortes sugeridos por categoría</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th class="num">Gasto mensual est.</th>
                <th class="num">Recorte sugerido</th>
                <th class="num">Ahorro al mes</th>
              </tr>
            </thead>
            <tbody>${recortes.map(r => `
              <tr>
                <td>${r.nombre}${r.esEsencial ? ' <span class="badge-esencial">esencial</span>' : ""}</td>
                <td class="num">${money(r.mensual)}</td>
                <td class="num">${r.esEsencial ? "—" : pct(r.tasa * 100)}</td>
                <td class="num">${r.esEsencial ? "—" : money(r.ahorro)}</td>
              </tr>`).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">${money(gastoMensual)}</td>
                <td></td>
                <td class="num">${money(ahorroPot)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>🗓️ Cronograma de ahorro</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Mes</th><th class="num">Aporte</th><th class="num">Acumulado</th><th>Progreso</th></tr></thead>
            <tbody>${filas.join("")}</tbody>
          </table>
        </div>
        ${plazo > MAX_MESES ? `<p class="muted">Se muestran los primeros ${MAX_MESES} meses.</p>` : ""}
      </div>`;
  }

  App.plan = {
    init(){
      cargarInputs();
      $("p-calc").addEventListener("click", calcular);
      // Persistir al cambiar de tab sin calcular
      ["p-meta", "p-plazo", "p-actual", "p-ingreso"].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener("change", persistirInputs);
      });
    },
    calcular,
    cargarInputs
  };
})(window.App);
