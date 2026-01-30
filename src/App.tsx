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
  
  const [user, setUser] = useState<{name: string, email: string, balance: number, phone?: string} | null>(null);
  
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
      const profile = await dbService.getUserProfile(email);
      
      setUser({ 
        name: u.full_name || '', 
        email: u.email || '', 
        balance: Number(profile?.wallet_balance || 0),
        phone: profile?.phone || '' 
      });
      setIsAuthenticated(true);
    } catch (e: any) { 
      alert(e.message || "Login Failed"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleSignup = async (email: string, name: string, pass: string) => {
    setIsProcessing(true);
    try {
      await dbService.registerUser(email, name, pass);
      // Success: User registered. They need to verify email.
      setUser({ name: '', email: '', balance: 0 }); 
    } catch (e: any) { 
      alert(e.message || "Signup Failed"); 
      throw e; 
    } finally { 
      setIsProcessing(false); 
    }
  };

  // ✅ NEW: Handle Password Reset
  const handleForgotPassword = async (email: string) => {
    try {
      // We use the dbService we already created to keep things clean
      await dbService.resetPasswordEmail(email);
    } catch (e: any) {
      console.error(e);
      throw e; // Pass error back to Auth component to display
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      setIsAuthenticated(false);
      setUser({ name: '', email: '', balance: 0 });
      setActiveTab('buy');
    }
  };

  const handleUpdateUser = async (updatedData: any) => {
    setUser((prevUser: any) => ({
        ...prevUser,
        ...updatedData
    }));
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
        onForgotPassword={handleForgotPassword} // <--- Passed the new function here
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
      
      {activeTab === 'profile' && user && (
        <Profile 
          user={user} 
          onLogout={handleLogout} 
          onUpdateUser={handleUpdateUser} 
        />
      )}
    </DashboardLayout>
  );
};

export default App;