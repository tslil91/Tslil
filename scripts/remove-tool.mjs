// Builds release/remove-people-tool.html — ONE offline HTML file (no server, no network).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  entryPoints: [path.join(root, 'src/tools/remove-people.ts')], bundle: true, format: 'iife', platform: 'browser',
  target: 'es2020', minify: true, write: false, logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>הסרת אנשים מקובץ גיבוי</title>
<style>
body{margin:0;background:#f3f5f7;color:#12263a;font-family:Heebo,Arial,"Segoe UI",system-ui,sans-serif;font-size:15px}
#app{max-width:980px;margin:24px auto;padding:0 16px}
h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:18px 0 8px}
section,#list,#summary{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin:10px 0}
.muted{color:#475569}.err{background:#fde4e0;color:#8a2d1b;border-radius:6px;padding:10px 12px;font-weight:600}.ok{background:#d9f2e3;color:#14532d;border-radius:6px;padding:10px 12px;font-weight:600}
.btn{display:inline-flex;align-items:center;height:36px;padding:0 14px;border:0;border-radius:4px;background:#12263a;color:#fff;font:inherit;font-weight:600;cursor:pointer;margin:0 0 0 8px}
.btn.danger{background:#8a2d1b}.btn:disabled{opacity:.45;cursor:not-allowed}
input[type=file]{position:absolute;left:-9999px}
input[type=search],textarea{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:4px;padding:8px;font:inherit;margin:4px 0}
.scroll{max-height:380px;overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;text-align:start;border-bottom:1px solid #e2e8f0;font-size:14px}th{position:sticky;top:0;background:#f1f5f9}
.row{display:flex;align-items:center;gap:6px;margin:8px 0}input[type=checkbox]{width:16px;height:16px}
</style></head><body><div id="app"></div>
<script>${js.replace(/\$/g, '$$$$')}</script></body></html>`;
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
const out = path.join(root, 'release', 'remove-people-tool.html');
fs.writeFileSync(out, html.replace(/\$\$/g, '$'));
console.log(`tool -> release/remove-people-tool.html (${(html.length / 1024).toFixed(0)} KB)`);
