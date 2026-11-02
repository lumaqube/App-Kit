# Panduan App Kit

Bahasa: [English](GUIDE.md) · **Bahasa Indonesia** · [中文](GUIDE.zh.md)

App Kit adalah dasar untuk app yang bekerja **bersama** event yang sedang berjalan di aplikasi booth lewat
Local API-nya: roda yang memilih tema, game sebelum foto, host bersuara, layar di monitor
kedua, penghitung, antrean printer, apa saja. Kit ini mengerjakan semua "pipa" yang dibutuhkan
setiap app seperti itu, jadi sebuah app cukup berisi idenya saja:

- bicara dengan aplikasi booth (password disimpan di server, status di-poll, perubahan dijadikan event),
- cover template dan hasil tamu (foto / GIF / video) sebagai URL biasa untuk `<img>` / `<video>`,
- jendela desktop yang tampil di atas aplikasi booth hanya di page yang Anda pilih dan
  mengembalikan layar ke aplikasi booth saat tamu lanjut,
- layar pengaturan operator (dengan PIN), layar tunggu, ikon tray, kunci rahasia,
- layout untuk rasio layar apa pun, suara yang dibuat oleh kode, confetti,
- aplikasi booth palsu untuk membangun tanpa aplikasi booth asli, tool command line, dan exe.

Ditulis untuk programmer manusia maupun agen AI. Baca [API.id.md](API.id.md) untuk Local API-nya
sendiri dan [RECIPES.id.md](RECIPES.id.md) untuk jawaban singkat yang bisa disalin. Agen AI: baca juga [AGENTS.md](../AGENTS.md).

---

## 1. Mulai cepat

Butuh Windows 10/11 dan Node.js 22 (termasuk npm). Di folder kit:

```bash
npm install                                  # Electron + the packager (once)
node tools/new-app.mjs quiz "Photo Quiz"     # apps/quiz, from the template
node tools/serve.mjs quiz --mock             # its page in a browser + a fake booth app
#   open http://127.0.0.1:3941/  (the port is printed)
node tools/run.mjs quiz --mock               # the same as the desktop app
node tools/build.mjs quiz                    # dist/Photo Quiz-win32-x64/Photo Quiz.exe
```

`apps/hello` adalah app kecil yang lengkap (template event sebagai kartu dengan cover; satu tap
memulai sesi). Baca dulu keempat file-nya: `app.json`, `public/index.html`, `public/app.js`, `server.js`.

Dengan aplikasi booth asli: nyalakan Settings → Advanced → Local API (Expert mode); lalu di app Anda
tekan **S** (atau ikon tray) → Pengaturan → Booth: port + password → **Tes koneksi** → Simpan.

---

## 2. Bagaimana semuanya tersambung

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

- **Page** (HTML/JS Anda) hanya bicara dengan server-nya sendiri. Page tidak pernah melihat password Local API.
- **Server** (satu per app, di 127.0.0.1) mem-poll aplikasi booth, menyajikan cover, hasil dan
  pengaturan, dan meneruskan aksi. Kode server Anda sendiri (opsional) berjalan di dalamnya. Server
  tidak membaca apa pun dari folder aplikasi booth: semuanya lewat HTTP, jadi booth di PC lain
  bekerja sama persis.
- **Shell** (Electron) menampilkan page dan memindahkan jendela (full / setup / hidden) sesuai
  perintah server. Di browser (`serve`) tidak ada shell: page-nya sama, tanpa aturan jendela.

---

### Brand: QBooth, BleepShare, XBooth

Aplikasi booth hadir dalam tiga build brand dari program yang sama: **QBooth.exe** (melapor "QBooth"),
**BleepShare.exe** ("BleepShareAI") dan **XBooth.exe** ("XBooth"). Local API-nya sama. Jadi:

- **Jangan pernah menulis nama brand di tampilan app.** Tulis `{booth}` di teks Anda: `kit.t()`
  mengisinya dengan nama aplikasi booth yang tersambung (`status.app.name`, "QBooth" ditampilkan
  "Q-Booth"), atau pengaturan **Nama brand** dari operator, atau sebelum pernah tersambung kata netral
  ("the booth app" / "aplikasi booth" / "拍照亭应用"). `kit.brand` dan `booth.state.brand` menyimpannya.
- Kit menemukan aplikasi booth lewat **proses yang mendengarkan port Local API** (`core/locate.js`):
  pid dan exe-nya, untuk menaikkan jendela event-nya. Tidak ada nama exe atau folder yang ditebak,
  dan tidak ada yang dibaca dari folder-nya: cover dan hasil datang dari Local API.
- Tes brand lain dengan mock: `"mockBrand": "XBooth"` (atau `BleepShareAI`) di config.json.

## 3. Struktur folder

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
| `port` | port server app ini. **Unik per app** (dua app bisa jalan berdampingan). App kit memakai 3940+; Avatar 3920-3922, Roulette 3930 |
| `window.mode` | `overlay`: di atas aplikasi booth, hanya di page `showOn`. `window`: jendela layar penuh biasa, selalu tampil (layar kedua, layar staf). Operator bisa menggantinya di Pengaturan → Layar |
| `window.showOn` | page aplikasi booth yang ditutupi app Anda: `welcome`, `categoryPicker`, `templatePicker`, `camera`, `result`, ... (lihat API.id.md) |
| `window.hideOnDialog` | sembunyi selama aplikasi booth menampilkan dialog (Start PIN, pembayaran, QR, peringatan): **biarkan true** kecuali app Anda menggantikan dialog itu |
| `window.showWhenNoEvent` | tetap tampil walau tidak ada event berjalan (default false: aplikasi booth milik operator tetap bisa dipakai) |
| `window.background` | warna jendela sebelum page selesai digambar |
| `mock.auto` | booth palsu memainkan seluruh sesi sendiri setelah template dipilih (true), atau menunggu perintah capture / process dari Anda (false) |
| `settings` | field pengaturan milik Anda sendiri (bagian 7) |
| `shortcuts` | tombol pintas milik app Anda, ditampilkan di Pengaturan → Pintasan: `[{ "keys": "Space", "label": { "en": "Spin", "id": "Putar", "zh": "转" } }]` |

### 4.2 Page

`public/index.html` memuat module Anda; module Anda menjalankan kit:

```js
import { startKit } from '/kit/kit.js';
const kit = await startKit({ texts: { en: { hi: 'Hello {name}!' }, id: { hi: 'Halo {name}!' }, zh: { hi: '你好 {name}!' } } });
const { booth, t, cfg } = kit;

booth.on('templates', list => draw(list));          // the running event's templates
booth.on('page', ({ to }) => console.log('the booth app is on', to));
document.querySelector('#go').onclick = () => booth.startWithTemplate(list[0].id);
```

Salin `<meta>` Content-Security-Policy dari index.html template (semuanya mulai dari 'self').

---

## 5. API page (`/kit/…`)

### 5.1 `startKit(options)` → `kit`

| | |
|---|---|
| `options.texts` | `{ en: {...}, id: {...}, zh: {...} }` teks Anda |
| `options.waiting` | `true` (default): kit menutupi page Anda dengan "Menunggu {booth}…" + tombol Pengaturan selama aplikasi booth tidak bisa dihubungi atau tidak menjalankan event. `false`: gambar sendiri (pakai `booth.state.online` / `.event`) |
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
| `booth.on('page', fn)` | `{ from, to }` page aplikasi booth berganti |
| `booth.on('phase', fn)` | `{ from, to, camera }` fase kamera: `liveIdle` `counting` `capturing` `reveal` `shotDelay` `review` |
| `booth.on('session', fn)` | `{ active, template: { id, name } \| null }` sebuah sesi dimulai / berakhir |
| `booth.on('event', fn)` | `{ event: { id, name } \| null }` |
| `booth.on('templates', fn)` | `[{ id, name, index, onScreen, categoryId }]` template event yang sedang berjalan yang bisa dipilih tamu |
| `booth.on('busy', fn)` | `{ dialog, processing }` |
| `booth.on('result', fn)` | `{ id, index, count }` hasil tamu baru sudah siap (`status.result` dengan `id` baru; API 1.1) |
| `booth.on('online' / 'offline', fn)` | Local API menjawab / tidak |
| `booth.state` | state terakhir |
| `booth.can(action)` | apakah aksi itu sedang ada di `available` |
| `await booth.send(action, params)` | aksi Local API apa pun (`'camera/capture'`, `'template/select', { id }` ...) → `{ ok, accepted }` atau `{ ok: false, error: { code } }`. `event/start` / `event/stop` butuh PIN pengaturan: hanya untuk operator |
| `await booth.startWithTemplate(id)` | mulai sesi dengan template itu dari posisi aplikasi booth di mana pun (Welcome: langsung; di picker: kembali ke Welcome dulu) |
| `await booth.read('events' \| 'templates' \| 'categories' \| 'result', params)` | pembacaan |
| `booth.coverUrl(templateId)` | `/cover/<id>`: gambar cover, 404 kalau aplikasi booth tidak mengirimnya (tampilkan placeholder) |
| `booth.categoryCoverUrl(id)` | cover kategori, dengan cara yang sama |
| `await booth.result()` | hasil tamu terakhir: `{ ok, data: { id, onScreen, items: [{ index, kind, mime, bytes, canShare, url, thumbUrl }] } }`; `url` / `thumbUrl` mengarah ke server kit sendiri |
| `booth.resultFileUrl(index, thumb)` | `/result/file?index=n[&thumb=1]`: satu file hasil (foto / GIF / video) atau thumbnail-nya, untuk `<img>` / `<video>` |
| `booth.hold(ms)` | pertahankan overlay selama ms (≤ 20 dtk) setelah aplikasi booth pindah: selesaikan perayaan |

### 5.3 Cover dan hasil tamu

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

Untuk hal yang tidak bisa dilakukan page: menghitung, mencatat log, menyimpan file Anda sendiri,
memanggil layanan lain, bereaksi terhadap aplikasi booth saat tidak ada page yang terbuka, menambah endpoint.

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
| `client` | client Local API (`core/qbooth.js`): `status()`, `templates(eventId, { covers: 1 })`, `result()`, `resultFile(index, thumb, headers)` (Response fetch mentah, untuk di-stream), `send(cmd, params)`, `selectTemplate(id)`, `capture()`, … |
| `watch` | poller (`core/watch.js`): `on('page' \| 'phase' \| 'session' \| 'event' \| 'templates' \| 'busy' \| 'result' \| 'online' \| 'offline' \| 'status')`, `state` |
| `startWithTemplate(id)` | sama seperti di page |
| `covers` | `core/covers.js`, async: `template(id, eventId?)`, `category(id, eventId?)` → `{ type, data (Buffer), width, height, video, hash }` atau null; `list(eventId?)` → `{ templates, categories }` beserta `cover`-nya; `forget()` (ambil ulang lain kali) |
| `route(method, path, handler)` | endpoint Anda; `path` boleh diakhiri `*`; handler `(req, res, { url, body(), json(code, obj) })`. Awali path Anda dengan id app Anda |
| `log(...)` | ke console / `logs/app.log` |
| `manifest` | app.json |
| `appDir` / `dataDir` | folder app / tempat menyimpan file Anda sendiri (folder app saat development, di sebelah exe saat sudah dipaketkan: tetap ada setelah update) |

---

## 7. Pengaturan

Operator membukanya dengan **S**, **ikon tray**, **Ctrl+Alt+Shift+S**, atau dengan menahan
pojok kiri atas selama 3 dtk (PIN dulu kalau sudah diatur). Tab: **Booth** (berjudul nama aplikasi booth; alamat, port, password +
Tes koneksi, nama brand, mode uji), **app Anda** (bahasa + field Anda), **Layar**
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

### Tombol menu dan tab Pintasan

- **Tombol menu selalu di atas** (Pengaturan → Layar, bawaannya mati; pojok: kanan atas / kiri atas /
  kanan bawah / kiri bawah): jendela ☰ kecil tersendiri (`shell/fab.js`, halaman `web/fab.html`)
  di atas semua jendela, juga saat app tersembunyi. Sentuh → `POST /app/menu` → pengaturan (PIN
  dulu). Tamu juga bisa melihatnya: nyalakan saat operator membutuhkannya, lindungi pengaturan dengan
  PIN. Berlaku tanpa restart.
- **Tab Pintasan**: semua cara masuk ke app (tombol-tombol di atas, ikon tray, pojok layar, tombol
  menu, membuka exe lagi, …) dalam bahasa yang dipilih, lalu tombol milik app dari
  `app.json` → `shortcuts`.

## 8. Cover dan hasil (Local API 1.1)

Keduanya hanya datang dari Local API; kit tidak membaca apa pun dari folder aplikasi booth, jadi
app di **PC lain** (Allow LAN di aplikasi booth) mendapatkannya dengan cara yang sama.

**Butuh aplikasi booth dengan Local API 1.1** (versi setelah 5.9.2.0; `status.app.apiVersion`
`"1.1"`). Dengan aplikasi booth 1.0 semua app tetap jalan: cover 404 (gambar placeholder) dan
panggilan result menjawab `not_found`. Selalu rancang untuk keduanya.

**Cover.** `templates?covers=1` / `categories?covers=1` mengirim setiap cover langsung di JSON
(`{ mime, width, height, video, hash, data: "data:...;base64,..." }`), dengan ukuran yang
ditampilkan picker booth itu sendiri; cover video mengirim frame poster-nya (`video: true`).
`core/covers.js` memintanya sekali per event / daftar template (cover tidak di-poll), menyimpannya
di memori dan menyajikannya sebagai gambar:

- Page: `booth.coverUrl(id)` → `/cover/<templateId>`, `booth.categoryCoverUrl(id)` →
  `/category-cover/<id>`; keduanya menerima `?event=<id>` untuk event yang tidak sedang berjalan.
  404 = tidak ada cover: gambar placeholder (huruf pertama, sebuah warna). API tidak punya cover event.
- Server: `await kit.covers.template(id, eventId?)` → `{ type, data, width, height, video, hash }` atau null.
- Command line: `node tools/covers.mjs` menampilkan daftar event; `node tools/covers.mjs "<event name | id>" --out <folder>`
  mengekspor semua cover (`01_<name>.jpg` …) + `manifest.json` (`{ index, id, name, studio, categoryId,
  file, width, height, video }` per template). Koneksi: `--app <app>` (config.json-nya),
  `--host --port --password`, atau `--mock`.

**Hasil.** Output tamu terakhir (foto, GIF, video), sejak page Result tampil sampai tamu
berikutnya mulai. Hanya tamu terakhir: hasil sebelumnya sudah tidak ada.

- `status.result` = `{ count, index, id }`; `id` baru = hasil baru → `booth.on('result')` /
  `kit.watch.on('result')`.
- `await booth.result()` → `{ id, onScreen, items: [{ index, kind, mime, bytes, canShare, url, thumbUrl }] }`
  (`kind` `photo` | `gif` | `video`). Kit menulis ulang `url` / `thumbUrl` ke
  `/result/file?index=n[&thumb=1]` miliknya sendiri (= `booth.resultFileUrl(index, thumb)`), yang
  men-stream file dari aplikasi booth dengan password ditambahkan dan byte range diteruskan, jadi
  `<img>` dan `<video>` (termasuk seek) langsung jalan. `no_result` (409): belum ada, atau tamu
  berikutnya sudah mulai.
- Hasil itu milik tamu: tampilkan, jangan disimpan (bagian 12).

**Jangan pernah menulis ke folder aplikasi booth.** Kit sama sekali tidak perlu menyentuhnya.

---

## 9. Jendela (app desktop)

| Mode | Kapan | Apa |
|---|---|---|
| `full` | overlay: event berjalan, page aplikasi booth ada di `showOn`, tidak ada dialog aplikasi booth (atau `booth.hold()`); mode window: selalu | layar penuh di layar yang dipilih; overlay = di atas jendela kiosk aplikasi booth (ditegaskan ulang setiap 1,5 dtk) |
| `setup` | Aplikasi booth tidak bisa dihubungi / password salah | jendela biasa di tengah, tidak di atas, layar tunggu kit dengan Pengaturan |
| `hidden` | selain itu: page aplikasi booth sendiri, dialog aplikasi booth, tidak ada event | tersembunyi; **jendela event aplikasi booth dinaikkan lebih dulu** (`shell/winfront.js`), jadi jendela yang tadi dibuka operator tidak pernah menutupi booth |

Membuka pengaturan menampilkan jendela layar penuh apa pun mode-nya. Tombol pintas operator (dari
mana saja): **Ctrl+Alt+Shift+S** pengaturan, **Ctrl+Alt+Shift+H** sembunyikan / tampilkan, **Ctrl+Alt+Shift+Q**
keluar; F12 developer tools dan Ctrl+Q saat jendela fokus. Ikon tray menampilkan status dan berisi
Settings / Hide-show / Quit. Membuka exe lagi akan membuka Pengaturan di salinan yang sedang berjalan. Satu salinan
per app dalam satu waktu.

Jendela kiosk aplikasi booth hanya "always on top" kalau event-nya memblokir Alt-Tab. Overlay memakai
level "screen-saver" yang lebih tinggi dan menaikkan dirinya sendiri; saat sembunyi, overlay menaikkan jendela aplikasi booth (jendelanya
yang terlihat paling besar yang bukan jendela utama "<Brand> - Version …"). Log menampilkan `front: qbooth ok |
refused | none`.

---

## 10. Pengujian

### 10.1 Aplikasi booth palsu (mock)

`--mock` (atau Pengaturan → Booth → Mode uji) menjalankan `core/mock.js` di port 8749: API,
page, fase, dan error yang sama, API 1.1: cover (kartu gambar untuk setiap template demo) dan
hasil ("foto" sebuah sesi adalah cover template-nya). Isi **Mode uji: pinjam event** (`mockEvent`)
dengan **folder yang berisi event.json**: `.qevent` yang diekstrak, atau salinan folder event.
Mock lalu memainkan event itu dengan template, kategori, dan cover-nya (`core/mock-event.js` membaca
file cover milik event, kalau tidak ada gambar pratinjau di file template). Hanya di sini kit
membaca folder event, dan hanya folder yang Anda berikan. `mock.auto` di app.json: sesi berjalan
sendiri, atau menunggu perintah Anda.

Panggilan khusus mock (untuk tes): `POST /api/v1/mock/dialog {on}` (dialog aplikasi booth), `POST
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

## 12. Aturan (milik aplikasi booth dan milik kita)

1. **Satu perintah = tombol tamu.** Jangan pernah menawarkan aksi yang saat ini tidak akan diterima aplikasi booth: cek
   `booth.can(...)` / `available`.
2. **Jangan pernah melewati layar atau gerbang.** Start PIN, pembayaran, batas cetak adalah milik aplikasi booth; API menjaganya,
   app Anda tidak boleh mengakalinya.
3. **Dialog milik aplikasi booth.** Biarkan `hideOnDialog: true`; selama `busy.dialog` setiap aksi gagal.
4. **Rahasia tetap di server.** Password Local API dan field `secret` Anda tidak pernah sampai ke
   page, log, screenshot, atau git.
5. **Jangan sentuh folder aplikasi booth.** Jangan pernah menulis ke `C:\QBoothPro` (atau folder
   instal mana pun); kit juga tidak membaca apa pun darinya: cover dan hasil datang dari Local API.
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
- [ ] cover dengan placeholder, hasil opsional (tetap jalan dengan aplikasi booth Local API 1.0)
- [ ] aksi hanya saat `booth.can()`; error ditampilkan ke tamu dengan bahasa sederhana
- [ ] tes mock untuk seluruh alur (`--mock`, event pinjaman), lalu aplikasi booth asli
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
| `GET /cover/<templateId>`, `/category-cover/<id>` (`?event=<id>`) | gambar dari Local API (404 = tidak ada) |
| `GET /result` | hasil tamu terakhir, `url` / `thumbUrl` ditulis ulang ke `/result/file` |
| `GET /result/file?index=n[&thumb=1]` | file itu, di-stream dari aplikasi booth (byte range) |
| `GET /qb/events \| templates \| categories \| result \| commands \| status` | pembacaan Local API (`?eventId=`) |
| `POST /qb/<action>` | aksi Local API (event/start, event/stop butuh `x-settings-pin`) |
| `POST /booth/start-with-template {id}` | sesi dengan template itu dari page mana pun |
| `POST /app/hold {ms}` | pertahankan overlay (≤ 20 dtk) |
| `POST /app/peek {on}` | pengaturan terbuka: tampilkan jendela |
| `POST /app/menu` | tombol menu yang selalu di atas disentuh: buka pengaturan |
| `GET/POST /settings`, `POST /settings/unlock {pin}`, `/settings/test`, `/app/hide`, `/app/quit` | operator (header PIN `x-settings-pin`) |
| `kit.route(...)` Anda | dicek lebih dulu |

Versi: Electron 45, Node 22, Local API v1 (1.1 untuk cover dan hasil). Kit tidak punya dependensi npm saat runtime.
