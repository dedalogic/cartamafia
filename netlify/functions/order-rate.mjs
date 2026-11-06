// El cliente califica cada producto de su pedido (1 a 5 estrellas + comentario opcional).
// Solo cuando el pedido ya está listo o entregado. Se identifica con la misma clave de seguimiento del pedido.
import { json, readJson } from "./_auth.mjs";
import { getOrderByReference, statusKeyOk, updateOrder } from "./_mafia-orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const order = await getOrderByReference(body.ref);
  if (!order || !statusKeyOk(order, String(body.key || ""))) return json({ error:"Pedido no encontrado" }, 404);
  if (order.status !== "paid" || !["listo", "entregado"].includes(order.kitchen_status)) return json({ error:"Podrás opinar cuando tu pedido esté listo." }, 409);
  const n = order.cart.items.length;
  const seen = new Set(), items = [];
  for (const r of Array.isArray(body.ratings) ? body.ratings : []){
    const i = Number(r && r.i), stars = Number(r && r.stars);
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) continue;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) continue;
    seen.add(i);
    items.push({ i, name:order.cart.items[i].name, stars, comment:String((r && r.comment) || "").replace(/\s+/g, " ").trim().slice(0, 300) });
  }
  if (!items.length) return json({ error:"Elige al menos una calificación." }, 400);
  const r = await updateOrder(order.reference, o => { o.ratings = { at:new Date().toISOString(), items }; });
  return json({ ok:true, ratings:r.order.ratings });
};
