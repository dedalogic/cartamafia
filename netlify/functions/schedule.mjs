// Horarios de la carta (local y online): la carta destaca distinto segun dia y hora.
import { json, readJson } from "./_auth.mjs";
import { roleOf } from "./_mafia-roles.mjs";
import { openStore } from "./_store.mjs";

export const SCHED_STORE = "mafia-menu";
export const SCHED_KEY = "schedule-v1";
export const SITES = ["local", "online"];
export const DEFAULTS = {"local": [{"id": "martes", "on": true, "tag": "Promo del martes", "msg": "HOY: SLICES|50% DCTO.", "days": [2], "from": "00:00", "to": "24:00", "first": "pizzas", "then": "pastas", "top": [], "ban": "martes", "slice": true}, {"id": "almuerzo", "on": true, "tag": "Almuerzo", "msg": "PIDE PASTAS", "days": [0, 1, 2, 3, 4, 5, 6], "from": "12:00", "to": "17:00", "first": "combos", "then": "pastas", "top": ["combo-del-don", "combo-duo-del-don"], "ban": "pasta-familia", "slice": false}, {"id": "resto", "on": true, "tag": "Resto del día", "msg": "PIDE UN COMBO", "days": [0, 1, 2, 3, 4, 5, 6], "from": "00:00", "to": "24:00", "first": "combos", "then": "pizzas", "top": [], "ban": "pesto", "slice": false}], "online": [{"id": "martes", "on": false, "tag": "Promo del martes", "msg": "HOY: MARTES", "days": [2], "from": "00:00", "to": "24:00", "first": "combos", "then": "pizzas", "top": [], "ban": "familiar", "slice": false}, {"id": "almuerzo", "on": true, "tag": "Almuerzo", "msg": "PIDE UN COMBO", "days": [0, 1, 2, 3, 4, 5, 6], "from": "12:00", "to": "17:00", "first": "combos", "then": "pizzas", "top": ["combo-del-don", "combo-famiglia", "combo-duo-del-don", "combo-doble-capo", "promo-alfredo", "combo-complices"], "ban": "pastas", "slice": false}, {"id": "resto", "on": true, "tag": "Resto del día", "msg": "PIDE UN COMBO", "days": [0, 1, 2, 3, 4, 5, 6], "from": "00:00", "to": "24:00", "first": "combos", "then": "pizzas", "top": ["combo-famiglia", "combo-del-don", "combo-doble-capo", "combo-duo-del-don", "combo-complices", "promo-alfredo"], "ban": "familiar", "slice": false}]};

const ID = /^[\w-]{1,40}$/;
const HM = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const SECTIONS = ["combos", "pizzas", "nuestras-pastas"];

export function cleanRules(raw){
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const r of raw.slice(0, 12)){
    if (!r || typeof r !== "object") continue;
    const days = [...new Set((Array.isArray(r.days) ? r.days : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
    const from = HM.test(r.from) ? r.from : "00:00";
    const to = HM.test(r.to) ? r.to : "24:00";
    out.push({
      id: ID.test(r.id) ? r.id : "h" + (out.length + 1),
      on: r.on !== false,
      tag: String(r.tag || "").trim().slice(0, 24),
      msg: String(r.msg || "").replace(/[<>]/g, "").trim().slice(0, 40),
      days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
      from, to,
      first: SECTIONS.includes(r.first) ? r.first : "combos",
      then: r.then === "pastas" ? "pastas" : "pizzas",
      top: (Array.isArray(r.top) ? r.top : []).filter(x => typeof x === "string" && ID.test(x)).slice(0, 12),
      ban: typeof r.ban === "string" && ID.test(r.ban) ? r.ban : "",
      slice: r.slice === true
    });
  }
  return out;
}

async function readAll(){ return (await openStore(SCHED_STORE).get(SCHED_KEY, { type:"json", consistency:"strong" })) || {}; }

export default async (req) => {
  if (req.method === "GET"){
    const site = new URL(req.url).searchParams.get("site");
    if (!SITES.includes(site)) return json({ error:"Carta inválida" }, 400);
    const all = await readAll();
    const rules = Array.isArray(all[site]) && all[site].length ? all[site] : null;
    return json({ rules, defaults:DEFAULTS[site] });
  }
  if (req.method !== "POST") return json({ error:"Método no permitido" }, 405);
  const body = await readJson(req);
  if (!body) return json({ error:"Solicitud inválida" }, 400);
  if (!process.env.MAFIA_ADMIN_PASSWORD) return json({ error:"MAFIA_ADMIN_PASSWORD no está configurada" }, 503);
  if (roleOf(body.password) !== "admin") return json({ error:"Credencial incorrecta" }, 401);
  if (!SITES.includes(body.site)) return json({ error:"Carta inválida" }, 400);
  if (body.action === "set"){
    const rules = cleanRules(body.rules);
    if (!rules || !rules.length) return json({ error:"Agrega al menos un horario" }, 400);
    const all = await readAll();
    all[body.site] = rules;
    await openStore(SCHED_STORE).setJSON(SCHED_KEY, { ...all, updatedAt:new Date().toISOString() });
    return json({ ok:true, rules });
  }
  if (body.action === "reset"){
    const all = await readAll(); delete all[body.site];
    await openStore(SCHED_STORE).setJSON(SCHED_KEY, { ...all, updatedAt:new Date().toISOString() });
    return json({ ok:true, rules:null, defaults:DEFAULTS[body.site] });
  }
  return json({ error:"Acción inválida" }, 400);
};
