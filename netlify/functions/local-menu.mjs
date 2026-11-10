import { json, readJson } from "./_auth.mjs";
import { roleOf } from "./_mafia-roles.mjs";
import { openStore } from "./_store.mjs";
import { readLocal, writeLocal, panelItems, noteCategories, PHOTO_STORE } from "./_local.mjs";

const MAX_B64 = 2_200_000;   // ~1,6 MB de imagen

export default async (req) => {
  if (req.method === "GET") return json({ ...(await readLocal()) });
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);

  const body = await readJson(req);
  if (!body) return json({ error:"Solicitud inválida" }, 400);
  if (!process.env.MAFIA_ADMIN_PASSWORD) return json({ error:"MAFIA_ADMIN_PASSWORD no está configurada" }, 503);
  if (roleOf(body.password) !== "admin") return json({ error:"Credencial incorrecta" }, 401);

  if (body.action === "login"){
    return json({ ...(await readLocal(true)), items:panelItems(), categories:noteCategories() });
  }
  if (body.action === "set"){
    return json({ ...(await writeLocal(body)), savedAt:new Date().toISOString() });
  }
  if (body.action === "photo"){
    const id = String(body.id || "");
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.data || "");
    if (!/^[\w-]{1,60}$/.test(id) || !panelItems().some(x => x.id === id)) return json({ error:"Producto inválido" }, 400);
    if (!m) return json({ error:"La foto debe ser JPG, PNG o WebP" }, 400);
    if (m[2].length > MAX_B64) return json({ error:"La foto pesa demasiado" }, 413);
    const v = Date.now();
    await openStore(PHOTO_STORE).setJSON(id, { type:m[1], b64:m[2], v });
    return json({ ok:true, url:`/.netlify/functions/local-photo?id=${id}&v=${v}` });
  }
  return json({ error:"Acción inválida" }, 400);
};
