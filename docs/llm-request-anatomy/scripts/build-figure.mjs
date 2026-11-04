// Build one figure folder into a standalone page (dark and light).
//   node scripts/build-figure.mjs <folder> [--light]
// A folder holds figure.mjs exporting: WIDTH, HEIGHT, CARD, STATION_PLANS,
// layout(k), statics(k, P), live(k, P, pose, extra), labelsSvg(k, P), and
// optionally CSS (page styles) and STATION_TEXT (hover readouts by station id).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "./inline-kit.mjs";
import * as MODEL from "../lib/model.mjs";
import * as DRAW from "../lib/draw.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const folder = resolve(process.argv[2]);
const theme = process.argv.includes("--light") ? "light" : "dark";
const name = basename(folder);
const OUT = join(ROOT, "export");
mkdirSync(OUT, { recursive: true });

// The figure module sees the recipes and the model as globals, in Node and in the page alike.
Object.assign(globalThis, DRAW, MODEL);
const FIG = await import(pathToFileURL(join(folder, "figure.mjs")).href);

const inline = (file) => readFileSync(file, "utf8").replace(/^import[^\n]*\n/gm, "").replace(/^export \{[^}]*\};?\n?/gm, "").replace(/^export /gm, "");
const kitNames = [...readFileSync(join(ROOT, "kit", "iso-kit.mjs"), "utf8").matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
const kAlias = `const k = { ${kitNames.join(", ")} };\n`;

const P = FIG.layout(k);
const pose0 = MODEL.poseAt(0);
const items = [...FIG.statics(k, P), ...FIG.live(k, P, pose0, { fan: 0 })];
const boxes = Object.fromEntries(Object.entries(FIG.STATION_PLANS).map(([id, [plan, z0, z1]]) => [id, DRAW.screenBox(k, P, plan, z0, z1)]));
const stationText = Object.fromEntries(MODEL.STATIONS.map((s) => [s.id, `${s.name} · ${s.does}`]));
Object.assign(stationText, {
  console: "OpenEverest · Instance → provider-kserve → LLMInferenceService → KServe objects, status and endpoint written back",
  bin401: "401 bin · a wrong or foreign key is refused by the Gateway's SecurityPolicy before any model is reached",
  bin429: "429 bin · past 300 tokens in the hour the Gateway refuses the key's requests until the hour rolls over",
  tape: "Tape · the answer streams back as SSE data: chunks, one tick per token, through the same Gateway",
  k8s: "Kubernetes · everything on the bench runs in one cluster: Envoy, KServe, vLLM, OpenEverest",
}, FIG.STATION_TEXT || {});

const svg = k.figureSvg({ width: FIG.WIDTH, height: FIG.HEIGHT, label: FIG.CARD.label, body: DRAW.layerSvg(items) + FIG.labelsSvg(k, P) });

const live = [
  `const P = ${JSON.stringify(P)};`,
  `const STATION_BOXES = ${JSON.stringify(boxes)};`,
  `const STATION_TEXT = ${JSON.stringify(stationText)};`,
  `const FIG = { live };`,
  inline(join(ROOT, "lib", "live.mjs")),
].join("\n");
const script = [kitScript(), kAlias, inline(join(ROOT, "lib", "model.mjs")), inline(join(ROOT, "lib", "draw.mjs")), inline(join(folder, "figure.mjs")), live].join("\n");

const body = k.plateHtml({
  fig: FIG.CARD.fig,
  title: FIG.CARD.title,
  hint: "Hover a machine · ← → step · Space pause",
  readout: pose0.readout,
  keys: FIG.CARD.keys,
  caption: "",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="The life of one LLM request on the platform: arrow keys step through it, Space pauses" aria-valuemin="0" aria-valuemax="${Math.round(MODEL.TIMELINE.total)}" aria-valuenow="0" aria-valuetext="${pose0.readout}">${svg}<span data-phase-live aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></span></div>`,
});

const story0 = MODEL.storyOf(pose0.step);
const STORY_HTML = `<div class="iso-legend story" aria-hidden="true"><span class="story-now" data-story-now>${story0[0]}</span><span class="story-what" data-story-what>${story0[1]}</span><span class="story-watch" data-story-watch>${story0[2]}</span></div><p class="iso-legend about">${FIG.CARD.caption}</p>`;
const bodyWithStory = body.replace("</figure>", STORY_HTML + "</figure>");

const PAGE_CSS = `<style>
.iso-figure{margin:6px 0 36px}
.iso-stage{position:relative;outline:none;touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
[data-station][data-on] .iso-line[data-tone="mid"],[data-station][data-on] .iso-line[data-tone="lo"]{stroke:var(--anatomy-hi)}
[data-station][data-on] .iso-edge{stroke:var(--anatomy-lit)}
[data-station][data-on] .iso-solid>.iso-top{fill:var(--anatomy-lit-top)}
.iso-label{font-family:var(--anatomy-mono);letter-spacing:.06em;fill:var(--anatomy-text)}
.iso-label-name{font-size:7.4px;fill:var(--anatomy-strong);font-weight:600}
.iso-label-line{font-size:6.2px;fill:var(--anatomy-muted);opacity:0;transition:opacity 220ms var(--anatomy-ease)}
.iso-label[data-on] .iso-label-line{opacity:1}
@media (prefers-reduced-motion:reduce){.iso-label-line{transition:none}}
.iso-label[data-on] .iso-label-name{fill:var(--anatomy-lit)}
.iso-label[data-on] .iso-label-line{fill:var(--anatomy-text)}
[data-station][data-on] .iso-solid>.iso-shade{fill:var(--anatomy-lit-shade)}
[data-station][data-on] .iso-dots circle{opacity:.9}
.story{display:grid;grid-template-columns:minmax(180px,220px) 1fr;grid-template-rows:auto auto;gap:4px 24px;align-items:start;margin-top:14px;padding-top:14px;border-top:1px solid var(--anatomy-faint);min-height:64px}
.story-now{grid-row:1/3;font:600 13px/1.5 var(--anatomy-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-strong)}
.story-what{color:var(--anatomy-text);font-size:13.5px;line-height:1.55}
.story-watch{color:var(--anatomy-muted);font-size:12.5px;font-style:italic}
.about{margin-top:10px;font-size:12px;color:var(--anatomy-muted);max-width:72ch}
@media (max-width:560px){.story{grid-template-columns:1fr}.story-now{grid-row:auto}}
.theme-toggle{display:flex;gap:14px;justify-content:flex-end;margin:0;font:11px/1 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-muted)}
.theme-toggle button{all:unset;cursor:pointer;color:var(--anatomy-muted);padding:4px 0}
.theme-toggle button[aria-pressed="true"]{color:var(--anatomy-strong)}
body.iso[data-theme="light"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-page:#f4f4f2}
${FIG.CSS || ""}
</style>`;
const TOGGLE = `<nav class="theme-toggle" aria-label="Theme"><button type="button" data-theme-pick="dark">dark</button><button type="button" data-theme-pick="light">light</button></nav>`;
const TOGGLE_JS = `
(() => { const body = document.body; const pick = (t) => { body.dataset.theme = t; document.querySelectorAll('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === t))); try { localStorage.setItem('anatomy-theme', t); } catch {} }; document.querySelectorAll('[data-theme-pick]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.themePick))); let saved = null; try { saved = localStorage.getItem('anatomy-theme'); } catch {} pick(saved || body.dataset.theme); })();
`;

const file = join(OUT, theme === "light" ? `${name}-light.html` : `${name}.html`);
writeFileSync(file, k.pageHtml({ title: FIG.CARD.page, theme, body: PAGE_CSS + TOGGLE + bodyWithStory, script: script + TOGGLE_JS, width: 1160 }));
console.log("wrote", file, `· ${items.length} items · loop ${MODEL.TIMELINE.total.toFixed(1)} s`);
