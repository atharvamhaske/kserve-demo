// Render src/slides.html to PNG (3840x2160), a vector PDF, and Excalidraw sources.
// Usage (from the deck folder): node scripts/build.js
// If src/assets/brand/devcon-8-india-bg.png exists, slide 7 uses it instead of the sketch.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'export');
const SRC = path.join(ROOT, 'src', 'slides.html');
const art = fs.existsSync(path.join(ROOT, 'src/assets/brand/devcon-8-india-bg.png')) ? '1' : '0';
const url = 'file://' + SRC + '?art=' + art;
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

  const scenes = await page.evaluate(() => window.__excalidraw);
  for (const [n, elements] of Object.entries(scenes)) {
    const file = path.join(OUT, 'excalidraw', `slide-${String(n).padStart(2, '0')}.excalidraw`);
    fs.writeFileSync(file, JSON.stringify({
      type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements,
      appState: { viewBackgroundColor: '#F4F2FF', gridSize: null }, files: {},
    }, null, 2));
    console.log('excalidraw', path.relative(ROOT, file), elements.length, 'elements');
  }

  await page.emulateMedia({ media: 'print' });
  const pdf = path.join(OUT, 'llm-request-to-kubernetes.pdf');
  await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  console.log('pdf', path.relative(ROOT, pdf));
  await browser.close();
})();
