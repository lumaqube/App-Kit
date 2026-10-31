# Panduan QBoothKit

Bahasa: [English](GUIDE.md) · **Bahasa Indonesia** · [中文](GUIDE.zh.md)

QBoothKit adalah dasar untuk app yang bekerja **bersama** event Q-Booth yang sedang berjalan lewat
Local API Q-Booth: roda yang memilih tema, game sebelum foto, host bersuara, layar di monitor
kedua, penghitung, antrean printer, apa saja. Kit ini mengerjakan semua "pipa" yang dibutuhkan
setiap app seperti itu, jadi sebuah app cukup berisi idenya saja:

- bicara dengan Q-Booth (password disimpan di server, status di-poll, perubahan dijadikan event),
- cover template (API Q-Booth tidak punya gambar),
- jendela desktop yang tampil di atas Q-Booth hanya di page yang Anda pilih dan mengembalikan layar
  ke Q-Booth saat tamu lanjut,
- layar pengaturan operator (dengan PIN), layar tunggu, ikon tray, kunci rahasia,
- layout untuk rasio layar apa pun, suara yang dibuat oleh kode, confetti,
- Q-Booth palsu untuk membangun tanpa Q-Booth asli, tool command line, dan exe.

Ditulis untuk programmer manusia maupun agen AI. Baca [API.id.md](API.id.md) untuk Local API-nya
sendiri dan [RECIPES.id.md](RECIPES.id.md) untuk jawaban singkat yang bisa disalin. Agen AI: baca juga [AGENTS.md](../AGENTS.md).

---

## 1. Mulai cepat

Butuh Windows 10/11 dan Node.js 22 (termasuk npm). Di folder kit:

```bash
npm install                                  # Electron + the packager (once)
node tools/new-app.mjs quiz "Photo Quiz"     # apps/quiz, from the template
node tools/serve.mjs quiz --mock             # its page in a browser + a fake Q-Booth
#   open http://127.0.0.1:3941/  (the port is printed)
node tools/run.mjs quiz --mock               # the same as the desktop app
node tools/build.mjs quiz                    # dist/Photo Quiz-win32-x64/Photo Quiz.exe
```

`apps/hello` adalah app kecil yang lengkap (template event sebagai kartu dengan cover; satu tap
memulai sesi). Baca dulu keempat file-nya: `app.json`, `public/index.html`, `public/app.js`, `server.js`.

Dengan Q-Booth asli: nyalakan Settings → Advanced → Local API (Expert mode); lalu di app Anda
tekan **S** (atau ikon tray) → Pengaturan → Q-Booth: port + password → **Tes koneksi** → Simpan.

---

## 2. Bagaimana semuanya tersambung

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

- **Page** (HTML/JS Anda) hanya bicara dengan server-nya sendiri. Page tidak pernah melihat password Local API.
- **Server** (satu per app, di 127.0.0.1) mem-poll Q-Booth, menyajikan cover dan pengaturan, dan
  meneruskan aksi. Kode server Anda sendiri (opsional) berjalan di dalamnya.
- **Shell** (Electron) menampilkan page dan memindahkan jendela (full / setup / hidden) sesuai
  perintah server. Di browser (`serve`) tidak ada shell: page-nya sama, tanpa aturan jendela.

---

## 3. Struktur folder

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

## 4. Sebuah app

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

| Key | Arti |
|---|---|
| `id` | nama folder, huruf kecil (`[a-z][a-z0-9-]*`) |
| `name` | tampil di judul jendela, tray, pengaturan, nama exe |
| `port` | port server app ini. **Unik per app** (dua app bisa jalan berdampingan). App kit memakai 3940+; QBooth Avatar 3920-3922, Roulette 3930 |
| `window.mode` | `overlay`: di atas Q-Booth, hanya di page `showOn`. `window`: jendela layar penuh biasa, selalu tampil (layar kedua, layar staf). Operator bisa menggantinya di Pengaturan → Layar |
| `window.showOn` | page Q-Booth yang ditutupi app Anda: `welcome`, `categoryPicker`, `templatePicker`, `camera`, `result`, ... (lihat API.id.md) |
| `window.hideOnDialog` | sembunyi selama Q-Booth menampilkan dialog (Start PIN, pembayaran, QR, peringatan): **biarkan true** kecuali app Anda menggantikan dialog itu |
| `window.showWhenNoEvent` | tetap tampil walau tidak ada event berjalan (default false: Q-Booth milik operator tetap bisa dipakai) |
| `window.background` | warna jendela sebelum page selesai digambar |
| `mock.auto` | booth palsu memainkan seluruh sesi sendiri setelah template dipilih (true), atau menunggu perintah capture / process dari Anda (false) |
| `settings` | field pengaturan milik Anda sendiri (bagian 7) |

### 4.2 Page

`public/index.html` memuat module Anda; module Anda menjalankan kit:

```js
import { startKit } from '/kit/kit.js';
const kit = await startKit({ texts: { en: { hi: 'Hello {name}!' }, id: { hi: 'Halo {name}!' }, zh: { hi: '你好 {name}!' } } });
const { booth, t, cfg } = kit;

booth.on('templates', list => draw(list));          // the running event's templates
booth.on('page', ({ to }) => console.log('Q-Booth is on', to));
document.querySelector('#go').onclick = () => booth.startWithTemplate(list[0].id);
```

Salin `<meta>` Content-Security-Policy dari index.html template (semuanya mulai dari 'self').

---

## 5. API page (`/kit/…`)

### 5.1 `startKit(options)` → `kit`

| | |
|---|---|
| `options.texts` | `{ en: {...}, id: {...}, zh: {...} }` teks Anda |
| `options.waiting` | `true` (default): kit menutupi page Anda dengan "Menunggu Q-Booth…" + tombol Pengaturan selama Q-Booth tidak bisa dihubungi atau tidak menjalankan event. `false`: gambar sendiri (pakai `booth.state.online` / `.event`) |
| `kit.cfg` | pengaturan publik: `language`, `overlay`, field Anda (yang tidak rahasia, `public` bukan false), ditambah `app`, `mock`, `desktop` |
| `kit.lang` / `kit.t(key, vars)` | `en` \| `id` \| `zh`; teks untuk `key` (kembali ke bahasa Inggris, lalu ke key-nya), `{name}` diisi dari vars |
| `kit.booth` | bagian 5.2 |
| `kit.onShown(fn)` | jendela desktop ditampilkan (`true`) atau disembunyikan (`false`): mulai / hentikan musik, reset layar Anda |
| `kit.shown` | sedang tampil? |
| `kit.settings.open()` | buka pengaturan operator |
| `kit.fit / place / contain` | layout (5.4) |

### 5.2 `booth` (`web/qbooth.js`)

| | |
|---|---|
| `booth.on('state', fn)` | setiap poll (~300 ms): `{ online, error, mode, overlay, event, page, session, camera, result, busy, available, templates }` |
| `booth.on('page', fn)` | `{ from, to }` page Q-Booth berganti |
| `booth.on('phase', fn)` | `{ from, to, camera }` fase kamera: `liveIdle` `counting` `capturing` `reveal` `shotDelay` `review` |
| `booth.on('session', fn)` | `{ active, template: { id, name } \| null }` sebuah sesi dimulai / berakhir |
| `booth.on('event', fn)` | `{ event: { id, name } \| null }` |
| `booth.on('templates', fn)` | `[{ id, name, index, onScreen, categoryId }]` template event yang sedang berjalan yang bisa dipilih tamu |
| `booth.on('busy', fn)` | `{ dialog, processing }` |
| `booth.on('online' / 'offline', fn)` | Local API menjawab / tidak |
| `booth.state` | state terakhir |
| `booth.can(action)` | apakah aksi itu sedang ada di `available` |
| `await booth.send(action, params)` | aksi Local API apa pun (`'camera/capture'`, `'template/select', { id }` ...) → `{ ok, accepted }` atau `{ ok: false, error: { code } }`. `event/start` / `event/stop` butuh PIN pengaturan: hanya untuk operator |
| `await booth.startWithTemplate(id)` | mulai sesi dengan template itu dari posisi Q-Booth di mana pun (Welcome: langsung; di picker: kembali ke Welcome dulu) |
| `await booth.read('events' \| 'templates' \| 'categories', params)` | pembacaan |
| `booth.coverUrl(templateId)` | `/cover/<id>`: gambar cover, 404 kalau tidak ada di PC ini (tampilkan placeholder) |
| `booth.categoryCoverUrl(id)`, `booth.eventCoverUrl()` | cover kategori / event |
| `booth.hold(ms)` | pertahankan overlay selama ms (≤ 20 dtk) setelah Q-Booth pindah: selesaikan perayaan |

### 5.3 Cover

```js
const img = new Image();
img.onload = () => card.style.backgroundImage = `url("${img.src}")`;
img.onerror = () => card.textContent = name.charAt(0);   // no cover here: a placeholder
img.src = booth.coverUrl(template.id);
```

Asalnya dari mana: bagian 8.

### 5.4 Layout untuk layar apa pun (`web/layout.js`)

```js
kit.fit(({ W, H, u, land }) => {
  // W, H: window size; u: 1% of the short side (also CSS var(--u)); land: W / H >= 1.08
  const size = land ? Math.min(H * 0.8, W * 0.5) : Math.min(W * 0.9, H * 0.5);
  kit.place(wheel, land ? W * 0.05 : (W - size) / 2, land ? (H - size) / 2 : H * 0.12, size, size);
});
```

Aturan agar app tetap benar di setiap layar booth (16:9, 9:16, 4:5, 1:1, 21:9):
- ukur semuanya dari `u`, `W`, `H` (CSS: `calc(var(--u) * 4)`), jangan pernah pixel tetap;
- pilih susunan berdasarkan `land` (berdampingan vs bertumpuk); untuk layar pendek letakkan dalam satu baris;
- hitung apa yang harus muat (mis. tinggi kartu + tombol) lalu cari ukurannya (lihat grid `apps/hello`);
- tes minimal di 1920×1080, 1080×1920, 1080×1350 dan 2560×1080 (bagian 10.3).

### 5.5 Suara (`web/audio.js`) dan confetti (`web/fx.js`)

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

Semuanya dibuat oleh kode: tidak ada yang perlu dilisensikan. File suara sendiri: taruh di `public/`
dan putar dengan `new Audio('click.mp3')` (mp3 / wav / ogg disajikan).

---

## 6. Kode server Anda (`<app>/server.js`, opsional)

Untuk hal yang tidak bisa dilakukan page: menghitung, mencatat log, menulis file di luar folder
booth, memanggil layanan lain, bereaksi terhadap Q-Booth saat tidak ada page yang terbuka, menambah endpoint.

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
| `cfg()` | pengaturan saat ini (termasuk rahasia: jangan pernah kirim ke page) |
| `client` | client Local API (`core/qbooth.js`): `status()`, `templates()`, `send(cmd, params)`, `selectTemplate(id)`, `capture()`, … |
| `watch` | poller (`core/watch.js`): `on('page' \| 'phase' \| 'session' \| 'event' \| 'templates' \| 'busy' \| 'online' \| 'offline' \| 'status')`, `state` |
| `startWithTemplate(id)` | sama seperti di page |
| `covers` | `core/covers.js` |
| `route(method, path, handler)` | endpoint Anda; `path` boleh diakhiri `*`; handler `(req, res, { url, body(), json(code, obj) })`. Awali path Anda dengan id app Anda |
| `log(...)` | ke console / `logs/app.log` |
| `manifest` | app.json |
| `appDir` / `dataDir` | folder app / tempat menyimpan file Anda sendiri (folder app saat development, di sebelah exe saat sudah dipaketkan: tetap ada setelah update) |

---

## 7. Pengaturan

Operator membukanya dengan **S**, **ikon tray**, **Ctrl+Alt+Shift+S**, atau dengan menahan
pojok kiri atas selama 3 dtk (PIN dulu kalau sudah diatur). Tab: **Q-Booth** (alamat, port, password +
Tes koneksi, folder Q-Booth, mode uji), **app Anda** (bahasa + field Anda), **Layar**
(overlay, layar, sembunyikan / tampilkan, tombol pintas), **Keamanan** (PIN).

Field Anda di `app.json` → `settings`:

| Key field | |
|---|---|
| `key` | key config (titik membuat sarang: `game.rounds`) |
| `type` | `string`, `int` (`min`, `max`), `bool`, `enum` (`options: [[value, label]]`, label berupa string atau `{ en, id, zh }`), `range` (slider 0-100), `secret` (hanya-tulis: tidak pernah dikirim ke page atau kembali ke layar; kosong = tetap) |
| `default` | nilainya tanpa config.json |
| `label`, `hint` | `{ en, id, zh }` |
| `tab` | `app` (default), `booth`, `screen`, `security` |
| `public` | default `true`: page membacanya di `kit.cfg`. `false` untuk nilai khusus server |
| `restart` | menyimpannya akan memulai ulang app desktop |

`config.json` hanya berisi apa yang diubah operator: di `apps/<id>/` saat development, **di sebelah
exe** saat sudah dipaketkan (update mengganti folder app, pengaturannya tetap). File ini berisi
password Local API: jangan pernah di-commit, jangan pernah dimasukkan ke paket atau screenshot.

---

## 8. Cover

Local API mengembalikan id dan nama template, tanpa gambar. Kit membacanya dari folder event
milik Q-Booth sendiri **di PC yang sama**, hanya dibaca:

1. `<qboothDir>\events\<eventId>\event.json` → `templates[].cover` (gambar di folder event),
2. kalau tidak ada, file template `templates[].path` (`.qso` / `.qsc`, JSON) → `event_info.preview_image[0].mBase64`,
3. kalau tidak ada juga, tidak ada apa-apa: gambar placeholder (huruf pertama, sebuah warna).

`qboothDir` secara default `C:\QBoothPro` (Pengaturan → Q-Booth). Cover kategori: `categories[].cover`;
cover event-nya sendiri: `coverImage`.

- Page: `booth.coverUrl(id)`. Server: `kit.covers.coverOf(dir, eventId, templateId)` → `{ type, data, from }`.
- Command line: `node tools/covers.mjs` menampilkan daftar event; `node tools/covers.mjs "<event name | id>" --out <folder>`
  mengekspor semua cover (`01_<name>.jpg` …) + `manifest.json`.
- App di **PC lain** (Allow LAN di Q-Booth) tidak punya akses ke file-file ini: cover 404. Rancang
  dengan placeholder. (`GET templates/{id}/cover` di Local API sudah diusulkan ke developer Q-Booth.)
- **Jangan pernah menulis ke folder Q-Booth.** Tool covers menolak `--out` di dalamnya.

---

## 9. Jendela (app desktop)

| Mode | Kapan | Apa |
|---|---|---|
| `full` | overlay: event berjalan, page Q-Booth ada di `showOn`, tidak ada dialog Q-Booth (atau `booth.hold()`); mode window: selalu | layar penuh di layar yang dipilih; overlay = di atas jendela kiosk Q-Booth (ditegaskan ulang setiap 1,5 dtk) |
| `setup` | Q-Booth tidak bisa dihubungi / password salah | jendela biasa di tengah, tidak di atas, layar tunggu kit dengan Pengaturan |
| `hidden` | selain itu: page Q-Booth sendiri, dialog Q-Booth, tidak ada event | tersembunyi; **jendela event Q-Booth dinaikkan lebih dulu** (`shell/winfront.js`), jadi jendela yang tadi dibuka operator tidak pernah menutupi booth |

Membuka pengaturan menampilkan jendela layar penuh apa pun mode-nya. Tombol pintas operator (dari
mana saja): **Ctrl+Alt+Shift+S** pengaturan, **Ctrl+Alt+Shift+H** sembunyikan / tampilkan, **Ctrl+Alt+Shift+Q**
keluar; F12 developer tools dan Ctrl+Q saat jendela fokus. Ikon tray menampilkan status dan berisi
Settings / Hide-show / Quit. Membuka exe lagi akan membuka Pengaturan di salinan yang sedang berjalan. Satu salinan
per app dalam satu waktu.

Jendela kiosk Q-Booth hanya "always on top" kalau event-nya memblokir Alt-Tab. Overlay memakai
level "screen-saver" yang lebih tinggi dan menaikkan dirinya sendiri; saat sembunyi, overlay menaikkan jendela Q-Booth (jendela
QBooth.exe terlihat yang paling besar yang bukan "QBooth - Version …"). Log menampilkan `front: qbooth ok |
refused | none`.

---

## 10. Pengujian

### 10.1 Q-Booth palsu (mock)

`--mock` (atau Pengaturan → Q-Booth → Mode uji) menjalankan `core/mock.js` di port 8749: API,
page, fase, dan error yang sama. Isi **Mode uji: pinjam event** dengan id event dari
`C:\QBoothPro\events` (daftarnya: `node tools/covers.mjs`) dan mock memakai template-nya, jadi
cover-nya asli. `mock.auto` di app.json: sesi berjalan sendiri, atau menunggu perintah Anda.

Panggilan khusus mock (untuk tes): `POST /api/v1/mock/dialog {on}` (dialog Q-Booth), `POST
/api/v1/mock/event {on}` (mulai / hentikan event). Password `mock`.

### 10.2 Command line

```bash
node tools/qb.mjs status --mock                 # or --app quiz (its config) or --host/--port/--password
node tools/qb.mjs send template/select '{"index":2}' --mock
node tools/qb.mjs watch --app quiz              # every change, live: page, phase, session ...
```

### 10.3 Tanpa layar

`node tools/serve.mjs <app> --mock` dan browser headless (Chrome DevTools protocol): atur
viewport (1920×1080, 1080×1920, …), buka page-nya, `Page.captureScreenshot`. Kendalikan dengan
`Runtime.evaluate` (`window.__qbk.settings()`, klik). Untuk mengetes app desktop tanpa jendela
yang tampil, arahkan ke Local API yang **tidak menjalankan event** (jendela tetap tersembunyi) lalu tutup
dengan `POST /app/quit`.

**Jangan pernah membuka jendela tes di layar kerja orang lain**, dan hentikan setiap server yang Anda jalankan.

---

## 11. Build dan pengiriman

```bash
node tools/build.mjs <app>     # dist/<Name>-win32-x64/<Name>.exe (about 360 MB, Electron included)
```

- Folder exe berdiri sendiri (tanpa instalasi). `config.json` dan `logs\` muncul di sebelah exe.
- Jangan pernah ada di dalam paket: `config.json`, `logs`, `node_modules` milik app (build melewatinya).
- Untuk zip, pastikan tidak ada `config.json`, lalu zip folder-nya (`[IO.Compression.ZipFile]::CreateFromDirectory`
  di PowerShell; zip64 buatan `tar` gagal dibuka di Windows).
- `--no-asar`: perbaikan bisa langsung disalin ke `resources\app\` milik app yang sudah di-build.
- Exe butuh `ELECTRON_RUN_AS_NODE` dalam keadaan tidak di-set; beberapa shell developer men-set-nya (lalu exe diam-diam
  berjalan sebagai Node). `tools/run.mjs` menghapusnya; Explorer tidak pernah men-set-nya.

---

## 12. Aturan (milik Q-Booth dan milik kita)

1. **Satu perintah = tombol tamu.** Jangan pernah menawarkan aksi yang saat ini tidak akan diterima Q-Booth: cek
   `booth.can(...)` / `available`.
2. **Jangan pernah melewati layar atau gerbang.** Start PIN, pembayaran, batas cetak adalah milik Q-Booth; API menjaganya,
   app Anda tidak boleh mengakalinya.
3. **Dialog milik Q-Booth.** Biarkan `hideOnDialog: true`; selama `busy.dialog` setiap aksi gagal.
4. **Rahasia tetap di server.** Password Local API dan field `secret` Anda tidak pernah sampai ke
   page, log, screenshot, atau git.
5. **Folder Q-Booth hanya dibaca.** Jangan pernah menulis ke `C:\QBoothPro` (atau `qboothDir`).
6. **Data tamu.** Jangan simpan foto, suara, atau wajah kecuali tujuan app memang membutuhkannya dan
   operator mengetahuinya.
7. **Satu port per app**, unik (app.json).
8. **Kit dipakai bersama.** Ubah `core/`, `shell/`, `web/` hanya untuk hal yang dibutuhkan setiap app;
   simpan kode khusus app di dalam app. Dokumentasikan perubahan kit di sini.

---

## 13. Checklist untuk app baru

- [ ] `node tools/new-app.mjs <id> "<Name>"`; isi `window.showOn` dengan page yang Anda tutupi
- [ ] teks dalam en / id / zh
- [ ] layout dari `fit()`; screenshot di 16:9, 9:16, 4:5, 21:9
- [ ] cover dengan placeholder (tetap jalan tanpa file cover)
- [ ] aksi hanya saat `booth.can()`; error ditampilkan ke tamu dengan bahasa sederhana
- [ ] tes mock untuk seluruh alur (`--mock`, event pinjaman), lalu Q-Booth asli
- [ ] `node tools/build.mjs <id>`; exe mulai tersembunyi tanpa event, muncul di page yang benar,
      mengembalikan layar
- [ ] tidak ada `config.json` / rahasia di paket atau git
- [ ] README di `apps/<id>/` (apa yang dilakukannya, pengaturannya)

---

## 14. Referensi: endpoint server app

| | |
|---|---|
| `GET /` + file | `public/` Anda |
| `GET /kit/<file>` | `web/` milik kit |
| `GET /config.json` | pengaturan publik + `{ app, mock, desktop, settingsLocked }` |
| `GET /state` | `{ online, error, mode, overlay, event, page, session, camera, result, busy, available, templates }` |
| `GET /cover/<templateId>[?event=<id>]`, `/category-cover/<id>`, `/event-cover` | gambar (404 = tidak ada) |
| `GET /qb/events \| templates \| categories \| commands \| status` | pembacaan Local API (`?eventId=`) |
| `POST /qb/<action>` | aksi Local API (event/start, event/stop butuh `x-settings-pin`) |
| `POST /booth/start-with-template {id}` | sesi dengan template itu dari page mana pun |
| `POST /app/hold {ms}` | pertahankan overlay (≤ 20 dtk) |
| `POST /app/peek {on}` | pengaturan terbuka: tampilkan jendela |
| `GET/POST /settings`, `POST /settings/unlock {pin}`, `/settings/test`, `/app/hide`, `/app/quit` | operator (header PIN `x-settings-pin`) |
| `kit.route(...)` Anda | dicek lebih dulu |

Versi: Electron 45, Node 22, Local API v1. Kit tidak punya dependensi npm saat runtime.
