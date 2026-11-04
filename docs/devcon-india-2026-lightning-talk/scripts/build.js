// Render src/slides.html to PNG (3840x2160) and a vector PDF, and copy the Excalidraw sources.
// Run scripts/diagrams.py and scripts/render_diagrams.js first (or `npm run build`).
// Usage (from the deck folder): node scripts/build.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'export');
const SRC = path.join(ROOT, 'src', 'slides.html');
const url = 'file://' + SRC;
const only = process.argv[2] ? Number(process.argv[2]) : null; // optional: render one slide

(async () => {
  fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'excalidraw'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
  await page.goto(url);
  await page.waitForFunction('window.__ready === true', null, { timeout: 30000 });

  const slides = await page.$$('section.slide');
  for (let i = 0; i < slides.length; i++) {
    if (only && only !== i + 1) continue;
    const file = path.join(OUT, 'png', `slide-${String(i + 1).padStart(2, '0')}.png`);
    await slides[i].screenshot({ path: file });
    console.log('png', path.relative(ROOT, file));
  }
  if (only) { await browser.close(); return; }

  // The editable sources are the Excalidraw scenes the diagrams were rendered from.
  const SCENES = path.join(ROOT, 'src', 'diagrams');
  for (const f of fs.readdirSync(SCENES).filter(f => f.endsWith('.excalidraw'))) {
    fs.copyFileSync(path.join(SCENES, f), path.join(OUT, 'excalidraw', f));
    console.log('excalidraw', path.join('export/excalidraw', f));
  }

  await page.emulateMedia({ media: 'print' });
  const pdf = path.join(OUT, 'llm-request-to-kubernetes.pdf');
  await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  console.log('pdf', path.relative(ROOT, pdf));
  await browser.close();
})();
