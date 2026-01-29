import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { dbService } from './services/dbService';
import DashboardLayout from './layouts/DashboardLayout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Profile from './pages/Profile';
import Assistant from './pages/Assistant';

const App: React.FC = () => {
  const [isSplashScreen, setIsSplashScreen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'history' | 'assistant' | 'profile'>('buy');
  
  // ✅ FIX: Ensured state starts with empty strings to prevent charAt(0) crashes
  const [user, setUser] = useState<{name: string, email: string, balance: number} | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState('en');

  // Initialization Effect
  useEffect(() => { 
    // Splash Screen Timer
    const timer = setTimeout(() => setIsSplashScreen(false), 2000); 
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }

    return () => clearTimeout(timer);
  }, []);

  // --- ACTIONS ---

  const handleLogin = async (email: string, pass: string) => {
    setIsProcessing(true);
    try {
      const u = await dbService.loginUser(email, pass);
      const profile = await dbService.getUserProfile(email, u.full_name);
      
      setUser({ 
        name: u.full_name || '', 
        email: u.email || '', 
        balance: Number(profile?.wallet_balance || 0) 
      });
      setIsAuthenticated(true);
    } catch (e: any) { 
      // Handle "Email not confirmed" or incorrect credentials
      alert(e.message || "Login Failed"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleSignup = async (email: string, name: string, pass: string) => {
    setIsProcessing(true);
    try {
      await dbService.registerUser(email, name, pass);
      // ✅ SUCCESS: User is registered but unverified. 
      // We do NOT set isAuthenticated(true) here because they must click the email link first.
      setUser({ name: '', email: '', balance: 0 }); 
    } catch (e: any) { 
      alert(e.message || "Signup Failed"); 
      throw e; // Pass to Auth.tsx to handle UI reset
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      setIsAuthenticated(false);
      setUser({ name: '', email: '', balance: 0 });
      setActiveTab('buy');
    }
  };

  const onUpdateBalance = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  // --- RENDER ---

  if (isSplashScreen) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-600 text-white">
      <Zap className="w-24 h-24 animate-bounce text-yellow-400 fill-yellow-400"/>
      <h1 className="text-4xl font-black mt-8 tracking-tighter">NaijaConnect</h1>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <Auth 
        onLogin={handleLogin} 
        onSignup={handleSignup} 
        isProcessing={isProcessing} 
      />
    );
  }

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      userName={user?.name || ''} 
      language={language} 
      setLanguage={setLanguage}
    >
      {activeTab === 'buy' && user && (
        <Dashboard user={user} onUpdateBalance={onUpdateBalance} />
      )}
      
      {activeTab === 'history' && <History />}
      
      {activeTab === 'assistant' && (
        <Assistant user={user} />
      )}
      
      {activeTab === 'profile' && (
        <Profile user={user} onLogout={handleLogout} />
      )}
    </DashboardLayout>
  );
};

export default App;