import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, MessageSquare, Calendar, Zap, Send, Database, Shield, LogOut, BookOpen, ChevronLeft, ChevronRight, Coins, Image as ImageIcon, ScrollText, Megaphone, Wrench, Key, Gamepad2, FileText, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const links = [
        { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/app/sessions', label: 'Devices', icon: Smartphone },
        { path: '/app/contacts', label: 'Contacts', icon: Users },
        { path: '/app/history', label: 'Messages', icon: MessageSquare },
        { path: '/app/rules', label: 'Auto Reply', icon: Zap },
        { path: '/app/ai-tools', label: 'AI Actions', icon: Wrench },
        { path: '/app/credentials', label: 'Credentials', icon: Key },
        { path: '/app/telegram-bots', label: 'Telegram Bots', icon: Bot },
        { path: '/app/scheduler', label: 'Scheduler', icon: Calendar },
        { path: '/app/broadcast', label: 'Broadcast', icon: Megaphone },
        { path: '/app/groups', label: 'Groups', icon: Database },
        { path: '/app/gallery', label: 'Gallery', icon: ImageIcon },
        { path: '/app/games', label: 'Game Builder', icon: Gamepad2 },
        { path: '/app/notes', label: 'Notes', icon: FileText },
        { path: '/app/profile', label: 'My Profile', icon: Users },
        { path: '/app/send', label: 'Send Test', icon: Send },
        { path: '/app/docs', label: 'Documentation', icon: BookOpen },
    ];

    if (user?.role === 'ADMIN') {
        links.push({ path: '/app/logs', label: 'Logs', icon: ScrollText });
        links.push({ path: '/app/users', label: 'User Management', icon: Shield });
    }

    return (
        <div className={`
            fixed md:static inset-y-0 left-0 z-50
            h-screen bg-sisia-dark border-r border-gray-800 text-gray-300 p-4 flex flex-col transition-all duration-300
            ${isCollapsed ? 'w-20' : 'w-64'}
            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            shadow-xl md:shadow-none
        `}>
            <div className="flex justify-center mb-8 px-2 relative">
                <div className={`flex-shrink-0 flex items-center gap-2 transition-all duration-300 ${isCollapsed ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
                    <span className="font-bold text-2xl tracking-tight text-white">SISIA</span>
                </div>               {isCollapsed && <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-xl">SS</div>}

                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-6 bg-sisia-primary border border-sisia-secondary p-1.5 rounded-full shadow-md hover:bg-sisia-light text-white hidden md:flex z-50 items-center justify-center transition-all"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.path;
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={onClose} // Close sidebar on mobile when link clicked
                            title={isCollapsed ? link.label : ''}
                            className={`flex items-center p-3 rounded-xl transition-all duration-200 font-medium ${isActive
                                ? 'bg-white text-sisia-dark shadow-lg transform scale-[1.02]'
                                : 'hover:bg-white/10 text-gray-400 hover:text-white'
                                } ${isCollapsed ? 'justify-center' : 'space-x-3'}`}
                        >
                            <Icon size={20} className={isActive ? 'text-sisia-dark' : 'text-gray-400 group-hover:text-white'} />
                            {!isCollapsed && <span>{link.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="pt-4 border-t border-gray-800 bg-sisia-dark mt-auto">
                <div className={`flex items-center gap-3 mb-3 px-2 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 min-w-[2rem] rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden w-full">
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Logged in as</div>
                            <div className="text-sm font-semibold text-white truncate">{user?.username}</div>

                            <div className="flex flex-col gap-1 mt-2">
                                {user?.planType !== 'TIME_BASED' && user?.planType !== 'UNLIMITED' && (
                                    <div className="flex items-center justify-between text-xs font-medium bg-amber-500/10 text-amber-500 px-2 py-1 rounded select-none group relative">
                                        <div className="flex items-center gap-1.5">
                                            <Coins size={12} />
                                            <span>{user?.credits || 0} Credits</span>
                                        </div>
                                        {user?.planType !== 'UNLIMITED' && (
                                            <a
                                                href={`https://wa.me/${import.meta.env.VITE_ADMIN_PHONE}?text=Hello, I would like to buy more credits for my account: ${user?.username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-amber-500 text-black px-1.5 rounded hover:bg-amber-400 transition-colors cursor-pointer"
                                                title="Buy Credits"
                                            >
                                                +
                                            </a>
                                        )}
                                    </div>
                                )}
                                {user?.planType === 'UNLIMITED' && (
                                    <div className="flex items-center justify-center text-xs font-bold bg-sisia-primary/20 text-sisia-primary px-2 py-1 rounded select-none">
                                        <Zap size={12} className="mr-1" />
                                        <span>Unlimited Plan</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between text-xs font-medium bg-blue-500/10 text-blue-400 px-2 py-1 rounded select-none group relative">
                                    <div className="flex items-center gap-1.5">
                                        {(user?.planType === 'TIME_BASED' && user?.planExpiresAt) ? <Calendar size={12} /> : <Zap size={12} />}
                                        <span className="truncate max-w-[80px]">
                                            {user?.planType === 'TIME_BASED'
                                                ? (user?.planExpiresAt ? `Exp: ${new Date(user.planExpiresAt).toLocaleDateString()}` : 'Pending')
                                                : (user?.planType === 'UNLIMITED' ? 'Active' : 'Pay As You Go')}
                                        </span>
                                    </div>
                                    {user?.planType !== 'UNLIMITED' && (
                                        <a
                                            href={`https://wa.me/${import.meta.env.VITE_ADMIN_PHONE}?text=Hello, I would like to change my plan schema for account: ${user?.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded hover:bg-blue-400 transition-colors uppercase tracking-wider cursor-pointer"
                                        >
                                            {user?.planType === 'TIME_BASED' ? 'Renew' : 'Change'}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <button
                    onClick={logout}
                    title={isCollapsed ? "Logout" : ""}
                    className={`w-full flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-sm font-medium ${isCollapsed ? '' : 'space-x-2'}`}
                >
                    <LogOut size={16} />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
