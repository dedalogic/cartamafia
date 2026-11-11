/* =====================================================================
   CARTA DEL LOCAL (somosmafia.cl/carta) — valores de partida
   Lo que cambies desde el panel (Carta local) se guarda aparte y prevalece sobre esto.
   Si cambias "version", los valores guardados antes se descartan y vuelven estos.
   ===================================================================== */
const LOCAL_DEFAULTS = {
  version: 4,
  /* Productos que NO se muestran en el local: los combos de la carta online (el local tiene los suyos). */
  disabledProducts: ["combo-famiglia","combo-doble-capo","combo-mafioso","combo-complices","combo-del-don","combo-duo-del-don"],
  /* Productos que solo existen en el local. Van al principio de su sección. */
  localItems: [
    { cat:"combos", id:"l-familiar", name:"Promo Familiar", desc:"Pizza de 60 cm a elección, Palitos de Ajo y Bebida 1.5 L.", price:29990, img:"/fotos/local/promo-familiar.webp", sub:"Margarita y Funghi: $24.990" },
    { cat:"combos", id:"l-slice-bebida", name:"Slice + Bebida", desc:"1 slice a elección y Bebida Mini.", price:4990, img:"/fotos/local/slice-bebida.webp?v=2", sub:"" },
    { cat:"combos", id:"l-pesto-pollo", name:"Fetuccini Pesto con Pollo Gravy", desc:"Fetuccini al Pesto con Pollo con Gravy y Bebida Mini.", price:9990, img:"/fotos/local/pesto-pollo-gravy.webp?v=2" }
  ],
  /* Cambios solo para el local: price, name, desc, img, img2 (foto del slice), label (antes del precio), sub (texto bajo el precio), promo (etiqueta destacada) */
  overrides: {
    tgm: { price:5490, img:"/fotos/local/tgm.webp?v=2", img2:"/fotos/local/slice-tgm.webp", sub:"Familiar con palitos y bebida: $29.990" },
    pepperoni: { price:5490, img:"/fotos/local/pepperoni.webp?v=2", img2:"/fotos/local/slice-pepperoni.webp", sub:"Familiar con palitos y bebida: $29.990" },
    "pollo-bbq": { price:5490, img:"/fotos/local/pollo-bbq.webp?v=2", img2:"/fotos/local/slice-pollo-bbq.webp", sub:"Familiar con palitos y bebida: $29.990" },
    napolitana: { price:5490, img:"/fotos/local/napolitana.webp?v=2", img2:"/fotos/local/slice-napolitana.webp", sub:"Familiar con palitos y bebida: $29.990" },
    margarita: { price:4490, img:"/fotos/local/margarita.webp?v=2", img2:"/fotos/local/slice-margarita.webp", sub:"Familiar con palitos y bebida: $24.990" },
    ajillo: { price:5490, img:"/fotos/local/ajillo.webp?v=2", img2:"/fotos/local/slice-ajillo.webp", sub:"Familiar con palitos y bebida: $29.990" },
    funghi: { price:4490, img:"/fotos/local/funghi.webp?v=2", img2:"/fotos/local/slice-funghi.webp", sub:"Familiar con palitos y bebida: $24.990" },
    "np-mechada-mafia": { img:"/fotos/local/np-mechada-mafia.webp?v=2" },
    "np-bolognesa-albondigas": { img:"/fotos/local/np-bolognesa-albondigas.webp?v=2" },
    "np-carne-vino-ajo": { img:"/fotos/local/np-carne-vino-ajo.webp?v=2" },
    "np-alfredo-gravy": { img:"/fotos/local/np-alfredo-gravy.webp?v=2" },
    "np-pesto-lemon": { img:"/fotos/local/np-pesto-lemon.webp?v=2" },
    "cremita-zapallo": { img:"/fotos/local/cremita-zapallo.webp?v=2" },
    "combo-duo-del-don": { img:"/fotos/local/combo-duo-del-don.webp?v=2" },
    "palitos": { img:"/fotos/local/palitos-ajo.webp?v=2" },
    "combo-del-don": { img:"/fotos/local/combo-del-don.webp?v=2" },
    "combo-mafioso": { img:"/fotos/local/combo-mafioso.webp?v=2" },
    "promo-alfredo": { desc:"Fetuccini Alfredo y Bebida Mini. Para 1 persona." }
  },
  /* Texto bajo el título de cada sección (id de la sección: texto). Vacío = sin texto. */
  notes: { pizzas: "Pizzas XXL o Slices", combos: "" },
  /* Banners de arriba. "to": #seccion, o #item:ID (lleva a ese plato), o #item:ID:slice (idem, con la carta en Slice) */
  banners: [
    { img:"/assets/banner-local-martes-2.webp", to:"#item:napolitana:slice", alt:"Todos los martes, 50% en slices" },
    { img:"/assets/banner-local-familiar.webp?v=2", to:"#item:l-familiar", alt:"Promo Familiar" },
    { img:"/assets/banner-local-slice.webp?v=2", to:"#item:l-slice-bebida", alt:"Slice y bebida" },
    { img:"/assets/banner-local-pesto.webp?v=2", to:"#item:l-pesto-pollo", alt:"Fetuccini Pesto con Pollo Gravy y bebida" }
  ]
};
if (typeof module !== "undefined") module.exports = LOCAL_DEFAULTS;
