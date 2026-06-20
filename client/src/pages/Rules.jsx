import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Trash, Zap, MessageSquare, Globe, Upload, Loader, Edit, X, Bot, Grid, Power, Puzzle, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TRIGGER_OPTIONS = [
  { value: 'KEYWORD',        label: 'Keyword',        desc: 'Cocok jika pesan mengandung kata kunci' },
  { value: 'ALL',            label: 'Semua Pesan',    desc: 'Setiap pesan masuk akan ditangani' },
  { value: 'REGEX',          label: 'Regex',          desc: 'Cocok berdasarkan pola regex' },
  { value: 'MENTION',        label: 'Tag / Mention',  desc: 'Saat bot di-tag (@bot)' },
  { value: 'DIRECT_MESSAGE', label: 'Pesan Langsung', desc: 'Hanya dari chat pribadi (bukan grup)' },
];

const ACTION_TYPES = [
  { value: 'RESPONSE',         label: 'Balas Teks/Gambar', icon: <MessageSquare size={16}/>, color: 'emerald' },
  { value: 'API_CALL',         label: 'Webhook API',       icon: <Globe size={16}/>,         color: 'blue'    },
  { value: 'AI_REPLY',         label: 'AI Reply',          icon: <Bot size={16}/>,           color: 'purple'  },
  { value: 'ACTIVATE_MINI_APP',label: 'Aktifkan Mini App', icon: <Puzzle size={16}/>,        color: 'amber'   },
];

const triggerBadge = (type) => {
  const map = {
    ALL:            { label: '📨 Semua Pesan',    cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    KEYWORD:        { label: '⌨️ Keyword',         cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    REGEX:          { label: '🔍 Regex',           cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    MENTION:        { label: '🔔 Mention',         cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    DIRECT_MESSAGE: { label: '💬 Japri',           cls: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  };
  const parts = String(type || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  return parts.map(p => map[p] || { label: p, cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' });
};

const actionBadge = (actionType) => {
  const map = {
    RESPONSE:         '💬 Balas Teks',
    API_CALL:         '🌐 Webhook',
    AI_REPLY:         '🤖 AI Reply',
    ACTIVATE_MINI_APP:'🧩 Mini App',
  };
  return map[actionType] || actionType;
};

const EMPTY_FORM = {
  name: '', triggerType: 'KEYWORD', triggerValue: '', actionType: 'RESPONSE',
  apiUrl: '', apiMethod: 'POST', apiPayload: '{}', responseContent: '',
  responseMediaType: 'TEXT', responseMediaUrl: '', sessionId: '',
  filterGroupId: '', credentialId: '', miniAppId: ''
};

export default function Rules() {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [miniApps, setMiniApps] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showInfoBox, setShowInfoBox] = useState(false);

  useEffect(() => {
    fetchRules(); fetchSessions(); fetchCredentials(); fetchMiniApps();
  }, []);

  useEffect(() => {
    if (formData.sessionId) fetchGroups(formData.sessionId);
    else setGroups([]);
  }, [formData.sessionId]);

  const fetchRules       = async () => { const r = await api.get('/rules');       setRules(r.data); };
  const fetchSessions    = async () => { try { const r = await api.get('/sessions');    setSessions(r.data); } catch {}};
  const fetchCredentials = async () => { try { const r = await api.get('/credentials'); setCredentials(r.data); } catch {}};
  const fetchMiniApps    = async () => { try { const r = await api.get('/apps');        setMiniApps(r.data || []); } catch {}};
  const fetchGroups = async (sid) => { try { const r = await api.get(`/sessions/${sid}/groups`); setGroups(r.data); } catch {}};

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...formData };
      if (!payload.credentialId) payload.credentialId = null;
      if (editingRuleId) await api.put(`/rules/${editingRuleId}`, payload);
      else               await api.post('/rules', payload);
      handleCancelEdit(); fetchRules();
    } catch { alert('Gagal menyimpan rule'); }
    finally { setSaving(false); }
  };

  const handleEdit = (rule) => {
    setEditingRuleId(rule.id);
    setFormData({
      name:             rule.name,
      triggerType:      rule.triggerType,
      triggerValue:     rule.triggerValue || '',
      actionType:       rule.actionType,
      apiUrl:           rule.apiUrl || '',
      apiMethod:        rule.apiMethod || 'POST',
      apiPayload:       rule.apiPayload || '{}',
      responseContent:  rule.responseContent || '',
      responseMediaType:rule.responseMediaType || 'TEXT',
      responseMediaUrl: rule.responseMediaUrl || '',
      sessionId:        rule.sessionId || '',
      filterGroupId:    rule.filterGroupId || '',
      credentialId:     rule.credentialId || '',
      miniAppId:        rule.miniAppId || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => { setEditingRuleId(null); setFormData(EMPTY_FORM); };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('image', file);
    try {
      const r = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFormData(prev => ({ ...prev, responseMediaUrl: r.data.url }));
    } catch { alert('Upload gagal'); }
    finally { setUploading(false); }
  };

  const openGallery = async () => {
    setShowGallery(true);
    try { const r = await api.get('/upload'); setGalleryImages(r.data); } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus rule ini?')) return;
    await api.delete(`/rules/${id}`); fetchRules();
  };

  const handleToggle = async (rule) => {
    try { await api.put(`/rules/${rule.id}`, { isActive: !rule.isActive }); fetchRules(); }
    catch { alert('Gagal update status'); }
  };

  const selectedTriggers = String(formData.triggerType || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const needsTriggerValue = selectedTriggers.some(t => t === 'KEYWORD' || t === 'REGEX');

  // Group rules by session
  const grouped = rules.reduce((acc, rule) => {
    const key = rule.sessionId
      ? (sessions.find(s => s.id === rule.sessionId)?.name || 'Session')
      : 'Semua Session (Global)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule); return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Zap size={20} className="text-white"/>
          </div>
          <div>
            <h1 className="text-xl font-bold">Auto Reply Rules</h1>
            <p className="text-sm text-gray-400">Atur balasan otomatis berdasarkan trigger pesan</p>
          </div>
        </div>
        <button onClick={() => setShowInfoBox(v => !v)}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          💡 Bedanya Rules vs Mini Apps <ChevronDown size={12} className={`transition-transform ${showInfoBox ? 'rotate-180' : ''}`}/>
        </button>
      </div>

      {/* Info box — perbedaan Rules vs Mini Apps */}
      {showInfoBox && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="font-bold text-emerald-400 mb-2">⚡ Rules (halaman ini)</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Balas pesan dengan teks statis, gambar, atau webhook</li>
              <li>• Bisa filter berdasarkan grup / sesi tertentu</li>
              <li>• Trigger: Keyword, Mention, DM, Semua pesan</li>
              <li>• Bisa juga pakai AI Reply atau aktifkan Mini App</li>
            </ul>
          </div>
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
            <p className="font-bold text-violet-400 mb-2">🧩 Mini Apps (halaman lain)</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Fitur AI khusus: voice note, analisis gambar, tajwid, dll</li>
              <li>• Mendukung sesi multi-langkah (keyword → kirim file)</li>
              <li>• Punya system prompt dan konfigurasi AI sendiri</li>
              <li>• Tidak perlu dibuat di Rules — sudah punya trigger sendiri</li>
            </ul>
          </div>
        </div>
      )}

      {/* Form */}
      <div className={`bg-gray-900 border rounded-2xl p-6 mb-8 shadow-xl transition-colors ${
        editingRuleId ? 'border-emerald-500/40' : 'border-gray-800'
      }`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg text-emerald-300">
            {editingRuleId ? '✏️ Edit Rule' : '✨ Buat Rule Baru'}
          </h2>
          {editingRuleId && (
            <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white">
              <X size={20}/>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Name + Session */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nama Rule *</label>
              <input required value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                placeholder="Contoh: Sambutan Grup"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"/>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Session <span className="text-gray-600">(opsional)</span></label>
              <select value={formData.sessionId} onChange={e => setFormData(p => ({...p, sessionId: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                <option value="">Semua Session (Global)</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Filter Group */}
          {formData.sessionId && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Filter Grup <span className="text-gray-600">(opsional)</span></label>
              <select value={formData.filterGroupId} onChange={e => setFormData(p => ({...p, filterGroupId: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                <option value="">Semua Chat</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.subject}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Rule hanya aktif di grup ini</p>
            </div>
          )}

          {/* Trigger Type — checkbox multi */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Trigger <span className="text-gray-600 text-xs">(bisa pilih lebih dari satu)</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TRIGGER_OPTIONS.map(opt => {
                const isChecked = selectedTriggers.includes(opt.value);
                return (
                  <label key={opt.value}
                    className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all ${
                      isChecked
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-gray-700 hover:border-gray-500 text-gray-400'
                    }`}>
                    <input type="checkbox" className="hidden" checked={isChecked}
                      onChange={() => {
                        const next = isChecked
                          ? selectedTriggers.filter(v => v !== opt.value)
                          : [...selectedTriggers, opt.value];
                        setFormData(p => ({...p, triggerType: next.join(',')}));
                      }}/>
                    <span className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 ${
                      isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                    }`}>
                      {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{opt.label}</p>
                      <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Trigger Value */}
          {needsTriggerValue && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {selectedTriggers.includes('REGEX') ? 'Pola Regex' : 'Kata Kunci'}
              </label>
              <input required value={formData.triggerValue}
                onChange={e => setFormData(p => ({...p, triggerValue: e.target.value}))}
                placeholder={selectedTriggers.includes('REGEX') ? '^Halo.*' : 'halo, hi, selamat'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"/>
              <p className="text-xs text-gray-500 mt-1">Pisahkan dengan koma untuk beberapa kata kunci</p>
            </div>
          )}

          {/* Action Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Aksi</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ACTION_TYPES.filter(a => a.value !== 'AI_REPLY' || user?.isAiEnabled).map(act => (
                <label key={act.value}
                  className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                    formData.actionType === act.value
                      ? `border-${act.color}-500 bg-${act.color}-500/10 text-${act.color}-300`
                      : 'border-gray-700 hover:border-gray-500 text-gray-400'
                  }`}>
                  <input type="radio" name="actionType" className="hidden"
                    value={act.value} checked={formData.actionType === act.value}
                    onChange={() => setFormData(p => ({...p, actionType: act.value}))}/>
                  {act.icon}
                  <span className="text-sm font-medium text-white">{act.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* RESPONSE */}
          {formData.actionType === 'RESPONSE' && (
            <div className="space-y-3">
              <div className="flex gap-4">
                {['TEXT','IMAGE'].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input type="radio" name="responseMediaType" value={t}
                      checked={formData.responseMediaType === t}
                      onChange={() => setFormData(p => ({...p, responseMediaType: t}))}/>
                    {t === 'TEXT' ? '💬 Teks' : '🖼️ Gambar + Caption'}
                  </label>
                ))}
              </div>
              {formData.responseMediaType === 'IMAGE' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">URL Gambar</label>
                  <div className="flex gap-2">
                    <input value={formData.responseMediaUrl}
                      onChange={e => setFormData(p => ({...p, responseMediaUrl: e.target.value}))}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"/>
                    <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg flex items-center">
                      {uploading ? <Loader size={16} className="animate-spin"/> : <Upload size={16}/>}
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload}/>
                    </label>
                    <button type="button" onClick={openGallery}
                      className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg">
                      <Grid size={16}/>
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {formData.responseMediaType === 'IMAGE' ? 'Caption' : 'Pesan Balasan'}
                </label>
                <textarea required rows={3} value={formData.responseContent}
                  onChange={e => setFormData(p => ({...p, responseContent: e.target.value}))}
                  placeholder={formData.responseMediaType === 'IMAGE' ? 'Caption gambar...' : 'Ketik balasan di sini...'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"/>
              </div>
            </div>
          )}

          {/* API CALL */}
          {formData.actionType === 'API_CALL' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
                <div className="flex gap-2">
                  <input required value={formData.apiUrl}
                    onChange={e => setFormData(p => ({...p, apiUrl: e.target.value}))}
                    placeholder="https://api.myapp.com/webhook"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"/>
                  <select value={formData.credentialId}
                    onChange={e => setFormData(p => ({...p, credentialId: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-blue-500">
                    <option value="">No Auth</option>
                    {credentials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={formData.apiMethod}
                    onChange={e => setFormData(p => ({...p, apiMethod: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-blue-500">
                    <option>POST</option><option>GET</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Payload JSON</label>
                <textarea rows={3} value={formData.apiPayload}
                  onChange={e => setFormData(p => ({...p, apiPayload: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm resize-none"/>
              </div>
            </div>
          )}

          {/* AI REPLY */}
          {formData.actionType === 'AI_REPLY' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">System Prompt / AI Briefing</label>
              <textarea required rows={4} value={formData.responseContent}
                onChange={e => setFormData(p => ({...p, responseContent: e.target.value}))}
                placeholder="Kamu adalah customer service yang ramah. Jawab pertanyaan singkat dan jelas dalam Bahasa Indonesia."
                className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"/>
              <p className="text-xs text-gray-500 mt-1">Instruksi untuk AI. Menggunakan API Key OpenAI di Profil.</p>
            </div>
          )}

          {/* ACTIVATE MINI APP */}
          {formData.actionType === 'ACTIVATE_MINI_APP' && (
            <div className="space-y-3">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                <p className="font-semibold mb-1">💡 Kapan pakai ini?</p>
                <p className="text-amber-300/70">Gunakan jika ingin aktifkan Mini App hanya di grup/sesi tertentu, atau dengan kondisi trigger tambahan. App yang sudah punya keyword sendiri tidak perlu rule ini.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Pilih Mini App</label>
                <select required value={formData.miniAppId}
                  onChange={e => setFormData(p => ({...p, miniAppId: e.target.value}))}
                  className="w-full bg-gray-800 border border-amber-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                  <option value="">-- Pilih Mini App --</option>
                  {miniApps.map(app => (
                    <option key={app.id} value={app.id}>{app.icon} {app.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {editingRuleId && (
              <button type="button" onClick={handleCancelEdit}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
                Batal
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-sm disabled:opacity-50">
              {saving ? <Loader size={16} className="animate-spin"/> : (editingRuleId ? <Edit size={16}/> : <Plus size={16}/>)}
              {editingRuleId ? 'Simpan Perubahan' : 'Buat Rule'}
            </button>
          </div>
        </form>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-5">
        <span className="bg-gray-800 px-3 py-1 rounded-full text-sm font-medium text-emerald-400">
          {rules.filter(r => r.isActive !== false).length} Aktif
        </span>
        <span className="bg-gray-800 px-3 py-1 rounded-full text-sm font-medium text-gray-400">
          {rules.length} Total Rules
        </span>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
          <Zap size={40} className="mx-auto text-gray-700 mb-3"/>
          <p className="font-medium text-gray-500">Belum ada Rule</p>
          <p className="text-sm text-gray-600 mt-1">Buat rule untuk membalas pesan secara otomatis</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([groupName, groupRules]) => (
            <div key={groupName}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-600 inline-block"/>
                {groupName}
              </p>
              <div className="space-y-3">
                {groupRules.map(rule => (
                  <div key={rule.id}
                    className={`bg-gray-900 border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all ${
                      rule.isActive !== false
                        ? 'border-gray-700 hover:border-gray-600'
                        : 'border-gray-800 opacity-60'
                    }`}>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="font-bold text-white">{rule.name}</h4>
                        {rule.isActive === false && (
                          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">PAUSED</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {triggerBadge(rule.triggerType).map((b,i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${b.cls}`}>{b.label}</span>
                        ))}
                        {rule.triggerValue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 font-mono">
                            {rule.triggerValue.length > 30 ? rule.triggerValue.slice(0,30)+'…' : rule.triggerValue}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                          {actionBadge(rule.actionType)}
                          {rule.actionType === 'ACTIVATE_MINI_APP' && ` → ${miniApps.find(a => a.id === rule.miniAppId)?.name || ''}`}
                        </span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleToggle(rule)}
                        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                          rule.isActive !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                        }`}>
                        <Power size={12}/>
                        {rule.isActive !== false ? 'Aktif' : 'Paused'}
                      </button>
                      <button onClick={() => handleEdit(rule)}
                        className="p-2 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                        <Edit size={16}/>
                      </button>
                      <button onClick={() => handleDelete(rule.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash size={16}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-lg">🖼️ Pilih dari Galeri</h3>
              <button onClick={() => setShowGallery(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              {galleryImages.map((img, idx) => (
                <div key={idx} onClick={() => { setFormData(p => ({...p, responseMediaUrl: img.url})); setShowGallery(false); }}
                  className="cursor-pointer border border-gray-700 rounded-xl overflow-hidden hover:border-violet-500 transition-all">
                  <img src={img.url} alt={img.name} className="w-full h-28 object-cover"/>
                  <p className="text-xs text-gray-400 p-2 truncate bg-gray-800">{img.name}</p>
                </div>
              ))}
              {galleryImages.length === 0 && (
                <p className="col-span-full text-center text-gray-500 py-8">Belum ada gambar di galeri</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
