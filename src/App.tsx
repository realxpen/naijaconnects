import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from './supabaseClient';
import { dbService } from './services/dbService';
import { I18nProvider, LanguageCode } from './i18n';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
// 1. Import the BroadcastManager
import BroadcastManager from './components/BroadcastManager';

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

  // UPDATED: Added 'role' to the user interface definition
  const [user, setUser] = useState<{name: string, email: string, balance: number, phone?: string, role?: string} | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem("language");
    return (stored as LanguageCode) || "en";
  });

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
          name: data.full_name || '',
          email: data.email || email,
          balance: data.wallet_balance || 0,
          phone: data.phone || '',
          role: data.role || 'user' // UPDATED: Map the role from DB
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
    // Theme check
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session && session.user.email) {
        await fetchUser(session.user.email);
      }
      
      setIsSplashScreen(false);
    };

    initSession();

    // Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user.email) {
        await fetchUser(session.user.email);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
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

  const handleSignup = async (email: string, name: string, phone: string, preferredLanguage: LanguageCode, pass: string) => {
    setIsProcessing(true);
    try {
      await dbService.registerUser(email, name, phone, preferredLanguage, pass);
      setUser({ name: '', email: '', balance: 0, phone, role: 'user' }); 
      setLanguage(preferredLanguage);
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-600 text-white">
          <Zap className="w-24 h-24 animate-bounce text-yellow-400 fill-yellow-400"/>
          <h1 className="text-4xl font-black mt-8 tracking-tighter">NaijaConnect</h1>
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
        >
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
    <App />
  </ToastProvider>
);

export default AppWithProviders;