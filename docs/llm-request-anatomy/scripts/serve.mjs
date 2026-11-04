// Serve the built figures on a local port, for a demo or a dev loop.
//   node scripts/serve.mjs [--port 4173] [--host 0.0.0.0]
// Opens export/index.html (the gallery) at http://localhost:4173/
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const argv = process.argv.slice(2);
const take = (flag, fallback) => { const i = argv.indexOf(flag); if (i < 0) return fallback; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const port = Number(take("--port", process.env.PORT || 4173));
const host = take("--host", "0.0.0.0");
const ROOT = resolve(new URL("../export", import.meta.url).pathname);
const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };

createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(ROOT, normalize(url === "/" ? "/index.html" : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found: " + url); }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, host, () => console.log(`anatomy gallery · http://localhost:${port}/  (serving ${ROOT})`));
