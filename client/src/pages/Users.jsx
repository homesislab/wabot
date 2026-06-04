import React, { useEffect, useState } from 'react';
import api from '../api';
import { Trash, Plus, Shield, Key, X, Save, Coins, Power, Settings, Edit2, Search, User, Mail, Phone, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    // Modals state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null); // For Edit User (Profile)
    const [userToConfig, setUserToConfig] = useState(null); // For Settings (Plan/AI)
    const [userToCredit, setUserToCredit] = useState(null); // For Credits

    // Forms state
    const [formData, setFormData] = useState({ username: '', password: '', role: 'USER', email: '', phone: '' });
    const [editFormData, setEditFormData] = useState({ username: '', role: '', email: '', phone: '', password: '' });
    const [creditAmount, setCreditAmount] = useState(0);
    const [settingsData, setSettingsData] = useState({
        planType: '',
        messageCost: 1,
        planExpiresAt: '',
        aiApiKey: '',
        aiProvider: 'openai',
        aiModel: '',
        aiBriefing: '',
        isAiEnabled: false,
        isSchedulerEnabled: true,
        isAutoRetryEnabled: true
    });

    // Model options per provider
    const AI_MODELS = {
        openai: [
            { value: 'gpt-5.5',          label: 'GPT-5.5 (Terbaru, Pro)' },
            { value: 'gpt-5.4',          label: 'GPT-5.4 (Agents & Pro)' },
            { value: 'gpt-5.4-mini',     label: 'GPT-5.4 Mini (Cepat & Hemat)' },
            { value: 'gpt-4o',           label: 'GPT-4o' },
            { value: 'gpt-4o-mini',      label: 'GPT-4o Mini' },
            { value: 'gpt-4-turbo',      label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo',   label: 'GPT-3.5 Turbo (Paling Hemat)' },
        ],
        gemini: [
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Terbaru)' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { value: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro (Terbaik)' },
            { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Cepat)' },
        ],
    };

    const { user: currentUser } = useAuth();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', formData);
            setFormData({ username: '', password: '', role: 'USER', email: '', phone: '' });
            setIsAddModalOpen(false);
            fetchUsers();
            alert("User created successfully");
        } catch {
            alert("Failed to create user");
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${userToEdit.id}`, editFormData);
            setUserToEdit(null);
            fetchUsers();
            alert("User updated successfully");
        } catch {
            alert("Failed to update user");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This will delete all user data.")) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
        } catch {
            alert("Failed to delete user");
        }
    };

    const handleToggleStatus = async (user) => {
        if (!window.confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} this user?`)) return;
        try {
            await api.put(`/users/${user.id}`, { isActive: !user.isActive });
            fetchUsers();
        } catch {
            alert("Failed to update status");
        }
    };

    const handleAddCredits = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${userToCredit.id}/credits`, { amount: parseInt(creditAmount) });
            setUserToCredit(null);
            fetchUsers();
            alert("Credits updated");
        } catch {
            alert("Failed to update credits");
        }
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${userToConfig.id}`, { ...settingsData });
            setUserToConfig(null);
            fetchUsers();
            alert("Settings updated");
        } catch {
            alert("Failed to update settings");
        }
    };

    // Open Helpers
    const openEditModal = (user) => {
        setUserToEdit(user);
        setEditFormData({
            username: user.username,
            role: user.role,
            email: user.email || '',
            phone: user.phone || '',
            password: '' // Optional
        });
    };

    const openSettingsModal = (user) => {
        setUserToConfig(user);
        setSettingsData({
            planType: user.planType || 'PAY_AS_YOU_GO',
            messageCost: user.messageCost || 1,
            planExpiresAt: user.planExpiresAt || '',
            aiApiKey: user.aiApiKey || '',
            aiProvider: user.aiProvider || 'openai',
            aiModel: user.aiModel || '',
            aiBriefing: user.aiBriefing || '',
            isAiEnabled: user.isAiEnabled || false,
            isSchedulerEnabled: user.isSchedulerEnabled ?? true,
            isAutoRetryEnabled: user.isAutoRetryEnabled ?? true
        });
    };

    const openCreditModal = (user) => {
        setUserToCredit(user);
        setCreditAmount(0);
    };

    // Filter
    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (currentUser?.role !== 'ADMIN') {
        return <div className="p-8 text-center text-red-500 font-bold bg-white rounded-xl shadow-sm">Access Denied: Admin Privileges Required</div>;
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                    <p className="text-gray-500 mt-1">Create, manage and monitor user accounts</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-sisia-primary text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-sm font-medium flex items-center gap-2"
                >
                    <Plus size={20} /> Add New User
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-sisia-primary focus:ring-1 focus:ring-sisia-primary transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">{users.length}</span> Total Users
                </div>
            </div>

            {/* Users Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin w-10 h-10 border-4 border-sisia-primary border-t-transparent rounded-full"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User Profile</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role & Plan</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Credits</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-sisia-primary/10 flex items-center justify-center text-sisia-primary font-bold">
                                                    {u.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{u.username}</div>
                                                    <div className="text-xs text-gray-500">{u.email || 'No email'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-xs font-medium border ${u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                    {u.role === 'ADMIN' ? <Shield size={10} className="mr-1" /> : <User size={10} className="mr-1" />}
                                                    {u.role}
                                                </span>
                                                <span className="text-xs text-gray-600 font-medium tracking-wide">
                                                    {u.planType === 'UNLIMITED' ? 'Unlimited Plan' : u.planType === 'TIME_BASED' ? 'Time-Based' : 'Pay As You Go'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 font-mono text-gray-700 font-bold">
                                                <Coins size={14} className="text-amber-500" />
                                                {u.planType === 'UNLIMITED' ? '∞' : u.credits}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {u.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditModal(u)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Profile">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => openSettingsModal(u)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="Plan Settings">
                                                    <Settings size={18} />
                                                </button>
                                                <button onClick={() => openCreditModal(u)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Manage Credits">
                                                    <Coins size={18} />
                                                </button>
                                                <button onClick={() => handleToggleStatus(u)} className={`p-2 rounded-lg transition-all ${u.isActive ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-red-500 bg-red-50 hover:bg-red-100'}`} title={u.isActive ? "Deactivate" : "Activate"}>
                                                    <Power size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete User">
                                                    <Trash size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-400 bg-gray-50/30">
                                            <User size={48} className="mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">No users found matching your search</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Add New User</h3>
                            <button onClick={() => setIsAddModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input type="text" className="w-full border p-2 rounded-lg" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select className="w-full border p-2 rounded-lg" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="USER">User</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" className="w-full border p-2 rounded-lg" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input type="text" className="w-full border p-2 rounded-lg" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <input type="password" className="w-full border p-2 rounded-lg" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-sisia-primary text-white rounded-lg hover:bg-emerald-700">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {userToEdit && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Edit User</h3>
                            <button onClick={() => setUserToEdit(null)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input type="text" className="w-full border p-2 rounded-lg" value={editFormData.username} onChange={e => setEditFormData({ ...editFormData, username: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select className="w-full border p-2 rounded-lg" value={editFormData.role} onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}>
                                        <option value="USER">User</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" className="w-full border p-2 rounded-lg" value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input type="text" className="w-full border p-2 rounded-lg" value={editFormData.phone} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (Optional)</label>
                                <input type="password" className="w-full border p-2 rounded-lg" placeholder="Leave blank to keep current" value={editFormData.password} onChange={e => setEditFormData({ ...editFormData, password: e.target.value })} />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setUserToEdit(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-sisia-primary text-white rounded-lg hover:bg-emerald-700">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credits Modal (Reused) */}
            {userToCredit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Manage Credits</h3>
                        <p className="text-sm text-gray-500 mb-4">User: <span className="font-bold text-gray-800">{userToCredit.username}</span></p>
                        <form onSubmit={handleAddCredits}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Amount</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary"
                                    value={creditAmount}
                                    onChange={e => setCreditAmount(e.target.value)}
                                    autoFocus
                                    placeholder="Enter amount (e.g. 500 or -500)"
                                />
                                <p className="text-xs text-gray-500 mt-2">Use positive values to add, negative to deduct.</p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setUserToCredit(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-sisia-primary text-white rounded-lg hover:bg-emerald-700">Update Credits</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Plan Settings Modal */}
            {userToConfig && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">Plan & AI Settings</h3>
                        <form onSubmit={handleUpdateSettings}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                                <select
                                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary"
                                    value={settingsData.planType}
                                    onChange={e => setSettingsData({ ...settingsData, planType: e.target.value })}
                                >
                                    <option value="PAY_AS_YOU_GO">PAY_AS_YOU_GO</option>
                                    <option value="TIME_BASED">TIME_BASED (Subscription)</option>
                                    <option value="UNLIMITED">UNLIMITED (Lifetime)</option>
                                </select>
                            </div>
                            {settingsData.planType === 'TIME_BASED' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Expires At</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full border p-2 rounded-lg"
                                        value={settingsData.planExpiresAt && settingsData.planExpiresAt !== ''
                                            ? new Date(new Date(settingsData.planExpiresAt).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                                            : ''}
                                        onChange={e => setSettingsData({ ...settingsData, planExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                                    />
                                </div>
                            )}
                            {settingsData.planType !== 'UNLIMITED' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message Cost (Credits)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full border p-2 rounded-lg"
                                        value={settingsData.messageCost}
                                        onChange={e => setSettingsData({ ...settingsData, messageCost: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {/* System Automations Section */}
                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">System Automations</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Enable Scheduler</p>
                                            <p className="text-xs text-gray-500">Allow cron jobs to execute scheduled messages</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settingsData.isSchedulerEnabled}
                                                onChange={e => setSettingsData({ ...settingsData, isSchedulerEnabled: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sisia-primary"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Enable Auto-Retry</p>
                                            <p className="text-xs text-gray-500">Automatically retry failed broadcasts</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settingsData.isAutoRetryEnabled}
                                                onChange={e => setSettingsData({ ...settingsData, isAutoRetryEnabled: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sisia-primary"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* AI Settings Section */}
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">AI Configuration</h4>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settingsData.isAiEnabled}
                                            onChange={e => setSettingsData({ ...settingsData, isAiEnabled: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sisia-primary"></div>
                                        <span className="ml-3 text-sm font-medium text-gray-700">{settingsData.isAiEnabled ? 'Enabled' : 'Disabled'}</span>
                                    </label>
                                </div>

                                <div className={`space-y-4 transition-all duration-300 ${settingsData.isAiEnabled ? 'opacity-100 max-h-[600px]' : 'opacity-40 pointer-events-none max-h-0 overflow-hidden'}`}>
                                    {/* Provider */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
                                        <select
                                            className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary"
                                            value={settingsData.aiProvider}
                                            onChange={e => setSettingsData({ ...settingsData, aiProvider: e.target.value, aiModel: '' })}
                                        >
                                            <option value="openai">OpenAI (GPT)</option>
                                            <option value="gemini">Google Gemini</option>
                                        </select>
                                    </div>
                                    {/* Model Version */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Model Version</label>
                                        <select
                                            className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary"
                                            value={settingsData.aiModel}
                                            onChange={e => setSettingsData({ ...settingsData, aiModel: e.target.value })}
                                        >
                                            <option value="">-- Default --</option>
                                            {(AI_MODELS[settingsData.aiProvider] || []).map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {settingsData.aiProvider === 'openai'
                                                ? 'Default: gpt-4o-mini'
                                                : 'Default: gemini-1.5-flash'}
                                        </p>
                                    </div>
                                    {/* API Key */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">AI API Key</label>
                                        <input
                                            type="password"
                                            className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary"
                                            value={settingsData.aiApiKey}
                                            onChange={e => setSettingsData({ ...settingsData, aiApiKey: e.target.value })}
                                            placeholder={settingsData.aiProvider === 'openai' ? 'sk-...' : 'AIza...'}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            {settingsData.aiProvider === 'openai'
                                                ? 'Dari platform.openai.com'
                                                : 'Dari aistudio.google.com'}
                                        </p>
                                    </div>
                                    {/* Briefing */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">AI Briefing / System Instruction</label>
                                        <textarea
                                            className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sisia-primary min-h-[100px]"
                                            value={settingsData.aiBriefing}
                                            onChange={e => setSettingsData({ ...settingsData, aiBriefing: e.target.value })}
                                            placeholder="Example: You are a helpful customer service assistant for Wabot..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setUserToConfig(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-sisia-primary text-white rounded-lg hover:bg-emerald-700">Save Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Users;
