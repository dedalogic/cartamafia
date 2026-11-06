// Memoria falsa de Netlify Blobs y Mercado Pago falso: permiten probar todo el flujo sin credenciales ni internet.
import { createHmac, randomUUID } from "node:crypto";

export function makeMemoryStore(){
  const data = new Map(); let seq = 0;
  const api = {
    async get(key, opts){ const r = data.get(key); if (!r) return null; return opts?.type === "json" ? structuredClone(r.value) : JSON.stringify(r.value); },
    async getWithMetadata(key, opts){ const r = data.get(key); if (!r) return null; return { data: opts?.type === "json" ? structuredClone(r.value) : r.value, etag:r.etag, metadata:{} }; },
    async set(key, value, o = {}){
      const cur = data.get(key);
      if (o.onlyIfNew && cur) return { modified:false };
      if (o.onlyIfMatch !== undefined && (!cur || cur.etag !== o.onlyIfMatch)) return { modified:false };
      const etag = `e${++seq}`; data.set(key, { value, etag }); return { modified:true, etag };
    },
    async setJSON(key, value, o){ return api.set(key, structuredClone(value), o); },
    async delete(key){ data.delete(key); },
    async list({ prefix = "" } = {}){ return { blobs:[...data.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })), directories:[] }; }
  };
  return api;
}

export function installStores(){
  const stores = {};
  globalThis.__mafiaStoreFactory = name => (stores[name] ||= makeMemoryStore());
  return stores;
}

// Mercado Pago falso: tarjeta APRO aprueba; OTHE rechaza; "PEND" queda pendiente.
export function installMercadoPago(){
  const orders = new Map(), calls = [], used = new Set(), prefs = new Map(), payments = new Map();
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname !== "api.mercadopago.com") return real(url, init);
    const auth = init.headers?.Authorization;
    if (auth !== "Bearer TEST-TOKEN") return Response.json({ message:"unauthorized" }, { status:401 });
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method:init.method || "GET", path:u.pathname, body, headers:init.headers });
    if (u.pathname === "/v1/orders" && init.method === "POST"){
      const idem = init.headers["X-Idempotency-Key"];
      if (!idem) return Response.json({ errors:[{ code:"idempotency_key_required" }] }, { status:400 });
      if (used.has(idem)) return Response.json({ errors:[{ code:"idempotency_key_already_used" }] }, { status:409 });
      used.add(idem);
      const pay = body.transactions.payments[0], tok = pay.payment_method.token;
      const id = "ORDTST" + randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
      const outcome = tok.startsWith("APRO") ? ["processed", "accredited"] : tok.startsWith("PEND") ? ["action_required", "waiting_payment"] : ["failed", "cc_rejected_insufficient_amount"];
      const paid = outcome[1] === "accredited";
      const o = { id, status:outcome[0], status_detail:outcome[1], external_reference:body.external_reference, total_amount:body.total_amount,
        total_paid_amount: paid ? body.total_amount : "0", transactions:{ payments:[{ id:"PAY" + id, amount:pay.amount, paid_amount: paid ? pay.amount : "0", status:outcome[0], status_detail:outcome[1] }] } };
      orders.set(id, o);
      return Response.json(o, { status:201 });
    }
    if (u.pathname === "/checkout/preferences" && init.method === "POST"){
      if (globalThis.__failRichPref && body.statement_descriptor) return Response.json({ message:"invalid field", cause:[{ description:"campo no válido" }] }, { status:400 });
      const id = "PREF-" + randomUUID().slice(0, 8); prefs.set(id, body);
      return Response.json({ id, init_point:"https://www.mercadopago.cl/checkout/v1/redirect?pref_id=" + id }, { status:201 });
    }
    if (u.pathname === "/v1/payments/search"){
      const ref = u.searchParams.get("external_reference");
      return Response.json({ results:[...payments.values()].filter(p => p.external_reference === ref) });
    }
    const pm = u.pathname.match(/^\/v1\/payments\/([^/]+)$/);
    if (pm){ const p = payments.get(pm[1]); return p ? Response.json(p) : Response.json({ message:"not found" }, { status:404 }); }
    const m = u.pathname.match(/^\/v1\/orders\/([^/]+)$/);
    if (m){ const o = orders.get(m[1]); return o ? Response.json(o) : Response.json({ message:"not found" }, { status:404 }); }
    return Response.json({ message:"unexpected" }, { status:500 });
  };
  return { orders, calls, prefs, payments, restore(){ globalThis.fetch = real; } };
}

// Aviso firmado igual que lo hace Mercado Pago
export function signedWebhook(id, secret, { tamper = false } = {}){
  const ts = String(Date.now()), reqId = randomUUID();
  const manifest = `id:${id.toLowerCase()};request-id:${reqId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return new Request(`https://example.test/.netlify/functions/mp-webhook?data.id=${tamper ? id + "x" : id}&type=order`, {
    method:"POST", headers:{ "x-signature":`ts=${ts},v1=${v1}`, "x-request-id":reqId, "content-type":"application/json" },
    body:JSON.stringify({ action:"order.processed", type:"order", data:{ id } })
  });
}

// Aviso de pago firmado (evento "Pagos")
export function signedPaymentWebhook(id, secret){
  const ts = String(Date.now()), reqId = randomUUID();
  const v1 = createHmac("sha256", secret).update(`id:${String(id).toLowerCase()};request-id:${reqId};ts:${ts};`).digest("hex");
  return new Request(`https://example.test/.netlify/functions/mp-webhook?data.id=${id}&type=payment`, {
    method:"POST", headers:{ "x-signature":`ts=${ts},v1=${v1}`, "x-request-id":reqId, "content-type":"application/json" },
    body:JSON.stringify({ action:"payment.updated", type:"payment", data:{ id:String(id) } })
  });
}
