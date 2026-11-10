// Panel /admin/: pedidos que llegaron al paso de pago y NO se pagaron (para medir cuánta gente no termina de comprar).
// Solo lectura. Requiere la clave de administrador. No modifica pedidos.
import { json, readJson, checkAdmin } from "./_auth.mjs";
import { openStore } from "./_store.mjs";
import { ORDERS_STORE } from "./_mafia-orders.mjs";

const reason = o => {
  const age = Date.now() - new Date(o.created_at).getTime();
  if (o.payment_status && /reject|cancel|denied/i.test(o.payment_status)) return "Pago rechazado";
  if (o.mp_preference_id && !o.attempts) return age < 20 * 60000 ? "En Mercado Pago ahora" : "Fue a Mercado Pago y no pagó";
  if (o.attempts) return age < 20 * 60000 ? "Pagando ahora" : "Intentó pagar y no terminó";
  return age < 20 * 60000 ? "Pagando ahora" : "No terminó el pago";
};

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkAdmin(body); if (bad) return bad;
  const days = Math.min(Math.max(parseInt(body.days, 10) || 7, 1), 30);
  const s = openStore(ORDERS_STORE);
  const { blobs } = await s.list({ prefix:"orders/" });
  const since = Date.now() - days * 86400000;
  let started = 0, paid = 0;
  const unpaid = [];
  // Solo se leen los pedidos del período; se consultan en grupos en paralelo para no pasarse del tiempo máximo de la función.
  const keys = [];
  for (const key of blobs.map(b => b.key).sort().reverse()){
    const t = parseInt(key.slice(7).split("-")[1], 36);
    if (Number.isFinite(t) && t < since - 86400000) break;
    keys.push(key);
  }
  for (let i = 0; i < keys.length; i += 25){
    const group = await Promise.all(keys.slice(i, i + 25).map(k => s.get(k, { type:"json", consistency:"strong" }).catch(() => null)));
    for (const o of group){
      if (!o || !o.created_at || new Date(o.created_at).getTime() < since) continue;
      started++;
      if (o.status === "paid") { paid++; continue; }
      unpaid.push({
        reference:o.reference, short_code:o.short_code, created_at:o.created_at, reason:reason(o),
        delivery_type:o.delivery_type, total:o.total, attempts:o.attempts || 0, payment_detail:o.payment_status_detail || null,
        customer:{ name:o.customer?.name || "", phone:o.customer?.phone || "" },
        items:(o.cart?.items || []).map(i => ({ name:i.name, quantity:i.quantity }))
      });
    }
  }
  unpaid.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return json({ days, started, paid, unpaid_count:unpaid.length, unpaid:unpaid.slice(0, 100) });
};
