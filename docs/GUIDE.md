# App Kit guide

Languages: **English** · [Bahasa Indonesia](GUIDE.id.md) · [中文](GUIDE.zh.md)

App Kit is the base for apps that work **with** a running event in the booth app through its Local
API: a wheel that picks the theme, a game before the photo, a voice host, a screen on a second
monitor, a counter, a printer queue, anything. The kit does the plumbing every such app needs, so
an app is only its idea:

- talking to the booth app (password kept on the server, status polled, changes turned into events),
- template covers and the guest's result (photo / GIF / video) as plain URLs for `<img>` / `<video>`,
- a desktop window that sits on top of the booth app only on the pages you choose and hands
  the screen back to it when the guest moves on,
- an operator settings screen (with PIN), a waiting screen, a tray icon, secret keys,
- layout for any screen ratio, sound made by code, confetti,
- a fake booth app for building without the real one, command-line tools, and the exe.

Written for human programmers and AI agents alike. Read [API.md](API.md) for the Local API
itself and [RECIPES.md](RECIPES.md) for short, copyable answers. AI agents: also [AGENTS.md](../AGENTS.md).

---

## 1. Quick start

Needs Windows 10/11 and Node.js 22 (npm included). In the kit folder:

```bash
npm install                                  # Electron + the packager (once)
node tools/new-app.mjs quiz "Photo Quiz"     # apps/quiz, from the template
node tools/serve.mjs quiz --mock             # its page in a browser + a fake booth app
#   open http://127.0.0.1:3941/  (the port is printed)
node tools/run.mjs quiz --mock               # the same as the desktop app
node tools/build.mjs quiz                    # dist/Photo Quiz-win32-x64/Photo Quiz.exe
```

`apps/hello` is a complete small app (event templates as cards with covers; a tap starts the
session). Read its four files first: `app.json`, `public/index.html`, `public/app.js`, `server.js`.

With the real booth app: Settings → Advanced → Local API (Expert mode) on; then in your app
press **S** (or the tray icon) → Settings → Booth: port + password → **Test connection** → Save.

---

## 2. How it fits together

```
 ┌─ the booth app ────────────────┐        ┌─ your app (one exe, or `serve` in a browser) ──────────────┐
 │ event window (kiosk)           │        │ shell/main.js   Electron: window/tray/keys, raises booth app│
 │ Local API  :8730  ◀────────────┼─HTTP───┤ core/server.js  your app's server :39xx                     │
 │  status, templates + covers,   │  only  │   core/watch.js   polls status -> events                    │
 │  result + result files         │        │   core/covers.js  covers from the Local API, cached         │
 └────────────────────────────────┘        │   <app>/server.js your optional server code                 │
                                           │      ▲ /state /cover /result /qb/* /booth/* /settings       │
                                           │ page: <app>/public + /kit/*.js (web/)                        │
                                           └──────────────────────────────────────────────────────────────┘
```

- The **page** (your HTML/JS) talks only to its own server. It never sees the Local API password.
- The **server** (one per app, on 127.0.0.1) polls the booth app, serves covers, results and
  settings, and forwards actions. Your own server code (optional) runs inside it. It reads nothing
  from the booth app's folder: everything comes over HTTP, so a booth on another PC works the same.
- The **shell** (Electron) shows the page and moves the window (full / setup / hidden) as the
  server says. In a browser (`serve`) there is no shell: same page, no window rules.

---

### Brands: QBooth, BleepShare, XBooth

The booth app ships as three brand builds of the same program: **QBooth.exe** (reports "QBooth"),
**BleepShare.exe** ("BleepShareAI") and **XBooth.exe** ("XBooth"). The Local API is the same. So:

- **Never write a brand name in an app's interface.** Write `{booth}` in your texts: `kit.t()`
  fills it with the connected booth app's name (`status.app.name`, "QBooth" shown as "Q-Booth"),
  or the operator's **Brand name** setting, or before any contact a neutral word ("the booth app" /
  "aplikasi booth" / "拍照亭应用"). `kit.brand` and `booth.state.brand` hold it.
- The kit finds the booth app by the **process listening on the Local API port** (`core/locate.js`):
  its pid and exe, to raise its event window. No exe or folder name is guessed, and nothing is
  read from its folder: covers and results come from the Local API.
- Test another brand with the mock: `"mockBrand": "XBooth"` (or `BleepShareAI`) in config.json.

## 3. Folder layout

```
App Kit/
  core/          Node modules (no dependencies)
    qbooth.js      Local API client: createClient({ host, port, password })
    watch.js       status polling -> events (page, phase, session, event, templates, busy, result, online)
    covers.js      template / category covers from the Local API (covers=1), kept in memory
    server.js      the app server: createAppServer({ appDir, mock }), window modes, endpoints
    settings.js    kit settings fields + app fields -> config.json, settings screen data
    locate.js      the booth app's process on the Local API port (pid + exe, to raise its window)
    mock.js        a fake booth app (API 1.1), optionally playing a real event
    mock-event.js  reads an event folder (event.json) for the mock only
    listen.js      listen with retry (a closing old copy may still hold the port)
  shell/         Electron: main.js (the desktop app), winfront.js (raise windows), icon.png / .ico
  web/           browser modules, served at /kit/
    kit.js         startKit(): config, texts, settings, waiting screen, polling   <- start here
    qbooth.js      booth: events, state, send(), startWithTemplate(), coverUrl(), result(), hold()
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

## 4. An app

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

| Key | Meaning |
|---|---|
| `id` | folder name, lower-case (`[a-z][a-z0-9-]*`) |
| `name` | shown in the window title, tray, settings, exe name |
| `port` | this app's server port. **Unique per app** (two apps may run side by side). Kit apps use 3940+; Avatar 3920-3922, Roulette 3930 |
| `window.mode` | `overlay`: on top of the booth app, only on `showOn` pages. `window`: a normal full-screen window, always shown (second screen, staff screen). The operator can switch it in Settings → Screen |
| `window.showOn` | the booth app's pages your app covers: `welcome`, `categoryPicker`, `templatePicker`, `camera`, `result`, ... (see API.md) |
| `window.hideOnDialog` | hide while the booth app shows a dialog (Start PIN, payment, QR, warning): **keep true** unless your app replaces that dialog |
| `window.showWhenNoEvent` | show even when no event runs (default false: the operator's booth app stays usable) |
| `window.background` | the window colour before the page paints |
| `mock.auto` | the fake booth plays a whole session by itself after a template is chosen (true), or waits for your capture / process commands (false) |
| `settings` | your own settings fields (section 7) |
| `shortcuts` | your app's own keys, listed in Settings → Shortcuts: `[{ "keys": "Space", "label": { "en": "Spin", "id": "Putar", "zh": "转" } }]` |

### 4.2 The page

`public/index.html` loads your module; your module starts the kit:

```js
import { startKit } from '/kit/kit.js';
const kit = await startKit({ texts: { en: { hi: 'Hello {name}!' }, id: { hi: 'Halo {name}!' }, zh: { hi: '你好 {name}!' } } });
const { booth, t, cfg } = kit;

booth.on('templates', list => draw(list));          // the running event's templates
booth.on('page', ({ to }) => console.log('the booth app is on', to));
document.querySelector('#go').onclick = () => booth.startWithTemplate(list[0].id);
```

Copy the Content-Security-Policy `<meta>` of the template's index.html (everything from 'self').

---

## 5. The page API (`/kit/…`)

### 5.1 `startKit(options)` → `kit`

| | |
|---|---|
| `options.texts` | `{ en: {...}, id: {...}, zh: {...} }` your texts |
| `options.waiting` | `true` (default): the kit covers your page with "Waiting for {booth}…" + a Settings button while the booth app is unreachable or runs no event. `false`: draw your own (use `booth.state.online` / `.event`) |
| `kit.cfg` | public settings: `language`, `overlay`, your fields (non-secret, `public` not false), plus `app`, `mock`, `desktop` |
| `kit.lang` / `kit.t(key, vars)` | `en` \| `id` \| `zh`; the text for `key` (falls back to English, then the key), `{name}` filled from vars |
| `kit.booth` | section 5.2 |
| `kit.onShown(fn)` | the desktop window was shown (`true`) or hidden (`false`): start / stop music, reset your screen |
| `kit.shown` | shown now? |
| `kit.settings.open()` | open the operator settings |
| `kit.fit / place / contain` | layout (5.4) |

### 5.2 `booth` (`web/qbooth.js`)

| | |
|---|---|
| `booth.on('state', fn)` | every poll (~300 ms): `{ online, error, mode, overlay, event, page, session, camera, result, busy, available, templates }` |
| `booth.on('page', fn)` | `{ from, to }` the booth app's page changed |
| `booth.on('phase', fn)` | `{ from, to, camera }` camera phase: `liveIdle` `counting` `capturing` `reveal` `shotDelay` `review` |
| `booth.on('session', fn)` | `{ active, template: { id, name } \| null }` a session started / ended |
| `booth.on('event', fn)` | `{ event: { id, name } \| null }` |
| `booth.on('templates', fn)` | `[{ id, name, index, onScreen, categoryId }]` the running event's guest-pickable templates |
| `booth.on('busy', fn)` | `{ dialog, processing }` |
| `booth.on('result', fn)` | `{ id, index, count }` a new guest's results are ready (`status.result` with a new `id`; API 1.1) |
| `booth.on('online' / 'offline', fn)` | the Local API answers / does not |
| `booth.state` | the last state |
| `booth.can(action)` | is it in `available` now |
| `await booth.send(action, params)` | any Local API action (`'camera/capture'`, `'template/select', { id }` ...) → `{ ok, accepted }` or `{ ok: false, error: { code } }`. `event/start` / `event/stop` need the settings PIN: operator only |
| `await booth.startWithTemplate(id)` | start a session with that template from wherever the booth app is (Welcome: direct; a picker: back to Welcome first) |
| `await booth.read('events' \| 'templates' \| 'categories' \| 'result', params)` | reads |
| `booth.coverUrl(templateId)` | `/cover/<id>`: the cover image, 404 when the booth app sends none (show a placeholder) |
| `booth.categoryCoverUrl(id)` | a category's cover, the same way |
| `await booth.result()` | the latest guest's results: `{ ok, data: { id, onScreen, items: [{ index, kind, mime, bytes, canShare, url, thumbUrl }] } }`; `url` / `thumbUrl` point at the kit's own server |
| `booth.resultFileUrl(index, thumb)` | `/result/file?index=n[&thumb=1]`: one result file (photo / GIF / video) or its thumbnail, for `<img>` / `<video>` |
| `booth.hold(ms)` | keep the overlay up for ms (≤ 20 s) after the booth app moved on: finish a celebration |

### 5.3 Covers and the guest's result

```js
const img = new Image();
img.onload = () => card.style.backgroundImage = `url("${img.src}")`;
img.onerror = () => card.textContent = name.charAt(0);   // no cover: a placeholder
img.src = booth.coverUrl(template.id);

booth.on('result', async () => {
  const r = await booth.result();
  if (!r.ok) return;                                      // no_result: the next guest already started
  const first = r.data.items[0];
  preview.src = first.thumbUrl;                           // = booth.resultFileUrl(first.index, true)
});
```

Where they come from: section 8.

### 5.4 Layout for any screen (`web/layout.js`)

```js
kit.fit(({ W, H, u, land }) => {
  // W, H: window size; u: 1% of the short side (also CSS var(--u)); land: W / H >= 1.08
  const size = land ? Math.min(H * 0.8, W * 0.5) : Math.min(W * 0.9, H * 0.5);
  kit.place(wheel, land ? W * 0.05 : (W - size) / 2, land ? (H - size) / 2 : H * 0.12, size, size);
});
```

Rules that keep an app right on every booth screen (16:9, 9:16, 4:5, 1:1, 21:9):
- size everything from `u`, `W`, `H` (CSS: `calc(var(--u) * 4)`), never fixed pixels;
- pick the arrangement by `land` (side by side vs stacked); for short screens put things in a row;
- compute what must fit (e.g. card height + buttons) and solve for the size (see `apps/hello` grid);
- test at least 1920×1080, 1080×1920, 1080×1350 and 2560×1080 (section 10.3).

### 5.5 Sound (`web/audio.js`) and confetti (`web/fx.js`)

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

All made by code: nothing to license. Own sound files: put them in `public/` and play them with
`new Audio('click.mp3')` (mp3 / wav / ogg are served).

---

## 6. Your server code (`<app>/server.js`, optional)

For what the page cannot do: count, log, keep a file of your own, call another
service, react to the booth app while no page is open, add an endpoint.

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
| `cfg()` | the settings now (secrets included: never send them to the page) |
| `client` | the Local API client (`core/qbooth.js`): `status()`, `templates(eventId, { covers: 1 })`, `result()`, `resultFile(index, thumb, headers)` (the raw fetch Response, to stream on), `send(cmd, params)`, `selectTemplate(id)`, `capture()`, … |
| `watch` | the poller (`core/watch.js`): `on('page' \| 'phase' \| 'session' \| 'event' \| 'templates' \| 'busy' \| 'result' \| 'online' \| 'offline' \| 'status')`, `state` |
| `startWithTemplate(id)` | as on the page |
| `covers` | `core/covers.js`, async: `template(id, eventId?)`, `category(id, eventId?)` → `{ type, data (Buffer), width, height, video, hash }` or null; `list(eventId?)` → `{ templates, categories }` with their `cover`; `forget()` (fetch again next time) |
| `route(method, path, handler)` | your endpoint; `path` may end in `*`; handler `(req, res, { url, body(), json(code, obj) })`. Prefix your paths with your app id |
| `log(...)` | to the console / `logs/app.log` |
| `manifest` | app.json |
| `appDir` / `dataDir` | the app folder / where to keep your own files (the app folder in development, next to the exe when packaged: it survives an update) |

---

## 7. Settings

The operator opens them with **S**, the **tray icon**, **Ctrl+Alt+Shift+S**, or by holding the
top-left corner 3 s (PIN first when one is set). Tabs: **Booth** (titled with the booth app's name; address, port, password +
Test connection, brand name, test mode), **your app** (language + your fields), **Screen**
(overlay, screen, hide / show, keys), **Security** (PIN).

Your fields in `app.json` → `settings`:

| Field key | |
|---|---|
| `key` | config key (dots nest: `game.rounds`) |
| `type` | `string`, `int` (`min`, `max`), `bool`, `enum` (`options: [[value, label]]`, label a string or `{ en, id, zh }`), `range` (0-100 slider), `secret` (write-only: never sent to the page or back to the screen; empty = keep) |
| `default` | the value without config.json |
| `label`, `hint` | `{ en, id, zh }` |
| `tab` | `app` (default), `booth`, `screen`, `security` |
| `public` | default `true`: the page reads it in `kit.cfg`. `false` for server-only values |
| `restart` | saving it restarts the desktop app |

`config.json` holds only what the operator changed: in `apps/<id>/` during development, **next
to the exe** when packaged (an update replaces the app folder, the settings stay). It contains the
Local API password: never commit it, never put it in a package or a screenshot.

---

### Menu button and the Shortcuts tab

- **Menu button always on top** (Settings → Screen, off by default; corner: top right / top left /
  bottom right / bottom left): a small ☰ window of its own (`shell/fab.js`, page `web/fab.html`)
  above everything, also while the app is hidden. A tap → `POST /app/menu` → the settings (PIN
  first). Guests can see it: turn it on when the operator needs it, protect the settings with a PIN.
  It applies without a restart.
- **Shortcuts tab**: every way into the app (the keys above, the tray icon, the corner, the menu
  button, opening the exe again, …) in the chosen language, then the app's own keys from
  `app.json` → `shortcuts`.

## 8. Covers and results (Local API 1.1)

Both come from the Local API only; the kit reads nothing from the booth app's folder, so an app
on **another PC** (the booth app's Allow LAN) gets them the same way.

**Needs the booth app with Local API 1.1** (the version after 5.9.2.0; `status.app.apiVersion`
`"1.1"`). With a 1.0 booth app every app still works: covers 404 (draw placeholders) and the
result calls answer `not_found`. Always design for both.

**Covers.** `templates?covers=1` / `categories?covers=1` send every cover inline
(`{ mime, width, height, video, hash, data: "data:...;base64,..." }`), at the size the booth's own
picker shows it; a video cover sends its poster frame (`video: true`). `core/covers.js` asks once
per event / template list (covers are not polled), keeps them in memory and serves them as images:

- Page: `booth.coverUrl(id)` → `/cover/<templateId>`, `booth.categoryCoverUrl(id)` →
  `/category-cover/<id>`; both take `?event=<id>` for an event that isn't running. 404 = no cover:
  draw a placeholder (first letter, a colour). The API has no event cover.
- Server: `await kit.covers.template(id, eventId?)` → `{ type, data, width, height, video, hash }` or null.
- Command line: `node tools/covers.mjs` lists the events; `node tools/covers.mjs "<event name | id>" --out <folder>`
  exports all covers (`01_<name>.jpg` …) + `manifest.json` (`{ index, id, name, studio, categoryId,
  file, width, height, video }` per template). Connection: `--app <app>` (its config.json),
  `--host --port --password`, or `--mock`.

**Results.** The latest guest's output (photo, GIF, video), from the moment the Result page shows
until the next guest starts. Only the latest guest: earlier results are gone.

- `status.result` = `{ count, index, id }`; a new `id` = new results → `booth.on('result')` /
  `kit.watch.on('result')`.
- `await booth.result()` → `{ id, onScreen, items: [{ index, kind, mime, bytes, canShare, url, thumbUrl }] }`
  (`kind` `photo` | `gif` | `video`). The kit rewrites `url` / `thumbUrl` to its own
  `/result/file?index=n[&thumb=1]` (= `booth.resultFileUrl(index, thumb)`), which streams the file
  from the booth app with the password added and byte ranges forwarded, so `<img>` and `<video>`
  (seeking included) just work. `no_result` (409): none yet, or the next guest started.
- The result belongs to the guest: show it, don't keep it (section 12).

**Never write into the booth app's folder.** The kit has no reason to touch it at all.

---

## 9. The window (desktop app)

| Mode | When | What |
|---|---|---|
| `full` | overlay: an event runs, the booth app's page is in `showOn`, no booth app dialog (or `booth.hold()`); window mode: always | full screen on the chosen screen; overlay = above the booth app's kiosk window (re-asserted every 1.5 s) |
| `setup` | The booth app not reachable / wrong password | a normal window in the middle, not on top, the kit's waiting screen with Settings |
| `hidden` | anything else: the booth app's own pages, a booth app dialog, no event | hidden; **the booth app's event window is raised first** (`shell/winfront.js`), so a window the operator had switched to never covers the booth |

Opening the settings shows the window full screen whatever the mode. The operator's keys (from
anywhere): **Ctrl+Alt+Shift+S** settings, **Ctrl+Alt+Shift+H** hide / show, **Ctrl+Alt+Shift+Q**
quit; F12 developer tools and Ctrl+Q with the window focused. The tray icon shows the status and has
Settings / Hide-show / Quit. Opening the exe again opens Settings in the running copy. One copy
per app at a time.

The booth app's kiosk window is "always on top" only when its event blocks Alt-Tab. The overlay uses the
higher "screen-saver" level and raises itself; when it hides it raises the booth app's window (its biggest
visible window that is not the main "<Brand> - Version …" window). The log shows `front: qbooth ok |
refused | none`.

---

## 10. Testing

### 10.1 The fake booth app (mock)

`--mock` (or Settings → Booth → Test mode) starts `core/mock.js` on port 8749: the same API,
pages, phases and errors, API 1.1: covers (a drawn card per demo template) and results (the
"photo" of a session is its template's cover). Set **Test mode: borrow an event** (`mockEvent`)
to a **folder holding an event.json**: an extracted `.qevent`, or a copy of an event folder. The
mock then plays that event with its templates, categories and covers (`core/mock-event.js` reads
the event's own cover files, else each template file's preview image). This is the only place the
kit reads an event folder, and only the folder you give it. `mock.auto` in app.json: the session
plays by itself, or waits for your commands.

Mock-only calls (for tests): `POST /api/v1/mock/dialog {on}` (a booth app dialog), `POST
/api/v1/mock/event {on}` (start / stop the event). Password `mock`.

### 10.2 The command line

```bash
node tools/qb.mjs status --mock                 # or --app quiz (its config) or --host/--port/--password
node tools/qb.mjs send template/select '{"index":2}' --mock
node tools/qb.mjs watch --app quiz              # every change, live: page, phase, session ...
```

### 10.3 Without a screen

`node tools/serve.mjs <app> --mock` and a headless browser (Chrome DevTools protocol): set the
viewport (1920×1080, 1080×1920, …), open the page, `Page.captureScreenshot`. Drive it with
`Runtime.evaluate` (`window.__qbk.settings()`, clicks). To test the desktop app without a window
showing, point it at a Local API that runs **no event** (the window stays hidden) and quit it
with `POST /app/quit`.

**Never open test windows on someone's working screen**, and stop every server you started.

---

## 11. Building and shipping

```bash
node tools/build.mjs <app>     # dist/<Name>-win32-x64/<Name>.exe (about 360 MB, Electron included)
```

- The exe folder is self-contained (no install). `config.json` and `logs\` appear next to the exe.
- Never inside a package: `config.json`, `logs`, `node_modules` of the app (the build skips them).
- For a zip, check it has no `config.json`, then zip the folder (PowerShell's
  `[IO.Compression.ZipFile]::CreateFromDirectory`; a `tar`-made zip64 failed to open on Windows).
- `--no-asar`: a fix can be copied straight into `resources\app\` of a built app.
- The exe needs `ELECTRON_RUN_AS_NODE` unset; some developer shells set it (then the exe silently
  runs as Node). `tools/run.mjs` removes it; Explorer never sets it.

---

## 12. Rules (the booth app's and ours)

1. **A command = the guest's button.** Never offer an action the booth app would not accept now: check
   `booth.can(...)` / `available`.
2. **Never skip a screen or a gate.** Start PIN, payment, print limits are the booth app's; the API keeps
   them, your app must not work around them.
3. **Dialogs belong to the booth app.** Keep `hideOnDialog: true`; while `busy.dialog` every action fails.
4. **Secrets stay on the server.** The Local API password and your `secret` fields never reach the
   page, a log, a screenshot or git.
5. **Hands off the booth app's folders.** Never write into `C:\QBoothPro` (or any install folder);
   the kit reads nothing from them either: covers and results come from the Local API.
6. **Guests' data.** Do not keep photos, voices or faces unless the app's purpose needs it and
   the operator knows.
7. **One port per app**, unique (app.json).
8. **The kit is shared.** Change `core/`, `shell/`, `web/` only for something every app needs;
   keep app-specific code in the app. Document a kit change here.

---

## 13. Checklist for a new app

- [ ] `node tools/new-app.mjs <id> "<Name>"`; set `window.showOn` to the pages you cover
- [ ] texts in en / id / zh
- [ ] layout from `fit()`; screenshots at 16:9, 9:16, 4:5, 21:9
- [ ] covers with placeholders, results optional (works with a Local API 1.0 booth app)
- [ ] actions only when `booth.can()`; errors shown to the guest in plain words
- [ ] mock test of the whole flow (`--mock`, borrowed event), then the real booth app
- [ ] `node tools/build.mjs <id>`; the exe starts hidden with no event, appears on the right page,
      hands the screen back
- [ ] no `config.json` / secrets in the package or git
- [ ] a README in `apps/<id>/` (what it does, its settings)

---

## 14. Reference: the app server's endpoints

| | |
|---|---|
| `GET /` + files | your `public/` |
| `GET /kit/<file>` | the kit's `web/` |
| `GET /config.json` | public settings + `{ app, mock, desktop, settingsLocked }` |
| `GET /state` | `{ online, error, mode, overlay, event, page, session, camera, result, busy, available, templates }` |
| `GET /cover/<templateId>`, `/category-cover/<id>` (`?event=<id>`) | images from the Local API (404 = none) |
| `GET /result` | the latest guest's results, `url` / `thumbUrl` rewritten to `/result/file` |
| `GET /result/file?index=n[&thumb=1]` | that file streamed from the booth app (byte ranges) |
| `GET /qb/events \| templates \| categories \| result \| commands \| status` | Local API reads (`?eventId=`) |
| `POST /qb/<action>` | Local API actions (event/start, event/stop need `x-settings-pin`) |
| `POST /booth/start-with-template {id}` | a session with that template from any page |
| `POST /app/hold {ms}` | keep the overlay up (≤ 20 s) |
| `POST /app/peek {on}` | settings open: show the window |
| `POST /app/menu` | the always-on-top menu button was tapped: open the settings |
| `GET/POST /settings`, `POST /settings/unlock {pin}`, `/settings/test`, `/app/hide`, `/app/quit` | operator (PIN header `x-settings-pin`) |
| your `kit.route(...)` | checked first |

Versions: Electron 45, Node 22, Local API v1 (1.1 for covers and results). The kit has no npm dependencies at run time.
