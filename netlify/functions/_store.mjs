// Acceso a Netlify Blobs en un solo lugar (así las pruebas pueden usar una memoria falsa).
import { getStore } from "@netlify/blobs";

export function openStore(name){
  const factory = globalThis.__mafiaStoreFactory;      // solo lo usan las pruebas automáticas
  return factory ? factory(name) : getStore({ name, consistency:"strong" });
}
