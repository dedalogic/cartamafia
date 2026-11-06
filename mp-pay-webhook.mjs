// Avisos de pago del botón "Pagar con Mercado Pago". No se confía en el aviso: se vuelve a consultar el pago.
import { json } from "./_auth.mjs";
import { verifySignature, mpConfigured } from "./_mp.mjs";
import { getMpPayment, reconcilePayment } from "./_mafia-pay.mjs";

export default async (req) => {
  if (req.method === "GET") return json({ ok:true, message:"Webhook de pagos activo", secret_configured:!!process.env.MERCADOPAGO_WEBHOOK_SECRET, access_token_configured:mpConfigured() });
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  if (!verifySignature({ url:req.url, headers:req.headers })) return json({ error:"Firma inválida" }, 401);

  let body = {}; try { body = await req.json(); } catch {}
  const q = new URL(req.url).searchParams;
  const id = q.get("data.id") || body?.data?.id;
  const kind = String(q.get("type") || q.get("topic") || body?.type || body?.topic || "").toLowerCase();
  if (!id || kind !== "payment") return json({ ok:true, ignored:"no es un aviso de pago" });

  let payment;
  try { payment = await getMpPayment(id); }
  catch (e){ console.error("pay-webhook lookup", e.message); return json({ error:"No se pudo consultar el pago" }, e.status === 404 ? 200 : 502); }
  const r = await reconcilePayment(payment);
  console.log("pay-webhook", id, JSON.stringify(r));
  if (r.outcome === "no_reference" || r.outcome === "mismatch" || r.outcome === "not_found") return json({ ok:false, ...r }, 422);
  return json({ ok:true, ...r });
};
