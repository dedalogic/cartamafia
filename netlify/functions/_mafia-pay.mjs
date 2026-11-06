// Pago con el botón "Pagar con Mercado Pago" (Checkout Pro). Archivo independiente: solo usa funciones
// que ya existían, para no depender de que otros archivos estén actualizados.
import { getOrderByReference, updateOrder, totalsMatch, markOrderProcessed } from "./_mafia-orders.mjs";
import { mpFetch } from "./_mp.mjs";

export function recordPreference(reference, preferenceId){
  return updateOrder(reference, o => { o.attempts = (o.attempts || 0) + 1; o.mp_preference_id = preferenceId; o.payment_flow = o.payment_flow || "checkout_pro"; });
}

export async function getMpPayment(id){
  const r = await mpFetch(`/v1/payments/${encodeURIComponent(id)}`);
  if (!r.ok) throw Object.assign(new Error(`Mercado Pago respondió ${r.status} al consultar el pago`), { code:"mp_lookup", status:r.status });
  return r.data;
}
export async function searchPaymentsByRef(reference){
  const r = await mpFetch(`/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc&limit=10`);
  if (!r.ok) throw Object.assign(new Error(`Mercado Pago respondió ${r.status} al buscar pagos`), { code:"mp_lookup", status:r.status });
  return r.data?.results || [];
}

export function markPaymentPaid(reference, { paymentId, status, statusDetail, paidTotal }){
  const pid = String(paymentId);
  return updateOrder(reference, o => {
    if (o.status === "paid"){
      if (o.mp_payment_id && o.mp_payment_id !== pid){
        o.duplicate_payments = [...new Set([...(o.duplicate_payments || []), pid])];   // otro pago aprobado para el mismo pedido: revisar en Mercado Pago
        return;
      }
      if (!o.mp_payment_id && !o.mercado_pago_order_id) o.mp_payment_id = pid; else return false;
      return;
    }
    o.status = "paid"; o.paid_at = new Date().toISOString(); o.payment_flow = "checkout_pro";
    o.mp_payment_id = pid;
    o.payment_status = status; o.payment_status_detail = statusDetail; o.paid_total = paidTotal;
    o.kitchen_status = "nuevo";
  });
}

// Misma regla de siempre: solo approved + accredited, referencia conocida y MISMO monto.
export async function reconcilePayment(payment){
  const reference = payment?.external_reference;
  if (!reference) return { outcome:"no_reference" };
  const order = await getOrderByReference(reference);
  if (!order) return { outcome:"not_found", reference };
  if (payment.status !== "approved" || payment.status_detail !== "accredited")
    return { outcome:"ignored", reference, status:payment.status, status_detail:payment.status_detail };
  const paid = Number(payment.transaction_amount);
  if (!totalsMatch(order.total, paid)) return { outcome:"mismatch", reference, expected:order.total, paid };
  const r = await markPaymentPaid(reference, { paymentId:payment.id, status:payment.status, statusDetail:payment.status_detail, paidTotal:paid });
  await markOrderProcessed(reference);
  return { outcome: r.changed ? "paid" : "already", reference };
}
