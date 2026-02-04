import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone, Tv, Zap, ArrowRight, ArrowLeftRight, X, Loader2,
  RotateCcw, TrendingUp, TrendingDown, CreditCard, GraduationCap, 
  Printer, Building2, CheckCircle2, Share2, Download, Copy,
  Image as ImageIcon, FileText, Activity
} from "lucide-react";
import { supabase } from "../supabaseClient";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useI18n } from "../i18n";
import { useToast } from "../components/ui/ToastProvider";

// --- SERVICE COMPONENTS ---
import Airtime from "../components/services/Airtime";
import DataBundle from "../components/services/DataBundle";
import CableTv from "../components/services/CableTv";
import Electricity from "../components/services/Electricity";
import Exams from "../components/services/Exams";
import RechargePin from "../components/services/RechargePin";
import AirtimeToCash from "../components/services/AirtimeToCash";

// --- LOGO IMPORTS (Ensure paths match your project structure) ---
import mtnLogo from '../assets/logos/mtn.png';
import gloLogo from '../assets/logos/glo.png';
import airtelLogo from '../assets/logos/airtel.png';
import t2mobileLogo from '../assets/logos/t2mobile.png'; 
import smileLogo from '../assets/logos/smile.png';
import waecLogo from '../assets/logos/waec.png';
import necoLogo from '../assets/logos/neco.png';
import dstvLogo from '../assets/logos/dstv.png';
import gotvLogo from '../assets/logos/gotv.png';
import startimesLogo from '../assets/logos/startimescable.png';
import showmaxLogo from '../assets/logos/showmax.png';
import ikejaLogo from '../assets/logos/ikedc.png';
import ekoLogo from '../assets/logos/eko.png';
import abujaLogo from '../assets/logos/abuja.png';
import kanoLogo from '../assets/logos/kano.png';
import portharcourtLogo from '../assets/logos/portharcourt.png';
import josLogo from '../assets/logos/jos_jed.png';
import ibedcLogo from '../assets/logos/ibedc.png';
import kadunaLogo from '../assets/logos/kaduna.png';
import enuguLogo from '../assets/logos/enugu.png';
import beninLogo from '../assets/logos/benin.png';
import yolaLogo from '../assets/logos/yola.png';
import abaLogo from '../assets/logos/aba.png';
import jambLogo from '../assets/logos/jamb.png';

// --- INTERFACES ---
interface DashboardProps {
  user: { name: string; email: string; balance: number; phone?: string };
  onUpdateBalance: (newBalance: number) => void;
  activeTab?: string; 
}

interface Transaction {
  id: number;
  created_at: string;
  type: string;
  amount: number;
  status: string;
  ref?: string;
  reference?: string;
  request_id?: string;
  description?: string; 
  meta?: any; 
}

type ViewState = "Dashboard" | "Airtime" | "Data" | "Cable" | "Electricity" | "Exam" | "RechargePin" | "AirtimeToCash";

// --- HELPER: GET LOGO ---
const getLogoOrIcon = (transaction: Transaction) => {
    const desc = (transaction.description || "").toUpperCase();
    const type = (transaction.type || "").toUpperCase();
    const combined = desc + " " + type; 

    // Images
    if (combined.includes("MTN")) return <img src={mtnLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("GLO")) return <img src={gloLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("AIRTEL")) return <img src={airtelLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("9MOBILE") || combined.includes("T2MOBILE")) return <img src={t2mobileLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("SMILE")) return <img src={smileLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("DSTV")) return <img src={dstvLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("GOTV")) return <img src={gotvLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("STARTIMES")) return <img src={startimesLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("SHOWMAX")) return <img src={showmaxLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("IKEJA") || combined.includes("IKEDC")) return <img src={ikejaLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("EKO") || combined.includes("EKEDC")) return <img src={ekoLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("ABUJA") || combined.includes("AEDC")) return <img src={abujaLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("KANO") || combined.includes("KEDCO")) return <img src={kanoLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("PORT") || combined.includes("PHED")) return <img src={portharcourtLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("JOS") || combined.includes("JED")) return <img src={josLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("IBADAN") || combined.includes("IBEDC")) return <img src={ibedcLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("KADUNA") || combined.includes("KAEDCO")) return <img src={kadunaLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("ENUGU") || combined.includes("EEDC")) return <img src={enuguLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("BENIN") || combined.includes("BEDC")) return <img src={beninLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("YOLA") || combined.includes("YEDC")) return <img src={yolaLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("ABA") || combined.includes("APLE")) return <img src={abaLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("WAEC")) return <img src={waecLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("NECO")) return <img src={necoLogo} className="w-full h-full object-contain rounded-full" />;
    if (combined.includes("JAMB")) return <img src={jambLogo} className="w-full h-full object-contain rounded-full" />;

    // Fallback Icons
    switch(transaction.type) {
        case 'Airtime': return <Smartphone size={18} />;
        case 'Data': return <Zap size={18} />;
        case 'Cable': return <Tv size={18} />;
        case 'Electricity': return <Zap size={18} />;
        case 'Exam': return <GraduationCap size={18} />;
        case 'RechargePin': return <Printer size={18} />;
        case 'Deposit': return <ArrowRight size={18} className="rotate-45" />;
        case 'Withdrawal': return <ArrowRight size={18} className="-rotate-45" />;
        case 'AirtimeToCash': return <ArrowLeftRight size={18} />;
        default: return <Activity size={18} />;
    }
};

// --- COMPONENT: RECEIPT VIEW ---
const ReceiptView = ({ tx, onClose }: { tx: Transaction; onClose: () => void }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  
    const displayRef = tx.ref || tx.reference || tx.request_id || `TRX-${tx.id}`;
  
    // CSS for jagged edge
    const serratedEdgeStyle = {
      background: "linear-gradient(45deg, transparent 50%, #ffffff 50%), linear-gradient(-45deg, transparent 50%, #ffffff 50%)",
      backgroundSize: "20px 20px",
      backgroundRepeat: "repeat-x",
      backgroundPosition: "bottom",
      height: "20px",
      width: "100%",
      position: "absolute" as "absolute",
      bottom: "-20px",
      left: "0",
      filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.05))"
    };
  
    const generateImage = async (): Promise<Blob | null> => {
      if (!receiptRef.current) return null;
      try {
        const canvas = await html2canvas(receiptRef.current, {
          backgroundColor: null,
          scale: 3, 
          logging: false,
          useCORS: true 
        });
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      } catch (error) {
        console.error("Receipt generation failed", error);
        return null;
      }
    };
  
    const handleShare = async () => {
      setIsGenerating(true);
      const blob = await generateImage();
      if (blob) {
        const file = new File([blob], `receipt_${displayRef}.png`, { type: 'image/png' });
        if (navigator.share) {
          try {
            await navigator.share({
              title: t("dashboard.receipt_title"),
              text: t("dashboard.receipt_for", { type: tx.type, amount: tx.amount.toLocaleString() }),
              files: [file]
            });
          } catch (e) { console.log("Share skipped"); }
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt_${displayRef}.png`;
            a.click();
        }
      }
      setIsGenerating(false);
    };
  
    const handleSaveImage = async () => {
      setIsGenerating(true);
      const blob = await generateImage();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${displayRef}.png`;
        a.click();
        setSaveMenuOpen(false);
      }
      setIsGenerating(false);
    };
  
    const handleSavePDF = async () => {
      setIsGenerating(true);
      if (!receiptRef.current) return;
      try {
        const canvas = await html2canvas(receiptRef.current, { scale: 3 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [80, 150] 
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`receipt_${displayRef}.pdf`);
        setSaveMenuOpen(false);
      } catch (e) { showToast(t("dashboard.error_generating_pdf"), "error"); }
      setIsGenerating(false);
    };

    const handleCopyRef = () => {
        navigator.clipboard.writeText(displayRef).then(() => {
            showToast(t("dashboard.reference_copied"), "success");
        });
    };
  
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-full max-w-sm relative flex flex-col items-center">
          
          <button onClick={onClose} className="absolute -top-12 right-0 bg-white/20 hover:bg-white/30 p-2 rounded-full text-white transition-colors">
            <X size={20}/>
          </button>
  
          <div className="relative w-full mb-6">
            <div ref={receiptRef} className="bg-white relative shadow-2xl mx-auto w-full text-slate-800 rounded-t-2xl">
              
              {/* Header */}
              <div className="p-6 pb-4 text-center border-b border-dashed border-slate-300">
                <div className="flex justify-center mb-3">
                   <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-emerald-200 shadow-lg">
                       <Zap size={24} fill="currentColor" />
                   </div>
                </div>
                
                <h2 className="text-3xl font-black text-slate-900 mt-2">
                  ₦{tx.amount.toLocaleString()}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t("dashboard.total_amount")}</p>
                
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${tx.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {tx.status === 'Success' ? <CheckCircle2 size={12} strokeWidth={3}/> : <X size={12} strokeWidth={3}/>}
                  <span>{tx.status}</span>
                </div>
              </div>
  
              {/* Details */}
              <div className="p-6 pt-5 space-y-4 bg-slate-50/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("common.service")}</span>
                  <div className="flex items-center gap-2 text-right">
                     <span className="text-sm font-black text-slate-700">{tx.type}</span>
                     <div className="w-6 h-6 rounded-full border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                        <div className="w-4 h-4">{getLogoOrIcon(tx)}</div>
                     </div>
                  </div>
                </div>
  
                <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("common.date")}</span>
                  <span className="text-xs font-black text-slate-700 text-right">
                    {new Date(tx.created_at).toLocaleString('en-NG', { 
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' 
                    })}
                  </span>
                </div>
  
                <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("common.ref_id")}</span>
                  <button onClick={handleCopyRef} className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded hover:bg-emerald-100 hover:text-emerald-700 transition-colors">
                    {displayRef} <Copy size={10}/>
                  </button>
                </div>
  
                {(tx.description || tx.user_email) && (
                  <div className="flex justify-between items-start border-b border-dashed border-slate-200 pb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("common.desc")}</span>
                    <span className="text-xs font-bold text-slate-700 text-right max-w-[150px] leading-tight">
                      {tx.description || tx.type}
                    </span>
                  </div>
                )}
  
                {/* TOKEN / PIN DISPLAY */}
                {(tx.meta?.pin || tx.meta?.token) && (
                  <div className="mt-2 bg-slate-800 text-white p-3 rounded-xl text-center relative overflow-hidden shadow-inner">
                     <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                       {tx.type === 'Electricity' ? t("common.token") : t("common.pin")}
                     </p>
                     <p className="text-lg font-mono font-black tracking-[0.2em] select-all">
                       {tx.meta.pin || tx.meta.token}
                     </p>
                  </div>
                )}
              </div>
  
              {/* Footer */}
              <div className="bg-white p-4 text-center pb-8 rounded-b-2xl">
                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                  {t("dashboard.generated_by")}
                </p>
              </div>
  
              {/* Serrated Bottom Edge */}
              <div style={serratedEdgeStyle}></div>
            </div>
          </div>
  
          {/* ACTION BUTTONS */}
          <div className="flex w-full gap-3 mt-2">
            <button 
              onClick={handleShare} 
              disabled={isGenerating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Share2 size={16}/>} {t("common.share")}
            </button>
            
            <div className="relative flex-1">
              <button 
                onClick={() => setSaveMenuOpen(!saveMenuOpen)}
                disabled={isGenerating} 
                className="w-full bg-white hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Download size={16}/> {t("common.save")}
              </button>
  
              {saveMenuOpen && (
                 <div className="absolute bottom-full right-0 left-0 mb-3 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-2 z-20">
                    <button onClick={handleSaveImage} className="w-full p-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                       <ImageIcon size={14} className="text-emerald-600"/> {t("common.save_image")}
                    </button>
                    <button onClick={handleSavePDF} className="w-full p-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center gap-3">
                       <FileText size={14} className="text-rose-600"/> {t("common.save_pdf")}
                    </button>
                 </div>
              )}
            </div>
          </div>
  
        </div>
      </div>
    );
  };


// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = ({ user, onUpdateBalance, activeTab }: DashboardProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [view, setView] = useState<ViewState>("Dashboard");
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<Transaction[]>([]);
  
  // Receipt & Modal States
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [currentTxRef, setCurrentTxRef] = useState<string>(`txn_${Date.now()}`);
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false);

  // Withdraw States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // --- DATA FETCHING ---
  const fetchUser = async () => {
    try {
      const { data } = await supabase.from("profiles").select("balance").eq("email", user.email).single();
      if (data) onUpdateBalance(data.balance);
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_email", user.email)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setHistory(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchHistory(); fetchUser(); }, [user.email]);

  // --- OPay VERIFY (DEPOSIT) ---
  const verifyDeposit = async (reference: string) => {
    setIsVerifyingDeposit(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-deposit", {
        body: { reference }
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Verification failed");

      if (typeof data.balance === "number") {
        onUpdateBalance(data.balance);
      } else {
        await fetchUser();
      }
      showToast(t("dashboard.wallet_funded"), "success");
      setIsDepositModalOpen(false);
      setDepositAmount("");
      setCurrentTxRef(`txn_${Date.now()}`);
      fetchHistory();
    } catch (e: any) {
      showToast(e.message || "Verification failed", "error");
    } finally {
      setIsVerifyingDeposit(false);
    }
  };

  const handleStartDeposit = () => {
    if (!depositAmount || Number(depositAmount) < 100) return showToast(t("dashboard.min_deposit"), "error");
    showToast("Starting payment...", "info");
    (async () => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Payment init timed out. Check Edge Function deployment.")), 15000)
        );
        const invoke = supabase.functions.invoke("initialize-deposit", {
          body: { email: user.email, amount: Number(depositAmount) }
        });
        const { data, error } = await Promise.race([invoke, timeout]);
        if (error) throw new Error(error.message);
        if (!data?.cashier_url) {
          showToast(`Init response: ${JSON.stringify(data || {})}`, "error", 6000);
          throw new Error("No cashier URL returned");
        }

        setCurrentTxRef(data.reference || currentTxRef);
        window.location.assign(data.cashier_url);
      } catch (e: any) {
        showToast(e.message || "Failed to start payment", "error");
      }
    })();
  };

  // --- WITHDRAW LOGIC ---
  const loadBanks = async () => {
    setIsLoadingBanks(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-transfer", {
        body: { action: "list_banks" }
      });
      if (error) throw new Error(error.message);
      const list = data?.data || [];
      setBanks(list.map((b: any) => ({ name: b.name, code: b.code })));
    } catch (e: any) {
      showToast(e.message || "Failed to load banks", "error");
    } finally {
      setIsLoadingBanks(false);
    }
  };

  const resolveAccount = async (acct: string, bank: string) => {
    if (acct.length !== 10 || !bank) return;
    setIsResolvingAccount(true);
    setAccountName("Resolving...");
    try {
      const { data, error } = await supabase.functions.invoke("paystack-transfer", {
        body: { action: "verify", account_number: acct, bank_code: bank }
      });
      if (error) throw new Error(error.message);
      if (!data?.status) throw new Error(data?.message || "Invalid account");
      setAccountName(data.data?.account_name || "Verified");
    } catch (e: any) {
      setAccountName("Invalid Account");
      showToast(e.message || "Invalid account", "error");
    } finally {
      setIsResolvingAccount(false);
    }
  };

  const handleWithdraw = async () => {
    const amountNum = Number(withdrawAmount);
    if (!amountNum || amountNum < 100) return showToast("Minimum withdraw is ₦100", "error");
    if (amountNum > user.balance) return showToast("Insufficient wallet balance", "error");
    if (!bankCode || accountNumber.length !== 10 || accountName.includes("Invalid")) {
      return showToast("Please enter valid bank details", "error");
    }

    setIsWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-transfer", {
        body: {
          action: "transfer",
          account_number: accountNumber,
          bank_code: bankCode,
          amount: amountNum,
          email: user.email
        }
      });
      if (error) throw new Error(error.message);
      if (!data?.status) throw new Error(data?.message || "Withdrawal failed");

      const reference = data?.data?.reference;
      if (reference) {
        try {
          const verifyRes = await supabase.functions.invoke("paystack-transfer", {
            body: { action: "verify_transfer", reference }
          });
          if (verifyRes.error) throw new Error(verifyRes.error.message);
          const transferStatus = verifyRes.data?.transfer_status;
          if (transferStatus === "success") {
            showToast("Withdrawal successful", "success");
          } else if (transferStatus === "failed" || transferStatus === "reversed") {
            showToast("Withdrawal failed or reversed", "error");
          } else {
            showToast("Withdrawal pending. We'll update shortly.", "info");
          }
        } catch {
          showToast("Withdrawal pending. You can verify later.", "info");
        }
      } else {
        showToast("Withdrawal initiated successfully", "success");
      }

      await fetchUser();
      fetchHistory();
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      setAccountNumber("");
      setBankCode("");
      setAccountName("");
    } catch (e: any) {
      showToast(e.message || "Withdrawal failed", "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // --- RENDER CONTENT ---
  const renderContent = () => {
    switch (view) {
      case "Airtime":
        return <Airtime user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} />;
      case "Data":
        return <DataBundle user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} />;
      case "Cable":
        return <CableTv user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} />;
      case "Electricity":
        return <Electricity user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} />;
      case "Exam":
        return <Exams user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} />;
      case "RechargePin":
        return <RechargePin user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} />;
      case "AirtimeToCash":
        return <AirtimeToCash user={user} onBack={() => setView("Dashboard")} />;
      default:
        return renderDashboardHome();
    }
  };

  const renderDashboardHome = () => (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* WALLET CARD */}
      <section className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5"></div>

        <div className="relative z-10">
            <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t("dashboard.available_balance")}</p>
            <button onClick={() => { setIsRefreshingBalance(true); fetchUser(); setTimeout(() => setIsRefreshingBalance(false), 1000); }} className="p-2 bg-emerald-700/50 rounded-full hover:bg-emerald-700 transition-colors">
                <RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""} />
            </button>
            </div>
            <h2 className="text-4xl font-black mb-6">₦{user.balance.toLocaleString()}</h2>
            <div className="flex gap-3">
            <button onClick={() => { setIsDepositModalOpen(true); setCurrentTxRef(`txn_${Date.now()}`); }} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors">
                <CreditCard size={16} /> {t("dashboard.fund")}
            </button>
            <button onClick={() => { setIsWithdrawModalOpen(true); if (banks.length === 0) loadBanks(); }} className="flex-1 bg-emerald-800/40 border border-emerald-400/30 text-emerald-100 py-4 rounded-2xl font-black text-xs uppercase hover:bg-emerald-800/60 transition-colors">
                {t("dashboard.withdraw")}
            </button>
            </div>
        </div>
      </section>

      {/* SERVICE GRID */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[
          { id: "Airtime", labelKey: "dashboard.airtime", icon: <Smartphone size={18} /> },
          { id: "Data", labelKey: "dashboard.data", icon: <Zap size={18} /> },
          { id: "Cable", labelKey: "dashboard.cable", icon: <Tv size={18} /> },
          { 
            id: "Electricity", 
            labelKey: "dashboard.electricity",
            icon: (
                <div className="relative">
                    <Building2 size={18} />
                    <Zap size={10} className="absolute -top-2 -right-1 text-yellow-500 fill-yellow-500" strokeWidth={3}/>
                </div>
            ) 
          },
          { id: "Exam", labelKey: "dashboard.exam", icon: <GraduationCap size={18} /> },
          { id: "RechargePin", labelKey: "dashboard.recharge_pin", icon: <Printer size={18} /> },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setView(s.id as ViewState)}
            className="flex flex-col items-center py-4 rounded-xl text-slate-400 hover:bg-white hover:text-emerald-600 hover:shadow-sm transition-all"
          >
            {s.icon} <span className="text-[9px] font-black uppercase mt-1">{t(s.labelKey)}</span>
          </button>
        ))}
      </div>

      <button onClick={() => setView("AirtimeToCash")} className="w-full p-5 rounded-[25px] flex items-center justify-between border-2 border-slate-100 bg-white hover:border-emerald-100 transition-colors group">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl group-hover:bg-orange-200 transition-colors"><ArrowLeftRight size={22} /></div>
          <div className="text-left">
            <h3 className="font-black text-sm uppercase text-slate-800">{t("dashboard.airtime_to_cash")}</h3>
            <p className="text-[10px] text-slate-400 font-bold">{t("dashboard.swap_airtime_for_cash")}</p>
          </div>
        </div>
        <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
      </button>

      {/* HISTORY (UPDATED WITH CLICKABLE RECEIPT) */}
      <div className="pt-2">
        <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-3 ml-2">{t("dashboard.recent_activity")}</h3>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-center text-xs text-slate-300 py-4">{t("common.no_recent_activity")}</p>}
          
          {history.map((tx) => (
            <button 
                key={tx.id} 
                onClick={() => setSelectedTx(tx)}
                className="w-full bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md border border-transparent hover:border-emerald-100 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === "Deposit" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                   {getLogoOrIcon(tx)}
                </div>
                <div className="text-left">
                  <p className="font-bold text-xs text-slate-800">{tx.type}</p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {new Date(tx.created_at).toLocaleDateString()} &bull; {new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-black text-sm block ${tx.type === "Deposit" ? "text-emerald-600" : "text-slate-800"}`}>
                    {tx.type === "Deposit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
                </span>
                <span className={`text-[9px] font-black uppercase ${tx.status === 'Success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                   {tx.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RENDER RECEIPT MODAL */}
      {selectedTx && (
        <ReceiptView tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}

      {/* DEPOSIT MODAL */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button onClick={() => setIsDepositModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={16} /></button>
            <h3 className="text-xl font-black text-center mb-6 text-slate-800">{t("dashboard.fund_wallet")}</h3>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                 {[100, 500, 1000, 2000, 5000].map(amt => (
                     <button key={amt} onClick={() => setDepositAmount(amt.toString())} className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl text-xs font-bold text-slate-600 transition-colors whitespace-nowrap">₦{amt}</button>
                 ))}
            </div>
            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800" placeholder={t("common.amount")} />
            <button type="button" onClick={handleStartDeposit} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase transition-colors shadow-lg shadow-emerald-200">
              {t("common.pay_securely")}
            </button>
            <button
              type="button"
              onClick={() => verifyDeposit(currentTxRef)}
              disabled={isVerifyingDeposit}
              className="w-full mt-3 py-3 bg-white border-2 border-emerald-600 text-emerald-700 rounded-2xl font-black uppercase transition-colors shadow-sm hover:bg-emerald-50 disabled:opacity-60"
            >
              {isVerifyingDeposit ? "Verifying..." : "Verify Payment"}
            </button>
            <p className="text-[10px] text-slate-400 font-bold text-center mt-3">
              If you completed payment and the wallet didn’t update, tap Verify Payment.
            </p>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={16} /></button>
            <h3 className="text-xl font-black text-center mb-6 text-slate-800">{t("dashboard.withdraw")}</h3>

            <label className="text-[10px] font-black uppercase text-slate-400">Bank</label>
            <select
              value={bankCode}
              onChange={(e) => { setBankCode(e.target.value); setAccountName(""); }}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800"
            >
              <option value="">{isLoadingBanks ? "Loading banks..." : "Select bank"}</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>

            <label className="text-[10px] font-black uppercase text-slate-400">Account Number</label>
            <input
              type="tel"
              value={accountNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setAccountNumber(val);
                if (val.length === 10 && bankCode) resolveAccount(val, bankCode);
              }}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-2 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800"
              placeholder="0123456789"
            />
            {accountName && (
              <p className={`text-[10px] font-black uppercase mb-4 ${accountName.includes("Invalid") ? "text-rose-500" : "text-emerald-600"}`}>
                {isResolvingAccount ? "Resolving..." : accountName}
              </p>
            )}

            <label className="text-[10px] font-black uppercase text-slate-400">Amount</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800"
              placeholder="Amount"
            />

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase transition-colors shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {isWithdrawing ? "Processing..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return renderContent();
};

export default Dashboard;
