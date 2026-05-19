import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Plus, Trash, Edit, X, Mic, Keyboard, Zap, ChevronDown, ChevronUp, Loader, Camera } from 'lucide-react';

const categoryColors = {
  'Islami':   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Utilitas': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Edukasi':  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'default':  'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const TRIGGER_TYPES = [
  { value: 'KEYWORD',           label: 'Keyword App',         icon: <Keyboard size={16}/>, desc: 'Aktif saat user kirim kata kunci tertentu' },
  { value: 'KEYWORD_THEN_VOICE',label: 'Voice App (with Keyword)', icon: <Mic size={16}/>, desc: 'Keyword untuk aktifkan mode → user kirim voice note' },
  { value: 'KEYWORD_THEN_IMAGE',label: 'Image App (with Keyword)', icon: <Camera size={16}/>, desc: 'Keyword untuk aktifkan mode → user kirim gambar' },
  { value: 'VOICE_APP',         label: 'Voice App (direct)',   icon: <Mic size={16}/>, desc: 'Aktif langsung saat menerima voice note' },
];

const CATEGORIES = ['Islami', 'Utilitas', 'Edukasi', 'Bisnis', 'Hiburan', 'General'];
const ICONS = ['🤖','🕌','💰','📚','🎵','🍕','🏥','💼','🌍','⚽','🎮','📸','🔔','✉️','📊','🎓','🙏','💎'];

const getTriggerLabel = (trigger) => {
  if (!trigger) return 'Manual';
  if (typeof trigger === 'string') return trigger;
  const labels = {
    VOICE_NOTE:        '🎙️ Voice Note (direct)',
    KEYWORD_THEN_VOICE:'🎙️ Voice App',
    KEYWORD_THEN_IMAGE:'📸 Image App',
    KEYWORD:           `⌨️ ${Array.isArray(trigger.value) ? trigger.value.join(', ') : (trigger.value || '')}`,
    IMAGE:             '🖼️ Gambar',
    ALL:               '📨 Semua Pesan',
  };
  return labels[trigger.type] || trigger.type;
};

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
      ${checked ? 'bg-emerald-500' : 'bg-gray-600'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
      ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const EMPTY_FORM = {
  name: '', description: '', icon: '🤖', category: 'General', color: '#6366f1',
  triggerType: 'KEYWORD', triggerKeywords: '', systemPrompt: '', activationMsg: '',
  referenceText: ''
};

export default function MiniApps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});
  const [filter, setFilter] = useState('Semua');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingIsStatic, setEditingIsStatic] = useState(false);

  const fetchApps = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/apps');
      setApps(res.data);
    } catch (err) {
      console.error('Failed to fetch apps', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleToggle = async (app) => {
    setToggling(prev => ({ ...prev, [app.id]: true }));
    try {
      await api.put(`/apps/${app.id}/toggle`, { isEnabled: !app.isEnabled });
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, isEnabled: !a.isEnabled } : a));
    } catch (err) {
      console.error('Toggle failed', err);
    } finally {
      setToggling(prev => ({ ...prev, [app.id]: false }));
    }
  };

  const handleEdit = (app) => {
    setEditingId(app.id);
    const isStatic = app.isStatic || (app.handlerType && app.handlerType !== 'DYNAMIC');
    setEditingIsStatic(isStatic);
    const keywords = Array.isArray(app.triggerKeywords)
      ? app.triggerKeywords.join(', ')
      : (Array.isArray(app.trigger?.value) ? app.trigger.value.join(', ') : (app.trigger?.value || ''));
    setForm({
      name: app.name || '',
      description: app.description || '',
      icon: app.icon || '🤖',
      category: app.category || 'General',
      color: app.color || '#6366f1',
      triggerType: app.triggerType || (app.trigger?.type === 'VOICE_NOTE' ? 'VOICE_APP' : (app.trigger?.type || 'KEYWORD')),
      triggerKeywords: keywords,
      systemPrompt: app.systemPrompt || '',
      activationMsg: app.activationMessage || app.activationMsg || '',
      referenceText: app.referenceText || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (app) => {
    if (app.isStatic || (app.handlerType && app.handlerType !== 'DYNAMIC')) {
      return alert('App bawaan tidak bisa dihapus, hanya bisa dinonaktifkan.');
    }
    if (!confirm(`Hapus "${app.name}"?`)) return;
    await api.delete(`/apps/${app.id}`);
    fetchApps();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await api.put(`/apps/${editingId}`, payload);
      } else {
        await api.post('/apps', payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchApps();
    } catch (err) {
      console.error('Save failed', err);
      alert('Gagal menyimpan Mini App');
    } finally {
      setSaving(false);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const needsKeyword = form.triggerType === 'KEYWORD' || form.triggerType === 'KEYWORD_THEN_VOICE' || form.triggerType === 'KEYWORD_THEN_IMAGE';
  const needsActivation = form.triggerType === 'KEYWORD_THEN_VOICE' || form.triggerType === 'KEYWORD_THEN_IMAGE' || editingIsStatic;
  const categories = ['Semua', ...new Set(apps.map(a => a.category).filter(Boolean))];
  const filtered = filter === 'Semua' ? apps : apps.filter(a => a.category === filter);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl">🧩</div>
          <div>
            <h1 className="text-xl font-bold">Mini Apps</h1>
            <p className="text-sm text-gray-400">Aktifkan fitur tambahan untuk bot WhatsApp Anda</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          <Plus size={16} /> Buat Mini App
        </button>
      </div>

      {/* CREATE / EDIT FORM */}
      {showForm && (
        <div className="bg-gray-900 border border-violet-500/30 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-lg text-violet-300">
              {editingId
                ? (editingIsStatic ? '⚙️ Konfigurasi App Bawaan' : '✏️ Edit Mini App')
                : '✨ Buat Mini App Baru'}
            </h2>
            <button onClick={cancelForm} className="text-gray-400 hover:text-white"><X size={20}/></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name + Icon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-sm text-gray-400 mb-1">Icon</label>
                <button type="button" onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center text-2xl hover:border-violet-500 transition-colors">
                  {form.icon}
                </button>
                {showIconPicker && (
                  <div className="absolute top-14 left-0 z-10 bg-gray-800 border border-gray-700 rounded-xl p-3 grid grid-cols-6 gap-2 shadow-2xl">
                    {ICONS.map(ic => (
                      <button key={ic} type="button" onClick={() => { setForm(f=>({...f, icon: ic})); setShowIconPicker(false); }}
                        className="text-2xl hover:bg-gray-700 rounded-lg p-1 transition-colors">{ic}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Nama App *</label>
                <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder="Contoh: Konsultasi Hukum Islam"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"/>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
              <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                placeholder="Jelaskan fungsi app ini secara singkat"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"/>
            </div>

            {/* Category + Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Warna Kartu</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                    className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer"/>
                  <span className="text-sm text-gray-400">{form.color}</span>
                </div>
              </div>
            </div>

            {/* Static app notice */}
            {editingIsStatic && (
              <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                <span className="text-lg mt-0.5">ℹ️</span>
                <div>
                  <p className="font-semibold mb-0.5">App Bawaan</p>
                  <p className="text-blue-300/70">Anda bisa mengubah nama, ikon, deskripsi, dan keyword trigger. Tipe app dan sistem AI tidak bisa diubah karena menggunakan engine khusus.</p>
                </div>
              </div>
            )}

            {/* Trigger Type — locked for static */}
            {!editingIsStatic && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tipe App *</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TRIGGER_TYPES.map(t => (
                  <label key={t.value}
                    className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all
                      ${form.triggerType === t.value
                        ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                        : 'border-gray-700 hover:border-gray-500 text-gray-400'}`}>
                    <input type="radio" name="triggerType" value={t.value} className="hidden"
                      checked={form.triggerType === t.value}
                      onChange={() => setForm(f=>({...f, triggerType: t.value}))}/>
                    <span className="mt-0.5">{t.icon}</span>
                    <div>
                      <p className="font-medium text-sm text-white">{t.label}</p>
                      <p className="text-xs mt-0.5">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            )}

            {/* Keywords — tampil untuk semua tipe kecuali VOICE_APP direct */}
            {(needsKeyword || editingIsStatic) && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Keywords <span className="text-gray-500">(pisahkan dengan koma)</span>
                </label>
                <input value={form.triggerKeywords} onChange={e=>setForm(f=>({...f,triggerKeywords:e.target.value}))}
                  placeholder="!tajwid, cek tajwid, tajwid"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"/>
                <p className="text-xs text-gray-500 mt-1">Bot akan aktif saat pesan mengandung salah satu keyword ini</p>
              </div>
            )}



            {/* Activation Message (hanya untuk KEYWORD_THEN_VOICE) */}
            {needsActivation && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Pesan Aktivasi</label>
                <textarea rows={2} value={form.activationMsg} onChange={e=>setForm(f=>({...f,activationMsg:e.target.value}))}
                  placeholder="Contoh: ✅ Siap! Silahkan kirim voice note Anda sekarang. Sesi aktif 5 menit."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none"/>
                <p className="text-xs text-gray-500 mt-1">Dikirim ke user setelah keyword diterima, sebelum voice note</p>
              </div>
            )}

            {/* System Prompt — bisa diedit semua app, tapi opsional untuk static */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                System Prompt / AI Briefing
                {!editingIsStatic && <span className="text-red-400"> *</span>}
              </label>
              <textarea
                required={!editingIsStatic}
                rows={5}
                value={form.systemPrompt}
                onChange={e=>setForm(f=>({...f,systemPrompt:e.target.value}))}
                placeholder={editingIsStatic
                  ? `Opsional. Kosongkan untuk pakai prompt default engine.\n\nContoh override:\nKamu adalah guru tajwid khusus untuk surah Al-Baqarah ayat 1-5.\n{{REFERENSI}} ← gunakan placeholder ini untuk inject teks referensi.`
                  : `Contoh:\nKamu adalah asisten hukum Islam. Jawab pertanyaan user dengan referensi Al-Quran dan hadis yang shahih. Gunakan bahasa Indonesia yang mudah dipahami.`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none font-mono text-sm"/>
              <p className="text-xs text-gray-500 mt-1">
                {editingIsStatic
                  ? <>Kosongkan = pakai engine default. Gunakan <code className="bg-gray-700 px-1 rounded text-violet-300">{'{{REFERENSI}}'}</code> sebagai placeholder untuk inject teks referensi di bawah.</>
                  : 'Instruksi untuk AI tentang cara merespons user. Semakin detail semakin akurat.'}
              </p>
            </div>

            {/* Reference Text — untuk inject teks/materi referensi ke AI */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Teks Referensi <span className="text-gray-500">(opsional)</span>
              </label>
              <textarea
                rows={6}
                value={form.referenceText || ''}
                onChange={e=>setForm(f=>({...f,referenceText:e.target.value}))}
                placeholder={editingIsStatic
                  ? `Teks referensi bacaan yang dianalisis.\nKosongkan untuk pakai referensi default (Al-Fatiha dengan harakat).\n\nContoh isi: ayat-ayat dari surah lain, teks doa, dll.`
                  : `Teks referensi yang akan disertakan ke AI.\nContoh: data produk, daftar hukum, teks peraturan, dsb.`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none font-mono text-sm"/>
              <p className="text-xs text-gray-500 mt-1">
                {editingIsStatic
                  ? 'Teks ini menggantikan referensi default (Al-Fatiha). Kosongkan untuk tetap pakai referensi bawaan.'
                  : 'Teks ini akan ditambahkan ke context AI sebagai data referensi.'}
              </p>
            </div>


            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={cancelForm}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
                Batal
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors text-sm disabled:opacity-50">
                {saving ? <Loader size={16} className="animate-spin"/> : <Plus size={16}/>}
                {editingId ? 'Simpan Perubahan' : 'Buat Mini App'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-5">
        <span className="bg-gray-800 px-3 py-1 rounded-full text-sm font-medium text-emerald-400">
          {apps.filter(a => a.isEnabled).length} Aktif
        </span>
        <span className="bg-gray-800 px-3 py-1 rounded-full text-sm font-medium text-gray-400">
          {apps.length} Total Apps
        </span>
        <span className="bg-violet-500/20 px-3 py-1 rounded-full text-sm font-medium text-violet-400">
          {apps.filter(a => a.isDbApp).length} Custom Apps
        </span>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === cat
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* App Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">
          <Loader size={32} className="animate-spin mx-auto mb-3"/>
          Memuat apps...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(app => (
            <div key={app.id}
              className={`rounded-2xl p-5 border transition-all ${app.isEnabled ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/50 opacity-70'}`}
              style={{ borderLeftColor: app.isEnabled ? (app.color || '#6366f1') : undefined, borderLeftWidth: app.isEnabled ? 3 : 1 }}>

              {/* App Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `${app.color || '#6366f1'}22` }}>
                    {app.icon || '🤖'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{app.name}</h3>
                      {app.isEnabled && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">AKTIF</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border mt-0.5 inline-block ${categoryColors[app.category] || categoryColors.default}`}>
                      {app.category}
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  checked={!!app.isEnabled}
                  onChange={() => handleToggle(app)}
                  disabled={!!toggling[app.id]}
                />
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{app.description}</p>

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300 flex items-center gap-1">
                  <Zap size={11}/> {getTriggerLabel(app.trigger)}
                </span>
                {app.requiresApiKey && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">🔑 API Key</span>
                )}
                {app.isStatic ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">v{app.version} · {app.author}</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">✨ Custom</span>
                )}
              </div>

              {/* Actions — Edit untuk semua, Hapus hanya custom */}
              <div className="flex gap-2 pt-2 border-t border-gray-800">
                <button onClick={() => handleEdit(app)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-400 transition-colors px-2 py-1 rounded hover:bg-violet-500/10">
                  <Edit size={13}/> {app.isStatic ? 'Konfigurasi' : 'Edit'}
                </button>
                {!app.isStatic && (
                  <button onClick={() => handleDelete(app)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10">
                    <Trash size={13}/> Hapus
                  </button>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="col-span-2 text-center py-16 text-gray-500">
              <div className="text-4xl mb-3">🧩</div>
              <p className="font-medium">Belum ada Mini App</p>
              <p className="text-sm mt-1">Klik "Buat Mini App" untuk membuat app pertama Anda</p>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mt-8 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300/80">
        <p className="font-semibold mb-2">💡 Cara Kerja Mini Apps</p>
        <ul className="space-y-1 text-amber-300/60 text-xs">
          <li>• Aktifkan app yang ingin digunakan dengan toggle di atas</li>
          <li>• <strong>Keyword App:</strong> Bot langsung merespons saat keyword dikirim</li>
          <li>• <strong>Voice App:</strong> Kirim keyword dulu → bot siap → kirim voice note → AI analisis</li>
          <li>• App dengan label 🔑 memerlukan OpenAI / Gemini API Key di <a href="/profile" className="underline hover:text-amber-300">Profil</a></li>
          <li>• Ketik <strong>!stop</strong> untuk mengakhiri sesi Voice App secara manual</li>
        </ul>
      </div>
    </div>
  );
}
