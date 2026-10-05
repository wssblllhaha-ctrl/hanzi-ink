# hanzi-ink

用真实笔顺数据把汉字**一笔一笔写出来**：只取笔画中线（`medians`），Catmull-Rom 平滑后等粗细描边，
沿笔迹方向逐笔揭示。没有笔锋、略带稚拙感的手写风；零依赖，单个 JS + 单个 CSS。

最初来自个人作品集的「你好」开场白与「再见」签名，现抽出为独立模块。

## 效果

- 每个字由各自的中线路径组成，按字的顺序、笔画顺序依次写出；
- 三档节奏：`normal`（约 1.5s / 2 字）、`greeting`（约 2.4s，开场白）、`calm`（约 2.7s，签名/正文）；
- 没有笔顺数据的字自动退化为字体渐显，并在控制台说明缺哪个文件；
- 视口变化、字体加载完成时自动重算 dash 长度，笔画不会画不满或画过头。

## 快速开始

```html
<link rel="stylesheet" href="hanzi-ink.css">
<script src="hanzi-data.js"></script>  <!-- 可选：本地数据包，file:// 下也能用 -->
<script src="hanzi-ink.js"></script>

<p id="intro">你好</p>
<script>
  const el = document.querySelector("#intro");
  HanziInk.paint(el, "intro", { animate: true, pace: "greeting" });
</script>
```

`paint` 会把元素内容替换成逐笔 SVG，并以 `data-rendered="handwriting"` 标记（样式都挂在这个属性下）。
元素原文会保留在 SVG 内的 `.sr-only` 里供读屏器朗读。

单独取 HTML 字符串（不挂 DOM）可以用：

```js
const markup = await HanziInk.handwriting("再见");
```

## API

| 方法 | 说明 |
|---|---|
| `HanziInk.paint(element, id?, { animate = true, pace = "normal" })` | 渲染到元素；`animate:false` 直接显示成品。返回 `Promise<boolean>` |
| `HanziInk.handwriting(text, id?)` | 返回生成的 SVG 字符串（最多 8 个字） |
| `HanziInk.configure({ bundle, data, assetPath })` | 改数据包地址 / 直接注入数据 / 改单字数据地址 |
| `HanziInk.refresh()` | 手动重算所有已渲染笔画的 dash 长度（视口变化时库会自动调用） |

节奏（`pace`）：

| 档位 | perChar | perStroke | duration | 场景 |
|---|---|---|---|---|
| `normal` | 340ms | 80ms | 760ms | 默认 |
| `greeting` | 560ms | 135ms | 1150ms | 开场白 |
| `calm` | 620ms | 150ms | 1300ms | 签名、正文 |

## 数据

仓库自带 10 个常用字：`你 好 再 见 我 是 世 界 中 文`。
加载优先级：`window.HANZI_INK_DATA`（数据包脚本）→ 动态补加载一次数据包 → `fetch(assets/hanzi-<码点>.json)` → 字体兜底。

补更多字：

```bash
node tools/fetch-data.mjs 新年快乐   # 从 hanzi-writer-data CDN 下载到 assets/
node tools/build-data.mjs            # 重新打包出 hanzi-data.js
```

如果只用 `assets/` 下的单字文件（不打包），把 `hanzi-data.js` 那行去掉也可以，库会自动逐个 `fetch`。

## 实现要点

- **中线而非轮廓**：取数据里的 `medians`，用 Catmull-Rom 转成三次贝塞尔，等粗描边。想要带笔锋的毛笔字，
  应该改用 `strokes` 轮廓填充 —— 那是另一种形态，本库刻意不做。
- **dash 长度必须在 dash 的坐标空间里量**：`vector-effect: non-scaling-stroke` 会让
  `stroke-dasharray / dashoffset` 按最外层 CSS 像素解释，而 `getTotalLength()` 返回的是本地用户单位
  （本项目 1000 单位格子里约差 11 倍）。直接用本地长度的话，每笔只会在动画前 9% 里被擦出来。
  见 `hanzi-ink.js` 的 `dashLength()`。
- **布局依赖**：dash 长度随 CTM 变化，所以视口 resize 与字体加载完成都要重算。

## 目录

```
hanzi-ink.js         渲染器（无依赖）
hanzi-ink.css        描边与逐笔揭示样式
hanzi-data.js        数据包（由 tools/build-data.mjs 生成）
assets/              单字笔顺数据 hanzi-<码点>.json
tools/fetch-data.mjs 下载指定汉字的笔顺数据
tools/build-data.mjs 打包数据包
demo/index.html      可直接双击打开的示例
```

## 许可与致谢

- **代码**（`hanzi-ink.js` / `hanzi-ink.css` / `tools/` / `demo/`）：[MIT](LICENSE)
- **笔顺数据**（`assets/hanzi-*.json`、`hanzi-data.js`）：来自
  [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) /
  [Make Me A Hanzi](https://github.com/skishore/makemeahanzi)，提取自文鼎科技（Arphic Technology）的字体，
  受 **Arphic Public License** 约束，全文见 [ARPHICPL.TXT](ARPHICPL.TXT)。
  再分发数据时请保留该许可证与出处说明。
