/* =====================================================================
   CARTA DEL LOCAL (somosmafia.cl/carta) — valores de partida
   Lo que cambies desde el panel (Carta local) se guarda aparte y prevalece sobre esto.
   ===================================================================== */
const LOCAL_DEFAULTS = {
  /* Productos que NO se muestran en el local. Combo Padrinos lleva pizzas de 40 cm. */
  disabledProducts: ["combo-doble-capo"],
  /* Cambios solo para el local: price, name, desc, img, promo (texto de promoción) */
  overrides: {
    tgm:        { img:"/fotos/local/tgm.webp", promo:"Con Palitos de ajo" },
    pepperoni:  { img:"/fotos/local/pepperoni.webp", promo:"Con Palitos de ajo" },
    "pollo-bbq":{ img:"/fotos/local/pollo-bbq.webp", promo:"Con Palitos de ajo" },
    napolitana: { img:"/fotos/local/napolitana.webp", promo:"Con Palitos de ajo" },
    margarita:  { img:"/fotos/local/margarita.webp", promo:"Con Palitos de ajo" },
    ajillo:     { img:"/fotos/local/ajillo.webp", promo:"Con Palitos de ajo" },
    funghi:     { img:"/fotos/local/funghi.webp", promo:"Con Palitos de ajo" }
  },
  /* Texto bajo el título de cada sección (id de la sección: texto). Vacío = sin texto. */
  notes: { pizzas: "Formato único de 60 cm." }
};
if (typeof module !== "undefined") module.exports = LOCAL_DEFAULTS;
