# App Kit 指南

语言：[English](GUIDE.md) · [Bahasa Indonesia](GUIDE.id.md) · **中文**

App Kit 是一个基础框架，用来开发通过拍照亭应用的 Local API **配合**其正在运行的活动工作的应用：
选主题的转盘、拍照前的小游戏、语音主持、第二块显示器上的画面、计数器、打印队列，什么都可以。
这类应用都需要的底层工作由套件完成，所以一个应用只需要关心它自己的创意：

- 与拍照亭应用通信（密码保存在服务器端、轮询状态、把变化转换成事件），
- 模板封面（Local API 不提供图片），
- 一个桌面窗口：只在你选定的页面上覆盖在拍照亭应用之上，宾客进入下一步时把屏幕交还给它，
- 操作员设置界面（带 PIN 码）、等待界面、托盘图标、密钥，
- 适配任意屏幕比例的布局、由代码生成的声音、彩纸特效，
- 一个无需真实拍照亭应用就能开发的模拟拍照亭应用、命令行工具，以及 exe 打包。

本文同时面向人类程序员和 AI 代理。Local API 本身请看 [API.zh.md](API.zh.md)，
可直接复制的简短答案请看 [RECIPES.zh.md](RECIPES.zh.md)。AI 代理：另请阅读 [AGENTS.md](../AGENTS.md)。

---

## 1. 快速开始

需要 Windows 10/11 和 Node.js 22（自带 npm）。在套件文件夹中：

```bash
npm install                                  # Electron + the packager (once)
node tools/new-app.mjs quiz "Photo Quiz"     # apps/quiz, from the template
node tools/serve.mjs quiz --mock             # its page in a browser + a fake booth app
#   open http://127.0.0.1:3941/  (the port is printed)
node tools/run.mjs quiz --mock               # the same as the desktop app
node tools/build.mjs quiz                    # dist/Photo Quiz-win32-x64/Photo Quiz.exe
```

`apps/hello` 是一个完整的小应用（把活动的模板显示为带封面的卡片；点一下即开始拍摄流程）。
先读它的四个文件：`app.json`、`public/index.html`、`public/app.js`、`server.js`。

连接真实的拍照亭应用：打开 Settings → Advanced → Local API（Expert mode，专家模式）；然后在你的应用中
按 **S**（或点托盘图标）→ 设置 → 拍照亭：填写端口和密码 → **测试连接** → 保存。

---

## 2. 整体结构

```
 ┌─ the booth app ────────────────┐        ┌─ your app (one exe, or `serve` in a browser) ──────────────┐
 │ event window (kiosk)           │        │ shell/main.js   Electron: window/tray/keys, raises booth app│
 │ Local API  :8730  ◀────────────┼─HTTP───┤ core/server.js  your app's server :39xx                     │
 │ events\<id>\event.json + covers│◀─read──┤   core/watch.js   polls status -> events                    │
 └────────────────────────────────┘  only  │   core/covers.js  covers from the event folder              │
                                           │   <app>/server.js your optional server code                 │
                                           │      ▲ /state /cover /qb/* /booth/* /settings               │
                                           │ page: <app>/public + /kit/*.js (web/)                        │
                                           └──────────────────────────────────────────────────────────────┘
```

- **页面**（你的 HTML/JS）只与它自己的服务器通信，永远看不到 Local API 密码。
- **服务器**（每个应用一个，运行在 127.0.0.1）轮询拍照亭应用、提供封面和设置，并转发操作。
  你自己的服务器代码（可选）运行在它内部。
- **外壳**（Electron）显示页面，并按服务器的指示切换窗口状态（full / setup / hidden）。
  在浏览器中（`serve`）没有外壳：页面相同，但没有窗口规则。

---

### 品牌：QBooth、BleepShare、XBooth

拍照亭应用是同一个程序的三个品牌版本：**QBooth.exe**（报告 "QBooth"）、**BleepShare.exe**
（"BleepShareAI"）和 **XBooth.exe**（"XBooth"），各有自己的安装文件夹（默认 C:\QBoothAIV5、
C:\BleepShareV5、C:\XBoothV5）。Local API 相同。因此：

- **不要在应用界面中写品牌名称。** 在文本中写 `{booth}`：`kit.t()` 会填入所连接的拍照亭应用名称
  （`status.app.name`，"QBooth" 显示为 "Q-Booth"），或操作员的 **品牌名称** 设置，或在尚未连接时
  使用中性词（"the booth app" / "aplikasi booth" / "拍照亭应用"）。`kit.brand` 和 `booth.state.brand` 保存该名称。
- 套件通过 **监听 Local API 端口的进程**（`core/locate.js`）找到拍照亭应用：它的 pid（用于把活动窗口
  提到前面）和它的文件夹（封面）。不猜测任何 exe 或文件夹名称；常用文件夹只是后备。
  `设置 → 拍照亭应用文件夹` 可以覆盖。
- 用模拟器测试其他品牌：在 config.json 中设置 `"mockBrand": "XBooth"`（或 `BleepShareAI`）。

## 3. 文件夹结构

```
App Kit/
  core/          Node modules (no dependencies)
    qbooth.js      Local API client: createClient({ host, port, password })
    watch.js       status polling -> events (page, phase, session, event, templates, busy, online)
    covers.js      covers from <qboothDir>\events\<id> (read only); listEvents, savedTemplates
    server.js      the app server: createAppServer({ appDir, mock }), window modes, endpoints
    settings.js    kit settings fields + app fields -> config.json, settings screen data
    mock.js        a fake booth app (same API), optionally with a real event's templates
    listen.js      listen with retry (a closing old copy may still hold the port)
  shell/         Electron: main.js (the desktop app), winfront.js (raise windows), icon.png / .ico
  web/           browser modules, served at /kit/
    kit.js         startKit(): config, texts, settings, waiting screen, polling   <- start here
    qbooth.js      booth: events, state, send(), startWithTemplate(), coverUrl(), hold()
    layout.js      fit(), place(), contain(): any screen size and ratio
    audio.js       Sound: BGM loop + effects made by code
    fx.js          Fx: confetti and sparkles
    settings-ui.js the operator settings screen (built from the fields)
    kit.css        settings / waiting screen styles, the Fredoka font
    fonts/         Fredoka (SIL Open Font License)
  templates/hello  what new-app copies
  apps/<id>/     your apps
  tools/         serve, run, new-app, build, covers, qb
  docs/          GUIDE, API, RECIPES (en / id / zh)
  AGENTS.md      rules for AI agents
```

---

## 4. 一个应用

```
apps/<id>/
  app.json        name, port, when the window shows, own settings      (required)
  public/         the page: index.html + your JS / CSS / images / sounds (required)
  server.js       your server code                                      (optional)
  icon.ico        the exe icon; icon.png the tray / window icon         (optional, else the kit's)
  config.json     the operator's settings (written by the settings screen; never ship, never commit)
  logs/app.log    the desktop app's log (dev; packaged: next to the exe)
```

### 4.1 `app.json`

```json
{
  "id": "quiz",
  "name": "Photo Quiz",
  "version": "0.1.0",
  "port": 3941,
  "window": {
    "mode": "overlay",
    "showOn": ["welcome"],
    "hideOnDialog": true,
    "showWhenNoEvent": false,
    "background": "#24124a"
  },
  "mock": { "auto": true },
  "settings": [
    { "key": "questions", "type": "int", "default": 3, "min": 1, "max": 10,
      "label": { "en": "Questions", "id": "Jumlah soal", "zh": "题目数量" } }
  ]
}
```

| 键 | 含义 |
|---|---|
| `id` | 文件夹名，小写（`[a-z][a-z0-9-]*`） |
| `name` | 显示在窗口标题、托盘、设置和 exe 文件名中 |
| `port` | 本应用服务器的端口。**每个应用唯一**（两个应用可以同时运行）。套件应用使用 3940 及以上；Avatar 使用 3920-3922，Roulette 使用 3930 |
| `window.mode` | `overlay`：覆盖在拍照亭应用之上，只在 `showOn` 页面显示。`window`：普通全屏窗口，始终显示（第二屏、工作人员屏）。操作员可在 设置 → 屏幕 中切换 |
| `window.showOn` | 你的应用要覆盖的拍照亭应用页面：`welcome`、`categoryPicker`、`templatePicker`、`camera`、`result`……（见 API.zh.md） |
| `window.hideOnDialog` | 拍照亭应用显示对话框（Start PIN、支付、二维码、警告）时隐藏：**保持 true**，除非你的应用要取代那个对话框 |
| `window.showWhenNoEvent` | 没有活动运行时也显示（默认 false：让操作员的拍照亭应用保持可用） |
| `window.background` | 页面绘制完成前的窗口颜色 |
| `mock.auto` | 选定模板后，模拟器自动完整走完一次拍摄流程（true），或等待你的 capture / process 命令（false） |
| `settings` | 你自己的设置字段（第 7 节） |
| `shortcuts` | 你的应用自己的快捷键，显示在 设置 → 快捷键 中：`[{ "keys": "Space", "label": { "en": "Spin", "id": "Putar", "zh": "转" } }]` |

### 4.2 页面

`public/index.html` 加载你的模块；你的模块启动套件：

```js
import { startKit } from '/kit/kit.js';
const kit = await startKit({ texts: { en: { hi: 'Hello {name}!' }, id: { hi: 'Halo {name}!' }, zh: { hi: '你好 {name}!' } } });
const { booth, t, cfg } = kit;

booth.on('templates', list => draw(list));          // the running event's templates
booth.on('page', ({ to }) => console.log('the booth app is on', to));
document.querySelector('#go').onclick = () => booth.startWithTemplate(list[0].id);
```

复制模板 index.html 中的 Content-Security-Policy `<meta>`（从 'self' 开始的全部内容）。

---

## 5. 页面 API（`/kit/…`）

### 5.1 `startKit(options)` → `kit`

| | |
|---|---|
| `options.texts` | `{ en: {...}, id: {...}, zh: {...} }` 你的文本 |
| `options.waiting` | `true`（默认）：当拍照亭应用无法访问或没有运行活动时，套件用“正在等待{booth}…”和一个设置按钮遮住你的页面。`false`：自己绘制（使用 `booth.state.online` / `.event`） |
| `kit.cfg` | 公开设置：`language`、`overlay`、你的字段（非密钥且 `public` 不为 false），以及 `app`、`mock`、`desktop` |
| `kit.lang` / `kit.t(key, vars)` | `en` \| `id` \| `zh`；`key` 对应的文本（找不到时回退到英文，再回退到 key 本身），`{name}` 由 vars 填充 |
| `kit.booth` | 见 5.2 节 |
| `kit.onShown(fn)` | 桌面窗口已显示（`true`）或已隐藏（`false`）：开始 / 停止音乐、重置你的画面 |
| `kit.shown` | 当前是否显示？ |
| `kit.settings.open()` | 打开操作员设置 |
| `kit.fit / place / contain` | 布局（5.4） |

### 5.2 `booth`（`web/qbooth.js`）

| | |
|---|---|
| `booth.on('state', fn)` | 每次轮询（约 300 ms）：`{ online, error, mode, overlay, event, page, session, camera, result, busy, available, templates }` |
| `booth.on('page', fn)` | `{ from, to }` 拍照亭应用的页面变了 |
| `booth.on('phase', fn)` | `{ from, to, camera }` 相机阶段：`liveIdle` `counting` `capturing` `reveal` `shotDelay` `review` |
| `booth.on('session', fn)` | `{ active, template: { id, name } \| null }` 一次拍摄流程开始 / 结束 |
| `booth.on('event', fn)` | `{ event: { id, name } \| null }` |
| `booth.on('templates', fn)` | `[{ id, name, index, onScreen, categoryId }]` 正在运行的活动中宾客可选的模板 |
| `booth.on('busy', fn)` | `{ dialog, processing }` |
| `booth.on('online' / 'offline', fn)` | Local API 有响应 / 无响应 |
| `booth.state` | 最近一次状态 |
| `booth.can(action)` | 该操作当前是否在 `available` 中 |
| `await booth.send(action, params)` | 任意 Local API 操作（`'camera/capture'`、`'template/select', { id }` ……）→ `{ ok, accepted }` 或 `{ ok: false, error: { code } }`。`event/start` / `event/stop` 需要设置 PIN 码：仅限操作员 |
| `await booth.startWithTemplate(id)` | 无论拍照亭应用当前在哪个页面，都用该模板开始一次拍摄流程（Welcome：直接开始；选择页：先回到 Welcome） |
| `await booth.read('events' \| 'templates' \| 'categories', params)` | 读取 |
| `booth.coverUrl(templateId)` | `/cover/<id>`：封面图片，本机没有封面时返回 404（显示占位图） |
| `booth.categoryCoverUrl(id)`, `booth.eventCoverUrl()` | 分类 / 活动封面 |
| `booth.hold(ms)` | 拍照亭应用切走后让覆盖层再保留 ms 毫秒（≤ 20 s）：把庆祝动画播完 |

### 5.3 封面

```js
const img = new Image();
img.onload = () => card.style.backgroundImage = `url("${img.src}")`;
img.onerror = () => card.textContent = name.charAt(0);   // no cover here: a placeholder
img.src = booth.coverUrl(template.id);
```

封面来源：见第 8 节。

### 5.4 适配任意屏幕的布局（`web/layout.js`）

```js
kit.fit(({ W, H, u, land }) => {
  // W, H: window size; u: 1% of the short side (also CSS var(--u)); land: W / H >= 1.08
  const size = land ? Math.min(H * 0.8, W * 0.5) : Math.min(W * 0.9, H * 0.5);
  kit.place(wheel, land ? W * 0.05 : (W - size) / 2, land ? (H - size) / 2 : H * 0.12, size, size);
});
```

让应用在每种拍照亭屏幕（16:9、9:16、4:5、1:1、21:9）上都显示正确的规则：
- 所有尺寸都基于 `u`、`W`、`H`（CSS：`calc(var(--u) * 4)`），绝不用固定像素；
- 按 `land` 选择排列方式（左右并排或上下堆叠）；屏幕较矮时把元素排成一行；
- 先算出必须容纳的内容（例如卡片高度 + 按钮），再反推尺寸（参见 `apps/hello` 的网格）；
- 至少测试 1920×1080、1080×1920、1080×1350 和 2560×1080（10.3 节）。

### 5.5 声音（`web/audio.js`）和彩纸（`web/fx.js`）

```js
import { Sound } from '/kit/audio.js';
const sound = new Sound();                       // or new Sound({ song: { bpm, chords, bass, melody } })
sound.init({ bgmVolume: kit.cfg.bgmVolume ?? 60, sfxVolume: kit.cfg.sfxVolume ?? 80 });
kit.onShown(v => v ? sound.startBgm() : sound.stopBgm());
addEventListener('pointerdown', () => sound.resume());  // browsers need one tap before audio
sound.pop(); sound.tick(); sound.whoosh(); sound.count(); sound.go(); sound.fanfare(); sound.error();
sound.duck(true);                                // music quieter under a long effect

import { Fx } from '/kit/fx.js';
const fx = new Fx(canvasCoveringTheScreen);       // pointer-events: none
(function f(t) { fx.step(1 / 60, t / 1000); requestAnimationFrame(f); })(0);
fx.burst(x, y, 150); fx.rain(120);
```

全部由代码生成：不涉及任何授权。使用自己的音频文件：把它们放进 `public/`，用
`new Audio('click.mp3')` 播放（支持 mp3 / wav / ogg）。

---

## 6. 你的服务器代码（`<app>/server.js`，可选）

用于页面做不到的事：计数、记录日志、在拍照亭文件夹之外写文件、调用其他服务、
在没有打开页面时响应拍照亭应用、添加接口。

```js
export default function (kit) {
  kit.watch.on('session', ({ active, template }) => { if (active) kit.log('started', template.name); });
  kit.watch.on('phase', ({ to }) => { if (to === 'review') kit.log('photo taken'); });
  kit.route('POST', '/quiz/answer', async (req, res, { body, json }) => {
    const { choice } = await body();
    json(200, { ok: true, right: choice === 2 });
  });
}
```

| `kit.` | |
|---|---|
| `cfg()` | 当前设置（包括密钥：绝不要发给页面） |
| `client` | Local API 客户端（`core/qbooth.js`）：`status()`、`templates()`、`send(cmd, params)`、`selectTemplate(id)`、`capture()`…… |
| `watch` | 轮询器（`core/watch.js`）：`on('page' \| 'phase' \| 'session' \| 'event' \| 'templates' \| 'busy' \| 'online' \| 'offline' \| 'status')`、`state` |
| `startWithTemplate(id)` | 与页面中的相同 |
| `covers` | `core/covers.js` |
| `route(method, path, handler)` | 你的接口；`path` 可以以 `*` 结尾；handler 为 `(req, res, { url, body(), json(code, obj) })`。路径请以你的应用 id 作前缀 |
| `log(...)` | 输出到控制台 / `logs/app.log` |
| `manifest` | app.json |
| `appDir` / `dataDir` | 应用文件夹 / 存放你自己文件的位置（开发时是应用文件夹，打包后在 exe 旁边：更新后仍会保留） |

---

## 7. 设置

操作员可以通过 **S**、**托盘图标**、**Ctrl+Alt+Shift+S**，或长按左上角 3 秒打开设置
（如果设置了 PIN 码，会先要求输入）。标签页：**拍照亭**（标题为拍照亭应用的名称；地址、端口、密码 + 测试连接、
拍照亭应用文件夹、测试模式），**你的应用**（语言 + 你的字段），**屏幕**（覆盖层、屏幕、隐藏 / 显示、快捷键），
**安全**（PIN 码）。

你的字段写在 `app.json` → `settings` 中：

| 字段键 | |
|---|---|
| `key` | 配置键（点号表示嵌套：`game.rounds`） |
| `type` | `string`、`int`（`min`、`max`）、`bool`、`enum`（`options: [[value, label]]`，label 可以是字符串或 `{ en, id, zh }`）、`range`（0-100 滑块）、`secret`（只写：绝不发送给页面，也不回显到设置界面；留空 = 保持不变） |
| `default` | 没有 config.json 时的值 |
| `label`, `hint` | `{ en, id, zh }` |
| `tab` | `app`（默认）、`booth`、`screen`、`security` |
| `public` | 默认 `true`：页面可在 `kit.cfg` 中读取。仅限服务器使用的值设为 `false` |
| `restart` | 保存它会重启桌面应用 |

`config.json` 只保存操作员修改过的内容：开发时在 `apps/<id>/` 中，打包后**在 exe 旁边**
（更新会替换应用文件夹，但设置会保留）。它包含 Local API 密码：绝不要提交到 git，
绝不要放进安装包或截图里。

---

### 菜单按钮与快捷键页

- **菜单按钮始终置顶**（设置 → 屏幕，默认关闭；位置：右上 / 左上 / 右下 / 左下）：一个独立的小 ☰
  窗口（`shell/fab.js`，页面 `web/fab.html`），在所有窗口之上，应用隐藏时也显示。点击 →
  `POST /app/menu` → 设置（先输入 PIN）。客人也看得到：操作员需要时再打开，并用 PIN 保护设置。
  无需重启即生效。
- **快捷键页**：进入应用的所有方式（上面的按键、托盘图标、左上角、菜单按钮、再次打开 exe 等），
  以所选语言显示，然后是 `app.json` → `shortcuts` 中应用自己的按键。

## 8. 封面

Local API 只返回模板的 id 和名称，不返回图片。套件从**同一台电脑上**拍照亭应用自己的活动文件夹中读取封面，
只读：

1. `<qboothDir>\events\<eventId>\event.json` → `templates[].cover`（活动文件夹中的一张图片），
2. 否则读取模板文件 `templates[].path`（`.qso` / `.qsc`，JSON）→ `event_info.preview_image[0].mBase64`，
3. 都没有：绘制占位图（首字母、一种颜色）。

`qboothDir` 默认留空：自动找到占用 Local API 端口的拍照亭应用并使用其文件夹（设置 → 拍照亭）。分类封面：`categories[].cover`；
活动本身的封面：`coverImage`。

- 页面：`booth.coverUrl(id)`。服务器：`kit.covers.coverOf(dir, eventId, templateId)` → `{ type, data, from }`。
- 命令行：`node tools/covers.mjs` 列出活动；`node tools/covers.mjs "<event name | id>" --out <folder>`
  导出全部封面（`01_<name>.jpg` …）+ `manifest.json`。
- 运行在**另一台电脑**上的应用（通过拍照亭应用的 Allow LAN）无法访问这些文件：封面返回 404。
  设计时要考虑占位图。（已向拍照亭应用的开发者提议在 Local API 中增加 `GET templates/{id}/cover`。）
- **绝不要写入拍照亭应用的文件夹。** 封面工具会拒绝位于其中的 `--out`。

---

## 9. 窗口（桌面应用）

| 模式 | 何时 | 表现 |
|---|---|---|
| `full` | overlay：有活动在运行、拍照亭应用的页面在 `showOn` 中、没有拍照亭应用的对话框（或调用了 `booth.hold()`）；window 模式：始终 | 在选定的屏幕上全屏；overlay = 位于拍照亭应用的 kiosk 窗口之上（每 1.5 秒重新置顶一次） |
| `setup` | 无法连接拍照亭应用 / 密码错误 | 居中的普通窗口，不置顶，显示套件的等待界面和设置按钮 |
| `hidden` | 其他所有情况：拍照亭应用自己的页面、拍照亭应用的对话框、没有活动 | 隐藏；**先把拍照亭应用的活动窗口提到前台**（`shell/winfront.js`），这样操作员之前切换到的窗口永远不会挡住拍照亭 |

打开设置时，无论处于哪种模式，窗口都会全屏显示。操作员快捷键（任何地方均可）：
**Ctrl+Alt+Shift+S** 设置，**Ctrl+Alt+Shift+H** 隐藏 / 显示，**Ctrl+Alt+Shift+Q**
退出；窗口获得焦点时还有 F12 开发者工具和 Ctrl+Q。托盘图标显示状态，并提供
设置 / 隐藏-显示 / 退出。再次打开 exe 会在已运行的实例中打开设置。每个应用同时只能运行一个实例。

只有当活动禁止 Alt-Tab 时，拍照亭应用的 kiosk 窗口才是“始终置顶”的。覆盖层使用更高的
“screen-saver”层级并自行置顶；隐藏时它会把拍照亭应用的窗口提到前台（它最大的、可见的、
且不是主窗口“<Brand> - Version …”的窗口）。日志中会显示 `front: qbooth ok |
refused | none`。

---

## 10. 测试

### 10.1 模拟拍照亭应用（mock）

`--mock`（或 设置 → 拍照亭 → 测试模式）会在 8749 端口启动 `core/mock.js`：API、页面、阶段和错误都相同。
把 **测试模式：借用活动** 设为 `<qboothDir>\events` 中的某个活动 id（列表：`node tools/covers.mjs`），
模拟器就会使用它的模板，封面也就是真实的。app.json 中的 `mock.auto`：拍摄流程自动进行，或等待你的命令。

仅限模拟器的调用（用于测试）：`POST /api/v1/mock/dialog {on}`（一个拍照亭应用的对话框），`POST
/api/v1/mock/event {on}`（启动 / 停止活动）。密码为 `mock`。

### 10.2 命令行

```bash
node tools/qb.mjs status --mock                 # or --app quiz (its config) or --host/--port/--password
node tools/qb.mjs send template/select '{"index":2}' --mock
node tools/qb.mjs watch --app quiz              # every change, live: page, phase, session ...
```

### 10.3 不使用屏幕

`node tools/serve.mjs <app> --mock` 加一个无头浏览器（Chrome DevTools 协议）：设置
视口（1920×1080、1080×1920……），打开页面，`Page.captureScreenshot`。用
`Runtime.evaluate` 驱动它（`window.__qbk.settings()`、点击）。要在不显示窗口的情况下测试桌面应用，
把它指向一个**没有运行活动**的 Local API（窗口保持隐藏），然后用 `POST /app/quit` 退出。

**绝不要在别人正在使用的屏幕上打开测试窗口**，并停止你启动的每一个服务器。

---

## 11. 构建与发布

```bash
node tools/build.mjs <app>     # dist/<Name>-win32-x64/<Name>.exe (about 360 MB, Electron included)
```

- exe 文件夹是自包含的（无需安装）。`config.json` 和 `logs\` 会出现在 exe 旁边。
- 绝不能放进安装包的：`config.json`、`logs`、应用的 `node_modules`（构建时会跳过它们）。
- 打 zip 包时，先检查里面没有 `config.json`，再压缩文件夹（使用 PowerShell 的
  `[IO.Compression.ZipFile]::CreateFromDirectory`；用 `tar` 生成的 zip64 在 Windows 上无法打开）。
- `--no-asar`：修复可以直接复制到已构建应用的 `resources\app\` 中。
- exe 要求未设置 `ELECTRON_RUN_AS_NODE`；有些开发者 shell 会设置它（这时 exe 会悄无声息地
  以 Node 方式运行）。`tools/run.mjs` 会移除它；资源管理器从不设置它。

---

## 12. 规则（拍照亭应用的和我们的）

1. **一个命令 = 宾客的一次按键。** 绝不要提供拍照亭应用此刻不会接受的操作：检查
   `booth.can(...)` / `available`。
2. **绝不跳过任何界面或关卡。** Start PIN、支付、打印限制属于拍照亭应用；API 会保留它们，
   你的应用不得绕过。
3. **对话框属于拍照亭应用。** 保持 `hideOnDialog: true`；在 `busy.dialog` 期间所有操作都会失败。
4. **密钥留在服务器端。** Local API 密码和你的 `secret` 字段绝不能出现在页面、日志、截图或 git 中。
5. **拍照亭应用的文件夹是只读的。** 绝不要写入 `C:\QBoothPro`（或 `qboothDir`）。
6. **宾客的数据。** 除非应用的用途需要且操作员知情，否则不要保存照片、声音或人脸。
7. **每个应用一个端口**，且唯一（app.json）。
8. **套件是共享的。** 只有当某个改动是所有应用都需要的时候，才修改 `core/`、`shell/`、`web/`；
   应用专属的代码留在应用里。修改套件时请在本文中记录。

---

## 13. 新应用检查清单

- [ ] `node tools/new-app.mjs <id> "<Name>"`；把 `window.showOn` 设为你要覆盖的页面
- [ ] en / id / zh 三种语言的文本
- [ ] 布局基于 `fit()`；在 16:9、9:16、4:5、21:9 下截图
- [ ] 带占位图的封面（没有封面文件时也能正常工作）
- [ ] 只在 `booth.can()` 时执行操作；用通俗的话向宾客显示错误
- [ ] 用模拟器测试完整流程（`--mock`，借用活动），然后再用真实的拍照亭应用测试
- [ ] `node tools/build.mjs <id>`；exe 在没有活动时以隐藏状态启动，在正确的页面出现，
      并把屏幕交还给拍照亭应用
- [ ] 安装包和 git 中没有 `config.json` / 密钥
- [ ] 在 `apps/<id>/` 中写一个 README（它做什么、它的设置）

---

## 14. 参考：应用服务器的接口

| | |
|---|---|
| `GET /` + 文件 | 你的 `public/` |
| `GET /kit/<file>` | 套件的 `web/` |
| `GET /config.json` | 公开设置 + `{ app, mock, desktop, settingsLocked }` |
| `GET /state` | `{ online, error, mode, overlay, event, page, session, camera, result, busy, available, templates }` |
| `GET /cover/<templateId>[?event=<id>]`, `/category-cover/<id>`, `/event-cover` | 图片（404 = 没有） |
| `GET /qb/events \| templates \| categories \| commands \| status` | Local API 读取（`?eventId=`） |
| `POST /qb/<action>` | Local API 操作（event/start、event/stop 需要 `x-settings-pin`） |
| `POST /booth/start-with-template {id}` | 从任意页面用该模板开始一次拍摄流程 |
| `POST /app/hold {ms}` | 让覆盖层保持显示（≤ 20 s） |
| `POST /app/peek {on}` | 设置已打开：显示窗口 |
| `POST /app/menu` | 点击了始终置顶的菜单按钮：打开设置 |
| `GET/POST /settings`, `POST /settings/unlock {pin}`, `/settings/test`, `/app/hide`, `/app/quit` | 操作员使用（PIN 码请求头 `x-settings-pin`） |
| 你的 `kit.route(...)` | 优先匹配 |

版本：Electron 45、Node 22、Local API v1。套件在运行时没有任何 npm 依赖。
