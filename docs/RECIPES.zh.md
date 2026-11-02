# App Kit 实用示例

语言：[English](RECIPES.md) · [Bahasa Indonesia](RECIPES.id.md) · **中文**

可直接复制的简短答案。页面代码片段都假定已有
`const kit = await startKit({...}); const { booth, t, cfg } = kit;`（见 [GUIDE.zh.md](GUIDE.zh.md) §5）。

---

### 1. 显示活动的模板及其封面

```js
booth.on('templates', list => {
  grid.replaceChildren(...list.map(tp => {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `<div class="pic">${tp.name.charAt(0)}</div><b></b>`;
    card.querySelector('b').textContent = tp.name;
    const img = new Image();
    img.onload = () => { card.querySelector('.pic').textContent = ''; card.querySelector('.pic').style.backgroundImage = `url("${img.src}")`; };
    img.src = booth.coverUrl(tp.id);   // 404 when the booth app sends no cover (API 1.0): the letter stays
    card.onclick = () => booth.startWithTemplate(tp.id);
    return card;
  }));
});
```

### 2. 用应用选出的模板开始拍摄流程

```js
const r = await booth.startWithTemplate(winner.id);
if (!r.ok) showError(r.error.code);   // recipe 11
```

从 Welcome 开始时，拍照亭应用会先执行它的 Start 关卡（PIN / 支付），然后直接进入该模板；
如果当前在选择页，套件会先回到 Welcome。绝不要自己用 `session/start` + 按 index 的 `template/select`：
那张卡片可能不在屏幕上。

### 3. 只在 Welcome 上出现，交接后再停留片刻

`app.json`：`"window": { "mode": "overlay", "showOn": ["welcome"] }`。

```js
fx.burst(x, y, 150); sound.fanfare();
booth.hold(1500);                       // the overlay stays 1.5 s after the booth app left Welcome
await booth.startWithTemplate(id);
```

### 4. 响应拍照亭应用的流程

```js
booth.on('page', ({ to }) => { if (to === 'result') say('Nice photo!'); });
booth.on('phase', ({ to, camera }) => {
  if (to === 'counting') sound.count();                       // the countdown started
  if (to === 'reveal') console.log(`shot ${camera.shot} of ${camera.shots}`);
  if (to === 'review') console.log('all shots taken');
});
booth.on('session', ({ active, template }) => { if (!active) resetMyGame(); });
```

要在拍照过程中显示在屏幕上，把 `camera` 加入 `showOn`（并保持实时取景可见：只遮住一个角或一条边，
或者在另一块屏幕上使用 `window` 模式）。

### 5. 你自己的按钮按下拍照亭应用的按钮（仅当拍照亭应用接受时）

```js
booth.on('state', () => { captureBtn.disabled = !booth.can('camera/capture'); processBtn.hidden = !booth.can('camera/process'); });
captureBtn.onclick = () => booth.send('camera/capture');
processBtn.onclick = () => booth.send('camera/process');
```

在 app.json 中使用 `"mock": { "auto": false }`，让模拟器等待这些按键。

### 6. 在结果页上显示内容（打印、二维码、致谢）

`showOn: ["result"]`，然后只遮住屏幕的一部分（结果照片属于拍照亭应用；要在你自己的布局中显示它：见第 16 条）：

```js
printBtn.hidden = !booth.can('result/print');
printBtn.onclick = () => booth.send('result/print');
qrBtn.onclick = () => booth.send('result/qr', { type: 'web' });   // opens the booth app's QR dialog: the overlay hides
```

### 7. 第二屏应用（排队、待机循环、统计）

`"window": { "mode": "window", "showWhenNoEvent": true }`：一个普通的全屏窗口，始终显示；
在 设置 → 屏幕 中选择显示器。读取 `booth.state.page`、`session`、`camera` 来
显示拍照亭正在做什么。

### 8. 添加一个设置并使用它

`app.json`：

```json
"settings": [
  { "key": "rounds", "type": "int", "default": 3, "min": 1, "max": 9, "label": { "en": "Rounds", "id": "Ronde", "zh": "回合" } },
  { "key": "theme", "type": "enum", "default": "candy", "options": [["candy", "Candy"], ["neon", "Neon"]], "label": { "en": "Look", "id": "Tampilan", "zh": "外观" } },
  { "key": "apiToken", "type": "secret", "default": "", "public": false, "label": { "en": "Service token", "id": "Token layanan", "zh": "服务令牌" } }
]
```

页面：`cfg.rounds`、`cfg.theme`。服务器代码：`kit.cfg().apiToken`（密钥绝不会到达页面）。

### 9. 服务器代码：统计拍摄次数、保存文件、添加接口

```js
// apps/<id>/server.js
import fs from 'node:fs';
import path from 'node:path';
export default function (kit) {
  const file = path.join(kit.dataDir, 'stats.json');   // the app folder in development, next to the exe when packaged
  const stats = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { sessions: 0 }; } })();
  kit.watch.on('session', ({ active }) => { if (active) { stats.sessions++; fs.writeFileSync(file, JSON.stringify(stats)); } });
  kit.route('GET', '/myapp/stats', (req, res, { json }) => json(200, stats));
}
```

绝不要写入拍照亭应用的文件夹。

### 10. 你自己的音乐

```js
const sound = new Sound({ song: {
  bpm: 100,
  chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]],   // Am F C G (midi)
  bass:   [33, 29, 36, 31],
  melody: [[69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0], [65, 0, 0, 69, 0, 0, 72, 0, 0, 0, 69, 0, 0, 0, 0, 0],
           [72, 0, 0, 76, 0, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0], [71, 0, 0, 74, 0, 0, 79, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
} });
```

或者用文件：`new Audio('loop.mp3')` 并设置 `loop = true`（把文件放进 `public/`）。

### 11. 用通俗的话显示错误

```js
const ERR = {
  en: { dialog_open: 'Please finish the window on the booth screen first', busy: 'One moment…', processing: 'Your photo is being made, one moment',
        no_event: 'The booth is not running', wrong_page: 'Not now, try again', offline: 'The booth is not answering', unknown_template: 'That theme is gone' },
};
function showError(code) { toast(ERR[kit.lang]?.[code] || ERR.en[code] || code); }
```

### 12. 给设计师导出封面（在应用之外）

```bash
node tools/covers.mjs                              # the booth app's events (through its Local API)
node tools/covers.mjs "Wedding" --out D:\covers\wedding
```

### 13. 在各种比例下给应用截图（屏幕上不出现窗口）

运行 `node tools/serve.mjs <app> --mock`，然后通过 DevTools 协议使用无头 Chrome：
`Emulation.setDeviceMetricsOverride { width, height }` → `Page.navigate` → 等待 → `Page.captureScreenshot`。
分别截 1920×1080、1080×1920、1080×1350、2560×1080。用
`Runtime.evaluate("window.__qbk.settings()")` 打开设置。

### 14. 同时运行两个应用

每个 app.json 中使用不同的 `port`，如果两个都是 overlay：给它们设置不同的 `showOn` 页面（例如一个在
`welcome`，一个在 `result`），或者把其中一个设为 `window` 模式放在第二块屏幕上。

### 15. 开发时在终端中跟踪拍照亭应用

```bash
node tools/qb.mjs watch --app <id>     # page / phase / session changes as they happen
```

### 16. 显示宾客的成品（照片 / 视频）

```js
// app.json: "showOn": ["result"] (or "window" mode on a second screen)
booth.on('result', async () => {                          // a new guest's results are ready
  const r = await booth.result();
  if (!r.ok) return;                                      // no_result (the next guest started) / not_found (API 1.0)
  gallery.replaceChildren(...r.data.items.map(it => {
    const el = document.createElement(it.kind === 'video' ? 'video' : 'img');
    if (it.kind === 'video') Object.assign(el, { autoplay: true, loop: true, muted: true, playsInline: true, poster: it.thumbUrl });
    el.src = it.url;                                      // = booth.resultFileUrl(it.index); thumbnail: it.thumbUrl
    return el;
  }));
});
```

需要 Local API 1.1 的拍照亭应用（5.9.2.0 之后的版本）。只能读取最近一位宾客的成品，直到下一位宾客开始。
URL 指向你的应用自己的服务器（页面中没有密码；视频可以拖动进度）。
显示成品即可，不要保存（GUIDE 第 12 节“宾客的数据”）。
