import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Trash, Edit2, Shield, Bot, Power, PowerOff } from 'lucide-react';

const TelegramBots = () => {
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const initialFormState = {
        name: '',
        token: '',
        username: '',
        isActive: true
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchBots();
    }, []);

    const fetchBots = async () => {
        setLoading(true);
        try {
            const res = await api.get('/telegram-bots');
            setBots(res.data);
        } catch (error) {
            console.error("Failed to fetch Telegram bots", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (bot = null) => {
        if (bot) {
            setEditingId(bot.id);
            setFormData({
                name: bot.name,
                token: bot.token,
                username: bot.username || '',
                isActive: bot.isActive
            });
        } else {
            setEditingId(null);
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingId) {
                await api.put(`/telegram-bots/${editingId}`, formData);
                alert("Telegram Bot updated");
            } else {
                await api.post('/telegram-bots', formData);
                alert("Telegram Bot created");
            }
            setIsModalOpen(false);
            fetchBots();
        } catch (error) {
            console.error(error);
            alert("Failed to save Telegram Bot");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This will remove the bot and stop all Telegram integrations.")) return;
        try {
            await api.delete(`/telegram-bots/${id}`);
            fetchBots();
        } catch {
            alert("Failed to delete Telegram Bot");
        }
    };

    const toggleStatus = async (bot) => {
        try {
            await api.put(`/telegram-bots/${bot.id}`, { ...bot, isActive: !bot.isActive });
            fetchBots();
        } catch {
            alert("Failed to toggled bot status");
        }
    };


    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bot className="text-blue-500" /> Telegram Bots
                    </h1>
                    <p className="text-gray-500 mt-1">Manage your Telegram Bot tokens for cross-platform integration.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-500 text-white px-5 py-2.5 rounded-xl hover:bg-blue-600 transition shadow-sm font-medium flex items-center gap-2"
                >
                    <Plus size={20} /> Add Bot
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
            ) : bots.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No Telegram Bots</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-2">Add a Telegram Bot token to enable AI replies, games, and broadcasts on Telegram.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {bots.map(bot => (
                        <div key={bot.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col hover:shadow-md transition-shadow relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${bot.isActive ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'}`}>
                                    <Bot size={24} />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleStatus(bot)}
                                        title={bot.isActive ? "Deactivate" : "Activate"}
                                        className={`p-2 rounded-lg transition-colors ${bot.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                    >
                                        {bot.isActive ? <Power size={18} /> : <PowerOff size={18} />}
                                    </button>
                                    <button onClick={() => handleOpenModal(bot)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(bot.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-1">{bot.name}</h3>
                            <div className="text-sm text-gray-500 mb-4 font-medium flex items-center gap-2">
                                {bot.username ? `@${bot.username}` : 'No Username Set'}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${bot.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {bot.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                            </div>

                            <div className="mt-auto pt-4 border-t border-gray-100">
                                <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Bot Token</p>
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-lg font-mono text-xs text-gray-700 truncate" title={bot.token}>
                                    {bot.token.substring(0, 10)}...{bot.token.substring(bot.token.length - 5)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                <Bot size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">{editingId ? 'Edit Telegram Bot' : 'Add Telegram Bot'}</h3>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bot Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text" required
                                    className="w-full border-gray-300 border focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none p-3 rounded-xl transition-all"
                                    placeholder="e.g. My Support Bot"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">A friendly name for your reference.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bot Token <span className="text-red-500">*</span></label>
                                <input
                                    type="text" required
                                    className="w-full border-gray-300 border focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none p-3 rounded-xl font-mono text-sm transition-all"
                                    placeholder="123456789:ABCdefGHIjklmNOPqrstUVWxyz"
                                    value={formData.token}
                                    onChange={e => setFormData({ ...formData, token: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Obtain this from @BotFather on Telegram.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bot Username (Optional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-gray-400 font-medium">@</span>
                                    <input
                                        type="text"
                                        className="w-full pl-9 border-gray-300 border focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none p-3 rounded-xl transition-all"
                                        placeholder="mysupport_bot"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value.replace('@', '') })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.isActive}
                                        onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Bot Active Status</p>
                                    <p className="text-xs text-gray-500">Enable or disable message processing for this bot.</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 focus:ring-4 focus:ring-blue-200 transition-all shadow-sm">Save Bot</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramBots;
