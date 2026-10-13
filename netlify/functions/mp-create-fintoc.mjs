export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Método no permitido" }),
      { status: 405, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "Mercado Pago no configurado" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const body = await request.json();

    const amount = Number(body.amount);
    const email = String(body.email || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Monto inválido" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ ok: false, error: "Email requerido" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const origin = new URL(request.url).origin;

    const payload = {
      transaction_amount: amount,
      description: "Pedido MAFIA",
      payment_method_id: "fintoc",

      payer: {
        email
      },

      callback_url:
        `${origin}/?payment_method=fintoc&payment_return=1`,

      point_of_interaction: {
        type: "CHECKOUT",
        sub_type: "INTER_PSP"
      }
    };

    const response = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key":
            `fintoc-${crypto.randomUUID()}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Mercado Pago Fintoc error:", data);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "No se pudo crear el pago por transferencia",
          details: data
        }),
        {
          status: response.status,
          headers: { "content-type": "application/json" }
        }
      );
    }

    const redirectUrl =
      data?.point_of_interaction?.transaction_data?.external_resource_url ||
      data?.transaction_details?.external_resource_url ||
      data?.payment_method?.data?.external_resource_url;

    if (!redirectUrl) {
      console.error("Fintoc sin external_resource_url:", data);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Mercado Pago no devolvió la URL de transferencia",
          payment: data
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        payment_id: data.id,
        status: data.status,
        redirect_url: redirectUrl
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );

  } catch (error) {
    console.error("mp-create-fintoc:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Error interno"
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" }
      }
    );
  }
};
