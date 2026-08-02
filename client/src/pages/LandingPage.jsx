import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Zap, Shield, Smartphone, Globe, ArrowRight, Settings, Calendar, Menu, X } from 'lucide-react';

const LandingPage = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-bone-white font-sans text-sisia-dark">
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="font-bold text-2xl tracking-tight text-sisia-primary">SISIA</span>
                        </div>
                        <div className="md:hidden">
                            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600 hover:text-sisia-primary p-2">
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>

                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#features" className="text-gray-600 hover:text-sisia-primary transition-colors font-medium">Features</a>
                            <a href="#pricing" className="text-gray-600 hover:text-sisia-primary transition-colors font-medium">Pricing</a>
                            <a href="#contact" className="text-gray-600 hover:text-sisia-primary transition-colors font-medium">Contact</a>
                            <div className="flex items-center gap-3">
                                <Link to="/login" className="px-5 py-2.5 rounded-full border border-sisia-primary text-sisia-primary font-medium hover:bg-sisia-light/50 transition-all">
                                    Login
                                </Link>
                                <Link to="/register" className="px-5 py-2.5 rounded-full bg-sisia-primary text-white font-medium hover:bg-sisia-dark transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                    Register
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 absolute top-20 left-0 w-full shadow-lg py-4 px-4 flex flex-col gap-4 animate-in slide-in-from-top-5">
                        <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-sisia-primary font-medium p-2">Features</a>
                        <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-sisia-primary font-medium p-2">Pricing</a>
                        <a href="#contact" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-600 hover:text-sisia-primary font-medium p-2">Contact</a>
                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="px-5 py-3 text-center rounded-xl border border-sisia-primary text-sisia-primary font-medium hover:bg-sisia-light/50">
                            Login
                        </Link>
                        <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="px-5 py-3 text-center rounded-xl bg-sisia-primary text-white font-medium hover:bg-sisia-dark shadow-md">
                            Register
                        </Link>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sisia-light/50 text-sisia-primary font-medium text-sm mb-8 border border-sisia-accent/30">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sisia-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-sisia-primary"></span>
                            </span>
                            Now with ChatGPT-4o Integration
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-gray-900 leading-tight">
                            Smart Automation for <span className="text-transparent bg-clip-text bg-gradient-to-r from-sisia-primary to-sisia-secondary">WhatsApp</span>
                        </h1>
                        <p className="mt-6 text-xl text-gray-600 leading-relaxed mb-10">
                            Sisia empowers your business with intelligent auto-replies, bulk messaging, and seamless API integration. Connect with customers like never before.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/register" className="px-8 py-4 rounded-full bg-sisia-primary text-white font-bold text-lg hover:bg-sisia-dark transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2">
                                Get Started Free <ArrowRight size={20} />
                            </Link>
                            <Link to="/login" className="px-8 py-4 rounded-full bg-white text-sisia-dark border border-gray-200 font-bold text-lg hover:border-sisia-primary hover:text-sisia-primary transition-all shadow flex items-center justify-center gap-2">
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Abstract Background Shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-sisia-accent/20 rounded-full blur-3xl"></div>
                    <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-100 rounded-full blur-3xl"></div>
                </div>
            </div>

            {/* Features Section */}
            <div id="features" className="py-24 bg-white relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-base font-semibold text-sisia-primary tracking-wide uppercase">Capabilites</h2>
                        <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">Everything you need to scale</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: MessageSquare, title: 'Smart Auto-Replies', desc: 'Set up keyword-based or AI-powered responses to handle customer queries 24/7.' },
                            { icon: Globe, title: 'Webhook API', desc: 'Integrate with your existing stack. Trigger messages from your own applications via comprehensive API.' },
                            { icon: Zap, title: 'Blast Messaging', desc: 'Send targeted broadcasts to specific tags or groups with variable delays to ensure delivery.' },
                            { icon: Smartphone, title: 'Multi-Device', desc: 'Connect multiple WhatsApp numbers and manage them all from a single dashboard.' },
                            { icon: Shield, title: 'Role Management', desc: 'Granular access control for your team. Manage quotas, credits, and permissions.' },
                            { icon: Settings, title: 'Scheduler', desc: 'Plan your campaigns in advance. Schedule recurrent messages or one-time announcements.' } // Using Settings for Scheduler temporarily if Calendar imported, or just Settings
                        ].map((feature, idx) => (
                            <div key={idx} className="p-8 rounded-2xl bg-bone-white border border-gray-100 hover:border-sisia-accent/50 transition-all hover:shadow-lg group">
                                <div className="w-12 h-12 rounded-xl bg-sisia-light text-sisia-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <feature.icon size={24} />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Pricing Section */}
            <div id="pricing" className="py-24 bg-bone-white relative border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-base font-semibold text-sisia-primary tracking-wide uppercase">PricingPlans</h2>
                        <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">Choose the right plan for your business</p>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className="rounded-3xl p-12 bg-white border border-gray-100 shadow-xl relative overflow-hidden text-center group">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sisia-primary to-sisia-secondary"></div>
                            <h3 className="text-3xl font-bold text-gray-900 mb-6">Simple, Transparent Pricing</h3>
                            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
                                No complex tiers or hidden fees. Choose a plan based on your usage time or pay as you go.
                            </p>

                            <div className="flex flex-col md:flex-row justify-center items-center gap-12 mb-12">
                                <div className="text-center">
                                    <div className="text-5xl font-bold text-sisia-primary mb-2">Time Based</div>
                                    <p className="text-gray-500">Subscribe for specific duration</p>
                                </div>
                                <div className="hidden md:block w-px h-24 bg-gray-200"></div>
                                <div className="md:hidden w-24 h-px bg-gray-200"></div>
                                <div className="text-center">
                                    <div className="text-5xl font-bold text-sisia-primary mb-2">Pay As You Go</div>
                                    <p className="text-gray-500">Top up credits as needed</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-2xl mx-auto mb-12">
                                <div className="flex items-center gap-3"><span className="text-green-500 text-xl">✓</span> <span className="text-lg">Unlimited WhatsApp Numbers</span></div>
                                <div className="flex items-center gap-3"><span className="text-green-500 text-xl">✓</span> <span className="text-lg">Full Webhook & API Access</span></div>
                                <div className="flex items-center gap-3"><span className="text-green-500 text-xl">✓</span> <span className="text-lg">Advanced AI Chatbot</span></div>
                                <div className="flex items-center gap-3"><span className="text-green-500 text-xl">✓</span> <span className="text-lg">Priority 24/7 Support</span></div>
                            </div>

                            <a href="#contact" className="inline-block px-12 py-5 rounded-full bg-sisia-primary text-white font-bold text-xl hover:bg-sisia-dark transition-all shadow-lg hover:shadow-2xl hover:-translate-y-1">
                                Contact Sales for Rates
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contact Section */}
            <div id="contact" className="py-24 bg-sisia-light/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-8">Need Help? Contact Admin</h2>
                    <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                        Have questions about plans or need custom integration? Our team is ready to assist you.
                    </p>
                    <div className="flex flex-col md:flex-row gap-6 justify-center">
                        <a href={`https://wa.me/${import.meta.env.VITE_ADMIN_PHONE || '6283819278102'}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 px-8 py-4 bg-[#25D366] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                            <Smartphone size={24} />
                            Chat via WhatsApp
                        </a>
                        <a href={`mailto:${import.meta.env.VITE_ADMIN_EMAIL || 'anggy.all@gmail.com'}`} className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-gray-800 border border-gray-200 rounded-xl font-bold shadow hover:shadow-md transition-all">
                            <MessageSquare size={24} />
                            Email Support
                        </a>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-sisia-dark text-white py-12 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="font-bold text-xl">Sisia</span>
                        </div>
                        <p className="text-gray-400 max-w-xs">
                            The advanced WhatsApp automation platform for forward-thinking businesses.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 text-gray-200">Product</h4>
                        <ul className="space-y-2 text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">API Docs</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 text-gray-200">Legal</h4>
                        <ul className="space-y-2 text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
                    © {new Date().getFullYear()} Sisia Platform. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
