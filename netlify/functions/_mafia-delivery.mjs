// COSTO DE DELIVERY — aquí se conectará el módulo de Google Places / mapas.
// El pago online solo necesita: subtotal, costo de delivery y total final, y el costo lo decide el servidor.
//
// Hoy: tarifa FIJA de $3.500. Se puede cambiar con la variable de Netlify MAFIA_DELIVERY_FEE (pesos, sin puntos).
// Si la variable tiene un valor inválido, el delivery no se puede pagar online (queda WhatsApp) y el retiro sí.
export const DEFAULT_DELIVERY_FEE = 3500;
export function deliveryFlatFee(){
  const raw = process.env.MAFIA_DELIVERY_FEE;
  if (raw === undefined || raw === "") return DEFAULT_DELIVERY_FEE;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Cuando exista el módulo de Google: reemplazar el cuerpo por el cálculo real según `address`.
// Debe devolver { ok:true, fee:<entero CLP> } o { ok:false, message }.
export async function computeDeliveryFee({ address } = {}){
  const fee = deliveryFlatFee();
  if (fee === null) return { ok:false, message:"El delivery con pago online aún no está disponible." };
  return { ok:true, fee };
}
