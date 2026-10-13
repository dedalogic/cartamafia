import crypto from "node:crypto";

import {
  getOrderByReference,
  markOrderPaid,
  markOrderProcessed,
  totalsMatch,
} from "./_mafia-orders.mjs";

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
      message: data?.message || data?.error || "desconocido",
    });

    throw new Error(`Mercado Pago respondió ${response.status}`);
  }

  return data;
}

function getPaidTotal(order) {
  /*
   * Buscamos el total pagado de varias formas
   * para tolerar diferencias en la respuesta.
   */

  if (order?.total_paid_amount != null) {
    return Number(order.total_paid_amount);
  }

  const payments =
    order?.transactions?.payments || [];

  if (Array.isArray(payments) && payments.length) {
    return payments.reduce((sum, payment) => {
      return (
        sum +
        Number(
          payment?.paid_amount ??
            payment?.amount ??
            0
        )
      );
    }, 0);
  }

  if (order?.total_amount != null) {
    return Number(order.total_amount);
  }

  return 0;
}

export default async (req) => {
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
    return json(
      {
        ok: false,
        error: "Webhook secret no configurado",
      },
      500
    );
  }

  if (!accessToken) {
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
  } catch {}

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

  const ts =
    signature.ts;

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
    console.warn("❌ Firma inválida", {
      order_id: dataId,
    });

    return json(
      {
        ok: false,
        error: "Firma inválida",
      },
      401
    );
  }

  /*
   * 1. CONSULTAMOS LA ORDER REAL
   */
  let mpOrder;

  try {
    mpOrder =
      await getMercadoPagoOrder(
        dataId,
        accessToken
      );
  } catch (error) {
    return json(
      {
        ok: false,
        error: "No se pudo verificar la order",
      },
      500
    );
  }

  const orderId =
    mpOrder?.id || dataId;

  const status =
    mpOrder?.status || "";

  const statusDetail =
    mpOrder?.status_detail || "";

  const externalReference =
    mpOrder?.external_reference || "";

  const paidTotal =
    getPaidTotal(mpOrder);

  console.log("🔎 Order Mercado Pago", {
    order_id: orderId,
    status,
    status_detail: statusDetail,
    external_reference: externalReference,
    paid_total: paidTotal,
  });

  /*
   * 2. SOLO SEGUIMOS SI MP CONFIRMA
   *    QUE ESTÁ ACREDITADO
   */
  const paid =
    status === "processed" &&
    statusDetail === "accredited";

  if (!paid) {
    return json({
      ok: true,
      verified: true,
      paid: false,
      order_id: orderId,
      status,
      status_detail: statusDetail,
    });
  }

  /*
   * 3. TIENE QUE EXISTIR external_reference
   */
  if (!externalReference) {
    console.error(
      "❌ Pago sin external_reference",
      {
        order_id: orderId,
      }
    );

    return json(
      {
        ok: false,
        error: "Orden sin referencia MAFIA",
      },
      400
    );
  }

  /*
   * 4. BUSCAMOS EL PEDIDO ORIGINAL DE MAFIA
   */
  const mafiaOrder =
    await getOrderByReference(
      externalReference
    );

  if (!mafiaOrder) {
    console.error(
      "❌ Pedido MAFIA no encontrado",
      {
        order_id: orderId,
        external_reference:
          externalReference,
      }
    );

    return json(
      {
        ok: false,
        error:
          "Pedido MAFIA no encontrado",
      },
      404
    );
  }

  /*
   * 5. COMPARAMOS EL TOTAL QUE DEBÍA PAGAR
   *    VS LO QUE REALMENTE PAGÓ EN MP
   */
  const expectedTotal =
    Number(mafiaOrder.total || 0);

  if (
    !totalsMatch(
      expectedTotal,
      paidTotal
    )
  ) {
    console.error(
      "🚨 MONTO NO COINCIDE",
      {
        order_id: orderId,
        external_reference:
          externalReference,
        expected_total:
          expectedTotal,
        paid_total:
          paidTotal,
      }
    );

    return json(
      {
        ok: false,
        error:
          "El monto pagado no coincide con el pedido",
      },
      409
    );
  }

  /*
   * 6. EVITAMOS PROCESAR DOS VECES
   */
  if (mafiaOrder.processed) {
    console.log(
      "ℹ️ Pedido ya procesado anteriormente",
      {
        order_id: orderId,
        external_reference:
          externalReference,
      }
    );

    return json({
      ok: true,
      verified: true,
      paid: true,
      already_processed: true,
      order_id: orderId,
      external_reference:
        externalReference,
    });
  }

  /*
   * 7. MARCAMOS EL PEDIDO COMO PAGADO
   */
  await markOrderPaid({
    reference:
      externalReference,

    mercadoPagoOrderId:
      orderId,

    paymentStatus:
      status,

    paymentStatusDetail:
      statusDetail,

    paidTotal,
  });

  /*
   * TODAVÍA NO ENVIAMOS A FUDO.
   *
   * Por ahora marcamos procesado para comprobar
   * que la lógica completa funciona y evitar
   * duplicados mientras estamos en TEST.
   */
  await markOrderProcessed(
    externalReference
  );

  console.log(
    "✅ PEDIDO MAFIA VERIFICADO Y PAGADO",
    {
      order_id:
        orderId,

      external_reference:
        externalReference,

      expected_total:
        expectedTotal,

      paid_total:
        paidTotal,

      customer:
        mafiaOrder?.customer?.name,

      fulfillment:
        mafiaOrder?.delivery_type,
    }
  );

  return json({
    ok: true,
    verified: true,
    paid: true,
    amount_verified: true,
    processed: true,

    order_id:
      orderId,

    external_reference:
      externalReference,

    total:
      paidTotal,
  });
};

// webhook mafia-order-validation v4
