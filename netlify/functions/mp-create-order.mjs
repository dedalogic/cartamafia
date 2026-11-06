// Crea la orden MAFIA (precios validados aquí) y luego la Order en Mercado Pago (Checkout API + Orders API).
import { createHash, randomUUID } from "node:crypto";
import { json, readJson } from "./_auth.mjs";
import { readAvailability } from "./_availability.mjs";
import { validateCart, PricingError } from "./_mafia-pricing.mjs";
import { computeDeliveryFee } from "./_mafia-delivery.mjs";
import { getOrderByReference, savePendingOrder, recordAttempt, statusKeyOk, publicOrderView } from "./_mafia-orders.mjs";
import { mpEnabled, mpConfigured, mpFetch, amountString, getMpOrder, reconcileOrder, declineMessage } from "./_mp.mjs";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  if (!mpEnabled() || !mpConfigured()) return json({ error:"El pago online no está disponible por ahora." }, 403);
  const body = await readJson(req);
  if (!body) return json({ error:"Solicitud inválida" }, 400);

  // 1) datos del cliente
  const c = body.customer || {};
  const customer = { name:clean(c.name, 80), phone:clean(c.phone, 30), email:clean(c.email, 254).toLowerCase(), notes:clean(c.notes, 300), unit:clean(c.unit, 60) };
  const delivery_type = body.delivery_type === "delivery" ? "delivery" : body.delivery_type === "retiro" ? "retiro" : "";
  const address = clean(c.address, 200);
  if (!delivery_type) return json({ error:"Elige delivery o retiro." }, 400);
  if (customer.name.length < 2) return json({ error:"Escribe tu nombre." }, 400);
  if (!EMAIL.test(customer.email)) return json({ error:"Escribe un correo válido para enviarte el comprobante." }, 400);
  if (delivery_type === "delivery" && address.length < 5) return json({ error:"Escribe tu dirección para el delivery." }, 400);

  // 2) medio de pago (solo tarjeta; billeteras y transferencia están pausadas)
  const p = body.payment || {};
  const pmType = p.payment_method_type === "debit_card" ? "debit_card" : p.payment_method_type === "credit_card" ? "credit_card" : "";
  const installments = Number.isInteger(Number(p.installments)) && Number(p.installments) >= 1 && Number(p.installments) <= 24 ? Number(p.installments) : 1;
  if (!pmType || typeof p.token !== "string" || !p.token || typeof p.payment_method_id !== "string" || !/^[a-z0-9_]{2,40}$/i.test(p.payment_method_id))
    return json({ error:"Revisa los datos de tu tarjeta e inténtalo de nuevo." }, 400);

  // 3) precios SIEMPRE desde el servidor
  let cart;
  try { cart = validateCart(body.items, await readAvailability()); }
  catch (e){ if (e instanceof PricingError) return json({ error:e.message, code:e.code }, 409); throw e; }
  let fee = 0;
  if (delivery_type === "delivery"){
    const d = await computeDeliveryFee({ address });
    if (!d.ok) return json({ error:d.message, code:"delivery_unavailable" }, 409);
    fee = d.fee;
  }

  // 4) orden pendiente (se reutiliza si el cliente reintenta con otra tarjeta)
  let existing = null;
  if (body.reference){
    existing = await getOrderByReference(body.reference);
    if (!existing || !statusKeyOk(existing, body.status_key)) return json({ error:"Pedido no encontrado." }, 404);
    if (existing.status === "paid") return json({ ok:true, paid:true, already:true, order:publicOrderView(existing), reference:existing.reference, status_key:existing.status_key });
  }
  const order = await savePendingOrder({ cart, customer, delivery_type, delivery_fee:fee, address, existing });

  // 5) Order en Mercado Pago. La clave de idempotencia cambia en CADA intento real de pago.
  const attempt = /^[A-Za-z0-9-]{8,64}$/.test(String(body.attempt_id || "")) ? body.attempt_id : randomUUID();
  const idempotencyKey = createHash("sha256").update(`${order.reference}:${attempt}`).digest("hex").slice(0, 48);
  const total = amountString(order.total);
  const ident = p.payer?.identification;
  const payer = { email:customer.email };
  if (ident?.type && ident?.number) payer.identification = { type:clean(ident.type, 20), number:clean(ident.number, 30) };

  const mp = await mpFetch("/v1/orders", {
    method:"POST", idempotencyKey,
    body:{
      type:"online", processing_mode:"automatic",
      total_amount:total, external_reference:order.reference,
      description:`Pedido MAFIA ${order.short_code}`,
      payer,
      transactions:{ payments:[{ amount:total, payment_method:{ id:p.payment_method_id, type:pmType, token:p.token, installments } }] }
    }
  });

  const out = { reference:order.reference, short_code:order.short_code, status_key:order.status_key, total:order.total };
  if (!mp.ok || !mp.data?.id){
    console.error("MP create order error", mp.status, JSON.stringify(mp.data)?.slice(0, 800));
    await recordAttempt(order.reference, { status:"error", statusDetail:String(mp.data?.errors?.[0]?.code || mp.status) });
    const retry = mp.status === 409 || mp.status >= 500;
    return json({ ...out, ok:false, error: retry ? "No pudimos conectar con Mercado Pago. Inténtalo de nuevo en un momento." : declineMessage(mp.data?.status_detail), retry }, mp.status >= 500 ? 502 : 402);
  }

  // 6) estado final: se vuelve a consultar la Order a Mercado Pago y se aplica la regla única
  await recordAttempt(order.reference, { mpOrderId:mp.data.id, status:mp.data.status, statusDetail:mp.data.status_detail });
  let mpOrder = mp.data;
  try { mpOrder = await getMpOrder(mp.data.id); } catch (e){ console.error("No se pudo reconsultar la Order", e.message); }
  const rec = await reconcileOrder({ ...mpOrder, external_reference: mpOrder.external_reference || order.reference });
  const paid = rec.outcome === "paid" || rec.outcome === "already";
  if (paid) return json({ ...out, ok:true, paid:true, status:mpOrder.status, status_detail:mpOrder.status_detail });
  if (["failed", "canceled", "expired", "refunded"].includes(mpOrder.status))
    return json({ ...out, ok:false, error:declineMessage(mpOrder.status_detail), status:mpOrder.status, status_detail:mpOrder.status_detail }, 402);
  if (rec.outcome === "mismatch") return json({ ...out, ok:false, error:"El monto del pago no coincide. Contáctanos por WhatsApp con tu número de pedido." }, 409);
  return json({ ...out, ok:true, paid:false, pending:true, status:mpOrder.status, status_detail:mpOrder.status_detail });   // el cliente consulta hasta confirmar
};
