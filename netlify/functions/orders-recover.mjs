// Rescate: marca como pagado un pedido cuyo aviso de Mercado Pago no llegó. Solo super admin.
// Consulta el pago directo a Mercado Pago y aplica la MISMA regla de siempre (aprobado, acreditado, mismo monto, referencia conocida).
import { json, readJson, checkAdmin } from "./_auth.mjs";
import { getMpPayment, searchPaymentsByRef, reconcilePayment } from "./_mafia-pay.mjs";

const MSG = {
  paid:"Listo: el pedido quedó pagado y ya aparece en Pedidos.",
  already:"Ese pedido ya estaba pagado.",
  ignored:"Mercado Pago no lo tiene aprobado y acreditado todavía.",
  mismatch:"El monto cobrado no coincide con el del pedido. Revísalo en Mercado Pago.",
  not_found:"El pago existe, pero no se encontró el pedido en el sistema.",
  no_reference:"El pago no trae referencia de pedido."
};

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkAdmin(body); if (bad) return bad;
  const raw = String(body.payment_id || "").trim();
  if (!raw) return json({ error:"Falta el número de operación" }, 400);
  try {
    let payment;
    if (/^\d{5,}$/.test(raw)) payment = await getMpPayment(raw);
    else {
      const list = await searchPaymentsByRef(raw);
      payment = list.find(p => p.status === "approved") || list[0];
      if (!payment) return json({ ok:false, outcome:"no_payment", message:"No hay pagos en Mercado Pago con esa referencia." });
    }
    const r = await reconcilePayment(payment);
    console.log("recover", payment.id, JSON.stringify(r));
    return json({ ok:r.outcome === "paid" || r.outcome === "already", ...r, payment_id:payment.id, message:MSG[r.outcome] || "Sin cambios." });
  } catch (e) {
    console.error("recover", e.message);
    return json({ error:e.status === 404 ? "Mercado Pago no encontró ese pago." : "No se pudo consultar Mercado Pago." }, e.status === 404 ? 404 : 502);
  }
};
