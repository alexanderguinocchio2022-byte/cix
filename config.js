/* config.js — constantes y configuración de la aplicación. Se carga primero.
   Mejoras: soporte multi-moneda, íconos de categoría, versión de schema. */
(function(){
  "use strict";
  window.App = window.App || {};

  App.config = {
    KEY:     "finanzas_app_v2",   // nueva clave por schema v2
    KEY_OLD: "finanzas_app_v1",   // para migración desde versión anterior
    SCHEMA_VERSION: 2,

    /* Monedas disponibles */
    MONEDAS: {
      PEN: { locale: "es-PE", currency: "PEN", simbolo: "S/" },
      CLP: { locale: "es-CL", currency: "CLP", simbolo: "$" },
      MXN: { locale: "es-MX", currency: "MXN", simbolo: "$" },
      COP: { locale: "es-CO", currency: "COP", simbolo: "$" },
      USD: { locale: "en-US", currency: "USD", simbolo: "$" }
    },
    MONEDA_DEFAULT: "PEN",

    /* Categorías con emoji para identificación visual rápida */
    CATS: [
      { nombre: "Comida",          emoji: "🍔" },
      { nombre: "Transporte",      emoji: "🚌" },
      { nombre: "Estudios",        emoji: "📚" },
      { nombre: "Entretenimiento", emoji: "🎬" },
      { nombre: "Ropa",            emoji: "👕" },
      { nombre: "Salud",           emoji: "💊" },
      { nombre: "Servicios",       emoji: "⚡" },
      { nombre: "Hogar",           emoji: "🏠" },
      { nombre: "Otros",           emoji: "📦" }
    ],

    /* Categorías que no se recortan en el plan de ahorro */
    ESENCIALES: ["Servicios", "Salud", "Estudios", "Hogar"],

    /* Tasas de recorte según ranking de gasto (mayor gasto → mayor recorte sugerido) */
    TASAS_RECORTE: [0.25, 0.20, 0.15, 0.10, 0.05],

    /* Días de la semana en español */
    DIAS: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],

    /* Límite de filas en el cronograma de ahorro */
    MAX_MESES: 120,

    /* Paginación de la lista de registros */
    REGISTROS_POR_PAGINA: 15,

    /* Umbral de alerta: si gasto diario supera N× el promedio, se avisa */
    UMBRAL_ALERTA: 2.0,

    /* Tiempo (ms) para auto-ocultar mensajes de éxito */
    MSG_TIMEOUT: 4000
  };
})();
