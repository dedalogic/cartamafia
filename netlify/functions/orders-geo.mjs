// Mapa de pedidos: ubica las direcciones de los pedidos con delivery (pagados) y las guarda para no repetir consultas.
// Se llama varias veces seguidas: cada vez ubica unas pocas direcciones nuevas y devuelve cuántas faltan. Solo super admin.
import { json, readJson, checkAdmin } from "./_auth.mjs";
import { openStore } from "./_store.mjs";
import { ORDERS_STORE } from "./_mafia-orders.mjs";

const GEO_STORE = "mafia-geo", GEO_KEY = "cache-v1";
const PER_CALL = 3;                                             // direcciones nuevas por llamada (Nominatim pide 1 consulta por segundo)
const BOX = { left:-70.25, right:-70.00, top:-20.12, bottom:-20.36 };   // Iquique + Alto Hospicio
const UA = "MAFIA-pedidos/1.0 (somosmafia.cl)";

const plain = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const addrKey = a => plain(a).replace(/[,.;]+/g, " ").replace(/\s+/g, " ").trim();
// Solo la calle, sin número ni departamento: sirve para agrupar y como segundo intento.
export const streetOf = a => plain(a).replace(/[,;].*$/, "").replace(/\b(depto|dpto|departamento|casa|block|torre|oficina|of)\b.*$/, "").replace(/\s*(n°|nº|#|numero)?\s*\d+[\w-]*\s*$/, "").replace(/\s+/g, " ").trim();

async function nominatim(q){
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({ q, format:"jsonv2", limit:"1", countrycodes:"cl", bounded:"1",
    viewbox:`${BOX.left},${BOX.top},${BOX.right},${BOX.bottom}` }).toString();
  const r = await fetch(u, { headers:{ "User-Agent":UA, "Accept-Language":"es" } });
  if (!r.ok) throw new Error("geocoder " + r.status);
  const d = await r.json();
  return Array.isArray(d) && d[0] ? { lat:+d[0].lat, lng:+d[0].lon } : null;
}
const inBox = p => p && p.lat <= BOX.top && p.lat >= BOX.bottom && p.lng >= BOX.left && p.lng <= BOX.right;
const city = a => /hospicio/i.test(a) ? "Alto Hospicio" : "Iquique";

async function locate(address){
  const c = city(address);
  let p = await nominatim(`${address}, ${c}, Chile`);
  if (inBox(p)) return { ...p, approx:false };
  const st = streetOf(address);
  if (st && st !== plain(address)){
    await new Promise(r => setTimeout(r, 1100));
    p = await nominatim(`${st}, ${c}, Chile`);
    if (inBox(p)) return { ...p, approx:true };
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkAdmin(body); if (bad) return bad;
  const days = Math.min(Math.max(parseInt(body.days, 10) || 30, 1), 180);

  // Pedidos con delivery y dirección dentro del período
  const orders = openStore(ORDERS_STORE), since = Date.now() - days * 86400000;
  const { blobs } = await orders.list({ prefix:"orders/" });
  const keys = [];
  for (const key of blobs.map(b => b.key).sort().reverse()){
    const t = parseInt(key.slice(7).split("-")[1], 36);
    if (Number.isFinite(t) && t < since - 86400000) break;
    keys.push(key);
  }
  const byKey = new Map(); let total = 0;
  for (let i = 0; i < keys.length; i += 25){
    const group = await Promise.all(keys.slice(i, i + 25).map(k => orders.get(k, { type:"json", consistency:"strong" }).catch(() => null)));
    for (const o of group){
      if (!o || o.status !== "paid" || o.delivery_type !== "delivery" || !o.address || new Date(o.paid_at).getTime() < since) continue;
      total++;
      const k = addrKey(o.address); if (!k) continue;
      const e = byKey.get(k) || { address:String(o.address).trim(), count:0, amount:0 };
      e.count++; e.amount += o.paid_total ?? o.total ?? 0; byKey.set(k, e);
    }
  }

  // Ubicar las que faltan (con límite por llamada)
  const geo = openStore(GEO_STORE);
  const cache = (await geo.get(GEO_KEY, { type:"json", consistency:"strong" })) || {};
  const todo = [...byKey.keys()].filter(k => !cache[k] || (cache[k].fail && Date.now() - cache[k].at > 7 * 86400000));
  let netError = "", done = 0;
  for (const k of todo.slice(0, PER_CALL)){
    try {
      const p = await locate(byKey.get(k).address);
      cache[k] = p ? { lat:p.lat, lng:p.lng, approx:p.approx, at:Date.now() } : { fail:true, at:Date.now() };
      done++;
    } catch(e){ netError = e.message; break; }          // fallo de red: no se guarda, se reintenta
    await new Promise(r => setTimeout(r, 1100));
  }
  if (done) await geo.setJSON(GEO_KEY, cache);

  const points = [], failed = [];
  for (const [k, e] of byKey){
    const c = cache[k];
    if (c && !c.fail) points.push({ lat:c.lat, lng:c.lng, approx:!!c.approx, address:e.address, street:streetOf(e.address), count:e.count, amount:e.amount });
    else if (c?.fail) failed.push({ address:e.address, count:e.count });
  }
  const pending = [...byKey.keys()].filter(k => !cache[k]).length;
  return json({ days, orders:total, addresses:byKey.size, points, failed, pending, error:netError });
};
