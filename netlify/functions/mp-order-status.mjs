// El cliente consulta aquí si su pago quedó aprobado (y recibe los datos del ticket).
// Si el webhook aún no llegó, se consulta directamente a Mercado Pago y se aplica la misma regla de validación.
import { json } from "./_auth.mjs";
import { getOrderByReference, statusKeyOk, publicOrderView } from "./_mafia-orders.mjs";
import { ticketView } from "./_loyalty.mjs";
import { getMpOrder, reconcileOrder, mpConfigured } from "./_mp.mjs";

export default async (req) => {
  if (req.method !== "GET") return json({ error:"Método no permitido" }, 405);
  const url = new URL(req.url);
  let order = await getOrderByReference(url.searchParams.get("ref"));
  if (!order || !statusKeyOk(order, url.searchParams.get("key") || "")) return json({ error:"Pedido no encontrado" }, 404);

  if (order.status === "pending" && order.mercado_pago_order_id && mpConfigured()){
    try {
      const rec = await reconcileOrder(await getMpOrder(order.mercado_pago_order_id));
      if (rec.outcome === "paid" || rec.outcome === "already") order = await getOrderByReference(order.reference);
      else if (rec.outcome === "mismatch") return json({ ...publicOrderView(order), problem:"amount_mismatch" });
    } catch (e){ console.error("status lookup", e.message); }
  }
  let loyalty = null; try { loyalty = await ticketView(order); } catch {}
  return json({ ...publicOrderView(order), loyalty });
};
