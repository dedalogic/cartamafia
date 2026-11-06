// Precios del pedido calculados SIEMPRE en el servidor, a partir de menu-data.js.
// Es la misma lógica que usa la carta (parseKey / unitPrice), para que ambos números coincidan.
import { IDX, sauceId } from "./_menu.mjs";

export class PricingError extends Error {
  constructor(message, code = "invalid_cart"){ super(message); this.code = code; }
}

const MAX_LINES = 30, MAX_QTY = 30;

const comboOf = (it, o) => it.combo ? (it.combo.byOption ? it.combo.byOption[o] : it.combo.all) : null;
const comboNeedsDrink = (it, o) => { const cb = comboOf(it, o); return !!(cb && /Bebida/i.test(cb.desc || "")); };
const comboDrinkKind = (it, o) => {
  const cb = comboOf(it, o), desc = (cb && cb.desc) || "";
  return /Bebida\s*mini/i.test(desc) ? "mini" : (/Bebida\s*1[.,]?5\s*L/i.test(desc) ? "1.5 L" : "");
};
const drinkChoices = (it, o = 0, ci = 0) => {
  if (it.drinkChoice && Array.isArray(it.drinkChoice.list)) return it.drinkChoice.list;
  if (ci && comboDrinkKind(it, o) === "mini") return ["Coca-Cola Original","Coca-Cola Zero","Sprite","Fanta"];
  return ["Coca-Cola Original","Coca-Cola Zero"];
};
const drinkSuffix = (it, o = 0, ci = 0) => it.drinkChoice ? (it.drinkChoice.suffix || "") : (ci ? comboDrinkKind(it, o) : "");
const drinkDisplay = (it, o, ci, vi) => vi < 0 ? "" : [drinkChoices(it, o, ci)[vi] || "", drinkSuffix(it, o, ci)].filter(Boolean).join(" ");
const pickName = (it, pi) => (it.pick && pi >= 0 && it.pick.list && it.pick.list[pi] != null) ? it.pick.list[pi] : null;
const basePrice = (it, o, pi = -1) => {
  if (it.options) return it.options[o].price;
  const pk = pickName(it, pi);
  if (it.priceByPick && pk && it.priceByPick[pk] != null) return it.priceByPick[pk];
  return it.price;
};
const unitPrice = (it, o, c, pi = -1) => basePrice(it, o, pi) + (c && comboOf(it, o) ? comboOf(it, o).extra : 0);
const servingLabel = (it, o) => {
  const label = it.options?.[o]?.label;
  return label === "Slice" ? "1 trozo" : label === "40 cm" ? "2–3 personas" : label === "60 cm" ? "6–8 personas" : "";
};

const INT = /^-?\d+$/;
const toInt = (v, dflt) => v === undefined ? dflt : (INT.test(v) ? Number(v) : NaN);

// clave: plato | formato | combo(0/1) | opción elegida | bebida | elecciones del combo...
export function parseKey(k){
  if (typeof k !== "string" || k.length > 200) return null;
  const parts = k.split("|"), it = IDX[parts[0]];
  if (!it) return null;
  const oi = toInt(parts[1], 0), c = toInt(parts[2], 0), pi = toInt(parts[3], -1), vi = toInt(parts[4], -1);
  if ([oi, c, pi, vi].some(Number.isNaN) || (c !== 0 && c !== 1)) return null;
  if (it.options ? !it.options[oi] : oi !== 0) return null;
  if (it.pick ? !it.pick.list[pi] : pi !== -1) return null;
  const ci = (c === 1 && comboOf(it, oi)) ? 1 : 0;
  if (c === 1 && !ci) return null;
  const needsDrink = !!it.drinkChoice || (ci && comboNeedsDrink(it, oi));
  if (needsDrink ? !drinkChoices(it, oi, ci)[vi] : vi !== -1) return null;
  const groups = it.bundleChoices || [];
  if (parts.length > 5 + groups.length) return null;
  const bi = groups.map((g, i) => { const n = toInt(parts[5 + i], -1); return Number.isInteger(n) && n >= 0 && g.list[n] ? n : -1; });
  if (bi.some(n => n < 0)) return null;
  return { it, oi, ci, pi, vi, bi };
}

function unavailableReason(p, availability){
  const off = new Set(availability?.disabledProducts || []);
  const { it, oi, pi, bi } = p;
  if (off.has(it.id)) return it.name;
  if (it.options && (availability?.disabledOptions?.[it.id] || []).map(String).includes(String(oi))) return `${it.name} ${it.options[oi].label}`;
  if (it.pick && off.has(sauceId(it.pick.list[pi]))) return `${it.name} (${it.pick.list[pi]})`;
  for (let i = 0; i < (it.bundleChoices || []).length; i++){
    const g = it.bundleChoices[i];
    if (/salsa/i.test(g.label || "") && off.has(sauceId(g.list[bi[i]]))) return `${it.name} (${g.list[bi[i]]})`;
  }
  return null;
}

export function describeLine(p){
  const { it, oi, ci, pi, vi, bi } = p, cb = comboOf(it, oi);
  return [
    it.options ? it.options[oi].label + (servingLabel(it, oi) ? " · " + servingLabel(it, oi) : "") : "",
    ci ? "Combo: " + cb.desc.replace(/^\+\s*/, "") : "",
    it.pick ? (it.pick.short || it.pick.label) + ": " + it.pick.list[pi] : "",
    vi >= 0 ? "Bebida: " + drinkDisplay(it, oi, ci, vi) : "",
    ...(it.bundleChoices || []).map((g, i) => (g.short || g.label) + ": " + g.list[bi[i]])
  ].filter(Boolean);
}

// raw = [{ key, qty }] que manda la carta. Se ignora cualquier precio que venga del navegador.
export function validateCart(raw, availability){
  if (!Array.isArray(raw) || !raw.length) throw new PricingError("Tu pedido está vacío.");
  if (raw.length > MAX_LINES) throw new PricingError("Tu pedido tiene demasiados productos.");
  const merged = new Map();
  for (const r of raw){
    const qty = Number(r?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new PricingError("Cantidad inválida en el pedido.");
    const p = parseKey(r?.key);
    if (!p) throw new PricingError("Hay un producto del pedido que ya no existe. Vuelve a armarlo.");
    if (p.it.pendingPrice || p.it.infoOnly) throw new PricingError(`${p.it.name} no se puede pedir todavía.`);
    const off = unavailableReason(p, availability);
    if (off) throw new PricingError(`${off} está agotado en este momento.`, "unavailable");
    const prev = merged.get(r.key);
    merged.set(r.key, { p, qty: (prev?.qty || 0) + qty });
  }
  const items = [...merged.entries()].map(([key, { p, qty }]) => {
    const unit = unitPrice(p.it, p.oi, p.ci, p.pi);
    if (!Number.isInteger(unit) || unit <= 0) throw new PricingError("Precio inválido en el menú.");
    return { id: p.it.id, key, name: p.it.name, detail: describeLine(p), quantity: qty, unit_price: unit, total_amount: unit * qty };
  });
  const subtotal = items.reduce((a, i) => a + i.total_amount, 0);
  const count = items.reduce((a, i) => a + i.quantity, 0);
  if (count > 60) throw new PricingError("Tu pedido tiene demasiados productos.");
  return { items, subtotal, count };
}
