import React, { useState, useEffect } from 'react';
import { Zap, User as UserIcon, Mail, Lock, LogIn, UserPlus, Loader2, Smartphone, Receipt, Globe, ShieldCheck, Sparkles, ChevronRight } from 'lucide-react';
import { dbService } from '../services/dbService';

interface AuthProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignup: (email: string, name: string, pass: string) => Promise<void>;
  isProcessing: boolean;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onSignup, isProcessing }) => {
  const [view, setView] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      title: "Everything You Pay For. One Smart App.",
      desc: "Buy cheap data, airtime, pay bills, and make online payments — all from one secure wallet.",
      icon: <Zap className="w-12 h-12 text-yellow-400 fill-yellow-400" />,
      tag: "Fast • Reliable • Naija-Built"
    },
    {
      title: "Cheap Data & Airtime That Just Works",
      desc: "Top up MTN, Airtel, Glo & 9mobile instantly. No delays. No hidden charges.",
      icon: <Smartphone className="w-12 h-12 text-emerald-400" />,
      tag: "Best VTU Rates"
    },
    {
      title: "Pay Bills in Seconds",
      desc: "Electricity, DSTV, GOTV & Startimes — handle your home needs without leaving your couch.",
      icon: <Receipt className="w-12 h-12 text-blue-400" />,
      tag: "24/7 Availability"
    },
    {
      title: "Pay Online Without Stress",
      desc: "Get virtual dollar cards for Netflix, Spotify, AWS, and international shopping.",
      icon: <Globe className="w-12 h-12 text-purple-400" />,
      tag: "USD Virtual Cards"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      view === 'login' ? await onLogin(email, password) : await onSignup(email, name, password);
    } catch (err: any) {
      alert(err.message || "Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-slate-950 font-sans">
      
      {/* LEFT: DYNAMIC MARKETING CAROUSEL */}
      <div className="lg:w-1/2 bg-emerald-700 p-8 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden min-h-[40vh] lg:min-h-screen">
        {/* Visual Decor */}
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-400 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-30" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <div className="bg-yellow-400 p-2 rounded-xl shadow-lg">
              <Zap className="w-6 h-6 text-emerald-900 fill-emerald-900" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase">NaijaConnect</h1>
          </div>

          <div className="relative h-64 lg:h-80">
            {slides.map((slide, i) => (
              <div key={i} className={`absolute inset-0 transition-all duration-700 ease-in-out transform ${i === activeSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="flex items-center gap-2 mb-4">
                   <span className="px-3 py-1 rounded-full bg-emerald-800 text-yellow-400 text-[10px] font-black tracking-widest uppercase border border-emerald-600">
                    {slide.tag}
                  </span>
                </div>
                <div className="mb-6">{slide.icon}</div>
                <h2 className="text-3xl lg:text-5xl font-black mb-4 leading-[1.1] tracking-tight">{slide.title}</h2>
                <p className="text-emerald-50 text-base lg:text-lg max-w-md font-medium opacity-80 leading-relaxed">{slide.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Swipe Indicators */}
        <div className="relative z-10 flex items-center gap-4 mt-8">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)} className={`h-1.5 rounded-full transition-all duration-500 ${i === activeSlide ? 'w-10 bg-yellow-400' : 'w-2 bg-emerald-900'}`} />
            ))}
          </div>
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest animate-pulse flex items-center gap-1">
            Swipe to explore <ChevronRight size={12} />
          </span>
        </div>
      </div>

      {/* RIGHT: AUTH FORM SECTION */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Sparkles size={12} /> Secure Access
            </div>
            <h2 className="text-3xl lg:text-4xl font-black dark:text-white tracking-tight">
              {view === 'login' ? 'Welcome Back' : 'Join the Family'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" required placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" required placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
            </div>

            <button type="submit" disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-200 dark:shadow-none uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all mt-6 text-sm">
              {isProcessing ? <Loader2 className="animate-spin" /> : (view === 'login' ? 'Sign In' : 'Create Free Account')}
            </button>
          </form>

          <div className="mt-8 text-center flex flex-col gap-4">
            <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="text-emerald-600 font-black uppercase text-[10px] tracking-[0.15em] hover:underline">
              {view === 'login' ? "New here? Open an account" : "Already have an account? Log in"}
            </button>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Bank-Grade Security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;