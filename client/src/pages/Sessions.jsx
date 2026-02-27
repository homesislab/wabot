import React, { useEffect, useState } from 'react';
import api from '../api';
import io from 'socket.io-client';
import { Plus, Trash, RefreshCw, Edit, Save, X, AlertTriangle, Loader } from 'lucide-react';

const Sessions = () => {
    // ... existing state ...
    const [sessions, setSessions] = useState([]);
    const [newSessionId, setNewSessionId] = useState('');
    const [qrCodes, setQrCodes] = useState({});
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions');
            setSessions(res.data);

            // Initialize QRs from API response
            const newQrs = {};
            res.data.forEach(s => {
                if (s.qr) newQrs[s.id] = s.qr;
            });
            setQrCodes(prev => ({ ...prev, ...newQrs }));
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchSessions();
        const socket = io(import.meta.env.VITE_API_URL || undefined);

        socket.on('session-qr', ({ sessionId, qr }) => {
            setQrCodes(prev => ({ ...prev, [sessionId]: qr }));
        });

        socket.on('session-status', ({ sessionId, status }) => {
            fetchSessions();
            if (status === 'CONNECTED') {
                setQrCodes(prev => {
                    const newQrs = { ...prev };
                    delete newQrs[sessionId];
                    return newQrs;
                });
            }
        });

        return () => socket.disconnect();
    }, []);

    const handleCreate = async () => {
        if (!newSessionId) return;
        await api.post('/sessions', { id: newSessionId, name: newSessionId });
        setNewSessionId('');
        setIsAdding(false);
        fetchSessions();
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this session?")) return;
        await api.delete(`/sessions/${id}`);
        fetchSessions();
    };

    const handleUpdateName = async (id) => {
        try {
            await api.put(`/sessions/${id}`, { name: editingName });
            setEditingSessionId(null);
            fetchSessions();
        } catch {
            alert("Failed to update session name");
        }
    };

    const handleReconnect = async (id) => {
        try {
            setQrCodes(prev => {
                const newQrs = { ...prev };
                delete newQrs[id];
                return newQrs;
            });
            await api.post(`/sessions/${id}/reconnect`);
        } catch (error) {
            console.error(error);
            alert("Failed to reconnect session");
        }
    };

    return (
        <div>
            {/* Warning Banner */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            <span className="font-bold">Important Notice:</span> This is an unofficial WhatsApp bot.
                            Using it may result in your number being blocked by WhatsApp.
                            It is highly recommended to use a dedicated number for this purpose, not your personal primary number.
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Devices</h2>
                    <p className="text-gray-500 mt-1">Manage your connected WhatsApp sessions</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sessions.map(session => (
                    <div key={session.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group">
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    {editingSessionId === session.id ? (
                                        <div className="flex items-center gap-2 w-full mb-1">
                                            <input
                                                className="border rounded px-2 py-1 text-sm w-full focus:ring-2 focus:ring-sisia-primary/20 outline-none"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={() => handleUpdateName(session.id)} className="text-green-600 hover:bg-green-50 p-1 rounded"><Save size={16} /></button>
                                            <button onClick={() => setEditingSessionId(null)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-gray-900 truncate" title={session.name}>{session.name}</h3>
                                            <button onClick={() => { setEditingSessionId(session.id); setEditingName(session.name); }} className="text-gray-300 hover:text-sisia-primary transition-colors opacity-0 group-hover:opacity-100">
                                                <Edit size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${session.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' :
                                            session.status === 'CONNECTING' ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'
                                            }`}></div>
                                        <span className={`text-xs font-semibold tracking-wide uppercase ${session.status === 'CONNECTED' ? 'text-emerald-600' :
                                            session.status === 'CONNECTING' ? 'text-amber-600' : 'text-gray-500'
                                            }`}>
                                            {session.status}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(session.id)}
                                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Delete Session"
                                >
                                    <Trash size={18} />
                                </button>
                            </div>

                            {qrCodes[session.id] && session.status !== 'CONNECTED' ? (
                                <div className="mt-4 flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4 border border-dashed border-gray-300">
                                    <img src={qrCodes[session.id]} alt="QR Code" className="w-40 h-40 mix-blend-multiply" />
                                    <p className="text-xs text-gray-500 mt-2 font-medium animate-pulse">Scan to connect</p>
                                </div>
                            ) : (
                                <div className="mt-4 h-40 flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    {session.status === 'CONNECTED' ? (
                                        <div className="text-center">
                                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <RefreshCw size={32} />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600">Device Connected</p>
                                            <p className="text-xs text-gray-400">Ready to send messages</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <Loader className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-spin" />
                                            <p className="text-xs text-gray-500">Waiting for QR Code...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                            <span className="font-mono">{session.id.substring(0, 12)}...</span>
                            {session.status === 'DISCONNECTED' && (
                                <button onClick={() => handleReconnect(session.id)} className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                                    <RefreshCw size={12} /> Reconnect
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {/* Add New Session Card */}
                {isAdding ? (
                    <div className="bg-white rounded-xl border-2 border-sisia-primary/50 shadow-md p-6 flex flex-col justify-center min-h-[300px] animate-fade-in">
                        <h3 className="font-bold text-lg text-gray-900 mb-4 text-center">New Device Connection</h3>
                        <div className="space-y-4 w-full">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Session Name</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. Marketing Phone"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary outline-none transition-all"
                                    value={newSessionId}
                                    onChange={(e) => setNewSessionId(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => { setIsAdding(false); setNewSessionId(''); }}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newSessionId}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${newSessionId
                                        ? 'bg-sisia-primary text-white hover:bg-emerald-700 shadow-md shadow-sisia-primary/20'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <Plus size={18} /> Connect
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 hover:border-sisia-primary hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center p-8 min-h-[300px] text-gray-400 hover:text-sisia-primary cursor-pointer group"
                        onClick={() => setIsAdding(true)}
                    >
                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Plus size={32} />
                        </div>
                        <h3 className="font-bold text-lg mb-1">Add New Device</h3>
                        <p className="text-sm text-center px-4 opacity-70">Connect another WhatsApp account</p>
                    </div>
                )}
            </div>
        </div>
    );

};

export default Sessions;
