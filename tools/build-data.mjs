/* 把 assets/hanzi-<码点>.json 打包成浏览器可直接 <script> 引入的 hanzi-data.js。
 * 用法：node tools/build-data.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

const assets = new URL("../assets/", import.meta.url);
const out = new URL("../hanzi-data.js", import.meta.url);
const files = (await readdir(assets)).filter((name) => /^hanzi-[0-9a-f]+\.json$/.test(name)).sort();
const bundle = {};
for (const name of files) {
  const code = name.slice("hanzi-".length, -".json".length);
  bundle[code] = JSON.parse(await readFile(new URL(name, assets), "utf8"));
}
await writeFile(out, "window.HANZI_INK_DATA = " + JSON.stringify(bundle) + ";\n");
const chars = Object.keys(bundle).map((code) => String.fromCodePoint(parseInt(code, 16)));
console.log(`hanzi-data.js：${files.length} 个字（${chars.join(" ")}）`);
