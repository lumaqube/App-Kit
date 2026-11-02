# Local API aplikasi booth: referensi singkat

Bahasa: [English](API.md) · **Bahasa Indonesia** · [中文](API.zh.md)

Yang perlu diketahui app App Kit tentang Local API aplikasi booth (API versi 1.1; tambahan 1.1 ditandai
*1.1*, lihat [Versi](#versi)). `core/qbooth.js` milik kit membungkus semuanya; Anda jarang perlu menyusun URL sendiri.

## Menyalakannya

Aplikasi booth → **Settings → Advanced → Local API** (hanya di Expert mode). Mati secara default. Pengaturan:
port (default **8730**), password (dibuatkan otomatis kalau kosong), **Allow LAN** (mati = hanya 127.0.0.1).
Aplikasi booth sendiri menyajikan sandbox di `http://<booth>:<port>/`, dokumentasi di `/docs` dan remote
control untuk ponsel di `/remote`. Dokumentasi publik: https://www.lumaqube.com/docs/local-api

## Transport dan autentikasi

- HTTP di `http://<host>:<port>/api/v1/<call>`. Pembacaan memakai `GET`, aksi memakai `POST` (GET juga
  diterima). Parameter: body JSON atau query string.
- Password lewat salah satu dari: `Authorization: Bearer <password>`, `X-QBooth-Key: <password>`, `?key=<password>`.
  Salah / tidak ada → 401 `unauthorized`; 10 kegagalan dalam semenit → 429 `too_many_attempts` selama semenit.
- Satu request per koneksi, batas body 64 KB, timeout 10 dtk. CORS terbuka.

## Balasan

```json
{ "ok": true, "data": { ... } }                       // reads (200)
{ "ok": true, "accepted": "camera/capture" }           // actions (202): returns at once
{ "ok": false, "error": { "code": "wrong_page", "message": "..." } }
```

Sebuah aksi hanya menyerahkan perintah ke app: **efeknya terlihat di `status` berikutnya**. Poll
`status` setiap 300-500 ms (kit melakukannya: `core/watch.js`, `web/qbooth.js`).

## Panggilan

| Panggilan | Berlaku saat | Fungsi |
|---|---|---|
| `GET status` | selalu | app, event, page, sesi, kamera, hasil, busy, `available` |
| `GET commands` | selalu, **tanpa password** | daftar perintah |
| `GET events` | selalu | setiap event: id, nama, diarsipkan, jumlah template, sedang berjalan |
| `POST event/start {id}` | tidak ada event berjalan, tidak ada dialog, editor tertutup | tombol Launch |
| `POST event/stop` | event berjalan, tidak ada dialog, tidak sedang memproses | mengakhiri sesi booth (tanpa PIN keluar) |
| `GET templates {eventId?, covers?}` | event berjalan (atau dengan eventId) | template yang bisa dipilih tamu: `id`, `name`, `studio`, `categoryId`, `cover` (*1.1*), dan di Template Picker `onScreen` + `index` |
| `GET categories {eventId?, covers?}` | sama | kategori yang aktif: `id`, `name`, `cover` (*1.1*) |
| `POST session/start` | Welcome | tombol Start (gerbang Start PIN / pembayaran lebih dulu) |
| `POST session/end` | page mana pun kecuali Welcome | tombol Home: kembali ke Welcome |
| `POST category/select {id \| index}` | Category Picker | tap kartu kategori |
| `POST template/select {id \| index}` | Template Picker (kartu ada di layar) **atau Welcome** | tap kartu + Next. Dari Welcome: gerbang Start, lalu langsung ke template itu (picker dilewati) |
| `POST camera/capture` | Camera, live view idle (atau jeda manual di antara jepretan) | tombol Capture |
| `POST camera/retake` | Camera, Review, masih ada jatah retake | tombol Retake |
| `POST camera/process` | Camera, Review | tombol Process |
| `GET result` *1.1* | sejak page Result tampil sampai tamu berikutnya mulai | hasil tamu terakhir (lihat di bawah) |
| `GET result/file {t \| password, index, thumb?}` *1.1* | sama | satu file hasil (atau thumbnail-nya), di-stream, byte range |
| `POST result/print` | Result, cetak diizinkan | tombol Print |
| `POST result/qr {type: web \| local}` | Result, QR tersebut sudah diatur | tombol QR (membuka dialog) |

`index` dimulai dari 1, sesuai urutan kartu yang dilihat tamu. Kalau `id` dan `index` sama-sama dikirim, `id` yang dipakai.

**Aturan yang dijaga aplikasi booth:** sebuah perintah menekan tombol yang sama dengan yang akan ditekan tamu, lengkap dengan semua pengamannya.
Tidak ada yang berbayar yang dilewati (Start PIN, pembayaran, batas cetak tetap berlaku). State yang salah ditolak, tidak pernah
diantrekan. **Dialog di layar memblokir setiap aksi** (`dialog_open`); begitu juga saat memproses (`processing`).

## Cover dan hasil (*1.1*)

**Cover.** `templates?covers=1` / `categories?covers=1` mengisi `cover` setiap item:

```json
{ "mime": "image/jpeg", "width": 800, "height": 800, "video": false, "hash": "…", "data": "data:image/jpeg;base64,…" }
```

Ukurannya sama dengan yang ditampilkan picker booth itu sendiri (400 untuk event tersimpan yang
tidak sedang berjalan); PNG hanya kalau transparan, selain itu JPEG; cover video mengirim frame
poster-nya dengan `video: true`. `cover` bernilai null tanpa `covers=1` atau kalau kartunya tidak
punya cover. Bukan untuk di-poll: baca sekali per event / daftar template (`hash` berubah kalau
cover-nya berubah). Tidak ada cover event. Di kit: `core/covers.js`, `/cover/<templateId>`,
`/category-cover/<id>`.

**Hasil.** `GET result`:

```json
{ "id": "9f2c…", "onScreen": true,
  "items": [{ "index": 1, "kind": "photo", "mime": "image/jpeg", "bytes": 2481152, "canShare": true,
              "url": "/api/v1/result/file?t=9f2c…&index=1", "thumbUrl": "/api/v1/result/file?t=9f2c…&index=1&thumb=1" }] }
```

- Bisa dibaca sejak page Result tampil sampai tamu berikutnya mulai (juga di Welcome di antaranya)
  atau event dihentikan. **Hanya tamu terakhir**; selain itu 409 `no_result`.
- `kind`: `photo` | `gif` | `video`; `index` sama dengan `status.result.index` (pager booth).
- `id` baru untuk setiap tamu dan juga menjadi token `t` di link file: `result/file` menerima `t`
  **sebagai pengganti password** (`<img>` / `<video>` tidak bisa mengirim header). `t` lama → 410
  `expired`. Password juga bisa dipakai, untuk hasil saat ini.
- `result/file` men-stream file dengan byte range (seek video) dan HEAD; `thumb=1` = thumbnail
  (≤ 1024 px; frame poster untuk video), 404 `no_thumbnail` kalau tidak bisa dibuat.
- Di kit: `/result` menulis ulang `url` / `thumbUrl` ke `/result/file?index=n[&thumb=1]` miliknya
  (password ditambahkan di server, range diteruskan); page: `booth.result()`, `booth.resultFileUrl()`.

## `status`

```json
{
  "app":     { "name": "QBooth", "version": "5.9.3.0", "apiVersion": "1.1" },
  "event":   { "id": "1781706869_H5A4", "name": "Wedding" },
  "page":    "camera",
  "session": { "active": true, "templateId": "t_123", "templateName": "Strip 3" },
  "camera":  { "phase": "review", "shot": 3, "shots": 3, "captured": 3, "feed": "live", "retakesLeft": 1 },
  "result":  null,
  "busy":    { "dialog": false, "processing": false },
  "available": ["camera/retake", "camera/process", "session/end", "event/stop"]
}
```

- `event` null → tidak ada event berjalan, `page` bernilai `"none"`.
- **Page:** `welcome`, `survey`, `categoryPicker`, `templatePicker`, `input`, `camera`, `result`.
- **Fase kamera:** `liveIdle` (live view, menunggu) → `counting` (hitung mundur) → `capturing` →
  `reveal` (jepretan ditampilkan) → `shotDelay` (di antara jepretan) … → `review` (retake / process).
  `recording` untuk template video.
- `result`: null, atau di page Result `{ count, index, id }`; `id` baru = hasil tamu baru (*1.1*).
- **`available`**: aksi yang diterima saat ini, dihitung dengan pengecekan yang sama dengan yang dijalankan perintahnya.
  Tampilkan tombol hanya kalau aksinya ada di daftar ini (`booth.can('camera/capture')` di kit).

## Kode error

| HTTP | Kode | Arti |
|---|---|---|
| 400 | `bad_request` | parameter tidak ada / tidak valid |
| 401 | `unauthorized` | password tidak ada atau salah |
| 404 | `not_found` | path tidak dikenal |
| 404 | `unknown_event` / `unknown_template` / `unknown_category` / `unknown_result` | id atau index tidak ditemukan |
| 404 | `no_thumbnail` | thumbnail tidak bisa dibuat untuk file hasil itu (*1.1*) |
| 405 | `method_not_allowed` | POST ke sebuah pembacaan |
| 409 | `no_event` | butuh event yang sedang berjalan |
| 409 | `event_running` | sudah ada event yang berjalan |
| 409 | `editor_open` | editor event sedang terbuka |
| 409 | `no_templates` | event tidak punya template yang bisa dipakai |
| 409 | `wrong_page` | tidak berlaku di page saat ini |
| 409 | `wrong_phase` | di page kamera, tetapi bukan di fase yang mengizinkannya |
| 409 | `dialog_open` | ada dialog di layar |
| 409 | `processing` | foto sedang diproses |
| 409 | `busy` | aksi lain masih belum selesai |
| 409 | `not_allowed` | diblokir oleh aturan (jatah retake habis, batas cetak, kunci cetak) |
| 409 | `not_configured` | tipe QR belum diatur |
| 409 | `no_result` | tidak ada hasil untuk dibaca: belum ada, atau tamu berikutnya sudah mulai (*1.1*) |
| 410 | `expired` | link file hasil (`t`) dari tamu sebelumnya (*1.1*) |
| 429 | `too_many_attempts` | terlalu banyak password salah |

Kit menambahkan satu kode miliknya sendiri: `offline` (aplikasi booth sama sekali tidak menjawab: mati, Local API mati, port salah).

## Yang tidak diberikan API (dan jawaban kit)

| Tidak ada | App Kit |
|---|---|
| Notifikasi **push** | polling + event perubahan (`core/watch.js`, `web/qbooth.js`) |
| Cover **event** | tidak ada: gambar sendiri |
| **Link QR** hasil | tidak tersedia; `result/qr` membuka dialog QR milik aplikasi booth sendiri |
| Cover / hasil dari aplikasi booth 1.0 | tidak ada: cover 404 (placeholder), panggilan result menjawab `not_found` |

Sudah diusulkan ke developer aplikasi booth (belum ada di API): trigger keluar (aplikasi booth
memanggil URL saat sesi mulai / foto / cetak / selesai), paging hasil.

## Versi

API melaporkan versinya di `status.app.apiVersion` dan `commands.apiVersion`. Path-nya tetap
`/api/v1`; angka minor naik saat ada panggilan atau field baru.

| API | Aplikasi booth | Menambahkan |
|---|---|---|
| 1.1 | versi setelah 5.9.2.0 | `covers=1` di templates / categories, `result` + `result/file`, `status.result.id`, error `no_result`, `unknown_result`, `no_thumbnail`, `expired` |
| 1 | 5.9.2.0 | rilis pertama |
