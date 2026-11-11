/* =====================================================================
   CARTA DEL LOCAL (somosmafia.cl/carta) — valores de partida
   Lo que cambies desde el panel (Carta local) se guarda aparte y prevalece sobre esto.
   Si cambias "version", los valores guardados antes se descartan y vuelven estos.
   ===================================================================== */
const LOCAL_DEFAULTS = {
  version: 7,
  /* Productos que NO se muestran en el local: los combos de la carta online (el local tiene los suyos). */
  disabledProducts: ["combo-famiglia","combo-doble-capo","combo-mafioso"],
  /* Productos que solo existen en el local. Van al principio de su sección. */
  localItems: [
    { cat:"combos", id:"l-familiar", name:"Promo Familiar", desc:"Pizza XXL a elección, Palitos de Ajo y Bebida 1,5 L. De 4 a 6 personas.", price:24990, people:4, img:"/fotos/local/promo-familiar.webp", sub:"" },
    { cat:"combos", id:"l-slice-bebida", name:"Slice + Bebida", desc:"1 slice a elección y Bebida Mini.", price:4990, people:1, img:"/fotos/local/slice-bebida.webp?v=2", sub:"" },
    { cat:"combos", id:"l-pasta-familia", name:"Pasta en Familia", desc:"Escoge hasta 2 sabores, distribuye como quieras. 4 Pastas, Palitos de Ajo y Bebida 1,5 L.", price:29990, people:4, img:"/fotos/local/pasta-en-familia.webp?v=2" },
    { cat:"combos", id:"l-pesto-pollo", name:"Fetuccini Pesto con Pollo Gravy", desc:"Fetuccini al Pesto con Pollo Gravy y Bebida Mini.", price:9990, people:1, img:"/fotos/local/pesto-pollo-gravy.webp?v=2" }
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
    "palitos": { img:"/fotos/local/palitos-ajo.webp?v=2" },
    "combo-mafioso": { img:"/fotos/local/combo-mafioso.webp?v=2" },
    "combo-complices": { img:"/fotos/local/combo-complices.webp?v=4", desc:"4 slices a elección y 2 Bebidas Mini." },
    "promo-alfredo": { desc:"Fetuccini Alfredo y Bebida Mini." },
    "l-slice-bebida": { label:"Desde" },
    "l-familiar": { label:"Desde" },
    "combo-del-don": { price:9990, desc:"Fetuccini con salsa Bolognesa, 3 Albóndigas y Bebida Mini.", img:"/fotos/local/combo-del-don.webp?v=2" },
    "combo-duo-del-don": { img:"/fotos/local/combo-duo-del-don.webp?v=2", name:"Par de Mafiosos", desc:"2 pastas a elección y 2 Bebidas Mini." }
  },
  /* Texto bajo el título de cada sección (id de la sección: texto). Vacío = sin texto. */
  /* Orden de los combos (los que no estan aqui van al final) */
  order: { combos: ["l-slice-bebida","promo-alfredo","l-pesto-pollo","combo-del-don","combo-complices","combo-duo-del-don","l-familiar","l-pasta-familia"] },
  /* Tarjetas que se abren con las variedades a escoger (solo se muestran, no se compran desde aqui) */
  options: {
    "l-slice-bebida": { noun:"slices", title:"ELIGE TU SLICE", items:[
      { n:"Margarita", img:"/fotos/local/slice-margarita.webp", p:"$4.990" }, { n:"Funghi", img:"/fotos/local/slice-funghi.webp", p:"$4.990" },
      { n:"Tony Pepperoni", img:"/fotos/local/slice-pepperoni.webp", p:"$5.990" }, { n:"Il Traditore", img:"/fotos/local/slice-pollo-bbq.webp", p:"$5.990" },
      { n:"Napolitana", img:"/fotos/local/slice-napolitana.webp", p:"$5.990" }, { n:"Al Ajillo Boss", img:"/fotos/local/slice-ajillo.webp", p:"$5.990" } ] },
    "combo-complices": { noun:"slices", title:"ELIGE TUS SLICES", items:[
      { n:"Tony Pepperoni", img:"/fotos/local/slice-pepperoni.webp" }, { n:"Funghi", img:"/fotos/local/slice-funghi.webp" },
      { n:"Il Traditore", img:"/fotos/local/slice-pollo-bbq.webp" }, { n:"Margarita", img:"/fotos/local/slice-margarita.webp" } ] },
    "combo-duo-del-don": { noun:"pastas", title:"ELIGE TUS PASTAS", items:[ { n:"Bolognesa con Albóndigas", img:"/np-bolognesa-albondigas.webp" }, { n:"Pesto Pollo Limón", img:"/np-pesto-lemon.webp" }, { n:"Alfredo Pollo Gravy", img:"/np-alfredo-gravy.webp" } ] },
    "l-pasta-familia": { noun:"pastas", title:"ELIGE TUS PASTAS", items:[ { n:"Bolognesa con Albóndigas", img:"/np-bolognesa-albondigas.webp" }, { n:"Pesto Pollo Limón", img:"/np-pesto-lemon.webp" }, { n:"Alfredo Pollo Gravy", img:"/np-alfredo-gravy.webp" } ] },
    "l-familiar": { noun:"pizzas", title:"ELIGE TU PIZZA XXL", items:[
      { n:"Margarita", img:"/fotos/local/margarita.webp", p:"$24.990" }, { n:"Funghi", img:"/fotos/local/funghi.webp", p:"$24.990" },
      { n:"Tony Pepperoni", img:"/fotos/local/pepperoni.webp", p:"$29.990" }, { n:"Il Traditore", img:"/fotos/local/pollo-bbq.webp", p:"$29.990" },
      { n:"Napolitana", img:"/fotos/local/napolitana.webp", p:"$29.990" }, { n:"Al Ajillo Boss", img:"/fotos/local/ajillo.webp", p:"$29.990" } ] }
  },
  notes: { pizzas: "Pizzas XXL o Slices", combos: "" },
  /* Banners de arriba. "to": #seccion, o #item:ID (lleva a ese plato), o #item:ID:slice (idem, con la carta en Slice) */
  banners: [
    { img:"/assets/banner-local-martes-2.webp", to:"#item:napolitana:slice", alt:"Todos los martes, 50% en slices" },
    { img:"/assets/banner-local-familiar.webp?v=2", to:"#item:l-familiar", alt:"Promo Familiar" },
    { img:"/assets/banner-local-slice.webp?v=3", to:"#item:l-slice-bebida", alt:"Slice y bebida, desde $4.990" },
    { img:"/assets/banner-local-pasta-familia.webp", to:"#item:l-pasta-familia", alt:"Pasta en Familia" },
    { img:"/assets/banner-local-pesto.webp?v=3", to:"#item:l-pesto-pollo", alt:"Fetuccini Pesto con Pollo Gravy y bebida" }
  ]
};
if (typeof module !== "undefined") module.exports = LOCAL_DEFAULTS;
