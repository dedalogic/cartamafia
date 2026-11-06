// Panel de caja: cambia el estado de un pedido (Nuevo → En preparación → Listo → Entregado).
import { json, readJson, checkAdmin } from "./_auth.mjs";
import { getOrderByReference, setKitchenStatus, KITCHEN_STATES } from "./_mafia-orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkAdmin(body); if (bad) return bad;
  if (!KITCHEN_STATES.includes(body.kitchen_status)) return json({ error:"Estado inválido" }, 400);
  const order = await getOrderByReference(body.reference);
  if (!order || order.status !== "paid") return json({ error:"Pedido no encontrado" }, 404);
  const r = await setKitchenStatus(order.reference, body.kitchen_status);
  return json({ ok:true, reference:order.reference, kitchen_status:r.order.kitchen_status });
};
