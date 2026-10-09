import crypto from "node:crypto";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function safeEqual(a, b) {
  try {
    const aa = Buffer.from(String(a), "hex");
    const bb = Buffer.from(String(b), "hex");

    if (!aa.length || !bb.length || aa.length !== bb.length) {
      return false;
    }

    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function parseSignature(header) {
  const result = {};

  for (const part of String(header || "").split(",")) {
    const [key, ...valueParts] = part.trim().split("=");
    const value = valueParts.join("=");

    if (key && value) {
      result[key.trim()] = value.trim();
    }
  }

  return result;
}

export default async (req) => {
  /*
   * GET: sirve solamente para comprobar desde el navegador
   * que la función está publicada.
   */
  if (req.method === "GET") {
    return json({
      ok: true,
      message: "Webhook activo",
      secret_configured: Boolean(
        process.env.MERCADOPAGO_WEBHOOK_SECRET
      ),
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        error: "Método no permitido",
      },
      405
    );
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  /*
   * Nunca mostramos el secret.
   * Solo registramos si existe o no.
   */
  if (!secret) {
    console.error(
      "❌ MERCADOPAGO_WEBHOOK_SECRET no está disponible en este deploy"
    );

    return json(
      {
        ok: false,
        error: "Webhook secret no configurado",
      },
      500
    );
  }

  /*
   * Leemos primero el body porque algunas notificaciones
   * pueden traer data.id dentro del JSON.
   */
  let body = {};

  try {
    body = await req.json();
  } catch (error) {
    console.warn("⚠️ No se pudo interpretar el body como JSON");
  }

  const url = new URL(req.url);

  /*
   * Mercado Pago normalmente manda data.id también
   * como parámetro en la URL.
   *
   * Dejamos fallback al body para hacer el receptor
   * más tolerante en las pruebas.
   */
  const dataId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("data_id") ||
    body?.data?.id?.toString() ||
    "";

  const xSignature =
    req.headers.get("x-signature") || "";

  const xRequestId =
    req.headers.get("x-request-id") || "";

  console.log("📩 Webhook Mercado Pago recibido", {
    method: req.method,
    type: body?.type,
    action: body?.action,
    data_id: dataId,
    has_signature: Boolean(xSignature),
    has_request_id: Boolean(xRequestId),
    has_secret: Boolean(secret),
    live_mode: body?.live_mode,
  });

  if (!xSignature) {
    console.warn("❌ Falta header x-signature");

    return json(
      {
        ok: false,
        error: "Falta x-signature",
      },
      401
    );
  }

  const signature = parseSignature(xSignature);

  const ts = signature.ts;
  const receivedSignature = signature.v1;

  if (!ts || !receivedSignature) {
    console.warn("❌ Firma incompleta", {
      has_ts: Boolean(ts),
      has_v1: Boolean(receivedSignature),
    });

    return json(
      {
        ok: false,
        error: "Firma incompleta",
      },
      401
    );
  }

  /*
   * Manifest utilizado para verificar que la notificación
   * realmente proviene de Mercado Pago.
   */
  let manifest = "";

  if (dataId) {
    manifest += `id:${dataId};`;
  }

  if (xRequestId) {
    manifest += `request-id:${xRequestId};`;
  }

  manifest += `ts:${ts};`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  if (!safeEqual(expectedSignature, receivedSignature)) {
    console.warn("❌ Firma Mercado Pago inválida", {
      data_id: dataId,
      has_request_id: Boolean(xRequestId),
      manifest_length: manifest.length,
    });

    return json(
      {
        ok: false,
        error: "Firma inválida",
      },
      401
    );
  }

  console.log("✅ Webhook Mercado Pago válido", {
    type: body?.type,
    action: body?.action,
    data_id: dataId,
    status: body?.data?.status,
    status_detail: body?.data?.status_detail,
    live_mode: body?.live_mode,
  });

  /*
   * PRÓXIMA ETAPA:
   *
   * Cuando esto ya esté validado:
   *
   * 1. Consultaremos la orden directamente a Mercado Pago.
   * 2. Confirmaremos status = processed.
   * 3. Confirmaremos status_detail = accredited.
   * 4. Verificaremos monto y external_reference.
   * 5. Evitaremos procesar dos veces la misma orden.
   * 6. Recién ahí enviaremos la comanda a Fudo.
   */

  return json({
    ok: true,
    received: true,
  });
};

// webhook redeploy v2
