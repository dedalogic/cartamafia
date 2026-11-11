// Público: el cliente responde su fecha de nacimiento desde su ticket (autorizado con la clave del pedido).
import { json, readJson } from "./_auth.mjs";
import { getOrderByReference, statusKeyOk } from "./_mafia-orders.mjs";
import { readCfg, phoneKey, parseBirth, setBirth, skipBirth } from "./_loyalty.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const b = await readJson(req); if (!b) return json({ error:"Solicitud inválida" }, 400);
  if (!(await readCfg()).enabled) return json({ error:"No disponible" }, 404);
  const order = await getOrderByReference(b.ref);
  if (!order || !statusKeyOk(order, b.key || "") || order.status !== "paid") return json({ error:"Pedido no encontrado" }, 404);
  const k = phoneKey(order.customer?.phone); if (!k) return json({ error:"Sin teléfono" }, 400);
  if (b.skip){ await skipBirth(k); return json({ ok:true }); }
  const iso = parseBirth(b.birth);
  if (!iso) return json({ error:"Revisa la fecha (día / mes / año)." }, 400);
  return (await setBirth(k, iso)) ? json({ ok:true }) : json({ error:"Inténtalo de nuevo." }, 409);
};
