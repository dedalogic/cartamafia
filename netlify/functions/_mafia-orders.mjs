import { getStore } from "@netlify/blobs";

const STORE_NAME = "mafia-orders";

function getOrdersStore() {
  return getStore({
    name: STORE_NAME,
    consistency: "strong",
  });
}

export function createOrderReference() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `MAFIA-${time}-${random}`;
}

export async function savePendingOrder({
  reference,
  total,
  cart,
  customer,
  deliveryType,
}) {
  if (!reference) {
    throw new Error("Falta reference");
  }

  const store = getOrdersStore();

  const order = {
    reference,
    status: "pending_payment",
    total: Number(total || 0),

    cart: cart || {},
    customer: customer || {},
    delivery_type: deliveryType || null,

    mercado_pago_order_id: null,
    payment_status: null,
    payment_status_detail: null,

    processed: false,
    fudo_sent: false,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await store.setJSON(reference, order);

  return order;
}

export async function getOrderByReference(reference) {
  if (!reference) return null;

  const store = getOrdersStore();

  try {
    return await store.get(reference, {
      type: "json",
    });
  } catch {
    return null;
  }
}

export async function markOrderPaid({
  reference,
  mercadoPagoOrderId,
  paymentStatus,
  paymentStatusDetail,
  paidTotal,
}) {
  if (!reference) {
    throw new Error("Falta reference");
  }

  const store = getOrdersStore();

  const current = await getOrderByReference(reference);

  if (!current) {
    throw new Error("Pedido MAFIA no encontrado");
  }

  const updated = {
    ...current,

    status: "paid",

    mercado_pago_order_id:
      mercadoPagoOrderId || current.mercado_pago_order_id,

    payment_status:
      paymentStatus || current.payment_status,

    payment_status_detail:
      paymentStatusDetail || current.payment_status_detail,

    paid_total: Number(paidTotal || 0),

    paid_at:
      current.paid_at || new Date().toISOString(),

    updated_at: new Date().toISOString(),
  };

  await store.setJSON(reference, updated);

  return updated;
}

export async function markOrderProcessed(reference) {
  const store = getOrdersStore();

  const current = await getOrderByReference(reference);

  if (!current) {
    throw new Error("Pedido MAFIA no encontrado");
  }

  if (current.processed) {
    return current;
  }

  const updated = {
    ...current,
    processed: true,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await store.setJSON(reference, updated);

  return updated;
}

export function totalsMatch(expected, paid) {
  const a = Math.round(Number(expected || 0));
  const b = Math.round(Number(paid || 0));

  return a === b;
}
