import React, { useState } from 'react';
import { Moon, Sun, Lock, LogOut, ChevronRight, Mail, ShieldCheck } from 'lucide-react';
import { dbService } from '../services/dbService';

interface ProfileProps {
  user: { name: string; email: string };
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  // Check if dark mode is active on load
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  // Password State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Toggle Theme Logic
  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // Change Password Logic
  const handleChangePassword = async () => {
     if (passwords.new !== passwords.confirm) {
        setMsg({ text: "Passwords do not match", type: 'error' });
        return;
     }
     if (passwords.new.length < 6) {
        setMsg({ text: "Password too short (min 6 chars)", type: 'error' });
        return;
     }
     
     try {
       await dbService.loginUser(user.email, passwords.current); // Verify old pass
       await dbService.resetPassword(user.email, passwords.new); // Set new
       setMsg({ text: "Password Updated Successfully!", type: 'success' });
       setPasswords({ current: '', new: '', confirm: '' });
       setTimeout(() => setShowPasswordForm(false), 1500);
     } catch (e) {
       setMsg({ text: "Incorrect Current Password", type: 'error' });
     }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. HEADER CARD */}
      <div className="bg-emerald-600 p-8 rounded-[35px] text-white shadow-xl text-center relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-white/5 pointer-events-none"></div>
         {/* Avatar */}
         <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full mx-auto flex items-center justify-center mb-4 text-4xl font-black border-4 border-white/10 shadow-inner uppercase">
            {user.name.charAt(0)}
         </div>
         <h2 className="text-2xl font-black tracking-tight">{user.name}</h2>
         <p className="text-emerald-100 text-sm font-medium opacity-80">{user.email}</p>
         
         <div className="mt-4 inline-flex items-center gap-2 bg-black/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck size={12} className="text-emerald-300"/> Verified User
         </div>
      </div>

      {/* 2. SETTINGS LIST */}
      <div className="space-y-4">
         
         {/* Theme Toggle */}
         <button onClick={toggleTheme} className="w-full bg-white dark:bg-slate-800 p-5 rounded-[25px] flex items-center justify-between shadow-sm border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-purple-100 text-purple-600 rounded-xl dark:bg-purple-900/30 dark:text-purple-300">
                  {isDarkMode ? <Moon size={20}/> : <Sun size={20}/>}
               </div>
               <div className="text-left">
                  <h4 className="font-black text-sm dark:text-white">Appearance</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</p>
               </div>
            </div>
            {/* Switch UI */}
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-emerald-500' : 'bg-slate-200'}`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
         </button>

         {/* Change Password Section */}
         <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="w-full p-5 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-100 text-blue-600 rounded-xl dark:bg-blue-900/30 dark:text-blue-300"><Lock size={20}/></div>
                   <div className="text-left">
                      <h4 className="font-black text-sm dark:text-white">Security</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Change Password</p>
                   </div>
                </div>
                <ChevronRight size={18} className={`text-slate-300 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`}/>
            </button>
            
            {/* Form Accordion */}
            {showPasswordForm && (
               <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                     <input type="password" placeholder="Current Password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     <input type="password" placeholder="New Password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     <input type="password" placeholder="Confirm New Password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     
                     {msg.text && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                     
                     <button onClick={handleChangePassword} className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Update Password</button>
                  </div>
               </div>
            )}
         </div>

         {/* Support */}
         <button className="w-full bg-white dark:bg-slate-800 p-5 rounded-[25px] flex items-center justify-between shadow-sm border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-orange-100 text-orange-600 rounded-xl dark:bg-orange-900/30 dark:text-orange-300"><Mail size={20}/></div>
               <div className="text-left">
                  <h4 className="font-black text-sm dark:text-white">Help & Support</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Contact Us</p>
               </div>
            </div>
            <ChevronRight size={18} className="text-slate-300"/>
         </button>
      </div>

      {/* 3. LOGOUT BUTTON */}
      <button onClick={onLogout} className="w-full p-5 rounded-[25px] flex items-center justify-center gap-2 text-rose-500 font-black uppercase text-xs tracking-widest border-2 border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors active:scale-95">
         <LogOut size={16}/> Log Out
      </button>

      <p className="text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] pt-4">NaijaConnect v1.0.0</p>
    </div>
  );
};

export default Profile;