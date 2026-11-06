// COSTO DE DELIVERY — aquí se conectará el módulo de Google Places / mapas.
// El pago online solo necesita: subtotal, costo de delivery y total final, y el costo lo decide el servidor.
//
// Hoy: tarifa fija desde la variable de Netlify MAFIA_DELIVERY_FEE (pesos, sin puntos). Si no existe, el
// delivery NO se puede pagar online (la carta ofrece WhatsApp/transferencia para delivery) y el retiro sí.
export function deliveryFlatFee(){
  const raw = process.env.MAFIA_DELIVERY_FEE;
  if (raw === undefined || raw === "") return null;
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
