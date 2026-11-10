// Red de seguridad: cada 5 minutos revisa los pedidos recientes que siguen sin pagar y le pregunta a Mercado Pago
// si alguno tiene un pago aprobado cuyo aviso se perdió. Usa la MISMA regla de siempre (aprobado + acreditado + mismo monto).
// Si el pago existe pero no calza (monto distinto), marca el pedido para revisión a mano en el panel.
import { openStore } from "./_store.mjs";
import { ORDERS_STORE, updateOrder } from "./_mafia-orders.mjs";
import { mpConfigured, getMpOrder, reconcileOrder } from "./_mp.mjs";
import { searchPaymentsByRef, reconcilePayment } from "./_mafia-pay.mjs";

const MIN_AGE = 2 * 60000, MAX_AGE = 6 * 3600000;

export async function sweep(){
  if (!mpConfigured()) return { skipped:"sin token" };
  const s = openStore(ORDERS_STORE);
  const { blobs } = await s.list({ prefix:"orders/" });
  const now = Date.now(), pending = [];
  for (const key of blobs.map(b => b.key).sort().reverse()){
    const t = parseInt(key.slice(7).split("-")[1], 36);
    if (Number.isFinite(t) && t < now - MAX_AGE - 86400000) break;
    pending.push(key);
  }
  const out = { checked:0, paid:[], review:[] };
  for (let i = 0; i < pending.length; i += 20){
    const group = await Promise.all(pending.slice(i, i + 20).map(k => s.get(k, { type:"json", consistency:"strong" }).catch(() => null)));
    for (const o of group){
      if (!o || o.status === "paid" || !o.created_at) continue;
      const age = now - new Date(o.created_at).getTime();
      if (age < MIN_AGE || age > MAX_AGE) continue;
      out.checked++;
      try {
        let r = null;
        if (o.mercado_pago_order_id) r = await reconcileOrder(await getMpOrder(o.mercado_pago_order_id));
        if (!r || r.outcome === "ignored"){
          const pays = (await searchPaymentsByRef(o.reference)).filter(p => p.status === "approved");
          if (pays.length) r = await reconcilePayment(pays[0]);
        }
        if (!r) continue;
        if (r.outcome === "paid") out.paid.push(o.reference);
        if (r.outcome === "mismatch" && !o.review){
          out.review.push(o.reference);
          await updateOrder(o.reference, x => { x.review = { reason:"monto distinto", expected:r.expected, paid:r.paid, at:new Date().toISOString() }; });
        }
      } catch (e){ console.error("sweep", o.reference, e.message); }
    }
  }
  return out;
}

export default async () => {
  const r = await sweep();
  console.log("pay-sweep", JSON.stringify(r));
  return new Response(JSON.stringify(r), { headers:{ "content-type":"application/json" } });
};

export const config = { schedule: "*/5 * * * *" };
