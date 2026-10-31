# App Kit recipes

Languages: **English** · [Bahasa Indonesia](RECIPES.id.md) · [中文](RECIPES.zh.md)

Short answers you can copy. The page snippets assume
`const kit = await startKit({...}); const { booth, t, cfg } = kit;` (see [GUIDE.md](GUIDE.md) §5).

---

### 1. Show the event's templates with their covers

```js
booth.on('templates', list => {
  grid.replaceChildren(...list.map(tp => {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `<div class="pic">${tp.name.charAt(0)}</div><b></b>`;
    card.querySelector('b').textContent = tp.name;
    const img = new Image();
    img.onload = () => { card.querySelector('.pic').textContent = ''; card.querySelector('.pic').style.backgroundImage = `url("${img.src}")`; };
    img.src = booth.coverUrl(tp.id);   // 404 when no cover on this PC: the letter stays
    card.onclick = () => booth.startWithTemplate(tp.id);
    return card;
  }));
});
```

### 2. Start a session with a template the app chose

```js
const r = await booth.startWithTemplate(winner.id);
if (!r.ok) showError(r.error.code);   // recipe 11
```

From Welcome the booth app runs its Start gate (PIN / payment) and goes straight to that template; from
a picker the kit goes back to Welcome first. Never use `session/start` + `template/select` by index
yourself: the card may not be on screen.

### 3. Appear only on Welcome, stay a moment after the hand-over

`app.json`: `"window": { "mode": "overlay", "showOn": ["welcome"] }`.

```js
fx.burst(x, y, 150); sound.fanfare();
booth.hold(1500);                       // the overlay stays 1.5 s after the booth app left Welcome
await booth.startWithTemplate(id);
```

### 4. React to the booth app's flow

```js
booth.on('page', ({ to }) => { if (to === 'result') say('Nice photo!'); });
booth.on('phase', ({ to, camera }) => {
  if (to === 'counting') sound.count();                       // the countdown started
  if (to === 'reveal') console.log(`shot ${camera.shot} of ${camera.shots}`);
  if (to === 'review') console.log('all shots taken');
});
booth.on('session', ({ active, template }) => { if (!active) resetMyGame(); });
```

To be on screen during the camera, add `camera` to `showOn` (and keep the live view visible: cover
only a corner or a strip, or use `window` mode on another screen).

### 5. Your own button presses the booth app's (only when the booth app accepts it)

```js
booth.on('state', () => { captureBtn.disabled = !booth.can('camera/capture'); processBtn.hidden = !booth.can('camera/process'); });
captureBtn.onclick = () => booth.send('camera/capture');
processBtn.onclick = () => booth.send('camera/process');
```

Use `"mock": { "auto": false }` in app.json so the fake booth waits for these presses.

### 6. Something on the result page (print, QR, thanks)

`showOn: ["result"]`, then cover only part of the screen (the result photo is the booth app's):

```js
printBtn.hidden = !booth.can('result/print');
printBtn.onclick = () => booth.send('result/print');
qrBtn.onclick = () => booth.send('result/qr', { type: 'web' });   // opens the booth app's QR dialog: the overlay hides
```

### 7. A second-screen app (queue, attract loop, stats)

`"window": { "mode": "window", "showWhenNoEvent": true }`: an ordinary full-screen window, always
shown; choose the screen in Settings → Screen. Read `booth.state.page`, `session`, `camera` to
show what the booth is doing.

### 8. Add a setting and use it

`app.json`:

```json
"settings": [
  { "key": "rounds", "type": "int", "default": 3, "min": 1, "max": 9, "label": { "en": "Rounds", "id": "Ronde", "zh": "回合" } },
  { "key": "theme", "type": "enum", "default": "candy", "options": [["candy", "Candy"], ["neon", "Neon"]], "label": { "en": "Look", "id": "Tampilan", "zh": "外观" } },
  { "key": "apiToken", "type": "secret", "default": "", "public": false, "label": { "en": "Service token", "id": "Token layanan", "zh": "服务令牌" } }
]
```

Page: `cfg.rounds`, `cfg.theme`. Server code: `kit.cfg().apiToken` (secrets never reach the page).

### 9. Server code: count sessions, keep a file, add an endpoint

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

Never write into the booth app's folder.

### 10. Your own music

```js
const sound = new Sound({ song: {
  bpm: 100,
  chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]],   // Am F C G (midi)
  bass:   [33, 29, 36, 31],
  melody: [[69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0], [65, 0, 0, 69, 0, 0, 72, 0, 0, 0, 69, 0, 0, 0, 0, 0],
           [72, 0, 0, 76, 0, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0], [71, 0, 0, 74, 0, 0, 79, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
} });
```

Or a file: `new Audio('loop.mp3')` with `loop = true` (put it in `public/`).

### 11. Show errors in plain words

```js
const ERR = {
  en: { dialog_open: 'Please finish the window on the booth screen first', busy: 'One moment…', processing: 'Your photo is being made, one moment',
        no_event: 'The booth is not running', wrong_page: 'Not now, try again', offline: 'The booth is not answering', unknown_template: 'That theme is gone' },
};
function showError(code) { toast(ERR[kit.lang]?.[code] || ERR.en[code] || code); }
```

### 12. Covers for a designer (outside the app)

```bash
node tools/covers.mjs                              # the events on this PC
node tools/covers.mjs "Wedding" --out D:\covers\wedding
```

### 13. A screenshot of your app at every ratio (no window on screen)

Run `node tools/serve.mjs <app> --mock`, then a headless Chrome via the DevTools protocol:
`Emulation.setDeviceMetricsOverride { width, height }` → `Page.navigate` → wait → `Page.captureScreenshot`.
Do 1920×1080, 1080×1920, 1080×1350, 2560×1080. Open the settings with
`Runtime.evaluate("window.__qbk.settings()")`.

### 14. Two apps at once

Different `port` in each app.json, both overlay: give them different `showOn` pages (e.g. one on
`welcome`, one on `result`), or put one in `window` mode on a second screen.

### 15. Follow the booth app from the terminal while you build

```bash
node tools/qb.mjs watch --app <id>     # page / phase / session changes as they happen
```
