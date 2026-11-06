// Interruptor del pago online (se cambia desde /admin/). Es adicional a MAFIA_MP_TEST_ENABLED:
// el pago online funciona solo si ambos están encendidos. Sin valor guardado = encendido.
import { openStore } from "./_store.mjs";

const STORE = "mafia-menu";
const KEY = "pay-switch-v1";

export async function readPaySwitch(){
  try {
    const raw = await openStore(STORE).get(KEY, { type:"json", consistency:"strong" });
    return raw && raw.online === false ? false : true;
  } catch { return true; }
}
export async function writePaySwitch(online){
  await openStore(STORE).setJSON(KEY, { online: !!online, updatedAt: new Date().toISOString() });
}
