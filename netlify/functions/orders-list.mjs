// Panel de caja: pedidos pagados recientes. Requiere la clave de administrador.
import { json, readJson } from "./_auth.mjs";
import { checkStaff } from "./_mafia-roles.mjs";
import { listPaidOrders, KITCHEN_LABELS } from "./_mafia-orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkStaff(body); if (bad) return bad;
  const days = Math.min(Math.max(parseInt(body.days, 10) || 2, 1), 14);
  const orders = await listPaidOrders({ days });
  return json({ now:new Date().toISOString(), labels:KITCHEN_LABELS, orders:orders.map(o => ({
    reference:o.reference, short_code:o.short_code, short_number:o.short_number, kitchen_status:o.kitchen_status,
    paid_at:o.paid_at, accepted_at:o.accepted_at || null, mp_order_id:o.mercado_pago_order_id, payment_status:o.payment_status, delivery_type:o.delivery_type, address:o.address, customer:o.customer,
    items:o.cart.items.map(i => ({ name:i.name, detail:i.detail, quantity:i.quantity, unit_price:i.unit_price, total_amount:i.total_amount })),
    subtotal:o.subtotal, delivery_fee:o.delivery_fee, total:o.total, paid_total:o.paid_total,
    duplicate_payments:o.duplicate_payments || [], fudo_sent:!!o.fudo_sent, ratings:o.ratings || null
  })) });
};
