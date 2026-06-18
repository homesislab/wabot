import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);
    const { login, loginWithToken, user } = useAuth();
    const navigate = useNavigate();
    const googleBtnRef = useRef(null);



    const handleGoogleCallback = React.useCallback(async (response) => {
        setGoogleLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/google', { credential: response.credential });
            loginWithToken(res.data);
            navigate('/app');
        } catch (err) {
            setError(err.response?.data?.error || 'Login Google gagal');
        } finally {
            setGoogleLoading(false);
        }
    }, [loginWithToken, navigate]);

    // ─── Google Identity Services ───────────────────────
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return;

        const initGoogle = () => {
            if (!window.google) return;
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCallback,
                auto_select: false,
                cancel_on_tap_outside: true,
            });
            if (googleBtnRef.current) {
                window.google.accounts.id.renderButton(googleBtnRef.current, {
                    theme: 'outline',
                    size: 'large',
                    width: googleBtnRef.current.offsetWidth || 380,
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left',
                });
            }
        };

        if (window.google) {
            initGoogle();
        } else {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = initGoogle;
            document.head.appendChild(script);
        }
    }, [handleGoogleCallback]);

    // ─── Username/Password Login ──────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(username, password);
            navigate('/app');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    if (user) return <Navigate to="/app" />;

    return (
        <div className="min-h-screen flex bg-bone-white font-sans text-gray-800">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-sisia-dark relative overflow-hidden flex-col justify-between p-12 text-white">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sisia-primary/20 to-transparent pointer-events-none"></div>
                <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-sisia-primary/30 rounded-full blur-3xl"></div>

                <div className="relative z-10 flex items-center gap-3">
                    <span className="text-2xl font-bold tracking-tight">SISIA</span>
                </div>

                <div className="relative z-10 max-w-md">
                    <h1 className="text-4xl font-bold mb-6 leading-tight">Automation at your fingertips.</h1>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Manage your WhatsApp sessions, schedule broadcasts, and automate customer interactions with ease.
                    </p>
                </div>

                <div className="relative z-10 text-sm text-gray-500">
                    © {new Date().getFullYear()} Sisia Platform. All rights reserved.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="flex justify-center lg:hidden mb-6">
                            <span className="text-2xl font-bold tracking-tight text-sisia-primary">SISIA</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-sisia-dark">Welcome back</h2>
                        <p className="mt-2 text-gray-500">Please enter your credentials to access the dashboard.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
                            <ShieldCheck size={18} />
                            {error}
                        </div>
                    )}

                    {/* Google Login Button */}
                    {GOOGLE_CLIENT_ID && (
                        <div className="space-y-3">
                            <div
                                ref={googleBtnRef}
                                className="w-full"
                                style={{ minHeight: 44 }}
                            />
                            {googleLoading && (
                                <p className="text-center text-sm text-gray-500 animate-pulse">
                                    Memproses login Google...
                                </p>
                            )}

                            {/* Divider */}
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-3 text-gray-400 font-medium">atau</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Username/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-sisia-primary transition-colors">
                                    <User size={20} />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary transition-all bg-white"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-sisia-primary transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type="password"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-sisia-primary/20 focus:border-sisia-primary transition-all bg-white"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-sisia-primary text-white py-3.5 px-4 rounded-xl hover:bg-sisia-dark transition-all font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
                        >
                            Sign In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="text-center mt-6">
                            <p className="text-gray-600 text-sm">
                                Don't have an account?{' '}
                                <a href="/register" className="text-sisia-primary font-bold hover:underline">
                                    Create one
                                </a>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
