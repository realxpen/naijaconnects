import React, { useEffect, useRef, useState } from 'react';
import { 
  Languages as LangIcon, 
  Wifi, 
  History as HistoryIcon, 
  MessageCircle, 
  Bell,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { LANGUAGES } from '../constants';
import { useI18n, LanguageCode } from '../i18n';
import { supabase } from '../supabaseClient';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: 'buy' | 'history' | 'assistant' | 'profile';
  setActiveTab: (tab: 'buy' | 'history' | 'assistant' | 'profile') => void;
  userName: string;
}

interface Broadcast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_active?: boolean;
  end_time?: string | null;
  created_at?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, activeTab, setActiveTab, userName
}) => {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const { t, setLanguage } = useI18n();

  const getLangLabel = (id: string) => {
    switch (id) {
      case "en":
        return t("lang.english");
      case "yo":
        return t("lang.yoruba");
      case "ig":
        return t("lang.igbo");
      case "fr":
        return t("lang.french");
      case "ha":
        return t("lang.hausa");
      case "ng":
        return t("lang.pidgin");
      default:
        return id.toUpperCase();
    }
  };

  useEffect(() => {
    const fetchBroadcasts = async () => {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('is_active', true)
        .or(`end_time.is.null,end_time.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });
      if (data) setBroadcasts(data as Broadcast[]);
    };

    fetchBroadcasts();
    const channel = supabase
      .channel('broadcasts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, fetchBroadcasts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showNotifications]);

  const getTypeIcon = (type: Broadcast['type']) => {
    if (type === 'error') return <XCircle size={16} className="text-rose-500" />;
    if (type === 'warning') return <AlertTriangle size={16} className="text-amber-500" />;
    if (type === 'success') return <CheckCircle size={16} className="text-emerald-500" />;
    return <Info size={16} className="text-blue-500" />;
  };

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 dark:bg-slate-900 relative transition-colors">
      
      {/* HEADER */}
      <header className="bg-emerald-600 p-4 text-white flex justify-between items-center sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Swifna Logo"
            className="w-5 h-5"
          />
          <h1 className="text-xl font-black tracking-tight">Swifna</h1>
        </div>

        <div className="flex gap-4 items-center">
          {/* Notification Bell */}
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="p-2 bg-white/10 rounded-full relative hover:bg-white/20 transition-colors"
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
             <Bell size={20} />
             {broadcasts.length > 0 && (
               <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-emerald-600"></span>
             )}
          </button>
          {showNotifications && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => setShowNotifications(false)} />
              <div
                ref={notificationRef}
                className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-100 dark:border-slate-700 flex flex-col animate-in slide-in-from-right-5"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                      Announcements
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                      {broadcasts.length} total
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {broadcasts.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium py-6 text-center">
                      No announcements yet.
                    </p>
                  ) : (
                    broadcasts.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-start gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                      >
                        <div className="mt-0.5">{getTypeIcon(b.type)}</div>
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                            {b.type}
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                            {b.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Language Menu */}
          <div className="relative">
            <button onClick={() => setShowLangMenu(!showLangMenu)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
              <LangIcon size={20}/>
            </button>
            
            {showLangMenu && (
              <div className="absolute top-12 right-0 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-2xl z-50 overflow-hidden w-40 border border-slate-100 dark:border-slate-700">
                {LANGUAGES.map(l => (
                  <button key={l.id} onClick={() => {setLanguage(l.id as LanguageCode); setShowLangMenu(false)}} className="block w-full text-left p-3 text-xs font-black text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    {l.flag} {getLangLabel(l.id)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile (ME) */}
          <button 
            onClick={() => setActiveTab('profile')} 
            className="flex flex-col items-center gap-0.5 transition-opacity hover:opacity-90"
          >
            <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center font-black border-2 border-white/20 uppercase shadow-inner text-white text-sm">
              {userName.charAt(0)}
            </div>
            <span className="text-[8px] font-black uppercase text-emerald-100">{t("nav.me")}</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 pb-28">
        {children}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 w-full max-w-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t dark:border-slate-700 pb-safe pt-2 px-10 flex justify-between items-end shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-40 h-[80px]">
        
        {/* 1. Ask AI (Left) */}
        <NavButton 
            active={activeTab === 'assistant'} 
            onClick={() => setActiveTab('assistant')} 
            icon={<MessageCircle size={24} strokeWidth={2.5}/>} 
            label={t("nav.ask_ai")}
            badge={true} 
        />

        {/* 2. BIG BUY BUTTON (Middle) */}
        <div className="relative -top-6">
            <NavButton 
                active={activeTab === 'buy'} 
                onClick={() => setActiveTab('buy')} 
                icon={<Wifi size={28} strokeWidth={3} />} 
                label={t("nav.buy")}
                isMain={true} 
            />
        </div>

        {/* 3. History (Right) */}
        <NavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
            icon={<HistoryIcon size={24} strokeWidth={2.5}/>} 
            label={t("nav.history")}
        />

      </nav>
    </div>
  );
};

// --- NAV BUTTON COMPONENT ---
const NavButton = ({ active, onClick, icon, label, badge, isMain }: any) => {
  
  // RENDER BIG FLOATING BUTTON
  if (isMain) {
    return (
      <button 
        onClick={onClick} 
        className={`
          flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-transform active:scale-95
          border-[6px] border-slate-50 dark:border-slate-900
          ${active 
            ? 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-emerald-900/20' 
            : 'bg-slate-800 text-slate-400'
          }
        `}
      >
        {icon}
      </button>
    );
  }

  // RENDER STANDARD NAV BUTTON
  return (
    <button 
      onClick={onClick} 
      className={`relative flex flex-col items-center gap-1.5 pb-3 transition-all ${
        active 
          ? 'text-emerald-600 scale-105' 
          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
      }`}
    >
      <div className="relative">
        {icon}
        {badge && !active && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
        )}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
};

export default DashboardLayout;
