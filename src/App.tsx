import React, { useState, useEffect } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { dbService } from './services/dbService';
import DashboardLayout from './layouts/DashboardLayout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard'; // <--- IMPORTED DASHBOARD

// Placeholder components for tabs we haven't built yet
// You can create files for these later in src/pages/
const History = () => <div className="text-center p-10 opacity-50 font-bold uppercase">History Page Coming Soon</div>;
const Assistant = () => <div className="text-center p-10 opacity-50 font-bold uppercase">AI Assistant Coming Soon</div>;
const Profile = () => <div className="text-center p-10 opacity-50 font-bold uppercase">Profile Page Coming Soon</div>;

const App: React.FC = () => {
  const [isSplashScreen, setIsSplashScreen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'history' | 'assistant' | 'profile'>('buy');
  
  // User Data State
  const [user, setUser] = useState<{name: string, email: string, balance: number}>({ 
    name: '', 
    email: '', 
    balance: 0 
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState('en');

  // Splash Screen Timer
  useEffect(() => { setTimeout(() => setIsSplashScreen(false), 2000); }, []);

  // --- ACTIONS ---

  const handleLogin = async (email: string, pass: string) => {
    setIsProcessing(true);
    try {
      const u = await dbService.loginUser(email, pass);
      
      // Fetch latest balance from DB
      const profile = await dbService.getUserProfile(email, u.full_name);
      
      setUser({ 
        name: u.full_name, 
        email: u.email, 
        balance: Number(profile?.wallet_balance || 0) 
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
      setUser({ name, email, balance: 0 }); // New users start with 0
      setIsAuthenticated(true);
    } catch (e: any) {
      alert(e.message || "Signup Failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to update local balance immediately after purchase
  const handleUpdateBalance = (newBalance: number) => {
    setUser(prev => ({ ...prev, balance: newBalance }));
  };

  // --- RENDER ---

  if (isSplashScreen) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-600 text-white">
      <Zap className="w-24 h-24 animate-bounce text-yellow-400 fill-yellow-400"/>
      <h1 className="text-4xl font-black mt-8 tracking-tighter">NaijaConnect</h1>
    </div>
  );

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} onSignup={handleSignup} isProcessing={isProcessing} />;
  }

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      userName={user.name} 
      language={language} 
      setLanguage={setLanguage}
    >
      {activeTab === 'buy' && (
        <Dashboard user={user} onUpdateBalance={handleUpdateBalance} />
      )}
      
      {activeTab === 'history' && <History />}
      {activeTab === 'assistant' && <Assistant />}
      {activeTab === 'profile' && <Profile />}
    </DashboardLayout>
  );
};

export default App;