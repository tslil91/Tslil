// Builds ONE self-contained HTML file (scripts, styles and fonts inlined). Open it by double-clicking:
// no server, no installation, no network. Each browser keeps its own data (local mode), so it is meant for
// trying the app or for a single user. For several users sharing data, use the server release instead.
import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-single');
fs.rmSync(out, { recursive: true, force: true });

await build({
  root, configFile: false, base: './', logLevel: 'warn',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: out, emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const read = (rel) => fs.readFileSync(path.join(out, rel.replace(/^\.\//, '')), 'utf8');
let html = read('index.html');
// <script type="module" crossorigin src="./assets/x.js"></script> -> inline module
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>\s*/g, '');
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">\s*/g, (_, href) => `<style>${read(href)}</style>\n`);
const js = fs.readdirSync(path.join(out, 'assets')).filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`expected one JS file, found ${js.join(', ')}`);
const code = read(`assets/${js[0]}`).replace(/<\/script/gi, '<\\/script');
// a function, not a string: the code contains sequences like $' that String.replace would otherwise interpret
html = html.replace('</body>', () => `<script type="module">\n${code}\n</script>\n</body>`);
const file = path.join(root, 'release', 'personnel-billets-standalone.html');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, html);
console.log(`standalone file -> release/personnel-billets-standalone.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
