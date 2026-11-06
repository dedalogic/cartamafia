import { openStore } from "./_store.mjs";

export const AVAILABILITY_STORE = "mafia-menu";
export const AVAILABILITY_KEY = "availability-v2";

export async function readAvailability(){
  const raw = await openStore(AVAILABILITY_STORE).get(AVAILABILITY_KEY, { type:"json", consistency:"strong" });
  return {
    disabledProducts: Array.isArray(raw?.disabledProducts) ? raw.disabledProducts : [],
    disabledOptions: raw?.disabledOptions && typeof raw.disabledOptions === "object" ? raw.disabledOptions : {}
  };
}
