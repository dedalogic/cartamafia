const json = (data,status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}});
export default async (req) => {
  if(req.method !== "GET") return json({error:"Método no permitido"},405);
  const enabled = process.env.MAFIA_MP_TEST_ENABLED === "true";
  if(!enabled) return json({enabled:false});
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || "";
  if(!publicKey) return json({enabled:false,error:"MERCADOPAGO_PUBLIC_KEY no configurada"},503);
  return json({enabled:true,publicKey});
};
