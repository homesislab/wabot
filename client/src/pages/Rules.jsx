import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Trash, Zap, MessageSquare, Globe, Upload, Loader, Edit, X, Bot, Grid, Power, Puzzle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Rules = () => {
    const { user } = useAuth();
    const [rules, setRules] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        triggerType: 'KEYWORD',
        triggerValue: '',
        actionType: 'RESPONSE',
        apiUrl: '',
        apiMethod: 'POST',
        apiPayload: '{}',
        responseMediaType: 'TEXT',
        responseMediaUrl: '',
        sessionId: ''
    });
    const [sessions, setSessions] = useState([]);
    const [groups, setGroups] = useState([]);
    const [credentials, setCredentials] = useState([]);
    const [miniApps, setMiniApps] = useState([]);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);

    useEffect(() => {
        fetchRules();
        fetchSessions();
        fetchCredentials();
        fetchMiniApps();
    }, []);

    useEffect(() => {
        if (formData.sessionId) {
            fetchGroups(formData.sessionId);
        } else {
            setGroups([]);
        }
    }, [formData.sessionId]);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions');
            setSessions(res.data);
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        }
    };

    const fetchRules = async () => {
        const res = await api.get('/rules');
        setRules(res.data);
    };

    const fetchCredentials = async () => {
        try {
            const res = await api.get('/credentials');
            setCredentials(res.data);
        } catch (error) {
            console.error("Failed to fetch credentials", error);
        }
    };

    const fetchMiniApps = async () => {
        try {
            const res = await api.get('/apps');
            setMiniApps(res.data || []);
        } catch (error) {
            console.error("Failed to fetch mini apps", error);
        }
    };

    const fetchGroups = async (sessionId) => {
        try {
            const res = await api.get(`/sessions/${sessionId}/groups`);
            setGroups(res.data);
        } catch (error) {
            console.error("Failed to fetch groups", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...formData };
        if (payload.credentialId === '') payload.credentialId = null;

        try {
            if (editingRuleId) {
                await api.put(`/rules/${editingRuleId}`, payload);
            } else {
                await api.post('/rules', payload);
            }
            handleCancelEdit(); // Resets form and editing state
            fetchRules();
        } catch (error) {
            console.error(error);
            alert("Failed to save rule");
        }
    };

    const handleEdit = (rule) => {
        setEditingRuleId(rule.id);
        setFormData({
            name: rule.name,
            triggerType: rule.triggerType,
            triggerValue: rule.triggerValue,
            actionType: rule.actionType,
            apiUrl: rule.apiUrl || '',
            apiMethod: rule.apiMethod || 'POST',
            apiPayload: rule.apiPayload || '{}',
            responseContent: rule.responseContent || '',
            responseMediaType: rule.responseMediaType || 'TEXT',
            responseMediaUrl: rule.responseMediaUrl || '',
            sessionId: rule.sessionId || '',
            filterGroupId: rule.filterGroupId || '',
            credentialId: rule.credentialId || '',
            miniAppId: rule.miniAppId || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingRuleId(null);
        setFormData({
            name: '',
            triggerType: 'KEYWORD',
            triggerValue: '',
            actionType: 'RESPONSE',
            apiUrl: '',
            apiMethod: 'POST',
            apiPayload: '{}',
            responseContent: '',
            responseMediaType: 'TEXT',
            responseMediaUrl: '',
            sessionId: '',
            filterGroupId: '',
            credentialId: '',
            miniAppId: ''
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const uploadData = new FormData();
        uploadData.append('image', file);

        try {
            const res = await api.post('/upload', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData({ ...formData, responseMediaUrl: res.data.url });
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const openGallery = async () => {
        setShowGallery(true);
        try {
            const res = await api.get('/upload');
            setGalleryImages(res.data);
        } catch (error) {
            console.error("Failed to load gallery", error);
        }
    };

    const selectImage = (url) => {
        setFormData(prev => ({ ...prev, responseMediaUrl: url }));
        setShowGallery(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this rule?")) return;
        await api.delete(`/rules/${id}`);
        fetchRules();
    };

    const handleToggleRule = async (rule) => {
        try {
            await api.put(`/rules/${rule.id}`, { isActive: !rule.isActive });
            fetchRules();
        } catch (error) {
            console.error(error);
            alert("Failed to update rule status");
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Auto-Reply Rules</h2>

            <form onSubmit={handleSubmit} className={`bg-white p-6 rounded-xl shadow-sm border ${editingRuleId ? 'border-sisia-primary' : 'border-gray-100'} mb-8 transition-colors`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-700">{editingRuleId ? 'Edit Rule' : 'Create New Rule'}</h3>
                    {editingRuleId && (
                        <button type="button" onClick={handleCancelEdit} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
                            <X size={16} /> Cancel Edit
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                        <input className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" placeholder="e.g. Welcome Message" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Session (Optional)</label>
                        <select className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" value={formData.sessionId} onChange={e => setFormData({ ...formData, sessionId: e.target.value })}>
                            <option value="">All Sessions (Global)</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {formData.sessionId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Group (Optional)</label>
                            <select className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" value={formData.filterGroupId} onChange={e => setFormData({ ...formData, filterGroupId: e.target.value })}>
                                <option value="">All Chats</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.subject}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Only reply if message is in this group</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type <span className="text-xs text-gray-400 font-normal">(bisa pilih lebih dari satu)</span></label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { value: 'KEYWORD', label: 'Keyword Includes' },
                                { value: 'ALL', label: 'All Messages (Default)' },
                                { value: 'REGEX', label: 'Regex Match' },
                                { value: 'MENTION', label: 'On Mention (Tag Bot)' },
                                { value: 'DIRECT_MESSAGE', label: 'Direct Message (Japri)' },
                            ].map(opt => {
                                const selected = String(formData.triggerType || '').split(',').map(s => s.trim()).filter(Boolean);
                                const isChecked = selected.includes(opt.value);
                                return (
                                    <label key={opt.value} className={`p-2 border rounded-lg cursor-pointer flex items-center gap-2 text-sm ${isChecked ? 'bg-emerald-50 border-sisia-primary text-sisia-primary' : 'hover:bg-gray-50'}`}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                const next = isChecked
                                                    ? selected.filter(v => v !== opt.value)
                                                    : [...selected, opt.value];
                                                setFormData({ ...formData, triggerType: next.join(',') });
                                            }}
                                        />
                                        {opt.label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {String(formData.triggerType || '').split(',').map(s => s.trim().toUpperCase()).some(t => t === 'KEYWORD' || t === 'REGEX') && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Value</label>
                            <input className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" placeholder={String(formData.triggerType || '').toUpperCase().includes('REGEX') ? '^Hello.*' : 'hello'} value={formData.triggerValue} onChange={e => setFormData({ ...formData, triggerValue: e.target.value })} required />
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                        <div className="flex gap-4 flex-wrap">
                            <label className={`flex-1 p-3 border rounded-lg cursor-pointer flex items-center gap-2 ${formData.actionType === 'RESPONSE' ? 'bg-emerald-50 border-sisia-primary text-sisia-primary' : 'hover:bg-gray-50'}`}>
                                <input type="radio" name="actionType" value="RESPONSE" checked={formData.actionType === 'RESPONSE'} onChange={() => setFormData({ ...formData, actionType: 'RESPONSE' })} className="hidden" />
                                <MessageSquare size={18} />
                                <span className="font-medium">Reply with Message</span>
                            </label>
                            <label className={`flex-1 p-3 border rounded-lg cursor-pointer flex items-center gap-2 ${formData.actionType === 'API_CALL' ? 'bg-emerald-50 border-sisia-primary text-sisia-primary' : 'hover:bg-gray-50'}`}>
                                <input type="radio" name="actionType" value="API_CALL" checked={formData.actionType === 'API_CALL'} onChange={() => setFormData({ ...formData, actionType: 'API_CALL' })} className="hidden" />
                                <Globe size={18} />
                                <span className="font-medium">Call Webhook API</span>
                            </label>
                            {user?.isAiEnabled && (
                                <label className={`flex-1 p-3 border rounded-lg cursor-pointer flex items-center gap-2 ${formData.actionType === 'AI_REPLY' ? 'bg-purple-50 border-purple-500 text-purple-600' : 'hover:bg-gray-50'}`}>
                                    <input type="radio" name="actionType" value="AI_REPLY" checked={formData.actionType === 'AI_REPLY'} onChange={() => setFormData({ ...formData, actionType: 'AI_REPLY' })} className="hidden" />
                                    <Bot size={18} />
                                    <div className="flex flex-col text-left">
                                        <span className="font-medium">Reply with AI</span>
                                        <span className="text-[10px] text-gray-500">Powered by OpenAI</span>
                                    </div>
                                </label>
                            )}
                            <label className={`flex-1 p-3 border rounded-lg cursor-pointer flex items-center gap-2 ${formData.actionType === 'ACTIVATE_MINI_APP' ? 'bg-amber-50 border-amber-500 text-amber-600' : 'hover:bg-gray-50'}`}>
                                <input type="radio" name="actionType" value="ACTIVATE_MINI_APP" checked={formData.actionType === 'ACTIVATE_MINI_APP'} onChange={() => setFormData({ ...formData, actionType: 'ACTIVATE_MINI_APP' })} className="hidden" />
                                <Puzzle size={18} />
                                <div className="flex flex-col text-left">
                                    <span className="font-medium">Activate Mini App</span>
                                    <span className="text-[10px] text-gray-500">Trigger a Mini App session</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {formData.actionType === 'RESPONSE' && (
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="responseMediaType" value="TEXT" checked={formData.responseMediaType === 'TEXT'} onChange={() => setFormData({ ...formData, responseMediaType: 'TEXT' })} className="text-sisia-primary" />
                                        <span className="text-gray-700">Text Only</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="responseMediaType" value="IMAGE" checked={formData.responseMediaType === 'IMAGE'} onChange={() => setFormData({ ...formData, responseMediaType: 'IMAGE' })} className="text-sisia-primary" />
                                        <span className="text-gray-700">Image & Caption</span>
                                    </label>
                                </div>
                            </div>

                            {(formData.responseMediaType === 'IMAGE' || formData.actionType === 'AI_REPLY') && (
                                <div>
                                    <div className="flex gap-2">
                                        <input className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" placeholder="https://example.com/image.jpg" value={formData.responseMediaUrl} onChange={e => setFormData({ ...formData, responseMediaUrl: e.target.value })} required />
                                        <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg border flex items-center justify-center w-12 transition-colors">
                                            {uploading ? <Loader size={20} className="animate-spin" /> : <Upload size={20} />}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={openGallery}
                                            className="bg-purple-600 text-white px-3 py-2 rounded-lg flex items-center justify-center hover:bg-purple-700"
                                            title="Choose from Gallery"
                                        >
                                            <Grid size={20} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Paste URL, upload, or choose from gallery</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{formData.responseMediaType === 'IMAGE' ? 'Caption' : 'Response Message'}</label>
                                <textarea rows={3} className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" placeholder={formData.responseMediaType === 'IMAGE' ? 'Image caption...' : 'Type the auto-reply message here...'} value={formData.responseContent} onChange={e => setFormData({ ...formData, responseContent: e.target.value })} required />
                            </div>
                        </div>
                    )}

                    {formData.actionType === 'API_CALL' && (
                        <>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                                <div className="flex gap-2">
                                    <input className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" placeholder="https://api.myapp.com/webhook" value={formData.apiUrl} onChange={e => setFormData({ ...formData, apiUrl: e.target.value })} required />
                                    <select className="w-1/3 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" value={formData.credentialId} onChange={e => setFormData({ ...formData, credentialId: e.target.value })}>
                                        <option value="">No Auth</option>
                                        {credentials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Select a Credential to secure the request</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                                <select className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary" value={formData.apiMethod} onChange={e => setFormData({ ...formData, apiMethod: e.target.value })}>
                                    <option value="POST">POST</option>
                                    <option value="GET">GET</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Payload (JSON)</label>
                                <textarea className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary font-mono text-sm" placeholder="{}" value={formData.apiPayload} onChange={e => setFormData({ ...formData, apiPayload: e.target.value })} />
                            </div>
                        </>
                    )}

                    {formData.actionType === 'AI_REPLY' && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt / Briefing</label>
                            <textarea
                                rows={4}
                                className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 border-purple-200"
                                placeholder="You are a helpful customer support agent. Answer politely and concisely."
                                value={formData.responseContent}
                                onChange={e => setFormData({ ...formData, responseContent: e.target.value })}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">Define how the AI should behave for this rule. It uses your global OpenAI API Key.</p>
                        </div>
                    )}

                    {formData.actionType === 'ACTIVATE_MINI_APP' && (
                        <div className="md:col-span-2 space-y-3">
                            {/* Info box */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                                <p className="font-semibold mb-1">💡 Kapan gunakan Rule ini?</p>
                                <p>Gunakan <strong>Activate Mini App via Rule</strong> jika ingin mengaktifkan app hanya di grup/chat tertentu, atau menambah kondisi filter tambahan.</p>
                                <p className="mt-1 text-blue-500">App yang sudah punya keyword sendiri (di halaman Mini Apps) <strong>tidak perlu</strong> rule ini — bot sudah otomatis merespons.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Mini App</label>
                                <select
                                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 border-amber-200 bg-white"
                                    value={formData.miniAppId || ''}
                                    onChange={e => setFormData({ ...formData, miniAppId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Pilih Mini App --</option>
                                    {miniApps.map(app => (
                                        <option key={app.id} value={app.id}>
                                            {app.icon} {app.name}
                                            {app.triggerType === 'VOICE_APP' ? ' 🎙️' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-amber-600 mt-1">
                                    ⚡ Ketika trigger rule ini terpenuhi, Mini App akan diaktifkan dan menunggu voice note dari user.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end">
                    <button type="submit" className="bg-sisia-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2">
                        {editingRuleId ? <Edit size={18} /> : <Plus size={18} />}
                        {editingRuleId ? 'Update Rule' : 'Create Rule'}
                    </button>
                </div>
            </form>

            <div className="space-y-8">
                {/* Group by Session Logic */}
                {Object.entries(rules.reduce((acc, rule) => {
                    const sessionName = rule.sessionId
                        ? (sessions.find(s => s.id === rule.sessionId)?.name || 'Unknown Session')
                        : 'All Messages (Global)';
                    if (!acc[sessionName]) acc[sessionName] = [];
                    acc[sessionName].push(rule);
                    return acc;
                }, {})).map(([groupName, groupRules]) => (
                    <div key={groupName} className="relative">
                        <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                        <h3 className="flex items-center gap-2 font-bold text-gray-500 mb-4 text-xs uppercase tracking-wider pl-4">
                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                            {groupName}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 pl-4">
                            {groupRules.map(rule => (
                                <div key={rule.id} className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:shadow-md hover:border-sisia-primary/30 transition-all ${!rule.isActive ? 'opacity-60' : ''}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${rule.triggerType === 'ALL' ? 'bg-purple-100 text-purple-600' :
                                                rule.triggerType === 'MENTION' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {rule.triggerType === 'ALL' ? <Globe size={16} /> :
                                                    rule.triggerType === 'MENTION' ? <Zap size={16} /> :
                                                        <MessageSquare size={16} />}
                                            </span>
                                            <div>
                                                <h4 className="font-bold text-gray-900 leading-tight">{rule.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Topic: {rule.triggerType}</span>
                                                    {!rule.isActive && (
                                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Paused</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-2 border border-gray-100">
                                            {rule.triggerType !== 'ALL' && (
                                                <div className="flex items-start gap-2">
                                                    <span className="text-xs font-semibold text-gray-400 w-16 uppercase">Trigger:</span>
                                                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-800 break-all">{rule.triggerValue}</span>
                                                </div>
                                            )}
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs font-semibold text-gray-400 w-16 uppercase">Action:</span>
                                                <div className="flex-1">
                                                    {rule.actionType === 'RESPONSE' ? (
                                                        <span className="flex flex-col gap-1">
                                                            {rule.responseMediaType === 'IMAGE' && (
                                                                <span className="flex items-center gap-1 text-orange-600 text-xs font-semibold">
                                                                    <Zap size={12} /> Sends Image
                                                                </span>
                                                            )}
                                                            <span className="text-gray-800 italic">"{rule.responseContent}"</span>
                                                        </span>
                                                    ) : rule.actionType === 'AI_REPLY' ? (
                                                        <span className="flex items-center gap-1.5 text-purple-600 font-medium">
                                                            <Bot size={14} /> AI Auto-Response
                                                        </span>
                                                    ) : rule.actionType === 'ACTIVATE_MINI_APP' ? (
                                                        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                                                            <Puzzle size={14} /> {miniApps.find(a => a.id === rule.miniAppId)?.icon} {miniApps.find(a => a.id === rule.miniAppId)?.name || rule.miniAppId}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-blue-600 font-mono text-xs">
                                                            <Globe size={14} /> {rule.apiMethod} {rule.apiUrl}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex md:flex-col gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                                        <button
                                            onClick={() => handleToggleRule(rule)}
                                            className={`flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${rule.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                                            title={rule.isActive !== false ? 'Click to Pause' : 'Click to Resume'}
                                        >
                                            <Power size={12} />
                                            {rule.isActive !== false ? 'Active' : 'Paused'}
                                        </button>
                                        <button onClick={() => handleEdit(rule)} className="flex-1 md:flex-none flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-sisia-primary hover:bg-sisia-primary/5 transition-all" title="Edit Rule">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(rule.id)} className="flex-1 md:flex-none flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete Rule">
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {rules.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                        <Bot size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">No Auto-Reply Rules</h3>
                        <p className="text-gray-400 text-sm max-w-sm mx-auto mt-2">Create rules to automatically reply to messages based on keywords or other triggers.</p>
                    </div>
                )}
            </div>
            {/* Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">Image Gallery</h3>
                            <button onClick={() => setShowGallery(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                            {galleryImages.map((img, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => selectImage(img.url)}
                                    className="cursor-pointer border rounded hover:border-blue-500 hover:shadow-lg transition relative group"
                                >
                                    <img src={img.url} alt={img.name} className="w-full h-32 object-cover rounded-t" />
                                    <div className="p-2 text-xs truncate bg-gray-50">{img.name}</div>
                                </div>
                            ))}
                            {galleryImages.length === 0 && <p className="col-span-full text-center text-gray-500">No images found.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Rules;
