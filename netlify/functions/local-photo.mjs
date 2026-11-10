import { openStore } from "./_store.mjs";
import { PHOTO_STORE } from "./_local.mjs";

// Entrega las fotos que se suben desde el panel de la carta local.
export default async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[\w-]{1,60}$/.test(id)) return new Response("No encontrada", { status:404 });
  const p = await openStore(PHOTO_STORE).get(id, { type:"json" });
  if (!p?.b64) return new Response("No encontrada", { status:404 });
  return new Response(Buffer.from(p.b64, "base64"), {
    headers:{ "Content-Type":p.type || "image/jpeg", "Cache-Control":"public, max-age=31536000, immutable" }
  });
};
