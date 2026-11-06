// Panel /admin/: ver y cambiar el interruptor del pago online. Requiere la clave de administrador.
import { json, checkAdmin, readJson } from "./_auth.mjs";
import { mpEnabled, mpConfigured } from "./_mp.mjs";
import { readPaySwitch, writePaySwitch } from "./_mafia-switch.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  const bad = checkAdmin(body); if (bad) return bad;
  if (body.action === "set") await writePaySwitch(body.online !== false && body.online !== "false");
  return json({
    online: await readPaySwitch(),
    ready: mpEnabled() && mpConfigured() && !!process.env.MERCADOPAGO_PUBLIC_KEY   // false = falta configurar en Netlify
  });
};
