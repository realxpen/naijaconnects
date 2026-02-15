import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone, Tv, Zap, ArrowRight, ArrowLeftRight, X, Loader2,
  RotateCcw, CreditCard, GraduationCap, 
  Printer, Building2, Activity, ShieldCheck, AlertCircle, CheckCircle2, Copy
  // Removed 'Bell' to prevent duplication
} from "lucide-react";
import { supabase } from "../supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useI18n } from "../i18n";
import { useToast } from "../components/ui/ToastProvider";
import { beneficiaryService } from "../services/beneficiaryService";
import PinPrompt from "../components/PinPrompt";
import ConfirmTransactionModal from "../components/ConfirmTransactionModal";
import { verifyPinHash } from "../utils/pin";
import { useSuccessScreen } from "../components/ui/SuccessScreenProvider";
import { usePushNotifications } from "../hooks/usePushNotifications";
import InstallPwaModal from "../components/InstallPwaModal";

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
    user: { name: string; email: string; balance: number; phone?: string; id: string; role?: string; roles?: string[]; pinHash?: string | null; pinLength?: number | null };
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
    const meta = (tx as any)?.meta || (tx as any)?.metadata || {};
    const isDeposit = String(tx.type).toLowerCase() === "deposit";
    const depositFee = Number(meta?.estimated_fee || 0);
    const totalPaid = Number(meta?.total_paid || ((Number(tx.amount) || 0) + depositFee));
    const receiptRef = useRef<HTMLDivElement | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [sharing, setSharing] = useState(false);
    const WHATSAPP_NUMBER = "2349151618451";

    const getWhatsAppUrl = (message: string) =>
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    const handleCopyRef = () => {
        navigator.clipboard.writeText(displayRef).then(() => {
            showToast(t("history.reference_copied_clipboard"), "success");
        });
    };

    const exportCanvas = async () => {
      if (!receiptRef.current) return null;
      document.body.classList.add("capture-mode");
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        ignoreElements: (el) => (el as HTMLElement).dataset?.noCapture === "true",
      });
      document.body.classList.remove("capture-mode");
      return canvas;
    };

    const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const shareFile = async (file: File) => {
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ title: "Swifna Receipt", files: [file] });
        return true;
      }
      return false;
    };

    const handleSaveImage = async () => {
      setSharing(true);
      try {
        const canvas = await exportCanvas();
        if (!canvas) return;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png", 1)
        );
        if (!blob) return;
        downloadBlob(blob, "swifna-receipt.png");
      } finally {
        setSharing(false);
      }
    };

    const handleShareImage = async () => {
      setSharing(true);
      try {
        const canvas = await exportCanvas();
        if (!canvas) return;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png", 1)
        );
        if (!blob) return;
        const file = new File([blob], "swifna-receipt.png", { type: "image/png" });
        const ok = await shareFile(file);
        if (!ok) {
          downloadBlob(blob, "swifna-receipt.png");
          showToast("Sharing not supported. Image downloaded instead.", "info");
        }
      } finally {
        setSharing(false);
      }
    };

    const handleSavePdf = async () => {
      setSharing(true);
      try {
        const canvas = await exportCanvas();
        if (!canvas) return;
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "p",
          unit: "px",
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save("swifna-receipt.pdf");
      } finally {
        setSharing(false);
      }
    };

    const handleSharePdf = async () => {
      setSharing(true);
      try {
        const canvas = await exportCanvas();
        if (!canvas) return;
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "p",
          unit: "px",
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        const blob = pdf.output("blob");
        const file = new File([blob], "swifna-receipt.pdf", { type: "application/pdf" });
        const ok = await shareFile(file);
        if (!ok) {
          downloadBlob(blob, "swifna-receipt.pdf");
          showToast("Sharing not supported. PDF downloaded instead.", "info");
        }
      } finally {
        setSharing(false);
      }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full max-w-sm relative">
                <button onClick={onClose} className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors">
                    <X size={20}/>
                </button>

                <div ref={receiptRef} className="bg-white rounded-[30px] overflow-hidden shadow-2xl relative">
                    <div
                      className="absolute inset-0 pointer-events-none opacity-[0.1]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
                          "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='160' viewBox='0 0 260 160'><g transform='rotate(-18 130 80)'><text x='60' y='86' fill='rgba(15,23,42,0.12)' font-size='20' font-family='Inter, Arial, sans-serif' font-weight='800'>Swifna</text><rect x='24' y='58' width='28' height='28' rx='6' ry='6' fill='rgba(34,197,94,0.18)'/><text x='32' y='79' fill='rgba(245,196,0,0.35)' font-size='22' font-family='Inter, Arial, sans-serif' font-weight='800'>S</text></g></svg>"
                        )}")`,
                        backgroundRepeat: "repeat",
                        backgroundSize: "260px 160px",
                      }}
                    />
                    <div className="h-32 bg-emerald-600 relative">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2px)', backgroundSize: '10px 10px' }}></div>
                        <div className="absolute inset-0 flex items-start justify-between px-6 pt-3">
                          <div className="flex items-center gap-2 bg-white/25 px-3 py-1.5 rounded-full">
                            <img src="/logo.png" alt="Swifna" className="w-10 h-10 rounded-lg" />
                            <span className="text-white font-black text-base">Swifna</span>
                          </div>
                          <span className="text-white text-xs font-black uppercase tracking-widest bg-white/25 px-3 py-1.5 rounded-full">
                            Transaction Receipt
                          </span>
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
                            {isDeposit && (
                              <>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                  <span className="text-xs font-bold text-slate-400">Wallet Credit</span>
                                  <span className="text-xs font-bold text-slate-700">₦{Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                  <span className="text-xs font-bold text-slate-400">Processing Fee</span>
                                  <span className="text-xs font-bold text-slate-700">₦{depositFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                  <span className="text-xs font-bold text-slate-400">Total Paid</span>
                                  <span className="text-xs font-bold text-slate-700">₦{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </>
                            )}

                            {String(tx.type).toLowerCase() === "electricity" && (
                              <div className="pt-2 space-y-3">
                                {meta.provider && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Provider</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.provider}</span>
                                  </div>
                                )}
                                {meta.meter_number && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Meter Number</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.meter_number}</span>
                                  </div>
                                )}
                                {meta.customer_name && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Customer Name</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.customer_name}</span>
                                  </div>
                                )}
                                {meta.service_address && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Service Address</span>
                                    <span className="text-xs font-bold text-slate-700 text-right max-w-[170px]">{meta.service_address}</span>
                                  </div>
                                )}
                                {(meta.meter_type_label || meta.meter_type) && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Purchase Type</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">
                                      {meta.meter_type_label || (Number(meta.meter_type) === 1 ? "Prepaid" : "Postpaid")}
                                    </span>
                                  </div>
                                )}
                                {meta.units_purchased && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Units Purchased</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.units_purchased}</span>
                                  </div>
                                )}
                                {meta.token && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Token</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.token}</span>
                                  </div>
                                )}
                                {meta.hotline && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Hotline Number</span>
                                    <a
                                      href={getWhatsAppUrl(`Hello Swifna Support, I need help with transaction ${displayRef}.`)}
                                      className="text-xs font-bold text-emerald-600 text-right hover:text-emerald-700"
                                    >
                                      {meta.hotline}
                                    </a>
                                  </div>
                                )}
                                {meta.transactionid && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Transaction No.</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.transactionid}</span>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>

                        <div className="mt-6">
                          <div className="flex items-center gap-3" data-no-capture="true">
                            <button
                              onClick={() => setShareOpen((v) => !v)}
                              className="flex-1 h-12 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
                              disabled={sharing}
                            >
                              {sharing ? "Preparing..." : "Share Receipt"}
                            </button>
                            <a
                              href={getWhatsAppUrl(`Hello Swifna Support, please help resolve an issue with transaction ${displayRef}.`)}
                              className="flex-1 h-12 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center justify-center hover:border-emerald-400"
                            >
                              Resolve Issue
                            </a>
                          </div>
                          {shareOpen && (
                            <div className="mt-3 grid grid-cols-2 gap-2" data-no-capture="true">
                              <button onClick={handleShareImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                                Share Image
                              </button>
                              <button onClick={handleSaveImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                                Save Image
                              </button>
                              <button onClick={handleSharePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                                Share PDF
                              </button>
                              <button onClick={handleSavePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                                Save PDF
                              </button>
                            </div>
                          )}
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
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  
  // Receipt & Modal States
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("BankCard");
  const [currentTxRef, setCurrentTxRef] = useState<string>(""); 
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [depositInitError, setDepositInitError] = useState<string>("");
  const [isStartingDeposit, setIsStartingDeposit] = useState(false);
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false);
  const [isCheckingPendingDeposit, setIsCheckingPendingDeposit] = useState(false);
  const pendingDepositPollRef = useRef<number | null>(null);

  // Withdraw States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [saveWithdrawBeneficiary, setSaveWithdrawBeneficiary] = useState(true);
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [recentWithdraws, setRecentWithdraws] = useState<any[]>([]);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");

  const getProjectRefFromUrl = (url?: string | null) => {
    if (!url) return "";
    try {
      const host = new URL(url).host;
      return host.split(".")[0] || "";
    } catch {
      return "";
    }
  };

  const getProjectRefFromJwt = (jwt?: string | null) => {
    if (!jwt) return "";
    try {
      const parts = jwt.split(".");
      if (parts.length < 2) return "";
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return getProjectRefFromUrl(payload?.iss || "");
    } catch {
      return "";
    }
  };
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  
  // --- STATE VARIABLES ---
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const {
    permission,
    loading: pushLoading,
    subscribeToPush,
    showInstallPrompt,
    setShowInstallPrompt,
  } = usePushNotifications(user?.id);

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

  const triggerRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await Promise.all([fetchUser(), fetchHistory()]);
    setIsRefreshing(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY > 0) return;
    pullStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, 120));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setPullDistance(0);
      await triggerRefresh();
    } else {
      setPullDistance(0);
    }
    pullStartY.current = null;
  };

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

  // --- OPay DEPOSIT LOGIC ---
  const handleStartDeposit = async () => {
    const amountNum = Number(depositAmount);
    if (!depositAmount || amountNum < 100) return showToast(t("dashboard.min_deposit"), "error");
    
    const fee = getDepositFee(amountNum, depositMethod);
    const totalToPay = amountNum + fee;

    showToast("Initializing Payment...", "info");
    setIsStartingDeposit(true);
    setDepositInitError("");
    
    try {
        const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), ms)
            ),
          ]);
        };

        const { data: currentSession } = await withTimeout(
          supabase.auth.getSession(),
          12000,
          "Session check"
        );
        const accessToken = currentSession?.session?.access_token;
        if (!accessToken) throw new Error("No session token. Please log out and log in again.");
        const clientRef = getProjectRefFromUrl(import.meta.env.VITE_SUPABASE_URL);
        const tokenRef = getProjectRefFromJwt(accessToken);
        if (clientRef && tokenRef && clientRef !== tokenRef) {
          throw new Error(`Auth project mismatch: app=${clientRef}, token=${tokenRef}. Check VITE_SUPABASE_URL/ANON_KEY.`);
        }

        const invokePayload = {
            body: {
                amount: amountNum.toString(),
                email: user.email,
                name: user.name,
                method: depositMethod
            }
        };

        let { data, error } = await withTimeout(
          supabase.functions.invoke("opay-deposit", {
            ...invokePayload,
            headers: { Authorization: `Bearer ${accessToken}` }
          }),
          20000,
          "Deposit initialization"
        );

        const firstStatus = (error as any)?.context?.status;
        if (firstStatus === 401) throw new Error("Unauthorized (401). Please log out and log in again.");

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
        
        let payload: any = data;
        if (typeof data === "string") {
          try {
            payload = JSON.parse(data);
          } catch {
            payload = { raw: data };
          }
        }

        const rawCheckoutUrl =
          payload?.url ??
          payload?.cashierUrl ??
          payload?.checkout_url ??
          payload?.data?.url ??
          payload?.data?.cashierUrl;

        const rawReference =
          payload?.reference ??
          payload?.txnRef ??
          payload?.data?.reference;

        if (rawCheckoutUrl) {
          const checkoutUrl = String(rawCheckoutUrl).trim();
          if (!/^https?:\/\//i.test(checkoutUrl)) {
            throw new Error("Invalid checkout URL returned. Please try again.");
          }
          if (rawReference) {
            setCurrentTxRef(rawReference);
            localStorage.setItem("pending_deposit_ref", rawReference);
          }
          setPaymentUrl(checkoutUrl);
          showToast("Payment link generated. Tap Proceed to Checkout.", "success");
        } else {
          throw new Error(`Failed to get payment URL. Response: ${JSON.stringify(payload || {})}`);
        }

    } catch (e: any) {
        setDepositInitError(e.message || "Failed to start payment");
        showToast(e.message || "Failed to start payment", "error");
    } finally {
        setIsStartingDeposit(false);
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
  const verifyDeposit = async (reference: string, opts?: { silent?: boolean }) => {
    if(!reference) {
      if (!opts?.silent) showToast("No transaction reference found", "error");
      return "missing";
    }
    
    setIsVerifyingDeposit(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("status, amount")
        .eq("reference", reference)
        .single();

      if (error) throw error;

      const status = String(data?.status || "").toLowerCase();
      if (status === 'success') {
          if (!opts?.silent) showToast("Payment confirmed! Updating balance...", "success");
          await fetchUser();
          await fetchHistory();
          setIsDepositModalOpen(false);
          setDepositAmount("");
          setPaymentUrl(null);
          setDepositInitError("");
          localStorage.removeItem("pending_deposit_ref");
          return "success";
      } else if (status === 'failed') {
          if (!opts?.silent) showToast("Payment failed or cancelled.", "error");
          localStorage.removeItem("pending_deposit_ref");
          return "failed";
      } else {
          if (!opts?.silent) showToast("Payment is still pending. Please wait.", "info");
          return "pending";
      }
    } catch (e: any) {
      if (!opts?.silent) showToast(e.message || "Verification failed", "error");
      return "error";
    } finally {
      setIsVerifyingDeposit(false);
    }
  };

  const handleRetryPendingDeposit = async () => {
    const pendingRef = localStorage.getItem("pending_deposit_ref");
    if (!pendingRef) {
      setIsCheckingPendingDeposit(false);
      showToast("No pending payment found.", "info");
      return;
    }

    setIsCheckingPendingDeposit(true);
    const result = await verifyDeposit(pendingRef);
    if (result === "success" || result === "failed" || result === "missing") {
      setIsCheckingPendingDeposit(false);
      if (pendingDepositPollRef.current) {
        window.clearInterval(pendingDepositPollRef.current);
        pendingDepositPollRef.current = null;
      }
    }
  };

  useEffect(() => {
    const pendingRef = localStorage.getItem("pending_deposit_ref");
    if (!pendingRef) {
      setIsCheckingPendingDeposit(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 8;
    setIsCheckingPendingDeposit(true);

    const poll = async () => {
      attempts += 1;
      const result = await verifyDeposit(pendingRef, { silent: true });
      if (result === "success") {
        showToast("Payment confirmed! Balance updated.", "success");
        setIsCheckingPendingDeposit(false);
        if (pendingDepositPollRef.current) window.clearInterval(pendingDepositPollRef.current);
        pendingDepositPollRef.current = null;
        return;
      }
      if (result === "failed" || result === "missing" || attempts >= maxAttempts) {
        setIsCheckingPendingDeposit(false);
        if (pendingDepositPollRef.current) window.clearInterval(pendingDepositPollRef.current);
        pendingDepositPollRef.current = null;
      }
    };

    poll();
    pendingDepositPollRef.current = window.setInterval(poll, 5000);

    return () => {
      setIsCheckingPendingDeposit(false);
      if (pendingDepositPollRef.current) window.clearInterval(pendingDepositPollRef.current);
      pendingDepositPollRef.current = null;
    };
  }, [user.id]);

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
    const ok = await verifyPinHash(pin, user.pinHash, { userId: user.id, email: user.email });
    if (!ok) {
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
    <div
      className="space-y-6 pb-24 animate-in fade-in"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center"
        style={{ height: pullDistance ? Math.max(24, pullDistance * 0.6) : 0 }}
      >
        {(pullDistance > 0 || isRefreshing) && (
          <div className="text-xs font-bold text-slate-400">
            {isRefreshing ? "Refreshing..." : pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}
      </div>
      
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

      {isCheckingPendingDeposit && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-center gap-3">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <p className="text-xs font-bold flex-1">Checking your payment status and updating wallet balance...</p>
          <button
            onClick={handleRetryPendingDeposit}
            disabled={isVerifyingDeposit}
            className="px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-[10px] font-black uppercase tracking-wide hover:bg-amber-200 disabled:opacity-60"
          >
            {isVerifyingDeposit ? "Checking..." : "Retry now"}
          </button>
        </div>
      )}

      {/* PUSH NOTIFICATIONS PROMPT */}
      {permission === 'default' && (
        <div className="bg-emerald-900/40 border border-emerald-500/30 p-4 rounded-xl mb-6 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white text-sm">Enable Notifications</h3>
            <p className="text-xs text-slate-400">Get alerts for deposits and transfers.</p>
          </div>
          <button 
            onClick={subscribeToPush}
            disabled={pushLoading}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition"
          >
            {pushLoading ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      )}

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
            <button onClick={() => { setPaymentUrl(null); setDepositInitError(""); setIsDepositModalOpen(true); }} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors">
                <CreditCard size={16} /> {t("dashboard.fund")}
            </button>
            <button onClick={() => { setIsWithdrawModalOpen(true); }} className="flex-1 bg-emerald-700/70 border border-emerald-300/40 text-white py-4 rounded-2xl font-black text-xs uppercase hover:bg-emerald-800/80 transition-colors">
                {t("dashboard.withdraw")}
            </button>
            </div>
        </div>
      </section>

      {/* ADMIN PANEL BUTTON - Only visible to Admins */}
      {(user.roles?.includes('admin') || user.role === 'admin') && (
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
            <button
              onClick={() => {
                setIsDepositModalOpen(false);
                setPaymentUrl(null);
                setDepositInitError("");
                setDepositAmount("");
              }}
              className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-black text-center mb-6 text-slate-800">{t("dashboard.fund_wallet")}</h3>

            {paymentUrl ? (
              <div className="text-center space-y-6 animate-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg">Order Created!</h4>
                  <p className="text-xs text-slate-500 font-bold mt-1">Ready to complete payment.</p>
                </div>
                <a
                  href={paymentUrl}
                  className="block w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-transform active:scale-95"
                >
                  Proceed to Checkout
                </a>
                <button
                  onClick={() => {
                    setPaymentUrl(null);
                    setDepositInitError("");
                    localStorage.removeItem("pending_deposit_ref");
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancel Transaction
                </button>
              </div>
            ) : (
              <>
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
                disabled={isStartingDeposit}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition flex justify-center items-center gap-2 disabled:opacity-70"
            >
                {isStartingDeposit ? <Loader2 className="animate-spin" /> : `Pay ₦${Number(depositAmountNum + currentDepositFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </button>
            {!!depositInitError && (
              <p className="mt-3 text-[11px] font-bold text-rose-600 break-all">{depositInitError}</p>
            )}
              </>
            )}
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
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Saved Beneficiaries</p>
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
                        className="px-3 py-2 rounded-2xl text-left border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500 transition-colors w-full sm:w-auto"
                      >
                        <span className="block text-[10px] font-black uppercase text-slate-400">{bankLabel}</span>
                        <span className="block text-xs font-bold text-white">{b.account_name || "Beneficiary"}</span>
                        <span className="block text-[10px] text-slate-400">{b.account_number || "---"}</span>
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

      {/* ... rest of your dashboard code ... */}

      {/* INSTALL PWA MODAL */}
      {showInstallPrompt && (
        <InstallPwaModal onClose={() => setShowInstallPrompt(false)} />
      )}

      {/* End of Dashboard */}
</div>
  );
  }

  return renderContent();
};

export default Dashboard;
