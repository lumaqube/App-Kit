# Resep App Kit

Bahasa: [English](RECIPES.md) · **Bahasa Indonesia** · [中文](RECIPES.zh.md)

Jawaban singkat yang bisa Anda salin. Potongan kode page mengasumsikan
`const kit = await startKit({...}); const { booth, t, cfg } = kit;` (lihat [GUIDE.id.md](GUIDE.id.md) §5).

---

### 1. Tampilkan template event beserta covernya

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

### 2. Mulai sesi dengan template yang dipilih app

```js
const r = await booth.startWithTemplate(winner.id);
if (!r.ok) showError(r.error.code);   // recipe 11
```

Dari Welcome, aplikasi booth menjalankan gerbang Start-nya (PIN / pembayaran) lalu langsung ke template itu; dari
picker, kit kembali ke Welcome dulu. Jangan pernah memakai `session/start` + `template/select` berdasarkan index
sendiri: kartunya mungkin tidak ada di layar.

### 3. Muncul hanya di Welcome, tetap sebentar setelah serah terima

`app.json`: `"window": { "mode": "overlay", "showOn": ["welcome"] }`.

```js
fx.burst(x, y, 150); sound.fanfare();
booth.hold(1500);                       // the overlay stays 1.5 s after the booth app left Welcome
await booth.startWithTemplate(id);
```

### 4. Bereaksi terhadap alur aplikasi booth

```js
booth.on('page', ({ to }) => { if (to === 'result') say('Nice photo!'); });
booth.on('phase', ({ to, camera }) => {
  if (to === 'counting') sound.count();                       // the countdown started
  if (to === 'reveal') console.log(`shot ${camera.shot} of ${camera.shots}`);
  if (to === 'review') console.log('all shots taken');
});
booth.on('session', ({ active, template }) => { if (!active) resetMyGame(); });
```

Agar tampil selama kamera, tambahkan `camera` ke `showOn` (dan biarkan live view tetap terlihat: tutupi
hanya satu pojok atau satu strip, atau pakai mode `window` di layar lain).

### 5. Tombol Anda sendiri menekan tombol aplikasi booth (hanya saat aplikasi booth menerimanya)

```js
booth.on('state', () => { captureBtn.disabled = !booth.can('camera/capture'); processBtn.hidden = !booth.can('camera/process'); });
captureBtn.onclick = () => booth.send('camera/capture');
processBtn.onclick = () => booth.send('camera/process');
```

Pakai `"mock": { "auto": false }` di app.json supaya booth palsu menunggu tekanan tombol ini.

### 6. Sesuatu di page hasil (cetak, QR, terima kasih)

`showOn: ["result"]`, lalu tutupi hanya sebagian layar (foto hasilnya milik aplikasi booth; untuk
menampilkannya di layout Anda sendiri: resep 16):

```js
printBtn.hidden = !booth.can('result/print');
printBtn.onclick = () => booth.send('result/print');
qrBtn.onclick = () => booth.send('result/qr', { type: 'web' });   // opens the booth app's QR dialog: the overlay hides
```

### 7. App layar kedua (antrean, attract loop, statistik)

`"window": { "mode": "window", "showWhenNoEvent": true }`: jendela layar penuh biasa, selalu
tampil; pilih layarnya di Pengaturan → Layar. Baca `booth.state.page`, `session`, `camera` untuk
menampilkan apa yang sedang dilakukan booth.

### 8. Tambahkan pengaturan dan pakai

`app.json`:

```json
"settings": [
  { "key": "rounds", "type": "int", "default": 3, "min": 1, "max": 9, "label": { "en": "Rounds", "id": "Ronde", "zh": "回合" } },
  { "key": "theme", "type": "enum", "default": "candy", "options": [["candy", "Candy"], ["neon", "Neon"]], "label": { "en": "Look", "id": "Tampilan", "zh": "外观" } },
  { "key": "apiToken", "type": "secret", "default": "", "public": false, "label": { "en": "Service token", "id": "Token layanan", "zh": "服务令牌" } }
]
```

Page: `cfg.rounds`, `cfg.theme`. Kode server: `kit.cfg().apiToken` (rahasia tidak pernah sampai ke page).

### 9. Kode server: hitung sesi, simpan file, tambah endpoint

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

Jangan pernah menulis ke folder aplikasi booth.

### 10. Musik Anda sendiri

```js
const sound = new Sound({ song: {
  bpm: 100,
  chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]],   // Am F C G (midi)
  bass:   [33, 29, 36, 31],
  melody: [[69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0], [65, 0, 0, 69, 0, 0, 72, 0, 0, 0, 69, 0, 0, 0, 0, 0],
           [72, 0, 0, 76, 0, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0], [71, 0, 0, 74, 0, 0, 79, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
} });
```

Atau sebuah file: `new Audio('loop.mp3')` dengan `loop = true` (taruh di `public/`).

### 11. Tampilkan error dengan bahasa sederhana

```js
const ERR = {
  en: { dialog_open: 'Please finish the window on the booth screen first', busy: 'One moment…', processing: 'Your photo is being made, one moment',
        no_event: 'The booth is not running', wrong_page: 'Not now, try again', offline: 'The booth is not answering', unknown_template: 'That theme is gone' },
};
function showError(code) { toast(ERR[kit.lang]?.[code] || ERR.en[code] || code); }
```

### 12. Cover untuk desainer (di luar app)

```bash
node tools/covers.mjs                              # the booth app's events (through its Local API)
node tools/covers.mjs "Wedding" --out D:\covers\wedding
```

### 13. Screenshot app Anda di setiap rasio (tanpa jendela di layar)

Jalankan `node tools/serve.mjs <app> --mock`, lalu Chrome headless lewat DevTools protocol:
`Emulation.setDeviceMetricsOverride { width, height }` → `Page.navigate` → tunggu → `Page.captureScreenshot`.
Lakukan untuk 1920×1080, 1080×1920, 1080×1350, 2560×1080. Buka pengaturan dengan
`Runtime.evaluate("window.__qbk.settings()")`.

### 14. Dua app sekaligus

`port` berbeda di setiap app.json, keduanya overlay: beri `showOn` page yang berbeda (mis. satu di
`welcome`, satu di `result`), atau taruh salah satunya dalam mode `window` di layar kedua.

### 15. Ikuti aplikasi booth dari terminal selagi Anda membangun

```bash
node tools/qb.mjs watch --app <id>     # page / phase / session changes as they happen
```

### 16. Tampilkan hasil tamu (foto / video)

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

Butuh aplikasi booth dengan Local API 1.1 (versi setelah 5.9.2.0). Hanya hasil tamu terakhir yang
bisa dibaca, sampai tamu berikutnya mulai. URL-nya mengarah ke server app Anda sendiri (tanpa
password di page; seek video jalan). Tampilkan hasilnya, jangan disimpan (GUIDE §12 "Data tamu").
