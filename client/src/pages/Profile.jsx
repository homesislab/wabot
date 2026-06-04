import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Coins, Zap, Edit2, Key, Loader, Bot, Settings } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
    const { setUser } = useAuth();

    const [aiModels, setAiModels] = useState({});
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Edit Profile State
    const [editForm, setEditForm] = useState({ email: '', phone: '', aiProvider: 'openai', aiModel: '', aiApiKey: '', isAiEnabled: false, isImageEnabled: true, aiImageProvider: 'hercai', aiImageApiKey: '', isSchedulerEnabled: true, isAutoRetryEnabled: true });

    // Change Password State
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    const [modalError, setModalError] = useState('');
    const [modalSuccess, setModalSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchProfile = React.useCallback(async () => {
        try {
            const [res, modelsRes] = await Promise.all([
                api.get('/auth/me'),
                api.get('/aimodels?group=true').catch(() => ({ data: {} }))
            ]);
            setProfile(res.data);
            setAiModels(modelsRes.data || {});
            setEditForm({
                email: res.data.email || '',
                phone: res.data.phone || '',
                aiProvider: res.data.aiProvider || 'openai',
                aiModel: res.data.aiModel || '',
                aiApiKey: res.data.aiApiKey || '',
                isAiEnabled: res.data.isAiEnabled || false,
                isImageEnabled: res.data.isImageEnabled ?? true,
                aiImageProvider: res.data.aiImageProvider || 'hercai',
                isSchedulerEnabled: res.data.isSchedulerEnabled ?? true,
                isAutoRetryEnabled: res.data.isAutoRetryEnabled ?? true
            });
            if (setUser) setUser(res.data);
        } catch {
            setError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, [setUser]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setModalError('');
        setModalSuccess('');
        setIsSubmitting(true);

        try {
            await api.put('/auth/me', editForm);
            setModalSuccess('Profile updated successfully');
            fetchProfile(); // Refresh data
            setTimeout(() => {
                setIsEditModalOpen(false);
                setModalSuccess('');
            }, 1000);
        } catch (err) {
            setModalError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setModalError('');
        setModalSuccess('');

        if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
            setModalError('New passwords do not match');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.put('/auth/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setModalSuccess('Password changed successfully');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
            setTimeout(() => {
                setIsPasswordModalOpen(false);
                setModalSuccess('');
            }, 1000);
        } catch (err) {
            setModalError(err.response?.data?.error || 'Failed to change password');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader className="animate-spin text-sisia-primary" size={32} />
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-full text-red-500">
            {error}
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6 relative">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <User className="text-sisia-primary" />
                User Profile
            </h1>

            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-sisia-primary/10 flex items-center justify-center text-sisia-primary text-3xl font-bold border-4 border-white shadow-sm">
                    {profile?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-bold text-gray-900">{profile?.username}</h2>
                    <p className="text-gray-500 flex items-center justify-center md:justify-start gap-1 mt-1">
                        <Shield size={16} />
                        <span className="capitalize">{profile?.role?.toLowerCase()}</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setEditForm({
                                email: profile?.email || '',
                                phone: profile?.phone || '',
                                aiProvider: profile?.aiProvider || 'openai',
                                aiModel: profile?.aiModel || '',
                                aiApiKey: profile?.aiApiKey || '',
                                isAiEnabled: profile?.isAiEnabled || false,
                                isImageEnabled: profile?.isImageEnabled ?? true,
                                aiImageProvider: profile?.aiImageProvider || 'hercai',
                                isSchedulerEnabled: profile?.isSchedulerEnabled ?? true,
                                isAutoRetryEnabled: profile?.isAutoRetryEnabled ?? true
                            });
                            setModalError('');
                            setIsEditModalOpen(true);
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <Edit2 size={16} />
                        Edit Profile
                    </button>
                    <button
                        onClick={() => {
                            setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
                            setModalError('');
                            setModalSuccess('');
                            setIsPasswordModalOpen(true);
                        }}
                        className="px-4 py-2 bg-sisia-primary/10 hover:bg-sisia-primary/20 text-sisia-primary rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <Key size={16} />
                        Change Password
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 h-full">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Contact Information</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 text-blue-500 rounded-lg shrink-0">
                                <Mail size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Email Address</p>
                                <p className="text-gray-900 font-medium">{profile?.email || 'Not set'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-50 text-green-500 rounded-lg shrink-0">
                                <Phone size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Phone Number</p>
                                <p className="text-gray-900 font-medium">{profile?.phone || 'Not set'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plan & Usage */}
                <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 h-full">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Plan & Usage</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-50 text-amber-500 rounded-lg shrink-0">
                                <Coins size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm text-gray-500 font-medium">Credits Balance</p>
                                    {profile?.planType !== 'UNLIMITED' && (
                                        <a
                                            href={`https://wa.me/${import.meta.env.VITE_ADMIN_PHONE}?text=Hello, I would like to buy more credits for my account: ${profile?.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded hover:bg-amber-200 transition-colors"
                                        >
                                            BUY CREDITS
                                        </a>
                                    )}
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {profile?.planType === 'UNLIMITED' ? '∞' : (profile?.credits || 0)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-50 text-purple-500 rounded-lg shrink-0">
                                <Zap size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm text-gray-500 font-medium">Current Plan</p>
                                    {profile?.planType !== 'UNLIMITED' && (
                                        <a
                                            href={`https://wa.me/${import.meta.env.VITE_ADMIN_PHONE}?text=Hello, I would like to change my plan schema for account: ${profile?.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded hover:bg-purple-200 transition-colors"
                                        >
                                            CHANGE PLAN
                                        </a>
                                    )}
                                </div>
                                <p className="text-lg font-bold text-gray-900">
                                    {profile?.planType === 'UNLIMITED' ? 'Unlimited Plan' :
                                        profile?.planType === 'TIME_BASED' ? 'Time Based Subscription' : 'Pay As You Go'}
                                </p>
                                {profile?.planType === 'UNLIMITED' ? (
                                    <p className="text-xs font-medium mt-1 text-emerald-600">
                                        Lifetime access with unlimited credits
                                    </p>
                                ) : profile?.planType === 'TIME_BASED' && (
                                    <p className={`text-xs font-medium mt-1 ${profile?.planExpiresAt ? 'text-gray-600' : 'text-amber-600'}`}>
                                        Valid Until: {profile?.planExpiresAt ? new Date(profile.planExpiresAt).toLocaleDateString() : 'Pending verification'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Automations */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 flex flex-col gap-4 mt-6">
                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Settings size={20} className="text-sisia-primary" />
                    System Automations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">Background Scheduler</p>
                        <p className={`font-medium ${profile?.isSchedulerEnabled !== false ? 'text-green-600' : 'text-gray-500'}`}>
                            {profile?.isSchedulerEnabled !== false ? '● Active' : '○ Paused'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Allows cron jobs to run for scheduled messages.</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">Broadcast Auto-Retry</p>
                        <p className={`font-medium ${profile?.isAutoRetryEnabled !== false ? 'text-green-600' : 'text-gray-500'}`}>
                            {profile?.isAutoRetryEnabled !== false ? '● Active' : '○ Disabled'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Automatically retries failed broadcast messages every hour.</p>
                    </div>
                </div>
            </div>

            {/* AI Configuration */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 flex flex-col gap-4 mt-6">
                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Bot size={20} className="text-sisia-primary" />
                    AI Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">AI Provider</p>
                        <div className="flex flex-col gap-1">
                            <span className={`w-fit px-2 py-1 rounded-md text-sm font-medium ${profile?.aiProvider === 'gemini' ? 'bg-blue-100 text-blue-700' : profile?.aiProvider === 'ollama' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {profile?.aiProvider === 'gemini' ? 'Google Gemini' : profile?.aiProvider === 'ollama' ? 'Ollama (Local)' : 'OpenAI'}
                            </span>
                            <span className="text-sm text-gray-600 font-medium">
                                Model: {profile?.aiModel || 'Default'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">API Key Status</p>
                        <p className={`font-medium ${profile?.aiApiKey ? 'text-green-600' : 'text-red-500'}`}>
                            {profile?.aiApiKey ? '● Configured' : '○ Not Configured'}
                        </p>
                    </div>
                    <div className="md:col-span-2 border-t pt-2">
                        <p className="text-sm text-gray-500 font-medium mb-1">Image Generation</p>
                        <div className="flex gap-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${profile?.isImageEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {profile?.isImageEnabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                            <span className="text-sm text-gray-600">
                                Default Provider: <span className="font-bold text-sisia-primary capitalize">{profile?.aiImageProvider}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">Edit Profile</h3>
                        {modalError && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{modalError}</div>}
                        {modalSuccess && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{modalSuccess}</div>}

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={editForm.phone}
                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary"
                                />
                            </div>

                            <div className="border-t pt-4 mt-2 mb-2">
                                <h4 className="font-medium text-gray-800 mb-3 flex items-center justify-between">
                                    System Automations
                                </h4>
                                <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm font-medium text-gray-700">Enable Scheduler</span>
                                        <div className="relative inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={editForm.isSchedulerEnabled}
                                                onChange={e => setEditForm({ ...editForm, isSchedulerEnabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sisia-primary"></div>
                                        </div>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm font-medium text-gray-700">Enable Auto-Retry</span>
                                        <div className="relative inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={editForm.isAutoRetryEnabled}
                                                onChange={e => setEditForm({ ...editForm, isAutoRetryEnabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sisia-primary"></div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-2">
                                <h4 className="font-medium text-gray-800 mb-3 flex items-center justify-between">
                                    AI Settings
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.isAiEnabled}
                                            onChange={e => setEditForm({ ...editForm, isAiEnabled: e.target.checked })}
                                            className="w-4 h-4 text-sisia-primary rounded focus:ring-sisia-primary"
                                        />
                                        <span className="text-xs font-normal text-gray-500">Enable AI Features</span>
                                    </label>
                                </h4>
                                <div className={`space-y-4 ${!editForm.isAiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="border border-sisia-primary/10 rounded-xl p-3 bg-sisia-primary/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className="text-sm font-bold text-gray-800">Image Generation Settings</h5>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.isImageEnabled}
                                                    onChange={e => setEditForm({ ...editForm, isImageEnabled: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sisia-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sisia-primary"></div>
                                            </label>
                                        </div>
                                        <div className={`space-y-3 ${!editForm.isImageEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Image Provider</label>
                                                <select
                                                    value={editForm.aiImageProvider}
                                                    onChange={e => setEditForm({ ...editForm, aiImageProvider: e.target.value })}
                                                    className="w-full px-3 py-1.5 border rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary bg-white text-sm"
                                                >
                                                    <option value="hercai">Hercai (Free, Fast)</option>
                                                    <option value="pollinations">Pollinations (Free, Robust)</option>
                                                    <option value="openai">OpenAI DALL-E (Premium)</option>
                                                    <option value="gemini">Google Gemini (Auto-Refine)</option>
                                                </select>
                                                {(editForm.aiImageProvider === 'openai' || editForm.aiImageProvider === 'gemini') && (
                                                    <div className="mt-3">
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            {editForm.aiImageProvider === 'openai' ? 'OpenAI API Key (DALL-E)' : 'Gemini API Key (Refinement)'}
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={editForm.aiImageApiKey}
                                                            onChange={e => setEditForm({ ...editForm, aiImageApiKey: e.target.value })}
                                                            placeholder="Leave empty to use general key"
                                                            className="w-full px-3 py-1.5 border rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary bg-white text-xs"
                                                        />
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-gray-500 mt-1 italic">
                                                    *If primary fails, system automatically tries free alternatives.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                            <select
                                                value={editForm.aiProvider}
                                                onChange={e => setEditForm({ ...editForm, aiProvider: e.target.value, aiModel: '' })}
                                                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary bg-white"
                                            >
                                                <option value="openai">OpenAI (GPT)</option>
                                                <option value="gemini">Google Gemini</option>
                                                <option value="ollama">Ollama (Local)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Model Version</label>
                                            <select
                                                value={editForm.aiModel}
                                                onChange={e => setEditForm({ ...editForm, aiModel: e.target.value })}
                                                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary bg-white"
                                            >
                                                <option value="">-- Default --</option>
                                                {(aiModels[editForm.aiProvider] || []).map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {editForm.aiProvider === 'openai' ? 'Default: gpt-4o-mini' : editForm.aiProvider === 'ollama' ? 'Default: llama3' : 'Default: gemini-1.5-flash'}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {editForm.aiProvider === 'ollama' ? 'Ollama Base URL' : 'API Key'}
                                        </label>
                                        <input
                                            type={editForm.aiProvider === 'ollama' ? 'text' : 'password'}
                                            value={editForm.aiApiKey}
                                            onChange={e => setEditForm({ ...editForm, aiApiKey: e.target.value })}
                                            placeholder={editForm.aiProvider === 'ollama' ? 'http://localhost:11434' : 'sk-...'}
                                            className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {editForm.aiProvider === 'gemini' ? 'Get key from Google AI Studio' : editForm.aiProvider === 'ollama' ? 'e.g. http://localhost:11434' : 'Get key from OpenAI Platform'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-sisia-primary text-white rounded-xl hover:bg-sisia-dark transition-colors font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">Change Password</h3>
                        {modalError && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{modalError}</div>}
                        {modalSuccess && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{modalSuccess}</div>}

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmNewPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsPasswordModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-sisia-primary text-white rounded-xl hover:bg-sisia-dark transition-colors font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
