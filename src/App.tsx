import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import { dbService } from "./services/dbService";
import { I18nProvider, LanguageCode } from "./i18n";
import { ToastProvider, useToast } from "./components/ui/ToastProvider";
import { SuccessScreenProvider } from "./components/ui/SuccessScreenProvider";
import BroadcastManager from "./components/BroadcastManager";
import { CONSTELLATIONS } from "./data/constellations";
import { applySeo } from "./utils/seo";
import { authenticatePiUser, type PiPaymentDTO } from "./services/piNetworkService";

// Layouts & Pages
import DashboardLayout from "./layouts/DashboardLayout";
const Auth = React.lazy(() => import("./pages/Auth"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const History = React.lazy(() => import("./pages/History"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Assistant = React.lazy(() => import("./pages/Assistant"));

const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures on restricted browsers.
  }
};

const App: React.FC = () => {
  const pageFallback = (
    <div className="min-h-[40vh] flex items-center justify-center">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
        Loading...
      </p>
    </div>
  );
  const [isSplashScreen, setIsSplashScreen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"buy" | "history" | "assistant" | "profile">("buy");

  // Navigation Reset Key (To force Dashboard reload when clicking "Buy")
  const [dashboardResetKey, setDashboardResetKey] = useState(0);

  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    balance: number;
    piBalance?: number;
    phone?: string;
    role?: string;
    roles?: string[];
    pinHash?: string | null;
    pinLength?: number | null;
    piUid?: string | null;
    piUsername?: string | null;
    piWalletAddress?: string | null;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const stored = readStorage("language");
    return (stored as LanguageCode) || "en";
  });
  const [isNightSky, setIsNightSky] = useState(false);
  const [moonPhase, setMoonPhase] = useState<{ phase: string; illumination: number } | null>(null);
  const [moonImageUrl, setMoonImageUrl] = useState<string | null>(null);
  const [constellation, setConstellation] = useState<string | null>(null);
  const [showLearn, setShowLearn] = useState(false);
  const learnHoldRef = useRef(false);
  const [splashDelayDone, setSplashDelayDone] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const userDataLoadedRef = useRef(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [dashboardSeoView, setDashboardSeoView] = useState("Dashboard");

  const isNightWindow = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const afterStart = h > 19 || (h === 19 && m >= 0);
    const beforeEnd = h < 5 || (h === 5 && m < 30);
    return afterStart || beforeEnd;
  };

  const getNightKey = (d: Date) => {
    if (!isNightWindow(d)) return null;
    const nightDate = new Date(d);
    if (d.getHours() < 5 || (d.getHours() === 5 && d.getMinutes() < 30)) {
      nightDate.setDate(d.getDate() - 1);
    }
    return nightDate.toISOString().slice(0, 10);
  };

  const pickConstellationForNight = (nightKey: string) => {
    const storedKey = readStorage("night_constellation_date");
    const storedName = readStorage("night_constellation_name");
    if (storedKey === nightKey && storedName) return storedName;

    let hash = 0;
    for (let i = 0; i < nightKey.length; i += 1) {
      hash = (hash * 31 + nightKey.charCodeAt(i)) >>> 0;
    }
    const idx = hash % CONSTELLATIONS.length;
    const name = CONSTELLATIONS[idx];
    writeStorage("night_constellation_date", nightKey);
    writeStorage("night_constellation_name", name);
    return name;
  };

  const constellationStars = useMemo(() => {
    if (!constellation) return [];
    let seed = 0;
    for (let i = 0; i < constellation.length; i += 1)
      seed = (seed * 31 + constellation.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xfffffff) / 0xfffffff;
    };
    const count = 8 + (seed % 6);
    return Array.from({ length: count }, () => ({
      x: Math.round(10 + rand() * 200),
      y: Math.round(10 + rand() * 120),
      r: Math.round(1 + rand() * 2),
    }));
  }, [constellation]);

  const getLocalMoonPhase = (date: Date) => {
    const synodicMonth = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const daysSince =
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - knownNewMoon) / 86400000;
    const phase = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
    const phaseFrac = phase / synodicMonth;
    const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phaseFrac)) / 2) * 100);

    let name = "New Moon";
    if (phaseFrac >= 0.03 && phaseFrac < 0.22) name = "Waxing Crescent";
    else if (phaseFrac < 0.28) name = "First Quarter";
    else if (phaseFrac < 0.47) name = "Waxing Gibbous";
    else if (phaseFrac < 0.53) name = "Full Moon";
    else if (phaseFrac < 0.72) name = "Waning Gibbous";
    else if (phaseFrac < 0.78) name = "Last Quarter";
    else if (phaseFrac < 0.97) name = "Waning Crescent";

    return { phase: name, illumination };
  };

  // --- GLOBAL ORPHANED TRANSACTION CONTEXT RESOLVER ---
  const handleGlobalIncompletePiPayment = (payment: PiPaymentDTO) => {
    const reference = String(payment?.metadata?.reference || "");
    const paymentId = String(payment?.identifier || "");
    const txid = String(payment?.transaction?.txid || "");
    if (!reference || !paymentId || !txid) return;

    console.log(`[Pi Auto-Recovery Syncing Node] Capturing incomplete block reference session: ${reference}`);
    void supabase.functions.invoke("pi-payment-handler", {
      body: { action: "COMPLETE_PAYMENT", reference, paymentId, txid }
    }).then(async ({ data }) => {
      if (data?.local_status === "success") {
        const { data: profile } = await supabase.from("profiles").select("wallet_balance, pi_balance").eq("id", supabase.auth.getUser() as any).single();
        if (profile) {
          onUpdateBalance(Number(profile.wallet_balance || 0));
          if (onUpdatePiBalance) onUpdatePiBalance(Number(profile.pi_balance || 0));
        }
        console.log("[Pi Auto-Recovery Ok] Orphaned session cleared and balances synchronized.");
      }
    }).catch(err => console.warn("Background auto-reconciliation loop exception channel:", err));
  };

  const checkAndRecoverPiTransactions = async () => {
    try {
      console.log("[Global Init Boot] Instantiating authentication pipeline synchronization handler check...");
      await authenticatePiUser(handleGlobalIncompletePiPayment);
    } catch (err) {
      console.warn("Direct ecosystem tracking validation skipped:", err);
    }
  };

  // --- 1. FETCH USER PROFILE ---
  const fetchUser = async (email: string) => {
    console.log("[fetchUser] Started for email:", email);
    const fallbackName = email ? email.split("@")[0] : "user";
    try {
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("SUPABASE_QUERY_TIMEOUT")), 3000)
      );

      const dbQueryPromise = supabase.from("profiles").select("*").eq("email", email).single();
      const result = await Promise.race([dbQueryPromise, timeoutPromise]);
      const { data, error } = result as any;

      if (error) throw error;

      if (data) {
        let roles: string[] = [];
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.id);
        if (roleRows && roleRows.length) {
          roles = roleRows.map((r: any) => r.role);
        }
        if (!roles.length && data.role) {
          roles = [data.role];
        }

        setUser({
          id: data.id,
          name: data.first_name ? `${data.first_name} ${data.last_name || ""}`.trim() : fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
          email: email,
          balance: Number(data.wallet_balance || 0),
          piBalance: Number(data.pi_balance || 0),
          phone: data.phone || "",
          role: data.role || "user",
          roles: roles,
          pinHash: data.pin_hash || null,
          pinLength: data.pin_length || null,
          piUid: data.pi_uid || null,
          piUsername: data.pi_username || null,
          piWalletAddress: data.pi_wallet_address || null,
        });

        if (data.preferred_language) {
          setLanguage(data.preferred_language as LanguageCode);
        }
        setIsAuthenticated(true);

        // Execute background blockchain transaction pipeline sweeps on successful user mount
        void checkAndRecoverPiTransactions();
      }
      userDataLoadedRef.current = true;
      setUserDataLoaded(true);
    } catch (error: any) {
      console.warn("[fetchUser] Pipeline fallback triggered due to network environment:", error.message || error);
      setUser({
        id: "sandbox-fallback-uuid",
        name: fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
        email: email,
        balance: 0,
        piBalance: 0,
        phone: "",
        role: "user",
        roles: ["user"],
        pinHash: null,
        pinLength: null,
        piUid: null,
        piUsername: null,
        piWalletAddress: null,
      });
      setIsAuthenticated(true);
      userDataLoadedRef.current = true;
      setUserDataLoaded(true);
    }
  };

  // --- 2. SESSION INITIALIZATION ---
  useEffect(() => {
    const storedTheme = readStorage("theme");
    const applyTheme = () => {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldUseDark = storedTheme === "dark" || (storedTheme !== "light" && prefersDark);
      document.documentElement.classList.toggle("dark", shouldUseDark);
    };

    applyTheme();

    const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const handleChange = () => {
      if (readStorage("theme") === "system") applyTheme();
    };

    if (media?.addEventListener) media.addEventListener("change", handleChange);

    let cancelled = false;
    let splashTimeout: ReturnType<typeof setTimeout> | null = null;

    const loadNightSky = async () => {
      const now = new Date();
      const nightKey = getNightKey(now);
      if (!nightKey) {
        setIsNightSky(false);
        setShowLearn(false);
        return;
      }
      setIsNightSky(true);
      setConstellation(pickConstellationForNight(nightKey));
      setMoonPhase(getLocalMoonPhase(now));

      try {
        const { data, error } = await supabase.functions.invoke("moon-phase", { body: { location: "Lagos" } });
        if (!cancelled && data?.imageUrl && !error) setMoonImageUrl(data.imageUrl);
      } catch {
        if (!cancelled) setMoonImageUrl(null);
      }
    };

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user.email) {
          await fetchUser(session.user.email);
        } else {
          userDataLoadedRef.current = true;
          setUserDataLoaded(true);
        }
      } catch (error) {
        console.warn("[App] Unable to load session:", error);
        userDataLoadedRef.current = true;
        setUserDataLoaded(true);
      }
    };

    const closeSplash = () => {
      if (!cancelled) {
        setSplashDelayDone(true);
        if (!learnHoldRef.current) setIsSplashScreen(false);
      }
    };

    const run = async () => {
      const nightKey = getNightKey(new Date());
      const isNight = !!nightKey;
      const start = Date.now();

      userDataLoadedRef.current = false;
      await Promise.allSettled([initSession(), loadNightSky()]);

      const startWait = Date.now();
      const maxWait = 2000;
      while (!userDataLoadedRef.current && Date.now() - startWait < maxWait) {
        await new Promise((r) => setTimeout(r, 50));
      }

      const minDelay = isNight ? 600 : 0;
      const elapsed = Date.now() - start;
      if (minDelay > elapsed) await new Promise((r) => setTimeout(r, minDelay - elapsed));

      closeSplash();
    };

    run();

    splashTimeout = setTimeout(() => {
      if (!cancelled) {
        setSplashDelayDone(true);
        setIsSplashScreen(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user.email) {
        await fetchUser(session.user.email);
        setShowAuthScreen(false);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        userDataLoadedRef.current = true;
        setUserDataLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      if (splashTimeout) clearTimeout(splashTimeout);
      subscription.unsubscribe();
      if (media?.removeEventListener) media.removeEventListener("change", handleChange);
    };
  }, []);

  const handleTabChange = (tab: "buy" | "history" | "assistant" | "profile") => {
    if (tab === "buy" && activeTab === "buy") {
      setDashboardResetKey((prev) => prev + 1);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const custom = event as CustomEvent<{ tab?: "buy" | "history" | "assistant" | "profile" }>;
      const tab = custom?.detail?.tab;
      if (!tab) return;
      handleTabChange(tab);
    };

    window.addEventListener("swifna:navigate", handleNavigate as EventListener);
    return () => window.removeEventListener("swifna:navigate", handleNavigate as EventListener);
  }, [activeTab]);

  const { showToast } = useToast();
  const guestUser = useMemo(() => ({
    id: "", name: "Guest User", email: "guest@swifna.local", balance: 0, piBalance: 0, phone: "", role: "guest", roles: [] as string[], pinHash: null, pinLength: null
  }), []);

  const currentUser = user || guestUser;
  const promptAuth = () => setShowAuthScreen(true);

  const handleLogin = async (email: string, pass: string, piData?: { uid: string; username: string }) => {
    setIsProcessing(true);
    try {
      await dbService.loginUser(email, pass);
      if (piData) {
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        if (sessionUser) {
          try {
            await supabase.from("profiles").update({ pi_uid: piData.uid, pi_username: piData.username }).eq("id", sessionUser.id);
          } catch (dbErr) {
            console.warn("Profile mapping skipped inside restrictive browser sandbox frame", dbErr);
          }
          await fetchUser(email);
          showToast(`Account linked to Pi user @${piData.username}!`, "success");
        }
      }
    } catch (e: any) {
      showToast(e.message || "Login Failed", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePiLogin = async (accessToken: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pi-auth-verify", { body: { accessToken } });
      if (error || !data?.success) throw new Error(data?.error || "Pi authentication runtime connection dropped.");

      if (data.linked && data.link) {
        window.location.href = data.link;
        return { success: true };
      }
      return data;
    } catch (e: any) {
      showToast(e.message || "Pi Authentication Failed", "error");
      return { success: false };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignup = async (email: string, firstName: string, lastName: string, phone: string, preferredLanguage: string, pass: string, piData?: { uid: string; username: string }) => {
    setIsProcessing(true);
    try {
      await dbService.registerUser(email, firstName, lastName, phone, preferredLanguage as LanguageCode, pass);
      setLanguage(preferredLanguage as LanguageCode);

      if (piData) {
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        if (sessionUser) {
          try {
            await supabase.from("profiles").update({ pi_uid: piData.uid, pi_username: piData.username }).eq("id", sessionUser.id);
          } catch (dbErr) {
            console.warn("Profile lookup mapping matrix drop out handler:", dbErr);
          }
        }
      }
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
      throw e;
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      handleTabChange("buy");
    }
  };

  const handleUpdateUser = async (updatedData: any) => {
    setUser((prevUser: any) => ({ ...prevUser, ...updatedData }));
  };

  const onUpdateBalance = (newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, balance: newBalance } : prev));
  };

  const onUpdatePiBalance = (newPiBalance: number) => {
    setUser((prev) => (prev ? { ...prev, piBalance: newPiBalance } : prev));
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  };

  const ensurePushSubscription = async (userId: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") return;
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidPublicKey) return;

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await supabase.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, updated_at: new Date().toISOString() },
        { onConflict: "endpoint" }
      );
    } catch (pushErr) {
      console.warn("Service worker notification matrix registration fault:", pushErr);
    }
  };

  useEffect(() => {
    writeStorage("language", language);
  }, [language]);

  useEffect(() => {
    if (!user?.id || user.id === "sandbox-fallback-uuid" || pushReady) return;
    ensurePushSubscription(user.id).finally(() => setPushReady(true));
  }, [user?.id, pushReady]);

  // SEO Management Loop Hooks
  useEffect(() => {
    const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin;
    const organization = { "@context": "https://schema.org", "@type": "Organization", name: "Swifna", url: siteUrl, logo: `${siteUrl}/logo.png` };
    const website = { "@context": "https://schema.org", "@type": "WebSite", name: "Swifna", url: siteUrl };

    let page = { title: "Swifna | Buy Cheap Data", description: "Buy affordable bundles instantly", path: "/", keywords: "cheap data nigeria" };
    let robots = "index,follow,max-image-preview:large";

    if (showAuthScreen && !isAuthenticated) {
      page = { title: "Login or Sign Up | Swifna", description: "Authenticate into your account workspace.", path: "/auth", keywords: "login" };
      robots = "noindex,nofollow";
    }

    applySeo({
      title: page.title,
      description: page.description,
      keywords: page.keywords,
      canonicalUrl: `${siteUrl}${page.path}`,
      robots,
      ogType: "website",
      jsonLd: [organization, website],
    });
  }, [activeTab, dashboardSeoView, isAuthenticated, showAuthScreen]);

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
      <BroadcastManager />

      {isSplashScreen ? (
        <div className={`min-h-screen flex flex-col items-center justify-center text-white relative overflow-hidden ${isNightSky ? "bg-slate-950" : "bg-emerald-600"}`}>
          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <img src="/logo.png" alt="Swifna Logo" className="w-20 h-20 mb-4" />
            <h1 className="text-4xl font-black tracking-tighter">Swifna</h1>
            <p className="mt-2 text-sm italic font-semibold text-emerald-100 dark:text-slate-400">Airtime, Data, Bills — Sorted.</p>

            {isNightSky && (
              <div className="mt-6 w-full max-w-sm rounded-2xl bg-[#151A21] border border-white/5 p-4 text-left">
                <p className="text-xs font-bold uppercase text-slate-400">Tonight’s Sky: <span className="text-white block font-semibold text-sm mt-0.5">{constellation}</span></p>
                <button onClick={() => { setShowLearn(!showLearn); learnHoldRef.current = !showLearn; if (showLearn && splashDelayDone) setIsSplashScreen(false); }} className="mt-4 h-12 w-full rounded-xl bg-emerald-600 text-white text-sm font-semibold">Toggle Constellation Coordinates</button>
              </div>
            )}
          </div>
        </div>
      ) : showAuthScreen && !isAuthenticated ? (
        <div className="relative min-h-screen bg-slate-50 dark:bg-slate-900">
          <button onClick={() => setShowAuthScreen(false)} className="absolute top-4 left-4 z-10 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-[10px] font-black uppercase">Continue as guest</button>
          <Suspense fallback={pageFallback}>
            <Auth onLogin={handleLogin} onSignup={handleSignup} onForgotPassword={handleForgotPassword} onPiLogin={handlePiLogin} isProcessing={isProcessing} />
          </Suspense>
        </div>
      ) : (
        <DashboardLayout activeTab={activeTab} setActiveTab={handleTabChange} userName={currentUser.name} userAvatar={(user as any)?.avatar_url || null}>
          {showPinSetup && isAuthenticated && user && !user.pinHash && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-[#151A21] p-5 border border-white/5 text-white">
                <h3 className="text-sm font-bold mb-1">Set Transaction Security PIN</h3>
                <p className="text-xs text-slate-400 mb-4">Create a PIN to secure your withdrawals and utility transactions instantly.</p>
                <div className="flex gap-2">
                  <button onClick={() => { setShowPinSetup(false); handleTabChange("profile"); }} className="flex-1 h-11 bg-emerald-600 rounded-xl text-xs font-bold uppercase">Set PIN</button>
                  <button onClick={() => setShowPinSetup(false)} className="flex-1 h-11 border border-white/5 rounded-xl text-xs font-bold text-slate-400 uppercase">Later</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "buy" && (
            <Suspense fallback={pageFallback}>
              <Dashboard key={dashboardResetKey} user={currentUser} onUpdateBalance={onUpdateBalance} onUpdatePiBalance={onUpdatePiBalance} isGuest={!isAuthenticated} onRequireAuth={promptAuth} onViewChange={setDashboardSeoView} />
            </Suspense>
          )}

          {activeTab === "history" && (
            <Suspense fallback={pageFallback}>
              <History />
            </Suspense>
          )}

          {activeTab === "assistant" && (
            <Suspense fallback={pageFallback}>
              <Assistant user={currentUser} />
            </Suspense>
          )}

          {activeTab === "profile" && isAuthenticated && user && (
            <Suspense fallback={pageFallback}>
              <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
            </Suspense>
          )}

          {activeTab === "profile" && !isAuthenticated && (
            <div className="min-h-[60vh] flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white dark:bg-slate-800 border rounded-2xl p-6 text-center">
                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase">Guest Mode</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Authenticate your credentials to view profile configurations.</p>
                <button onClick={() => setShowAuthScreen(true)} className="w-full h-12 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-wide text-xs">Login / Sign Up</button>
              </div>
            </div>
          )}
        </DashboardLayout>
      )}
    </I18nProvider>
  );
};

const AppWithProviders: React.FC = () => (
  <ToastProvider>
    <SuccessScreenProvider>
      <App />
    </SuccessScreenProvider>
  </ToastProvider>
);

export default AppWithProviders;