# Perbaikan Kritis — Audit Fitur Menyeluruh

Lanjutan dari `FIXES.md`. Berisi 5 perbaikan kritis hasil audit seluruh fitur.

## 1. Registrasi admin pertama crash (`authController.register`)
`planType` di-destructure sebagai `const` lalu di-reassign (`planType = 'UNLIMITED'`) saat user pertama → `TypeError: Assignment to constant variable`. Setiap bootstrap instance baru gagal 500.
**Fix:** ubah `const { ... planType } = req.body` → `let { ... }`.

## 2. Endpoint AI Models bisa diubah user biasa (`aiModelsRoutes`)
`POST/PUT/DELETE /api/aimodels` hanya `authenticateToken`. Tabel `AiModel` global (tanpa userId), jadi user mana pun bisa mengubah katalog model semua orang.
**Fix:** tambah `requireAdmin` pada semua route mutasi; GET tetap terbuka untuk authenticated user.

## 3. Role/isActive diambil dari token, bukan DB (`authMiddleware`)
Middleware fetch `dbUser` tapi memakai `req.user = user` (payload JWT). Demote/deaktivasi tak berlaku sampai token 24h kedaluwarsa.
**Fix:** `req.user` kini dibangun dari `dbUser` (`id`, `username`, `role`, `planType`); tolak `isActive === false` dengan 403. Hapus `console.log` debug per-request.

## 4. `phone` kontak unik global → tabrakan antar-tenant (`schema.prisma` + `contactRoutes`)
`phone String @unique` berlaku lintas semua user. Import/POST bisa menimpa/menolak nomor milik user lain.
**Fix:** `@unique` dihapus, diganti `@@unique([userId, phone])`. Upsert import memakai selector `userId_phone`.

### ⚠️ Wajib migrasi DB
Perubahan schema ini butuh migrasi. Jalankan:
```bash
npx prisma migrate dev --name contact_unique_per_user
# atau, untuk yang memakai db push:
npx prisma db push
```
Setara SQL (MariaDB):
```sql
ALTER TABLE `Contact` DROP INDEX `Contact_phone_key`;
ALTER TABLE `Contact` ADD UNIQUE INDEX `Contact_userId_phone_key` (`userId`, `phone`);
```
Catatan: bila sudah ada duplikat (userId, phone) di data lama, bersihkan dulu sebelum migrasi.

## 5. SSRF guard tidak ada di Scheduler & Broadcast (`schedulerService`, `messageController`)
Jalur `API_CALL` di scheduler & broadcast melakukan `fetch(url)` mentah tanpa proteksi (tidak seperti `ruleEngine` yang sudah diperbaiki). Injeksi credential QUERY juga tanpa encoding.
**Fix:** helper SSRF diekstrak ke `utils/urlGuard.js` (`validateOutboundUrl` + `fetchWithTimeout`) sebagai guard bersama; kedua jalur kini memvalidasi URL (blokir non-https & IP privat/localhost) + timeout 15s, dan key/value QUERY di-`encodeURIComponent`.

> Rekomendasi lanjutan (belum diterapkan): refactor `ruleEngine` agar ikut mengimpor `utils/urlGuard.js` (hapus salinan lokalnya) demi satu sumber kebenaran.
