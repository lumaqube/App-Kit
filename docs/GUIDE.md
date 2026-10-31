# QBoothKit guide

Languages: **English** · [Bahasa Indonesia](GUIDE.id.md) · [中文](GUIDE.zh.md)

QBoothKit is the base for apps that work **with** a running Q-Booth event through Q-Booth's Local
API: a wheel that picks the theme, a game before the photo, a voice host, a screen on a second
monitor, a counter, a printer queue, anything. The kit does the plumbing every such app needs, so
an app is only its idea:

- talking to Q-Booth (password kept on the server, status polled, changes turned into events),
- template covers (Q-Booth's API has no images),
- a desktop window that sits on top of Q-Booth only on the pages you choose and hands the screen
  back to Q-Booth when the guest moves on,
- an operator settings screen (with PIN), a waiting screen, a tray icon, secret keys,
- layout for any screen ratio, sound made by code, confetti,
- a fake Q-Booth for building without the real one, command-line tools, and the exe.

Written for human programmers and AI agents alike. Read [API.md](API.md) for the Local API
itself and [RECIPES.md](RECIPES.md) for short, copyable answers. AI agents: also [AGENTS.md](../AGENTS.md).

---

## 1. Quick start

Needs Windows 10/11 and Node.js 22 (npm included). In the kit folder:

```bash
npm install                                  # Electron + the packager (once)
node tools/new-app.mjs quiz "Photo Quiz"     # apps/quiz, from the template
node tools/serve.mjs quiz --mock             # its page in a browser + a fake Q-Booth
#   open http://127.0.0.1:3941/  (the port is printed)
node tools/run.mjs quiz --mock               # the same as the desktop app
node tools/build.mjs quiz                    # dist/Photo Quiz-win32-x64/Photo Quiz.exe
```

`apps/hello` is a complete small app (event templates as cards with covers; a tap starts the
session). Read its four files first: `app.json`, `public/index.html`, `public/app.js`, `server.js`.

With the real Q-Booth: Settings → Advanced → Local API (Expert mode) on; then in your app
press **S** (or the tray icon) → Settings → Q-Booth: port + password → **Test connection** → Save.

---

## 2. How it fits together

```
 ┌─ Q-Booth (QBooth.exe) ─────────┐        ┌─ your app (one exe, or `serve` in a browser) ──────────────┐
 │ event window (kiosk)           │        │ shell/main.js   Electron: window, tray, keys, raises Q-Booth│
 │ Local API  :8730  ◀────────────┼─HTTP───┤ core/server.js  your app's server :39xx                     │
 │ events\<id>\event.json + covers│◀─read──┤   core/watch.js   polls status -> events                    │
 └────────────────────────────────┘  only  │   core/covers.js  covers from the event folder              │
                                           │   <app>/server.js your optional server code                 │
                                           │      ▲ /state /cover /qb/* /booth/* /settings               │
                                           │ page: <app>/public + /kit/*.js (web/)                        │
                                           └──────────────────────────────────────────────────────────────┘
```

- The **page** (your HTML/JS) talks only to its own server. It never sees the Local API password.
- The **server** (one per app, on 127.0.0.1) polls Q-Booth, serves covers and settings, and
  forwards actions. Your own server code (optional) runs inside it.
- The **shell** (Electron) shows the page and moves the window (full / setup / hidden) as the
  server says. In a browser (`serve`) there is no shell: same page, no window rules.

---

## 3. Folder layout

```
QBoothKit/
  core/          Node modules (no dependencies)
    qbooth.js      Local API client: createClient({ host, port, password })
    watch.js       status polling -> events (page, phase, session, event, templates, busy, online)
    covers.js      covers from <qboothDir>\events\<id> (read only); listEvents, savedTemplates
    server.js      the app server: createAppServer({ appDir, mock }), window modes, endpoints
    settings.js    kit settings fields + app fields -> config.json, settings screen data
    mock.js        a fake Q-Booth (same API), optionally with a real event's templates
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
| `port` | this app's server port. **Unique per app** (two apps may run side by side). Kit apps use 3940+; QBooth Avatar 3920-3922, Roulette 3930 |
| `window.mode` | `overlay`: on top of Q-Booth, only on `showOn` pages. `window`: a normal full-screen window, always shown (second screen, staff screen). The operator can switch it in Settings → Screen |
| `window.showOn` | the Q-Booth pages your app covers: `welcome`, `categoryPicker`, `templatePicker`, `camera`, `result`, ... (see API.md) |
| `window.hideOnDialog` | hide while Q-Booth shows a dialog (Start PIN, payment, QR, warning): **keep true** unless your app replaces that dialog |
| `window.showWhenNoEvent` | show even when no event runs (default false: the operator's Q-Booth stays usable) |
| `window.background` | the window colour before the page paints |
| `mock.auto` | the fake booth plays a whole session by itself after a template is chosen (true), or waits for your capture / process commands (false) |
| `settings` | your own settings fields (section 7) |

### 4.2 The page

`public/index.html` loads your module; your module starts the kit:

```js
import { startKit } from '/kit/kit.js';
const kit = await startKit({ texts: { en: { hi: 'Hello {name}!' }, id: { hi: 'Halo {name}!' }, zh: { hi: '你好 {name}!' } } });
const { booth, t, cfg } = kit;

booth.on('templates', list => draw(list));          // the running event's templates
booth.on('page', ({ to }) => console.log('Q-Booth is on', to));
document.querySelector('#go').onclick = () => booth.startWithTemplate(list[0].id);
```

Copy the Content-Security-Policy `<meta>` of the template's index.html (everything from 'self').

---

## 5. The page API (`/kit/…`)

### 5.1 `startKit(options)` → `kit`

| | |
|---|---|
| `options.texts` | `{ en: {...}, id: {...}, zh: {...} }` your texts |
| `options.waiting` | `true` (default): the kit covers your page with "Waiting for Q-Booth…" + a Settings button while Q-Booth is unreachable or runs no event. `false`: draw your own (use `booth.state.online` / `.event`) |
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
| `booth.on('page', fn)` | `{ from, to }` Q-Booth's page changed |
| `booth.on('phase', fn)` | `{ from, to, camera }` camera phase: `liveIdle` `counting` `capturing` `reveal` `shotDelay` `review` |
| `booth.on('session', fn)` | `{ active, template: { id, name } \| null }` a session started / ended |
| `booth.on('event', fn)` | `{ event: { id, name } \| null }` |
| `booth.on('templates', fn)` | `[{ id, name, index, onScreen, categoryId }]` the running event's guest-pickable templates |
| `booth.on('busy', fn)` | `{ dialog, processing }` |
| `booth.on('online' / 'offline', fn)` | the Local API answers / does not |
| `booth.state` | the last state |
| `booth.can(action)` | is it in `available` now |
| `await booth.send(action, params)` | any Local API action (`'camera/capture'`, `'template/select', { id }` ...) → `{ ok, accepted }` or `{ ok: false, error: { code } }`. `event/start` / `event/stop` need the settings PIN: operator only |
| `await booth.startWithTemplate(id)` | start a session with that template from wherever Q-Booth is (Welcome: direct; a picker: back to Welcome first) |
| `await booth.read('events' \| 'templates' \| 'categories', params)` | reads |
| `booth.coverUrl(templateId)` | `/cover/<id>`: the cover image, 404 when there is none on this PC (show a placeholder) |
| `booth.categoryCoverUrl(id)`, `booth.eventCoverUrl()` | category / event covers |
| `booth.hold(ms)` | keep the overlay up for ms (≤ 20 s) after Q-Booth moved on: finish a celebration |

### 5.3 Covers

```js
const img = new Image();
img.onload = () => card.style.backgroundImage = `url("${img.src}")`;
img.onerror = () => card.textContent = name.charAt(0);   // no cover here: a placeholder
img.src = booth.coverUrl(template.id);
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

For what the page cannot do: count, log, write a file outside the booth folder, call another
service, react to Q-Booth while no page is open, add an endpoint.

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
| `client` | the Local API client (`core/qbooth.js`): `status()`, `templates()`, `send(cmd, params)`, `selectTemplate(id)`, `capture()`, … |
| `watch` | the poller (`core/watch.js`): `on('page' \| 'phase' \| 'session' \| 'event' \| 'templates' \| 'busy' \| 'online' \| 'offline' \| 'status')`, `state` |
| `startWithTemplate(id)` | as on the page |
| `covers` | `core/covers.js` |
| `route(method, path, handler)` | your endpoint; `path` may end in `*`; handler `(req, res, { url, body(), json(code, obj) })`. Prefix your paths with your app id |
| `log(...)` | to the console / `logs/app.log` |
| `manifest` | app.json |
| `appDir` / `dataDir` | the app folder / where to keep your own files (the app folder in development, next to the exe when packaged: it survives an update) |

---

## 7. Settings

The operator opens them with **S**, the **tray icon**, **Ctrl+Alt+Shift+S**, or by holding the
top-left corner 3 s (PIN first when one is set). Tabs: **Q-Booth** (address, port, password +
Test connection, Q-Booth folder, test mode), **your app** (language + your fields), **Screen**
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

## 8. Covers

The Local API returns template ids and names, no images. The kit reads them from Q-Booth's own
event folder **on the same PC**, read only:

1. `<qboothDir>\events\<eventId>\event.json` → `templates[].cover` (an image in the event folder),
2. else the template file `templates[].path` (`.qso` / `.qsc`, JSON) → `event_info.preview_image[0].mBase64`,
3. else nothing: draw a placeholder (first letter, a colour).

`qboothDir` is `C:\QBoothPro` by default (Settings → Q-Booth). Category covers: `categories[].cover`;
the event's own cover: `coverImage`.

- Page: `booth.coverUrl(id)`. Server: `kit.covers.coverOf(dir, eventId, templateId)` → `{ type, data, from }`.
- Command line: `node tools/covers.mjs` lists the events; `node tools/covers.mjs "<event name | id>" --out <folder>`
  exports all covers (`01_<name>.jpg` …) + `manifest.json`.
- An app on **another PC** (Q-Booth's Allow LAN) has no access to these files: covers 404. Design
  for placeholders. (A `GET templates/{id}/cover` in the Local API has been proposed to the Q-Booth developer.)
- **Never write into the Q-Booth folder.** The covers tool refuses an `--out` inside it.

---

## 9. The window (desktop app)

| Mode | When | What |
|---|---|---|
| `full` | overlay: an event runs, Q-Booth's page is in `showOn`, no Q-Booth dialog (or `booth.hold()`); window mode: always | full screen on the chosen screen; overlay = above Q-Booth's kiosk window (re-asserted every 1.5 s) |
| `setup` | Q-Booth not reachable / wrong password | a normal window in the middle, not on top, the kit's waiting screen with Settings |
| `hidden` | anything else: Q-Booth's own pages, a Q-Booth dialog, no event | hidden; **Q-Booth's event window is raised first** (`shell/winfront.js`), so a window the operator had switched to never covers the booth |

Opening the settings shows the window full screen whatever the mode. The operator's keys (from
anywhere): **Ctrl+Alt+Shift+S** settings, **Ctrl+Alt+Shift+H** hide / show, **Ctrl+Alt+Shift+Q**
quit; F12 developer tools and Ctrl+Q with the window focused. The tray icon shows the status and has
Settings / Hide-show / Quit. Opening the exe again opens Settings in the running copy. One copy
per app at a time.

Q-Booth's kiosk window is "always on top" only when its event blocks Alt-Tab. The overlay uses the
higher "screen-saver" level and raises itself; when it hides it raises Q-Booth's window (the biggest
visible QBooth.exe window that is not "QBooth - Version …"). The log shows `front: qbooth ok |
refused | none`.

---

## 10. Testing

### 10.1 The fake Q-Booth (mock)

`--mock` (or Settings → Q-Booth → Test mode) starts `core/mock.js` on port 8749: the same API,
pages, phases and errors. Set **Test mode: borrow an event** to an event id from
`C:\QBoothPro\events` (list: `node tools/covers.mjs`) and the mock uses its templates, so the
covers are real. `mock.auto` in app.json: the session plays by itself, or waits for your commands.

Mock-only calls (for tests): `POST /api/v1/mock/dialog {on}` (a Q-Booth dialog), `POST
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

## 12. Rules (Q-Booth's and ours)

1. **A command = the guest's button.** Never offer an action Q-Booth would not accept now: check
   `booth.can(...)` / `available`.
2. **Never skip a screen or a gate.** Start PIN, payment, print limits are Q-Booth's; the API keeps
   them, your app must not work around them.
3. **Dialogs belong to Q-Booth.** Keep `hideOnDialog: true`; while `busy.dialog` every action fails.
4. **Secrets stay on the server.** The Local API password and your `secret` fields never reach the
   page, a log, a screenshot or git.
5. **Q-Booth's folders are read only.** Never write into `C:\QBoothPro` (or `qboothDir`).
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
- [ ] covers with placeholders (works with no cover files)
- [ ] actions only when `booth.can()`; errors shown to the guest in plain words
- [ ] mock test of the whole flow (`--mock`, borrowed event), then the real Q-Booth
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
| `GET /cover/<templateId>[?event=<id>]`, `/category-cover/<id>`, `/event-cover` | images (404 = none) |
| `GET /qb/events \| templates \| categories \| commands \| status` | Local API reads (`?eventId=`) |
| `POST /qb/<action>` | Local API actions (event/start, event/stop need `x-settings-pin`) |
| `POST /booth/start-with-template {id}` | a session with that template from any page |
| `POST /app/hold {ms}` | keep the overlay up (≤ 20 s) |
| `POST /app/peek {on}` | settings open: show the window |
| `GET/POST /settings`, `POST /settings/unlock {pin}`, `/settings/test`, `/app/hide`, `/app/quit` | operator (PIN header `x-settings-pin`) |
| your `kit.route(...)` | checked first |

Versions: Electron 45, Node 22, Local API v1. The kit has no npm dependencies at run time.
