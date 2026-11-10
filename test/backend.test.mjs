import test from "node:test";
import assert from "node:assert/strict";
import { installStores, installMercadoPago, signedWebhook, signedPaymentWebhook } from "./mocks.mjs";

process.env.MAFIA_MP_TEST_ENABLED = "true";
process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-TOKEN";
process.env.MERCADOPAGO_PUBLIC_KEY = "TEST-PUBLIC";
process.env.MERCADOPAGO_WEBHOOK_SECRET = "whsec";
process.env.MAFIA_ADMIN_PASSWORD = "caja123";
process.env.MAFIA_DELIVERY_FEE = "3500";

const stores = installStores();
const mp = installMercadoPago();
const F = "../netlify/functions/";
const create = (await import(F + "mp-create-order.mjs")).default;
const prefFn = (await import(F + "mp-create-preference.mjs")).default;
const payWebhook = (await import(F + "mp-pay-webhook.mjs")).default;
const payStatus = (await import(F + "mp-pay-status.mjs")).default;
const status = (await import(F + "mp-order-status.mjs")).default;
const webhook = (await import(F + "mp-webhook.mjs")).default;
const cfg = (await import(F + "mp-test-config.mjs")).default;
const list = (await import(F + "orders-list.mjs")).default;
const paySwitch = (await import(F + "pay-switch.mjs")).default;
const unpaidFn = (await import(F + "orders-unpaid.mjs")).default;
const update = (await import(F + "orders-update.mjs")).default;
const recover = (await import(F + "orders-recover.mjs")).default;
const { sweep } = await import(F + "pay-sweep.mjs");
const report = (await import(F + "orders-report.mjs")).default;
const rate = (await import(F + "order-rate.mjs")).default;
const avail = (await import(F + "menu-availability.mjs")).default;
const { validateCart, parseKey } = await import(F + "_mafia-pricing.mjs");
const orders = await import(F + "_mafia-orders.mjs");

const post = (fn, body) => fn(new Request("https://example.test/x", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) }));
const base = (over = {}) => ({
  items:[{ key:"promo-alfredo|0|0|-1|-1|0", qty:1 }],
  delivery_type:"retiro",
  customer:{ name:"Christopher", email:"test@testuser.com", phone:"+56911112222", address:"" },
  payment:{ token:"APRO-1", payment_method_id:"visa", payment_method_type:"credit_card", installments:1 },
  attempt_id:crypto.randomUUID(), ...over
});

test("precios: promo-alfredo = 7990 y se ignora cualquier precio del navegador", () => {
  const v = validateCart([{ key:"promo-alfredo|0|0|-1|-1|0", qty:1, price:1, unit_price:1 }], {});
  assert.equal(v.subtotal, 7990);
  assert.equal(v.items[0].unit_price, 7990);
});
test("precios: pasta Bolognesa + combo bebida mini = 8990 + 990", () => {
  const v = validateCart([{ key:"fetuccini|0|1|2|0", qty:2 }], {});
  assert.equal(v.subtotal, 2 * (8990 + 990));
  assert.match(v.items[0].detail.join(" "), /Bolognesa/);
});
test("precios: pizza combo y extras se suman", () => {
  const v = validateCart([{ key:"tgm|0|1|-1|0", qty:1 }, { key:"top-bbq|0|0|-1|-1", qty:2 }], {});
  assert.equal(v.subtotal, 16990 + 5000 + 990 * 2);
});
test("precios: claves inválidas, cantidades raras y agotados se rechazan", () => {
  for (const key of ["nada|0|0|-1|-1", "tgm|9|0|-1|-1", "promo-alfredo|0|0|-1|-1", "promo-alfredo|0|0|-1|-1|7", "fetuccini|0|0|-1|-1", "tgm|0|0|-1|-1|0|0|0", "tgm|0|1|-1|-1"])
    assert.equal(parseKey(key), null, key);
  assert.throws(() => validateCart([{ key:"tgm|0|0|-1|-1", qty:0 }], {}));
  assert.throws(() => validateCart([{ key:"tgm|0|0|-1|-1", qty:1.5 }], {}));
  assert.throws(() => validateCart([], {}));
  assert.throws(() => validateCart([{ key:"tgm|0|0|-1|-1", qty:1 }], { disabledProducts:["tgm"] }), /agotado/);
  assert.throws(() => validateCart([{ key:"fetuccini|0|0|0", qty:1 }], { disabledProducts:["salsa-alfredo"] }), /agotado/);
});

test("delivery: sin variable la tarifa por defecto es 3500", async () => {
  const keep = process.env.MAFIA_DELIVERY_FEE; delete process.env.MAFIA_DELIVERY_FEE;
  const j = await (await cfg(new Request("https://example.test/c"))).json();
  assert.equal(j.delivery_fee, 3500); assert.equal(j.delivery_online, true);
  process.env.MAFIA_DELIVERY_FEE = keep;
});
test("config: pago activo con clave pública y delivery con tarifa", async () => {
  const j = await (await cfg(new Request("https://example.test/c"))).json();
  assert.equal(j.enabled, true); assert.equal(j.public_key, "TEST-PUBLIC"); assert.equal(j.delivery_online, true); assert.equal(j.delivery_fee, 3500);
  assert.deepEqual(j.wallets, { applePay:false, googlePay:false });
});

let paidOrder;
test("pago aprobado (retiro): orden guardada, monto del servidor, número corto, sin delivery", async () => {
  mp.calls.length = 0;
  const r = await post(create, base({ items:[{ key:"promo-alfredo|0|0|-1|-1|0", qty:1, price:1 }], total:1 }));
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.equal(j.paid, true); assert.equal(j.total, 7990); assert.match(j.short_code, /^\d{4}$/); assert.equal(j.short_code, "0001");
  assert.match(j.reference, /^MAFIA-[0-9A-Z]{8}-[0-9A-Z]{8}$/);
  const sent = mp.calls.find(c => c.method === "POST").body;
  assert.equal(sent.total_amount, "7990"); assert.equal(sent.external_reference, j.reference);
  assert.equal(sent.transactions.payments[0].payment_method.type, "credit_card");
  const o = await orders.getOrderByReference(j.reference);
  assert.equal(o.status, "paid"); assert.equal(o.processed, true); assert.equal(o.fudo_sent, false);
  assert.equal(o.paid_total, 7990); assert.equal(o.delivery_fee, 0); assert.equal(o.kitchen_status, "nuevo");
  assert.equal(o.payment_status, "processed"); assert.equal(o.payment_status_detail, "accredited");
  paidOrder = { ...j, o };
});
test("delivery suma la tarifa del servidor y el total pagado la incluye", async () => {
  const r = await post(create, base({ delivery_type:"delivery", customer:{ name:"Ana", email:"a@b.cl", address:"Pedro de Valdivia 2847", unit:"Depto 5" } }));
  const j = await r.json(); assert.equal(j.total, 7990 + 3500); assert.equal(j.paid, true);
  const o = await orders.getOrderByReference(j.reference);
  assert.equal(o.delivery_fee, 3500); assert.equal(o.address, "Pedro de Valdivia 2847");
});
test("delivery con tarifa inválida no se puede pagar online", async () => {
  const keep = process.env.MAFIA_DELIVERY_FEE; process.env.MAFIA_DELIVERY_FEE = "abc";
  const r = await post(create, base({ delivery_type:"delivery", customer:{ name:"Ana", email:"a@b.cl", address:"Calle 12345" } }));
  assert.equal(r.status, 409); assert.equal((await r.json()).code, "delivery_unavailable");
  const c = await (await cfg(new Request("https://example.test/c"))).json(); assert.equal(c.delivery_online, false);
  process.env.MAFIA_DELIVERY_FEE = keep;
});
test("números cortos únicos aunque lleguen 15 pedidos a la vez", async () => {
  const rs = await Promise.all(Array.from({ length:15 }, () => post(create, base()).then(r => r.json())));
  const nums = rs.map(r => r.short_code); assert.equal(new Set(nums).size, 15);
  assert.ok(rs.every(r => r.paid));
});
test("tarjeta rechazada: no queda pagada, mensaje claro y reintento reutiliza el mismo pedido", async () => {
  const r1 = await post(create, base({ payment:{ token:"OTHE-1", payment_method_id:"visa", payment_method_type:"credit_card" } }));
  const j1 = await r1.json();
  assert.equal(r1.status, 402); assert.equal(j1.ok, false); assert.match(j1.error, /saldo/);
  let o = await orders.getOrderByReference(j1.reference); assert.equal(o.status, "pending");
  const keys0 = mp.calls.filter(c => c.method === "POST").map(c => c.headers["X-Idempotency-Key"]);
  const r2 = await post(create, base({ reference:j1.reference, status_key:j1.status_key }));
  const j2 = await r2.json();
  assert.equal(j2.paid, true); assert.equal(j2.reference, j1.reference); assert.equal(j2.short_code, j1.short_code);
  const keys = mp.calls.filter(c => c.method === "POST").map(c => c.headers["X-Idempotency-Key"]);
  assert.equal(new Set(keys).size, keys.length, "ninguna idempotency key se repite");
  assert.ok(keys.length > keys0.length);
  o = await orders.getOrderByReference(j1.reference); assert.equal(o.status, "paid");
});
test("reintento con clave incorrecta o pedido ajeno es rechazado", async () => {
  const r = await post(create, base({ reference:paidOrder.reference, status_key:"mala" }));
  assert.equal(r.status, 404);
});
test("pago pendiente: se confirma después con el webhook firmado y es idempotente", async () => {
  const r = await post(create, base({ payment:{ token:"PEND-1", payment_method_id:"visa", payment_method_type:"credit_card" } }));
  const j = await r.json(); assert.equal(j.pending, true); assert.equal(j.paid, false);
  let o = await orders.getOrderByReference(j.reference); assert.equal(o.status, "pending");
  // MP aprueba más tarde
  const mpo = mp.orders.get(o.mercado_pago_order_id);
  Object.assign(mpo, { status:"processed", status_detail:"accredited", total_paid_amount:mpo.total_amount });
  const w1 = await webhook(signedWebhook(mpo.id, "whsec")); assert.equal(w1.status, 200);
  assert.equal((await w1.json()).outcome, "paid");
  const w2 = await webhook(signedWebhook(mpo.id, "whsec")); assert.equal((await w2.json()).outcome, "already");
  o = await orders.getOrderByReference(j.reference); assert.equal(o.status, "paid");
});
test("webhook: firma falsa se rechaza", async () => {
  const w = await webhook(signedWebhook(paidOrder.o.mercado_pago_order_id, "otra-clave")); assert.equal(w.status, 401);
  const w2 = await webhook(signedWebhook(paidOrder.o.mercado_pago_order_id, "whsec", { tamper:true })); assert.equal(w2.status, 401);
});
test("webhook: monto distinto al pedido se rechaza y no marca pagado", async () => {
  const r = await post(create, base({ payment:{ token:"PEND-2", payment_method_id:"visa", payment_method_type:"credit_card" } }));
  const j = await r.json(); const o = await orders.getOrderByReference(j.reference);
  const mpo = mp.orders.get(o.mercado_pago_order_id);
  Object.assign(mpo, { status:"processed", status_detail:"accredited", total_paid_amount:"100" });
  const w = await webhook(signedWebhook(mpo.id, "whsec")); assert.equal(w.status, 422);
  assert.equal((await orders.getOrderByReference(j.reference)).status, "pending");
});
test("webhook: sin referencia, Order inexistente o no acreditada", async () => {
  mp.orders.set("ORDNOREF", { id:"ORDNOREF", status:"processed", status_detail:"accredited" });
  assert.equal((await webhook(signedWebhook("ORDNOREF", "whsec"))).status, 422);
  assert.equal((await webhook(signedWebhook("ORDFAKE", "whsec"))).status, 502);
  const r = await post(create, base({ payment:{ token:"PEND-3", payment_method_id:"visa", payment_method_type:"credit_card" } }));
  const j = await r.json(); const o = await orders.getOrderByReference(j.reference);
  const w = await webhook(signedWebhook(o.mercado_pago_order_id, "whsec")); assert.equal((await w.json()).outcome, "ignored");
});
test("estado: el cliente ve su ticket solo con su clave; sondea a MP si falta el webhook", async () => {
  const r = await post(create, base({ payment:{ token:"PEND-4", payment_method_id:"visa", payment_method_type:"credit_card" } }));
  const j = await r.json(); const o = await orders.getOrderByReference(j.reference);
  const get = key => status(new Request(`https://example.test/s?ref=${j.reference}&key=${key}`));
  assert.equal((await get("mala")).status, 404);
  assert.equal((await (await get(j.status_key)).json()).paid, false);
  const mpo = mp.orders.get(o.mercado_pago_order_id);
  Object.assign(mpo, { status:"processed", status_detail:"accredited", total_paid_amount:mpo.total_amount });
  const v = await (await get(j.status_key)).json();
  assert.equal(v.paid, true); assert.equal(v.short_code, j.short_code); assert.ok(v.items.length); assert.equal(v.status_key, undefined);
});
test("pago online apagado (MAFIA_MP_TEST_ENABLED=false) bloquea todo", async () => {
  process.env.MAFIA_MP_TEST_ENABLED = "false";
  assert.equal((await post(create, base())).status, 403);
  assert.equal((await (await cfg(new Request("https://example.test/c"))).json()).enabled, false);
  process.env.MAFIA_MP_TEST_ENABLED = "true";
});
test("interruptor del admin apaga y enciende el pago online", async () => {
  const sw = async b => (await post(paySwitch, b));
  assert.equal((await sw({ password:"mala", action:"get" })).status, 401);
  let j = await (await sw({ password:"caja123", action:"get" })).json();
  assert.equal(j.online, true); assert.equal(j.ready, true);
  j = await (await sw({ password:"caja123", action:"set", online:false })).json();
  assert.equal(j.online, false);
  assert.equal((await post(create, base())).status, 403);
  assert.equal((await post(prefFn, { items:[{ key:"promo-alfredo|0|0|-1|-1|0", qty:1 }], delivery_type:"retiro", customer:{ name:"Ana", phone:"+56911112222" } })).status, 403);
  assert.equal((await (await cfg(new Request("https://example.test/c"))).json()).enabled, false);
  j = await (await sw({ password:"caja123", action:"set", online:true })).json();
  assert.equal(j.online, true);
  assert.equal((await (await cfg(new Request("https://example.test/c"))).json()).enabled, true);
});
test("admin: compras sin terminar cuenta pagados y no pagados", async () => {
  assert.equal((await post(unpaidFn, { password:"mala" })).status, 401);
  const pend = await orders.savePendingOrder({ cart:{ subtotal:7990, count:1, items:[{ id:"promo-alfredo", key:"k", name:"Promo", detail:[], quantity:1, unit_price:7990, total_amount:7990 }] }, customer:{ name:"Luis", phone:"+56911112222" }, delivery_type:"retiro", delivery_fee:0, address:"" });
  const j = await (await post(unpaidFn, { password:"caja123", days:7 })).json();
  assert.ok(j.started >= 1 && j.paid >= 0);
  assert.equal(j.started, j.paid + j.unpaid_count);
  assert.ok(j.unpaid.some(u => u.reference === pend.reference && u.customer.name === "Luis"));
});
test("roles: el personal usa caja y productos, pero no pago online ni compras sin terminar", async () => {
  process.env.MAFIA_STAFF_PASSWORD = "cajera123";
  try {
    const login = async pw => (await post(avail, { password:pw, action:"login" }));
    let j = await (await login("cajera123")).json(); assert.equal(j.role, "staff"); assert.ok(j.catalog.length); assert.ok("img" in j.catalog[0]);
    j = await (await login("caja123")).json(); assert.equal(j.role, "admin");
    assert.equal((await login("otra")).status, 401);
    assert.equal((await post(list, { password:"cajera123", days:1 })).status, 200);
    assert.equal((await post(list, { password:"otra", days:1 })).status, 401);
    assert.equal((await post(avail, { password:"cajera123", action:"set", disabledProducts:[], disabledOptions:{} })).status, 200);
    assert.equal((await post(paySwitch, { password:"cajera123", action:"get" })).status, 401);
    assert.equal((await post(paySwitch, { password:"cajera123", action:"set", online:false })).status, 401);
    assert.equal((await post(unpaidFn, { password:"cajera123" })).status, 401);
    assert.equal((await post(paySwitch, { password:"caja123", action:"get" })).status, 200);
  } finally { delete process.env.MAFIA_STAFF_PASSWORD; }
  assert.equal((await post(list, { password:"cajera123", days:1 })).status, 401);   // sin la variable, esa clave deja de servir
});
test("validaciones de datos del cliente", async () => {
  assert.equal((await post(create, base({ customer:{ name:"", email:"a@b.cl" } }))).status, 400);
  assert.equal((await post(create, base({ customer:{ name:"Ana", email:"malo" } }))).status, 400);
  assert.equal((await post(create, base({ delivery_type:"delivery", customer:{ name:"Ana", email:"a@b.cl", address:"" } }))).status, 400);
  assert.equal((await post(create, base({ payment:{ token:"", payment_method_id:"visa", payment_method_type:"credit_card" } }))).status, 400);
  assert.equal((await post(create, base({ payment:{ token:"APRO", payment_method_id:"fintoc", payment_method_type:"bank_transfer" } }))).status, 400);
  assert.equal((await post(create, base({ items:[{ key:"tgm|0|0|-1|-1", qty:1 }], ...{} }))).status, 200);
  assert.equal((await post(create, base({ items:[{ key:"inventado|0", qty:1 }] }))).status, 409);
});
test("producto agotado por el panel de disponibilidad no se puede pagar", async () => {
  const set = await post(avail, { action:"set", password:"caja123", disabledProducts:["promo-alfredo"], disabledOptions:{} });
  assert.equal(set.status, 200);
  const r = await post(create, base()); assert.equal(r.status, 409); assert.equal((await r.json()).code, "unavailable");
  await post(avail, { action:"set", password:"caja123", disabledProducts:[], disabledOptions:{} });
});
test("disponibilidad: el catálogo sale del menú nuevo", async () => {
  const j = await (await post(avail, { action:"login", password:"caja123" })).json();
  const ids = j.catalog.map(x => x.id);
  for (const id of ["combo-famiglia", "promo-alfredo", "np-bolognesa-albondigas", "fetuccini", "salsa-alfredo", "beb-350"]) assert.ok(ids.includes(id), id);
  assert.equal((await post(avail, { action:"login", password:"mala" })).status, 401);
});
test("caja: lista solo pagados, exige clave y cambia estados", async () => {
  assert.equal((await post(list, { password:"mala" })).status, 401);
  const j = await (await post(list, { password:"caja123" })).json();
  assert.ok(j.orders.length >= 5);
  assert.ok(j.orders.every(o => o.short_code && o.items.length && o.kitchen_status));
  assert.ok(j.orders.some(o => o.delivery_type === "delivery" && o.address));
  const ref = j.orders[0].reference;
  for (const st of ["preparacion", "listo", "entregado"]){
    const u = await post(update, { password:"caja123", reference:ref, kitchen_status:st }); assert.equal(u.status, 200);
  }
  assert.equal((await orders.getOrderByReference(ref)).kitchen_status, "entregado");
  assert.equal((await post(update, { password:"caja123", reference:ref, kitchen_status:"volando" })).status, 400);
  assert.equal((await post(update, { password:"mala", reference:ref, kitchen_status:"listo" })).status, 401);
  const pend = Object.values(stores["mafia-orders"]).length; assert.ok(pend);
});
test("health del webhook", async () => {
  const j = await (await webhook(new Request("https://example.test/w"))).json();
  assert.deepEqual(j, { ok:true, message:"Webhook activo", secret_configured:true, access_token_configured:true });
});

// ---------- Pagar con Mercado Pago (Checkout Pro) ----------
const prefBody = (over = {}) => { const b = base(over); delete b.payment; delete b.attempt_id; return b; };
const getOrder = async ref => orders.getOrderByReference(ref);

test("wallet: la preferencia se crea con precio del servidor, referencia y avisos", async () => {
  const r = await (await post(prefFn, prefBody({ delivery_type:"delivery", customer:{ name:"Ana", email:"a@b.cl", phone:"+56912345678", address:"Calle 123" }, items:[{ key:"promo-alfredo|0|0|-1|-1|0", qty:1, price:1 }] }))).json();
  assert.equal(r.ok, true); assert.match(r.init_point, /^https:\/\/www\.mercadopago\./);
  assert.equal(r.total, 7990 + 3500);
  const pref = [...mp.prefs.values()].pop();
  assert.equal(pref.items[0].unit_price, 11490); assert.equal(pref.external_reference, r.reference);
  assert.match(pref.notification_url, /\/mp-pay-webhook$/); assert.equal(pref.auto_return, "approved");
  assert.deepEqual(pref.payment_methods.excluded_payment_types.map(x => x.id).sort(), ["atm", "bank_transfer", "ticket"]);
  assert.equal((await getOrder(r.reference)).status, "pending");
});
test("rescate: con el número de operación marca pagado un pedido cuyo aviso no llegó (y exige clave)", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  mp.payments.set("9100100", { id:9100100, status:"approved", status_detail:"accredited", external_reference:r.reference, transaction_amount:7990 });
  assert.equal((await post(recover, { password:"mala", payment_id:"9100100" })).status, 401);
  const d = await (await post(recover, { password:process.env.MAFIA_ADMIN_PASSWORD, payment_id:"9100100" })).json();
  assert.equal(d.outcome, "paid"); assert.equal((await getOrder(r.reference)).status, "paid");
  const d2 = await (await post(recover, { password:process.env.MAFIA_ADMIN_PASSWORD, payment_id:"9100100" })).json();
  assert.equal(d2.outcome, "already");
});
test("webhook único: un aviso de pago llegado a mp-webhook también marca pagado", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  mp.payments.set("9200200", { id:9200200, status:"approved", status_detail:"accredited", external_reference:r.reference, transaction_amount:7990 });
  assert.equal((await webhook(signedPaymentWebhook(9200200, "whsec"))).status, 200);
  assert.equal((await getOrder(r.reference)).status, "paid");
});
test("red de seguridad: el barrido registra pagos aprobados cuyo aviso se perdió y marca los de monto distinto", async () => {
  const a = await (await post(prefFn, prefBody())).json(), b = await (await post(prefFn, prefBody())).json();
  mp.payments.set("9300301", { id:9300301, status:"approved", status_detail:"accredited", external_reference:a.reference, transaction_amount:7990 });
  mp.payments.set("9300302", { id:9300302, status:"approved", status_detail:"accredited", external_reference:b.reference, transaction_amount:1000 });
  const realNow = Date.now; Date.now = () => realNow() + 5 * 60000;
  try { const r = await sweep(); assert.ok(r.paid.includes(a.reference)); assert.ok(r.review.includes(b.reference)); } finally { Date.now = realNow; }
  assert.equal((await getOrder(a.reference)).status, "paid");
  const ob = await getOrder(b.reference); assert.equal(ob.status, "pending"); assert.equal(ob.review.paid, 1000);
});
test("reporte: solo admin, devuelve pedidos pagados del período con productos y cliente", async () => {
  assert.equal((await post(report, { password:"mala", days:14 })).status, 401);
  const d = await (await post(report, { password:process.env.MAFIA_ADMIN_PASSWORD, days:14 })).json();
  assert.ok(Array.isArray(d.orders) && d.orders.length > 0);
  const o = d.orders[0]; assert.ok(o.paid_at && o.items.length && typeof o.customer.name === "string");
});
test("wallet: datos inválidos y producto agotado se rechazan antes de ir a Mercado Pago", async () => {
  assert.equal((await post(prefFn, prefBody({ customer:{ name:"A", email:"x@y.cl" } }))).status, 400);
  assert.equal((await post(prefFn, prefBody({ customer:{ name:"Ana", email:"malo" } }))).status, 400);
  assert.equal((await post(prefFn, prefBody({ items:[{ key:"zzz|0|0|-1|-1", qty:1 }] }))).status, 409);
});
test("wallet: aviso de pago aprobado firmado marca pagado (y es idempotente)", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  mp.payments.set("9001", { id:9001, status:"approved", status_detail:"accredited", external_reference:r.reference, transaction_amount:7990 });
  assert.equal((await payWebhook(signedPaymentWebhook(9001, "whsec"))).status, 200);
  const o = await getOrder(r.reference);
  assert.equal(o.status, "paid"); assert.equal(o.kitchen_status, "nuevo"); assert.equal(o.mp_payment_id, "9001"); assert.equal(o.paid_total, 7990);
  const again = await (await payWebhook(signedPaymentWebhook(9001, "whsec"))).json();
  assert.equal(again.outcome, "already"); assert.equal((await getOrder(r.reference)).duplicate_payments, undefined);
});
test("wallet: firma inválida se rechaza y monto distinto no marca pagado", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  mp.payments.set("9002", { id:9002, status:"approved", status_detail:"accredited", external_reference:r.reference, transaction_amount:100 });
  const bad = signedPaymentWebhook(9002, "otro-secreto");
  assert.equal((await payWebhook(bad)).status, 401);
  assert.equal((await payWebhook(signedPaymentWebhook(9002, "whsec"))).status, 422);
  assert.equal((await getOrder(r.reference)).status, "pending");
});
test("wallet: pago no acreditado no marca pagado", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  mp.payments.set("9003", { id:9003, status:"rejected", status_detail:"cc_rejected_other_reason", external_reference:r.reference, transaction_amount:7990 });
  assert.equal((await (await payWebhook(signedPaymentWebhook(9003, "whsec"))).json()).outcome, "ignored");
  assert.equal((await getOrder(r.reference)).status, "pending");
});
test("wallet: si el aviso no llega, la consulta del cliente busca el pago y confirma", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  const get = () => payStatus(new Request(`https://example.test/s?ref=${r.reference}&key=${r.status_key}`));
  assert.equal((await (await get()).json()).paid, false);
  mp.payments.set("9004", { id:9004, status:"approved", status_detail:"accredited", external_reference:r.reference, transaction_amount:7990 });
  assert.equal((await (await get()).json()).paid, true);
  assert.equal((await getOrder(r.reference)).mp_payment_id, "9004");
});
test("wallet: un segundo pago aprobado distinto queda marcado como posible doble cobro", async () => {
  const r = await (await post(prefFn, prefBody())).json();
  for (const id of [9005, 9006]) mp.payments.set(String(id), { id, status:"approved", status_detail:"accredited", external_reference:r.reference, transaction_amount:7990 });
  await payWebhook(signedPaymentWebhook(9005, "whsec")); await payWebhook(signedPaymentWebhook(9006, "whsec"));
  assert.deepEqual((await getOrder(r.reference)).duplicate_payments, ["9006"]);
});
test("wallet: teléfono obligatorio y correo opcional", async () => {
  assert.equal((await post(prefFn, prefBody({ customer:{ name:"Ana", email:"", phone:"12" } }))).status, 400);
  const r = await (await post(prefFn, prefBody({ customer:{ name:"Ana", email:"", phone:"+56 9 8765 4321" } }))).json();
  assert.equal(r.ok, true);
  assert.equal([...mp.prefs.values()].pop().payer.email, undefined);
});

test("wallet: si Mercado Pago rechaza campos opcionales, reintenta con la versión mínima", async () => {
  globalThis.__failRichPref = true;
  try {
    const r = await (await post(prefFn, prefBody())).json();
    assert.equal(r.ok, true); assert.match(r.init_point, /^https:/);
    const pref = [...mp.prefs.values()].pop();
    assert.equal(pref.external_reference, r.reference); assert.equal(pref.statement_descriptor, undefined);
  } finally { delete globalThis.__failRichPref; }
});

test("opiniones: solo con pedido listo, valida estrellas y llegan al panel", async () => {
  const r = await (await post(create, base())).json();
  assert.ok(r.reference, "pedido creado");
  const key = r.status_key;
  const bad = await post(rate, { ref:r.reference, key:"mala", ratings:[{ i:0, stars:5 }] });
  assert.equal(bad.status, 404);
  const early = await post(rate, { ref:r.reference, key, ratings:[{ i:0, stars:5 }] });
  assert.equal(early.status, 409, "aún no está listo");
  await post(update, { password:"caja123", reference:r.reference, kitchen_status:"listo" });
  const none = await post(rate, { ref:r.reference, key, ratings:[{ i:0, stars:9 }, { i:7, stars:3 }] });
  assert.equal(none.status, 400);
  const ok = await post(rate, { ref:r.reference, key, ratings:[{ i:0, stars:4, comment:"  Muy rica   la pasta " }] });
  assert.equal(ok.status, 200);
  const st = await (await status(new Request("https://example.test/x?ref=" + r.reference + "&key=" + key))).json();
  assert.equal(st.ratings.items[0].stars, 4);
  assert.equal(st.ratings.items[0].comment, "Muy rica la pasta");
  const l = await (await post(list, { password:"caja123", days:2 })).json();
  assert.equal(l.orders.find(o => o.reference === r.reference).ratings.items[0].stars, 4);
});

// ---------- carta del local ----------
const localMenu = (await import(F + "local-menu.mjs")).default;
const localPhoto = (await import(F + "local-photo.mjs")).default;
const getLocal = () => localMenu(new Request("https://example.test/x"));

test("carta local: valores de partida (60 cm, Padrinos oculto) sin guardar nada", async () => {
  const d = await (await getLocal()).json();
  assert.ok(d.disabledProducts.includes("combo-doble-capo") && d.disabledProducts.includes("combo-famiglia"));
  assert.equal(d.overrides.tgm.img, "/fotos/local/tgm.webp");
  assert.equal(d.overrides.tgm.img2, "/fotos/local/slice-tgm.webp");
  assert.equal(d.overrides.tgm.price, 5490);            // en el local la pizza se vende por slice
  assert.equal(d.overrides.margarita.price, 4490);
  assert.equal(d.overrides.funghi.sub, "Familiar con palitos y bebida: $24.990");
  assert.match(d.notes.pizzas, /60 cm/);
});

test("carta local: solo el administrador puede cambiarla", async () => {
  assert.equal((await post(localMenu, { password:"mala", action:"login" })).status, 401);
  assert.equal((await post(localMenu, { password:"caja123", action:"set", disabledProducts:[] })).status, 200);
});

test("carta local: guarda interruptores, precio propio y volver a la foto online", async () => {
  const r = await post(localMenu, { password:"caja123", action:"set", disabledProducts:["combo-doble-capo", "tgm", "l-pesto-pollo", "no-existe"],
    overrides:{ pepperoni:{ price:19990, desc:"Sin cebolla" }, margarita:{ img:null }, funghi:{ img:"https://malo.test/x.png" } }, notes:{ pizzas:"Pizza de 60 cm" } });
  const d = await r.json();
  assert.deepEqual(d.disabledProducts, ["combo-doble-capo", "tgm", "l-pesto-pollo"]);   // acepta los productos propios del local
  assert.equal(d.overrides.pepperoni.price, 19990);
  assert.equal(d.overrides.margarita.img, null);                       // el panel recuerda el "volver"
  assert.equal(d.overrides.funghi.img, "/fotos/local/funghi.webp");    // una URL ajena se ignora y queda la de partida
  const pub = await (await getLocal()).json();                          // la carta pública no ve null
  assert.equal("img" in pub.overrides.margarita, false);
  assert.equal(pub.notes.pizzas, "Pizza de 60 cm");
  const panel = await (await post(localMenu, { password:"caja123", action:"login" })).json();
  assert.ok(panel.items.find(x => x.id === "ajillo") && panel.categories.length > 3);
  assert.deepEqual(panel.items.filter(x => x.local).map(x => x.id), ["l-familiar", "l-slice-bebida", "l-pesto-pollo"]);
  assert.equal(panel.items[0].id, "l-familiar");         // los combos del local van primero
});

test("carta local: sube una foto y la entrega", async () => {
  const b64 = Buffer.from("fotofalsa").toString("base64");
  const up = await (await post(localMenu, { password:"caja123", action:"photo", id:"ajillo", data:"data:image/jpeg;base64," + b64 })).json();
  assert.match(up.url, /^\/\.netlify\/functions\/local-photo\?id=ajillo&v=\d+$/);
  const saved = await (await post(localMenu, { password:"caja123", action:"set", disabledProducts:[], overrides:{ ajillo:{ img:up.url } } })).json();
  assert.equal(saved.overrides.ajillo.img, up.url);
  const img = await localPhoto(new Request("https://example.test" + up.url));
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.equal(Buffer.from(await img.arrayBuffer()).toString(), "fotofalsa");
  assert.equal((await post(localMenu, { password:"caja123", action:"photo", id:"ajillo", data:"data:text/html;base64,AAAA" })).status, 400);
  assert.equal((await post(localMenu, { password:"caja123", action:"photo", id:"../x", data:"data:image/jpeg;base64," + b64 })).status, 400);
  assert.equal((await localPhoto(new Request("https://example.test/x?id=nada"))).status, 404);
});

// ---------- mapa de pedidos ----------
const geoFn = (await import(F + "orders-geo.mjs")).default;
test("mapa: ubica direcciones de delivery, las guarda y agrupa por calle", async () => {
  const hits = [], real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = new URL(url);
    if (u.hostname !== "nominatim.openstreetmap.org") return real(url, init);
    const q = u.searchParams.get("q"); hits.push(q);
    if (/nadie/i.test(q)) return Response.json([]);
    if (/genaro\s+gallo\s+2955/i.test(q)) return Response.json([{ lat:"-20.2330", lon:"-70.1400" }]);
    if (/arturo prat/i.test(q) && /1020/.test(q)) return Response.json([]);          // sin número exacto
    if (/arturo prat/i.test(q)) return Response.json([{ lat:"-20.2140", lon:"-70.1520" }]);   // calle sola
    return Response.json([{ lat:"-33.4", lon:"-70.6" }]);                              // fuera de Iquique
  };
  for (const { key } of (await stores["mafia-orders"].list({ prefix:"orders/" })).blobs) await stores["mafia-orders"].delete(key);   // parte de cero
  const now = Date.now();
  const putOrder = async (code, address, type = "delivery") => {
    const key = "orders/x-" + (now - 1000).toString(36) + "-" + code;
    await stores["mafia-orders"].setJSON(key, { status:"paid", paid_at:new Date(now - 1000).toISOString(), delivery_type:type, address, total:10000, paid_total:10000 });
  };
  await putOrder("a1", "Genaro Gallo 2955");
  await putOrder("a2", "genaro  gallo 2955 ");
  await putOrder("a3", "Arturo Prat 1020, depto 4");
  await putOrder("a4", "Nadie 55");
  await putOrder("a5", "Av Santiago 100");
  await putOrder("a6", "Retiro en local", "retiro");
  try {
    const r = await (await post(geoFn, { password:"caja123", days:7 })).json();
    assert.equal(r.orders, 5);                       // el retiro no cuenta
    assert.equal(r.addresses, 4);                    // las dos de Genaro Gallo son la misma
    assert.equal(r.pending, 1);                      // se ubican de a 3 por llamada
    const r2 = await (await post(geoFn, { password:"caja123", days:7 })).json();
    assert.equal(r2.pending, 0);
    const gg = r2.points.find(p => /genaro/i.test(p.address));
    assert.equal(gg.count, 2); assert.equal(gg.approx, false);
    const pr = r2.points.find(p => /prat/i.test(p.address));
    assert.equal(pr.approx, true); assert.equal(pr.street, "arturo prat");
    assert.equal(r2.failed.length, 2);               // Nadie 55 y la que cae fuera de Iquique
    const n = hits.length;
    await post(geoFn, { password:"caja123", days:7 });
    assert.equal(hits.length, n);                    // lo ya ubicado no se vuelve a consultar
    assert.equal((await post(geoFn, { password:"mala", days:7 })).status, 401);
  } finally { globalThis.fetch = real; }
});
