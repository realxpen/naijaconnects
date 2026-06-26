import React, { Suspense, useState, useEffect, useRef } from "react";
import {
  Smartphone, Tv, Zap, ArrowRight, X, Loader2,
  RotateCcw, CreditCard, GraduationCap,
  Printer, Building2, Activity, CheckCircle2, Copy, Send
} from "lucide-react";
import { supabase } from "../supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useI18n } from "../i18n";
import { useToast } from "../components/ui/ToastProvider";
import PinPrompt from "../components/PinPrompt";
import { calculateDepositFee, calculateTransferServiceFee } from "../utils/paymentFees";
import { useSuccessScreen } from "../components/ui/SuccessScreenProvider";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../services/piNetworkService";
import SendToUser from "../components/services/SendToUser";
import { verifyPinHash } from '../utils/pin';

const lazyFallback = (
  <div className="flex flex-col items-center justify-center py-12 px-4 w-full h-48 space-y-3 bg-white dark:bg-slate-800 rounded-[26px] border border-slate-50 dark:border-slate-700 shadow-sm animate-pulse">
    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Section...</p>
  </div>
);

// --- SERVICE COMPONENTS ---
const Airtime = React.lazy(() => import("../components/services/Airtime"));
const DataBundle = React.lazy(() => import("../components/services/DataBundle"));
const CableTv = React.lazy(() => import("../components/services/CableTv"));
const Electricity = React.lazy(() => import("../components/services/Electricity"));
const Exams = React.lazy(() => import("../components/services/Exams"));
const RechargePin = React.lazy(() => import("../components/services/RechargePin"));
const AirtimeToCash = React.lazy(() => import("../components/services/AirtimeToCash"));
const AdminDashboard = React.lazy(() => import("./AdminDashboard"));

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

interface DashboardProps {
  user: {
    name: string;
    email: string;
    balance: number;
    piBalance?: number;
    phone?: string;
    id: string;
    role?: string;
    roles?: string[];
    pinHash?: string | null;
    pinLength?: number | null;
    wallet_balance?: number;
  };
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void;
  activeTab?: string;
  isGuest?: boolean;
  onRequireAuth?: () => void;
  onViewChange?: (view: string) => void;
}

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  status: string;
  reference: string;
  description?: string;
  meta?: any;
}

type ViewState = "Dashboard" | "Airtime" | "Data" | "Cable" | "Electricity" | "Exam" | "RechargePin" | "AirtimeToCash" | "Admin" | "DataHelpCenter" | "SendToUser";

const getLogoOrIcon = (transaction: Transaction) => {
  const typeLower = String(transaction.type).toLowerCase();
  if (typeLower === 'deposit') return <ArrowRight size={18} className="rotate-45" />;
  if (typeLower === 'withdrawal') return <ArrowRight size={18} className="-rotate-45" />;
  return <Activity size={18} />;
};

const getColorClass = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'deposit') return 'bg-emerald-100 text-emerald-600';
  if (t === 'withdrawal') return 'bg-rose-100 text-rose-600';
  return 'bg-slate-100 text-slate-600';
};

const ReceiptView = ({ tx, onClose, onRequeryDeposit }: { tx: Transaction; onClose: () => void; onRequeryDeposit?: (reference: string) => Promise<any>; }) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const displayRef = tx.reference || `TRX-${tx.id.substring(0, 8)}`;
  const txReference = String(tx.reference || "").trim();
  const meta = tx?.meta || tx?.metadata || {};
  const isDeposit = String(tx.type).toLowerCase() === "deposit";
  const isExam = String(tx.type).toLowerCase() === "exam";

  const examCards = Array.isArray(meta?.cards)
    ? meta.cards
      .map((c: any) => ({
        pin: String(c?.pin || "").trim(),
        serialNo: String(c?.serial_no || c?.serialNo || "").trim(),
      }))
      .filter((c: any) => c.pin || c.serialNo)
    : [];
  const examPin = String(meta?.pin || "").trim();
  const canRequeryDeposit = isDeposit && !!txReference && ["pending", "failed"].includes(String(tx.status || "").toLowerCase());
  const depositFee = Number(meta?.estimated_fee || 0);
  const totalPaid = Number(meta?.total_paid || ((Number(tx.amount) || 0) + depositFee));
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isRequerying, setIsRequerying] = useState(false);
  const WHATSAPP_NUMBER = "2349151618451";

  const getWhatsAppUrl = (message: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

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
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) return;
      downloadBlob(blob, "swifna-receipt.png");
    } finally { setSharing(false); }
  };

  const handleShareImage = async () => {
    setSharing(true);
    try {
      const canvas = await exportCanvas();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) return;
      const file = new File([blob], "swifna-receipt.png", { type: "image/png" });
      const ok = await shareFile(file);
      if (!ok) {
        downloadBlob(blob, "swifna-receipt.png");
        showToast("Sharing not supported. Image downloaded instead.", "info");
      }
    } finally { setSharing(false); }
  };

  const handleSavePdf = async () => {
    setSharing(true);
    try {
      const canvas = await exportCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("swifna-receipt.pdf");
    } finally { setSharing(false); }
  };

  const handleSharePdf = async () => {
    setSharing(true);
    try {
      const canvas = await exportCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      const blob = pdf.output("blob");
      const file = new File([blob], "swifna-receipt.pdf", { type: "application/pdf" });
      const ok = await shareFile(file);
      if (!ok) {
        downloadBlob(blob, "swifna-receipt.pdf");
        showToast("Sharing not supported. PDF downloaded instead.", "info");
      }
    } finally { setSharing(false); }
  };

  const handleShareToWhatsApp = () => {
    const text = `*Swifna Transaction Receipt*\n---------------------------\n*Type:* ${tx.type}\n*Amount:* ₦${tx.amount.toLocaleString()}\n*Status:* ${tx.status}\n*Ref ID:* ${displayRef}\n*Date:* ${new Date(tx.created_at).toLocaleString()}`;
    window.open(getWhatsAppUrl(text), '_blank');
  };

  const handleRequeryDeposit = async () => {
    if (!onRequeryDeposit || !txReference || isRequerying) return;
    setIsRequerying(true);
    try { await onRequeryDeposit(txReference); } finally { setIsRequerying(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm relative">
        <button aria-label="Close receipt" onClick={onClose} className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors">
          <X size={20} />
        </button>

        <div className="bg-white rounded-[30px] overflow-hidden shadow-2xl relative" ref={receiptRef}>
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
                <div className="w-10 h-10 flex items-center justify-center">{getLogoOrIcon(tx)}</div>
              </div>
              <h2 className="text-3xl font-black text-slate-800">₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{tx.type}</p>

              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${tx.status.toLowerCase() === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {tx.status.toLowerCase() === 'success' ? <CheckCircle2 size={12} /> : <X size={12} />}
                {tx.status
                }
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-xs font-bold text-slate-400">Date</span>
                <span className="text-xs font-bold text-slate-700">{new Date(tx.created_at).toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-xs font-bold text-slate-400">Reference</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">{displayRef}</span>
                  <button aria-label="Copy reference" onClick={handleCopyRef} className="text-slate-400 hover:text-emerald-600 transition-colors" data-no-capture="true">
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-xs font-bold text-slate-400">Description</span>
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
                </div>
              )}
              {isExam && (
                <div className="pt-2 space-y-3">
                  {examPin && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">PIN</span>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(examPin);
                          showToast("PIN copied", "success");
                        }}
                        className="text-xs font-bold text-emerald-700 flex items-center gap-1"
                        data-no-capture="true"
                      >
                        {examPin} <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {examCards.length > 0 && (
                    <div className="space-y-2">
                      {examCards.map((card: any, idx: number) => (
                        <div key={`exam-card-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          {card.pin && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-400">PIN {idx + 1}</span>
                              <button
                                onClick={async () => {
                                  await navigator.clipboard.writeText(card.pin);
                                  showToast("PIN copied", "success");
                                }}
                                className="text-[10px] font-bold text-emerald-700 flex items-center gap-1"
                                data-no-capture="true"
                              >
                                {card.pin} <Copy size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-3" data-no-capture="true">
                <button onClick={() => setShareOpen((v) => !v)} className="flex-1 h-12 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors" disabled={sharing}>
                  {sharing ? "Preparing..." : "Share Receipt"}
                </button>
                <button onClick={handleShareToWhatsApp} className="flex-1 h-12 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center justify-center hover:border-emerald-400">
                  Resolve Issue
                </button>
              </div>
              {shareOpen && (
                <div className="mt-3 grid grid-cols-2 gap-2" data-no-capture="true">
                  <button onClick={handleShareImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Share Image </button>
                  <button onClick={handleSaveImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Save Image </button>
                  <button onClick={handleSharePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Share PDF </button>
                  <button onClick={handleSavePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Save PDF </button>
                </div>
              )}
              {canRequeryDeposit && onRequeryDeposit && (
                <button onClick={handleRequeryDeposit} disabled={isRequerying} className="mt-3 w-full h-10 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 disabled:opacity-60" data-no-capture="true">
                  {isRequerying ? "Requerying..." : "Requery Payment Status"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = ({ user, onUpdateBalance, onUpdatePiBalance, activeTab, isGuest = false, onRequireAuth, onViewChange }: DashboardProps) => {
  const { t } = useI18n(); //  DECLARED AT COMPONENT ROOT TO STOP BROWSER REFERENCEERRORS
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [view, setView] = useState<ViewState>("Dashboard");
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);

  const [localPinHash, setLocalPinHash] = useState<string | null>(user?.pinHash || null);
  const [localPinLength, setLocalPinLength] = useState<number | null>(user?.pinLength || null);
  const [localBalances, setLocalBalances] = useState({ balance: user.balance, piBalance: user.piBalance || 0 });

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("BankCard");
  const [currentTxRef, setCurrentTxRef] = useState<string>("");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [directDeposit, setDirectDeposit] = useState<{
    accountNumber: string;
    bankName?: string;
    accountName?: string;
    expiresAt?: string;
    amount: number;
    reference: string;
  } | null>(null);
  const [depositInitError, setDepositInitError] = useState<string>("");
  const [isStartingDeposit, setIsStartingDeposit] = useState(false);
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false);
  const [isCheckingPendingDeposit, setIsCheckingPendingDeposit] = useState(false);

  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const {
    permission,
    loading: pushLoading,
    subscribeToPush,
    showInstallPrompt,
    setShowInstallPrompt,
  } = usePushNotifications(user?.id);

  const [greeting, setGreeting] = useState("");
  const [fade, setFade] = useState(true);

  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  useEffect(() => {
    const requestedView = localStorage.getItem("swifna_dashboard_view");
    if (!requestedView) return;
    if (requestedView === "DataHelpCenter") {
      setView("DataHelpCenter");
    }
    localStorage.removeItem("swifna_dashboard_view");
  }, []);

  useEffect(() => {
    if (user?.pinHash) setLocalPinHash(user.pinHash);
    if (user?.pinLength) setLocalPinLength(user.pinLength);
    setLocalBalances({ balance: user.balance, piBalance: user.piBalance || 0 });
  }, [user]);

  useEffect(() => {
    const hour = new Date().getHours();
    const firstName = user?.name?.trim()?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
    let messages: string[] = [];

    if (hour < 5) {
      messages = [`Good Night, ${firstName}! 🌙`, "You're up late! 🦉", "Don't forget to rest. 💤"];
    } else if (hour < 12) {
      messages = [`Good Morning, ${firstName}! ☀️`, "Hope you slept well? 🌿", "Let's make today productive! 🚀"];
    } else if (hour < 17) {
      messages = [`Good Afternoon, ${firstName}! 🌤️`, "How is your day going? 💼", "Stay hydrated! 💧"];
    } else if (hour < 21) {
      messages = [`Good Evening, ${firstName}! 🌇`, "Hope you're winding down. 🍵", "Review your wins for the day. 🏆"];
    } else {
      messages = [`Good Night, ${firstName}! 🌙`, "Get some rest... 💤", "A good night rest heals the body. 🛌"];
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

  useEffect(() => {
    let active = true;
    const fetchGlobalPiRate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("pi-payment-handler", {
          body: {
            action: "CREATE_PAYMENT",
            nairaAmount: 1000,
            serviceId: "00000000-0000-0000-0000-000000000000"
          }
        });
        if (active && !error && data) {
          setLivePiQuote({
            rate: Number(data.rate_ngn_per_pi || 0),
            piAmount: data.pi_amount || 0
          });
        }
      } catch (err) {
        console.warn("Global exchange compilation failure:", err);
      }
    };

    fetchGlobalPiRate();
    const globalInterval = setInterval(fetchGlobalPiRate, 180000);
    return () => {
      active = false;
      clearInterval(globalInterval);
    };
  }, []);

  const getWithdrawalFee = (amount: number) => calculateTransferServiceFee(amount);
  const getDepositFee = (amount: number, method: string) => {
    if (!amount || method === "PiNetwork") return 0;
    return calculateDepositFee(amount, method);
  };

  const fetchUser = async () => {
    if (isGuest || !user?.email) return;
    setIsRefreshingBalance(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("wallet_balance, pi_balance, pin_hash, pin_length")
        .eq("email", user.email)
        .single();

      if (data && !error) {
        setLocalPinHash(data.pin_hash || null);
        setLocalPinLength(data.pin_length || null);

        const freshNaira = Number(data.wallet_balance || 0);
        const freshPi = Number(data.pi_balance || 0);

        setLocalBalances({ balance: freshNaira, piBalance: freshPi });

        user.balance = freshNaira;
        user.wallet_balance = freshNaira;

        onUpdateBalance(freshNaira);
        if (onUpdatePiBalance) onUpdatePiBalance(freshPi);
      }

    } catch (e) {
      console.error("Profile refresh sync execution failed:", e);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  const fetchHistory = async () => {
    if (isGuest || !user?.id) return;
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setHistory(data as unknown as Transaction[]);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchHistory();
    fetchUser();
  }, [user?.email, isGuest]);

  const triggerRefresh = async () => {
    if (isGuest) return;
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
    if (delta > 0) setPullDistance(Math.min(delta, 120));
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

  const invokePiPayment = async (body: Record<string, unknown>) => {
    const normalizedBody = { ...body };
    if (body.action === "approve") normalizedBody.action = "APPROVE_PAYMENT";
    else if (body.action === "complete") normalizedBody.action = "COMPLETE_PAYMENT";
    else if (body.action === "cancel") normalizedBody.action = "CANCEL_PAYMENT";

    const { data, error } = await supabase.functions.invoke("pi-payment-handler", { body: normalizedBody });
    if (error) throw new Error("Pi gateway response validation timeout.");
    return data;
  };

  const handleIncompletePiPayment = (payment: PiPaymentDTO) => {
    const reference = String(payment?.metadata?.reference || "");
    const paymentId = String(payment?.identifier || "");
    const txid = String(payment?.transaction?.txid || "");
    if (!reference || !paymentId || !txid) return;

    void invokePiPayment({ action: "complete", reference, paymentId, txid })
      .then(async (data) => {
        if (data?.local_status === "success") {
          await fetchUser();
          await fetchHistory();
          showToast("Pending Pi settlement auto-resolved successfully.", "success");
        }
      }).catch(err => console.warn(err));
  };

  const handlePiDeposit = async (amountNum: number) => {
    showToast("Connecting to Pi Browser Node...", "info");
    await authenticatePiUser(handleIncompletePiPayment);

    const { data: quote, error: invokeError } = await supabase.functions.invoke("pi-payment-handler", {
      body: { action: "CREATE_PAYMENT", nairaAmount: amountNum, serviceId: "00000000-0000-0000-0000-000000000000" }
    });

    if (invokeError || !quote?.success) throw new Error("Price lock execution failure.");

    const reference = String(quote.reference || "");
    const piAmount = Number(quote.pi_amount || 0);

    setCurrentTxRef(reference);
    localStorage.setItem("pending_pi_deposit_ref", reference);

    await createPiPayment(
      {
        amount: piAmount,
        memo: `Swifna funding account credit ₦${amountNum.toLocaleString()}`,
        metadata: { reference, amount_ngn: amountNum, rate_ngn_per_pi: Number(quote.rate_ngn_per_pi) },
      },
      {
        onReadyForServerApproval: (paymentId) => {
          void invokePiPayment({ action: "approve", reference, paymentId });
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          void invokePiPayment({ action: "complete", reference, paymentId, txid })
            .then(async (data) => {
              if (data?.local_status !== "success") throw new Error();
              await fetchUser();
              await fetchHistory();
              setIsDepositModalOpen(false);
              setDepositAmount("");
              localStorage.removeItem("pending_pi_deposit_ref");
              showSuccess({ title: "Pi Deposit Completed", amount: amountNum, message: "Wallet allocated dynamically.", subtitle: "PI NETWORK" });
            }).catch(() => showToast("Completion verification node execution failed.", "error"));
        },
        onCancel: (paymentId) => {
          void invokePiPayment({ action: "cancel", reference, paymentId });
          localStorage.removeItem("pending_pi_deposit_ref");
          showToast("Ecosystem deposit sequence closed.", "info");
        },
        onError: (err) => showToast(err instanceof Error ? err.message : "Signature tracking failure.", "error"),
      }
    );
  };

  const handleStartDeposit = async () => {
    if (isGuest) return onRequireAuth?.();
    const amountNum = Number(depositAmount);
    if (!depositAmount || amountNum < 100) return showToast("Minimum account generation size is ₦100.", "error");

    setIsStartingDeposit(true);
    setDepositInitError("");
    setDirectDeposit(null);

    try {
      if (depositMethod === "PiNetwork") {
        await handlePiDeposit(amountNum);
        return;
      }

      const { data, error } = await supabase.functions.invoke("box-deposit", {
        body: { amount: amountNum.toString(), email: user.email, name: user.name, method: depositMethod }
      });

      if (error) throw new Error(error.message || "Gateway response mapping exception.");

      const transferPayload = data?.transfer || data?.data?.transfer || data?.data;
      if (transferPayload?.account_number) {
        const resolvedRef = String(data?.reference || data?.data?.reference || "").trim();
        if (resolvedRef) {
          setCurrentTxRef(resolvedRef);
          localStorage.setItem("pending_deposit_ref", resolvedRef);
        }
        setDirectDeposit({
          accountNumber: String(transferPayload.account_number),
          bankName: String(transferPayload.bank_name || "Squad Transfer Bank"),
          accountName: String(transferPayload.account_name || user.name),
          amount: amountNum + getDepositFee(amountNum, depositMethod),
          reference: resolvedRef,
        });
        return;
      }

      const checkoutUrl = data?.url || data?.checkout_url || data?.data?.url;
      if (checkoutUrl) {
        if (data?.reference) {
          setCurrentTxRef(data.reference);
          localStorage.setItem("pending_deposit_ref", data.reference);
        }
        setPaymentUrl(checkoutUrl);
      } else {
        throw new Error("Unable to synthesize endpoint connection.");
      }
    } catch (e: any) {
      setDepositInitError(e.message);
    } finally {
      setIsStartingDeposit(false);
    }
  };

  const verifyDeposit = async (reference: string, opts?: { silent?: boolean }) => {
    if (isGuest || !reference) return "missing";
    setIsVerifyingDeposit(true);
    try {
      await supabase.functions.invoke("squad-verify", { body: { reference } });
      const { data } = await supabase.from("transactions").select("status").eq("reference", reference).single();
      const status = String(data?.status || "").toLowerCase();

      if (status === 'success') {
        await fetchUser();
        await fetchHistory();
        setIsDepositModalOpen(false);
        setDepositAmount("");
        setDirectDeposit(null);
        setPaymentUrl(null);
        localStorage.removeItem("pending_deposit_ref");
        return "success";
      }
      if (!opts?.silent) showToast("Payment reconciliation incomplete. Please wait.", "info");
      return status;
    } catch {
      return "error";
    } finally {
      setIsVerifyingDeposit(false);
    }
  };

  const handleRetryPendingDeposit = async () => {
    const pendingRef = localStorage.getItem("pending_deposit_ref");
    if (!pendingRef) return setIsCheckingPendingDeposit(false);
    setIsCheckingPendingDeposit(true);
    const result = await verifyDeposit(pendingRef);
    if (result === "success" || result === "failed") setIsCheckingPendingDeposit(false);
  };

  useEffect(() => {
    const pendingRef = localStorage.getItem("pending_deposit_ref");
    if (!pendingRef || isGuest) return;
    setIsCheckingPendingDeposit(true);
    const interval = setInterval(async () => {
      const result = await verifyDeposit(pendingRef, { silent: true });
      if (result === "success" || result === "failed") {
        setIsCheckingPendingDeposit(false);
        clearInterval(interval);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [user?.id, isGuest]);

  const resolveAccount = async (acct: string, bank: string) => {
    if (acct.length !== 10 || !bank || isGuest) return;
    setIsResolving(true);
    setAccountName("");
    try {
      const { data } = await supabase.functions.invoke("verify-account", { body: { account_number: acct, bank_code: bank } });
      if (data?.valid) setAccountName(data.account_name);
      else setAccountName("INVALID ACCOUNT");
    } catch {
      setAccountName("SYSTEM ERROR");
    } finally {
      setIsResolving(false);
    }
  };

  const doWithdraw = async () => {
    if (isGuest) return onRequireAuth?.();
    const amount = Number(withdrawAmount);
    if (!withdrawAmount || amount <= 0) return showToast("Please enter a valid amount", "error");
    if (amount > localBalances.balance) return showToast("Insufficient local cash balance", "error");
    if (!bankCode) return showToast("Please select a destination bank", "error");
    if (accountNumber.length !== 10) return showToast("Please enter a valid 10-digit account number", "error");

    setIsWithdrawing(true);
    try {
      const withdrawalFee = getWithdrawalFee(amount);
      const totalDeduction = amount + withdrawalFee;

      if (totalDeduction > localBalances.balance) {
        showToast(`Insufficient balance to cover amount + ₦${withdrawalFee} processing fee`, "error");
        return;
      }

      const selectedBankName = BANKS.find(b => b.code === bankCode)?.name || "Unknown Bank";

      const { data, error } = await supabase.from("transactions").insert([
        {
          user_id: user.id,
          user_email: user.email,
          type: "Withdrawal",
          amount: amount,
          status: "Pending",
          reference: `WTH-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
          description: `Withdrawal to ${selectedBankName} (${accountNumber})`,
          meta: {
            bank_code: bankCode,
            bank_name: selectedBankName,
            account_number: accountNumber,
            account_name: accountName || user.name,
            fee: withdrawalFee,
            total_deducted: totalDeduction
          }
        }
      ]).select().single();

      if (error) throw error;

      // Optimistically adjust local balance state
      const newBal = localBalances.balance - totalDeduction;
      setLocalBalances(prev => ({ ...prev, balance: newBal }));
      onUpdateBalance(newBal);

      await fetchHistory();
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");

      showSuccess({
        title: "Withdrawal Requested",
        amount: amount,
        message: "Your transfer has been queued up successfully for automated settlement processing.",
        subtitle: "LOCAL BANK TRANSFER"
      });

    } catch (e: any) {
      showToast(e.message || "An error occurred while processing withdrawal request", "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const requirePin = (action: () => void) => {
    if (isGuest) return onRequireAuth?.();
    if (!localPinHash) return showToast("Please set transaction secure PIN inside profile settings.", "error");

    setPendingAction(() => action);
    setPinError("");
    setPinOpen(true);
  };

  const handlePinConfirm = async (pin: string) => {
    setPinError("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("pin_hash")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        setPinError("Security verification failed.");
        return;
      }

      if (!data.pin_hash) {
        setPinError("No PIN configured. Please go to Profile settings to set one.");
        return;
      }

      const ok = await verifyPinHash(pin, data.pin_hash, {
        userId: user.id,
        email: user.email
      });

      if (!ok) {
        setPinError("Incorrect PIN");
        return;
      }

      setPinOpen(false);
      if (pendingAction) pendingAction();

    } catch (err) {
      setPinError("System validation timeout.");
    }
  };

  const synchronizedUser = {
    ...user,
    balance: localBalances.balance,
    wallet_balance: localBalances.balance,
    piBalance: localBalances.piBalance,
    pinHash: localPinHash,
    pinLength: localPinLength
  };

  if (view === "Admin") return <Suspense fallback={lazyFallback}><AdminDashboard onBack={() => setView("Dashboard")} /></Suspense>;
  if (view === "Airtime") return <Suspense fallback={lazyFallback}><Airtime user={synchronizedUser} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "Data") return <Suspense fallback={lazyFallback}><DataBundle user={synchronizedUser} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "Cable") return <Suspense fallback={lazyFallback}><CableTv user={synchronizedUser} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "Electricity") return <Suspense fallback={lazyFallback}><Electricity user={synchronizedUser} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "Exam") return <Suspense fallback={lazyFallback}><Exams user={synchronizedUser} onUpdateBalance={onUpdateBalance} onUpdatePiBalance={onUpdatePiBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "RechargePin") return <Suspense fallback={lazyFallback}><RechargePin user={synchronizedUser} onUpdateBalance={onUpdateBalance} onUpdatePiBalance={onUpdatePiBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "AirtimeToCash") return <Suspense fallback={lazyFallback}><AirtimeToCash user={synchronizedUser} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
  if (view === "SendToUser") return <SendToUser user={synchronizedUser} onUpdateBalance={(bal) => { onUpdateBalance(bal); triggerRefresh(); }} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} />;

  const amountNum = Number(withdrawAmount) || 0;
  const depositAmountNum = Number(depositAmount) || 0;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-center" style={{ height: pullDistance ? Math.max(24, pullDistance * 0.6) : 0 }}>
        {pullDistance > 0 && <div className="text-xs font-bold text-slate-400">{pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}</div>}
      </div>

      <div className="flex items-center mb-2 mt-2 h-10">
        <h1 className={`text-2xl font-black text-slate-800 tracking-tight transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}>{greeting}</h1>
      </div>

      {isCheckingPendingDeposit && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-center gap-3">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <p className="text-xs font-bold flex-1">Synchronizing open wallet deposit nodes...</p>
          <button onClick={handleRetryPendingDeposit} className="px-3 py-1.5 rounded-lg bg-amber-100 text-[10px] font-black uppercase">Verify</button>
        </div>
      )}

      {/* WALLET CARD LAYER */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-[35px] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-75">Total Networth</p>
              <h2 className="text-3xl font-black tracking-tight">
                ₦{Number(localBalances.balance + (localBalances.piBalance * (livePiQuote?.rate || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <button onClick={() => { fetchUser(); fetchHistory(); }} className="p-2 bg-white/15 rounded-full hover:bg-white/25">
              <RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-xs space-y-1.5 w-full">
            <div className="flex justify-between items-start opacity-90">
              <span className="font-medium">π PI Network Balance:</span>
              <span className="font-bold text-right">
                {localBalances.piBalance.toLocaleString(undefined, { minimumFractionDigits: 4 })} π
                <span className="block text-[10px] opacity-75 font-normal">≈ ₦{Number(localBalances.piBalance * (livePiQuote?.rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </span>
            </div>
            <div className="flex justify-between items-center opacity-90">
              <span className="font-medium">₦ Local Cash Account:</span>
              <span className="font-bold">₦{localBalances.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={() => setIsDepositModalOpen(true)} className="flex-1 bg-white text-emerald-700 py-3.5 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2"><CreditCard size={16} /> Fund</button>
            <button onClick={() => setIsWithdrawModalOpen(true)} className="flex-1 bg-emerald-800/40 border border-white/20 text-white py-3.5 rounded-2xl font-black text-xs uppercase">Withdraw</button>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setView("SendToUser")}
              className="w-full bg-white/15 border border-white/20 hover:bg-white/25 active:scale-[0.98] transition-all text-white py-3.5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 tracking-wide"
            >
              <Send size={14} /> Send to other Swifna User (P2P)
            </button>
          </div>
        </div>
      </section>

      {/* SERVICE GRID MATRIX */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2 rounded-2xl">
        {[
          { id: "Airtime", label: "Airtime", icon: <Smartphone size={18} /> },
          { id: "Data", label: "Data Bundle", icon: <Zap size={18} /> },
          { id: "Cable", label: "Cable TV", icon: <Tv size={18} /> },
          { id: "Electricity", label: "Electricity", icon: <Building2 size={18} /> },
          { id: "Exam", label: "Exam Pins", icon: <GraduationCap size={18} /> },
          { id: "RechargePin", label: "Printing Pins", icon: <Printer size={18} /> },
        ].map((s) => (
          <button key={s.id} onClick={() => setView(s.id as ViewState)} className="flex flex-col items-center py-4 rounded-xl text-slate-500 hover:bg-white hover:text-emerald-600 hover:shadow-sm transition-all">
            {s.icon} <span className="text-[9px] font-black uppercase mt-1.5 tracking-wide">{s.label}</span>
          </button>
        ))}
      </div>

      <button onClick={() => setView("AirtimeToCash")} className="w-full p-5 rounded-[25px] flex items-center justify-between border-2 border-slate-100 bg-white group">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><RotateCcw size={20} className="rotate-90" /></div>
          <div className="text-left">
            <h3 className="font-black text-sm uppercase text-slate-800">Swap Airtime To Cash</h3>
            <p className="text-[10px] text-slate-400 font-bold">Convert excess mobile credits to local bank holdings</p>
          </div>
        </div>
        <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500" />
      </button>

      {/* RECENT USER HISTORY VIEW */}
      <div className="pt-2">
        <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-3 ml-1">Recent Activity Logs</h3>
        <div className="space-y-2">
          {history.map((tx) => (
            <button key={tx.id} onClick={() => setSelectedTx(tx)} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-slate-50 shadow-sm active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${String(tx.type).toLowerCase() === "deposit" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                  {getLogoOrIcon(tx)}
                </div>
                <div className="text-left">
                  <p className="font-bold text-xs text-slate-800 uppercase">{tx.type}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-black text-sm block ${String(tx.type).toLowerCase() === "deposit" ? "text-emerald-600" : "text-slate-800"}`}>
                  {String(tx.type).toLowerCase() === "deposit" ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-[9px] font-black uppercase ${String(tx.status).toLowerCase() === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{tx.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedTx && <ReceiptView tx={selectedTx} onClose={() => setSelectedTx(null)} onRequeryDeposit={(ref) => verifyDeposit(ref)} />}

      {/* DEPOSIT MODAL */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button
              aria-label="Close fund wallet"
              onClick={() => {
                setIsDepositModalOpen(false);
                setPaymentUrl(null);
                setDirectDeposit(null);
                setDepositInitError("");
                setDepositAmount("");
              }}
              className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-black text-center mb-6 text-slate-800">Fund Wallet</h3>

            {paymentUrl || directDeposit ? (
              <div className="text-center space-y-6 animate-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg">{directDeposit ? "Transfer Account Ready!" : "Order Created!"}</h4>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {directDeposit ? "Transfer exactly this amount to complete funding." : "Ready to complete payment."}
                  </p>
                </div>
                {directDeposit ? (
                  <div className="space-y-3 text-left bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Bank</span>
                      <span className="text-xs font-black text-slate-800">{directDeposit.bankName || "Squad Transfer"}</span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">Account Number</span>
                      <button
                        aria-label="Copy account number"
                        onClick={async () => {
                          await navigator.clipboard.writeText(directDeposit.accountNumber);
                          showToast("Account number copied", "success");
                        }}
                        className="text-xs font-black text-emerald-700 flex items-center gap-1"
                      >
                        {directDeposit.accountNumber} <Copy size={12} />
                      </button>
                    </div>
                    {!!directDeposit.accountName && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Account Name</span>
                        <span className="text-xs font-black text-slate-800">{directDeposit.accountName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Amount to Transfer</span>
                      <span className="text-xs font-black text-slate-800">
                        ₦{Number(directDeposit.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <a
                    href={paymentUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-center uppercase shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-transform active:scale-95"
                  >
                    Proceed to Checkout
                  </a>
                )}
                {directDeposit && (
                  <button
                    onClick={() => verifyDeposit(directDeposit.reference || currentTxRef)}
                    disabled={isVerifyingDeposit}
                    className="w-full border border-emerald-300 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {isVerifyingDeposit ? "Checking Payment..." : "I Have Paid, Check Now"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setPaymentUrl(null);
                    setDirectDeposit(null);
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
                {/* Payment Method Grid Selector */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { id: "BankCard", label: "Card/USSD", sublabel: "1.2%, cap ₦1,500", icon: <CreditCard size={18} /> },
                    { id: "BankTransfer", label: "Virtual Account", sublabel: "0.25%, cap ₦1,000", icon: <Building2 size={18} /> },
                    { id: "BankUssd", label: "USSD", sublabel: "1.2%, cap ₦1,500", icon: <Smartphone size={18} /> },
                    { id: "PiNetwork", label: "Pi Network", sublabel: "No fee • Crypto", icon: <span className="text-base font-black leading-none">π</span> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDepositMethod(m.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1 ${depositMethod === m.id
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                      {m.icon}
                      <span className="text-[11px] font-bold text-center leading-tight">{m.label}</span>
                      <span className="text-[9px] text-center opacity-70 leading-tight">{m.sublabel}</span>
                    </button>
                  ))}
                </div>

                {/* Predefined Quick Amount Chips */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                  {[100, 500, 1000, 2000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(amt.toString())}
                      className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl text-xs font-bold text-slate-600 transition-colors whitespace-nowrap"
                    >
                      ₦{Number(amt).toLocaleString()}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200 focus:border-emerald-500 transition-colors text-slate-800"
                  placeholder={depositMethod === "PiNetwork" ? "Enter NGN amount to fund" : "Amount (₦)"}
                />

                {/* Pi Network live rate info */}
                {depositMethod === "PiNetwork" && (
                  <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 space-y-2 text-left">
                    <div className="flex items-center gap-2 text-purple-700 mb-1">
                      <span className="text-base font-black">π</span>
                      <span className="text-[11px] font-black uppercase tracking-wide">Pi Network Payment</span>
                    </div>
                    {livePiQuote ? (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-600 font-bold">Live Rate</span>
                          <span className="font-black text-purple-800">1 π ≈ ₦{livePiQuote.rate.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-600 font-bold">You will pay</span>
                          <span className="font-black text-purple-900 text-base">π {(Number(depositAmount || 0) * (1 / livePiQuote.rate)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-purple-400">Enter an NGN amount above to see the Pi equivalent.</p>
                    )}
                  </div>
                )}

                {/* Processing Fee Summary */}
                {depositMethod !== "PiNetwork" && (
                  <>
                    <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs text-slate-600 flex justify-between items-center border border-slate-100">
                      <span>Processing Fee:</span>
                      <span className="font-bold">₦{Number(getDepositFee(Number(depositAmount || 0), depositMethod)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-sm font-bold text-slate-800 px-1">
                      <span>Total Payable:</span>
                      <span>₦{Number(Number(depositAmount || 0) + getDepositFee(Number(depositAmount || 0), depositMethod)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleStartDeposit}
                  disabled={isStartingDeposit || (depositMethod === "PiNetwork" && !livePiQuote)}
                  className={`w-full py-4 rounded-2xl font-black uppercase shadow-lg transition flex justify-center items-center gap-2 h-14 disabled:opacity-70 ${depositMethod === "PiNetwork"
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    }`}
                >
                  {isStartingDeposit ? (
                    <Loader2 className="animate-spin" />
                  ) : depositMethod === "PiNetwork" ? (
                    livePiQuote
                      ? `Pay π ${(Number(depositAmount || 0) * (1 / livePiQuote.rate)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                      : "Select amount to continue"
                  ) : (
                    `Pay ₦${Number(Number(depositAmount || 0) + getDepositFee(Number(depositAmount || 0), depositMethod)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                  )}
                </button>
                {!!depositInitError && (
                  <p className="mt-3 text-[11px] font-bold text-rose-600 break-all">{depositInitError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAWAL OVERLAY */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button
              aria-label="Close withdrawal modal"
              onClick={() => {
                setIsWithdrawModalOpen(false);
                setWithdrawAmount("");
                setBankCode("");
                setAccountNumber("");
                setAccountName("");
              }}
              className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-black text-center mb-6 text-slate-800">Withdraw Funds</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 ml-1">Destination Bank</label>
                <select
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={bankCode}
                  onChange={(e) => {
                    setBankCode(e.target.value);
                    if (accountNumber.length === 10) resolveAccount(accountNumber, e.target.value);
                  }}
                >
                  {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 ml-1">Account Number</label>
                <input
                  type="text"
                  maxLength={10}
                  className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 bg-slate-50 outline-none focus:border-emerald-500 transition-colors"
                  placeholder="10-Digit NUBAN Account"
                  value={accountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setAccountNumber(val);
                    if (val.length === 10 && bankCode) resolveAccount(val, bankCode);
                  }}
                />
              </div>

              {/* Beneficiary Verification Container */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 min-h-[48px] flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-black">Account Name:</span>
                <span className="font-black text-slate-800 text-right">
                  {isResolving ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 animate-pulse"><Loader2 size={12} className="animate-spin" /> Verifying...</span>
                  ) : (
                    accountName || "Awaiting Details..."
                  )}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 ml-1">Amount to Transfer</label>
                <input
                  type="number"
                  className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Amount (₦)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>

              {/* Fee & Calculation Summary */}
              {Number(withdrawAmount) > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>Processing Fee:</span>
                    <span>₦{getWithdrawalFee(Number(withdrawAmount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-800 font-black border-t border-slate-200/60 pt-2">
                    <span>Total Account Deduction:</span>
                    <span className="text-emerald-700">₦{(Number(withdrawAmount) + getWithdrawalFee(Number(withdrawAmount))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => requirePin(doWithdraw)}
                disabled={isWithdrawing || !withdrawAmount || !accountNumber || isResolving || (accountName && accountName.includes("INVALID"))}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl uppercase text-xs tracking-wider shadow-lg shadow-emerald-600/10 active:scale-[0.98] transition-all h-14 flex items-center justify-center"
              >
                {isWithdrawing ? <Loader2 className="animate-spin" /> : "Confirm & Send Funds"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PinPrompt open={pinOpen} requiredLength={localPinLength} onConfirm={handlePinConfirm} onClose={() => setPinOpen(false)} error={pinError} />
    </div>
  );
};

export default Dashboard;