import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Monitor, Lock, LogOut, ChevronRight, Mail, ShieldCheck, 
  Camera, User, Phone, Save, Loader2, Star, KeyRound
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from "../supabaseClient"; // <--- Added this import
import { useI18n } from '../i18n';
import { hashPin, isValidPin } from '../utils/pin';

interface ProfileProps {
  user: { 
    name: string; 
    email: string; 
    phone?: string; 
    avatar_url?: string;
    tier?: 'Starter' | 'Gold' | 'Platinum'; 
    id?: string;
    pinHash?: string | null;
    pinLength?: number | null;
  };
  onLogout: () => void;
  onUpdateUser: (updatedData: any) => Promise<void>; 
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const { t } = useI18n();
  type ThemeMode = 'light' | 'dark' | 'system';
  const getInitialTheme = (): ThemeMode => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  };
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  
  // Accordion States
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Profile Data State
  const nameParts = (user.name || '').trim().split(' ').filter(Boolean);
  const [formData, setFormData] = useState({
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: user.phone || ''
  });

  // Password State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [pinForm, setPinForm] = useState({
    current: '',
    next: '',
    confirm: '',
    length: (user.pinLength === 4 || user.pinLength === 6) ? user.pinLength : 4
  });

  // --- THEME LOGIC ---
  const applyThemeMode = (mode: ThemeMode) => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', useDark);
  };

  const cycleThemeMode = () => {
    const next: ThemeMode =
      themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light';
    setThemeMode(next);
    localStorage.setItem('theme', next);
    applyThemeMode(next);
  };

  useEffect(() => {
    applyThemeMode(themeMode);
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const handleChange = () => {
      if (localStorage.getItem('theme') === 'system') {
        applyThemeMode('system');
      }
    };
    if (media?.addEventListener) media.addEventListener('change', handleChange);
    else if (media?.addListener) media.addListener(handleChange);
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', handleChange);
      else if (media?.removeListener) media.removeListener(handleChange);
    };
  }, [themeMode]);

  // --- PROFILE UPDATE LOGIC ---
  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
        if (!formData.firstName.trim()) {
            setMsg({ text: t("profile.fill_all_fields"), type: 'error' });
            setIsLoading(false);
            return;
        }
        await dbService.updateProfile(user.email, {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim() || null,
            phone: formData.phone
        });
        
        const fullName = `${formData.firstName} ${formData.lastName}`.trim();
        await onUpdateUser({ name: fullName, phone: formData.phone }); 
        setMsg({ text: t("profile.updated"), type: 'success' });
        setTimeout(() => {
            setMsg({ text: '', type: '' });
            setShowEditProfile(false);
        }, 1500);
    } catch (e) {
        setMsg({ text: t("profile.update_failed"), type: 'error' });
    } finally {
        setIsLoading(false);
    }
  };

  // --- PASSWORD CHANGE LOGIC (FIXED) ---
  const handleChangePassword = async () => {
     // 1. Basic Validation
     if (!passwords.current || !passwords.new || !passwords.confirm) {
        return setMsg({ text: t("profile.fill_all_fields"), type: 'error' });
     }
     if (passwords.new !== passwords.confirm) {
        return setMsg({ text: t("profile.passwords_no_match"), type: 'error' });
     }
     if (passwords.new.length < 6) {
        return setMsg({ text: t("profile.password_min"), type: 'error' });
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
          throw new Error(t("profile.incorrect_current_password"));
       }

       // 3. Update to New Password
       const { error: updateError } = await supabase.auth.updateUser({
          password: passwords.new
       });

       if (updateError) {
          throw new Error(updateError.message); // e.g. "Password should be different"
       }

       // 4. Success
       setMsg({ text: t("profile.password_updated"), type: 'success' });
       setPasswords({ current: '', new: '', confirm: '' });
       setTimeout(() => setShowPasswordForm(false), 2000);

     } catch (e: any) {
       console.error("Password Error:", e);
       setMsg({ text: e.message || t("profile.password_update_failed"), type: 'error' });
     } finally {
       setIsLoading(false);
     }
  };

  // --- HELPER: Get Default Avatar ---
  const buildDefaultAvatar = (name: string) => {
    const initials = (name || 'User')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0]?.toUpperCase())
      .join('') || 'U';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22C55E"/>
            <stop offset="100%" stop-color="#16A34A"/>
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="64" fill="url(#g)"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
          font-family="Inter, SF Pro, Manrope, Arial" font-size="48" font-weight="700" fill="#FFFFFF">
          ${initials}
        </text>
      </svg>
    `.trim();
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleUpdatePin = async () => {
    setIsLoading(true);
    try {
      if (!user.id) throw new Error("Missing user id");
      const len = pinForm.length;
      if (!isValidPin(pinForm.next, len)) {
        setMsg({ text: `PIN must be ${len} digits`, type: 'error' });
        setIsLoading(false);
        return;
      }
      if (pinForm.next !== pinForm.confirm) {
        setMsg({ text: "PINs do not match", type: 'error' });
        setIsLoading(false);
        return;
      }
      if (user.pinHash) {
        if (!pinForm.current) {
          setMsg({ text: "Enter current PIN", type: 'error' });
          setIsLoading(false);
          return;
        }
        const currentHash = await hashPin(pinForm.current, user.id);
        if (currentHash !== user.pinHash) {
          setMsg({ text: "Current PIN is incorrect", type: 'error' });
          setIsLoading(false);
          return;
        }
      }
      const nextHash = await hashPin(pinForm.next, user.id);
      await dbService.updateProfile(user.email, {
        pin_hash: nextHash,
        pin_length: len
      });
      await onUpdateUser({ pinHash: nextHash, pinLength: len });
      setPinForm({ current: '', next: '', confirm: '', length: len });
      setMsg({ text: "PIN updated", type: 'success' });
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to update PIN", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatar = () => {
    if (user.avatar_url) return user.avatar_url;
    return buildDefaultAvatar(user.name);
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
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = buildDefaultAvatar(user.name); }}
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
                  <h4 className="font-black text-sm dark:text-white">{t("profile.personal_details")}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t("profile.name_phone")}</p>
               </div>
            </div>
            <ChevronRight size={18} className={`text-slate-300 transition-transform ${showEditProfile ? 'rotate-90' : ''}`}/>
         </button>
         
         {showEditProfile && (
            <div className="px-5 pb-5 animate-in slide-in-from-top-2">
               <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  
                  {/* First Name Input */}
                  <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                        type="text" 
                        placeholder="First Name" 
                        value={formData.firstName} 
                        onChange={e => setFormData({...formData, firstName: e.target.value})} 
                        className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                      />
                  </div>

                  {/* Last Name Input */}
                  <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                        type="text" 
                        placeholder="Last Name (optional)" 
                        value={formData.lastName} 
                        onChange={e => setFormData({...formData, lastName: e.target.value})} 
                        className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                      />
                  </div>

                  {/* Phone Input */}
                  <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                        type="tel" 
                        placeholder={t("profile.phone_number")} 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} 
                        className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                      />
                  </div>
                  
                  {/* Show success/error msg only if NOT showing password form msg */}
                  {msg.text && !showPasswordForm && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                  
                  <button onClick={handleUpdateProfile} disabled={isLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} {t("profile.save_changes")}
                  </button>
               </div>
            </div>
         )}
      </div>

      {/* 3. SETTINGS & SECURITY */}
      <div className="space-y-4">
         
         {/* Theme Toggle */}
         <button onClick={cycleThemeMode} className="w-full bg-white dark:bg-slate-800 p-5 rounded-[25px] flex items-center justify-between shadow-sm border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-purple-100 text-purple-600 rounded-xl dark:bg-purple-900/30 dark:text-purple-300">
                  {themeMode === 'dark' ? <Moon size={20}/> : themeMode === 'light' ? <Sun size={20}/> : <Monitor size={20}/>}
               </div>
               <div className="text-left">
                  <h4 className="font-black text-sm dark:text-white">{t("profile.appearance")}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    {themeMode === 'dark' ? t("profile.dark_mode") : themeMode === 'light' ? t("profile.light_mode") : 'System'}
                  </p>
               </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${themeMode === 'dark' ? 'bg-emerald-500' : themeMode === 'light' ? 'bg-slate-200' : 'bg-amber-200'}`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${themeMode === 'dark' ? 'translate-x-6' : themeMode === 'light' ? 'translate-x-0' : 'translate-x-3'}`}></div>
            </div>
         </button>

         {/* Change Password Section */}
         <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button onClick={() => { setShowPasswordForm(!showPasswordForm); setMsg({text:'', type:''}); }} className="w-full p-5 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl dark:bg-blue-900/30 dark:text-blue-300"><Lock size={20}/></div>
                  <div className="text-left">
                     <h4 className="font-black text-sm dark:text-white">{t("profile.security")}</h4>
                     <p className="text-[10px] text-slate-400 font-bold uppercase">{t("profile.change_password")}</p>
                  </div>
               </div>
               <ChevronRight size={18} className={`text-slate-300 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`}/>
            </button>
            
            {showPasswordForm && (
               <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                     <input type="password" placeholder={t("profile.current_password")} value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     <input type="password" placeholder={t("profile.new_password")} value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     <input type="password" placeholder={t("profile.confirm_new_password")} value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                     
                     {msg.text && showPasswordForm && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                     
                     <button onClick={handleChangePassword} disabled={isLoading} className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex justify-center">
                        {isLoading ? <Loader2 className="animate-spin" size={14}/> : t("profile.update_password")}
                     </button>
                  </div>
               </div>
            )}
         </div>

         {/* PIN Section */}
         <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button onClick={() => { setShowPasswordForm(false); setMsg({text:'', type:''}); }} className="w-full p-5 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl dark:bg-emerald-900/30 dark:text-emerald-300"><KeyRound size={20}/></div>
                  <div className="text-left">
                     <h4 className="font-black text-sm dark:text-white">PIN</h4>
                     <p className="text-[10px] text-slate-400 font-bold uppercase">Set or Change PIN</p>
                  </div>
               </div>
               <ChevronRight size={18} className="text-slate-300 rotate-90"/>
            </button>

            <div className="px-5 pb-5 animate-in slide-in-from-top-2">
               <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  {user.pinHash && (
                    <input
                      type="password"
                      placeholder="Current PIN"
                      value={pinForm.current}
                      onChange={e => setPinForm({ ...pinForm, current: e.target.value.replace(/\D/g, '').slice(0, pinForm.length) })}
                      className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPinForm({ ...pinForm, length: 4 })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold ${pinForm.length === 4 ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}
                    >
                      4 Digits
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinForm({ ...pinForm, length: 6 })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold ${pinForm.length === 6 ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}
                    >
                      6 Digits
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder={`New ${pinForm.length}-digit PIN`}
                    value={pinForm.next}
                    onChange={e => setPinForm({ ...pinForm, next: e.target.value.replace(/\D/g, '').slice(0, pinForm.length) })}
                    className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="password"
                    placeholder="Confirm PIN"
                    value={pinForm.confirm}
                    onChange={e => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '').slice(0, pinForm.length) })}
                    className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                  {msg.text && !showPasswordForm && (
                    <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>
                  )}
                  <button onClick={handleUpdatePin} disabled={isLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Save PIN
                  </button>
               </div>
            </div>
         </div>

         {/* Support */}
         <button
           onClick={() => window.open('https://wa.me/2349151618451', '_blank')}
           className="w-full bg-white dark:bg-slate-800 p-5 rounded-[25px] flex items-center justify-between shadow-sm border border-slate-100 dark:border-slate-700 active:scale-95 transition-all"
         >
            <div className="flex items-center gap-4">
               <div className="p-3 bg-orange-100 text-orange-600 rounded-xl dark:bg-orange-900/30 dark:text-orange-300"><Mail size={20}/></div>
               <div className="text-left">
                  <h4 className="font-black text-sm dark:text-white">{t("profile.help_support")}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t("profile.contact_us")}</p>
               </div>
            </div>
            <ChevronRight size={18} className="text-slate-300"/>
         </button>
      </div>

      {/* 4. LOGOUT BUTTON */}
      <button onClick={onLogout} className="w-full p-5 rounded-[25px] flex items-center justify-center gap-2 text-rose-500 font-black uppercase text-xs tracking-widest border-2 border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors active:scale-95">
         <LogOut size={16}/> {t("profile.log_out")}
      </button>

      <p className="text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] pt-4">Swifna v1.0.0</p>
    </div>
  );
};

export default Profile;
