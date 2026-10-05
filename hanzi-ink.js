/* hanzi-ink：用 hanzi-writer-data（源自 Make Me A Hanzi）的真实笔顺数据，把汉字"一笔一笔写出来"。
 *
 * 画法：只取 medians（笔画中线），Catmull-Rom 转平滑贝塞尔后**等粗细描边** —— 刻意保留这种没有笔锋、
 * 略带稚拙感的手写形态。逐笔揭示：把每条中线的 stroke-dashoffset 从自身长度动画到 0，
 * 沿笔迹方向一笔一划写出来。
 *
 * 用法：
 *   <link rel="stylesheet" href="hanzi-ink.css">
 *   <script src="hanzi-data.js"></script>   <!-- 可选：本地数据包，file:// 下也能用 -->
 *   <script src="hanzi-ink.js"></script>
 *   <script>
 *     const el = document.querySelector("#intro");
 *     HanziInk.paint(el, "intro", { animate: true, pace: "greeting" });
 *   </script>
 *
 * 数据加载优先级：window.HANZI_INK_DATA（数据包脚本）→ 动态补加载一次数据包 →
 *   fetch(assets/hanzi-<码点>.json) → 都没有则退化为字体兜底，并在控制台说明缺哪个文件。
 *   file:// 直接打开时 fetch 会被 CORS 拦截，所以推荐带上数据包脚本。
 *
 * 数据来源与许可：渲染代码 MIT；笔顺数据来自 hanzi-writer-data / Make Me A Hanzi，
 *   提取自 Arphic Technology 的字体，受 Arphic Public License 约束（仓库根目录 ARPHICPL.TXT）。
 */
(function (root) {
  "use strict";
  const dataCache = new Map();
  // 中线描边宽度（1000 单位坐标系）。配合 vector-effect:non-scaling-stroke 保持视觉粗细恒定。
  const STROKE_WIDTH = 3.4;
  // 书写节奏。数值含义：perChar 每个字延后多久起笔，perStroke 同一字内每笔间隔，duration 单笔描完所需时间。
  // 总时长 = (字数-1)*perChar + (末字笔数-1)*perStroke + duration，笔与笔是重叠的，不是串行相加。
  // 三档实测（「你好」13 笔）：normal 约 1.5s、greeting 约 2.4s、calm 约 2.7s。
  //   greeting：开场白专用，整段只在开屏后露一次面，值得慢一点让人看清笔顺。
  //   calm：尾页签名等需要降低阅读负荷的位置。
  const PACES = {
    normal: { perChar: 340, perStroke: 80, duration: 760 },
    greeting: { perChar: 560, perStroke: 135, duration: 1150 },
    calm: { perChar: 620, perStroke: 150, duration: 1300 }
  };
  const settings = {
    bundle: "hanzi-data.js",                                  // 数据包脚本地址
    data: null,                                               // 直接注入数据对象（测试用）：{ "4f60": {...} }
    assetPath: (code) => `assets/hanzi-${code}.json`          // 单字数据地址
  };

  function configure(options) {
    Object.assign(settings, options || {});
  }
  function bundledStroke(code) {
    const bundle = settings.data || root.HANZI_INK_DATA;
    if (!bundle || typeof bundle !== "object") return null;
    const value = bundle[code];
    return value && Array.isArray(value.medians) && value.medians.length ? value : null;
  }
  // 数据包正常由 <script> 带进来。若没带进来（例如浏览器用了缓存的旧页面），这里补一次动态加载 ——
  // 脚本标签在 file:// 下不受限制，能救回手写效果；否则就会静默退化成字体兜底。
  let bundlePromise = null;
  function ensureBundle() {
    if (settings.data || (root.HANZI_INK_DATA && typeof root.HANZI_INK_DATA === "object")) return Promise.resolve();
    if (!bundlePromise) {
      bundlePromise = new Promise((resolve) => {
        if (typeof document === "undefined") { resolve(); return; }
        const script = document.createElement("script");
        script.src = settings.bundle;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }
    return bundlePromise;
  }
  async function loadStroke(char) {
    const code = char.codePointAt(0).toString(16).toLowerCase();
    if (dataCache.has(char)) return dataCache.get(char);
    await ensureBundle();
    const bundled = bundledStroke(code);
    if (bundled) { dataCache.set(char, bundled); return bundled; }
    try {
      const response = await fetch(settings.assetPath(code));
      if (!response.ok) { dataCache.set(char, null); return null; }
      const data = await response.json();
      dataCache.set(char, data);
      return data;
    } catch { dataCache.set(char, null); return null; }
  }
  // 中线是离散采样点，直接用会显得折线感重；用 Catmull-Rom 转成平滑贝塞尔。
  function smoothPath(points) {
    const unique = points.filter((point, index) => index === 0 || Math.abs(point[0] - points[index - 1][0]) > 0.5 || Math.abs(point[1] - points[index - 1][1]) > 0.5);
    if (unique.length < 2) return "";
    if (unique.length === 2) return `M ${unique[0][0]} ${unique[0][1]} L ${unique[1][0]} ${unique[1][1]}`;
    let path = `M ${unique[0][0]} ${unique[0][1]}`;
    for (let i = 0; i < unique.length - 1; i += 1) {
      const p0 = unique[i - 1] || unique[i];
      const p1 = unique[i];
      const p2 = unique[i + 1];
      const p3 = unique[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
    }
    return path;
  }
  // 逐笔揭示用的 dash 长度，必须量在 **dash 所在的坐标空间**里。
  // 坑：`vector-effect: non-scaling-stroke` 会让 stroke-dasharray / stroke-dashoffset 按最外层坐标空间
  // （即 CSS 像素）解释，而 getTotalLength() 返回的是路径本地用户单位，两者相差一个 CTM 缩放
  // （124 单位格子里约 11 倍）。若直接把用户长度当 dash 长度，dash 会比整条笔迹还长 11 倍，
  // 于是每笔只在动画**前 9%** 的时间里被擦出来、其余 91% 空转 —— 症状是"墨迹提前一半时间就饱和、
  // 时间轴还在走但画面不动"。乘上 CTM 缩放即可让 dash 长度与笔迹实长一致。
  function dashLength(stroke) {
    const userLength = stroke.getTotalLength();
    const matrix = typeof stroke.getScreenCTM === "function" ? stroke.getScreenCTM() : null;
    if (!matrix) return userLength;
    const scale = Math.hypot(matrix.a, matrix.b);
    return scale > 0 ? userLength * scale : userLength;
  }
  // 笔序信息挂在路径自身的 data 属性上，paint() 据此算每笔的动画区间。
  function strokeMarkup(data, charOrder) {
    const medians = Array.isArray(data.medians) ? data.medians : [];
    const paths = medians.map((points, index) => {
      const centerline = smoothPath(points);
      return centerline ? `<path class="handwriting-stroke" d="${centerline}" data-char-order="${charOrder}" data-stroke="${index}"/>` : "";
    }).filter(Boolean);
    return paths.length ? paths : null;
  }
  async function handwriting(text, id) {
    const characters = [...text];
    if (!characters.length || characters.length > 8) return "";
    const cell = 124;
    const gap = 28;
    const scale = cell / 1000;
    const width = characters.length * cell + (characters.length - 1) * gap;
    const height = cell;
    const safe = characters.map((character) => character.replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])));
    const fallback = (character, offset, index) => {
      // 退化成字体兜底会让手写效果看起来像普通宋体。说清病因，避免"它就是不更新"这种难查的症状。
      if (typeof console !== "undefined" && console.warn) console.warn(`[hanzi-ink] 缺少「${character}」的笔顺数据（${settings.assetPath(character.codePointAt(0).toString(16).toLowerCase())}），已退化为字体兜底。可用 tools/fetch-data.mjs 补齐。`);
      return `<g class="handwriting-fallback" transform="translate(${offset} 0)" data-char-order="${index}"><text class="handwriting-fallback-text" x="${cell / 2}" y="${cell - 18}" aria-hidden="true">${character}</text></g>`;
    };
    const groups = [];
    await Promise.all(characters.map(async (character, index) => {
      const data = await loadStroke(character);
      const offset = index * (cell + gap);
      const paths = data && strokeMarkup(data, index);
      if (!paths) { groups[index] = fallback(character, offset, index); return; }
      // 原点平移到格子左下角再翻转 Y 轴，使数据里 y 向下的 0..1000 坐标落进单元格。
      groups[index] = `<g class="handwriting-ink" transform="translate(${offset} ${cell}) scale(${scale} ${-scale})" data-char-order="${index}">${paths.join("")}</g>`;
    }));
    return `<span class="sr-only">${safe.join("")}</span><svg class="handwriting" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safe.join("").replace(/"/g, "&quot;")}" data-handwriting data-char-count="${characters.length}"><g fill="none" stroke="var(--script-ink, #365e48)" stroke-width="${STROKE_WIDTH}">${groups.join("")}</g></svg>`;
  }
  // dash 长度依赖布局（CTM），布局变了就得重算 —— 否则笔画会画不满或画过头。
  // 触发点有两个：视口尺寸变化、字体加载完成导致的行盒变化。
  function refreshDashLengths() {
    for (const host of document.querySelectorAll('[data-rendered="handwriting"]')) {
      for (const stroke of host.querySelectorAll(".handwriting-stroke")) {
        stroke.style.setProperty("--length", dashLength(stroke).toFixed(2));
      }
    }
  }
  let resizeBound = false;
  function bindResize() {
    if (resizeBound || typeof window === "undefined" || !window.addEventListener) return;
    resizeBound = true;
    let timer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(refreshDashLengths, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshDashLengths).catch(() => {});
  }
  async function paint(element, id, { animate = true, pace = "normal" } = {}) {
    const timing = PACES[pace] || PACES.normal;
    const text = element.textContent.trim();
    if (element.dataset.loading === text) return true;
    element.dataset.loading = text;
    let markup;
    try { markup = await handwriting(text, id); } catch { element.dataset.loading = ""; return false; }
    element.dataset.loading = "";
    if (!markup) return false;
    element.innerHTML = markup;
    element.dataset.rendered = "handwriting";
    // 路径长度只有进 DOM 后才量得准，用它算出每笔的动画区间，交给 CSS 动画执行。
    for (const stroke of element.querySelectorAll(".handwriting-stroke")) {
      const length = dashLength(stroke);
      const charOrder = Number(stroke.dataset.charOrder || 0);
      const strokeIndex = Number(stroke.dataset.stroke || 0);
      stroke.style.setProperty("--length", length.toFixed(2));
      stroke.style.setProperty("--duration", `${timing.duration}ms`);
      stroke.style.setProperty("--delay", `${charOrder * timing.perChar + strokeIndex * timing.perStroke}ms`);
    }
    element.classList.toggle("handwriting-instant", !animate);
    bindResize();
    return true;
  }

  root.HanziInk = Object.freeze({ handwriting, paint, configure, refresh: refreshDashLengths });
})(globalThis);
