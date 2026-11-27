/* analisis.js — estadísticas avanzadas, gráficas con Canvas API, presupuestos, tendencias.
   Mejoras: gráfica de barras nativa, presupuesto vs real, racha sin superar presupuesto,
            detección de gastos recurrentes, corrección del promedio diario con días reales. */
(function(App){
  "use strict";
  const { $, money, pct, esc, addDays, diasEntre, diaSemana, nombreDia, hoy } = App.utils;

  /* ── Cálculo principal ──────────────────────────────────────── */
  function calcular(){
    const g = App.estado.gastos;
    if (!g.length) return null;
    const { sum, enRango, agrupar } = App.datos;

    const fechas = g.map(x => x.fecha).sort();
    const ini = fechas[0], fin = fechas[fechas.length - 1];
    // Fix MAX-03: diasEntre ya devuelve mínimo 1 (corregido en utils.js)
    const dias = diasEntre(ini, fin);
    const total = sum(g);
    const montos = g.map(x => x.monto);
    const promCompra = total / g.length;
    const desv = Math.sqrt(montos.reduce((s, m) => s + (m - promCompra) ** 2, 0) / g.length);

    // Gasto promedio real por día de la semana
    const tot = [0, 0, 0, 0, 0, 0, 0], ocur = [0, 0, 0, 0, 0, 0, 0];
    g.forEach(x => tot[diaSemana(x.fecha)] += x.monto);
    for (let i = 0; i < dias; i++) ocur[diaSemana(addDays(ini, i))]++;
    const semana = tot.map((t, i) => ({ dia: nombreDia(i), prom: ocur[i] ? t / ocur[i] : 0 }));

    // Tendencia: últimos 7 días frente a 7 anteriores
    const ult7  = sum(enRango(g, addDays(fin, -6), fin));
    const prev7 = sum(enRango(g, addDays(fin, -13), addDays(fin, -7)));
    const variacion = prev7 > 0 ? (ult7 - prev7) / prev7 * 100 : null;

    // Gasto real por mes (últimos 6 meses)
    const porMes = calcularPorMes(g);

    // Detección de posibles gastos recurrentes
    const recurrentes = detectarRecurrentes(g);

    // Días sin gastos vs días con gastos
    const diasConGasto = new Set(g.map(x => x.fecha)).size;
    const diarioProm = dias >= 7 ? total / dias : (diasConGasto > 0 ? total / diasConGasto : 0);

    return {
      ini, fin, dias, total, n: g.length, promCompra, desv,
      mayor: Math.max(...montos),
      diarioProm,
      gastoMensual: diarioProm * 30,
      porCat: agrupar(g, "categoria"),
      porProd: agrupar(g, "producto"),
      semana, ult7, prev7, variacion,
      porMes, recurrentes, diasConGasto
    };
  }

  /* ── Gastos agrupados por mes (YYYY-MM) ─────────────────────── */
  function calcularPorMes(g){
    const mapa = {};
    g.forEach(x => {
      const mes = x.fecha.slice(0, 7); // "YYYY-MM"
      mapa[mes] = (mapa[mes] || 0) + x.monto;
    });
    return Object.entries(mapa)
      .map(([mes, total]) => ({ mes, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6); // últimos 6 meses
  }

  /* ── Detección de posibles recurrentes ──────────────────────── */
  function detectarRecurrentes(g){
    const conteo = {};
    g.forEach(x => {
      const k = x.producto.trim().toLowerCase();
      conteo[k] = (conteo[k] || 0) + 1;
    });
    return Object.entries(conteo)
      .filter(([_, n]) => n >= 3)
      .map(([nombre, veces]) => ({
        nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
        veces
      }))
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 5);
  }

  /* ── Dibuja gráfica de barras con Canvas API ─────────────────── */
  function dibujarGraficaMeses(porMes, canvasId){
    const canvas = document.getElementById(canvasId);
    if (!canvas || !porMes.length) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = 180;
    const pad = { top: 20, right: 16, bottom: 40, left: 60 };
    const maxVal = Math.max(...porMes.map(m => m.total), 1);

    ctx.clearRect(0, 0, W, H);

    const barW = Math.max(8, (W - pad.left - pad.right) / porMes.length * 0.6);
    const paso  = (W - pad.left - pad.right) / porMes.length;
    const escala = (H - pad.top - pad.bottom) / maxVal;

    // Líneas de guía
    ctx.strokeStyle = "#e3e7f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++){
      const y = pad.top + (H - pad.top - pad.bottom) * i / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Barras
    porMes.forEach((m, i) => {
      const x = pad.left + paso * i + (paso - barW) / 2;
      const barH = m.total * escala;
      const y = H - pad.bottom - barH;

      // Gradiente
      const grad = ctx.createLinearGradient(0, y, 0, H - pad.bottom);
      grad.addColorStop(0, "#3b82f6");
      grad.addColorStop(1, "#93c5fd");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 4) : ctx.rect(x, y, barW, barH);
      ctx.fill();

      // Etiqueta del mes
      const partes = m.mes.split("-");
      const etiq = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(partes[1], 10) - 1] + " " + partes[0].slice(2);
      ctx.fillStyle = "#6b7385";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(etiq, x + barW / 2, H - pad.bottom + 14);
    });

    // Eje Y (valores)
    ctx.fillStyle = "#6b7385";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 2; i++){
      const val = maxVal * (1 - i / 2);
      const y   = pad.top + (H - pad.top - pad.bottom) * i / 2;
      ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + "K" : val.toFixed(0), pad.left - 6, y + 4);
    }
  }

  /* ── Render del panel de presupuestos ───────────────────────── */
  function renderPresupuestos(porCat){
    const pres = App.estado.presupuestos || {};
    const catEmoji = {};
    App.config.CATS.forEach(c => { catEmoji[c.nombre] = c.emoji; });

    const filas = App.config.CATS.map(cat => {
      const datos  = porCat.find(c => c.nombre === cat.nombre);
      const gastado = datos ? datos.total : 0;
      const presup  = pres[cat.nombre] || 0;
      const ratio   = presup > 0 ? Math.min(gastado / presup * 100, 100) : 0;
      const color   = ratio >= 100 ? "var(--badc)" : ratio >= 80 ? "var(--warnc)" : "var(--accent)";
      return `
        <tr>
          <td>${cat.emoji} ${esc(cat.nombre)}</td>
          <td class="num">${money(gastado)}</td>
          <td>
            <div class="presup-cell">
              <input type="number" class="presup-input" data-cat="${esc(cat.nombre)}"
                     value="${presup || ""}" min="0" step="0.01" placeholder="Sin límite"
                     aria-label="Presupuesto para ${esc(cat.nombre)}">
            </div>
          </td>
          <td>
            ${presup > 0 ? `
              <div class="bar-row">
                <div class="bar" style="flex:1" role="progressbar" aria-valuenow="${ratio.toFixed(0)}" aria-valuemax="100">
                  <span style="width:${ratio.toFixed(1)}%;background:${color}"></span>
                </div>
                <span style="color:${color};font-size:.82rem;white-space:nowrap">${pct(ratio)} de ${money(presup)}</span>
              </div>` : '<span class="muted">—</span>'}
          </td>
        </tr>`;
    }).join("");

    return `
      <div class="card">
        <h2>🎯 Presupuesto mensual por categoría</h2>
        <p class="muted">Escribe un límite mensual por categoría. Los gastos del mes actual se comparan en tiempo real.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th class="num">Gastado (historial)</th>
                <th>Límite mensual</th>
                <th>Avance</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
        <div class="row"><button class="btn" id="btn-guardar-presup">💾 Guardar presupuestos</button></div>
      </div>`;
  }

  /* ── Render completo del análisis ───────────────────────────── */
  function render(){
    const a = calcular();
    const out = $("analisis-out");
    if (!a){
      out.innerHTML = `
        <div class="card empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty">Registra tus gastos para ver estadísticas y análisis detallados.</p>
          <p class="muted">Con al menos 2 semanas de datos obtendrás tendencias más confiables.</p>
        </div>`;
      return;
    }

    const maxSem = Math.max(...a.semana.map(s => s.prom), 1);
    const maxCat = Math.max(...a.porCat.map(c => c.total), 1);

    let tendencia = '<span class="muted">Necesitas gastos en dos semanas consecutivas para comparar.</span>';
    if (a.variacion !== null){
      const cls = a.variacion > 0 ? "warn" : "ok";
      const icon = a.variacion > 0 ? "📈" : "📉";
      const txt  = a.variacion > 0 ? "aumentó" : "disminuyó";
      tendencia = `<div class="msg flat ${cls}">${icon} Tus últimos 7 días ${txt} <strong>${pct(Math.abs(a.variacion))}</strong> frente a los 7 anteriores (${money(a.ult7)} vs ${money(a.prev7)}).</div>`;
    }

    const aviso = a.dias < 7
      ? `<div class="msg warn">⚠️ Solo tienes ${a.dias} día(s) de datos. Con al menos 2 semanas las estadísticas son más confiables.</div>`
      : "";

    const recurrentesHTML = a.recurrentes.length
      ? `<div class="card">
          <h2>🔄 Posibles gastos recurrentes</h2>
          <p class="muted">Productos que aparecen 3 o más veces en tus registros.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Producto</th><th class="num">Veces registrado</th></tr></thead>
              <tbody>${a.recurrentes.map(r => `<tr><td>${esc(r.nombre)}</td><td class="num">${r.veces}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        </div>`
      : "";

    out.innerHTML = `
      ${aviso}
      <div class="kpis">
        <div class="kpi"><small>Gasto total</small><strong>${money(a.total)}</strong></div>
        <div class="kpi"><small>Promedio diario</small><strong>${money(a.diarioProm)}</strong><small>${a.dias} día(s) analizados</small></div>
        <div class="kpi"><small>Gasto mensual est.</small><strong>${money(a.gastoMensual)}</strong></div>
        <div class="kpi"><small>Promedio por compra</small><strong>${money(a.promCompra)}</strong></div>
        <div class="kpi"><small>Compra más alta</small><strong>${money(a.mayor)}</strong></div>
        <div class="kpi"><small>Días con gasto</small><strong>${a.diasConGasto}</strong><small>de ${a.dias} analizados</small></div>
      </div>

      <div class="card">
        <h2>📈 Tendencia reciente</h2>
        ${tendencia}
      </div>

      ${a.porMes.length >= 2 ? `
      <div class="card">
        <h2>📊 Gasto mensual (últimos ${a.porMes.length} meses)</h2>
        <canvas id="grafica-meses" style="width:100%;display:block" aria-label="Gráfica de gastos mensuales"></canvas>
      </div>` : ""}

      <div class="card">
        <h2>🗂️ Gasto por categoría</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th class="num">Veces</th>
                <th class="num">Total</th>
                <th>% del total</th>
                <th class="num">Prom. por compra</th>
              </tr>
            </thead>
            <tbody>${a.porCat.map(c => `
              <tr>
                <td>${esc(c.nombre)}</td>
                <td class="num">${c.veces}</td>
                <td class="num">${money(c.total)}</td>
                <td>
                  <div class="bar-row">
                    <div class="bar" role="progressbar" aria-valuenow="${(c.total / maxCat * 100).toFixed(0)}" aria-valuemax="100">
                      <span style="width:${(c.total / maxCat * 100).toFixed(1)}%"></span>
                    </div>
                    ${pct(c.pct)}
                  </div>
                </td>
                <td class="num">${money(c.promedio)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>📅 Gasto promedio por día de la semana</h2>
        ${a.semana.map(s => `
          <div class="dia-row">
            <span class="nombre">${s.dia}</span>
            <div class="bar" style="flex:1" role="progressbar" aria-valuenow="${(s.prom / maxSem * 100).toFixed(0)}" aria-valuemax="100">
              <span style="width:${(s.prom / maxSem * 100).toFixed(1)}%"></span>
            </div>
            <span class="valor">${money(s.prom)}</span>
          </div>`).join("")}
        <p class="muted">Promedio = gasto total del día de la semana ÷ cantidad de esos días en el período.</p>
      </div>

      ${recurrentesHTML}
      ${renderPresupuestos(a.porCat)}`;

    // Dibujar gráfica Canvas
    if (a.porMes.length >= 2){
      requestAnimationFrame(() => dibujarGraficaMeses(a.porMes, "grafica-meses"));
    }

    // Guardar presupuestos
    const btnPres = $("btn-guardar-presup");
    if (btnPres){
      btnPres.addEventListener("click", () => {
        document.querySelectorAll(".presup-input").forEach(inp => {
          const cat   = inp.dataset.cat;
          const monto = parseFloat(inp.value) || 0;
          App.datos.guardarPresupuesto(cat, monto);
        });
        btnPres.textContent = "✅ Guardado";
        setTimeout(() => { btnPres.textContent = "💾 Guardar presupuestos"; }, 2000);
      });
    }
  }

  App.analisis = { calcular, render };
})(window.App);
