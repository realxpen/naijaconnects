import React, { useState, useEffect } from "react";
import {
  Zap,
  User as UserIcon,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  Loader2,
  Smartphone,
  Receipt,
  Globe,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { useI18n } from "../i18n";
import { LANGUAGES } from "../constants";
import { useToast } from "../components/ui/ToastProvider";
import { authenticatePiUser } from "../services/piNetworkService";

interface AuthProps {
  onLogin: (
    email: string,
    pass: string,
    piData?: { uid: string; username: string },
  ) => Promise<void>;
  onSignup: (
    email: string,
    firstName: string,
    lastName: string,
    phone: string,
    preferredLanguage: string,
    pass: string,
    piData?: { uid: string; username: string },
  ) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onPiLogin: (accessToken: string) => Promise<any>; // Changed to return the backend response data
  isProcessing: boolean;
}

const Auth: React.FC<AuthProps> = ({
  onLogin,
  onSignup,
  onForgotPassword,
  onPiLogin,
  isProcessing,
}) => {
  const { t, language } = useI18n();
  const { showToast } = useToast();
  const [view, setView] = useState<"login" | "signup" | "forgot-password">(
    "login",
  );
  const [isPiBrowser, setIsPiBrowser] = useState(false);
  const [piAuthStep, setPiAuthStep] = useState<
    "idle" | "initializing" | "verifying" | "success" | "error"
  >("idle");
  const [piAuthError, setPiAuthError] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // 💾 State moved inside the component body where it belongs
  const [pendingPiData, setPendingPiData] = useState<{
    uid: string;
    username: string;
  } | null>(null);

  const runAutoPiAuth = async () => {
    setPiAuthStep("initializing");
    setPiAuthError(null);
    try {
      const auth = await authenticatePiUser();
      setPiAuthStep("verifying");

      if (auth?.accessToken) {
        // 📡 Wait for App.tsx to talk to your Supabase verification Edge function
        const response = await onPiLogin(auth.accessToken);

        // Check what the server response states
        if (response && response.success) {
          if (response.linked === false) {
            // 🔗 Account is NOT linked! Save the user details
            setPendingPiData(response.piUser);

            // Turn off the full-screen lavender loading state immediately
            setPiAuthStep("idle");

            showToast(
              `Pi verified! Please log in or sign up to connect your @${response.piUser.username} account.`,
              "info",
            );
          } else if (response.link) {
            // ✨ Account IS linked! Transition to success state and forward to Supabase's native link handler
            setPiAuthStep("success");

            console.log("[Auth] Session initialized. Redirecting via native link gateway...");
            window.location.href = response.link;
          }
        } else {
          throw new Error(
            "Authentication verification rejected by backend server.",
          );
        }
      } else {
        throw new Error("No access token returned from Pi SDK.");
      }
    } catch (err: any) {
      console.warn("Pi Auth failed:", err);
      setPiAuthStep("error");
      setPiAuthError(
        err.message || "Pi Authentication failed. Please confirm permissions.",
      );
    }
  };

  // Check if we are inside Pi Browser and handle silent auto-login transitions
  // 🧭 Simply detect the Pi Browser environment without forcing an auto-login loop
  useEffect(() => {
    const isPi =
      typeof window !== "undefined" &&
      (!!window.Pi || navigator.userAgent.toLowerCase().includes("pibrowser"));
    setIsPiBrowser(isPi);
  }, []);

  const handlePiLoginClick = async () => {
    const isPi =
      typeof window !== "undefined" &&
      (!!window.Pi || navigator.userAgent.toLowerCase().includes("pibrowser"));
    if (isPi) {
      setIsPiBrowser(true);
      await runAutoPiAuth();
    } else {
      setShowCopyModal(true);
    }
  };

  const handleCopyLink = () => {
    const link = window.location.origin;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        showToast(
          "App link copied to clipboard! Paste it inside Pi Browser search bar.",
          "info",
        );
      })
      .catch(() => {
        showToast(
          "Could not copy link automatically. Please select and copy manually.",
          "error",
        );
      });
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<string>(language);
  const [activeSlide, setActiveSlide] = useState(0);

  // New state for password visibility
  const [showPassword, setShowPassword] = useState(false);

  const slides = [
    {
      title: "Everything You Pay For. One Smart App.",
      desc: "Buy cheap data, airtime, pay bills, and make online payments — all from one secure wallet.",
      icon: <Zap className="w-12 h-12 text-yellow-400 fill-yellow-400" />,
      tag: "Fast • Reliable • Naija-Built",
    },
    {
      title: "Cheap Data & Airtime That Just Works",
      desc: "Top up MTN, Airtel, Glo & 9mobile instantly. No delays. No hidden charges.",
      icon: <Smartphone className="w-12 h-12 text-emerald-400" />,
      tag: "Best VTU Rates",
    },
    {
      title: "Pay Bills in Seconds",
      desc: "Electricity, DSTV, GOTV & Startimes — handle your home needs without leaving your couch.",
      icon: <Receipt className="w-12 h-12 text-blue-400" />,
      tag: "24/7 Availability",
    },
    {
      title: "Pay Online Without Stress",
      desc: "Get virtual dollar cards for Netflix, Spotify, AWS, and international shopping.",
      icon: <Globe className="w-12 h-12 text-purple-400" />,
      tag: "USD Virtual Cards",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (view === "login") {
        // ➕ Forward the hidden Pi data if we are pairing accounts during a login
        await onLogin(email, password, pendingPiData || undefined);
      } else if (view === "signup") {
        // ➕ Forward the hidden Pi data if we are pairing accounts during registration
        await onSignup(
          email,
          firstName,
          lastName,
          phone,
          preferredLanguage,
          password,
          pendingPiData || undefined,
        );
        showToast(t("auth.alert.account_created"), "success");
        setView("login");
        setPassword("");
      } else if (view === "forgot-password") {
        await onForgotPassword(email);
        showToast(t("auth.alert.reset_link_sent"), "success");
        setView("login");
      }
    } catch (err: any) {
      showToast(err.message || t("auth.alert.generic_error"), "error");
    }
  };

  const getTitle = () => {
    if (view === "login") return t("auth.title.login");
    if (view === "signup") return t("auth.title.signup");
    return t("auth.title.reset");
  };

  const getButtonText = () => {
    if (isProcessing) return <Loader2 className="animate-spin" />;
    if (view === "login") return t("auth.button.sign_in");
    if (view === "signup") return t("auth.button.create_account");
    return t("auth.button.send_reset");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-slate-950 font-sans">
      {/* LEFT: DYNAMIC MARKETING CAROUSEL */}
      <div className="lg:w-1/2 bg-emerald-700 p-8 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden min-h-[40vh] lg:min-h-screen">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-400 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-30" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <div className="bg-yellow-400 p-2 rounded-xl shadow-lg">
              <Zap className="w-6 h-6 text-emerald-900 fill-emerald-900" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase">
              Swifna
            </h1>
          </div>

          <div className="relative h-64 lg:h-80">
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-all duration-700 ease-in-out transform ${i === activeSlide ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-800 text-yellow-400 text-[10px] font-black tracking-widest uppercase border border-emerald-600">
                    {slide.tag}
                  </span>
                </div>
                <div className="mb-6">{slide.icon}</div>
                <h2 className="text-3xl lg:text-5xl font-black mb-4 leading-[1.1] tracking-tight">
                  {slide.title}
                </h2>
                <p className="text-emerald-50 text-base lg:text-lg max-w-md font-medium opacity-80 leading-relaxed">
                  {slide.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4 mt-8">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === activeSlide ? "w-10 bg-yellow-400" : "w-2 bg-emerald-900"}`}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest animate-pulse flex items-center gap-1">
            {t("auth.swipe_explore")} <ChevronRight size={12} />
          </span>
        </div>
      </div>

      {/* RIGHT: AUTH FORM SECTION */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Sparkles size={12} /> {t("auth.secure_access")}
            </div>
            <h2 className="text-3xl lg:text-4xl font-black dark:text-white tracking-tight">
              {getTitle()}
            </h2>
            {view === "forgot-password" && (
              <p className="text-slate-400 text-sm mt-2">
                {t("auth.reset_hint")}
              </p>
            )}
          </div>

          {isPiBrowser &&
            view === "login" &&
            (piAuthStep === "initializing" ||
              piAuthStep === "verifying" ||
              piAuthStep === "success" ||
              piAuthStep === "error") ? (
            <div className="bg-white dark:bg-slate-950 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl text-center space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 bg-yellow-400 rounded-full opacity-10 animate-ping duration-1000"></div>
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-yellow-500 to-amber-400 p-1 shadow-lg flex items-center justify-center">
                  <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-black text-yellow-400 text-3xl">
                    π
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-850 dark:text-white">
                  Pi Browser Detected
                </h3>
                {piAuthStep === "initializing" && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                    <Loader2
                      className="animate-spin text-yellow-500"
                      size={16}
                    />
                    Connecting with Pi Network...
                  </p>
                )}
                {piAuthStep === "verifying" && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                    <Loader2
                      className="animate-spin text-yellow-500"
                      size={16}
                    />
                    Verifying credentials...
                  </p>
                )}
                {piAuthStep === "success" && (
                  <p className="text-sm text-emerald-500 font-bold flex items-center justify-center gap-2">
                    ✓ Authenticated! Logging in...
                  </p>
                )}
                {piAuthStep === "error" && (
                  <div className="space-y-4">
                    <p className="text-xs text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                      {piAuthError || "Failed to authenticate automatically."}
                    </p>
                    <button
                      type="button"
                      onClick={runAutoPiAuth}
                      className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-slate-900 font-black rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} /> Retry Connection
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsPiBrowser(false)}
                  className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-wider"
                >
                  Use Email / Password instead
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 🔗 Pi Account Link Notification Banner */}
              {pendingPiData && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-900/40 p-4 rounded-2xl space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
                    <Sparkles
                      size={14}
                      className="animate-spin text-amber-500"
                      style={{ animationDuration: "3s" }}
                    />
                    Pi Profile Confirmed
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                    Authenticated successfully as{" "}
                    <strong className="text-slate-900 dark:text-white">
                      @{pendingPiData.username}
                    </strong>
                    . Fill out the form below to connect this Pi identity
                    directly to your wallet profile!
                  </p>
                </div>
              )}
              {/* FIRST NAME INPUT (Signup Only) */}
              {view === "signup" && (
                <div className="relative animate-in slide-in-from-bottom-2">
                  <UserIcon
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    required
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm"
                  />
                </div>
              )}
              {/* LAST NAME INPUT (Signup Only) */}
              {view === "signup" && (
                <div className="relative animate-in slide-in-from-bottom-2">
                  <UserIcon
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Last Name (optional)"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm"
                  />
                </div>
              )}

              {/* PHONE INPUT (Signup Only) */}
              {view === "signup" && (
                <div className="relative animate-in slide-in-from-bottom-2">
                  <Smartphone
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="tel"
                    required
                    placeholder={t("auth.phone")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm"
                  />
                </div>
              )}

              {/* LANGUAGE INPUT (Signup Only) */}
              {view === "signup" && (
                <div className="relative animate-in slide-in-from-bottom-2">
                  <Globe
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <select
                    required
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    aria-label={t("auth.preferred_language")}
                    className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm appearance-none"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* EMAIL INPUT */}
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="email"
                  required
                  placeholder={t("auth.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              {/* PASSWORD INPUT (WITH TOGGLE) */}
              {view !== "forgot-password" && (
                <div className="relative animate-in slide-in-from-bottom-2">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder={t("auth.password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm"
                  />
                  {/* TOGGLE BUTTON */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}

              {/* FORGOT PASSWORD LINK */}
              {view === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-wide"
                  >
                    {t("auth.forgot_password")}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-200 dark:shadow-none uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all mt-6 text-sm"
              >
                {getButtonText()}
              </button>

              {view === "login" && (
                <>
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-850"></div>
                    <span className="mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Or
                    </span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-855"></div>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handlePiLoginClick}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 dark:shadow-none uppercase tracking-widest flex justify-center items-center gap-2 active:scale-95 transition-all text-sm"
                  >
                    <Sparkles
                      size={18}
                      className="text-yellow-300 animate-pulse"
                    />
                    Sign In with Pi Network
                  </button>
                </>
              )}
            </form>
          )}

          {/* BOTTOM NAVIGATION LINKS */}
          <div className="mt-8 text-center flex flex-col gap-4">
            {view === "forgot-password" ? (
              <button
                onClick={() => setView("login")}
                className="text-emerald-600 font-black uppercase text-[10px] tracking-[0.15em] hover:underline flex items-center justify-center gap-2"
              >
                <ArrowLeft size={12} /> {t("auth.back_to_login")}
              </button>
            ) : (
              <button
                onClick={() => setView(view === "login" ? "signup" : "login")}
                className="text-emerald-600 font-black uppercase text-[10px] tracking-[0.15em] hover:underline"
              >
                {view === "login"
                  ? t("auth.switch_to_signup")
                  : t("auth.switch_to_login")}
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-slate-400">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {t("auth.bank_grade_security")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* COPY LINK MODAL FOR NON-PI BROWSER */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-950/30 px-3 py-1 rounded-full text-yellow-600 dark:text-yellow-400 text-[10px] font-black uppercase tracking-wider">
                <Sparkles size={12} className="animate-pulse" /> Pi Browser
                Required
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                title="Close copy link modal"
                aria-label="Close copy link modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-center lg:text-left">
              <h3 className="text-xl font-black dark:text-white tracking-tight">
                Open inside Pi Browser
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                To access Swifna via the Pi Network and authenticate seamlessly,
                copy this app link and paste it into the search bar inside your
                Pi Browser.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="App Link"
                  value={window.location.origin}
                  className="flex-grow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Step-by-Step Guide:
              </h4>
              <ol className="space-y-3 text-xs text-slate-500 dark:text-slate-400 font-semibold list-decimal list-inside">
                <li>
                  Click the{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    Copy
                  </strong>{" "}
                  button above to copy the link.
                </li>
                <li>
                  Launch the official{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    Pi Network Browser
                  </strong>{" "}
                  on your mobile phone.
                </li>
                <li>
                  Paste the copied link in the URL search bar at the top of the
                  Pi Browser.
                </li>
                <li>Swifna will load, and you will sign in automatically!</li>
              </ol>
            </div>

            <button
              onClick={() => setShowCopyModal(false)}
              className="w-full py-4 bg-slate-900 dark:bg-slate-850 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
