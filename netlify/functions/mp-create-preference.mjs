// Botón "Pagar con Mercado Pago" (Checkout Pro): precios validados aquí; el cliente paga en Mercado Pago
// (app o web, con su cuenta o tarjetas guardadas) y vuelve a la carta. El pedido se marca pagado solo por aviso/consulta verificada.
import { json, readJson } from "./_auth.mjs";
import { readAvailability } from "./_availability.mjs";
import { validateCart, PricingError } from "./_mafia-pricing.mjs";
import { computeDeliveryFee } from "./_mafia-delivery.mjs";
import { getOrderByReference, savePendingOrder, statusKeyOk, publicOrderView } from "./_mafia-orders.mjs";
import { recordPreference } from "./_mafia-pay.mjs";
import { mpEnabled, mpConfigured, mpFetch, amountString } from "./_mp.mjs";
import { readPaySwitch } from "./_mafia-switch.mjs";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  if (!mpEnabled() || !mpConfigured() || !(await readPaySwitch())) return json({ error:"El pago online no está disponible por ahora." }, 403);
  const body = await readJson(req);
  if (!body) return json({ error:"Solicitud inválida" }, 400);

  const c = body.customer || {};
  const customer = { name:clean(c.name, 80), phone:clean(c.phone, 30), email:clean(c.email, 254).toLowerCase(), notes:clean(c.notes, 300), unit:clean(c.unit, 60) };
  const delivery_type = body.delivery_type === "delivery" ? "delivery" : body.delivery_type === "retiro" ? "retiro" : "";
  const address = clean(c.address, 200);
  if (!delivery_type) return json({ error:"Elige delivery o retiro." }, 400);
  if (customer.name.length < 2) return json({ error:"Escribe tu nombre." }, 400);
  if (customer.email && !EMAIL.test(customer.email)) return json({ error:"Escribe un correo válido." }, 400);
  if (customer.phone.replace(/\D/g, "").length < 8) return json({ error:"Escribe tu teléfono para avisarte de tu pedido." }, 400);
  if (delivery_type === "delivery" && address.length < 5) return json({ error:"Escribe tu dirección para el delivery." }, 400);

  let cart;
  try { cart = validateCart(body.items, await readAvailability()); }
  catch (e){ if (e instanceof PricingError) return json({ error:e.message, code:e.code }, 409); throw e; }
  let fee = 0;
  if (delivery_type === "delivery"){
    const d = await computeDeliveryFee({ address });
    if (!d.ok) return json({ error:d.message, code:"delivery_unavailable" }, 409);
    fee = d.fee;
  }

  let existing = null;
  if (body.reference){
    existing = await getOrderByReference(body.reference);
    if (!existing || !statusKeyOk(existing, body.status_key)) return json({ error:"Pedido no encontrado." }, 404);
    if (existing.status === "paid") return json({ ok:true, paid:true, already:true, order:publicOrderView(existing), reference:existing.reference, status_key:existing.status_key });
  }
  const order = await savePendingOrder({ cart, customer, delivery_type, delivery_fee:fee, address, existing });

  const origin = (process.env.MAFIA_PUBLIC_URL || new URL(req.url).origin).replace(/\/+$/, "");
  const minimal = {
    items:[{ id:order.reference, title:`Pedido MAFIA ${order.short_code}`, quantity:1, currency_id:"CLP", unit_price:Number(amountString(order.total)) }],
    external_reference:order.reference,
    notification_url:`${origin}/.netlify/functions/mp-pay-webhook`,
    back_urls:{ success:`${origin}/delivery/?mp=success`, failure:`${origin}/delivery/?mp=failure`, pending:`${origin}/delivery/?mp=pending` },
    auto_return:"approved"
  };
  // Versión completa; si Mercado Pago rechaza algún campo opcional, se reintenta con la mínima.
  const full = { ...minimal,
    payer:{ ...(customer.email ? { email:customer.email } : {}), name:customer.name },
    binary_mode:true,
    payment_methods:{ installments:1, excluded_payment_types:[{ id:"ticket" }, { id:"atm" }, { id:"bank_transfer" }] },
    statement_descriptor:"MAFIA"
  };
  let mp = await mpFetch("/checkout/preferences", { method:"POST", body:full });
  if (!mp.ok && mp.status >= 400 && mp.status < 500 && mp.status !== 401 && mp.status !== 403){
    console.error("MP preference (completa) rechazada", mp.status, JSON.stringify(mp.data)?.slice(0, 600));
    mp = await mpFetch("/checkout/preferences", { method:"POST", body:minimal });
  }

  const out = { reference:order.reference, short_code:order.short_code, status_key:order.status_key, total:order.total };
  if (!mp.ok || !mp.data?.id || !mp.data?.init_point){
    console.error("MP preference error", mp.status, JSON.stringify(mp.data)?.slice(0, 800));
    const d = mp.data || {};
    const detail = [mp.status, d.message || d.error, ...(Array.isArray(d.cause) ? d.cause.map(c => c.description || c.code) : [])].filter(Boolean).join(" · ").slice(0, 200);
    return json({ ...out, ok:false, detail, error:"No pudimos conectar con Mercado Pago. Inténtalo de nuevo en un momento." }, 502);
  }
  await recordPreference(order.reference, mp.data.id);
  return json({ ...out, ok:true, init_point:mp.data.init_point });
};
