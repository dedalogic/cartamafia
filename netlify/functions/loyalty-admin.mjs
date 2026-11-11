// Panel: configuración del club y lista de clientes. Solo administrador.
import { json, readJson, checkAdmin } from "./_auth.mjs";
import { readCfg, saveCfg, listCustomers } from "./_loyalty.mjs";

const ageOf = iso => iso ? Math.floor((Date.now() - new Date(iso + "T00:00:00Z").getTime()) / 31557600000) : null;
const daysToBirthday = iso => {
  if (!iso) return null;
  const now = new Date(), [, m, d] = iso.split("-").map(Number);
  let t = Date.UTC(now.getUTCFullYear(), m - 1, d); const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (t < today) t = Date.UTC(now.getUTCFullYear() + 1, m - 1, d);
  return Math.round((t - today) / 86400000);
};

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const b = await readJson(req); const bad = checkAdmin(b); if (bad) return bad;
  if (b.action === "set") return json({ config:await saveCfg(b.config || {}) });
  const config = await readCfg();
  const rows = (await listCustomers()).map(c => {
    const top = Object.entries(c.likes || {}).sort((x, y) => y[1] - x[1]).slice(0, 3).map(e => e[0]);
    return { phone:c.phone, name:c.name, age:ageOf(c.birth), birth:c.birth, bday_in:daysToBirthday(c.birth), points:c.points, orders:c.orders, spent:c.spent, last_at:c.last_at, top, fiel:c.orders >= config.fiel_orders };
  }).sort((x, y) => y.points - x.points);
  return json({ config, customers:rows });
};
