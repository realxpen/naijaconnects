import React, { useState, useEffect } from 'react';
import { 
  Zap, User as UserIcon, Mail, Lock, LogIn, UserPlus, Loader2, 
  Smartphone, Receipt, Globe, ShieldCheck, Sparkles, ChevronRight, 
  ArrowLeft, Eye, EyeOff 
} from 'lucide-react';
import { useI18n } from '../i18n';
import { LANGUAGES } from '../constants';
import { useToast } from '../components/ui/ToastProvider';

interface AuthProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignup: (email: string, firstName: string, lastName: string, phone: string, preferredLanguage: string, pass: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  isProcessing: boolean;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onSignup, onForgotPassword, isProcessing }) => {
  const { t, language } = useI18n();
  const { showToast } = useToast();
  const [view, setView] = useState<'login' | 'signup' | 'forgot-password'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>(language);
  const [activeSlide, setActiveSlide] = useState(0);
  
  // New state for password visibility
  const [showPassword, setShowPassword] = useState(false);

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
      if (view === 'login') {
        await onLogin(email, password);
      } else if (view === 'signup') {
        await onSignup(email, firstName, lastName, phone, preferredLanguage, password);
        showToast(t("auth.alert.account_created"), "success");
        setView('login');
        setPassword('');
      } else if (view === 'forgot-password') {
        await onForgotPassword(email);
        showToast(t("auth.alert.reset_link_sent"), "success");
        setView('login'); 
      }
    } catch (err: any) {
      showToast(err.message || t("auth.alert.generic_error"), "error");
    }
  };

  const getTitle = () => {
    if (view === 'login') return t("auth.title.login");
    if (view === 'signup') return t("auth.title.signup");
    return t("auth.title.reset");
  };

  const getButtonText = () => {
    if (isProcessing) return <Loader2 className="animate-spin" />;
    if (view === 'login') return t("auth.button.sign_in");
    if (view === 'signup') return t("auth.button.create_account");
    return t("auth.button.send_reset");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-slate-950 font-sans">
      
      {/* LEFT: DYNAMIC MARKETING CAROUSEL */}
      <div className="lg:w-1/2 bg-emerald-700 p-8 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden min-h-[40vh] lg:min-h-screen">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-400 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-30" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <div className="bg-yellow-400 p-2 rounded-xl shadow-lg">
              <Zap className="w-6 h-6 text-emerald-900 fill-emerald-900" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase">Swifna</h1>
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

        <div className="relative z-10 flex items-center gap-4 mt-8">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)} className={`h-1.5 rounded-full transition-all duration-500 ${i === activeSlide ? 'w-10 bg-yellow-400' : 'w-2 bg-emerald-900'}`} />
            ))}
          </div>
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest animate-pulse flex items-center gap-1">
            {t("auth.swipe_explore")} <ChevronRight size={12} />
          </span>
        </div>
      </div>

      {/* RIGHT: AUTH FORM SECTION */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md">
          
          <div className="mb-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Sparkles size={12} /> {t("auth.secure_access")}
            </div>
            <h2 className="text-3xl lg:text-4xl font-black dark:text-white tracking-tight">
              {getTitle()}
            </h2>
            {view === 'forgot-password' && (
                <p className="text-slate-400 text-sm mt-2">{t("auth.reset_hint")}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* FIRST NAME INPUT (Signup Only) */}
            {view === 'signup' && (
              <div className="relative animate-in slide-in-from-bottom-2">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" required placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
              </div>
            )}
            {/* LAST NAME INPUT (Signup Only) */}
            {view === 'signup' && (
              <div className="relative animate-in slide-in-from-bottom-2">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Last Name (optional)" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
              </div>
            )}

            {/* PHONE INPUT (Signup Only) */}
            {view === 'signup' && (
              <div className="relative animate-in slide-in-from-bottom-2">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="tel" required placeholder={t("auth.phone")} value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
              </div>
            )}

            {/* LANGUAGE INPUT (Signup Only) */}
            {view === 'signup' && (
              <div className="relative animate-in slide-in-from-bottom-2">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  required
                  value={preferredLanguage}
                  onChange={e => setPreferredLanguage(e.target.value)}
                  aria-label={t("auth.preferred_language")}
                  className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm appearance-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* EMAIL INPUT */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" required placeholder={t("auth.email")} value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" />
            </div>

            {/* PASSWORD INPUT (WITH TOGGLE) */}
            {view !== 'forgot-password' && (
                <div className="relative animate-in slide-in-from-bottom-2">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      placeholder={t("auth.password")} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full pl-12 pr-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm" 
                    />
                    {/* TOGGLE BUTTON */}
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            )}

            {/* FORGOT PASSWORD LINK */}
            {view === 'login' && (
                <div className="flex justify-end">
                    <button type="button" onClick={() => setView('forgot-password')} className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-wide">
                        {t("auth.forgot_password")}
                    </button>
                </div>
            )}

            <button type="submit" disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-200 dark:shadow-none uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all mt-6 text-sm">
              {getButtonText()}
            </button>
          </form>

          {/* BOTTOM NAVIGATION LINKS */}
          <div className="mt-8 text-center flex flex-col gap-4">
            {view === 'forgot-password' ? (
                <button onClick={() => setView('login')} className="text-emerald-600 font-black uppercase text-[10px] tracking-[0.15em] hover:underline flex items-center justify-center gap-2">
                    <ArrowLeft size={12}/> {t("auth.back_to_login")}
                </button>
            ) : (
                <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="text-emerald-600 font-black uppercase text-[10px] tracking-[0.15em] hover:underline">
                    {view === 'login' ? t("auth.switch_to_signup") : t("auth.switch_to_login")}
                </button>
            )}
            
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t("auth.bank_grade_security")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
