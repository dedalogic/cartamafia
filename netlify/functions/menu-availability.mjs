import { getStore } from "@netlify/blobs";

const STORE = "mafia-menu";
const KEY = "availability-v2";

const CATALOG = [
  { id:"pizza-combo-info", name:"Hazla combo", category:"Combos" },
  { id:"promo-alfredo", name:"Promo Alfredo", category:"Combos" },
  { id:"combo-indecisos", name:"Combo Indecisos", category:"Combos" },
  { id:"combo-soprano", name:"Combo Soprano", category:"Combos" },
  { id:"palitos", name:"Palitos de ajo", category:"Entradas" },
  { id:"cremita-zapallo", name:"Cremita de Zapallo", category:"Entradas" },
  { id:"tgm", name:"The Good Meat", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"pepperoni", name:"Tony Pepperoni", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"pollo-bbq", name:"Il Traditore", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"napolitana", name:"Napolitana", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"margarita", name:"Margarita", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"ajillo", name:"Al Ajillo Boss", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"funghi", name:"Funghi", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"chocleta", name:"La Chocleta", category:"Pizzas", options:["Slice","40 cm","60 cm"] },
  { id:"fetuccini", name:"Fetuccini", category:"Pastas" },
  { id:"bucatini", name:"Bucatini", category:"Pastas" },
  { id:"albondigas", name:"Albóndigas", category:"Proteínas" },
  { id:"pollo-gravy", name:"Pollo con Gravy", category:"Proteínas" },
  { id:"top-bbq", name:"BBQ", category:"Toppings" },
  { id:"top-pomodoro", name:"Pomodoro New York", category:"Toppings" },
  { id:"top-parmigiano", name:"Parmigiano", category:"Toppings" },
  { id:"top-ketchup", name:"Ketchup", category:"Toppings" },
  { id:"beb-350", name:"Bebida mini", category:"Bebidas" },
  { id:"beb-15", name:"Bebida 1.5 L", category:"Bebidas" },
  { id:"agua", name:"Agua mineral 500 ml", category:"Bebidas" },
  { id:"jugo", name:"Néctar en botella", category:"Bebidas" }
];

const PRODUCT_IDS = new Set(CATALOG.map(x => x.id));
const OPTIONS = Object.fromEntries(CATALOG.filter(x => x.options).map(x => [x.id, x.options.map((_,i) => String(i))]));

const response = (data, status=200) => Response.json(data, {
  status,
  headers:{
    "Cache-Control":"no-store, max-age=0",
    "Content-Type":"application/json; charset=utf-8"
  }
});

function cleanState(raw={}){
  const disabledProducts = Array.isArray(raw.disabledProducts)
    ? [...new Set(raw.disabledProducts.filter(id => PRODUCT_IDS.has(id)))]
    : [];
  const disabledOptions = {};
  if (raw.disabledOptions && typeof raw.disabledOptions === "object"){
    for (const [id, vals] of Object.entries(raw.disabledOptions)){
      if (!OPTIONS[id] || !Array.isArray(vals)) continue;
      const ok = [...new Set(vals.map(String).filter(v => OPTIONS[id].includes(v)))];
      if (ok.length) disabledOptions[id] = ok;
    }
  }
  return { disabledProducts, disabledOptions };
}

async function readState(store){
  const raw = await store.get(KEY, { type:"json", consistency:"strong" });
  return cleanState(raw || {});
}

export default async (req) => {
  const store = getStore({ name:STORE, consistency:"strong" });

  if (req.method === "GET"){
    return response(await readState(store));
  }

  if (req.method !== "POST") return response({error:"Método no permitido"},405);

  const password = process.env.MAFIA_ADMIN_PASSWORD;
  if (!password) return response({error:"MAFIA_ADMIN_PASSWORD no está configurada"},503);

  let body;
  try { body = await req.json(); }
  catch { return response({error:"Solicitud inválida"},400); }

  if (typeof body?.password !== "string" || body.password !== password){
    return response({error:"Credencial incorrecta"},401);
  }

  if (body.action === "login"){
    return response({ ...(await readState(store)), catalog:CATALOG });
  }

  if (body.action === "set"){
    const state = cleanState(body);
    await store.setJSON(KEY, { ...state, updatedAt:new Date().toISOString() });
    return response(state);
  }

  return response({error:"Acción inválida"},400);
};
