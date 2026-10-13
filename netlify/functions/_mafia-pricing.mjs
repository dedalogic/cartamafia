const P = {
  "promo-alfredo":{price:7990},"combo-indecisos":{price:11990},"combo-soprano":{price:9990},
  "palitos":{price:3990},"cremita-zapallo":{price:5990},
  "tgm":{options:[16990,16990,24990],combo:[500,5000,5000]},
  "pepperoni":{options:[5490,16990,24990],combo:[500,5000,5000]},
  "pollo-bbq":{options:[5490,16990,24990],combo:[500,5000,5000]},
  "napolitana":{options:[4490,14990,20990],combo:[500,5000,4000]},
  "margarita":{options:[4490,14990,20990],combo:[500,5000,4000]},
  "ajillo":{options:[5490,16990,24990],combo:[500,5000,5000]},
  "funghi":{options:[4490,14990,20990],combo:[500,5000,4000]},
  "chocleta":{options:[4490,14990,20990],combo:[500,5000,5000]},
  "fetuccini":{picks:[7990,7990,8990],combo:500},
  "bucatini":{picks:[7990,7990,8990],combo:500},
  "albondigas":{price:2990},"pollo-gravy":{price:2990},
  "top-bbq":{price:990},"top-pomodoro":{price:990},"top-parmigiano":{price:1290},"top-ketchup":{price:990},
  "beb-350":{price:1800},"beb-15":{price:3990},"agua":{price:2000},"jugo":{price:2490}
};
export function validateCart(cart){
  if(!cart || typeof cart !== "object" || Array.isArray(cart)) throw new Error("Carrito inválido");
  const items=[]; let total=0,count=0;
  for(const [key,qtyRaw] of Object.entries(cart)){
    const qty=Number(qtyRaw);
    if(!Number.isInteger(qty)||qty<1||qty>20) throw new Error("Cantidad inválida");
    const parts=String(key).split("|");
    const id=parts[0], o=Number(parts[1]||0), c=Number(parts[2]||0), p=Number(parts[3]??-1);
    const def=P[id]; if(!def) throw new Error("Producto inválido: "+id);
    let unit=0;
    if(def.options){
      if(!Number.isInteger(o)||o<0||o>=def.options.length) throw new Error("Formato inválido: "+id);
      unit=def.options[o];
      if(c===1){unit+=def.combo[o]||0;} else if(c!==0) throw new Error("Combo inválido");
    }else if(def.picks){
      if(!Number.isInteger(p)||p<0||p>=def.picks.length) throw new Error("Opción inválida: "+id);
      unit=def.picks[p];
      if(c===1) unit+=def.combo||0; else if(c!==0) throw new Error("Combo inválido");
    }else{
      unit=def.price;
      if(c!==0) throw new Error("Combo inválido");
    }
    const lineTotal=unit*qty; total+=lineTotal; count+=qty;
    items.push({id,quantity:qty,unit_price:unit,total_amount:lineTotal});
  }
  if(!items.length) throw new Error("Carrito vacío");
  if(count>50) throw new Error("Demasiados productos");
  if(total<500||total>500000) throw new Error("Total fuera de rango");
  return {total,count,items};
}
