import React, { useState } from 'react';
import { 
  Moon, Sun, Lock, LogOut, ChevronRight, Mail, ShieldCheck, 
  Camera, User, Phone, Save, Loader2, Star
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from "../supabaseClient"; // <--- Added this import

interface ProfileProps {
  user: { 
    name: string; 
    email: string; 
    phone?: string; 
    avatar_url?: string;
    tier?: 'Starter' | 'Gold' | 'Platinum'; 
  };
  onLogout: () => void;
  onUpdateUser: (updatedData: any) => Promise<void>; 
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  
  // Accordion States
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Profile Data State
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone: user.phone || ''
  });

  // Password State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  // --- THEME LOGIC ---
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

  // --- PROFILE UPDATE LOGIC ---
  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
        await dbService.updateProfile(user.email, {
            name: formData.name,
            phone: formData.phone
        });
        
        await onUpdateUser(formData); 
        setMsg({ text: "Profile Updated!", type: 'success' });
        setTimeout(() => {
            setMsg({ text: '', type: '' });
            setShowEditProfile(false);
        }, 1500);
    } catch (e) {
        setMsg({ text: "Update failed. Check connection.", type: 'error' });
    } finally {
        setIsLoading(false);
    }
  };

  // --- PASSWORD CHANGE LOGIC (FIXED) ---
  const handleChangePassword = async () => {
     // 1. Basic Validation
     if (!passwords.current || !passwords.new || !passwords.confirm) {
        return setMsg({ text: "Please fill all fields", type: 'error' });
     }
     if (passwords.new !== passwords.confirm) {
        return setMsg({ text: "New passwords do not match", type: 'error' });
     }
     if (passwords.new.length < 6) {
        return setMsg({ text: "Password must be at least 6 chars", type: 'error' });
     }
     
     setIsLoading(true);
     setMsg({ text: '', type: '' }); // Clear old messages

     try {
       // 2. Verify Old Password (Re-authentication)
       const { error: loginError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwords.current
       });

       if (loginError) {
          throw new Error("Incorrect Current Password");
       }

       // 3. Update to New Password
       const { error: updateError } = await supabase.auth.updateUser({
          password: passwords.new
       });

       if (updateError) {
          throw new Error(updateError.message); // e.g. "Password should be different"
       }

       // 4. Success
       setMsg({ text: "Password Updated Successfully!", type: 'success' });
       setPasswords({ current: '', new: '', confirm: '' });
       setTimeout(() => setShowPasswordForm(false), 2000);

     } catch (e: any) {
       console.error("Password Error:", e);
       setMsg({ text: e.message || "Failed to update password", type: 'error' });
     } finally {
       setIsLoading(false);
     }
  };

  // --- HELPER: Get Default Avatar ---
  const getAvatar = () => {
    if (user.avatar_url) return user.avatar_url;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=047857&color=fff&size=128&bold=true`;
  };

  // --- HELPER: Get Tier Color ---
  const getTierStyle = () => {
      const tier = user.tier || 'Starter';
      switch(tier) {
          case 'Gold': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'Platinum': return 'bg-slate-200 text-slate-800 border-slate-300';
          default: return 'bg-emerald-800/30 text-emerald-100 border-emerald-500/30';
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      
      {/* 1. HEADER CARD */}
      <div className="bg-emerald-600 p-8 rounded-[35px] text-white shadow-xl text-center relative overflow-hidden group">
         {/* Background Decoration */}
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none"></div>
         
         {/* TIER BADGE */}
         <div className={`absolute top-6 right-6 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-md flex items-center gap-1 ${getTierStyle()}`}>
            <Star size={10} className="fill-current"/> {user.tier || 'Starter'}
         </div>

         {/* Avatar Section */}
         <div className="relative w-28 h-28 mx-auto mb-4">
            <img 
                src={getAvatar()} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover border-4 border-white/20 shadow-2xl"
            />
            <button className="absolute bottom-0 right-0 p-2 bg-white text-emerald-600 rounded-full shadow-lg active:scale-90 transition-transform">
                <Camera size={16} />
            </button>
         </div>

         <h2 className="text-2xl font-black tracking-tight">{user.name}</h2>
         <p className="text-emerald-100 text-sm font-medium opacity-80 mb-1">{user.email}</p>
         {user.phone && <p className="text-emerald-200 text-xs font-bold tracking-widest">{user.phone}</p>}
      </div>

      {/* 2. PERSONAL INFO SECTION */}
      <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
         <button onClick={() => setShowEditProfile(!showEditProfile)} className="w-full p-5 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl dark:bg-emerald-900/30 dark:text-emerald-300"><User size={20}/></div>
               <div className="text-left">
                  <h4 className="font-black text-sm dark:text-white">Personal Details</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Name & Phone</p>
               </div>
            </div>
            <ChevronRight size={18} className={`text-slate-300 transition-transform ${showEditProfile ? 'rotate-90' : ''}`}/>
         </button>
         
         {showEditProfile && (
            <div className="px-5 pb-5 animate-in slide-in-from-top-2">
               <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  
                  {/* Name Input */}
                  <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                        type="text" 
                        placeholder="Full Name" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                      />
                  </div>

                  {/* Phone Input */}
                  <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                        type="tel" 
                        placeholder="Phone Number" 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} 
                        className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                      />
                  </div>
                  
                  {/* Show success/error msg only if NOT showing password form msg */}
                  {msg.text && !showPasswordForm && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                  
                  <button onClick={handleUpdateProfile} disabled={isLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Save Changes
                  </button>
               </div>
            </div>
         )}
      </div>

      {/* 3. SETTINGS & SECURITY */}
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
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-emerald-500' : 'bg-slate-200'}`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
         </button>

         {/* Change Password Section */}
         <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button onClick={() => { setShowPasswordForm(!showPasswordForm); setMsg({text:'', type:''}); }} className="w-full p-5 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl dark:bg-blue-900/30 dark:text-blue-300"><Lock size={20}/></div>
                  <div className="text-left">
                     <h4 className="font-black text-sm dark:text-white">Security</h4>
                     <p className="text-[10px] text-slate-400 font-bold uppercase">Change Password</p>
                  </div>
               </div>
               <ChevronRight size={18} className={`text-slate-300 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`}/>
            </button>
            
            {showPasswordForm && (
               <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                     <input type="password" placeholder="Current Password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     <input type="password" placeholder="New Password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     <input type="password" placeholder="Confirm New Password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     
                     {msg.text && showPasswordForm && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                     
                     <button onClick={handleChangePassword} disabled={isLoading} className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex justify-center">
                        {isLoading ? <Loader2 className="animate-spin" size={14}/> : "Update Password"}
                     </button>
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

      {/* 4. LOGOUT BUTTON */}
      <button onClick={onLogout} className="w-full p-5 rounded-[25px] flex items-center justify-center gap-2 text-rose-500 font-black uppercase text-xs tracking-widest border-2 border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors active:scale-95">
         <LogOut size={16}/> Log Out
      </button>

      <p className="text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] pt-4">NaijaConnect v1.0.0</p>
    </div>
  );
};

export default Profile;