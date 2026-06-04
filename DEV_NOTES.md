# 📓 Wabot — Dev Notes & Feature Reference

> **Last updated:** 2026-06-04  
> **Project:** Wabot — WhatsApp & Telegram Automation Platform  
> **Production URL:** https://wabot.homesislab.my.id  
> **API Docs:** https://wabot.homesislab.my.id/api/docs/

---

## 📁 Struktur Monorepo

```
wabot/
├── client/              → Frontend (React + Vite + TailwindCSS)
├── server/              → Backend (Node.js + Express + Prisma)
│   ├── src/
│   │   ├── apps/        → Mini App Framework (App Registry, Router, Executor)
│   │   ├── config/      → Logger, Redis, Metrics (Prometheus), Swagger
│   │   ├── controllers/ → HTTP request handlers per domain
│   │   ├── middleware/  → Auth, upload handlers
│   │   ├── routes/      → Express route definitions
│   │   ├── services/    → Business logic & external integrations
│   │   └── utils/       → JSON fix, helpers
│   └── prisma/          → Schema DB & migrations
├── data/                → Volume Docker: uploads, sessions, logs
├── docker-compose.yml   → Definisi container prod
├── deploy-frontend.sh   → Script deploy frontend ke container nginx
└── .github/workflows/   → CI/CD Pipeline GitHub Actions
```

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, React Router, Socket.IO Client |
| Backend | Node.js 20 (ESM), Express 5, Prisma ORM |
| Database | MariaDB/MySQL (via `DATABASE_URL`) |
| Cache / Dedup | Redis (via `REDIS_URL`) |
| Auth | JWT + Google OAuth 2.0 |
| WhatsApp | `@whiskeysockets/baileys` (multi-session) |
| Telegram | `node-telegram-bot-api` (multi-bot) |
| AI | OpenAI (GPT, DALL-E), Google Gemini |
| Job Scheduler | `node-cron` |
| Metrics | `prom-client` (Prometheus) |
| API Docs | `swagger-jsdoc` + `swagger-ui-express` |
| Container | Docker + Docker Compose |
| Reverse Proxy | Nginx (di dalam container frontend) |
| CDN/Edge | Cloudflare (prod) |

---

## ⚙️ Environment Variables

File `.env` di root project. Semua dipakai oleh Docker Compose.

```env
# Database (MariaDB)
DATABASE_URL=mysql://user:password@host:3306/dbname

# Redis (untuk session dedup, app session)
REDIS_URL=redis://:password@host:6379

# JWT
JWT_SECRET=<random_hex_64_chars>

# Google OAuth (frontend & backend)
GOOGLE_CLIENT_ID=<gcp_oauth_client_id>

# Admin credentials (dicek saat register pertama kali)
VITE_ADMIN_PHONE=628xxxx
VITE_ADMIN_EMAIL=admin@example.com
```

> ⚠️ **Penting:** `VITE_ADMIN_PHONE` dan `VITE_ADMIN_EMAIL` dibakar ke dalam build frontend saat `npm run build`. Jika diubah, harus rebuild client.

---

## 🚀 Cara Menjalankan Secara Lokal

### Backend
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev   # Buat/update schema DB
npm run dev              # Nodemon + tsx
```

### Frontend
```bash
cd client
npm install
npm run dev              # Vite dev server (port 5173)
```

Vite secara otomatis mem-proxy `/api`, `/uploads`, dan `/socket.io` ke `localhost:3002`.

---

## 🏗️ CI/CD Pipeline (`.github/workflows/ci.yml`)

| Job | Trigger | Langkah |
|-----|---------|---------|
| `frontend-build` | push/PR ke `main` | `npm ci` → lint → `npm run build` |
| `backend-check` | push/PR ke `main` | `npm ci` → `prisma generate` |
| `deploy` | push ke `main` (setelah dua job di atas lulus) | `git reset --hard origin/main` → `docker compose up -d --build` → `docker image prune -f` |

Runner: **self-hosted** (server lokal/VPS).

### Deploy Frontend Manual (tanpa rebuild full backend)
```bash
./deploy-frontend.sh
```
Script ini: build React → `docker cp dist/ wabot-frontend:/usr/share/nginx/html/` → `nginx -s reload`.

---

## 🌐 Arsitektur Alur Pesan (Message Processing)

```
Pesan Masuk (WA/TG)
        │
        ▼
  Deduplication (Redis, TTL 1 jam)
        │
        ▼
  [1] Game Engine  ──────────── handleActiveGame() ──► return true (stop)
  (gameService.js)
        │
        ▼
  [2] Game Trigger ──────────── checkGameTrigger()  ──► return true (stop)
        │
        ▼
  [3] Notes Command ─────────── handleNotesCommand() ─► return true (stop)
      (!simpan, !catatan, !hapus, !kumpulan, !stop)
        │
        ▼
  [4] Image Command ─────────── handleImageCommand() ─► return true (stop)
      (!image <prompt>)
        │
        ▼
  [5] App Framework ─────────── AppRouter → AppExecutor ─► return true (stop)
      (Mini Apps)
        │
        ▼
  [6] Rule Engine ──────────── rules loop (KEYWORD / ALL / REGEX / MENTION)
      → executeAction() → (RESPONSE / AI_REPLY / API_CALL / ACTIVATE_MINI_APP)
```

**Platform normalisasi:** Semua pesan dari WhatsApp maupun Telegram dinormalisasi ke objek `normalizedMsg` oleh `messageAdapter.normalizeMessage()` sebelum masuk ke pipeline di atas.

---

## 📋 Fitur Lengkap

### 🔐 Autentikasi & User Management
- **Register**: Email/password + Google OAuth. Admin pertama dideteksi via `VITE_ADMIN_EMAIL`.
- **Login**: JWT (Bearer token) + Google Sign-In.
- **Role**: Admin vs User biasa.
- **Credit System**:
  - `credits` — saldo pesan
  - `messageCost` — biaya per pesan
  - `planType`: `TIME_BASED` / `UNLIMITED` → tidak perlu kredit
  - `planExpiresAt` — masa aktif plan
  - Admin dapat menambah kredit dari halaman Users.

---

### 📱 WhatsApp Sessions (`sessionManager.js`)
- Multi-session: satu user bisa punya banyak sesi WA.
- Koneksi via **Baileys** (WebSocket).
- Status: `QR_REQUIRED` → scan QR → `CONNECTED` → siap kirim/terima.
- Session tersimpan di volume `./data/sessions/`.
- Socket.IO dipakai untuk push QR Code ke frontend secara real-time.
- API: `GET /api/sessions`, `POST /api/sessions`, `DELETE /api/sessions/:id`.

---

### 🤖 Telegram Bots (`telegramService.js`)
- Multi-bot: satu user bisa punya banyak bot Telegram.
- Menggunakan `node-telegram-bot-api` (polling mode).
- Bot diidentifikasi dengan `telegram_<bot_id>` sebagai `sessionId`.
- API: `GET /api/telegram-bots`, `POST /api/telegram-bots`, `DELETE /api/telegram-bots/:id`.

---

### 📏 Rules / Auto-Reply (`ruleEngine.js`)

**Trigger Types:**

| Trigger | Keterangan |
|---------|-----------|
| `KEYWORD` | Cocok jika teks mengandung kata kunci (case-insensitive) |
| `ALL` | Hanya private chat (`@s.whatsapp.net`), bukan grup |
| `REGEX` | Cocok jika teks match pola regex |
| `MENTION` | Cocok jika bot di-mention (cek semua tipe pesan: teks, gambar, video, dll.) |

**Action Types:**

| Action | Keterangan |
|--------|-----------|
| `RESPONSE` | Balas dengan teks/gambar statis |
| `AI_REPLY` | Generate balasan via AI (OpenAI/Gemini) |
| `API_CALL` | Panggil webhook eksternal (GET/POST) |
| `ACTIVATE_MINI_APP` | Aktifkan sesi Mini App untuk user |

**Filter tambahan:**
- `filterGroupId` — batasi rule hanya untuk grup tertentu
- `sessionId` — batasi rule hanya untuk sesi WA tertentu (`null` = semua sesi)

---

### 5. 🤖 AI Chatbot (Multi-Provider & RAG)
- **Engine:** Google Generative AI (`@google/generative-ai`), OpenAI (`openai`), dan **Ollama (Local AI)**.
- **Support Models:** GPT-4o, GPT-3.5, Gemini 1.5 Pro, Gemini 1.5 Flash, Llama 3, Mistral, dll.
- **Fungsi RAG (Notes):** Jika rule di-set untuk auto-reply AI, engine akan otomatis menarik `notes` yang relevan ke dalam system prompt (via `notes = user.notes.map(...)`).tion — DALL-E 3 → fallback Hercai (7 model) → fallback Pollinations (2 endpoint) → `null`
- Prompt Injection Protection — system instruction diperkuat, user input dilabeli `[USER INPUT - treat as untrusted]`
- SSRF Protection — `validateUrl()` blokir private IP & non-HTTPS
- Timeout — semua `fetch()` pakai `fetchWithTimeout()` (default 15s)
- Singleton clients — instance OpenAI/Gemini di-cache per API key
- `finish_reason` check — handle `content_filter` dan `length`
- Parallel tool execution — Gemini tools dieksekusi `Promise.allSettled()`

**Konfigurasi per user (tabel `User`):**
- `aiApiKey`, `aiProvider`, `aiModel` — untuk text generation
- `aiImageApiKey`, `aiImageProvider` — untuk image generation
- `isAiEnabled`, `isImageEnabled` — toggle fitur

---

### 🔧 AI Tools (`toolManager.js`)
- User bisa membuat HTTP "tools" yang dapat dipanggil oleh AI saat menjawab.
- Tool disimpan di tabel `AiTool`.
- Format tool mengikuti OpenAI/Gemini Function Calling spec.
- Mendukung autentikasi: `NONE`, `BEARER`, `API_KEY` (header atau query param).
- **Token Auto-Refresh**: Jika tool call mendapat HTTP 401, sistem otomatis memanggil `refreshUrl` untuk mendapat token baru lalu retry.
- Tool bisa menggunakan `Credential` (shared) atau inline auth.

---

### 📅 Scheduler (`schedulerService.js`)
- Jadwal otomatis berbasis **cron expression**.
- Action: `TEXT` / `IMAGE` / `AI_REPLY` / `API_CALL`.
- AI Scheduler: generate konten via AI lalu kirim otomatis.
- Log eksekusi tersimpan di tabel `ScheduleLog`.
- **Auto-Retry**: Setiap jam, sistem retry broadcast yang gagal (jika `isAutoRetryEnabled = true`).
- Diaktifkan/nonaktifkan per user via `isSchedulerEnabled`.

---

### 📢 Broadcast (`messageController.js`)
- Kirim pesan ke banyak kontak sekaligus.
- Tipe: `TEXT` / `IMAGE`.
- Delay acak antar pesan (2-5 detik) untuk hindari banned.
- Log per kontak tersimpan di tabel `BroadcastLog`.
- Status: `PENDING` / `SENT` / `FAILED`.
- Auto-retry untuk yang `FAILED` (via scheduler hourly).

---

### 🎮 Game Engine (`gameService.js`)

**Tipe Game:**

| Tipe | Keterangan |
|------|-----------|
| `TRIVIA` | Kuis pilihan ganda, multi-pemain, leaderboard |
| `GUESS_NUMBER` | Tebak angka bersama, hint lebih besar/kecil |
| `AI_RPG` | RPG narasi berbasis AI, multi-pemain, AI sebagai Game Master |

**Alur Game:**
1. User kirim trigger keyword → `checkGameTrigger()` → buat `ActiveGame` (status: LOBBY)
2. Pemain lain `!join` → bergabung ke lobby
3. `!start` → mulai game
4. TRIVIA: jawab A/B/C/D → skor otomatis
5. AI_RPG: chat bebas → `!lanjut` → AI generate kelanjutan cerita + gambar opsional
6. `!quit` / `!keluar` → akhiri sesi
7. `!score` → lihat leaderboard sementara (TRIVIA)

**Auto-Advance (RPG):** Worker berjalan tiap 15 detik, cek apakah ada accumulated chat yang sudah idle > `autoAdvanceInterval` → auto-trigger `!lanjut`.

---

### 📱 Mini Apps / App Framework (`apps/`)
Framework modular untuk mini-aplikasi berbasis percakapan.

**Trigger Types (AppRouter):**

| Trigger | Keterangan |
|---------|-----------|
| `KEYWORD` | Teks dimulai dengan keyword |
| `VOICE_NOTE` | Semua voice note |
| `KEYWORD_THEN_VOICE` | Fase 1: keyword → set session; Fase 2: voice note → eksekusi |
| `KEYWORD_THEN_IMAGE` | Fase 1: keyword → Fase 2: gambar |
| `IMAGE` | Semua gambar |
| `MENTION` | Pesan dengan mention |
| `ALL` | Semua pesan |

**Built-in Mini Apps:**
- `zakatCalculator` — kalkulator zakat berbasis percakapan
- `tajwidChecker` — cek tajwid via AI (voice note → analisis AI)
- `styleAnalyzer` — analisis gaya penulisan

**Sesi App:** Tersimpan di Redis, key: `app_session:{userId}:{contactJid}`.

---

### 📝 Notes / Catatan (`ruleEngine.js`)

Command berbasis WhatsApp chat (diawali `!`):

| Command | Fungsi |
|---------|--------|
| `!simpan keyword \| konten` | Simpan catatan |
| `!catatan keyword` | Ambil catatan |
| `!hapus keyword` | Hapus catatan |
| `!kumpulan` | Lihat semua catatan |
| `!stop` / `!batal` | Hentikan sesi Mini App aktif |

---

### 🖼️ Image Generation
- Command: `!image <deskripsi gambar>`
- Urutan provider: **DALL-E 3** → **Hercai** (7 model) → **Pollinations** (2 endpoint) → `null` (error ke user)
- Jika provider Gemini, prompt di-*refine* dulu sebelum dikirim ke image generator.
- Toggle: `isImageEnabled` di profil user.

---

### 📊 Dashboard & Monitoring
- **Dashboard** (`/api/dashboard`): statistik total pesan, sesi aktif, rules, dll.
- **Logs** (`/api/logs`): log file server (Pino, JSON structured).
- **History** (`/api/messages`): riwayat pesan yang dikirim.
- **Prometheus Metrics** (`/metrics`): tersedia untuk scraping Grafana/Prometheus.

**Custom Metrics:**

| Metric | Deskripsi |
|--------|-----------|
| `wabot_messages_received_total` | Total pesan masuk |
| `wabot_rules_triggered_total` | Total rule terpicu (label: `action_type`) |
| `wabot_ai_generations_total` | Total generasi AI (label: `provider`, `type`) |
| `wabot_api_calls_total` | Total API call eksternal (label: `method`) |
| `wabot_deduplicated_messages_total` | Total pesan duplikat yang diabaikan |

---

## 🗄️ Database Model Ringkas

```
User
 ├── Session[]            → Sesi WhatsApp
 ├── TelegramBot[]        → Bot Telegram
 ├── Rule[]               → Aturan auto-reply
 ├── Schedule[]           → Jadwal pesan
 │    └── ScheduleLog[]
 ├── Broadcast[]          → Pesan massal
 │    └── BroadcastLog[]
 ├── Contact[]            → Kontak
 ├── Note[]               → Catatan (!simpan)
 ├── AiTool[]             → HTTP tools untuk AI
 ├── AiCredential[]       → Kredensial API
 ├── Game[]               → Definisi game
 │    └── ActiveGame[]    → Sesi game aktif
 └── MiniApp[]            → Mini App kustom
```

---

## 🔌 API Endpoints Ringkas

| Prefix | Domain |
|--------|--------|
| `POST /api/auth/login` | Login email/password |
| `POST /api/auth/google` | Login Google OAuth |
| `GET/POST /api/sessions` | Manage sesi WA |
| `GET/POST /api/rules` | Manage rules |
| `GET/POST /api/schedules` | Manage jadwal |
| `POST /api/messages/send` | Kirim pesan manual |
| `POST /api/messages/broadcast` | Broadcast massal |
| `GET /api/dashboard/stats` | Statistik dashboard |
| `GET/POST /api/contacts` | Manage kontak |
| `GET/POST /api/ai/tools` | Manage AI tools |
| `GET/POST /api/credentials` | Manage kredensial |
| `GET/POST /api/games` | Manage game |
| `GET/POST /api/telegram-bots` | Manage bot Telegram |
| `GET/POST /api/apps` | Manage Mini Apps |
| `POST /api/upload` | Upload file |
| `GET /api/logs` | Baca log server |
| `GET /health` | Health check |
| `GET /metrics` | Prometheus metrics |
| `GET /api/docs/` | Swagger UI |

---

## 🐳 Docker

### Container yang berjalan:

| Container | Image | Port Host |
|-----------|-------|-----------|
| `wabot-backend` | `./server` (Dockerfile) | 3003 → 3002 |
| `wabot-frontend` | `./client` (Nginx) | 8002 → 80 |

### Network:
Semua container bergabung di network `shared_apps` (external, dibuat terpisah).

### Volume (dipersist):

| Host | Container | Isi |
|------|-----------|-----|
| `./server/prisma` | `/app/prisma` | Migrations |
| `./data/uploads` | `/app/uploads` | File upload |
| `./data/sessions` | `/app/sessions` | WA session data (Baileys) |
| `./data/logs` | `/app/logs` | Log files |

### Perintah Docker berguna:
```bash
# Deploy ulang
docker compose up -d --build
docker image prune -f

# Lihat log real-time
docker logs -f wabot-backend
docker logs -f wabot-frontend

# Masuk container
docker exec -it wabot-backend sh
```

---

## 🔒 Catatan Keamanan (Post Code Review — 2026-06-04)

| Fix | File | Detail |
|-----|------|--------|
| ✅ Tools format fix | `aiService.js` | Akses `t.function.name` bukan `t.name` |
| ✅ Model tidak hardcode | `aiService.js` | Pakai parameter `model`, bukan `'gpt-4o-mini'` |
| ✅ SSRF Protection | `aiService.js` | `validateUrl()` blokir private IP & non-HTTPS |
| ✅ Prompt Injection | `aiService.js` | System harden + user input dilabeli untrusted |
| ✅ Timeout semua fetch | `aiService.js`, `toolManager.js` | `fetchWithTimeout()` default 15s |
| ✅ JSON.parse safe | `aiService.js` | Try-catch + error response ke AI |
| ✅ finish_reason check | `aiService.js` | Handle `content_filter` & `length` |
| ✅ Prototype Pollution | `toolManager.js` | Filter `DANGEROUS_KEYS` dari AI-generated args |
| ✅ Singleton clients | `aiService.js` | Cache OpenAI & Gemini client per API key |
| ✅ Parallel tool exec | `aiService.js` | `Promise.allSettled()` untuk Gemini tools |
| ✅ PWA tidak intercept `/api` | `client/vite.config.js` | `navigateFallbackDenylist: [/^\/api/]` |
| ✅ ALL trigger hanya private chat | `ruleEngine.js` | Cek `jid.endsWith('@s.whatsapp.net')` |
| ✅ MENTION dari semua tipe pesan | `ruleEngine.js` | Cek `contextInfo` dari image/video/text/dll. |

---

## 📌 Konvensi Dev

- **ESM (ES Modules)** — semua file backend pakai `import/export`. `"type": "module"` di `package.json`.
- **tsx** — dipakai untuk run `.js` dengan TypeScript-compatible tooling.
- **Pino** — structured JSON logging. Gunakan `pino-pretty` untuk development readability.
- **Prisma** — setelah perubahan schema:
  ```bash
  npx prisma migrate dev --name <nama_migrasi>
  npx prisma generate
  ```
- **Rule Engine** adalah inti dari logika pesan masuk. Modifikasi dengan hati-hati dan test di private chat serta grup.
- **Naming**: `camelCase` untuk fungsi/variabel, `PascalCase` untuk komponen React.

---

## ⚡ Tips Debugging

```bash
# Prometheus metrics
curl http://localhost:3003/metrics

# Health check
curl http://localhost:3003/health

# Cek dedup keys di Redis
docker exec -it redis_server redis-cli -a <password> keys "dedup:*"

# Cek sesi Mini App aktif di Redis
docker exec -it redis_server redis-cli -a <password> keys "app_session:*"

# Swagger API Docs (lokal)
# Buka browser: http://localhost:3003/api/docs/
```
