import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { dbService } from './services/dbService';
import { I18nProvider, LanguageCode } from './i18n';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { SuccessScreenProvider } from './components/ui/SuccessScreenProvider';
// 1. Import the BroadcastManager
import BroadcastManager from './components/BroadcastManager';
import { CONSTELLATIONS } from './data/constellations';

// Layouts & Pages
import DashboardLayout from "./layouts/DashboardLayout"; 
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
// Placeholders for now - ensure these files exist or comment them out
import History from './pages/History'; 
import Profile from './pages/Profile';
import Assistant from './pages/Assistant';

const App: React.FC = () => {
  const [isSplashScreen, setIsSplashScreen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'history' | 'assistant' | 'profile'>('buy');
  
  // Navigation Reset Key (To force Dashboard reload when clicking "Buy")
  const [dashboardResetKey, setDashboardResetKey] = useState(0);

  // UPDATED: Added 'id' to the user interface definition to fix "Property 'id' is missing"
  const [user, setUser] = useState<{id: string, name: string, email: string, balance: number, phone?: string, role?: string, pinHash?: string | null, pinLength?: number | null} | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem("language");
    return (stored as LanguageCode) || "en";
  });
  const [isNightSky, setIsNightSky] = useState(false);
  const [moonPhase, setMoonPhase] = useState<{ phase: string; illumination: number } | null>(null);
  const [moonImageUrl, setMoonImageUrl] = useState<string | null>(null);
  const [constellation, setConstellation] = useState<string | null>(null);
  const [showLearn, setShowLearn] = useState(false);
  const learnHoldRef = useRef(false);
  const [splashDelayDone, setSplashDelayDone] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);

  const isNightWindow = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const afterStart = h > 19 || (h === 19 && m >= 0);
    const beforeEnd = h < 5 || (h === 5 && m < 30);
    return afterStart || beforeEnd;
  };

  const getNightKey = (d: Date) => {
    if (!isNightWindow(d)) return null;
    const nightDate = new Date(d);
    if (d.getHours() < 5 || (d.getHours() === 5 && d.getMinutes() < 30)) {
      nightDate.setDate(d.getDate() - 1);
    }
    return nightDate.toISOString().slice(0, 10);
  };

  const pickConstellationForNight = (nightKey: string) => {
    const storedKey = localStorage.getItem('night_constellation_date');
    const storedName = localStorage.getItem('night_constellation_name');
    if (storedKey === nightKey && storedName) return storedName;

    let hash = 0;
    for (let i = 0; i < nightKey.length; i += 1) {
      hash = (hash * 31 + nightKey.charCodeAt(i)) >>> 0;
    }
    const idx = hash % CONSTELLATIONS.length;
    const name = CONSTELLATIONS[idx];
    localStorage.setItem('night_constellation_date', nightKey);
    localStorage.setItem('night_constellation_name', name);
    return name;
  };

  const constellationStars = useMemo(() => {
    if (!constellation) return [];
    let seed = 0;
    for (let i = 0; i < constellation.length; i += 1) seed = (seed * 31 + constellation.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xfffffff) / 0xfffffff;
    };
    const count = 8 + (seed % 6);
    return Array.from({ length: count }, () => ({
      x: Math.round(10 + rand() * 200),
      y: Math.round(10 + rand() * 120),
      r: Math.round(1 + rand() * 2),
    }));
  }, [constellation]);

  const getLocalMoonPhase = (date: Date) => {
    const synodicMonth = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const daysSince = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - knownNewMoon) / 86400000;
    const phase = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
    const phaseFrac = phase / synodicMonth;
    const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phaseFrac)) / 2) * 100);

    let name = "New Moon";
    if (phaseFrac >= 0.03 && phaseFrac < 0.22) name = "Waxing Crescent";
    else if (phaseFrac < 0.28) name = "First Quarter";
    else if (phaseFrac < 0.47) name = "Waxing Gibbous";
    else if (phaseFrac < 0.53) name = "Full Moon";
    else if (phaseFrac < 0.72) name = "Waning Gibbous";
    else if (phaseFrac < 0.78) name = "Last Quarter";
    else if (phaseFrac < 0.97) name = "Waning Crescent";

    return { phase: name, illumination };
  };

  // --- 1. FETCH USER PROFILE ---
  const fetchUser = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        // We use '*' to ensure we get full_name, wallet_balance, AND the new role column
        .select('*') 
        .eq('email', email)
        .single();

      if (error) console.error('Error fetching profile:', error);
      
      if (data) {
        setUser({
          id: data.id, // <--- ADDED: Map the ID from the DB result
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.name || '',
          email: data.email || email,
          balance: data.wallet_balance || 0,
          phone: data.phone || '',
          role: data.role || 'user',
          pinHash: data.pin_hash || null,
          pinLength: data.pin_length || null
        });
        if (data.preferred_language) {
          setLanguage(data.preferred_language as LanguageCode);
        }
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  // --- 2. SESSION INITIALIZATION ---
  useEffect(() => {
    // Theme check (supports light/dark/system)
    const storedTheme = localStorage.getItem('theme');
    const applyTheme = () => {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldUseDark = storedTheme === 'dark' || (storedTheme !== 'light' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldUseDark);
    };

    applyTheme();

    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const handleChange = () => {
      if (localStorage.getItem('theme') === 'system') {
        applyTheme();
      }
    };

    if (media?.addEventListener) media.addEventListener('change', handleChange);
    else if (media?.addListener) media.addListener(handleChange);

    let cancelled = false;

    const loadNightSky = async () => {
      const now = new Date();
      const nightKey = getNightKey(now);
      if (!nightKey) {
        setIsNightSky(false);
        setShowLearn(false);
        learnHoldRef.current = false;
        return;
      }
      setIsNightSky(true);
      setConstellation(pickConstellationForNight(nightKey));
      setMoonPhase(getLocalMoonPhase(now));

      try {
        const { data, error } = await supabase.functions.invoke("moon-phase", {
          body: { location: "Lagos" }
        });
        if (error) throw error;
        if (!cancelled && data?.imageUrl) {
          setMoonImageUrl(data.imageUrl);
        }
      } catch {
        if (!cancelled) setMoonImageUrl(null);
      }
    };

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session && session.user.email) {
        await fetchUser(session.user.email);
      }
    };

    const run = async () => {
      const nightKey = getNightKey(new Date());
      const isNight = !!nightKey;
      const start = Date.now();
      await Promise.all([initSession(), loadNightSky()]);
      const minDelay = isNight ? 5000 : 0;
      const elapsed = Date.now() - start;
      if (minDelay > elapsed) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed));
      }
      if (!cancelled) {
        setSplashDelayDone(true);
        if (!learnHoldRef.current || !isNight) setIsSplashScreen(false);
      }
    };

    run();

    // Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user.email) {
        await fetchUser(session.user.email);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (media?.removeEventListener) media.removeEventListener('change', handleChange);
      else if (media?.removeListener) media.removeListener(handleChange);
    };
  }, []);

  // --- 3. NAVIGATION HANDLER (Fixes the "Buy" button issue) ---
  const handleTabChange = (tab: 'buy' | 'history' | 'assistant' | 'profile') => {
    // If user clicks "Buy" while already on "Buy" tab, reset the dashboard
    if (tab === 'buy' && activeTab === 'buy') {
      setDashboardResetKey(prev => prev + 1);
    }
    setActiveTab(tab);
  };

  // --- 4. AUTH ACTIONS ---
  const { showToast } = useToast();

  const handleLogin = async (email: string, pass: string) => {
    setIsProcessing(true);
    try {
      await dbService.loginUser(email, pass);
    } catch (e: any) { 
      showToast(e.message || "Login Failed", "error");
    } finally { 
      setIsProcessing(false); 
    }
  };

  // UPDATED: Changed preferredLanguage type from LanguageCode to string
  const handleSignup = async (email: string, firstName: string, lastName: string, phone: string, preferredLanguage: string, pass: string) => {
    setIsProcessing(true);
    try {
      await dbService.registerUser(email, firstName, lastName, phone, preferredLanguage as LanguageCode, pass);
      setLanguage(preferredLanguage as LanguageCode);
    } catch (e: any) { 
      showToast(e.message || "Signup Failed", "error");
      throw e; 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      await dbService.resetPasswordEmail(email);
    } catch (e: any) {
      console.error(e);
      throw e; 
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      setActiveTab('buy');
    }
  };

  const handleUpdateUser = async (updatedData: any) => {
    setUser((prevUser: any) => ({ ...prevUser, ...updatedData }));
  };

  const onUpdateBalance = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  // Persist language
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  // --- RENDER ---

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
      
      {/* 2. Added BroadcastManager here so it overlays everything */}
      <BroadcastManager />

      {isSplashScreen ? (
        <div className={`min-h-screen flex flex-col items-center justify-center text-white relative overflow-hidden ${isNightSky ? '' : 'bg-emerald-600'}`}>
          {isNightSky ? (
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_10%_-10%,_#0F1A13_0%,_transparent_60%),radial-gradient(60%_45%_at_110%_20%,_#122017_0%,_transparent_60%)]" />
              <div className="absolute inset-0 opacity-40">
                <svg width="100%" height="100%" viewBox="0 0 240 160" preserveAspectRatio="none">
                  {constellationStars.map((s, i) => (
                    <circle
                      key={`${s.x}-${s.y}-${i}`}
                      cx={s.x}
                      cy={s.y}
                      r={s.r}
                      fill="#F5C400"
                      opacity="0.9"
                      className="star-glow"
                      style={{ animationDelay: `${(i % 6) * 0.4}s` }}
                    />
                  ))}
                  {constellationStars.map((s, i) => {
                    const n = constellationStars[i + 1];
                    if (!n) return null;
                    return (
                      <line
                        key={`l-${i}`}
                        x1={s.x}
                        y1={s.y}
                        x2={n.x}
                        y2={n.y}
                        stroke="#6B7280"
                        strokeWidth="0.6"
                        opacity="0.6"
                        className="star-line"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : null}

          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <img
              src="/logo.png"
              alt="Swifna Logo"
              className="w-20 h-20 mb-4"
            />
            <h1 className="text-4xl font-black tracking-tighter">Swifna</h1>
            <p className="mt-2 text-sm italic font-semibold text-emerald-100 dark:text-[#A1A1AA] tracking-wide">
              Airtime, Data, Bills — Sorted.
            </p>

            {isNightSky && (
              <div className="mt-6 w-full max-w-sm rounded-2xl bg-[#151A21] border border-[rgba(255,255,255,0.06)] p-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#A1A1AA]">Tonight’s Sky</p>
                    <p className="text-sm font-semibold text-white mt-1">{constellation || 'Constellation'}</p>
                    {moonPhase && (
                      <p className="text-[10px] text-[#6B7280] mt-1">{moonPhase.phase} · {Math.round(moonPhase.illumination)}% lit</p>
                    )}
                  </div>
                  <div className="w-16 h-16">
                    {moonImageUrl ? (
                      <img src={moonImageUrl} alt="Moon phase" className="w-16 h-16 rounded-full object-cover border border-[#6B7280]" />
                    ) : (
                      <div className="w-16 h-16 rounded-full border border-[#6B7280] flex items-center justify-center text-[10px] text-[#6B7280]">
                        Moon
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const next = !showLearn;
                    setShowLearn(next);
                    learnHoldRef.current = next;
                    if (!next && splashDelayDone) {
                      setIsSplashScreen(false);
                    }
                  }}
                  className="mt-4 h-12 w-full rounded-[14px] bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-sm font-semibold"
                >
                  Learn this constellation
                </button>

                {showLearn && (
                  <div className="mt-3 text-xs text-[#A1A1AA] leading-relaxed">
                    {constellation ? `${constellation} is one of the 88 official constellations recognized by the IAU.` : 'This constellation is one of the 88 official IAU constellations.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : !isAuthenticated ? (
        <Auth 
          onLogin={handleLogin} 
          onSignup={handleSignup} 
          onForgotPassword={handleForgotPassword} 
          isProcessing={isProcessing} 
        />
      ) : (
        <DashboardLayout 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} // Use the smart handler here
          userName={user?.name || ''} 
          userAvatar={(user as any)?.avatar_url || null}
        >
          {showPinSetup && user && !user.pinHash && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-[#151A21] border border-[rgba(255,255,255,0.06)] p-5">
                <h3 className="text-sm font-bold text-white mb-2">Set Your PIN</h3>
                <p className="text-xs text-[#A1A1AA] mb-4">
                  Create a 4 or 6 digit PIN to secure withdrawals and bill payments.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowPinSetup(false);
                      setActiveTab('profile');
                    }}
                    className="flex-1 h-12 rounded-[14px] bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-sm font-semibold"
                  >
                    Set PIN now
                  </button>
                  <button
                    onClick={() => setShowPinSetup(false)}
                    className="flex-1 h-12 rounded-[14px] border border-[rgba(255,255,255,0.06)] text-[#A1A1AA] text-sm font-semibold"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'buy' && user && (
            <Dashboard 
                key={dashboardResetKey} // This forces the reset
                user={user} 
                onUpdateBalance={onUpdateBalance} 
            />
          )}
          
          {activeTab === 'history' && <History />}
          
          {activeTab === 'assistant' && user && (
            <Assistant user={user} />
          )}
          
          {activeTab === 'profile' && user && (
            <Profile 
              user={user} 
              onLogout={handleLogout} 
              onUpdateUser={handleUpdateUser} 
            />
          )}
        </DashboardLayout>
      )}
    </I18nProvider>
  );
};

const AppWithProviders: React.FC = () => (
  <ToastProvider>
    <SuccessScreenProvider>
      <App />
    </SuccessScreenProvider>
  </ToastProvider>
);

export default AppWithProviders;
