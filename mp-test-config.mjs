// Le dice a la carta si el pago online está activo y con qué clave PÚBLICA inicializar Mercado Pago.
// La clave pública no es secreta; el Access Token nunca sale del servidor.
import { json } from "./_auth.mjs";
import { mpEnabled, mpConfigured } from "./_mp.mjs";
import { deliveryFlatFee } from "./_mafia-delivery.mjs";

export default async () => {
  const enabled = mpEnabled() && mpConfigured() && !!process.env.MERCADOPAGO_PUBLIC_KEY;
  const fee = deliveryFlatFee();
  return json({
    enabled,
    public_key: enabled ? process.env.MERCADOPAGO_PUBLIC_KEY : null,
    delivery_online: enabled && fee !== null,
    delivery_fee: enabled && fee !== null ? fee : null,
    wallets: { applePay:false, googlePay:false }          // pausados hasta completar Apple/Mercado Pago
  });
};
