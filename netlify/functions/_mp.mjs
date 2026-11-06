// Ayudantes de Mercado Pago (Orders API). El Access Token solo existe aquí, en el servidor.
import { createHmac } from "node:crypto";
import { safeEqual } from "./_auth.mjs";
import { getOrderByReference, markOrderPaid, markOrderProcessed, totalsMatch } from "./_mafia-orders.mjs";

const API = "https://api.mercadopago.com";

export const mpEnabled = () => String(process.env.MAFIA_MP_TEST_ENABLED || "").toLowerCase() === "true";
export const mpConfigured = () => !!process.env.MERCADOPAGO_ACCESS_TOKEN;

// CLP no tiene decimales. Si Mercado Pago pidiera formato decimal ("7990.00"), cambia la variable
// MAFIA_MP_AMOUNT_FORMAT a "decimal" (ver GUIA-DESPLIEGUE.md > Solución de problemas).
export function amountString(total){
  return process.env.MAFIA_MP_AMOUNT_FORMAT === "decimal" ? Number(total).toFixed(2) : String(Math.round(total));
}

export async function mpFetch(path, { method = "GET", body, idempotencyKey } = {}){
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw Object.assign(new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado"), { code:"no_token" });
  const headers = { Authorization:`Bearer ${token}`, "Content-Type":"application/json", Accept:"application/json" };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
  let data = null; try { data = await res.json(); } catch {}
  return { ok:res.ok, status:res.status, data };
}

export async function getMpOrder(id){
  const r = await mpFetch(`/v1/orders/${encodeURIComponent(id)}`);
  if (!r.ok) throw Object.assign(new Error(`Mercado Pago respondió ${r.status} al consultar la orden`), { code:"mp_lookup", status:r.status });
  return r.data;
}

export function paidAmountOf(mpOrder){
  if (mpOrder?.total_paid_amount !== undefined && mpOrder.total_paid_amount !== null && mpOrder.total_paid_amount !== "") return Number(mpOrder.total_paid_amount);
  const pays = mpOrder?.transactions?.payments || [];
  if (pays.length) return pays.reduce((a, p) => a + Number(p.paid_amount ?? p.amount ?? 0), 0);
  return Number(mpOrder?.total_amount);
}

// Valida x-signature (HMAC-SHA256) de las notificaciones de Mercado Pago.
export function verifySignature({ url, headers }){
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const sig = headers.get("x-signature") || "";
  const parts = Object.fromEntries(sig.split(",").map(p => p.trim().split("=").map(x => x.trim())).filter(p => p.length === 2));
  if (!parts.ts || !parts.v1) return false;
  let dataId = new URL(url).searchParams.get("data.id") || "";
  if (/^[A-Za-z0-9]+$/.test(dataId)) dataId = dataId.toLowerCase();
  const reqId = headers.get("x-request-id") || "";
  const manifest = (dataId ? `id:${dataId};` : "") + (reqId ? `request-id:${reqId};` : "") + `ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(parts.v1, expected);
}

// Regla única (webhook y consulta del cliente): solo se marca pagada con processed + accredited,
// con referencia conocida y el MISMO monto que la orden original.
export async function reconcileOrder(mpOrder){
  const reference = mpOrder?.external_reference;
  if (!reference) return { outcome:"no_reference" };
  const order = await getOrderByReference(reference);
  if (!order) return { outcome:"not_found", reference };
  if (mpOrder.status !== "processed" || mpOrder.status_detail !== "accredited")
    return { outcome:"ignored", reference, status:mpOrder.status, status_detail:mpOrder.status_detail };
  const paid = paidAmountOf(mpOrder);
  if (!totalsMatch(order.total, paid)) return { outcome:"mismatch", reference, expected:order.total, paid };
  const r = await markOrderPaid(reference, { mpOrderId:mpOrder.id, status:mpOrder.status, statusDetail:mpOrder.status_detail, paidTotal:paid });
  await markOrderProcessed(reference);
  return { outcome: r.changed ? "paid" : "already", reference };
}

const DECLINES = {
  cc_rejected_insufficient_amount:"Tu tarjeta no tiene saldo suficiente.",
  cc_rejected_bad_filled_security_code:"El código de seguridad (CVV) no es correcto.",
  cc_rejected_bad_filled_date:"La fecha de vencimiento no es correcta.",
  cc_rejected_bad_filled_other:"Revisa los datos de tu tarjeta.",
  cc_rejected_call_for_authorize:"Tu banco necesita que autorices este pago. Llámalos e inténtalo de nuevo.",
  cc_rejected_card_disabled:"Tu tarjeta está inactiva. Llama a tu banco para activarla.",
  cc_rejected_max_attempts:"Llegaste al límite de intentos. Prueba con otra tarjeta.",
  cc_rejected_high_risk:"No pudimos aprobar este pago. Prueba con otro medio de pago."
};
export const declineMessage = detail => DECLINES[detail] || "No pudimos procesar el pago. Revisa tus datos o prueba con otra tarjeta.";
