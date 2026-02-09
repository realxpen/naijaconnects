import React, { useState, useEffect } from "react";
import {
  Smartphone, Tv, Zap, ArrowRight, ArrowLeftRight, X, Loader2,
  RotateCcw, CreditCard, GraduationCap, 
  Printer, Building2, Activity, ShieldCheck, AlertCircle, CheckCircle2, Copy, Search
  // Removed 'Bell' to prevent duplication
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { useI18n } from "../i18n";
import { useToast } from "../components/ui/ToastProvider";
import { beneficiaryService } from "../services/beneficiaryService";
import PinPrompt from "../components/PinPrompt";
import ConfirmTransactionModal from "../components/ConfirmTransactionModal";
import { hashPin } from "../utils/pin";
import { useSuccessScreen } from "../components/ui/SuccessScreenProvider";

// --- SERVICE COMPONENTS ---
import Airtime from "../components/services/Airtime";
import DataBundle from "../components/services/DataBundle";
import CableTv from "../components/services/CableTv";
import Electricity from "../components/services/Electricity";
import Exams from "../components/services/Exams";
import RechargePin from "../components/services/RechargePin";
import AirtimeToCash from "../components/services/AirtimeToCash";
import AdminDashboard from "./AdminDashboard";

// --- CONSTANTS ---
const BANKS = [
  { code: "", name: "Select Bank" },
  { code: "120001", name: "9mobile 9Payment Service Bank" },
  { code: "801", name: "Abbey Mortgage Bank" },
  { code: "51204", name: "Above Only MFB" },
  { code: "51312", name: "Abulesoro MFB" },
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "120004", name: "Airtel Smartcash PSB" },
  { code: "035A", name: "ALAT by WEMA" },
  { code: "50926", name: "Amju Unique MFB" },
  { code: "50083", name: "Aramoko MFB" },
  { code: "401", name: "ASO Savings and Loans" },
  { code: "MFB50094", name: "Astrapolaris MFB LTD" },
  { code: "51229", name: "Bainescredit MFB" },
  { code: "50931", name: "Bowen Microfinance Bank" },
  { code: "565", name: "Carbon" },
  { code: "50823", name: "CEMCS Microfinance Bank" },
  { code: "50171", name: "Chanelle Microfinance Bank Limited" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "50204", name: "Corestep MFB" },
  { code: "559", name: "Coronation Merchant Bank" },
  { code: "51297", name: "Crescent MFB" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "50263", name: "Ekimogun MFB" },
  { code: "562", name: "Ekondo Microfinance Bank" },
  { code: "50126", name: "Eyowo" },
  { code: "070", name: "Fidelity Bank" },
  { code: "51314", name: "Firmus MFB" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "501", name: "FSDH Merchant Bank Limited" },
  { code: "812", name: "Gateway Mortgage Bank LTD" },
  { code: "00103", name: "Globus Bank" },
  { code: "100022", name: "GoMoney" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "51251", name: "Hackman Microfinance Bank" },
  { code: "50383", name: "Hasal Microfinance Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "120002", name: "HopePSB" },
  { code: "51244", name: "Ibile Microfinance Bank" },
  { code: "50439", name: "Ikoyi Osun MFB" },
  { code: "50457", name: "Infinity MFB" },
  { code: "301", name: "Jaiz Bank" },
  { code: "50502", name: "Kadpoly MFB" },
  { code: "082", name: "Keystone Bank" },
  { code: "50200", name: "Kredi Money MFB LTD" },
  { code: "50211", name: "Kuda Bank" },
  { code: "90052", name: "Lagos Building Investment Company Plc." },
  { code: "50549", name: "Links MFB" },
  { code: "031", name: "Living Trust Mortgage Bank" },
  { code: "303", name: "Lotus Bank" },
  { code: "50563", name: "Mayfair MFB" },
  { code: "50304", name: "Mint MFB" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "120003", name: "MTN Momo PSB" },
  { code: "999992", name: "OPay (Paycom)" },
  { code: "100002", name: "Paga" },
  { code: "999991", name: "PalmPay" },
  { code: "104", name: "Parallex Bank" },
  { code: "311", name: "Parkway - ReadyCash" },
  { code: "50746", name: "Petra Mircofinance Bank Plc" },
  { code: "076", name: "Polaris Bank" },
  { code: "50864", name: "Polyunwana MFB" },
  { code: "105", name: "PremiumTrust Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "51293", name: "QuickFund MFB" },
  { code: "502", name: "Rand Merchant Bank" },
  { code: "90067", name: "Refuge Mortgage Bank" },
  { code: "125", name: "Rubies MFB" },
  { code: "51113", name: "Safe Haven MFB" },
  { code: "50800", name: "Solid Rock MFB" },
  { code: "51310", name: "Sparkle Microfinance Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "51253", name: "Stellas MFB" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "302", name: "TAJ Bank" },
  { code: "51269", name: "Tangerine Money" },
  { code: "51211", name: "TCF MFB" },
  { code: "102", name: "Titan Bank" },
  { code: "100039", name: "Titan Paystack" },
  { code: "50871", name: "Unical MFB" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "566", name: "VFD Microfinance Bank Limited" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" }
];

// --- INTERFACES ---
interface DashboardProps {
  user: { name: string; email: string; balance: number; phone?: string; id: string; role?: string; pinHash?: string | null; pinLength?: number | null };
  onUpdateBalance: (newBalance: number) => void;
  activeTab?: string; 
}

interface Transaction {
  id: string; 
  created_at: string;
  type: 'deposit' | 'withdrawal' | 'service';
  amount: number;
  status: string;
  reference: string;
  description?: string; 
  meta?: any; 
}

type ViewState = "Dashboard" | "Airtime" | "Data" | "Cable" | "Electricity" | "Exam" | "RechargePin" | "AirtimeToCash" | "Admin";

// --- HELPER: GET LOGO ---
const getLogoOrIcon = (transaction: Transaction) => {
    switch(transaction.type) {
        case 'deposit': return <ArrowRight size={18} className="rotate-45" />;
        case 'withdrawal': return <ArrowRight size={18} className="-rotate-45" />;
        default: return <Activity size={18} />;
    }
};

const getColorClass = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'deposit') return 'bg-emerald-100 text-emerald-600';
    if (t === 'withdrawal') return 'bg-rose-100 text-rose-600';
    return 'bg-slate-100 text-slate-600';
};

// --- COMPONENT: RECEIPT VIEW ---
const ReceiptView = ({ tx, onClose }: { tx: Transaction; onClose: () => void }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const displayRef = tx.reference || `TRX-${tx.id.substring(0,8)}`;

    const handleCopyRef = () => {
        navigator.clipboard.writeText(displayRef).then(() => {
            showToast(t("history.reference_copied_clipboard"), "success");
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full max-w-sm relative">
                <button onClick={onClose} className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors">
                    <X size={20}/>
                </button>

                <div className="bg-white rounded-[30px] overflow-hidden shadow-2xl relative">
                    <div className="h-24 bg-emerald-600 relative">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2px)', backgroundSize: '10px 10px' }}></div>
                        <div className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-6xl tracking-widest rotate-[-15deg] pointer-events-none">
                            {t("history.receipt")}
                        </div>
                    </div>

                    <div className="px-6 pb-8 -mt-10 relative">
                        <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-slate-100">
                            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center -mt-14 mb-3 border-4 border-white shadow-md ${getColorClass(tx.type)}`}>
                                 <div className="w-10 h-10">{getLogoOrIcon(tx)}</div>
                            </div>
                            <h2 className="text-3xl font-black text-slate-800">₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{tx.type}</p>
                            
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${tx.status.toLowerCase() === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {tx.status.toLowerCase() === 'success' ? <CheckCircle2 size={12}/> : <X size={12}/>}
                                {tx.status}
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                <span className="text-xs font-bold text-slate-400">{t("common.date")}</span>
                                <span className="text-xs font-bold text-slate-700">{new Date(tx.created_at).toLocaleString()}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                <span className="text-xs font-bold text-slate-400">{t("common.ref_id")}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700">{displayRef}</span>
                                    <button onClick={handleCopyRef} className="text-slate-400 hover:text-emerald-600 transition-colors">
                                        <Copy size={12}/>
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                <span className="text-xs font-bold text-slate-400">{t("common.desc")}</span>
                                <span className="text-xs font-bold text-slate-700 text-right max-w-[150px]">{tx.description || tx.type}</span>
                            </div>
                        </div>

                        <div className="mt-6 text-center opacity-30">
                            <p className="font-black text-xs uppercase">{t("app.name")}</p>
                            <p className="text-[8px] font-bold">{t("history.generated_receipt")}</p>
                        </div>
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
  const { showSuccess } = useSuccessScreen();
  const [view, setView] = useState<ViewState>("Dashboard");
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<Transaction[]>([]);
  
  // Receipt & Modal States
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("BankCard");
  const [currentTxRef, setCurrentTxRef] = useState<string>(""); 
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false);

  // Withdraw States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [saveWithdrawBeneficiary, setSaveWithdrawBeneficiary] = useState(true);
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [recentWithdraws, setRecentWithdraws] = useState<any[]>([]);
  const [isWithdrawBeneficiariesOpen, setIsWithdrawBeneficiariesOpen] = useState(false);
  const [withdrawBeneficiaries, setWithdrawBeneficiaries] = useState<any[]>([]);
  const [withdrawSearch, setWithdrawSearch] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  
  // --- STATE VARIABLES ---
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  // --- DYNAMIC GREETING STATE (FIXED LOGIC) ---
  const [greeting, setGreeting] = useState("");
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    const firstName =
      user?.name?.trim()?.split(' ')[0] ||
      user?.email?.split('@')[0] ||
      'User';

    let messages: string[] = [];

    // FIXED TIME LOGIC: 00:00 to 04:59 is "Night", 05:00 to 11:59 is "Morning"
    if (hour < 5) {
      // Late Night (00:00 - 04:59)
      messages = [
        `Good Night, ${firstName}! 🌙`,
        "You're up late! 🦉",
        "Don't forget to rest. 💤",
        "Tomorrow will be a great day. ✨"
      ];
    } else if (hour < 12) {
      // Morning (05:00 - 11:59)
      messages = [
        `Good Morning, ${firstName}! ☀️`,
        "Hope you had a good night rest? 🌿",
        "Let's make today productive! 🚀"
      ];
    } else if (hour < 17) {
      // Afternoon (12:00 - 16:59)
      messages = [
        `Good Afternoon, ${firstName}! 🌤️`,
        "How is your day going? 💼",
        "Stay hydrated and focused! 💧"
      ];
    } else if (hour < 21) {
      // Evening (17:00 - 20:59)
      messages = [
        `Good Evening, ${firstName}! 🌇`,
        "Hope you're winding down. 🍵",
        "Review your wins for the day. 🏆"
      ];
    } else {
      // Night (21:00 - 23:59)
      messages = [
        `Good Night, ${firstName}! 🌙`,
        "Get some rest... 💤",
        "A good night rest heals the body. 🛌"
      ];
    }

    let currentIndex = 0;
    setGreeting(messages[0]);

    const interval = setInterval(() => {
      setFade(false); 
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % messages.length;
        setGreeting(messages[currentIndex]);
        setFade(true); 
      }, 500); 
    }, 4000); 

    return () => clearInterval(interval);
  }, [user]);
  // --- END DYNAMIC GREETING STATE ---


  // --- DYNAMIC FEE CALCULATORS ---
  const getWithdrawalFee = (amount: number) => {
    if (!amount) return 0;
    if (amount <= 5000) return 10;
    if (amount <= 50000) return 25;
    return 50;
  };

  const getDepositFee = (amount: number, method: string) => {
    if (!amount) return 0;
    if (method === "BankCard") return Math.ceil(amount * 0.015); 
    return 50; 
  };

  // --- DATA FETCHING ---
  const fetchUser = async () => {
    try {
      const { data } = await supabase.from("profiles").select("wallet_balance").eq("email", user.email).single();
      if (data) onUpdateBalance(data.wallet_balance);
    } catch (e) { console.error(e); }
  };

 const fetchHistory = async () => {
    if (!user || !user.id) {
        return; 
    }
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
        .order("created_at", { ascending: false })
        .limit(5);
        
      if (error) throw error;
      if (data) setHistory(data as unknown as Transaction[]);
    } catch (e: any) { 
        console.error("History Fetch Error:", e.message); 
    }
  };

  useEffect(() => { fetchHistory(); fetchUser(); }, [user.email]);

  useEffect(() => {
    const loadWithdrawBeneficiaries = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'withdraw', 5);
        setRecentWithdraws(recents);
      } catch (e) {
        console.error("Failed to load withdraw beneficiaries:", e);
      }
    };
    loadWithdrawBeneficiaries();
  }, []);

  useEffect(() => {
    if (!isWithdrawBeneficiariesOpen) return;
    const loadAllWithdrawBeneficiaries = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const list = await beneficiaryService.fetchRecent(auth.user.id, 'withdraw', 100);
        setWithdrawBeneficiaries(list);
      } catch (e) {
        console.error("Failed to load withdraw beneficiaries list:", e);
      }
    };
    loadAllWithdrawBeneficiaries();
  }, [isWithdrawBeneficiariesOpen]);

  // --- OPay DEPOSIT LOGIC ---
  const handleStartDeposit = async () => {
    const amountNum = Number(depositAmount);
    if (!depositAmount || amountNum < 100) return showToast(t("dashboard.min_deposit"), "error");
    
    const fee = getDepositFee(amountNum, depositMethod);
    const totalToPay = amountNum + fee;

    showToast("Initializing Payment...", "info");
    
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error("You are not logged in. Please log in again.");

        const { data, error } = await supabase.functions.invoke("opay-deposit", {
            headers: { Authorization: `Bearer ${accessToken}` },
            body: { 
                amount: totalToPay.toString(), 
                email: user.email,
                name: user.name,
                method: depositMethod
            }
        });

        if (error) {
            let detailMessage = "";
            const ctxBody = (error as any)?.context?.body;
            if (ctxBody) {
                if (typeof ctxBody === "string") {
                    try {
                        const parsed = JSON.parse(ctxBody);
                        detailMessage = parsed?.error || parsed?.message || ctxBody;
                    } catch {
                        detailMessage = ctxBody;
                    }
                } else if (typeof ctxBody === "object") {
                    detailMessage = ctxBody?.error || ctxBody?.message || "";
                }
            }

            const status = (error as any)?.context?.status;
            const fullMessage = detailMessage || error.message || "Failed to start payment";
            throw new Error(status ? `${fullMessage} (status ${status})` : fullMessage);
        }
        
        if (data?.url) {
            setCurrentTxRef(data.reference); 
            window.location.href = data.url;
        } else {
            throw new Error("Failed to get payment URL");
        }

    } catch (e: any) {
        showToast(e.message || "Failed to start payment", "error");
    }
  };

  // --- REALTIME BALANCE UPDATE ---
  useEffect(() => {
    if (!user.id) return;
    const channel = supabase
      .channel('realtime-balance')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newBalance = payload.new.wallet_balance;
          onUpdateBalance(newBalance);
          showToast(`Balance updated: ₦${newBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "success");
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // --- VERIFY DEPOSIT (Direct DB Check) ---
  const verifyDeposit = async (reference: string) => {
    if(!reference) return showToast("No transaction reference found", "error");
    
    setIsVerifyingDeposit(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("status, amount")
        .eq("reference", reference)
        .single();

      if (error) throw error;

      if (data?.status === 'success') {
          showToast("Payment confirmed! Updating balance...", "success");
          await fetchUser();
          await fetchHistory();
          setIsDepositModalOpen(false);
          setDepositAmount("");
      } else if (data?.status === 'failed') {
          showToast("Payment failed or cancelled.", "error");
      } else {
          showToast("Payment is still pending. Please wait.", "info");
      }
    } catch (e: any) {
      showToast(e.message || "Verification failed", "error");
    } finally {
      setIsVerifyingDeposit(false);
    }
  };

  // --- VERIFY ACCOUNT (PAYSTACK) ---
  const resolveAccount = async (acct: string, bank: string) => {
    if (acct.length !== 10 || !bank) return;

    setIsResolving(true);
    setAccountName(""); 

    console.log(`Verifying: ${acct} with Bank: ${bank}`); 

    try {
        const { data, error } = await supabase.functions.invoke("verify-account", {
            body: { account_number: acct, bank_code: bank }
        });

        console.log("Verification Response:", data, error);

        if (error) throw new Error(error.message);

        if (data?.valid) {
            setAccountName(data.account_name);
            showToast(`Verified: ${data.account_name}`, "success");
        } else {
            const errorMsg = data?.message || "Account not found";
            console.error("Verification failed:", errorMsg);
            setAccountName("INVALID ACCOUNT");
            showToast(errorMsg, "error");
        }
    } catch (e: any) {
        console.error("System Error:", e);
        setAccountName("SYSTEM ERROR");
        showToast("Verification failed. Check console.", "error");
    } finally {
        setIsResolving(false);
    }
  };

  // --- HANDLER: WITHDRAW ---
  const doWithdraw = async () => {
    const amount = Number(withdrawAmount);
    
    if (amount <= 0) return showToast("Invalid amount", "error");
    if (amount > user.balance) return showToast("Insufficient balance", "error");
    if (!bankCode || !accountNumber) return showToast("Please fill all bank details", "error"); 
    
    if (!accountName || accountName === "INVALID ACCOUNT") return showToast("Please wait for account verification", "error");
    if (accountName === "SYSTEM ERROR") return showToast("System error on verification. Try again later.", "error");

    const bankName = BANKS.find(b => b.code === bankCode)?.name || "Unknown Bank";
    const fee = getWithdrawalFee(amount);

    setIsWithdrawing(true);
    
    try {
      const totalDeducted = amount + fee;

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id || user.id;

      const { error: txError } = await supabase.from("transactions").insert([
        {
          user_id: userId,
          user_email: user.email,
          type: "withdrawal",
          amount: amount,
          status: "pending",
          reference: `WD-${Date.now()}`,
          metadata: {
            bank_code: bankCode,
            bank_name: bankName,
            account_number: accountNumber,
            account_name: accountName,
            fee: fee,
            total_deducted: totalDeducted,
          },
        },
      ]);

      if (txError) throw new Error(txError.message || "Failed to create withdrawal request");

      const newBal = user.balance - totalDeducted;
      await supabase.from("profiles").update({ wallet_balance: newBal }).eq("email", user.email);
      onUpdateBalance(newBal);

      showSuccess({
        title: "Withdrawal request created",
        amount: Number(totalDeducted),
        message: "withdrawal request Successfuly submitted.",
        subtitle: accountNumber ? `FOR ${accountNumber}` : undefined,
      });
      
      fetchHistory();
      
      fetchHistory();
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      setAccountNumber("");
      setAccountName(""); 
      setBankCode("");

      if (saveWithdrawBeneficiary) {
        try {
          const { data: auth } = await supabase.auth.getUser();
          if (auth?.user?.id) {
            await beneficiaryService.upsert({
              user_id: auth.user.id,
              type: 'withdraw',
              beneficiary_key: `acct:${accountNumber}|bank:${bankCode}`,
              account_number: accountNumber,
              bank_code: bankCode,
              account_name: accountName
            });
            const recents = await beneficiaryService.fetchRecent(auth.user.id, 'withdraw', 5);
            setRecentWithdraws(recents);
          }
        } catch (e) {
          console.error("Failed to save withdraw beneficiary:", e);
        }
      }
      
    } catch (error: any) {
      console.error("Withdrawal Error Full:", error);
      
      let errorMessage = error.message || "Withdrawal failed";
      
      if (error.context && error.context.json) {
        const body = await error.context.json();
        if (body?.error || body?.message) errorMessage = body.error || body.message;
      }

      showToast(errorMessage, "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const requirePin = (action: () => void) => {
    if (!user?.pinHash || !user?.id) {
      showToast("Please set your PIN in Profile", "error");
      return;
    }
    setPendingAction(() => action);
    setPinError("");
    setPinOpen(true);
  };

  const handlePinConfirm = async (pin: string) => {
    if (!user?.pinHash || !user?.id) return;
    const h = await hashPin(pin, user.id);
    if (h !== user.pinHash) {
      setPinError("Incorrect PIN");
      return;
    }
    setPinOpen(false);
    const act = pendingAction;
    setPendingAction(null);
    if (act) act();
  };

  const handleWithdraw = () => {
    setConfirmWithdrawOpen(true);
  };

  const handleSaveWithdrawBeneficiary = async () => {
    if (!bankCode || !accountNumber) return showToast("Enter bank and account number", "error");
    if (!accountName || accountName === "INVALID ACCOUNT" || accountName === "SYSTEM ERROR") {
      return showToast("Please verify account name", "error");
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return;
      await beneficiaryService.upsert({
        user_id: auth.user.id,
        type: 'withdraw',
        beneficiary_key: `acct:${accountNumber}|bank:${bankCode}`,
        account_number: accountNumber,
        bank_code: bankCode,
        account_name: accountName
      });
      const recents = await beneficiaryService.fetchRecent(auth.user.id, 'withdraw', 5);
      setRecentWithdraws(recents);
      showToast("Beneficiary saved", "success");
    } catch (e) {
      console.error("Failed to save withdraw beneficiary:", e);
      showToast("Failed to save beneficiary", "error");
    }
  };

  // --- RENDER CONTENT ---
  const renderContent = () => {
    switch (view) {
      case "Admin": return <AdminDashboard onBack={() => setView("Dashboard")} />;
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

  const renderDashboardHome = () => {
    const amountNum = Number(withdrawAmount) || 0;
    const currentWithdrawFee = getWithdrawalFee(amountNum);
    const depositAmountNum = Number(depositAmount) || 0;
    const currentDepositFee = getDepositFee(depositAmountNum, depositMethod);

    return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      
      {/* --- CLEANED DYNAMIC HEADER --- */}
      {/* No extra balance text. No extra Bell. Just the animated greeting. */}
      <div className="flex items-center mb-2 mt-2 h-10"> 
        <h1 
            className={`
                text-2xl font-black text-slate-800 tracking-tight
                transition-opacity duration-500 ease-in-out
                ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
            `}
        >
            {greeting}
        </h1>
      </div>
      {/* --- END HEADER --- */}

      {/* WALLET CARD */}
      <section className="bg-emerald-600 dark:bg-slate-800 p-6 rounded-[35px] text-white shadow-xl relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5"></div>

        <div className="relative z-10">
            <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t("dashboard.available_balance")}</p>
            <button onClick={() => { setIsRefreshingBalance(true); fetchUser(); setTimeout(() => setIsRefreshingBalance(false), 1000); }} className="p-2 bg-emerald-700/70 rounded-full hover:bg-emerald-800 transition-colors">
                <RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""} />
            </button>
            </div>
            <h2 className="text-4xl font-black mb-6">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="flex gap-3">
            <button onClick={() => { setIsDepositModalOpen(true); }} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors">
                <CreditCard size={16} /> {t("dashboard.fund")}
            </button>
            <button onClick={() => { setIsWithdrawModalOpen(true); }} className="flex-1 bg-emerald-700/70 border border-emerald-300/40 text-white py-4 rounded-2xl font-black text-xs uppercase hover:bg-emerald-800/80 transition-colors">
                {t("dashboard.withdraw")}
            </button>
            </div>
        </div>
      </section>

      {/* ADMIN PANEL BUTTON - Only visible to Admins */}
      {user.role === 'admin' && (
          <button 
            onClick={() => setView("Admin")}
            className="w-full bg-emerald-600 dark:bg-slate-900 text-white p-5 rounded-[25px] flex items-center justify-between shadow-xl shadow-slate-200 hover:shadow-2xl transition-all active:scale-[0.98] mb-6 border border-emerald-700 dark:border-slate-800"
          >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-700/70 dark:bg-slate-800 rounded-2xl border border-emerald-400/30 dark:border-slate-700">
                    <ShieldCheck size={24} className="text-white"/>
                </div>
                <div className="text-left">
                    <h3 className="font-black text-lg text-white">Admin Panel</h3>
                    <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Manage Withdrawals</p>
                </div>
              </div>
              <div className="bg-emerald-700/70 dark:bg-slate-800 p-2 rounded-full">
                <ArrowRight size={20} className="text-white"/>
              </div>
          </button>
      )}

      {/* SERVICE GRID */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[
          { id: "Airtime", labelKey: "dashboard.airtime", icon: <Smartphone size={18} /> },
          { id: "Data", labelKey: "dashboard.data", icon: <Zap size={18} /> },
          { id: "Cable", labelKey: "dashboard.cable", icon: <Tv size={18} /> },
          { 
            id: "Electricity", 
            labelKey: "dashboard.electricity",
            icon: <div className="relative"><Building2 size={18} /><Zap size={10} className="absolute -top-2 -right-1 text-yellow-500 fill-yellow-500" strokeWidth={3}/></div>
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

      {/* HISTORY */}
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === "deposit" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                   {getLogoOrIcon(tx)}
                </div>
                <div className="text-left">
                  <p className="font-bold text-xs text-slate-800 uppercase">{tx.type}</p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-black text-sm block ${tx.type === "deposit" ? "text-emerald-600" : "text-slate-800"}`}>
                    {tx.type === "deposit" ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[9px] font-black uppercase ${tx.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
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
            
            <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                    { id: "BankCard", label: "Card (1.5%)", icon: <CreditCard size={18}/> },
                    { id: "BankTransfer", label: "Transfer (₦50)", icon: <Building2 size={18}/> },
                    { id: "BankUssd", label: "USSD (₦50)", icon: <Smartphone size={18}/> },
                    { id: "OpayWalletNgQR", label: "QR Code (₦50)", icon: <RotateCcw size={18}/> }
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setDepositMethod(m.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                            depositMethod === m.id 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        {m.icon}
                        <span className="text-xs mt-1 text-center">{m.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                  {[100, 500, 1000, 2000, 5000].map(amt => (
                      <button key={amt} onClick={() => setDepositAmount(amt.toString())} className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl text-xs font-bold text-slate-600 transition-colors whitespace-nowrap">₦{Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</button>
                  ))}
            </div>
            
            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800" placeholder={t("common.amount")} />
            
            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs text-slate-600 flex justify-between items-center border border-slate-100">
                <span>Processing Fee:</span>
                <span className="font-bold">₦{Number(currentDepositFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center mb-4 text-sm font-bold text-slate-800 px-1">
                <span>Total Payable:</span>
                <span>₦{Number(depositAmountNum + currentDepositFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <button
                onClick={handleStartDeposit}
                disabled={isVerifyingDeposit}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition flex justify-center items-center gap-2 disabled:opacity-70"
            >
                {isVerifyingDeposit ? <Loader2 className="animate-spin" /> : `Pay ₦${Number(depositAmountNum + currentDepositFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </button>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={16} /></button>
            <h3 className="text-xl font-black text-center mb-6 text-slate-800">{t("dashboard.withdraw")}</h3>

            <label className="block text-xs font-bold text-slate-500 mb-1">Bank</label>
            <div className="mb-4">
                <select 
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 text-sm" 
                    value={bankCode} 
                    onChange={(e) => { 
                        setBankCode(e.target.value); 
                        if(accountNumber.length === 10) resolveAccount(accountNumber, e.target.value);
                    }}
                >
                    {BANKS.map((b) => (
                        <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                </select>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-slate-400">Beneficiaries</p>
                <button
                  type="button"
                  onClick={() => setIsWithdrawBeneficiariesOpen(true)}
                  className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700"
                >
                  Open list
                </button>
              </div>
              {recentWithdraws.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recentWithdraws.map((b) => {
                    const bankLabel = BANKS.find((bank) => bank.code === b.bank_code)?.name || "Unknown Bank";
                    return (
                      <button
                        key={b.beneficiary_key}
                        onClick={() => {
                          if (b.bank_code) setBankCode(b.bank_code);
                          if (b.account_number) setAccountNumber(b.account_number);
                          if (b.account_name) setAccountName(b.account_name);
                          if (b.account_number && b.bank_code) resolveAccount(b.account_number, b.bank_code);
                        }}
                        className="px-3 py-2 rounded-2xl text-left border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-400 transition-colors w-full sm:w-auto"
                      >
                        <span className="block text-[10px] font-black uppercase text-slate-400">{bankLabel}</span>
                        <span className="block text-xs font-bold text-slate-800">{b.account_name || "Beneficiary"}</span>
                        <span className="block text-[10px] text-slate-500">{b.account_number || "---"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">No saved beneficiaries yet.</p>
              )}
            </div>

            <label className="block text-xs font-bold text-slate-500 mb-1">Account Number</label>
            <div className="mb-2">
                <input 
                    type="text" 
                    maxLength={10} 
                    className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="0123456789" 
                    value={accountNumber} 
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g,''); 
                        setAccountNumber(val);
                        if(val.length === 10 && bankCode) resolveAccount(val, bankCode);
                    }} 
                />
            </div>

            <div className="mt-2 mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">Account Name</label>
                <div className={`w-full p-2.5 border rounded-xl bg-slate-50 min-h-[42px] flex items-center ${isResolving ? 'text-slate-400' : 'text-slate-800'}`}>
                    {isResolving ? (
                        <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Verifying...</span>
                    ) : (
                        <span className={accountName === "INVALID ACCOUNT" || accountName === "SYSTEM ERROR" ? "text-red-500 font-bold" : "font-bold text-green-700"}>
                            {accountName || "---"}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                    <input
                      type="checkbox"
                      checked={saveWithdrawBeneficiary}
                      onChange={(e) => setSaveWithdrawBeneficiary(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    Save beneficiary after withdrawal
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveWithdrawBeneficiary}
                    className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700"
                  >
                    Save now
                  </button>
                </div>
            </div>

            <label className="text-[10px] font-black uppercase text-slate-400">Amount</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800"
              placeholder="Amount"
            />
            
            <div className="mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 mb-1 text-slate-500">
                    <AlertCircle size={12} />
                    <span className="text-[10px] font-bold uppercase">Fee Structure</span>
                </div>
                <div className="text-[10px] text-slate-600 grid grid-cols-3 gap-1">
                    <div className="bg-white px-2 py-1 rounded border border-slate-100 text-center">
                        <span className="block text-slate-400">≤ 5k</span>
                        <span className="font-bold">₦10</span>
                    </div>
                    <div className="bg-white px-2 py-1 rounded border border-slate-100 text-center">
                        <span className="block text-slate-400">≤ 50k</span>
                        <span className="font-bold">₦25</span>
                    </div>
                    <div className="bg-white px-2 py-1 rounded border border-slate-100 text-center">
                        <span className="block text-slate-400">&gt; 50k</span>
                        <span className="font-bold">₦50</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs text-slate-600 flex justify-between items-center border border-slate-100">
                <span>Withdrawal Fee:</span>
                <span className="font-bold">₦{Number(currentWithdrawFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center mb-4 text-sm font-bold text-slate-800 px-1">
                <span>Total Deduction:</span>
                <span>₦{Number(amountNum + currentWithdrawFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || isResolving || !accountName || accountName === "INVALID ACCOUNT" || accountName === "SYSTEM ERROR"}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWithdrawing ? "Processing..." : "Withdraw Funds"}
            </button>
          </div>
        </div>
      )}
      {isWithdrawBeneficiariesOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Withdraw Beneficiaries</h3>
              <button
                onClick={() => setIsWithdrawBeneficiariesOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
                <Search size={16} className="text-slate-400" />
                <input
                  value={withdrawSearch}
                  onChange={(e) => setWithdrawSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
              {withdrawBeneficiaries.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No beneficiaries saved yet.</p>
              ) : (
                <div className="space-y-3">
                  {withdrawBeneficiaries
                    .filter((b) => {
                      const bankLabel = BANKS.find((bank) => bank.code === b.bank_code)?.name || "";
                      const query = withdrawSearch.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        (b.account_name || "").toLowerCase().includes(query) ||
                        (b.account_number || "").toLowerCase().includes(query) ||
                        bankLabel.toLowerCase().includes(query)
                      );
                    })
                    .map((b) => {
                      const bankLabel = BANKS.find((bank) => bank.code === b.bank_code)?.name || "Unknown Bank";
                      return (
                        <button
                          key={b.beneficiary_key}
                          onClick={() => {
                            if (b.bank_code) setBankCode(b.bank_code);
                            if (b.account_number) setAccountNumber(b.account_number);
                            if (b.account_name) setAccountName(b.account_name);
                            if (b.account_number && b.bank_code) resolveAccount(b.account_number, b.bank_code);
                            setIsWithdrawBeneficiariesOpen(false);
                          }}
                          className="w-full text-left border border-slate-200 rounded-2xl px-4 py-3 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                        >
                          <span className="block text-[11px] font-black uppercase text-slate-400">{bankLabel}</span>
                          <span className="block text-sm font-bold text-slate-800">{b.account_name || "Beneficiary"}</span>
                          <span className="block text-[11px] text-slate-500">{b.account_number || "---"}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmTransactionModal
        open={confirmWithdrawOpen}
        title="Confirm Transaction"
        subtitle={accountName ? `FOR ${accountName}` : accountNumber ? `FOR ${accountNumber}` : undefined}
        amountLabel="Total Pay"
        amount={amountNum + currentWithdrawFee}
        confirmLabel="Withdraw Now"
        onConfirm={() => {
          setConfirmWithdrawOpen(false);
          requirePin(doWithdraw);
        }}
        onClose={() => setConfirmWithdrawOpen(false)}
      />
      <PinPrompt
        open={pinOpen}
        requiredLength={user?.pinLength || null}
        onConfirm={handlePinConfirm}
        onClose={() => setPinOpen(false)}
        error={pinError}
      />
    </div>
  );
  }

  return renderContent();
};

export default Dashboard;
