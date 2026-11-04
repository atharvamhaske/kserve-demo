// Render every src/diagrams/*.excalidraw scene to SVG with Excalidraw itself
// (exportToSvg, Excalifont embedded), so the slides show exactly what
// excalidraw.com shows for the same file.
// Usage (from the deck folder, after `npm install`): node scripts/render_diagrams.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIAGRAMS = path.join(ROOT, 'src', 'diagrams');
const CACHE = path.join(ROOT, '.cache', 'excalidraw');
const ASSETS = path.join(ROOT, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod');

function bundle() {
  fs.mkdirSync(CACHE, { recursive: true });
  const entry = path.join(CACHE, 'entry.js');
  fs.writeFileSync(entry, 'import { exportToSvg } from "@excalidraw/excalidraw";\nwindow.exportToSvg = exportToSvg;\nwindow.__exReady = true;\n');
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'esbuild'), [entry, '--bundle', '--format=esm', '--minify',
    '--loader:.css=empty', '--define:process.env.NODE_ENV="production"', `--outfile=${path.join(CACHE, 'bundle.js')}`,
    '--log-level=warning'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules') } });
  fs.writeFileSync(path.join(CACHE, 'index.html'),
    '<!doctype html><script>window.EXCALIDRAW_ASSET_PATH = "/assets/";</script><script type="module" src="/bundle.js"></script>');
}

function serve() {
  const types = { '.js': 'text/javascript', '.html': 'text/html', '.woff2': 'font/woff2' };
  return http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = u.startsWith('/assets/') ? path.join(ASSETS, u.slice(8)) : path.join(CACHE, u === '/' ? 'index.html' : u);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
}

(async () => {
  bundle();
  const server = serve().listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction('window.__exReady === true', null, { timeout: 60000 });

  for (const name of fs.readdirSync(DIAGRAMS).filter(f => f.endsWith('.excalidraw')).sort()) {
    const scene = JSON.parse(fs.readFileSync(path.join(DIAGRAMS, name), 'utf8'));
    const svg = await page.evaluate(async scene => {
      const el = await window.exportToSvg({
        elements: scene.elements, files: scene.files,
        appState: { ...scene.appState, exportBackground: false, exportWithDarkMode: false },
        exportPadding: 0,
      });
      return el.outerHTML;
    }, scene);
    const out = path.join(DIAGRAMS, name.replace('.excalidraw', '.svg'));
    fs.writeFileSync(out, svg);
    console.log('svg', path.relative(ROOT, out), Math.round(svg.length / 1024) + ' KB');
  }
  await browser.close();
  server.close();
})();
