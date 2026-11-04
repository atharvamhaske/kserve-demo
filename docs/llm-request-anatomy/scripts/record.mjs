// Record a figure's idle tour as MP4, GIF and a poster PNG, frame by frame.
//
//   node scripts/record.mjs export/v1-pneumatic-post.html [--fps 24] [--width 1160] [--scale 2]
//                            [--seconds 72.5] [--start 0] [--gif-width 900] [--gif-fps 12] [--out export]
//
// The page's clock is virtual: requestAnimationFrame and performance.now are
// replaced before the page loads, and every frame is stepped by exactly 1/fps
// seconds, so the recording is deterministic and never drops a frame however
// long a screenshot takes. Needs Playwright (pre-installed) and ffmpeg.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// Playwright is pre-installed outside this folder on the build box; look there too.
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const spec of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
    try { return require(spec); } catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
  }
  throw new Error("playwright not found: npm i -D playwright (and npx playwright install chromium)");
})();

const argv = process.argv.slice(2);
const take = (flag, fallback) => { const i = argv.indexOf(flag); if (i < 0) return fallback; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const fps = Number(take("--fps", 24));
const width = Number(take("--width", 1160));
const scale = Number(take("--scale", 2));
const gifWidth = Number(take("--gif-width", 900));
const gifFps = Number(take("--gif-fps", 12));
const start = Number(take("--start", 0));
let seconds = take("--seconds", null);
const outDir = resolve(take("--out", "export"));
const file = argv[0];
if (!file) { console.error("usage: node scripts/record.mjs <page.html> [options]"); process.exit(1); }
const name = basename(file, ".html");
mkdirSync(outDir, { recursive: true });

// A controllable clock: the page's animation only advances through __advance(ms).
const CLOCK = `(() => {
  let now = 0; const queue = [];
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => now;
  window.__advance = (ms) => { now += ms; const batch = queue.splice(0); for (const cb of batch) cb(now); return now; };
})();`;

const frames = mkdtempSync(join(tmpdir(), "anatomy-frames-"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: width + 80, height: 1400 }, deviceScaleFactor: scale });
await page.addInitScript(CLOCK);
page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
await page.goto(pathToFileURL(resolve(file)).href);
await page.waitForFunction("window.__anatomy && document.querySelector('.iso-plate')");
const plate = await page.$(".iso-plate");
const box = await plate.boundingBox();
const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) };
if (seconds === null) seconds = await page.evaluate("window.__anatomy.total");
seconds = Number(seconds);
const total = Math.round(seconds * fps);
console.log(`recording ${name}: ${seconds.toFixed(1)} s at ${fps} fps = ${total} frames, ${clip.width}x${clip.height} css px × ${scale}`);

// Hold the tour and drive the clock by hand from `start`.
await page.evaluate(`window.__anatomy.hold(); window.__anatomy.seek(${start});`);
await page.evaluate("window.__advance(16)");
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate(`window.__anatomy.step(${1 / fps})`);
  await page.screenshot({ path: join(frames, `f${String(i).padStart(5, "0")}.png`), clip });
  if (i % (fps * 5) === 0) console.log(`  frame ${i}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();

const run = (args) => { const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" }); if (r.status !== 0) { console.error("ffmpeg failed:", args.join(" ")); process.exit(1); } };
const input = ["-framerate", String(fps), "-i", join(frames, "f%05d.png")];
const mp4 = join(outDir, `${name}.mp4`);
run([...input, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", mp4]);
const webm = join(outDir, `${name}.webm`);
run([...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", webm]);
const gif = join(outDir, `${name}.gif`);
const palette = join(frames, "palette.png");
run([...input, "-vf", `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,palettegen=max_colors=96:stats_mode=diff`, palette]);
run([...input, "-i", palette, "-lavfi", `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, gif]);
const poster = join(outDir, `${name}.png`);
run(["-i", join(frames, `f${String(Math.min(total - 1, Math.round(fps * 19))).padStart(5, "0")}.png`), poster]);
rmSync(frames, { recursive: true, force: true });
console.log("wrote", mp4, webm, gif, poster);
