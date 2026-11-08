// Renders public/icon.svg to the PNG sizes phones need. Run: npm run icons
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // uses a globally installed Playwright
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");
const sizes = [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]];
const browser = await chromium.launch();
for (const [name, size] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Apple icons get no transparency: fill the corners with the brand color.
  const bg = name.startsWith("apple") ? "#0F7F73" : "transparent";
  await page.setContent(`<body style="margin:0;background:${bg}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: bg === "transparent" });
  await page.close();
}
await browser.close();
console.log("icons written");
