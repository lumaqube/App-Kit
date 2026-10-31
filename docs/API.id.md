# Q-Booth Local API: referensi singkat

Bahasa: [English](API.md) · **Bahasa Indonesia** · [中文](API.zh.md)

Yang perlu diketahui app QBoothKit tentang Local API Q-Booth (API versi 1). `core/qbooth.js`
milik kit membungkus semuanya; Anda jarang perlu menyusun URL sendiri.

## Menyalakannya

Q-Booth → **Settings → Advanced → Local API** (hanya di Expert mode). Mati secara default. Pengaturan:
port (default **8730**), password (dibuatkan otomatis kalau kosong), **Allow LAN** (mati = hanya 127.0.0.1).
Q-Booth sendiri menyajikan sandbox di `http://<booth>:<port>/`, dokumentasi di `/docs` dan remote
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
| `GET templates {eventId?}` | event berjalan (atau dengan eventId) | template yang bisa dipilih tamu: `id`, `name`, `studio`, `categoryId`, dan di Template Picker `onScreen` + `index` |
| `GET categories {eventId?}` | sama | kategori yang aktif |
| `POST session/start` | Welcome | tombol Start (gerbang Start PIN / pembayaran lebih dulu) |
| `POST session/end` | page mana pun kecuali Welcome | tombol Home: kembali ke Welcome |
| `POST category/select {id \| index}` | Category Picker | tap kartu kategori |
| `POST template/select {id \| index}` | Template Picker (kartu ada di layar) **atau Welcome** | tap kartu + Next. Dari Welcome: gerbang Start, lalu langsung ke template itu (picker dilewati) |
| `POST camera/capture` | Camera, live view idle (atau jeda manual di antara jepretan) | tombol Capture |
| `POST camera/retake` | Camera, Review, masih ada jatah retake | tombol Retake |
| `POST camera/process` | Camera, Review | tombol Process |
| `POST result/print` | Result, cetak diizinkan | tombol Print |
| `POST result/qr {type: web \| local}` | Result, QR tersebut sudah diatur | tombol QR (membuka dialog) |

`index` dimulai dari 1, sesuai urutan kartu yang dilihat tamu. Kalau `id` dan `index` sama-sama dikirim, `id` yang dipakai.

**Aturan yang dijaga Q-Booth:** sebuah perintah menekan tombol yang sama dengan yang akan ditekan tamu, lengkap dengan semua pengamannya.
Tidak ada yang berbayar yang dilewati (Start PIN, pembayaran, batas cetak tetap berlaku). State yang salah ditolak, tidak pernah
diantrekan. **Dialog di layar memblokir setiap aksi** (`dialog_open`); begitu juga saat memproses (`processing`).

## `status`

```json
{
  "app":     { "name": "QBooth", "version": "5.9.3.0", "apiVersion": "1" },
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
- **`available`**: aksi yang diterima saat ini, dihitung dengan pengecekan yang sama dengan yang dijalankan perintahnya.
  Tampilkan tombol hanya kalau aksinya ada di daftar ini (`booth.can('camera/capture')` di kit).

## Kode error

| HTTP | Kode | Arti |
|---|---|---|
| 400 | `bad_request` | parameter tidak ada / tidak valid |
| 401 | `unauthorized` | password tidak ada atau salah |
| 404 | `not_found` | path tidak dikenal |
| 404 | `unknown_event` / `unknown_template` / `unknown_category` | id atau index tidak ditemukan |
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
| 429 | `too_many_attempts` | terlalu banyak password salah |

Kit menambahkan satu kode miliknya sendiri: `offline` (Q-Booth sama sekali tidak menjawab: mati, Local API mati, port salah).

## Yang tidak diberikan API (dan jawaban kit)

| Tidak ada | QBoothKit |
|---|---|
| **Gambar** template / kategori / event | dibaca dari folder event di PC booth: `core/covers.js`, `/cover/<id>`, `tools/covers.mjs` (hanya PC yang sama) |
| Notifikasi **push** | polling + event perubahan (`core/watch.js`, `web/qbooth.js`) |
| **Foto** hasil dan link QR-nya | tidak tersedia; `result/qr` membuka dialog QR milik Q-Booth sendiri |
| Template dari event yang sudah dihentikan | `GET templates?eventId=` (API) atau `covers.savedTemplates()` (file) |

Sudah diusulkan ke developer Q-Booth (belum ada di API): `GET templates/{id}/cover` (gambar lewat
LAN), trigger keluar (Q-Booth memanggil URL saat sesi mulai / foto / cetak / selesai).
