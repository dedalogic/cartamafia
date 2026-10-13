const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}});
export default async (req)=>{
  if(req.method!=="GET") return json({ok:false,error:"Método no permitido"},405);
  if(process.env.MAFIA_MP_TEST_ENABLED!=="true") return json({ok:false,error:"Mercado Pago TEST está desactivado"},404);
  const token=process.env.MERCADOPAGO_ACCESS_TOKEN; if(!token) return json({ok:false,error:"Access Token no configurado"},503);
  const u=new URL(req.url), id=(u.searchParams.get("id")||"").trim();
  if(!/^ORD[A-Za-z0-9_-]+$/.test(id)) return json({ok:false,error:"Order ID inválido"},400);
  try{
    const r=await fetch("https://api.mercadopago.com/v1/orders/"+encodeURIComponent(id),{headers:{"Accept":"application/json","Authorization":`Bearer ${token}`}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) return json({ok:false,error:d?.message||d?.error||"No se pudo consultar la order"},r.status>=500?502:400);
    return json({ok:true,order_id:d.id||id,status:d.status||"",status_detail:d.status_detail||"",total:Number(d.total_amount||0)});
  }catch{return json({ok:false,error:"No se pudo conectar con Mercado Pago"},502);}
};
