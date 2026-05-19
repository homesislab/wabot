/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';
import { Loader } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(!!localStorage.getItem('token'));

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.get('/auth/me')
                .then(res => setUser(res.data))
                .catch(() => {
                    localStorage.removeItem('token');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        }
    }, []);

    const login = async (username, password) => {
        const res = await api.post('/auth/login', { username, password });
        const { token, role, username: dbUsername } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('role', role);
        localStorage.setItem('username', dbUsername);

        setUser(res.data);
        return res.data;
    };

    // Untuk Google OAuth — token sudah ada dari response
    const loginWithToken = (data) => {
        const { token, role, username } = data;
        localStorage.setItem('token', token);
        localStorage.setItem('role', role);
        localStorage.setItem('username', username);
        setUser(data);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        // Sign out dari Google jika ada
        if (window.google?.accounts?.id) {
            window.google.accounts.id.disableAutoSelect();
        }
        setUser(null);
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center"><Loader className="animate-spin text-sisia-primary" size={48} /></div>;
    }

    return (
        <AuthContext.Provider value={{ user, setUser, login, loginWithToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
