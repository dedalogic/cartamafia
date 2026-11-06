// Órdenes MAFIA persistentes (Netlify Blobs, store "mafia-orders").
// Se guarda la orden ANTES de pedir el pago, para comparar después lo pagado contra lo pedido.
import { randomBytes } from "node:crypto";
import { openStore } from "./_store.mjs";
import { safeEqual } from "./_auth.mjs";

export const ORDERS_STORE = "mafia-orders";
const FIRST_NUMBER = 1;
export const KITCHEN_STATES = ["nuevo", "preparacion", "listo", "entregado"];
export const KITCHEN_LABELS = { nuevo:"Nuevo", preparacion:"En preparación", listo:"Listo", entregado:"Entregado" };

const store = () => openStore(ORDERS_STORE);
const orderKey = ref => `orders/${ref}`;
const b36 = bytes => [...randomBytes(bytes)].map(b => (b % 36).toString(36)).join("").toUpperCase();

// MAFIA-<hora en base 36>-<azar>: ordenable por fecha y difícil de adivinar.
export function createOrderReference(){
  return `MAFIA-${Date.now().toString(36).toUpperCase().padStart(8, "0")}-${b36(8)}`;
}
export const newStatusKey = () => randomBytes(18).toString("base64url");

export const shortCode = n => String(n).padStart(4, "0");     // 0001, 0002… (sin letras)

// Número corto visible (0001, 0002…). La unicidad la garantiza onlyIfNew en cada número reservado;
// el contador solo es una pista para no empezar siempre desde el principio.
async function allocateShortNumber(s, reference){
  let n = FIRST_NUMBER;
  try { const hint = await s.get("meta/short-counter-v2", { type:"json", consistency:"strong" }); if (Number.isInteger(hint?.last)) n = hint.last + 1; } catch {}
  for (let i = 0; i < 60; i++, n++){
    const r = await s.set(`shortn/${n}`, reference, { onlyIfNew:true });
    if (r.modified){ try { await s.setJSON("meta/short-counter-v2", { last:n }); } catch {} return n; }
  }
  throw new Error("No se pudo reservar un número de pedido");
}

export const totalsMatch = (expected, paid) => {
  const a = Number(expected), b = Number(paid);
  return Number.isFinite(a) && Number.isFinite(b) && Math.round(a) === Math.round(b);
};

async function readWithEtag(s, reference){
  const r = await s.getWithMetadata(orderKey(reference), { type:"json", consistency:"strong" });
  return r ? { order:r.data, etag:r.etag } : null;
}

export async function getOrderByReference(reference){
  if (typeof reference !== "string" || !/^MAFIA-[0-9A-Z]{8}-[0-9A-Z]{8}$/.test(reference)) return null;
  return (await readWithEtag(store(), reference))?.order || null;
}

// Modifica una orden con control de concurrencia (reintenta si otra función la cambió a la vez).
export async function updateOrder(reference, mutate){
  const s = store();
  for (let i = 0; i < 8; i++){
    const cur = await readWithEtag(s, reference);
    if (!cur) return null;
    const next = structuredClone(cur.order);
    const out = mutate(next);
    if (out === false) return { order:cur.order, changed:false };
    next.updated_at = new Date().toISOString();
    const w = await s.setJSON(orderKey(reference), next, { onlyIfMatch:cur.etag });
    if (w.modified) return { order:next, changed:true };
  }
  throw new Error("Conflicto al guardar la orden");
}

// Crea la orden pendiente. Si el cliente reintenta pagar (misma referencia y clave) se reutiliza.
export async function savePendingOrder({ cart, customer, delivery_type, delivery_fee, address, existing }){
  const s = store();
  const subtotal = cart.subtotal, fee = delivery_type === "delivery" ? delivery_fee : 0, total = subtotal + fee;
  const common = {
    total, subtotal, delivery_fee: fee,
    cart: { total:subtotal, count:cart.count, items:cart.items.map(i => ({ id:i.id, key:i.key, name:i.name, detail:i.detail, quantity:i.quantity, unit_price:i.unit_price, total_amount:i.total_amount })) },
    customer, delivery_type, address: delivery_type === "delivery" ? address : ""
  };
  if (existing){
    const r = await updateOrder(existing.reference, o => { if (o.status !== "pending") return false; Object.assign(o, common); });
    return r.order;
  }
  const reference = createOrderReference();
  const n = await allocateShortNumber(s, reference);
  const now = new Date().toISOString();
  const order = {
    reference, short_number:n, short_code:shortCode(n), status_key:newStatusKey(),
    status:"pending", kitchen_status:null,
    ...common,
    mercado_pago_order_id:null, payment_status:null, payment_status_detail:null,
    processed:false, fudo_sent:false, paid_total:null, attempts:0,
    created_at:now, updated_at:now, paid_at:null
  };
  await s.setJSON(orderKey(reference), order, { onlyIfNew:true });
  return order;
}

export function recordPreference(reference, preferenceId){
  return updateOrder(reference, o => { o.attempts = (o.attempts || 0) + 1; o.mp_preference_id = preferenceId; o.payment_flow = o.payment_flow || "checkout_pro"; });
}

export function recordAttempt(reference, { mpOrderId, status, statusDetail }){
  return updateOrder(reference, o => {
    o.attempts = (o.attempts || 0) + 1;
    if (mpOrderId) o.mercado_pago_order_id = mpOrderId;
    o.payment_status = status ?? o.payment_status;
    o.payment_status_detail = statusDetail ?? o.payment_status_detail;
  });
}

// Idempotente: si ya estaba pagada no hace nada (evita procesar dos veces el mismo webhook).
export function markOrderPaid(reference, { mpOrderId, status, statusDetail, paidTotal }){
  return updateOrder(reference, o => {
    if (o.status === "paid"){
      if (mpOrderId && o.mercado_pago_order_id && mpOrderId !== o.mercado_pago_order_id){
        o.duplicate_payments = [...new Set([...(o.duplicate_payments || []), mpOrderId])];   // posible doble cobro: revisar en Mercado Pago
        return;
      }
      return false;
    }
    o.status = "paid"; o.paid_at = new Date().toISOString();
    o.mercado_pago_order_id = mpOrderId || o.mercado_pago_order_id;
    o.payment_status = status; o.payment_status_detail = statusDetail; o.paid_total = paidTotal;
    o.kitchen_status = "nuevo";
  });
}

// Pago por "Pagar con Mercado Pago" (Checkout Pro): se identifica por el ID del pago, no de la Order.
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

export function markOrderProcessed(reference){
  return updateOrder(reference, o => { if (o.processed) return false; o.processed = true; o.processed_at = new Date().toISOString(); });
}

export function setKitchenStatus(reference, status){
  if (!KITCHEN_STATES.includes(status)) throw new Error("Estado inválido");
  return updateOrder(reference, o => {
    if (o.status !== "paid") return false;
    if (o.kitchen_status === status) return false;
    o.kitchen_status = status; o.kitchen_updated_at = new Date().toISOString();
    if (o.kitchen_status !== "nuevo" && !o.accepted_at) o.accepted_at = o.kitchen_updated_at;   // hora en que la cajera aceptó el pedido
  });
}

export function statusKeyOk(order, key){ return !!order && safeEqual(key, order.status_key); }

// Vista para el cliente (ticket): sin claves internas.
export function publicOrderView(o){
  return {
    reference:o.reference, short_code:o.short_code, status:o.status, paid:o.status === "paid",
    kitchen_status:o.kitchen_status, kitchen_label:KITCHEN_LABELS[o.kitchen_status] || null,
    created_at:o.created_at, paid_at:o.paid_at,
    delivery_type:o.delivery_type, address:o.address || "",
    items:o.cart.items.map(i => ({ name:i.name, detail:i.detail, quantity:i.quantity, unit_price:i.unit_price, total_amount:i.total_amount })),
    subtotal:o.subtotal, delivery_fee:o.delivery_fee, total:o.total, payment_status:o.payment_status
  };
}

// Vista para la caja: pedidos pagados recientes, los más nuevos primero.
export async function listPaidOrders({ days = 2, limit = 150 } = {}){
  const s = store();
  const { blobs } = await s.list({ prefix:"orders/" });
  const since = Date.now() - days * 86400000;
  const keys = blobs.map(b => b.key).sort().reverse();
  const out = [];
  for (const key of keys){
    const ref = key.slice(7), t = parseInt(ref.split("-")[1], 36);
    if (Number.isFinite(t) && t < since - 86400000) break;               // las claves van por fecha: las demás son más viejas
    const o = await s.get(key, { type:"json", consistency:"strong" });
    if (o && o.status === "paid" && new Date(o.paid_at).getTime() >= since) out.push(o);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => (b.paid_at || "").localeCompare(a.paid_at || ""));
}
