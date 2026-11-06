// El menú real vive en /menu-data.js (el mismo archivo que usa la carta en el navegador).
import MENU from "../../menu-data.js";

export { MENU };
export const IDX = {};
export const CATOF = {};
for (const c of MENU) for (const it of c.items){ IDX[it.id] = it; CATOF[it.id] = c.id; }

export const sauceId = name => "salsa-" + String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
