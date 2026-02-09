import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Trash, Upload, Loader, Edit, X, Grid, Smartphone } from 'lucide-react';

const Scheduler = () => {
    const [schedules, setSchedules] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [credentials, setCredentials] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [frequency, setFrequency] = useState('CUSTOM'); // HOURLY, DAILY, CUSTOM
    const [dailyTime, setDailyTime] = useState('08:00');
    const [formData, setFormData] = useState({
        sessionId: '',
        recipient: '',
        messageType: 'TEXT', // Legacy
        actionType: 'TEXT',  // New
        content: '',
        mediaUrl: '',
        apiUrl: '',
        apiMethod: 'GET',
        apiPayload: '{}',
        credentialId: '',
        cronExpression: '* * * * *'
    });
    const [showGallery, setShowGallery] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);

    useEffect(() => {
        fetchSchedules();
        fetchContacts();
        const loadSessions = async () => {
            try {
                const res = await api.get('/sessions');
                setSessions(res.data);
                setFormData(prev => {
                    if (res.data.length > 0 && !prev.sessionId) {
                        return { ...prev, sessionId: res.data[0].id };
                    }
                    return prev;
                });
            } catch (e) {
                console.error("Failed to fetch sessions", e);
            }
        };
        loadSessions();
        fetchCredentials();
    }, []);

    useEffect(() => {
        if (formData.sessionId) {
            fetchGroups(formData.sessionId);
        }
    }, [formData.sessionId]);



    const fetchContacts = async () => {
        try {
            const res = await api.get('/contacts');
            setContacts(res.data);
        } catch (error) {
            console.error("Failed to fetch contacts", error);
        }
    };

    const fetchGroups = async (sessionId) => {
        try {
            const res = await api.get(`/sessions/${sessionId}/groups`);
            setGroups(res.data);
        } catch (error) {
            console.error("Failed to fetch groups", error);
            setGroups([]);
        }
    };

    const fetchCredentials = async () => {
        try {
            const res = await api.get('/credentials');
            setCredentials(res.data);
        } catch (error) {
            console.error("Failed to fetch credentials", error);
        }
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
            setFormData({ ...formData, mediaUrl: res.data.url });
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
        setFormData(prev => ({ ...prev, mediaUrl: url }));
        setShowGallery(false);
    };

    const fetchSchedules = async () => {
        const res = await api.get('/schedules');
        setSchedules(res.data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...formData };
        if (payload.credentialId === '') payload.credentialId = null;

        try {
            if (editingId) {
                await api.put(`/schedules/${editingId}`, payload);
            } else {
                await api.post('/schedules', payload);
            }
            handleCancelEdit();
            fetchSchedules();
        } catch (error) {
            console.error(error);
            alert("Failed to save schedule");
        }
    };

    const handleEdit = (schedule) => {
        setEditingId(schedule.id);
        const [minute, hour] = schedule.cronExpression.split(' ');

        let freq = 'CUSTOM';
        let time = '08:00';

        if (schedule.cronExpression === '0 * * * *') {
            freq = 'HOURLY';
        } else if (schedule.cronExpression.endsWith('* * *') && !schedule.cronExpression.startsWith('0 *')) {
            freq = 'DAILY';
            time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
        }

        setFrequency(freq);
        setDailyTime(time);

        setFormData({
            sessionId: schedule.sessionId,
            recipient: schedule.recipient,
            messageType: schedule.messageType,
            actionType: schedule.actionType || schedule.messageType,
            content: schedule.content,
            mediaUrl: schedule.mediaUrl || '',
            apiUrl: schedule.apiUrl || '',
            apiMethod: schedule.apiMethod || 'GET',
            apiPayload: schedule.apiPayload || '{}',
            credentialId: schedule.credentialId || '',
            cronExpression: schedule.cronExpression
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFrequency('CUSTOM');
        setFormData({
            sessionId: sessions.length > 0 ? sessions[0].id : '',
            recipient: '',
            messageType: 'TEXT',
            actionType: 'TEXT',
            content: '',
            mediaUrl: '',
            apiUrl: '',
            apiMethod: 'GET',
            apiPayload: '{}',
            credentialId: '',
            cronExpression: '* * * * *'
        });
    };

    const handleDelete = async (id) => {
        await api.delete(`/schedules/${id}`);
        fetchSchedules();
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Scheduler</h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        {editingId ? <Edit size={20} className="text-sisia-primary" /> : <Plus size={20} className="text-sisia-primary" />}
                        {editingId ? 'Edit Schedule' : 'Create New Schedule'}
                    </h3>
                    {editingId && (
                        <button type="button" onClick={handleCancelEdit} className="text-xs font-semibold text-red-500 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors flex items-center gap-1">
                            <X size={14} /> Cancel
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Session / Device</label>
                                <div className="relative">
                                    <select className="w-full border border-gray-200 bg-gray-50/50 p-2.5 rounded-lg focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary outline-none transition-all appearance-none" value={formData.sessionId} onChange={e => setFormData({ ...formData, sessionId: e.target.value })}>
                                        <option value="">Select Session</option>
                                        {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                                    </select>
                                    <Smartphone className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Recipient</label>
                                <select className="w-full border border-gray-200 bg-gray-50/50 p-2.5 rounded-lg focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary outline-none transition-all" value={formData.recipient} onChange={e => setFormData({ ...formData, recipient: e.target.value })} required>
                                    <option value="">Select Recipient</option>
                                    <optgroup label="Contacts">
                                        {contacts.map(c => <option key={c.id} value={c.phone}>{c.name} ({c.phone})</option>)}
                                    </optgroup>
                                    <optgroup label="Groups">
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.subject}</option>)}
                                    </optgroup>
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Or enter manual ID if not listed.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Action Type</label>
                                <select
                                    className="w-full border border-gray-200 bg-white p-2.5 rounded-lg focus:ring-2 focus:ring-sisia-primary/20 outline-none"
                                    value={formData.actionType}
                                    onChange={e => setFormData({
                                        ...formData,
                                        actionType: e.target.value,
                                        messageType: (e.target.value === 'IMAGE') ? 'IMAGE' : 'TEXT'
                                    })}
                                >
                                    <option value="TEXT">Send Text Message</option>
                                    <option value="IMAGE">Send Image</option>
                                    <option value="AI_REPLY">Generate with AI</option>
                                    <option value="API_CALL">Call Webhook API</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Schedule Frequency</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <select className="w-full border border-gray-200 bg-white p-2.5 rounded-lg mb-3 focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary outline-none" value={frequency} onChange={e => {
                                        const freq = e.target.value;
                                        setFrequency(freq);
                                        if (freq === 'HOURLY') setFormData({ ...formData, cronExpression: '0 * * * *' });
                                        if (freq === 'DAILY') {
                                            const [hour, minute] = dailyTime.split(':');
                                            setFormData({ ...formData, cronExpression: `${minute} ${hour} * * *` });
                                        }
                                    }}>
                                        <option value="HOURLY">Every Hour</option>
                                        <option value="DAILY">Daily</option>
                                        <option value="CUSTOM">Custom Cron</option>
                                    </select>

                                    {frequency === 'DAILY' && (
                                        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100">
                                            <label className="text-sm font-medium text-gray-600">Run at:</label>
                                            <input type="time" className="flex-1 border-none outline-none font-medium text-gray-800" value={dailyTime} onChange={e => {
                                                setDailyTime(e.target.value);
                                                const [hour, minute] = e.target.value.split(':');
                                                setFormData({ ...formData, cronExpression: `${minute} ${hour} * * *` });
                                            }} />
                                        </div>
                                    )}

                                    {frequency === 'CUSTOM' && (
                                        <div className="space-y-2">
                                            <input className="w-full border border-gray-200 p-2 rounded-lg font-mono text-sm bg-white" placeholder="* * * * *" value={formData.cronExpression} onChange={e => setFormData({ ...formData, cronExpression: e.target.value })} required />
                                            <p className="text-[10px] text-gray-400">min hour day month weekday</p>
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center text-xs">
                                        <span className="text-gray-400">Generated Cron:</span>
                                        <span className="font-mono font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">{formData.cronExpression}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {formData.actionType === 'API_CALL' ? (
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Webhook URL</label>
                                <div className="flex gap-2">
                                    <input className="flex-1 border p-2 rounded-lg" placeholder="https://api.example.com" value={formData.apiUrl} onChange={e => setFormData({ ...formData, apiUrl: e.target.value })} required />
                                    <select className="w-1/3 border p-2 rounded-lg" value={formData.credentialId} onChange={e => setFormData({ ...formData, credentialId: e.target.value })}>
                                        <option value="">No Auth</option>
                                        {credentials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Method</label>
                                    <select className="w-full border p-2 rounded-lg" value={formData.apiMethod} onChange={e => setFormData({ ...formData, apiMethod: e.target.value })}>
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>
                                {['POST', 'PUT', 'PATCH', 'DELETE'].includes(formData.apiMethod) && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Payload (JSON)</label>
                                        <input className="w-full border p-2 rounded-lg font-mono text-xs" placeholder="{}" value={formData.apiPayload} onChange={e => setFormData({ ...formData, apiPayload: e.target.value })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                {formData.actionType === 'AI_REPLY' ? 'AI Prompt' : 'Content'}
                            </label>
                            <textarea
                                className="w-full border border-gray-200 bg-gray-50/50 p-4 rounded-xl h-32 focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary outline-none transition-all resize-none"
                                placeholder={formData.actionType === 'AI_REPLY' ? "e.g. Generate a daily quote about success" : "Type your message content here..."}
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                required={formData.actionType !== 'API_CALL'}
                            />
                        </div>
                    )}

                    {(formData.actionType === 'IMAGE' || formData.actionType === 'AI_REPLY' || formData.messageType === 'IMAGE') && ( // Fallback for legacy
                        <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                            <div className="flex gap-3">
                                <input className="flex-1 border border-gray-200 p-2.5 rounded-lg bg-white" placeholder="Image URL" value={formData.mediaUrl} onChange={e => setFormData({ ...formData, mediaUrl: e.target.value })} />
                                <label className="cursor-pointer bg-white text-gray-600 p-2.5 rounded-lg border border-gray-200 hover:border-sisia-primary hover:text-sisia-primary transition-all flex items-center justify-center w-12 shadow-sm">
                                    {uploading ? <Loader size={20} className="animate-spin" /> : <Upload size={20} />}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </label>
                                <button
                                    type="button"
                                    onClick={openGallery}
                                    className="bg-purple-100 text-purple-600 p-2.5 rounded-lg border border-transparent hover:border-purple-300 hover:shadow-sm transition-all"
                                    title="Choose from Gallery"
                                >
                                    <Grid size={20} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end">
                        <button type="submit" className="bg-sisia-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform flex items-center gap-2">
                            {editingId ? <Edit size={18} /> : <Plus size={18} />}
                            {editingId ? 'Save Changes' : 'Schedule Message'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {Object.entries(schedules.reduce((acc, sch) => {
                    const sessId = sch.sessionId;
                    if (!acc[sessId]) acc[sessId] = [];
                    acc[sessId].push(sch);
                    return acc;
                }, {})).map(([sessionId, sessionSchedules]) => {
                    const sessionName = sessions.find(s => s.id === sessionId)?.name || sessionId;
                    return (
                        <div key={sessionId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 text-sisia-primary">
                                        <Smartphone size={18} />
                                    </div>
                                    <div>
                                        {sessionName}
                                        <div className="text-xs font-normal text-gray-400 font-mono mt-0.5">{sessionId}</div>
                                    </div>
                                </h3>
                                <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
                                    {sessionSchedules.length} Active Schedules
                                </span>
                            </div>

                            <div className="divide-y divide-gray-50">
                                {sessionSchedules.map(sch => (
                                    <div key={sch.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">To: {sch.recipient}</span>
                                                <span className="text-xs font-mono text-gray-500 bg-gray-50 border px-1.5 py-0.5 rounded flex items-center gap-1" title="Cron Expression">
                                                    <Loader size={10} className="text-gray-400" /> {sch.cronExpression}
                                                </span>
                                            </div>
                                            <p className="text-gray-600 text-sm leading-relaxed mb-2 line-clamp-2">{sch.content}</p>

                                            <div className="flex items-center gap-4 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <span className={`w-2 h-2 rounded-full ${sch.lastRun ? 'bg-emerald-400' : 'bg-gray-300'}`}></span>
                                                    Last run: {sch.lastRun ? new Date(sch.lastRun).toLocaleString() : 'Never'}
                                                </span>
                                                {sch.mediaUrl && (
                                                    <span className="flex items-center gap-1 text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded">
                                                        <Grid size={12} /> Has Media
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(sch)}
                                                className="p-2 text-gray-400 hover:text-sisia-primary hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-lg transition-all"
                                                title="Edit Schedule"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(sch.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-lg transition-all"
                                                title="Delete Schedule"
                                            >
                                                <Trash size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {schedules.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                            <Loader size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No Scheduled Messages</h3>
                        <p className="text-gray-500 mt-1 max-w-sm mx-auto">Create a new schedule above to automate your messages.</p>
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
        </div>
    );
};

export default Scheduler;
