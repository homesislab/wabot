import React, { useState, useEffect } from 'react';
import api from '../api';
import { Send, Image as ImageIcon, Upload, X, Grid, Sparkles } from 'lucide-react';

const SendMessage = () => {
    const [sessions, setSessions] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [inputMode, setInputMode] = useState('manual'); // manual, contact, group

    const [formData, setFormData] = useState({
        sessionId: '',
        to: '',
        type: 'TEXT',
        content: '',
        mediaUrl: ''
    });
    const [status, setStatus] = useState('');
    const [uploading, setUploading] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiBriefing, setAiBriefing] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const sessionRes = await api.get('/sessions');
                setSessions(sessionRes.data);
                if (sessionRes.data.length > 0) {
                    setFormData(prev => ({ ...prev, sessionId: sessionRes.data[0].id }));
                }

                const contactRes = await api.get('/contacts');
                setContacts(contactRes.data);
            } catch (error) {
                console.error("Failed to load initial data", error);
            }
        };
        fetchInitial();
    }, []);

    // Fetch groups when session changes
    useEffect(() => {
        if (formData.sessionId && inputMode === 'group') {
            fetchGroups(formData.sessionId);
        }
    }, [formData.sessionId, inputMode]);

    const fetchGroups = async (sessionId) => {
        try {
            const res = await api.get(`/sessions/${sessionId}/groups`);
            setGroups(res.data);
        } catch (error) {
            console.error("Failed to fetch groups", error);
            setGroups([]);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formDataUpload = new FormData();
        formDataUpload.append('image', file);

        setUploading(true);
        try {
            const res = await api.post('/upload', formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData(prev => ({ ...prev, mediaUrl: res.data.url }));
            setStatus('Image uploaded successfully');
        } catch (error) {
            console.error("Upload failed", error);
            setStatus('Upload failed');
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

    const handleGenerateAi = async () => {
        if (!aiBriefing) return;
        setIsGenerating(true);
        setStatus('Generating AI response...');
        try {
            const res = await api.post('/ai/chat', {
                message: aiBriefing,
                systemInstruction: "You are a professional marketing and communications assistant. Generate a high-quality WhatsApp message based on the user's brief. Output ONLY the message text without any preamble or conversational fillers."
            });
            setFormData(prev => ({ ...prev, content: res.data.response }));
            setIsAiModalOpen(false);
            setAiBriefing('');
            setStatus('AI Content generated!');
        } catch (error) {
            console.error("AI Generation failed", error);
            setStatus(error.response?.data?.error || 'AI Generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('Sending...');
        try {
            await api.post('/messages/send', formData);
            setStatus('Sent successfully!');
            setFormData({ ...formData, content: '', mediaUrl: '' });
        } catch (error) {
            setStatus('Failed to send.');
            console.error(error);
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Send Message</h2>
                    <p className="text-gray-500 mt-1">Send a single message to a contact or group</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Recipient Info */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Session</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-sisia-primary transition-colors"
                                        value={formData.sessionId}
                                        onChange={e => setFormData({ ...formData, sessionId: e.target.value })}
                                    >
                                        {sessions.map(s => <option key={s.id} value={s.id}>{s.name} • {s.status}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Type</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                                    {['manual', 'contact', 'group'].map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setInputMode(mode)}
                                            className={`flex-1 capitalize py-2 text-sm font-medium rounded-md transition-all ${inputMode === mode
                                                ? 'bg-white text-sisia-primary shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>

                                {inputMode === 'manual' && (
                                    <input
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-3 px-4 focus:outline-none focus:bg-white focus:border-sisia-primary transition-colors"
                                        placeholder="Phone number (e.g. 62812...)"
                                        value={formData.to}
                                        onChange={e => setFormData({ ...formData, to: e.target.value })}
                                        required
                                    />
                                )}

                                {inputMode === 'contact' && (
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-sisia-primary"
                                            value={formData.to}
                                            onChange={e => setFormData({ ...formData, to: e.target.value })}
                                            required
                                        >
                                            <option value="">Select a Contact...</option>
                                            {contacts.map(c => <option key={c.id} value={c.phone}>{c.name} ({c.phone})</option>)}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                        </div>
                                    </div>
                                )}

                                {inputMode === 'group' && (
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-sisia-primary"
                                            value={formData.to}
                                            onChange={e => setFormData({ ...formData, to: e.target.value })}
                                            required
                                        >
                                            <option value="">Select a Group...</option>
                                            {groups.map(g => <option key={g.id} value={g.id}>{g.subject}</option>)}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Message Content */}
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">Message Content</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsAiModalOpen(true)}
                                        className="text-xs font-bold text-sisia-primary flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-all"
                                    >
                                        <Sparkles size={14} /> Generate with AI
                                    </button>
                                </div>
                                <div className="flex gap-4 mb-3">
                                    <label className={`flex-1 cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${formData.type === 'TEXT' ? 'bg-blue-50 border-sisia-primary text-sisia-primary' : 'bg-white hover:bg-gray-50 text-gray-600'}`}>
                                        <input type="radio" className="hidden" name="msgType" checked={formData.type === 'TEXT'} onChange={() => setFormData({ ...formData, type: 'TEXT' })} />
                                        <span className="font-semibold text-sm">Text Message</span>
                                    </label>
                                    <label className={`flex-1 cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${formData.type === 'IMAGE' ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-white hover:bg-gray-50 text-gray-600'}`}>
                                        <input type="radio" className="hidden" name="msgType" checked={formData.type === 'IMAGE'} onChange={() => setFormData({ ...formData, type: 'IMAGE' })} />
                                        <ImageIcon size={18} />
                                        <span className="font-semibold text-sm">Image Message</span>
                                    </label>
                                </div>

                                <textarea
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 h-40 focus:outline-none focus:bg-white focus:border-sisia-primary transition-colors resize-none"
                                    placeholder={formData.type === 'IMAGE' ? "Add a caption for your image..." : "Type your message here..."}
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    required
                                />
                            </div>

                            {formData.type === 'IMAGE' && (
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sisia-primary"
                                                placeholder="https://example.com/image.jpg"
                                                value={formData.mediaUrl}
                                                onChange={e => setFormData({ ...formData, mediaUrl: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="cursor-pointer bg-white border border-gray-200 hover:border-sisia-primary hover:text-sisia-primary text-gray-600 py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm">
                                                {uploading ? <div className="animate-spin w-4 h-4 border-2 border-sisia-primary border-t-transparent rounded-full"></div> : <Upload size={16} />}
                                                <span className="text-sm font-medium">Upload File</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                            </label>

                                            <button
                                                type="button"
                                                onClick={openGallery}
                                                className="bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Grid size={16} /> <span className="text-sm font-medium">Choose from Gallery</span>
                                            </button>
                                        </div>

                                        {formData.mediaUrl && (
                                            <div className="mt-2 relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-video bg-gray-100 flex items-center justify-center">
                                                <img src={formData.mediaUrl} alt="Preview" className="h-full w-full object-contain" />
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, mediaUrl: '' })}
                                                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm">
                            {status && (
                                <span className={`font-medium ${status.includes('success') ? 'text-emerald-600' : status.includes('Sending') ? 'text-blue-600' : 'text-red-500'}`}>
                                    {status}
                                </span>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={status === 'Sending...'}
                            className={`bg-sisia-primary text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-sisia-primary/20 hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[1px] transition-all ${status === 'Sending...' ? 'opacity-70 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                        >
                            {status === 'Sending...' ? (
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                            ) : (
                                <Send size={20} />
                            )}
                            Send Message
                        </button>
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
            {/* AI Generation Modal */}
            {isAiModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Sparkles size={20} />
                                </div>
                                <h3 className="text-xl font-bold">Generate with AI</h3>
                            </div>
                            <button onClick={() => setIsAiModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 italic">
                                    "Briefing: Apa yang ingin Anda sampaikan? (Misal: Buatkan ucapan selamat ramadhan untuk pelanggan setia)"
                                </label>
                                <textarea
                                    className="w-full border border-gray-200 p-4 rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary min-h-[120px] transition-all"
                                    value={aiBriefing}
                                    onChange={e => setAiBriefing(e.target.value)}
                                    placeholder="Tulis briefing pesan di sini..."
                                    autoFocus
                                />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                                <div className="text-blue-500 shrink-0">
                                    <Sparkles size={18} />
                                </div>
                                <p className="text-sm text-blue-700">
                                    AI akan membantu merangkai kalimat profesional dan menarik sesuai dengan instruksi yang Anda berikan.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsAiModalOpen(false)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateAi}
                                disabled={isGenerating || !aiBriefing}
                                className={`px-6 py-2.5 bg-sisia-primary text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-sisia-primary/20 ${isGenerating || !aiBriefing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700 active:scale-[0.98]'}`}
                            >
                                {isGenerating ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        Generate Content
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SendMessage;
