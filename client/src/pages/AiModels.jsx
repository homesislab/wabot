import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Bot, Plus, Trash2, Edit2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AiModels = () => {
    const { user } = useAuth();
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form, setForm] = useState({ id: null, provider: 'ollama', value: '', label: '', isActive: true });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const providers = ['ollama', 'gemini', 'openai'];

    const fetchModels = React.useCallback(async () => {
        try {
            const res = await api.get('/aimodels');
            setModels(res.data);
        } catch (err) {
            setError('Failed to load AI Models');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.role === 'ADMIN') {
            fetchModels();
        }
    }, [user, fetchModels]);

    if (user?.role !== 'ADMIN') {
        return <Navigate to="/app" />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSubmitting(true);

        try {
            if (form.id) {
                await api.put(`/aimodels/${form.id}`, form);
                setSuccess('Model updated successfully');
            } else {
                await api.post('/aimodels', form);
                setSuccess('Model added successfully');
            }
            fetchModels();
            setTimeout(() => {
                setIsModalOpen(false);
                setSuccess('');
            }, 1000);
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (model) => {
        setForm({ ...model });
        setIsModalOpen(true);
        setError('');
        setSuccess('');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this AI Model?')) return;
        try {
            await api.delete(`/aimodels/${id}`);
            fetchModels();
            setSuccess('Model deleted successfully');
            setTimeout(() => setSuccess(''), 2000);
        } catch (err) {
            setError('Failed to delete model');
            setTimeout(() => setError(''), 2000);
        }
    };

    const openCreateModal = () => {
        setForm({ id: null, provider: 'ollama', value: '', label: '', isActive: true });
        setIsModalOpen(true);
        setError('');
        setSuccess('');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bot className="text-sisia-primary" /> AI Models Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage AI providers and models available to users.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-sisia-primary text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-sisia-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <Plus size={18} /> Add Model
                </button>
            </div>

            {error && !isModalOpen && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
                    <ShieldCheck size={20} /> {error}
                </div>
            )}
            {success && !isModalOpen && (
                <div className="bg-green-50 text-green-600 p-4 rounded-xl flex items-center gap-3">
                    <CheckCircle2 size={20} /> {success}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 font-semibold text-gray-600 text-sm">Provider</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm">Value (ID)</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm">Label</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm text-center">Status</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">Loading AI models...</td>
                                </tr>
                            ) : models.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">No AI models found.</td>
                                </tr>
                            ) : (
                                models.map((model) => (
                                    <tr key={model.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 bg-sisia-light/50 text-sisia-primary text-xs font-semibold rounded-lg uppercase tracking-wider">
                                                {model.provider}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-800 font-mono text-sm">{model.value}</td>
                                        <td className="p-4 text-gray-800 font-medium">{model.label}</td>
                                        <td className="p-4 text-center">
                                            {model.isActive ? (
                                                <span className="text-green-500 bg-green-50 px-2 py-1 rounded-md text-xs font-medium">Active</span>
                                            ) : (
                                                <span className="text-gray-400 bg-gray-100 px-2 py-1 rounded-md text-xs font-medium">Disabled</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={() => handleEdit(model)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(model.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">{form.id ? 'Edit AI Model' : 'Add New Model'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && <div className="text-red-500 bg-red-50 p-3 rounded-lg text-sm">{error}</div>}
                            {success && <div className="text-green-500 bg-green-50 p-3 rounded-lg text-sm">{success}</div>}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                <select
                                    value={form.provider}
                                    onChange={e => setForm({ ...form, provider: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 bg-white"
                                    required
                                >
                                    {providers.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model Value (ID)</label>
                                <input
                                    type="text"
                                    value={form.value}
                                    onChange={e => setForm({ ...form, value: e.target.value })}
                                    placeholder="e.g., gpt-4o"
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 bg-white font-mono text-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Display Label</label>
                                <input
                                    type="text"
                                    value={form.label}
                                    onChange={e => setForm({ ...form, label: e.target.value })}
                                    placeholder="e.g., GPT-4 Omni"
                                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 bg-white"
                                    required
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                    className="w-4 h-4 text-sisia-primary rounded focus:ring-sisia-primary"
                                />
                                <span className="text-sm text-gray-700">Active</span>
                            </label>

                            <div className="pt-4 border-t flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="bg-sisia-primary text-white px-6 py-2.5 rounded-xl font-medium shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
                                    {isSubmitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiModels;
