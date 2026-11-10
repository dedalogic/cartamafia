// Notificaciones de Mercado Pago (evento "Order"). Nunca se confía en el contenido del aviso:
// solo se usa el ID de la Order, que se vuelve a consultar a la Orders API.
import { json } from "./_auth.mjs";
import { verifySignature, getMpOrder, reconcileOrder, mpConfigured } from "./_mp.mjs";
import { getMpPayment, reconcilePayment } from "./_mafia-pay.mjs";

export default async (req) => {
  if (req.method === "GET"){
    return json({ ok:true, message:"Webhook activo", secret_configured:!!process.env.MERCADOPAGO_WEBHOOK_SECRET, access_token_configured:mpConfigured() });
  }
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);

  if (!verifySignature({ url:req.url, headers:req.headers })){ console.warn("webhook  firma inválida", req.headers.get("x-signature") ? "con x-signature" : "sin x-signature"); return json({ error:"Firma inválida" }, 401); }

  let body = {}; try { body = await req.json(); } catch {}
  const q = new URL(req.url).searchParams;
  const orderId = q.get("data.id") || body?.data?.id;
  if (!orderId) return json({ ok:true, ignored:"sin id" });

  // Si en Mercado Pago el webhook está suscrito a "Pagos", el aviso trae el ID de un pago (no de una Order): se atiende aquí mismo.
  const kind = String(q.get("type") || q.get("topic") || body?.type || body?.topic || "").toLowerCase();
  if (kind === "payment"){
    let payment;
    try { payment = await getMpPayment(orderId); }
    catch (e){ console.error("webhook pago lookup", e.message); return json({ error:"No se pudo consultar el pago" }, e.status === 404 ? 200 : 502); }
    const pr = await reconcilePayment(payment);
    console.log("webhook pago", orderId, JSON.stringify(pr));
    if (pr.outcome === "no_reference" || pr.outcome === "mismatch" || pr.outcome === "not_found") return json({ ok:false, ...pr }, 422);
    return json({ ok:true, ...pr });
  }

  let mpOrder;
  try { mpOrder = await getMpOrder(orderId); }
  catch (e){ console.error("webhook lookup", e.message); return json({ error:"No se pudo consultar la Order" }, 502); }   // Mercado Pago reintenta

  const r = await reconcileOrder(mpOrder);
  console.log("webhook", orderId, JSON.stringify(r));
  if (r.outcome === "no_reference" || r.outcome === "mismatch" || r.outcome === "not_found") return json({ ok:false, ...r }, 422);
  return json({ ok:true, ...r });
};
