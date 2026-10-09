import { validateCart } from "./_mafia-pricing.mjs";
import {
  createOrderReference,
  savePendingOrder,
} from "./_mafia-orders.mjs";

const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const clean = (s) =>
  String(s || "")
    .trim()
    .slice(0, 200);

export default async (req) => {
  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        error: "Método no permitido",
      },
      405
    );
  }

  if (process.env.MAFIA_MP_TEST_ENABLED !== "true") {
    return json(
      {
        ok: false,
        error: "Mercado Pago TEST está desactivado",
      },
      404
    );
  }

  const token =
    process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!token) {
    return json(
      {
        ok: false,
        error: "Access Token no configurado",
      },
      503
    );
  }

  let body;

  try {
    body = await req.json();
  } catch {
    return json(
      {
        ok: false,
        error: "Solicitud inválida",
      },
      400
    );
  }

  /*
   * El backend vuelve a calcular el carrito.
   * Nunca confiamos en el total enviado por el navegador.
   */
  let cartData;

  try {
    cartData = validateCart(body.cart);
  } catch (e) {
    return json(
      {
        ok: false,
        error: e.message || "Carrito inválido",
      },
      400
    );
  }

  const customer = body.customer || {};
  const fulfillment = body.fulfillment;

  if (clean(customer.name).length < 2) {
    return json(
      {
        ok: false,
        error: "Nombre inválido",
      },
      400
    );
  }

  if (
    !["delivery", "retiro"].includes(
      fulfillment
    )
  ) {
    return json(
      {
        ok: false,
        error: "Tipo de entrega inválido",
      },
      400
    );
  }

  if (
    fulfillment === "delivery" &&
    clean(customer.address).length < 5
  ) {
    return json(
      {
        ok: false,
        error: "Dirección inválida",
      },
      400
    );
  }

  const pay = body.payment || {};

  const paymentType = clean(
    pay.payment_type_id
  );

  if (
    ![
      "credit_card",
      "debit_card",
    ].includes(paymentType)
  ) {
    return json(
      {
        ok: false,
        error:
          "Tipo de tarjeta no soportado en esta prueba",
      },
      400
    );
  }

  if (
    !clean(pay.token) ||
    !clean(pay.payment_method_id)
  ) {
    return json(
      {
        ok: false,
        error:
          "Faltan datos tokenizados del pago",
      },
      400
    );
  }

  const installments = Number(
    pay.installments || 1
  );

  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 48
  ) {
    return json(
      {
        ok: false,
        error: "Cuotas inválidas",
      },
      400
    );
  }

  const payer = pay.payer || {};

  const email = clean(payer.email);

  if (!email || !email.includes("@")) {
    return json(
      {
        ok: false,
        error:
          "Mercado Pago requiere un correo válido",
      },
      400
    );
  }

  /*
   * attempt_id sigue siendo necesario únicamente
   * para la idempotencia del intento de pago.
   */
  const attempt = clean(body.attempt_id)
    .replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    )
    .slice(0, 80);

  if (!attempt) {
    return json(
      {
        ok: false,
        error:
          "Intento de pago inválido",
      },
      400
    );
  }

  /*
   * Creamos NUESTRA referencia del pedido.
   * Esta referencia une:
   *
   * MAFIA ↔ Mercado Pago ↔ futuro Fudo
   */
  const externalReference =
    createOrderReference();

  /*
   * Guardamos el pedido ANTES de cobrar.
   *
   * Así cuando llegue el webhook,
   * podremos comprobar que realmente
   * corresponde a un pedido generado
   * por nuestra página.
   */
  try {
    await savePendingOrder({
      reference: externalReference,
      total: cartData.total,

      /*
       * Guardamos el carrito ya validado por
       * el backend, no un total inventado
       * por el navegador.
       */
      cart: cartData,

      customer: {
        name: clean(customer.name),
        phone: clean(customer.phone),
        address: clean(customer.address),
        notes: clean(customer.notes),
        email,
      },

      deliveryType: fulfillment,
    });
  } catch (e) {
    console.error(
      "❌ No se pudo guardar pedido MAFIA",
      {
        reference: externalReference,
        message: e?.message,
      }
    );

    return json(
      {
        ok: false,
        error:
          "No se pudo registrar el pedido antes del pago",
      },
      500
    );
  }

  /*
   * Orden enviada a Mercado Pago.
   */
  const order = {
    type: "online",

    processing_mode:
      "automatic",

    total_amount:
      String(cartData.total),

    external_reference:
      externalReference,

    payer: {
      email,
    },

    transactions: {
      payments: [
        {
          amount:
            String(cartData.total),

          payment_method: {
            id: clean(
              pay.payment_method_id
            ),

            type: paymentType,

            token: clean(
              pay.token
            ),

            installments,
          },
        },
      ],
    },
  };

  if (
    payer.identification &&
    payer.identification.type &&
    payer.identification.number
  ) {
    order.payer.identification = {
      type: clean(
        payer.identification.type
      ),

      number: clean(
        payer.identification.number
      ),
    };
  }

  try {
    const response = await fetch(
      "https://api.mercadopago.com/v1/orders",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,

          /*
           * Cada intento real de pago
           * tiene su propia clave.
           */
          "X-Idempotency-Key":
            `mafia-${attempt}`.slice(
              0,
              128
            ),
        },

        body:
          JSON.stringify(order),
      }
    );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        (
          Array.isArray(
            data?.errors
          ) &&
          data.errors[0]
            ?.message
        ) ||
        "Mercado Pago rechazó la solicitud";

      console.error(
        "❌ Mercado Pago rechazó la order",
        {
          external_reference:
            externalReference,

          status:
            response.status,

          message,
        }
      );

      return json(
        {
          ok: false,
          error: message,
          mp_status:
            response.status,
          mp_code:
            data?.code ||
            data?.error ||
            "",
        },

        response.status >= 500
          ? 502
          : 400
      );
    }

    console.log(
      "✅ Order Mercado Pago creada",
      {
        order_id:
          data.id || "",

        external_reference:
          externalReference,

        status:
          data.status || "",

        status_detail:
          data.status_detail || "",

        total:
          cartData.total,
      }
    );

    return json({
      ok: true,

      order_id:
        data.id || "",

      status:
        data.status || "",

      status_detail:
        data.status_detail || "",

      total:
        cartData.total,

      external_reference:
        externalReference,
    });
  } catch (e) {
    console.error(
      "❌ Error conectando con Mercado Pago",
      {
        external_reference:
          externalReference,

        message:
          e?.message,
      }
    );

    return json(
      {
        ok: false,
        error:
          "No se pudo conectar con Mercado Pago",
      },
      502
    );
  }
};
