// Club de puntos y cumpleaños (Netlify Blobs, store "mafia-loyalty"). APAGADO por defecto:
// mientras no se active en el panel no se guarda ni se muestra nada.
import { openStore } from "./_store.mjs";

export const LOYALTY_STORE = "mafia-loyalty";
export const DEFAULT_CFG = { enabled:false, per:1000, goal:100, gift:"Bebida Mini", prize:"Slice + Bebida gratis", fiel_orders:5 };
const store = () => openStore(LOYALTY_STORE);

export async function readCfg(){
  try { const c = await store().get("config", { type:"json", consistency:"strong" }); return { ...DEFAULT_CFG, ...(c || {}) }; }
  catch { return { ...DEFAULT_CFG }; }
}
export async function saveCfg(patch){
  const cur = await readCfg(), n = { ...cur };
  if (typeof patch.enabled === "boolean") n.enabled = patch.enabled;
  const num = (v, lo, hi) => { v = Math.round(Number(v)); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };
  const per = num(patch.per, 100, 100000), goal = num(patch.goal, 1, 100000), fo = num(patch.fiel_orders, 1, 1000);
  if (per) n.per = per; if (goal) n.goal = goal; if (fo) n.fiel_orders = fo;
  for (const k of ["gift", "prize"]) if (typeof patch[k] === "string" && patch[k].trim()) n[k] = patch[k].trim().slice(0, 80);
  await store().setJSON("config", n);
  return n;
}

// El teléfono es el ID del cliente: últimos 9 dígitos (formato chileno 9XXXXXXXX).
export function phoneKey(p){ const d = String(p || "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-9) : ""; }
const ckey = k => `c/${k}`;
export async function getCustomer(k){ return k ? await store().get(ckey(k), { type:"json", consistency:"strong" }) : null; }

// Suma puntos de una orden pagada. Se llama una sola vez por orden (cuando pasa a "pagada").
export async function awardForOrder(order){
  const cfg = await readCfg(); if (!cfg.enabled) return null;
  const k = phoneKey(order?.customer?.phone); if (!k) return null;
  const s = store();
  for (let i = 0; i < 6; i++){
    const r = await s.getWithMetadata(ckey(k), { type:"json", consistency:"strong" });
    const c = r?.data || { phone:k, name:"", birth:null, birth_skips:0, points:0, spent:0, orders:0, refs:[], likes:{}, first_at:new Date().toISOString() };
    if (c.refs.includes(order.reference)) return c;
    const earned = Math.floor((order.total || 0) / cfg.per);
    c.name = order.customer.name || c.name; c.points += earned; c.spent += order.total || 0; c.orders += 1;
    c.refs = [...c.refs, order.reference].slice(-50); c.last_at = new Date().toISOString();
    c.last_earned = { ref:order.reference, points:earned };
    for (const it of order.cart.items) c.likes[it.name] = (c.likes[it.name] || 0) + (it.quantity || 1);
    const w = await s.setJSON(ckey(k), c, r ? { onlyIfMatch:r.etag } : { onlyIfNew:true });
    if (w.modified) return c;
  }
  return null;
}

// Lo que ve el cliente en su ticket (solo si el sistema está encendido y el pedido pagado).
export async function ticketView(order){
  const cfg = await readCfg(); if (!cfg.enabled || order.status !== "paid") return null;
  const c = await getCustomer(phoneKey(order.customer?.phone));
  if (!c) return null;
  const earned = Math.floor((order.total || 0) / cfg.per);
  return { points:c.points, earned, goal:cfg.goal, prize:cfg.prize, gift:cfg.gift, ask_birth:!c.birth && (c.birth_skips || 0) < 2 };
}

// "DD/MM/AAAA" -> "AAAA-MM-DD" o null si no es una fecha real y razonable.
export function parseBirth(v){
  const m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/.exec(String(v || "").trim()); if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const age = (Date.now() - dt.getTime()) / 31557600000;
  if (age < 5 || age > 110) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function setBirth(k, iso){
  const s = store();
  for (let i = 0; i < 6; i++){
    const r = await s.getWithMetadata(ckey(k), { type:"json", consistency:"strong" }); if (!r) return false;
    r.data.birth = iso;
    if ((await s.setJSON(ckey(k), r.data, { onlyIfMatch:r.etag })).modified) return true;
  }
  return false;
}
export async function skipBirth(k){
  const s = store();
  for (let i = 0; i < 6; i++){
    const r = await s.getWithMetadata(ckey(k), { type:"json", consistency:"strong" }); if (!r) return false;
    r.data.birth_skips = (r.data.birth_skips || 0) + 1;
    if ((await s.setJSON(ckey(k), r.data, { onlyIfMatch:r.etag })).modified) return true;
  }
  return false;
}

export async function listCustomers(){
  const s = store(), { blobs } = await s.list({ prefix:"c/" }), out = [];
  for (const b of blobs){ const c = await s.get(b.key, { type:"json", consistency:"strong" }); if (c) out.push(c); }
  return out;
}
