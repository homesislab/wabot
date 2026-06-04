import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Trash, Search, FileText, Edit, X } from 'lucide-react';

const Notes = () => {
    const [notes, setNotes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ keyword: '', content: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);

    const fetchNotes = async () => {
        try {
            const res = await api.get('/notes');
            setNotes(res.data);
        } catch (error) {
            console.error('Failed to fetch notes:', error);
        }
    };

    useEffect(() => {
        fetchNotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Both create and update use POST in our controller due to upsert
            await api.post('/notes', formData);
            fetchNotes();
            handleCloseModal();
        } catch {
            alert('Failed to save note');
        }
    };

    const handleEdit = (note) => {
        setEditingId(note.id);
        setFormData({ keyword: note.keyword, content: note.content });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ keyword: '', content: '' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;
        try {
            await api.delete(`/notes/${id}`);
            fetchNotes();
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    const filteredNotes = notes.filter(n =>
        n.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Notes</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-sisia-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <Plus size={18} /> Add Note
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200/50 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by keyword or content..."
                            className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="text-xs text-gray-500 font-medium bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                        Total Notes: <span className="text-gray-900 font-bold">{filteredNotes.length}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Keyword</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Content</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredNotes.map(note => (
                                <tr key={note.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sisia-primary/20 to-teal-100 text-sisia-primary flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm">
                                                <FileText size={16} />
                                            </div>
                                            <span className="font-semibold text-gray-900">{note.keyword}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="text-sm max-w-md truncate" title={note.content}>
                                            {note.content}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(note)}
                                                className="p-2 text-gray-400 hover:text-sisia-primary hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 rounded-lg transition-all"
                                                title="Edit Note"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(note.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 rounded-lg transition-all"
                                                title="Delete Note"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredNotes.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <FileText size={48} className="mb-3 text-gray-200" />
                                            <p className="font-medium text-gray-500">{searchTerm ? "No notes match your search" : "No notes stored yet"}</p>
                                            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-sisia-primary hover:underline text-sm font-medium">Add your first note</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Note' : 'Add Note'}</h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sisia-primary/50 focus:border-sisia-primary outline-none transition-all"
                                    placeholder="e.g. wifi"
                                    value={formData.keyword}
                                    onChange={e => setFormData({ ...formData, keyword: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sisia-primary/50 focus:border-sisia-primary outline-none transition-all resize-y"
                                    placeholder="Enter note content..."
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-sisia-primary text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    {editingId ? 'Update Note' : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notes;
