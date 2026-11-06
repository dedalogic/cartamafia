// Dos niveles de acceso:
//  - admin (MAFIA_ADMIN_PASSWORD): todo, incluido pago online y compras sin terminar.
//  - staff (MAFIA_STAFF_PASSWORD, opcional): caja, pedidos y productos. Si la variable no existe, no hay clave de personal.
import { safeEqual, json } from "./_auth.mjs";

export function roleOf(password){
  if (typeof password !== "string" || !password) return null;
  const admin = process.env.MAFIA_ADMIN_PASSWORD, staff = process.env.MAFIA_STAFF_PASSWORD;
  if (admin && safeEqual(password, admin)) return "admin";
  if (staff && safeEqual(password, staff)) return "staff";
  return null;
}

// null = permitido (admin o personal); si no, la respuesta de error.
export function checkStaff(body){
  if (!process.env.MAFIA_ADMIN_PASSWORD) return json({ error:"MAFIA_ADMIN_PASSWORD no está configurada" }, 503);
  return roleOf(body?.password) ? null : json({ error:"Credencial incorrecta" }, 401);
}
