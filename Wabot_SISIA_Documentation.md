# Wabot SISIA - Technical Documentation

## 1. EXECUTIVE SUMMARY & ARCHITECTURE

**Wabot SISIA** adalah sebuah sistem *Smart Admin / Chatbot* multi-platform yang dirancang untuk mengelola banyak sesi WhatsApp dan Telegram melalui satu *dashboard* tersentralisasi. Sistem ini difokuskan pada otomatisasi pesan, balasan berbasis aturan (*Rule Engine*), integrasi *Artificial Intelligence* (AI), serta kemampuan penjadwalan dan manajemen kontak.

### High-Level Architecture Flow

Meskipun Wabot SISIA disebut terhubung dengan ekosistem **Laravel** dan **n8n** (khususnya untuk *Finance Tracking App*), **repositori utama Wabot** ini dibangun sepenuhnya menggunakan **Node.js (Express.js) & Prisma ORM**. 

Hubungan arsitektur antar sistem terjadi melalui mekanisme eksekusi API/Webhook:
1. **WhatsApp/Telegram (Client Layer)**: Menerima pesan masuk dari pengguna dan membedah muatan pesan.
2. **Wabot Node.js Backend (Logic Layer)**: Pesan masuk diproses oleh [ruleEngine.js](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js). Jika pesan cocok dengan pola (*keyword/regex*), sistem akan mengeksekusi aksi.
3. **n8n / Laravel (External Integration Layer)**: 
   - Jika *action* dari sebuah *Rule* berupa `API_CALL`, Wabot mensintesis *payload* (bahkan mendukung param Regex dinamis) dan mengirimkan HTTP Request/Webhook ke *endpoint* milik n8n atau app Laravel.
   - Sistem eksternal (Laravel/n8n) memproses data (misal: mencatat pengeluaran ke database terpisah).
   - Wabot menerima *response* API dan meneruskan balasan teks ke pengguna di WhatsApp/Telegram.

---

## 2. EXISTING FEATURE MATRIX

| Fitur | Trigger (Perintah) | Expected Response | Modul / Controller Pemroses |
| :--- | :--- | :--- | :--- |
| **Pencatatan Keuangan (Eksternal)** | Sesuai konfigurasi *Rule* Regex/Keyword (misal: `catat beli kopi 50000`) | Balasan dari API eksternal (n8n/Laravel) yang diteruskan ke user. | `Rule Engine` (`actionType: 'API_CALL'`) -> meneruskan `apiPayload` ke URL tujuan. |
| **AI Chatbot (Gemini/OpenAI)** | Regex/Keyword, atau _Mention Tag_ | Respon natural/konversasional hasil generasi AI. | `Rule Engine` (`actionType: 'AI_REPLY'`) & `aiService.js`. |
| **AI Image Generation** | Prefix `!image <deskripsi>` | Gambar hasil *generate* AI (DALL-E / Pollinations) beserta *caption*. | [ruleEngine.js](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js) ([handleImageCommand](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js#402-460)) & `aiService.js`. |
| **Auto-Reply (Teks/Gambar)** | Pencocokan *Keyword*, Regex, atau *Mention* | Balasan teks instan atau gambar statis yang dikonfigurasikan di DB. | `Rule Engine` (`actionType: 'RESPONSE'`). |
| **Quick Notes / Bookmark** | `!simpan <kwd> \| <isi>`, `!catatan <kwd>`, `!hapus` | Konfirmasi simpan, isi detail catatan, atau daftar catatan. | [ruleEngine.js](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js) ([handleNotesCommand](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js#292-401)) -> terhubung ke tabel [Note](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js#292-401). |
| **Schedules & Broadcasts** | Terpicu otomatis oleh sistem Cron Job | Pesan terkirim ke *Contact*/*Group* sesuai tag atau secara spesifik. | `schedulerService.js` & `messageController.js`. |
| **Multiplayer Mini-Games** | Tergantung game (mis. tebak angka, trivia, RPG) | Status game, skor / _leaderboard_, atau kemajuan _story_. | `gameService.js` (memotong aliran pesan sebelum masuk ke _rule engine_ reguler). |

---

## 3. API & WEBHOOK ENDPOINT DIRECTORY

Wabot SISIA memiliki serangkaian API internal untuk dikonsumsi oleh *Frontend Dashboard* atau *trigger* dari luar (termasuk n8n jika n8n ingin mengirim pesan *outbound* murni).

### Kategori Endpoints Utama 

*(Header Wajib: `Authorization: Bearer <JWT_TOKEN>`)*

#### A. Messages API (Pengiriman Pesan)
- **POST `/api/messages/send`**
  - **Fungsi**: Mengirim pesan *single* ke nomor spesifik/Grup.
  - **Payload**: `{ "sessionId": "string", "to": "string", "type": "TEXT|IMAGE", "content": "string" }`
- **POST `/api/messages/broadcast`**
  - **Fungsi**: Mengirim *broadcast* massal ke kontak berdasarkan *Tag*.

#### B. Rules API (Manajemen Aturan)
- **GET, POST, PUT, DELETE `/api/rules`**
  - **Fungsi**: CRUD logika mesin balasan Wabot, tempat mengatur *trigger* dan *webhook* API eksternal.

#### C. Sessions API (Manajemen Device WA/Telegram)
- **POST `/api/sessions/create`**: Membuka sesi WA baru (menghasilkan koneksi QR).
- **GET `/api/sessions/qr/:id`**: Mengambil QR Code WA untuk di-scan.
- **GET `/api/sessions/:id/status`**: Cek apakah WA terhubung.

---

## 4. N8N WORKFLOW MAPPING

> **[TBD - To Be Defined]**
> *Catatan: Tidak ada file ekspor JSON n8n yang ditemukan di dalam repositori source code Wabot. Berdasarkan logika [ruleEngine.js](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js), interaksi ke n8n sangat fleksibel; pengguna dapat membuat Rule ber-tipe `API_CALL` di dashboard Wabot dan mem-paste URL Webhook n8n ke kolom `apiUrl`, dengan muatan JSON dinamis di kolom `apiPayload`.*

---

## 5. DATABASE INTERACTION & DEPENDENCIES

Sistem Wabot berinteraksi dengan database **MariaDB/MySQL** melalui **Prisma ORM**. Tidak ada tabel bawaan Wabot yang bernama `transactions` atau `finance`. Wabot murni berfungsi sebagai *gateway* komunikasi.

Tabel esensial yang mendukung alur bot ini:
- `User`: Menyimpan *credential* Auth, saldo kredit AI, dan konfigurasi API Key (OpenAI/Gemini).
- `Session` & `TelegramBot`: Menyimpan kredensial login sesi WA (berbasis folder file lokal) dan Token Telegram.
- `Rule`: Tabel pusat. Menyimpan logika *Keyword/Regex*, aksi balasan, URL API n8n/Laravel, JSON Template Payload, dan referensi parameter dinamis.
- `Credential`: Aman menyimpan Token/Header untuk digunakan saat Wabot memukul API eksternal (Authorization Bearer).
- [Note](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js#292-401): Tabel pencatatan mandiri fitur *bookmark* ringan (`!simpan`).

*(Interaksi database untuk rekapan keuangan fisik sepenuhnya di-handle oleh Laravel App tujuan Webhook.)*

---

## 6. FUTURE-PROOFING & MAINTENANCE NOTES

### Temuan Rentan / *Technical Debt*
1. **Validasi JSON Payload Dinamis ([ruleEngine.js](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js))**: 
   Sistem di [executeAction](file:///home/gie/workspace/wabot/server/src/services/ruleEngine.js#147-291) mencoba melakukan *healing* pada JSON Payload API yang rusak lewat fungsi utilitas `fixJsonString`. Mekanisme Regex injeksi nilai dinamis ke format JSON rawan *break* jika *user input* memuat karakter *newline* atau *quotes*. 
   *Saran*: Gunakan library templating standar untuk merakit Payload ketimbang *string replace* Regex mentah.
2. **Kelonggaran Cache Deduping**: 
   Ada set `processedMessages` berkapasitas 100 *items* berbasis memori (RAM). Ini aman untuk skala kecil, tetapi jika Wabot di-scale di atas *cluster* (misal PM2 *cluster mode*), variabel global akan terpisah antar *processes*. 
   *Saran*: Gunakan **Redis** untuk *lock* / dedup pesan.

### Rekomendasi Skalabilitas
- Karena library WhatsApp **Baileys** sangat intensif koneksi TCP, pisahkan / jalankan *worker instances* khusus terlepas dari API Dashboard.
- Rancang arsitektur antrian berbasis *Message Queue* (seperti RabbitMQ atau BullMQ) antara Wabot dengan sisi Laravel. Ini akan meredam trafik jika tiba-tiba masuk puluhan ribu pesan agar Laravel/Database Finance tidak *bottleneck* seketika.
