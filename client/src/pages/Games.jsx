import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Trash2, Edit2, Play, AlertTriangle } from 'lucide-react';

const Games = () => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    // Form State
    const [form, setForm] = useState({
        id: null,
        name: '',
        trigger: '',
        type: 'TRIVIA',
        reward: 10,
        isActive: true,
        // Specific configs
        triviaQuestions: [{ question: '', options: ['', '', '', ''], answer: '' }],
        aiSystemPrompt: '',
        guessMin: 1,
        guessMax: 100,
        guessMaxAttempts: 5,
        aiTriviaTopic: '',
        aiTriviaCount: 5
    });

    const [error, setError] = useState(null);

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        try {
            const { data } = await api.get('/games');
            setGames(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch games');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (game = null) => {
        if (game) {
            const config = JSON.parse(game.config);
            setForm({
                id: game.id,
                name: game.name,
                trigger: game.trigger,
                type: game.type,
                reward: game.reward,
                isActive: game.isActive,
                triviaQuestions: game.type === 'TRIVIA' ? config.questions : [{ question: '', options: ['', '', '', ''], answer: '' }],
                aiSystemPrompt: game.type === 'AI_RPG' ? config.systemPrompt : '',
                guessMin: game.type === 'GUESS_NUMBER' ? config.min : 1,
                guessMax: game.type === 'GUESS_NUMBER' ? config.max : 100,
                guessMaxAttempts: game.type === 'GUESS_NUMBER' ? config.maxAttempts : 5,
                aiTriviaTopic: '',
                aiTriviaCount: 5
            });
        } else {
            setForm({
                id: null,
                name: '',
                trigger: '',
                type: 'TRIVIA',
                reward: 10,
                isActive: true,
                triviaQuestions: [{ question: '', options: ['', '', '', ''], answer: '' }],
                aiSystemPrompt: '',
                guessMin: 1,
                guessMax: 100,
                guessMaxAttempts: 5,
                aiTriviaTopic: '',
                aiTriviaCount: 5
            });
        }
        setError(null);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        let config = {};
        if (form.type === 'TRIVIA') {
            // Validate trivia
            for (let i = 0; i < form.triviaQuestions.length; i++) {
                const q = form.triviaQuestions[i];
                if (!q.question || q.options.some(o => !o) || !q.answer) {
                    setError('Harap lengkapi semua pertanyaan dan jawaban Trivia.');
                    return;
                }
                if (!q.options.includes(q.answer)) {
                    setError(`Jawaban benar pada soal ke-${i + 1} harus sama persis dengan salah satu opsi.`);
                    return;
                }
            }
            config = { questions: form.triviaQuestions };
        } else if (form.type === 'AI_RPG') {
            if (!form.aiSystemPrompt) {
                setError('System prompt RPG tidak boleh kosong.');
                return;
            }
            config = { systemPrompt: form.aiSystemPrompt, openingScene: "Petualangan dimulai..." };
        } else if (form.type === 'GUESS_NUMBER') {
            config = { min: parseInt(form.guessMin), max: parseInt(form.guessMax), maxAttempts: parseInt(form.guessMaxAttempts) };
        }

        const payload = {
            name: form.name,
            trigger: form.trigger,
            type: form.type,
            reward: form.reward,
            isActive: form.isActive,
            config: config
        };

        try {
            if (form.id) {
                await api.put(`/games/${form.id}`, payload);
            } else {
                await api.post('/games', payload);
            }
            setIsModalOpen(false);
            fetchGames();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save game');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus game ini? Pemain yang sedang aktif akan direset.')) return;
        try {
            await api.delete(`/games/${id}`);
            fetchGames();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete game');
        }
    };

    const handleAddQuestion = () => {
        setForm({
            ...form,
            triviaQuestions: [...form.triviaQuestions, { question: '', options: ['', '', '', ''], answer: '' }]
        });
    };

    const handleRemoveQuestion = (index) => {
        const newQ = [...form.triviaQuestions];
        newQ.splice(index, 1);
        setForm({ ...form, triviaQuestions: newQ });
    };

    const handleGenerateAiTrivia = async () => {
        if (!form.aiTriviaTopic) {
            setError('Harap masukkan Topik untuk AI.');
            return;
        }
        setError(null);
        setIsGeneratingAi(true);
        try {
            const { data } = await api.post('/games/generate-trivia', {
                topic: form.aiTriviaTopic,
                numQuestions: form.aiTriviaCount
            });

            // data is JSON Array: [{question, options:[], answer}]
            if (Array.isArray(data) && data.length > 0) {
                setForm(prev => ({
                    ...prev,
                    triviaQuestions: [...prev.triviaQuestions.filter(q => q.question !== ''), ...data]
                }));
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal generate soal dari AI.');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleQuestionChange = (index, field, value, optIndex = -1) => {
        const newQ = [...form.triviaQuestions];
        if (field === 'options') {
            newQ[index].options[optIndex] = value;
        } else {
            newQ[index][field] = value;
        }
        setForm({ ...form, triviaQuestions: newQ });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Game Builder</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-sisia-primary text-white px-4 py-2 rounded-lg shadow hover:bg-sisia-secondary transition"
                >
                    <Plus size={20} />
                    Buat Game Baru
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sisia-primary"></div>
                </div>
            ) : games.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Play size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Belum ada Game</h3>
                    <p className="text-gray-500">Buat skenario pertama Anda agar user bisa bermain via WhatsApp.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {games.map(game => (
                        <div key={game.id} className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden hover:shadow-md transition">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg">{game.name}</h3>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                            {game.type}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${game.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {game.isActive ? 'Active' : 'Draft'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sisia-primary font-bold">{game.reward} pts</div>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="text-sm text-gray-500 mb-4">
                                    Trigger Keyword: <span className="font-mono text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{game.trigger}</span>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleOpenModal(game)} className="p-2 text-gray-400 hover:text-sisia-primary transition">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(game.id)} className="p-2 text-gray-400 hover:text-red-500 transition">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800">
                                {form.id ? 'Edit Game' : 'Buat Game Baru'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <form id="gameForm" onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Game</label>
                                        <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-sisia-primary focus:border-sisia-primary" placeholder="Cth: Kuis Ramadhan" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Trigger (Keyword WhatsApp)</label>
                                        <input type="text" required value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-sisia-primary focus:border-sisia-primary" placeholder="Cth: !kuis" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Game</label>
                                        <select disabled={!!form.id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-sisia-primary focus:border-sisia-primary">
                                            <option value="TRIVIA">Trivia (Pilihan Ganda)</option>
                                            <option value="AI_RPG">AI RPG (Petualangan)</option>
                                            <option value="GUESS_NUMBER">Tebak Angka</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Reward Credits</label>
                                        <input type="number" required min="0" value={form.reward} onChange={(e) => setForm({ ...form, reward: parseInt(e.target.value) })} className="w-full p-2 border border-gray-300 rounded focus:ring-sisia-primary" />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded text-sisia-primary focus:ring-sisia-primary h-5 w-5" />
                                            <span className="text-sm font-medium text-gray-700">Aktif (Bisa Dimainkan)</span>
                                        </label>
                                    </div>
                                </div>

                                <hr className="border-gray-200" />

                                {/* DYNAMIC CONFIG SECTION */}
                                {form.type === 'TRIVIA' && (
                                    <div className="space-y-6">

                                        {/* AI Generator Box */}
                                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-6">
                                            <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                                <span className="text-xl">✨</span> Generate Soal Otomatis via AI
                                            </h3>
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Topik Kuis</label>
                                                    <input type="text" value={form.aiTriviaTopic} onChange={(e) => setForm({ ...form, aiTriviaTopic: e.target.value })} placeholder="Cth: Sejarah Indonesia, Anime Naruto..." className="w-full p-2 text-sm border border-indigo-200 rounded focus:ring-indigo-500" />
                                                </div>
                                                <div className="w-24">
                                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Jumlah</label>
                                                    <input type="number" min="1" max="15" value={form.aiTriviaCount} onChange={(e) => setForm({ ...form, aiTriviaCount: parseInt(e.target.value) })} className="w-full p-2 text-sm border border-indigo-200 rounded focus:ring-indigo-500" />
                                                </div>
                                                <button type="button" disabled={isGeneratingAi} onClick={handleGenerateAiTrivia} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium transition disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center gap-2">
                                                    {isGeneratingAi ? (
                                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Thinking...</>
                                                    ) : (
                                                        'Buat Soal'
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-gray-800">Daftar Soal Manual</h3>
                                            <button type="button" onClick={handleAddQuestion} className="text-sm text-sisia-primary font-semibold hover:underline">
                                                + Tambah Soal
                                            </button>
                                        </div>
                                        {form.triviaQuestions.map((q, qIndex) => (
                                            <div key={qIndex} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                                                {form.triviaQuestions.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveQuestion(qIndex)} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan {qIndex + 1}</label>
                                                <textarea required value={q.question} onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)} className="w-full p-2 border border-gray-300 rounded mb-4" rows="2" placeholder="Cth: Siapa penemu lampu?"></textarea>

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    {q.options.map((opt, oIndex) => (
                                                        <div key={oIndex}>
                                                            <label className="block text-xs text-gray-500 mb-1">Pilihan {String.fromCharCode(65 + oIndex)}</label>
                                                            <input type="text" required value={opt} onChange={(e) => handleQuestionChange(qIndex, 'options', e.target.value, oIndex)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder={`Opsi ${String.fromCharCode(65 + oIndex)}`} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jawaban Benar (Copy paste persis dari salah satu pilihan di atas)</label>
                                                    <input type="text" required value={q.answer} onChange={(e) => handleQuestionChange(qIndex, 'answer', e.target.value)} className="w-full p-2 border border-green-300 bg-green-50 rounded" placeholder="Ketik jawaban benar persis seperti opsi..." />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {form.type === 'AI_RPG' && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Konfigurasi AI RPG</h3>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt / Tema / Skenario</label>
                                        <p className="text-xs text-gray-500 mb-2">
                                            AI akan membuat peran unik untuk masing-masing pemain yang *join* berdasarkan tema ini.<br />
                                            Selama permainan, pemain dapat saling berdiskusi bebas (tanpa bot membalas). <br />
                                            Gunakan command <b>!lanjut</b> untuk meminta AI mengevaluasi semua obrolan dan melanjutkan cerita.
                                        </p>
                                        <textarea required value={form.aiSystemPrompt} onChange={(e) => setForm({ ...form, aiSystemPrompt: e.target.value })} className="w-full p-3 border border-gray-300 rounded h-40 focus:ring-sisia-primary" placeholder="Cth: Tema Sci-Fi Horror di kapal luar angkasa yang terbengkalai. Pemain harus bertahan hidup dari serangan alien."></textarea>
                                    </div>
                                )}

                                {form.type === 'GUESS_NUMBER' && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Pengaturan Tebak Angka</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Angka Minimum</label>
                                                <input type="number" required value={form.guessMin} onChange={(e) => setForm({ ...form, guessMin: e.target.value })} className="w-full p-2 border border-gray-300 rounded" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Angka Maksimum</label>
                                                <input type="number" required value={form.guessMax} onChange={(e) => setForm({ ...form, guessMax: e.target.value })} className="w-full p-2 border border-gray-300 rounded" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Maks. Tebakan</label>
                                                <input type="number" required value={form.guessMaxAttempts} onChange={(e) => setForm({ ...form, guessMaxAttempts: e.target.value })} className="w-full p-2 border border-gray-300 rounded" />
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-4">Bot akan mengundi nomor secara acak di antara Min dan Max saat game dimulai.</p>
                                    </div>
                                )}

                            </form>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                Batal
                            </button>
                            <button type="submit" form="gameForm" className="px-6 py-2 text-white bg-sisia-primary rounded-lg shadow-md hover:bg-sisia-secondary">
                                Simpan Game
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Games;
