import { openStore } from "./_store.mjs";
import { MENU, sauceId } from "./_menu.mjs";
import { roleOf } from "./_mafia-roles.mjs";

const STORE = "mafia-menu";
const KEY = "availability-v2";

// El catálogo sale solo del menú (menu-data.js): si agregas un plato ahí, aparece aquí automáticamente.
const CATALOG = (() => {
  const list = [], seen = new Set();
  const add = x => { if (!seen.has(x.id)){ seen.add(x.id); list.push(x); } };
  for (const cat of MENU){
    for (const it of cat.items){
      add({ id:it.id, name:it.name, category:cat.name, img:it.img || "", ...(it.options ? { options:it.options.map(o => o.label) } : {}) });
    }
  }
  for (const it of IDX_ALL()){
    if (it.pick) for (const name of it.pick.list) add({ id:sauceId(name), name, category:"Salsas" });
  }
  return list;
})();
function IDX_ALL(){ return MENU.flatMap(c => c.items); }

const PRODUCT_IDS = new Set(CATALOG.map(x => x.id));
const OPTIONS = Object.fromEntries(CATALOG.filter(x => x.options).map(x => [x.id, x.options.map((_,i) => String(i))]));

const response = (data, status=200) => Response.json(data, {
  status,
  headers:{
    "Cache-Control":"no-store, no-cache, must-revalidate, max-age=0",
    "Pragma":"no-cache",
    "Expires":"0",
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
  const store = openStore(STORE);

  if (req.method === "GET"){
    return response(await readState(store));
  }

  if (req.method !== "POST") return response({error:"Método no permitido"},405);

  const password = process.env.MAFIA_ADMIN_PASSWORD;
  if (!password) return response({error:"MAFIA_ADMIN_PASSWORD no está configurada"},503);

  let body;
  try { body = await req.json(); }
  catch { return response({error:"Solicitud inválida"},400); }

  const role = roleOf(body?.password);
  if (!role){
    return response({error:"Credencial incorrecta"},401);
  }

  if (body.action === "login"){
    return response({ ...(await readState(store)), catalog:CATALOG, role });
  }

  if (body.action === "set"){
    const state = cleanState(body);
    const savedAt = new Date().toISOString();
    await store.setJSON(KEY, { ...state, updatedAt:savedAt });
    return response({ ...state, savedAt });
  }

  return response({error:"Acción inválida"},400);
};
