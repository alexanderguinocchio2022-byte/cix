/* js.js — punto de entrada: navegación con transiciones, modo oscuro, selector de moneda y renderAll selectivo.
   Mejoras: render selectivo, transición de tabs, modo oscuro, selector de moneda, ARIA tabs. */
(function(App){
  "use strict";
  const { $ } = App.utils;
  const TABS = ["registro", "reporte", "analisis", "plan"];
  let tabActiva = "registro";

  /* ── Navegación con render selectivo ─────────────────────── */
  function mostrar(tab){
    if (!TABS.includes(tab)) return;
    tabActiva = tab;

    TABS.forEach(t => {
      const sec = $("tab-" + t);
      if (sec) sec.classList.toggle("hidden", t !== tab);
    });
    document.querySelectorAll("nav button[data-tab]").forEach(b => {
      const activo = b.dataset.tab === tab;
      b.classList.toggle("active", activo);
      b.setAttribute("aria-selected", String(activo));
    });

    // Render selectivo: solo la tab que se abre
    if (tab === "reporte")  App.reporte.render();
    if (tab === "analisis") App.analisis.render();
    if (tab === "plan")     App.plan.cargarInputs();

    // Guardar última tab en sessionStorage
    try { sessionStorage.setItem("cix_tab", tab); } catch(e){}
  }

  /* Redibuja las vistas que dependen de datos, solo las visibles + registro siempre */
  function renderAll(){
    App.registro.render();
    if (tabActiva === "reporte")  App.reporte.render();
    if (tabActiva === "analisis") App.analisis.render();
  }

  App.mostrar  = mostrar;
  App.renderAll = renderAll;

  /* ── Modo oscuro ─────────────────────────────────────────── */
  function initModoOscuro(){
    const btn   = $("btn-modo-oscuro");
    const root  = document.documentElement;
    const pref  = (() => { try { return localStorage.getItem("cix_tema"); } catch(e){ return null; } })();
    const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const oscuro  = pref === "oscuro" || (pref === null && sysDark);

    if (oscuro) root.setAttribute("data-tema", "oscuro");
    if (btn){
      btn.textContent = oscuro ? "☀️" : "🌙";
      btn.title = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
      btn.addEventListener("click", () => {
        const estaOscuro = root.getAttribute("data-tema") === "oscuro";
        root.setAttribute("data-tema", estaOscuro ? "claro" : "oscuro");
        btn.textContent = estaOscuro ? "🌙" : "☀️";
        btn.title = estaOscuro ? "Cambiar a modo oscuro" : "Cambiar a modo claro";
        try { localStorage.setItem("cix_tema", estaOscuro ? "claro" : "oscuro"); } catch(e){}
      });
    }
  }

  /* ── Selector de moneda ───────────────────────────────────── */
  function initMoneda(){
    const sel = $("sel-moneda");
    if (!sel) return;
    Object.keys(App.config.MONEDAS).forEach(cod => {
      const opt = document.createElement("option");
      opt.value = cod;
      opt.textContent = `${cod} (${App.config.MONEDAS[cod].simbolo})`;
      sel.appendChild(opt);
    });
    sel.value = App.estado.moneda || App.config.MONEDA_DEFAULT;
    sel.addEventListener("change", () => {
      App.datos.setMoneda(sel.value);
      renderAll();
    });
  }

  /* ── Accesos rápidos de teclado ──────────────────────────── */
  function initKeyboard(){
    document.addEventListener("keydown", e => {
      // Alt+1..4 para navegar tabs
      if (e.altKey && e.key >= "1" && e.key <= "4"){
        const idx = parseInt(e.key, 10) - 1;
        if (TABS[idx]) mostrar(TABS[idx]);
      }
    });
  }

  /* ── Inicialización ──────────────────────────────────────── */
  function init(){
    App.datos.cargar();
    App.registro.init();
    App.reporte.init();
    App.plan.init();

    // Configurar ARIA roles de tabs
    const nav = document.querySelector("nav");
    if (nav) nav.setAttribute("role", "tablist");
    document.querySelectorAll("nav button[data-tab]").forEach(b => {
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
    });

    document.querySelectorAll("nav button[data-tab]").forEach(b =>
      b.addEventListener("click", () => mostrar(b.dataset.tab))
    );

    initModoOscuro();
    initMoneda();
    initKeyboard();
    renderAll();

    // Restaurar última tab o ir a registro
    let tabInicial = "registro";
    try {
      const guardada = sessionStorage.getItem("cix_tab");
      if (TABS.includes(guardada)) tabInicial = guardada;
    } catch(e){}
    mostrar(tabInicial);
  }

  init();
})(window.App);
