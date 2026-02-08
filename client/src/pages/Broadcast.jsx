import React, { useEffect, useState } from 'react';
import api from '../api';
import { Send, Upload, Loader, Grid, X, Tag } from 'lucide-react';

const Broadcast = () => {
    const [sessions, setSessions] = useState([]);
    const [tags, setTags] = useState([]);
    const [credentials, setCredentials] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [formData, setFormData] = useState({
        sessionId: '',
        tag: '',
        messageType: 'TEXT', // Legacy
        actionType: 'TEXT',  // New
        content: '',
        mediaUrl: '',
        apiUrl: '',
        apiMethod: 'GET',
        apiPayload: '{}',
        credentialId: ''
    });
    const [showGallery, setShowGallery] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);

    useEffect(() => {
        fetchSessions();
        fetchContacts();
        fetchCredentials();
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions');
            setSessions(res.data);
            if (res.data.length > 0) {
                setFormData(prev => ({ ...prev, sessionId: res.data[0].id }));
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        }
    };

    const fetchContacts = async () => {
        try {
            const res = await api.get('/contacts');

            // Extract unique tags
            const allTags = new Set();
            res.data.forEach(c => {
                if (c.tags) {
                    c.tags.split(',').forEach(tag => allTags.add(tag.trim()));
                }
            });
            setTags(Array.from(allTags).sort());
        } catch (error) {
            console.error("Failed to fetch contacts", error);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setResult(null);
        try {
            const res = await api.post('/messages/broadcast', {
                sessionId: formData.sessionId,
                tag: formData.tag,
                type: formData.actionType, // Send actionType as type
                content: formData.content,
                mediaUrl: formData.mediaUrl,
                apiUrl: formData.apiUrl,
                apiMethod: formData.apiMethod,
                apiPayload: formData.apiPayload,
                credentialId: formData.credentialId
            });
            setResult({ type: 'success', message: res.data.message });
            setFormData(prev => ({ ...prev, content: '', mediaUrl: '' }));
        } catch (error) {
            console.error(error);
            setResult({ type: 'error', message: error.response?.data?.error || "Failed to start broadcast" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Send className="text-sisia-primary" /> Broadcast
            </h2>

            <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl">
                {result && (
                    <div className={`p-4 rounded-lg mb-4 ${result.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {result.message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
                        <select
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-sisia-primary focus:border-transparent outline-none"
                            value={formData.sessionId}
                            onChange={e => setFormData({ ...formData, sessionId: e.target.value })}
                            required
                        >
                            <option value="">Select Session</option>
                            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Tag</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-3 text-gray-400" size={16} />
                            <select
                                className="w-full border p-2 pl-10 rounded focus:ring-2 focus:ring-sisia-primary focus:border-transparent outline-none"
                                value={formData.tag}
                                onChange={e => setFormData({ ...formData, tag: e.target.value })}
                                required
                            >
                                <option value="">Select Tag</option>
                                {tags.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Message will be sent to all contacts with this tag.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
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

                    {formData.actionType === 'API_CALL' ? (
                        <div className="space-y-4 border p-4 rounded-lg bg-gray-50/50">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                                <div className="flex gap-2">
                                    <input className="flex-1 border p-2 rounded focus:ring-2 focus:ring-sisia-primary outline-none" placeholder="https://api.example.com" value={formData.apiUrl} onChange={e => setFormData({ ...formData, apiUrl: e.target.value })} required />
                                    <select className="w-1/3 border p-2 rounded focus:ring-2 focus:ring-sisia-primary outline-none" value={formData.credentialId} onChange={e => setFormData({ ...formData, credentialId: e.target.value })}>
                                        <option value="">No Auth</option>
                                        {credentials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                                    <select className="w-full border p-2 rounded focus:ring-2 focus:ring-sisia-primary outline-none" value={formData.apiMethod} onChange={e => setFormData({ ...formData, apiMethod: e.target.value })}>
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>
                                {['POST', 'PUT', 'PATCH', 'DELETE'].includes(formData.apiMethod) && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Payload (JSON)</label>
                                        <input className="w-full border p-2 rounded font-mono text-xs focus:ring-2 focus:ring-sisia-primary outline-none" placeholder="{}" value={formData.apiPayload} onChange={e => setFormData({ ...formData, apiPayload: e.target.value })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {formData.actionType === 'AI_REPLY' ? 'AI Prompt' : 'Message Content'}
                            </label>
                            <textarea
                                className="w-full border p-2 rounded h-32 focus:ring-2 focus:ring-sisia-primary focus:border-transparent outline-none resize-none"
                                placeholder={formData.actionType === 'AI_REPLY' ? "e.g. Write a promotion message for our summer sale." : "Type your message here..."}
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                required={formData.actionType !== 'API_CALL'}
                            />
                        </div>
                    )}

                    {(formData.actionType === 'IMAGE' || formData.actionType === 'AI_REPLY' || formData.messageType === 'IMAGE') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Image Source</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 border p-2 rounded focus:ring-2 focus:ring-sisia-primary focus:border-transparent outline-none"
                                    placeholder="Image URL"
                                    value={formData.mediaUrl}
                                    onChange={e => setFormData({ ...formData, mediaUrl: e.target.value })}
                                />
                                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded border flex items-center justify-center w-12 transition-colors">
                                    {uploading ? <Loader size={20} className="animate-spin" /> : <Upload size={20} />}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </label>
                                <button
                                    type="button"
                                    onClick={openGallery}
                                    className="bg-purple-600 text-white px-3 py-2 rounded flex items-center justify-center hover:bg-purple-700 transition"
                                    title="Choose from Gallery"
                                >
                                    <Grid size={20} />
                                </button>
                            </div>
                            {formData.mediaUrl && (
                                <div className="mt-2 text-center bg-gray-50 p-2 rounded border border-dashed">
                                    <img src={formData.mediaUrl} alt="Preview" className="h-32 mx-auto object-contain rounded" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4 border-t">
                        <button
                            type="submit"
                            disabled={sending || !formData.sessionId || !formData.tag}
                            className={`w-full py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all
                                ${sending || !formData.sessionId || !formData.tag
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-sisia-primary hover:bg-emerald-700 shadow-lg hover:shadow-xl'
                                }`}
                        >
                            {sending ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
                            {sending ? 'Starting Broadcast...' : 'Start Broadcast'}
                        </button>
                        <p className="text-xs text-center text-gray-500 mt-2">
                            Messages are sent with a random delay (2-5s) to avoid spam detection.
                        </p>
                    </div>
                </form>
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
            {/* Broadcast History */}
            <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mt-8">
                <h3 className="text-xl font-bold mb-4">Broadcast History</h3>
                <BroadcastHistory />
            </div>
        </div>
    );
};

const BroadcastHistory = () => {
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/messages/broadcasts');
            setBroadcasts(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const handleRetry = async (id) => {
        try {
            await api.post(`/messages/broadcast/${id}/retry`);
            alert("Retry started");
            fetchHistory();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to retry");
        }
    };

    if (loading) return <p>Loading history...</p>;
    if (broadcasts.length === 0) return <p className="text-gray-500">No broadcasts found.</p>;

    return (
        <div className="space-y-4">
            {broadcasts.map(b => (
                <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${b.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {b.status}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                    <Tag size={14} className="text-sisia-primary" />
                                    {b.tag}
                                </span>
                                <span className="text-xs text-gray-400 font-mono hidden md:inline-block">•</span>
                                <span className="text-xs text-gray-500 hidden md:inline-block">
                                    {new Date(b.cratedAt).toLocaleDateString()} {new Date(b.cratedAt).toLocaleTimeString()}
                                </span>
                            </div>

                            <div className="flex items-center gap-6 text-sm text-gray-600">
                                <div className="flex items-center gap-2" title="Total Messages">
                                    <span className="font-medium">{b.total}</span> <span className="text-gray-400 text-xs uppercase">Total</span>
                                </div>
                                <div className="flex items-center gap-2" title="Sent Successfully">
                                    <span className="font-medium text-emerald-600">{b.sent}</span> <span className="text-gray-400 text-xs uppercase">Sent</span>
                                </div>
                                <div className="flex items-center gap-2" title="Failed">
                                    <span className={`font-medium ${b.failed > 0 ? 'text-red-500' : 'text-gray-600'}`}>{b.failed}</span> <span className="text-gray-400 text-xs uppercase">Failed</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 min-w-[120px]">
                            <div className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${expandedId === b.id
                                ? 'bg-gray-100 border-gray-200 text-gray-600'
                                : 'bg-white border-transparent text-gray-400 group-hover:border-gray-200'
                                }`}>
                                {expandedId === b.id ? "Hide Details" : "Show Details"}
                            </div>
                        </div>
                    </div>

                    {expandedId === b.id && (
                        <div className="bg-gray-50 border-t border-gray-100 p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Logs</h4>
                                {b.failed > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRetry(b.id); }}
                                        className="text-xs font-bold bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all shadow-sm flex items-center gap-1"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                        Retry {b.failed} Failed
                                    </button>
                                )}
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                                <div className="divide-y divide-gray-100">
                                    {b.logs.map(log => (
                                        <div key={log.id} className="p-3 flex justify-between items-center hover:bg-gray-50/50 text-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' :
                                                    log.status === 'FAILED' ? 'bg-red-500' : 'bg-gray-300'
                                                    }`}></div>
                                                <span className="font-medium text-gray-700">{log.contactName || 'Unknown'}</span>
                                                <span className="text-gray-400 text-xs font-mono">({log.contactPhone})</span>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
                                                log.status === 'FAILED' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {log.status} {log.errorMessage && ` - ${log.errorMessage}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default Broadcast;
