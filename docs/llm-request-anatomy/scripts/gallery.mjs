// Write export/index.html: one card per built figure, with its poster, its
// recordings when they exist, and links to the dark and light pages.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT = resolve(new URL("../export", import.meta.url).pathname);
const pages = readdirSync(OUT).filter((f) => f.endsWith(".html") && !f.endsWith("-light.html") && f !== "index.html").sort();
const TITLES = { "v1-pneumatic-post": "Fig 1 · The sorting line", "v2-rack": "Fig 2 · The rack", "v3-plan": "Fig 3 · The plan view" };
const has = (f) => existsSync(join(OUT, f));

const cards = pages.map((page) => {
  const name = page.replace(".html", "");
  const media = has(`${name}.mp4`)
    ? `<video controls muted loop playsinline preload="metadata" poster="${has(`${name}.png`) ? `${name}.png` : ""}"><source src="${name}.webm" type="video/webm"><source src="${name}.mp4" type="video/mp4"></video>`
    : has(`${name}.png`) ? `<img src="${name}.png" alt="">` : "";
  const files = ["mp4", "webm", "gif", "png"].filter((ext) => has(`${name}.${ext}`)).map((ext) => `<a href="${name}.${ext}">${ext}</a>`).join(" · ");
  return `<article>
  <h2>${TITLES[name] || name}</h2>
  ${media}
  <p><a href="${page}">open · dark</a> · <a href="${name}-light.html">open · light</a>${files ? ` · <span class="dl">${files}</span>` : ""}</p>
</article>`;
}).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LLM request anatomy</title>
<style>
:root{--bg:#0b0b0b;--card:#131313;--text:#a3a3a3;--strong:#e6e6e6;--muted:#6e6e6e;--line:#2a2a2a;color-scheme:dark}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f2f2ef;--card:#fbfbfa;--text:#57575a;--strong:#18181a;--muted:#8c8c90;--line:#d4d4d6;color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 ui-sans-serif,system-ui,sans-serif;padding:48px max(16px,env(safe-area-inset-left,0px)) 96px max(16px,env(safe-area-inset-right,0px))}
main{width:min(1160px,100%);margin:0 auto;display:grid;gap:40px}
h1{font:600 20px/1.3 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--strong);margin:0}
h2{font:500 13px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--text);margin:0 0 12px}
article{background:var(--card);box-shadow:0 0 0 1px var(--line);padding:24px}
video,img{display:block;width:100%;height:auto;background:#000}
p{margin:12px 0 0;color:var(--muted)}a{color:var(--strong);text-decoration:none;border-bottom:1px solid var(--line)}a:hover{border-color:var(--strong)}
.dl a{color:var(--text)}
.lead{color:var(--muted);max-width:65ch}
</style></head><body><main>
<header><h1>What happens to an LLM request</h1><p class="lead">One chat completion to the OpenEverest + KServe workshop platform, drawn as machines you can watch. Each figure loops through the platform coming up, four requests, a wrong key and a spent token quota. Hover a machine, step with the arrow keys, pause with Space.</p></header>
${cards}
</main></body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log("wrote export/index.html ·", pages.length, "figures");
