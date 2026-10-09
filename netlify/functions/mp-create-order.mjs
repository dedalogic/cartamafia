import { validateCart } from "./_mafia-pricing.mjs";
const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}});
const clean=s=>String(s||"").trim().slice(0,200);
export default async (req)=>{
  if(req.method!=="POST") return json({ok:false,error:"Método no permitido"},405);
  if(process.env.MAFIA_MP_TEST_ENABLED!=="true") return json({ok:false,error:"Mercado Pago TEST está desactivado"},404);
  const token=process.env.MERCADOPAGO_ACCESS_TOKEN;
  if(!token) return json({ok:false,error:"Access Token no configurado"},503);
  let body; try{body=await req.json();}catch{return json({ok:false,error:"Solicitud inválida"},400);}
  let cartData; try{cartData=validateCart(body.cart);}catch(e){return json({ok:false,error:e.message||"Carrito inválido"},400);}
  const customer=body.customer||{}, fulfillment=body.fulfillment;
  if(clean(customer.name).length<2) return json({ok:false,error:"Nombre inválido"},400);
  if(!["delivery","retiro"].includes(fulfillment)) return json({ok:false,error:"Tipo de entrega inválido"},400);
  if(fulfillment==="delivery"&&clean(customer.address).length<5) return json({ok:false,error:"Dirección inválida"},400);
  const pay=body.payment||{};
  const paymentType=clean(pay.payment_type_id);
  if(!["credit_card","debit_card"].includes(paymentType)) return json({ok:false,error:"Tipo de tarjeta no soportado en esta prueba"},400);
  if(!clean(pay.token)||!clean(pay.payment_method_id)) return json({ok:false,error:"Faltan datos tokenizados del pago"},400);
  const installments=Number(pay.installments||1);
  if(!Number.isInteger(installments)||installments<1||installments>48) return json({ok:false,error:"Cuotas inválidas"},400);
  const payer=pay.payer||{};
  const email=clean(payer.email);
  if(!email||!email.includes("@")) return json({ok:false,error:"Mercado Pago requiere un correo válido"},400);
  const attempt=clean(body.attempt_id).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!attempt) return json({ok:false,error:"Intento de pago inválido"},400);
  const external=`MAFIA-${Date.now().toString(36)}-${attempt.slice(0,18)}`.slice(0,64);
  const order={
    type:"online",processing_mode:"automatic",total_amount:String(cartData.total),external_reference:external,
    payer:{email},
    transactions:{payments:[{amount:String(cartData.total),payment_method:{id:clean(pay.payment_method_id),type:paymentType,token:clean(pay.token),installments}}]}
  };
  if(payer.identification && payer.identification.type && payer.identification.number){
    order.payer.identification={type:clean(payer.identification.type),number:clean(payer.identification.number)};
  }
  try{
    const r=await fetch("https://api.mercadopago.com/v1/orders",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":`Bearer ${token}`,"X-Idempotency-Key":`mafia-${attempt}`.slice(0,128)},body:JSON.stringify(order)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      const msg=d?.message || d?.error || (Array.isArray(d?.errors)&&d.errors[0]?.message) || "Mercado Pago rechazó la solicitud";
      return json({ok:false,error:msg,mp_status:r.status,mp_code:d?.code||d?.error||""},r.status>=500?502:400);
    }
    return json({ok:true,order_id:d.id||"",status:d.status||"",status_detail:d.status_detail||"",total:cartData.total,external_reference:external});
  }catch(e){return json({ok:false,error:"No se pudo conectar con Mercado Pago"},502);}
};
