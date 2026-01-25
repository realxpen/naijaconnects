import React, { useState } from 'react';
import { Zap, Languages as LangIcon, Wifi, History as HistoryIcon, MessageCircle, User as UserIcon } from 'lucide-react';
import { LANGUAGES } from '../constants';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: 'buy' | 'history' | 'assistant' | 'profile';
  setActiveTab: (tab: 'buy' | 'history' | 'assistant' | 'profile') => void;
  userName: string;
  language: string;
  setLanguage: (lang: any) => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, activeTab, setActiveTab, userName, language, setLanguage 
}) => {
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 dark:bg-slate-900 relative transition-colors">
      {/* HEADER */}
      <header className="bg-emerald-600 p-4 text-white flex justify-between items-center sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <Zap className="fill-yellow-400 text-yellow-400" size={20}/>
          <h1 className="text-xl font-black tracking-tight">NaijaConnect</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowLangMenu(!showLangMenu)} className="p-2 bg-white/10 rounded-full">
            <LangIcon size={20}/>
          </button>
          
          {showLangMenu && (
            <div className="absolute top-14 right-4 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-2xl z-50 overflow-hidden">
              {LANGUAGES.map(l => (
                <button key={l.id} onClick={() => {setLanguage(l.id); setShowLangMenu(false)}} className="block w-full text-left p-3 text-xs font-black dark:text-white border-b last:border-0">
                  {l.flag} {l.name}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setActiveTab('profile')} className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-black border-2 border-white/20 uppercase shadow-inner">
            {userName.charAt(0)}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {children}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 w-full max-w-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-t dark:border-slate-700 p-5 flex justify-around shadow-2xl z-40">
        <NavButton active={activeTab === 'buy'} onClick={() => setActiveTab('buy')} icon={<Wifi size={24} strokeWidth={3}/>} label="Buy" />
        <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={24} strokeWidth={3}/>} label="History" />
        <NavButton active={activeTab === 'assistant'} onClick={() => setActiveTab('assistant')} icon={<MessageCircle size={24} strokeWidth={3}/>} label="Ask AI" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon size={24} strokeWidth={3}/>} label="Me" />
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default DashboardLayout;