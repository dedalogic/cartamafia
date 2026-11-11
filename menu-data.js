/* =====================================================================
   MENÚ MAFIA — ÚNICA FUENTE DE VERDAD
   Lo usan la carta (navegador) y las funciones de Netlify (precios del pago online).
   Para cambiar un precio o plato, edita SOLO este archivo.
   ===================================================================== */
const MENU = [
  { id:"combos", name:"Combos", items:[
    { id:"combo-famiglia", name:"Combo Famiglia", people:3, desc:"6 slices a elección, máximo 2 sabores, 6 Palitos de Ajo y Bebida 1.5 L. Para 3 a 4 personas.", price:21990, img:"/combo-famiglia.webp",
      bundleChoices:[
        { label:"Elige el primer sabor", short:"Sabor 1", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige el segundo sabor", short:"Sabor 2", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Tus 6 slices", short:"Distribución", list:["3 + 3","4 + 2","2 + 4","5 + 1","1 + 5"] },
        { label:"Elige tu bebida 1.5 L", short:"Bebida", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] }
      ] },

    { id:"combo-doble-capo", name:"Combo Padrinos", people:2, desc:"2 pizzas de 40 cm a elección. Para 2 personas. Puedes convertirlo en combo con Palitos de Ajo + Bebida 1.5 L.", price:24990, img:"/combo-doble-capo.webp",
      bundleChoices:[
        { label:"Elige tu pizza 1", short:"Pizza 1", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu pizza 2", short:"Pizza 2", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] }
      ],
      combo:{ all:{ extra:5000, desc:"Palitos de Ajo + Bebida 1.5 L" } }
    },
    { id:"combo-mafioso", name:"Combo Mafioso", people:1, desc:"2 slices a elección y bebida mini. Para 1 persona.", price:9990, img:"/combo-mafioso.webp",
      bundleChoices:[
        { label:"Elige tu slice 1", short:"Slice 1", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu slice 2", short:"Slice 2", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu bebida mini", short:"Bebida", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] }
      ] },

    { id:"combo-complices", name:"Combo Cómplices", people:2, desc:"4 slices a elección y 2 bebidas mini. Para 2 personas.", price:16990, img:"/combo-complices.webp?v=3",
      bundleChoices:[
        { label:"Elige tu slice 1", short:"Slice 1", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu slice 2", short:"Slice 2", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu slice 3", short:"Slice 3", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu slice 4", short:"Slice 4", list:["Tony Pepperoni","The Good Meat","Il Traditore","Napolitana","Margarita","Al Ajillo Boss","Funghi"] },
        { label:"Elige tu bebida mini 1", short:"Bebida 1", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] },
        { label:"Elige tu bebida mini 2", short:"Bebida 2", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] }
      ] },

    { id:"combo-del-don", name:"Combo del Don", people:1, desc:"Fettuccine con salsa Bolognesa, 3 Albóndigas y Bebida Mini. Para 1 persona.", price:10990, img:"/combo-del-don.webp",
      bundleChoices:[
        { label:"Elige tu bebida mini", short:"Bebida", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] }
      ] },

    { id:"combo-duo-del-don", name:"Combo 2 Mafiosos", people:2, desc:"2 pastas a elección y 2 bebidas mini. Para 2 personas.", price:14990, img:"/combo-duo-del-don.webp",
      bundleChoices:[
        { label:"Elige la pasta 1", short:"Pasta 1", list:["La Bolognesa del Don","Alfredo Gravy","Vodka Boss","Pesto Limón","Il Mechada","Picante Pastel"] },
        { label:"Elige la pasta 2", short:"Pasta 2", list:["La Bolognesa del Don","Alfredo Gravy","Vodka Boss","Pesto Limón","Il Mechada","Picante Pastel"] },
        { label:"Elige tu bebida mini 1", short:"Bebida 1", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] },
        { label:"Elige tu bebida mini 2", short:"Bebida 2", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] }
      ] },
    { id:"promo-alfredo", name:"Promo Fetuccini Alfredo", people:1, desc:"Fetuccini Alfredo y bebida mini. Para 1 persona.", price:7990, img:"/combo-alfredo.webp",
      bundleChoices:[
        { label:"Elige tu bebida mini", short:"Bebida", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"] }
      ] }
  ]},
  { id:"entradas", name:"Entradas", items:[
    { id:"palitos", name:"Palitos de ajo", desc:"6 Palitos de Ajo cubiertos con Salsa Garlic y Queso Parmigiano. Incluye Salsa Pomodoro New York.", price:3990, img:"/palitos-ajo.webp",
      extras:{ label:"Agrega una salsa", ids:["top-pomodoro","top-bbq"] } },
    { id:"cremita-zapallo", name:"Crema de Zapallo", desc:"Crema casera de Zapallo con Palitos de Ajo y Queso Parmigiano.", price:5990, img:"", foto:"cremita-zapallo" }
  ]},
  { id:"pizzas", name:"Pizzas", note:"Formato único de 40 cm.", items:[
    { id:"tgm", name:"The Good Meat", desc:"Carne Mechada, Tocino, Salsa Pomodoro New York y Queso Mozzarella.",
      price:16990, img:"/tgm.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
    { id:"pepperoni", name:"Tony Pepperoni", desc:"Pepperoni Americano Ultradelgado, Salsa Pomodoro New York y Queso Mozzarella.",
      price:16990, img:"/pepperoni.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
    { id:"pollo-bbq", name:"Il Traditore", desc:"Pollo BBQ, Tocino, Cebolla Morada, Salsa BBQ y Queso Mozzarella.",
      price:16990, img:"/pollo-bbq.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
    { id:"napolitana", name:"Napolitana", desc:"Jamón, Tomate, Aceitunas de la Zona, Salsa Pomodoro New York, Queso Mozzarella y Orégano.",
      price:14990, img:"/napolitana.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
    { id:"margarita", name:"Margarita", desc:"Salsa Pomodoro New York, Queso Mozzarella y Albahaca Fresca.",
      price:14990, img:"/margarita.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
    { id:"ajillo", name:"Al Ajillo Boss", desc:"Camarones al Ajillo, Pimentón Rojo, Salsa Pomodoro New York, Queso Mozzarella y Perejil Fresco.",
      price:16990, img:"/ajillo.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
    { id:"funghi", name:"Funghi", desc:"Champiñones y Callampas Deshidratadas, Salsa Bechamel, Queso Mozzarella, Queso Parmigiano y Perejil Fresco.",
      price:14990, img:"/funghi.webp", combo:{ all:{ extra:5000, desc:"+ Palitos de ajo + Bebida 1.5 L" } },
      suggest:{ ids:["top-bbq", "top-pomodoro", "top-parmigiano"] } },
  ]},
  { id:"nuestras-pastas", name:"Nuestras Pastas", items:[
    { id:"np-bolognesa-albondigas", name:"La Bolognesa del Don", desc:"Fetuccini con salsa Bolognesa, 3 albóndigas y Parmigiano.", price:10490, img:"/np-bolognesa-albondigas.webp" },
    { id:"np-alfredo-gravy", name:"Alfredo Gravy", desc:"Fetuccini en salsa Alfredo con pollo y gravy.", price:9490, img:"/np-alfredo-gravy.webp" },
    { id:"np-pesto-lemon", name:"Pesto Limón", desc:"Fetuccini al pesto con pollo Lemon Pepper.", price:9490, img:"/np-pesto-lemon.webp" },
    { id:"np-carne-vino-ajo", name:"Carne al Vino & Ajo Parmigiano", desc:"Fetuccini con carne al vino, ajo y Parmigiano.", price:9990, img:"/np-carne-vino-ajo.webp" },
    { id:"np-mechada-mafia", name:"Fetuccini con Carne Mechada en Salsa Mafia", desc:"Fetuccini con carne mechada y Salsa Mafia.", price:10990, img:"/np-mechada-mafia.webp" }
  ]},

  { id:"pastas", name:"Arma tu Pasta", note:"Elige tu salsa. Agrega proteína si quieres.", items:[
    { id:"fetuccini", name:"Fetuccini", desc:"Salsa a elección: Alfredo, Pesto o Bolognesa.", price:7990, img:"", foto:"fetuccini-alfredo", photoBy:{ Alfredo:"fetuccini-alfredo", Pesto:"fetuccini-pesto", Bolognesa:"fetuccini-bolognesa.webp" },
      pick:{ label:"Elige tu salsa", short:"Salsa", list:["Alfredo","Pesto","Bolognesa"], hidden:["Vodka","Garlic","Picante","Lemon Pepper","Aglio Parmigiano"] },
      pickInSheet:true,
      priceByPick:{ Alfredo:7990, Pesto:7990, Bolognesa:8990 },
      combo:{ all:{ extra:990, desc:"+ Bebida mini" } },
      extras:{ label:"No olvides agregar tu proteína", ids:["albondigas", "pollo-gravy"] },
      suggest:{ ids:["albondigas","pollo-gravy"] } }
  ]},
  { id:"proteinas", name:"Proteínas", hidden:true, items:[
    { id:"albondigas", name:"3 Albóndigas", desc:"3 Albóndigas de carne de vacuno, cocinadas y servidas en su salsa.", price:2990, img:"/Albondigas.webp" },
    { id:"pollo-gravy", name:"Pollo con Gravy", desc:"Pollo al horno con Salsa Gravy.", price:2990, img:"/pollo-gravy.webp" }
  ]},
  { id:"toppings", name:"Toppings", items:[
    { id:"top-bbq", name:"BBQ", price:990, img:"/bbq.webp?v=3" },
    { id:"top-pomodoro", name:"Pomodoro New York", price:990, img:"/pomodoro.webp?v=3" },
    { id:"top-parmigiano", name:"Parmigiano", price:1290, img:"/parmigiano.webp?v=3" }
  ]},
  { id:"bebidas", name:"Bebidas", compact:true, items:[
    { id:"beb-350", name:"Bebida mini", desc:"Coca-Cola Original, Coca-Cola Zero, Sprite o Fanta.", price:1800, img:"", drinkChoice:{ label:"Elige tu bebida mini", list:["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"], suffix:"" } },
    { id:"beb-15", name:"Bebida 1.5 L", desc:"Coca-Cola Original o Zero.", price:3990, img:"", drinkChoice:{ label:"Elige tu bebida", list:["Coca-Cola Original","Coca-Cola Zero"], suffix:"1.5 L" } },
    { id:"agua", name:"Agua mineral 500 ml", desc:"Con o sin gas.", price:2000, img:"", drinkChoice:{ label:"Elige tu agua", list:["Con gas","Sin gas"], suffix:"" } },
    { id:"jugo", name:"Néctar en botella", desc:"Durazno, Piña o Naranja.", price:2490, img:"", drinkChoice:{ label:"Elige tu néctar", list:["Durazno","Piña","Naranja"], suffix:"" } }
  ]}
];

/* Pastas: "Arma tu Pasta" se muestra como último plato de "Nuestras Pastas", antes de Pizzas. */
(function(){
  const arma=MENU.find(c=>c.id==="pastas"), np=MENU.find(c=>c.id==="nuestras-pastas");
  arma.items.forEach(i=>{ if(i.id==="fetuccini") i.desc="Arma tu pasta: elige tu salsa (Alfredo, Pesto o Bolognesa) y agrega tu proteína."; });
  np.items.push(...arma.items);
  MENU.splice(MENU.indexOf(arma),1);
  MENU.splice(MENU.indexOf(np),1);
  MENU.splice(MENU.findIndex(c=>c.id==="pizzas"),0,np);
})();

if (typeof module !== "undefined") module.exports = MENU;
