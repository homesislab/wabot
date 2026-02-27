# Fitur Aplikasi Wabot (Smart Mosque Admin)

Aplikasi Wabot saat ini memiliki berbagai fitur utama yang mendukung operasional notifikasi, *auto-reply*, dan interaksi *chatbot*:

## 1. Multi-Platform & Multi-Session
Sistem mendukung penggunaan banyak nomor WhatsApp sekaligus (melalui scan QR) dan pembuatan banyak bot Telegram di dalam satu *dashboard* server yang tersentralisasi.

## 2. Mesin Aturan Otomatis (Rule Engine)
Bot dapat membalas pesan secara otomatis berdasarkan:
- Kata kunci spesifik (*Keyword*)
- Pencocokan Pola (*Regex*)
- Deteksi *Mention* (saat bot ditag di dalam grup)

Aksi balasan (*Action*) yang didukung meliputi:
- Balasan Teks dan Gambar
- Memanggil API pihak ketiga (*Webhook/API Call*)
- Balasan AI (*AI Chatbot*)

## 3. Integrasi AI Pintar
Bot terhubung dengan layanan AI (seperti OpenAI, dsb) untuk berinteraksi dengan pengguna secara natural. Mode AI ini:
- Dilengkapi sistem *Credits* per-pengguna untuk membatasi kuota penggunaan AI.
- Mendukung "Custom Tools / Function Calling", di mana bot AI bisa mengeksekusi instruksi khusus saat mengobrol.

## 4. Sistem Tunda & Jadwal Pesan
Mendukung pengiriman pesan otomatis dan terjadwal (*Broadcast / Scheduler*) baik untuk WhatsApp maupun Telegram. Sistem *scheduler* ini dapat diatur hingga tingkat *cron job* untuk pesan berulang (misal: pengingat waktu shalat atau acara masjid).

## 5. Mini Games Interaktif (Multiplayer)
Bot memiliki *engine game* berbasis teks yang bisa dimainkan bersama di grup chat:
- **Tebak Angka (Guess Number):** Menebak angka rahasia secara kooperatif.
- **Kuis Cerdas Cermat (Trivia):** Menjawab soal pilihan ganda dengan fitur *live leaderboard* / papan skor langsung.
- **Game RPG berbasis AI:** Mode permainan interaktif di mana AI bertindak sebagai "Game Master" yang membangkitkan peran, skenario, dan kelanjutan aksi pemain layaknya RPG *Tabletop*.

## 6. Catatan Singkat (Notes & Bookmarks)
Sistem pencatatan ringan via perintah chat (*command*):
- `!simpan <keyword> | <isi catatan>`: Untuk menyimpan catatan.
- `!catatan <keyword>`: Untuk memanggil isi catatan.
- `!kumpulan`: Untuk melihat daftar nama catatan yang pernah disimpan.
