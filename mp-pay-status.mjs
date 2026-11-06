// El cliente consulta aquí si su pago con el botón de Mercado Pago quedó aprobado.
// Si el aviso aún no llegó, se buscan los pagos de este pedido directamente en Mercado Pago.
import { json } from "./_auth.mjs";
import { getOrderByReference, statusKeyOk, publicOrderView } from "./_mafia-orders.mjs";
import { mpConfigured } from "./_mp.mjs";
import { searchPaymentsByRef, reconcilePayment } from "./_mafia-pay.mjs";

export default async (req) => {
  if (req.method !== "GET") return json({ error:"Método no permitido" }, 405);
  const url = new URL(req.url);
  let order = await getOrderByReference(url.searchParams.get("ref"));
  if (!order || !statusKeyOk(order, url.searchParams.get("key") || "")) return json({ error:"Pedido no encontrado" }, 404);
  if (order.status === "pending" && order.mp_preference_id && mpConfigured()){
    try {
      for (const pay of await searchPaymentsByRef(order.reference)){
        const rec = await reconcilePayment(pay);
        if (rec.outcome === "paid" || rec.outcome === "already"){ order = await getOrderByReference(order.reference); break; }
        if (rec.outcome === "mismatch") return json({ ...publicOrderView(order), problem:"amount_mismatch" });
      }
    } catch (e){ console.error("pay-status search", e.message); }
  }
  return json(publicOrderView(order));
};
