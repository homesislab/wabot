# 🔧 Wabot — Security & Reliability Fixes

> **Tanggal:** 2026-06-13
> **Scope:** `server/src/services/ruleEngine.js`, `docker-compose.yml`, `README.md`
> **Tujuan:** menutup bug kritikal (credit & SSRF) + memperkuat robustness runtime dan deployment.

---

## Ringkasan Perubahan

| ID | Severity | File | Status |
|----|----------|------|--------|
| B1 | 🔴 Critical | `ruleEngine.js` | ✅ Fixed |
| B2 | 🔴 Critical | `ruleEngine.js` | ✅ Fixed |
| B7 | 🟡 Medium | `ruleEngine.js` | ✅ Fixed |
| B8 | 🟡 Medium | `ruleEngine.js` | ✅ Fixed |
| B9 | 🟡 Medium | `ruleEngine.js` | ✅ Fixed |
| B10 | 🟡 Medium | `ruleEngine.js` | ✅ Fixed |
| B14 | 🟢 Low | `ruleEngine.js` | ✅ Fixed |
| B6 | 🟠 High | `docker-compose.yml` | ✅ Fixed |
| B12 | 🟡 Medium | `docker-compose.yml` | ✅ Fixed |
| B3/B4 | 🟠 High | `README.md` | ✅ Documented |

---

## Detail Perbaikan

### B1 — Credit tidak pernah dipotong (Critical)

**Masalah:** `executeAction()` memanggil `creditService.checkCredits()` tetapi tidak pernah memanggil `deductCredit()`, sehingga saldo `credits` user `PAY_AS_YOU_GO` tidak pernah berkurang dari auto-reply.

**Perbaikan:** Tambahkan `await creditService.deductCredit(rule.userId)` setelah setiap aksi yang berhasil mengirim pesan:
- `API_CALL` — setelah request berhasil dieksekusi.
- `RESPONSE` — setelah balasan teks/gambar terkirim.
- `AI_REPLY` — setelah respons AI terkirim (hanya bila `response` valid).
- `ACTIVATE_MINI_APP` — setelah pesan aktivasi terkirim.

> Catatan: pemotongan dilakukan setelah aksi sukses, jadi user tidak terpotong saat aksi gagal.

### B2 — SSRF pada action `API_CALL` (Critical)

**Masalah:** `rule.apiUrl` (dikonfigurasi user) di-`fetch` langsung tanpa validasi, memungkinkan serangan SSRF ke IP internal (mis. `169.254.169.254`, `localhost`) dan protokol non-HTTPS.

**Perbaikan:** Tambahkan helper `validateOutboundUrl()` (memblokir non-HTTPS + private/loopback/link-local IP) dan panggil sebelum fetch. Jika URL ditolak, kirim pesan error ke user dan hentikan eksekusi.

```js
const ALLOWED_OUTBOUND_PROTOCOLS = new Set(['https:']);
const PRIVATE_IP_REGEX = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc00:|fe80:)/i;
```

### B7 — `response.json()` tanpa cek status/content-type (Medium)

**Masalah:** Bila webhook membalas `204`/HTML/empty body, `await response.json()` melempar error dan ditangkap diam-diam.

**Perbaikan:** Cek `response.ok` (log warning bila non-OK) dan hanya `response.json()` ketika `content-type` mengandung `application/json`; selain itu fallback ke `response.text()`.

### B8 — `executeAction()` tidak di-`await` (Medium)

**Masalah:** Dipanggil fire-and-forget sebelum `return true`, sehingga error setelah return tidak terkelola dan urutan eksekusi tidak terjamin.

**Perbaikan:** Ubah menjadi `await executeAction(rule, normalizedMsg)`.

### B9 — Credential `QUERY` tidak di-encode (Medium)

**Masalah:** `key=value` ditempel ke URL tanpa encoding → URL rusak bila value mengandung karakter khusus (`&`, spasi, dll).

**Perbaikan:** Bungkus key & value dengan `encodeURIComponent()`.

### B10 — Logika injeksi credential rancu (Medium)

**Masalah:** Credential bertipe `BEARER` dengan `location='HEADER'` tidak pernah menambah header `Authorization` karena urutan `if/else if`.

**Perbaikan:** Tangani `type === 'BEARER'` terlebih dahulu, terlepas dari `location`; baru kemudian penempatan `HEADER`/`QUERY`.

### B14 — Telegram mention fallback terlalu luas (Low)

**Masalah:** `else if (text.includes('@')) matched = true` membuat pesan apa pun yang memuat `@` memicu rule MENTION (false positive). Ada di blok KEYWORD on-mention dan MENTION.

**Perbaikan:** Hapus fallback; hanya match `@${botUsername}` secara eksplisit.

### B6 — Container backend jalan sebagai `root` (High)

**Masalah:** `user: "root"` di `docker-compose.yml`.

**Perbaikan:** Ganti ke `user: "1000:1000"`. Pastikan direktori volume (`./data`, `./server/prisma`) writable oleh UID tersebut:
```bash
sudo chown -R 1000:1000 ./data ./server/prisma
```

### B12 — Tidak ada healthcheck (Medium)

**Masalah:** Endpoint `/health` ada tapi compose tidak memakainya; `frontend` hanya menunggu backend *start*, bukan *healthy*.

**Perbaikan:** Tambahkan `healthcheck` pada service `backend` (hit `/health`) dan ubah `frontend.depends_on` menjadi `condition: service_healthy`.

### B3 / B4 — Default credential & deteksi admin (High)

**Perbaikan (dokumentasi + arahan):** README diberi peringatan keamanan: ganti password admin default segera, dan otorisasi admin harus ditegakkan di server (role di DB), bukan dari build arg frontend `VITE_ADMIN_*`. Port akses dikoreksi menjadi `8002` (dashboard) dan `3003` (API) sesuai mapping compose.

---

## Verifikasi

```bash
# Syntax check
node --check server/src/services/ruleEngine.js

# Compose validity
docker compose config
```

## Belum Dikerjakan (rekomendasi lanjutan)

- Enkripsi secret at-rest (`aiApiKey`, `Credential.value`) — perlu perubahan schema + migrasi (B5).
- Atomic/transactional credit (hindari race condition saldo minus).
- Rate limiting pada `/api/auth/login`.
- Automated tests untuk `ruleEngine` & `creditService`.
- Tambah service DB/Redis ke compose atau perjelas dependensi network eksternal `shared_apps` (B17).

---

## 🧩 Refactor 18 Jun 2026 — Satu jalur aktivasi mini-app

**Masalah:** Sulit membedakan trigger mana yang mengaktifkan mini-app vs auto-reply,
karena ada **dua jalur paralel** yang logika aktivasinya saling duplikat:

| | Sebelum |
|---|---|
| **App Framework** (`AppRouter` → `AppExecutor`, step 5) | `setAppSession()` dipanggil di dalam `route()`, pesan aktivasi dikirim di `executeApp()` fase `ACTIVATION` |
| **Rule Engine** (`ruleEngine`, step 6) | action `ACTIVATE_MINI_APP` **mengulang** logika sendiri: `setAppSession()` + susun & kirim pesan aktivasi inline |

**Perbaikan — satukan jadi satu rutinitas `activateMiniApp()`:**

- Tambah fungsi tunggal `activateMiniApp(manifest, normalizedMsg, userId)` di `AppExecutor.js`
  yang melakukan **set session Redis + kirim pesan aktivasi** (memakai fase `ACTIVATION` yang sudah ada).
- `AppRouter.route()` tidak lagi memanggil `setAppSession()` sendiri (impor `setAppSession` dihapus);
  ia hanya menandai `phase: 'ACTIVATION'`.
- Dispatcher di `ruleEngine` (step 5): fase `ACTIVATION` → `activateMiniApp()`, selain itu → `executeApp()`.
- Action `ACTIVATE_MINI_APP` di `ruleEngine` kini cukup memanggil `activateMiniApp()` — blok inline
  (`setAppSession` + string pesan) dihapus, impor `setAppSession` di `ruleEngine` ikut dibersihkan.

**Hasil:**

- **Satu sumber kebenaran** untuk “mengaktifkan mini-app” → `activateMiniApp()`.
- Pemisahan tanggung jawab jadi jelas: **App Framework = mini-apps**, **Rule Engine = auto-reply**
  (RESPONSE / AI_REPLY / API_CALL), dan `ACTIVATE_MINI_APP` hanyalah jembatan tipis ke App Framework.
- Tidak ada perubahan perilaku runtime selain fallback pesan aktivasi yang kini netral
  (“Silahkan ikuti instruksi selanjutnya”) untuk semua app, bukan khusus voice note.

File tersentuh: `server/src/apps/AppExecutor.js`, `server/src/apps/AppRouter.js`, `server/src/services/ruleEngine.js`.

### Catatan lanjutan (opsional)
Semantik keyword masih beda antara dua sistem (`AppRouter` pakai `startsWith`, Rule Engine pakai
`includes`). Kalau mau benar-benar konsisten, samakan keduanya (mis. keduanya `startsWith` atau
keduanya exact/word-boundary) — ini perubahan perilaku, jadi sengaja belum diterapkan.
