// Carta del local: mismos productos que la carta online, con interruptores y cambios propios del local.
import DEFAULTS from "../../local-defaults.js";
import { openStore } from "./_store.mjs";
import { MENU } from "./_menu.mjs";

export const LOCAL_STORE = "mafia-menu";
export const LOCAL_KEY = "local-v1";
export const PHOTO_STORE = "mafia-local-photos";

const ITEMS = MENU.flatMap(c => c.items.map(it => ({ it, cat:c })));
const IDS = new Set(ITEMS.map(x => x.it.id));
const CATS = new Set(MENU.map(c => c.id));
const IMG_OK = s => typeof s === "string" && (/^\/fotos\/[\w./-]+$/.test(s) || /^\/\.netlify\/functions\/local-photo\?id=[\w-]+&v=\d+$/.test(s));

export function cleanLocal(raw = {}){
  const disabledProducts = Array.isArray(raw.disabledProducts) ? [...new Set(raw.disabledProducts.filter(id => IDS.has(id)))] : [];
  const overrides = {};
  if (raw.overrides && typeof raw.overrides === "object"){
    for (const [id, o] of Object.entries(raw.overrides)){
      if (!IDS.has(id) || !o || typeof o !== "object") continue;
      const c = {};
      if (Number.isFinite(+o.price) && o.price !== null && o.price !== "" && +o.price >= 0 && +o.price <= 1000000) c.price = Math.round(+o.price);
      if (typeof o.name === "string" && o.name.trim()) c.name = o.name.trim().slice(0, 80);
      if (typeof o.desc === "string") c.desc = o.desc.trim().slice(0, 400);
      if (o.img === null) c.img = null;                  // null = usar la foto de la carta online
      else if (IMG_OK(o.img)) c.img = o.img;
      if (Object.keys(c).length) overrides[id] = c;
    }
  }
  const notes = {};
  if (raw.notes && typeof raw.notes === "object"){
    for (const [id, t] of Object.entries(raw.notes)) if (CATS.has(id) && typeof t === "string") notes[id] = t.trim().slice(0, 160);
  }
  return { disabledProducts, overrides, notes };
}

// Valores de partida + lo guardado (lo guardado manda).
export function effective(stored, keepNull = false){
  const base = cleanLocal(DEFAULTS), s = stored ? cleanLocal(stored) : null;
  const overrides = {};
  for (const id of new Set([...Object.keys(base.overrides), ...Object.keys(s?.overrides || {})])){
    const m = { ...(base.overrides[id] || {}), ...(s?.overrides?.[id] || {}) };
    if (m.img === null && !keepNull) delete m.img;
    if (Object.keys(m).length) overrides[id] = m;
  }
  return {
    disabledProducts: s ? s.disabledProducts : base.disabledProducts,
    overrides,
    notes: { ...base.notes, ...(s?.notes || {}) }
  };
}

export async function readLocal(forPanel = false){
  const raw = await openStore(LOCAL_STORE).get(LOCAL_KEY, { type:"json", consistency:"strong" });
  return effective(raw, forPanel);
}
export async function writeLocal(state){
  const clean = cleanLocal(state);   // conserva img:null (= volver a la foto de la carta online)
  await openStore(LOCAL_STORE).setJSON(LOCAL_KEY, { ...clean, updatedAt:new Date().toISOString() });
  return effective(clean, true);
}

// Lista para el panel: cada producto con su valor online y su valor actual en el local.
export function panelItems(){
  return MENU.filter(c => !c.hidden).flatMap(c => c.items.map(it => ({
    id:it.id, category:c.name, categoryId:c.id, name:it.name, desc:it.desc || "", price:it.price, img:it.img || (it.foto ? `/fotos/${it.foto}.webp` : ""),
    byPick: it.priceByPick ? true : false
  })));
}
export const noteCategories = () => MENU.filter(c => !c.hidden).map(c => ({ id:c.id, name:c.name, note:c.note || "" }));
