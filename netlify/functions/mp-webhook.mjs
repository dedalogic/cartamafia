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

async function getMercadoPagoOrder(orderId, accessToken) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("❌ Error consultando order en Mercado Pago", {
      order_id: orderId,
      status: response.status,
      mp_error: data?.message || data?.error || "desconocido",
    });

    throw new Error(
      `Mercado Pago respondió ${response.status}`
    );
  }

  return data;
}

export default async (req) => {
  /*
   * GET solamente sirve para comprobar que
   * la función está publicada y configurada.
   */
  if (req.method === "GET") {
    return json({
      ok: true,
      message: "Webhook activo",
      secret_configured: Boolean(
        process.env.MERCADOPAGO_WEBHOOK_SECRET
      ),
      access_token_configured: Boolean(
        process.env.MERCADOPAGO_ACCESS_TOKEN
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

  const secret =
    process.env.MERCADOPAGO_WEBHOOK_SECRET;

  const accessToken =
    process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!secret) {
    console.error(
      "❌ MERCADOPAGO_WEBHOOK_SECRET no configurado"
    );

    return json(
      {
        ok: false,
        error: "Webhook secret no configurado",
      },
      500
    );
  }

  if (!accessToken) {
    console.error(
      "❌ MERCADOPAGO_ACCESS_TOKEN no configurado"
    );

    return json(
      {
        ok: false,
        error: "Access Token no configurado",
      },
      500
    );
  }

  let body = {};

  try {
    body = await req.json();
  } catch {
    console.warn(
      "⚠️ No se pudo interpretar el body como JSON"
    );
  }

  const url = new URL(req.url);

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
    type: body?.type,
    action: body?.action,
    data_id: dataId,
    has_signature: Boolean(xSignature),
    has_request_id: Boolean(xRequestId),
    live_mode: body?.live_mode,
  });

  if (!dataId) {
    return json(
      {
        ok: false,
        error: "Falta ID de la order",
      },
      400
    );
  }

  if (!xSignature) {
    return json(
      {
        ok: false,
        error: "Falta x-signature",
      },
      401
    );
  }

  const signature =
    parseSignature(xSignature);

  const ts = signature.ts;
  const receivedSignature =
    signature.v1;

  if (!ts || !receivedSignature) {
    return json(
      {
        ok: false,
        error: "Firma incompleta",
      },
      401
    );
  }

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

  if (
    !safeEqual(
      expectedSignature,
      receivedSignature
    )
  ) {
    console.warn(
      "❌ Firma Mercado Pago inválida",
      {
        data_id: dataId,
      }
    );

    return json(
      {
        ok: false,
        error: "Firma inválida",
      },
      401
    );
  }

  console.log(
    "✅ Firma del webhook válida"
  );

  /*
   * IMPORTANTE:
   * No confiamos en el status que viene
   * dentro del webhook.
   *
   * Consultamos la order directamente
   * a Mercado Pago.
   */
  let order;

  try {
    order = await getMercadoPagoOrder(
      dataId,
      accessToken
    );
  } catch (error) {
    console.error(
      "❌ No se pudo verificar la order",
      error.message
    );

    /*
     * Respondemos 500 para que Mercado Pago
     * pueda volver a intentar la notificación.
     */
    return json(
      {
        ok: false,
        error:
          "No se pudo verificar la order",
      },
      500
    );
  }

  const orderStatus =
    order?.status || "";

  const orderStatusDetail =
    order?.status_detail || "";

  const orderId =
    order?.id || dataId;

  const externalReference =
    order?.external_reference || null;

  const total =
    Number(
      order?.total_amount ??
      order?.total_paid_amount ??
      0
    );

  console.log(
    "🔎 Order verificada directamente con Mercado Pago",
    {
      order_id: orderId,
      status: orderStatus,
      status_detail: orderStatusDetail,
      external_reference:
        externalReference,
      total,
    }
  );

  const paid =
    orderStatus === "processed" &&
    orderStatusDetail === "accredited";

  if (!paid) {
    console.log(
      "ℹ️ Order recibida pero todavía no acreditada",
      {
        order_id: orderId,
        status: orderStatus,
        status_detail:
          orderStatusDetail,
      }
    );

    return json({
      ok: true,
      verified: true,
      paid: false,
      order_id: orderId,
      status: orderStatus,
      status_detail:
        orderStatusDetail,
    });
  }

  /*
   * ACÁ TENEMOS EL PUNTO SEGURO.
   *
   * La firma era válida
   * Y además Mercado Pago confirmó
   * directamente que la order está pagada.
   */

  console.log(
    "💰 PAGO CONFIRMADO POR MERCADO PAGO",
    {
      order_id: orderId,
      external_reference:
        externalReference,
      total,
    }
  );

  /*
   * PRÓXIMO PASO:
   *
   * 1. Recuperar el pedido correspondiente
   *    usando external_reference.
   *
   * 2. Comparar el total pagado con
   *    el total calculado por MAFIA.
   *
   * 3. Evitar procesar dos veces
   *    el mismo order_id.
   *
   * 4. Enviar recién ahí
   *    la comanda a Fudo.
   */

  return json({
    ok: true,
    verified: true,
    paid: true,
    order_id: orderId,
    status: orderStatus,
    status_detail:
      orderStatusDetail,
  });
};

// webhook verify-order v3
