// Notificaciones de Mercado Pago (evento "Order"). Nunca se confía en el contenido del aviso:
// solo se usa el ID de la Order, que se vuelve a consultar a la Orders API.
import { json } from "./_auth.mjs";
import { verifySignature, getMpOrder, reconcileOrder, mpConfigured } from "./_mp.mjs";

export default async (req) => {
  if (req.method === "GET"){
    return json({ ok:true, message:"Webhook activo", secret_configured:!!process.env.MERCADOPAGO_WEBHOOK_SECRET, access_token_configured:mpConfigured() });
  }
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);

  if (!verifySignature({ url:req.url, headers:req.headers })) return json({ error:"Firma inválida" }, 401);

  let body = {}; try { body = await req.json(); } catch {}
  const orderId = new URL(req.url).searchParams.get("data.id") || body?.data?.id;
  if (!orderId) return json({ ok:true, ignored:"sin id" });

  let mpOrder;
  try { mpOrder = await getMpOrder(orderId); }
  catch (e){ console.error("webhook lookup", e.message); return json({ error:"No se pudo consultar la Order" }, 502); }   // Mercado Pago reintenta

  const r = await reconcileOrder(mpOrder);
  console.log("webhook", orderId, JSON.stringify(r));
  if (r.outcome === "no_reference" || r.outcome === "mismatch" || r.outcome === "not_found") return json({ ok:false, ...r }, 422);
  return json({ ok:true, ...r });
};
