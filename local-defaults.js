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
    { cat:"combos", id:"l-slice-bebida", name:"Slice + Bebida", desc:"1 slice a elección y Bebida Mini.", price:4990, img:"/combo-mafioso.webp", sub:"" },
    { cat:"combos", id:"l-pesto-pollo", name:"Fetuccini Pesto con Pollo Gravy", desc:"Fetuccini al Pesto con Pollo con Gravy y Bebida Mini.", price:9990, img:"/fotos/local/pesto-pollo-gravy.webp" }
  ],
  /* Cambios solo para el local: price, name, desc, img, img2 (foto del slice), label (antes del precio), sub (texto bajo el precio), promo (etiqueta destacada) */
  overrides: {
    tgm: { price:5490, img:"/fotos/local/tgm.webp", img2:"/fotos/local/slice-tgm.webp", sub:"Familiar con palitos y bebida: $29.990" },
    pepperoni: { price:5490, img:"/fotos/local/pepperoni.webp", img2:"/fotos/local/slice-pepperoni.webp", sub:"Familiar con palitos y bebida: $29.990" },
    "pollo-bbq": { price:5490, img:"/fotos/local/pollo-bbq.webp", img2:"/fotos/local/slice-pollo-bbq.webp", sub:"Familiar con palitos y bebida: $29.990" },
    napolitana: { price:5490, img:"/fotos/local/napolitana.webp", img2:"/fotos/local/slice-napolitana.webp", sub:"Familiar con palitos y bebida: $29.990" },
    margarita: { price:4490, img:"/fotos/local/margarita.webp", img2:"/fotos/local/slice-margarita.webp", sub:"Familiar con palitos y bebida: $24.990" },
    ajillo: { price:5490, img:"/fotos/local/ajillo.webp", img2:"/fotos/local/slice-ajillo.webp", sub:"Familiar con palitos y bebida: $29.990" },
    funghi: { price:4490, img:"/fotos/local/funghi.webp", img2:"/fotos/local/slice-funghi.webp", sub:"Familiar con palitos y bebida: $24.990" }
  },
  /* Texto bajo el título de cada sección (id de la sección: texto). Vacío = sin texto. */
  notes: { pizzas: "Pizzas XXL o Slices", combos: "" },
  /* Banners de arriba. "to": #seccion, o #item:ID (lleva a ese plato), o #item:ID:slice (idem, con la carta en Slice) */
  banners: [
    { img:"/assets/banner-local-martes.webp", to:"#item:napolitana:slice", alt:"Todos los martes, 50% en slices" },
    { img:"/assets/banner-local-familiar.webp", to:"#item:l-familiar", alt:"Promo Familiar" },
    { img:"/assets/banner-local-slice.webp", to:"#item:l-slice-bebida", alt:"Slice y bebida" },
    { img:"/assets/banner-local-pesto.webp", to:"#item:l-pesto-pollo", alt:"Fetuccini Pesto con Pollo Gravy y bebida" }
  ]
};
if (typeof module !== "undefined") module.exports = LOCAL_DEFAULTS;
