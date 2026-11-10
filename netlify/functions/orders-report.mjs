// Datos para el Resumen y el reporte: pedidos pagados de hasta 60 días (período actual + anterior para comparar). Solo super admin.
import { json, readJson, checkAdmin } from "./_auth.mjs";
import { openStore } from "./_store.mjs";
import { ORDERS_STORE } from "./_mafia-orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkAdmin(body); if (bad) return bad;
  const days = Math.min(Math.max(parseInt(body.days, 10) || 14, 1), 60);
  const s = openStore(ORDERS_STORE), since = Date.now() - days * 86400000;
  const { blobs } = await s.list({ prefix:"orders/" });
  const keys = [];
  for (const key of blobs.map(b => b.key).sort().reverse()){
    const t = parseInt(key.slice(7).split("-")[1], 36);
    if (Number.isFinite(t) && t < since - 86400000) break;
    keys.push(key);
  }
  const out = [];
  for (let i = 0; i < keys.length; i += 25){
    const group = await Promise.all(keys.slice(i, i + 25).map(k => s.get(k, { type:"json", consistency:"strong" }).catch(() => null)));
    for (const o of group){
      if (!o || o.status !== "paid" || new Date(o.paid_at).getTime() < since) continue;
      out.push({
        short_code:o.short_code, paid_at:o.paid_at, delivery_type:o.delivery_type, total:o.total, paid_total:o.paid_total,
        customer:{ name:o.customer?.name || "", phone:o.customer?.phone || "" },
        items:(o.cart?.items || []).map(i => ({ name:i.name, detail:i.detail, quantity:i.quantity, total_amount:i.total_amount }))
      });
    }
  }
  out.sort((a, b) => (b.paid_at || "").localeCompare(a.paid_at || ""));
  return json({ now:new Date().toISOString(), days, orders:out });
};
