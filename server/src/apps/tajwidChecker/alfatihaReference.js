/**
 * Referensi teks Al-Fatiha berharakat lengkap
 * Dipecah per-kata untuk alignment dengan transkripsi Whisper
 */

export const AL_FATIHA_WORDS = [
  { id: 1,  arabic: 'بِسْمِ',         transliteration: 'bismi',         ayat: 1 },
  { id: 2,  arabic: 'اللَّهِ',        transliteration: 'llāhi',          ayat: 1 },
  { id: 3,  arabic: 'الرَّحْمَٰنِ',   transliteration: 'r-raḥmāni',     ayat: 1 },
  { id: 4,  arabic: 'الرَّحِيمِ',     transliteration: 'r-raḥīmi',      ayat: 1 },
  { id: 5,  arabic: 'الْحَمْدُ',      transliteration: 'al-ḥamdu',      ayat: 2 },
  { id: 6,  arabic: 'لِلَّهِ',        transliteration: 'lillāhi',        ayat: 2 },
  { id: 7,  arabic: 'رَبِّ',          transliteration: 'rabbi',          ayat: 2 },
  { id: 8,  arabic: 'الْعَالَمِينَ',  transliteration: "l-ʿālamīna",    ayat: 2 },
  { id: 9,  arabic: 'الرَّحْمَٰنِ',   transliteration: 'r-raḥmāni',     ayat: 3 },
  { id: 10, arabic: 'الرَّحِيمِ',     transliteration: 'r-raḥīmi',      ayat: 3 },
  { id: 11, arabic: 'مَالِكِ',        transliteration: 'māliki',         ayat: 4 },
  { id: 12, arabic: 'يَوْمِ',         transliteration: 'yawmi',          ayat: 4 },
  { id: 13, arabic: 'الدِّينِ',       transliteration: 'd-dīni',         ayat: 4 },
  { id: 14, arabic: 'إِيَّاكَ',       transliteration: 'iyyāka',         ayat: 5 },
  { id: 15, arabic: 'نَعْبُدُ',       transliteration: "naʿbudu",        ayat: 5 },
  { id: 16, arabic: 'وَإِيَّاكَ',     transliteration: 'wa-iyyāka',      ayat: 5 },
  { id: 17, arabic: 'نَسْتَعِينُ',    transliteration: "nastaʿīnu",      ayat: 5 },
  { id: 18, arabic: 'اهْدِنَا',       transliteration: 'ihdinā',         ayat: 6 },
  { id: 19, arabic: 'الصِّرَاطَ',     transliteration: 'ṣ-ṣirāṭa',      ayat: 6 },
  { id: 20, arabic: 'الْمُسْتَقِيمَ', transliteration: 'l-mustaqīma',   ayat: 6 },
  { id: 21, arabic: 'صِرَاطَ',        transliteration: 'ṣirāṭa',         ayat: 7 },
  { id: 22, arabic: 'الَّذِينَ',      transliteration: 'lladhīna',       ayat: 7 },
  { id: 23, arabic: 'أَنْعَمْتَ',     transliteration: "anʿamta",        ayat: 7 },
  { id: 24, arabic: 'عَلَيْهِمْ',     transliteration: "ʿalayhim",       ayat: 7 },
  { id: 25, arabic: 'غَيْرِ',         transliteration: 'ghayri',         ayat: 7 },
  { id: 26, arabic: 'الْمَغْضُوبِ',   transliteration: 'l-maghḍūbi',    ayat: 7 },
  { id: 27, arabic: 'عَلَيْهِمْ',     transliteration: "ʿalayhim",       ayat: 7 },
  { id: 28, arabic: 'وَلَا',          transliteration: 'walā',            ayat: 7 },
  { id: 29, arabic: 'الضَّالِّينَ',   transliteration: 'ḍ-ḍāllīna',     ayat: 7 },
];

// Teks lengkap dalam satu string
export const FULL_TEXT = AL_FATIHA_WORDS.map(w => w.arabic).join(' ');

// Teks per-ayat
export const AYAT_TEXTS = [1, 2, 3, 4, 5, 6, 7].map(ayatNum => ({
  ayat: ayatNum,
  text: AL_FATIHA_WORDS.filter(w => w.ayat === ayatNum).map(w => w.arabic).join(' ')
}));

// Hukum tajwid kunci per-kata yang wajib diperhatikan
export const TAJWID_NOTES = {
  3:  'Al-Syamsiyah pada ر + Mad Thabi\'i pada مَٰنِ',
  4:  'Mad Thabi\'i pada حِيمِ (2 harakat)',
  5:  'Al-Qamariyah pada الْ',
  8:  'Mad Thabi\'i pada مِينَ (2 harakat)',
  13: 'Al-Syamsiyah pada دِّ (idgham)',
  17: 'Mad \'Aridh Lissukun saat waqaf',
  19: 'Al-Syamsiyah pada صِّ',
  20: 'Mad \'Aridh Lissukun saat waqaf',
  24: 'Sukun pada مْ (ikhfa syafawi jika bertemu ب)',
  27: 'Sukun pada مْ',
  29: 'Mad Lazim Mutsaqqal Kilmi pada لِّ (6 harakat) + Al-Syamsiyah',
};
