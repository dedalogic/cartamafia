// Notificaciones de Mercado Pago (evento "Order"). Nunca se confía en el contenido del aviso:
// solo se usa el ID de la Order, que se vuelve a consultar a la Orders API.
import { json } from "./_auth.mjs";
import { verifySignature, getMpOrder, getMpPayment, reconcileOrder, reconcilePayment, mpConfigured } from "./_mp.mjs";

export default async (req) => {
  if (req.method === "GET"){
    return json({ ok:true, message:"Webhook activo", secret_configured:!!process.env.MERCADOPAGO_WEBHOOK_SECRET, access_token_configured:mpConfigured() });
  }
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);

  if (!verifySignature({ url:req.url, headers:req.headers })) return json({ error:"Firma inválida" }, 401);

  let body = {}; try { body = await req.json(); } catch {}
  const q = new URL(req.url).searchParams;
  const orderId = q.get("data.id") || body?.data?.id;
  if (!orderId) return json({ ok:true, ignored:"sin id" });

  // Aviso de pago (botón "Pagar con Mercado Pago"): también se consulta a Mercado Pago, no se confía en el aviso.
  const kind = String(q.get("type") || q.get("topic") || body?.type || body?.topic || "").toLowerCase();
  if (kind === "payment"){
    let payment;
    try { payment = await getMpPayment(orderId); }
    catch (e){ console.error("webhook payment lookup", e.message); return json({ error:"No se pudo consultar el pago" }, e.status === 404 ? 200 : 502); }
    const rp = await reconcilePayment(payment);
    console.log("webhook payment", orderId, JSON.stringify(rp));
    if (rp.outcome === "no_reference" || rp.outcome === "mismatch" || rp.outcome === "not_found") return json({ ok:false, ...rp }, 422);
    return json({ ok:true, ...rp });
  }

  let mpOrder;
  try { mpOrder = await getMpOrder(orderId); }
  catch (e){ console.error("webhook lookup", e.message); return json({ error:"No se pudo consultar la Order" }, 502); }   // Mercado Pago reintenta

  const r = await reconcileOrder(mpOrder);
  console.log("webhook", orderId, JSON.stringify(r));
  if (r.outcome === "no_reference" || r.outcome === "mismatch" || r.outcome === "not_found") return json({ ok:false, ...r }, 422);
  return json({ ok:true, ...r });
};
