// Servidor LOCAL de prueba: sirve la carta y simula Netlify Functions + Mercado Pago con datos falsos.
// Uso:  npm run demo   →  http://localhost:8888      (caja: http://localhost:8888/caja  clave: caja123)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installStores, installMercadoPago } from "./mocks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaults = { MAFIA_MP_TEST_ENABLED:"true", MERCADOPAGO_ACCESS_TOKEN:"TEST-TOKEN", MERCADOPAGO_PUBLIC_KEY:"TEST-PUBLIC-KEY", MERCADOPAGO_WEBHOOK_SECRET:"whsec", MAFIA_ADMIN_PASSWORD:"caja123", MAFIA_DELIVERY_FEE:"3500" };
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
installStores(); const mp = installMercadoPago();
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".webp":"image/webp", ".png":"image/png", ".jpg":"image/jpeg", ".ttf":"font/ttf", ".mjs":"text/javascript", ".json":"application/json", ".txt":"text/plain" };
const port = Number(process.env.PORT || 8888);

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname.startsWith("/.netlify/functions/")){
      const name = url.pathname.split("/").pop().replace(/[^a-z-]/g, "");
      const mod = await import(pathToFileURL(path.join(root, "netlify/functions", name + ".mjs")).href);
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await mod.default(new Request(url, { method:req.method, headers:req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname === "/__mp") { res.writeHead(200, { "content-type":"application/json" }); return res.end(JSON.stringify({ calls:mp.calls })); }
    let p = decodeURIComponent(url.pathname); if (p.endsWith("/")) p += "index.html";
    let file = path.join(root, p);
    if (!file.startsWith(root) || file.includes("node_modules")) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("no encontrado"); }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(port, () => console.log(`Demo local en http://localhost:${port}  (caja: /caja, clave: caja123)`));
