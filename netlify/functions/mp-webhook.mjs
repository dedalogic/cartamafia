import crypto from "node:crypto";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function safeEqual(a, b) {
  try {
    const aa = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");

    if (aa.length !== bb.length) return false;

    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ ok: true, message: "Webhook activo" });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error("Falta MERCADOPAGO_WEBHOOK_SECRET");
    return json({ ok: false, error: "Webhook secret no configurado" }, 500);
  }

  const url = new URL(req.url);

  const dataId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("data_id") ||
    "";

  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";

  const parts = Object.fromEntries(
    xSignature
      .split(",")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
  );

  const ts = parts.ts;
  const receivedSignature = parts.v1;

  if (!ts || !receivedSignature) {
    console.warn("Webhook sin firma válida");
    return json({ ok: false, error: "Firma incompleta" }, 401);
  }

  let manifest = "";

  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  if (!safeEqual(expectedSignature, receivedSignature)) {
    console.warn("Firma Mercado Pago inválida");
    return json({ ok: false, error: "Firma inválida" }, 401);
  }

  let body = {};

  try {
    body = await req.json();
  } catch {}

  console.log("✅ Webhook Mercado Pago válido", {
    type: body?.type,
    action: body?.action,
    data_id: body?.data?.id || dataId,
    live_mode: body?.live_mode
  });

  /*
   * Más adelante aquí haremos:
   *
   * 1. Consultar la orden real a Mercado Pago.
   * 2. Verificar que esté approved/accredited.
   * 3. Comprobar monto y pedido.
   * 4. Enviar automáticamente la comanda a Fudo.
   *
   * Por ahora SOLO validamos que Mercado Pago
   * realmente sea quien envía la notificación.
   */

  return json({ ok: true });
};
