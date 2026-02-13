import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Monitor, Lock, LogOut, ChevronRight, Mail, Bell,
  User, Phone, Save, Loader2, KeyRound, Zap
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from "../supabaseClient"; 
import { useI18n } from '../i18n';
import { hashPin, isValidPin } from '../utils/pin';
import { usePushNotifications } from '../hooks/usePushNotifications';
import AdminDashboard from './AdminDashboard';
import FounderDashboard from './FounderDashboard';
import InvestorDashboard from './InvestorDashboard';

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
    role?: string | null;
    roles?: string[] | null;
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
  const [activeView, setActiveView] = useState<'profile' | 'admin' | 'founder' | 'investor'>('profile');

  // Profile Data State
  const nameParts = (user.name || '').trim().split(' ').filter(Boolean);
  const [formData, setFormData] = useState({
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: user.phone || ''
  });

  // Password & Pin State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [pinForm, setPinForm] = useState({
    current: '',
    next: '',
    confirm: '',
    length: (user.pinLength === 4 || user.pinLength === 6) ? user.pinLength : 4
  });

  // Push Notification Hook
  const { isSubscribed, subscribeToPush, unsubscribeFromPush, loading: pushLoading } = usePushNotifications(user?.id);

  const [agreements, setAgreements] = useState<any[]>([]);
  const [agreementSign, setAgreementSign] = useState<Record<string, { name: string; checked: boolean; method?: string }>>({});
  const [agreementsLoading, setAgreementsLoading] = useState(false);

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

  const loadAgreements = async () => {
    if (!user?.id) return;
    setAgreementsLoading(true);
    try {
      const { data: invites, error } = await supabase
        .from("document_invites")
        .select("id, status, document_id, created_at")
        .eq("invited_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const docIds = Array.from(new Set((invites || []).map((i: any) => i.document_id)));
      let docs: any[] = [];
      let versions: any[] = [];
      if (docIds.length) {
        const docRes = await supabase.from("documents").select("*").in("id", docIds);
        if (docRes.error) throw docRes.error;
        docs = docRes.data || [];

        const verRes = await supabase.from("document_versions").select("*").in("document_id", docIds);
        if (verRes.error) throw verRes.error;
        versions = verRes.data || [];
      }

      const latestByDoc: Record<string, any> = {};
      versions.forEach((v) => {
        const existing = latestByDoc[v.document_id];
        if (!existing || v.version > existing.version) latestByDoc[v.document_id] = v;
      });

      const rows = (invites || []).map((invite: any) => {
        const doc = docs.find((d) => d.id === invite.document_id);
        const version = latestByDoc[invite.document_id];
        return { invite, doc, version };
      });
      setAgreements(rows);
    } catch (e: any) {
      console.error(e);
    } finally {
      setAgreementsLoading(false);
    }
  };

  useEffect(() => {
    loadAgreements();
  }, [user?.id]);

  const handleSignAgreement = async (inviteId: string) => {
    const entry = agreements.find((a) => a.invite.id === inviteId);
    if (!entry || !user?.id) return;
    const sig = agreementSign[inviteId];
    if (!sig?.checked || !sig?.name?.trim()) {
      setMsg({ text: "Please check acknowledgement and type your name", type: "error" });
      return;
    }
    try {
      const method =
        entry.doc?.signature_method === "external" ? "external" : sig.method || "native";
      const { error } = await supabase.from("document_signatures").insert({
        document_version_id: entry.version?.id,
        user_id: user.id,
        signature_method: method,
        typed_name: sig.name.trim(),
        external_provider: entry.doc?.external_provider || null,
        external_reference: entry.doc?.external_url || null,
      });
      if (error) throw error;
      await supabase
        .from("document_invites")
        .update({ status: "signed" })
        .eq("id", inviteId);
      setAgreementSign((prev) => ({ ...prev, [inviteId]: { name: "", checked: false } }));
      loadAgreements();
      setMsg({ text: "Agreement signed", type: "success" });
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to sign agreement", type: "error" });
    }
  };

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

  // --- PASSWORD CHANGE LOGIC ---
  const handleChangePassword = async () => {
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
      setMsg({ text: '', type: '' }); 

      try {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwords.current
        });

        if (loginError) throw new Error(t("profile.incorrect_current_password"));

        const { error: updateError } = await supabase.auth.updateUser({
          password: passwords.new
        });

        if (updateError) throw new Error(updateError.message);

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

  const handleUpdatePin = async () => {
    setIsLoading(true);
    try {
      if (!user.id) throw new Error("Missing user id");
      const len = pinForm.length;
      
      if (!pinForm.length || (pinForm.length !== 4 && pinForm.length !== 6)) {
          // Default fallback
          setPinForm(prev => ({ ...prev, length: 4 }));
      }

      if (!isValidPin(pinForm.next, len || 4)) {
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
      setPinForm({ current: '', next: '', confirm: '', length: len || 4 });
      setMsg({ text: "PIN updated", type: 'success' });
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to update PIN", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- NOTIFICATION TOGGLE ---
  const handleToggleNotifications = async () => {
    if (pushLoading) return;
    
    if (isSubscribed) {
      await unsubscribeFromPush();
    } else {
      await subscribeToPush();
    }
  };

  // --- HELPER: Avatar ---
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

  const getAvatar = () => {
    if (user.avatar_url) return user.avatar_url;
    return buildDefaultAvatar(user.name);
  };

  const hasRole = (role: string) => {
    if (user.roles?.includes(role)) return true;
    if (user.role === role) return true;
    return false;
  };

  if (activeView === 'admin') {
    return <AdminDashboard onBack={() => setActiveView('profile')} />;
  }

  if (activeView === 'founder') {
    return <FounderDashboard onBack={() => setActiveView('profile')} />;
  }

  if (activeView === 'investor' && user.id) {
    return <InvestorDashboard onBack={() => setActiveView('profile')} userId={user.id} email={user.email} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      
      {/* 1. HEADER CARD */}
      <div className="bg-emerald-900 p-8 rounded-[35px] text-white shadow-xl text-center relative overflow-hidden group">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-400/10 to-transparent pointer-events-none"></div>

         <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="w-full h-full rounded-[26px] bg-emerald-600/80 p-2 shadow-2xl flex items-center justify-center -rotate-6">
              <img 
                  src={getAvatar()} 
                  alt="Profile" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = buildDefaultAvatar(user.name); }}
                  className="w-full h-full rounded-[20px] object-cover rotate-6"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border border-emerald-200">
              <img src="/logo.png" alt="Swifna" className="w-4 h-4" />
            </div>
         </div>

         <h2 className="text-2xl font-black tracking-tight">{user.name}</h2>
         <p className="text-emerald-100 text-xs font-bold tracking-widest uppercase mt-1">{user.email}</p>

         <div className="mt-4 flex items-center justify-center gap-3">
           <span className="px-4 py-2 rounded-full bg-emerald-800/70 border border-emerald-500/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
             Verified <Zap size={10} className="text-emerald-200" />
           </span>
           <span className="px-4 py-2 rounded-full bg-emerald-800/70 border border-emerald-500/40 text-[10px] font-black uppercase tracking-widest">
             {user.tier || 'Starter'}
           </span>
         </div>

         <button
           onClick={onLogout}
           className="mt-5 w-full py-3 rounded-2xl border border-rose-400/40 text-rose-200 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500/10 transition-colors"
         >
           <LogOut size={14} /> Sign Out from Swifna
         </button>
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
                  <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input type="text" placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                  </div>
                  <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input type="text" placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                  </div>
                  <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input type="tel" placeholder={t("profile.phone_number")} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} className="w-full pl-9 p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                  </div>
                  {msg.text && !showPasswordForm && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                  <button onClick={handleUpdateProfile} disabled={isLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} {t("profile.save_changes")}
                  </button>
               </div>
            </div>
         )}
      </div>

      {(hasRole('admin') || hasRole('founder') || hasRole('ceo') || hasRole('investor')) && (
        <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 p-5 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Role Access</h4>
          {(hasRole('admin') || hasRole('founder') || hasRole('ceo')) && (
            <button
              onClick={() => setActiveView('admin')}
              className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Open Admin Panel
            </button>
          )}
          {(hasRole('founder') || hasRole('ceo')) && (
            <button
              onClick={() => setActiveView('founder')}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700"
            >
              Open Founder Dashboard
            </button>
          )}
          {hasRole('investor') && (
            <button
              onClick={() => setActiveView('investor')}
              className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800"
            >
              Open Investor Dashboard
            </button>
          )}
        </div>
      )}

      {/* Agreements */}
      <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 p-5 space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Agreements</h4>
        {agreementsLoading ? (
          <p className="text-xs text-slate-400">Loading agreements...</p>
        ) : agreements.length === 0 ? (
          <p className="text-xs text-slate-400">No pending agreements.</p>
        ) : (
          agreements.map((row) => (
            <div key={row.invite.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="text-xs font-black text-slate-800">{row.doc?.title || "Agreement"}</div>
              <div className="text-[10px] text-slate-400 uppercase">
                Role: {row.doc?.target_role || "role"} · Status: {row.invite.status}
              </div>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600 bg-white border border-slate-200 rounded-xl p-3">
                {row.version?.body_text || "Document text not found."}
              </div>

              {row.doc?.signature_method !== "native" && row.doc?.external_url && (
                <button
                  onClick={() => window.open(row.doc.external_url, "_blank")}
                  className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest"
                >
                  Open External Signature
                </button>
              )}

              {row.invite.status === "pending" && (
                <>
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                    <input
                      type="checkbox"
                      checked={agreementSign[row.invite.id]?.checked || false}
                      onChange={(e) =>
                        setAgreementSign((prev) => ({
                          ...prev,
                          [row.invite.id]: { ...(prev[row.invite.id] || {}), checked: e.target.checked },
                        }))
                      }
                    />
                    I acknowledge and agree to the terms above.
                  </label>
                  <input
                    type="text"
                    placeholder="Type your full name"
                    value={agreementSign[row.invite.id]?.name || ""}
                    onChange={(e) =>
                      setAgreementSign((prev) => ({
                        ...prev,
                        [row.invite.id]: { ...(prev[row.invite.id] || {}), name: e.target.value },
                      }))
                    }
                    className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => handleSignAgreement(row.invite.id)}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
                  >
                    Sign Agreement
                  </button>
                </>
              )}
            </div>
          ))
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
                    <input type="password" placeholder="Current PIN" value={pinForm.current} onChange={e => setPinForm({ ...pinForm, current: e.target.value.replace(/\D/g, '').slice(0, pinForm.length) })} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPinForm({ ...pinForm, length: 4 })} className={`flex-1 py-2 rounded-xl text-xs font-bold ${pinForm.length === 4 ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>4 Digits</button>
                    <button type="button" onClick={() => setPinForm({ ...pinForm, length: 6 })} className={`flex-1 py-2 rounded-xl text-xs font-bold ${pinForm.length === 6 ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>6 Digits</button>
                  </div>
                  <input type="password" placeholder={`New ${pinForm.length}-digit PIN`} value={pinForm.next} onChange={e => setPinForm({ ...pinForm, next: e.target.value.replace(/\D/g, '').slice(0, pinForm.length) })} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                  <input type="password" placeholder="Confirm PIN" value={pinForm.confirm} onChange={e => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '').slice(0, pinForm.length) })} className="w-full p-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"/>
                  {msg.text && !showPasswordForm && <p className={`text-[10px] font-black uppercase text-center ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{msg.text}</p>}
                  <button onClick={handleUpdatePin} disabled={isLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Save PIN
                  </button>
               </div>
            </div>
         </div>

         {/* Push Notifications Toggle */}
         <div className="bg-white dark:bg-slate-800 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 p-5 flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl dark:bg-emerald-900/30 dark:text-emerald-300">
                 <Bell size={20} />
               </div>
               <div className="text-left">
                  <h4 className="font-black text-sm dark:text-white">Push Notifications</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Receive alerts for transactions</p>
               </div>
            </div>
            
            <button
              onClick={handleToggleNotifications}
              disabled={pushLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isSubscribed ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              } ${pushLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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

      <p className="text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] pt-2">Swifna v1.0.0</p>
    </div>
  );
};

export default Profile;
