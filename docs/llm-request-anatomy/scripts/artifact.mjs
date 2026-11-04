// Turn a built page into an artifact body: the claude.ai artifact viewer wraps
// the file in its own <html>/<head>/<body>, so the page's skeleton comes off,
// the `.iso` theme root moves from <body> to a wrapper <div>, and the theme
// follows the viewer's choice (data-theme on <html>, else prefers-color-scheme)
// until the page's own toggle is used.
//   node scripts/artifact.mjs export/v1-pneumatic-post.html export/artifact/v1-pneumatic-post.html
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [input, output] = process.argv.slice(2);
if (!input || !output) { console.error("usage: node scripts/artifact.mjs <built.html> <artifact.html>"); process.exit(1); }
const page = readFileSync(input, "utf8");
const title = page.match(/<title>([^<]*)<\/title>/)[1];
const style = page.match(/<style>([\s\S]*?)<\/style>/)[1];
const bodyMatch = page.match(/<body class="iso" data-theme="(\w+)">([\s\S]*)<\/body>/);
const [, theme, inner] = bodyMatch;
const script = inner.match(/<script type="module">([\s\S]*)<\/script>\s*$/);
const content = inner.replace(/<script type="module">[\s\S]*<\/script>\s*$/, "");

const css = style
  .replace(/html\{color-scheme:dark\}\s*body\[data-theme="light"\]\{color-scheme:light\}\s*/, "")
  .replace(/body\{margin:0;background:var\(--anatomy-page\);/, ".anatomy-root{min-height:100%;background:var(--anatomy-page);")
  .replace(/body\.iso\[data-theme="light"\]/g, '.anatomy-root[data-theme="light"]');

const out = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* the host theme: dark first, light when the viewer asks for it */
:root{--bg:#0b0b0b;color-scheme:dark}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f2f2ef;color-scheme:light}}
:root[data-theme="light"]{--bg:#f2f2ef;color-scheme:light}
body{background:var(--bg);margin:0}
${css}
.iso-page{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 80px;width:min(1160px,100%)}
</style>
<div class="iso anatomy-root" data-theme="${theme}">
${content}
</div>
<script type="module">
${script[1].replace("const body = document.body;", "const body = document.querySelector('.anatomy-root');")
  .replace("pick(saved || body.dataset.theme);", "const host = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); pick(saved || host);")
  .replace("body.dataset.theme = t;", "body.dataset.theme = t; document.documentElement.dataset.theme = t;")}
</script>
`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, out);
console.log("wrote", output, Math.round(out.length / 1024) + " KB");
