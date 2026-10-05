/* 从 hanzi-writer-data 的 CDN 下载指定汉字的笔顺数据到 assets/。
 * 用法：node tools/fetch-data.mjs 你好世界
 * 下载后请重新运行：node tools/build-data.mjs
 */
import { writeFile } from "node:fs/promises";

const chars = [...process.argv.slice(2).join("")];
if (!chars.length) {
  console.log("用法：node tools/fetch-data.mjs 你好世界");
  process.exit(1);
}
let saved = 0;
for (const char of chars) {
  const code = char.codePointAt(0).toString(16);
  const url = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(char)}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`失败：${char}（HTTP ${response.status}）`);
    continue;
  }
  await writeFile(new URL(`../assets/hanzi-${code}.json`, import.meta.url), await response.text());
  console.log(`已保存：${char} -> assets/hanzi-${code}.json`);
  saved += 1;
}
if (saved) console.log("记得重新运行：node tools/build-data.mjs");
