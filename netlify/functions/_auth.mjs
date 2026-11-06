import { createHash, timingSafeEqual } from "node:crypto";

const digest = s => createHash("sha256").update(String(s)).digest();

// Compara claves sin filtrar información por tiempo de respuesta.
export function safeEqual(a, b){
  if (typeof a !== "string" || typeof b !== "string") return false;
  return timingSafeEqual(digest(a), digest(b));
}

export const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control":"no-store, no-cache, must-revalidate, max-age=0", "Content-Type":"application/json; charset=utf-8" }
});

// Devuelve null si la clave de administrador es correcta; si no, la respuesta de error.
export function checkAdmin(body){
  const expected = process.env.MAFIA_ADMIN_PASSWORD;
  if (!expected) return json({ error:"MAFIA_ADMIN_PASSWORD no está configurada" }, 503);
  if (!safeEqual(body?.password, expected)) return json({ error:"Credencial incorrecta" }, 401);
  return null;
}

export async function readJson(req){
  try { return await req.json(); } catch { return null; }
}
