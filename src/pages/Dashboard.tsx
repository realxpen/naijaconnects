import React, { Suspense, useState, useEffect, useRef } from "react";
import {
  Smartphone, Tv, Zap, ArrowRight, X, Loader2,
  RotateCcw, CreditCard, GraduationCap,
  Printer, Building2, Activity, ShieldCheck, AlertCircle, CheckCircle2, Copy
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
import { calculateDepositFee, calculateTransferServiceFee } from "../utils/paymentFees";
import { useSuccessScreen } from "../components/ui/SuccessScreenProvider";
import { usePushNotifications } from "../hooks/usePushNotifications";
import InstallPwaModal from "../components/InstallPwaModal";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../services/piNetworkService";

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

// --- INTERFACES ---
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
    pinLength?: number | null
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

type ViewState = "Dashboard" | "Airtime" | "Data" | "Cable" | "Electricity" | "Exam" | "RechargePin" | "AirtimeToCash" | "Admin" | "DataHelpCenter";

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

// --- COMPONENT: RECEIPT VIEW WITH ENHANCED METADATA EXTRACTORS ---
const ReceiptView = ({
  tx,
  onClose,
  onRequeryDeposit,
}: {
  tx: Transaction;
  onClose: () => void;
  onRequeryDeposit?: (reference: string) => Promise<any>;
}) => {
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
  const examProviderRef = String(meta?.provider_reference || meta?.reference || "").trim();
  const canRequeryDeposit =
    isDeposit &&
    !!txReference &&
    ["pending", "failed"].includes(String(tx.status || "").toLowerCase());
  const depositFee = Number(meta?.estimated_fee || 0);
  const totalPaid = Number(meta?.total_paid || ((Number(tx.amount) || 0) + depositFee));
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isRequerying, setIsRequerying] = useState(false);
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

  const handleRequeryDeposit = async () => {
    if (!onRequeryDeposit || !txReference || isRequerying) return;
    setIsRequerying(true);
    try {
      await onRequeryDeposit(txReference);
    } finally {
      setIsRequerying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm relative">
        <button aria-label="Close receipt" onClick={onClose} className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors">
          <X size={20} />
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
                  <button aria-label="Copy reference" onClick={handleCopyRef} className="text-slate-400 hover:text-emerald-600 transition-colors">
                    <Copy size={12} />
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
                  <button onClick={handleShareImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Share Image </button>
                  <button onClick={handleSaveImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Save Image </button>
                  <button onClick={handleSharePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Share PDF </button>
                  <button onClick={handleSavePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"> Save PDF </button>
                </div>
              )}
              {canRequeryDeposit && onRequeryDeposit && (
                <button
                  onClick={handleRequeryDeposit}
                  disabled={isRequerying}
                  className="mt-3 w-full h-10 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 disabled:opacity-60"
                  data-no-capture="true"
                >
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
  const pendingDepositPollRef = useRef<number | null>(null);

  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  // Withdraw & Internal Transfer parameters
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferRecipientEmail, setTransferRecipientEmail] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [isSendingTransfer, setIsSendingTransfer] = useState(false);
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [saveWithdrawBeneficiary, setSaveWithdrawBeneficiary] = useState(true);
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [recentWithdraws, setRecentWithdraws] = useState<any[]>([]);
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

  // --- DYNAMIC GREETING INTERVAL ENGINE ---
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

  // --- GLOBAL REALTIME BACKUP QUOTE CONTEXT ---
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
    if (isGuest) return;
    try {
      const { data } = await supabase.from("profiles").select("wallet_balance, pi_balance").eq("email", user.email).single();
      if (data) {
        onUpdateBalance(Number(data.wallet_balance || 0));
        if (onUpdatePiBalance) onUpdatePiBalance(Number(data.pi_balance || 0));
      }
    } catch (e) { console.error(e); }
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
  }, [user.email, isGuest]);

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

      const { data, error } = await supabase.functions.invoke("squad-deposit", {
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
  }, [user.id, isGuest]);

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
    const amount = Number(withdrawAmount);
    const fee = getWithdrawalFee(amount);
    setIsWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke("squad-withdraw", {
        body: { amount, fee, bank_code: bankCode, bank_name: BANKS.find(b => b.code === bankCode)?.name, account_number: accountNumber, account_name: accountName }
      });
      if (error || !data?.success) throw new Error(data?.message || "Settlement failed.");
      await fetchUser();
      await fetchHistory();
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      showSuccess({ title: "Withdrawal Submitted", amount: amount + fee, message: "Funds dispatch in queue." });
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const doSendTransfer = async () => {
    const amount = Number(transferAmount);
    setIsSendingTransfer(true);
    try {
      const { data, error } = await supabase.rpc("transfer_wallet_to_user", { p_recipient_email: transferRecipientEmail.trim().toLowerCase(), p_amount: amount, p_note: transferNote });
      if (error) throw error;
      onUpdateBalance(Number((data as any)?.sender_balance_after));
      await fetchHistory();
      setIsTransferModalOpen(false);
      setTransferAmount("");
      showSuccess({ title: "Transfer Successful", amount, message: "User account funded instantly." });
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsSendingTransfer(false);
    }
  };

  const requirePin = (action: () => void) => {
    if (isGuest) return onRequireAuth?.();
    if (!user?.pinHash) return showToast("Please set transaction secure PIN inside profile.", "error");
    setPendingAction(() => action);
    setPinError("");
    setPinOpen(true);
  };

  const handlePinConfirm = async (pin: string) => {
    const ok = await verifyPinHash(pin, user.pinHash || "", { userId: user.id, email: user.email });
    if (!ok) return setPinError("Incorrect PIN");
    setPinOpen(false);
    if (pendingAction) pendingAction();
  };

  const renderContent = () => {
    switch (view) {
      case "Admin": return <Suspense fallback={lazyFallback}><AdminDashboard onBack={() => setView("Dashboard")} /></Suspense>;
      case "Airtime": return <Suspense fallback={lazyFallback}><Airtime user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      case "Data": return <Suspense fallback={lazyFallback}><DataBundle user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      case "Cable": return <Suspense fallback={lazyFallback}><CableTv user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      case "Electricity": return <Suspense fallback={lazyFallback}><Electricity user={user} onUpdateBalance={onUpdateBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      case "Exam": return <Suspense fallback={lazyFallback}><Exams user={user} onUpdateBalance={onUpdateBalance} onUpdatePiBalance={onUpdatePiBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      case "RechargePin": return <Suspense fallback={lazyFallback}><RechargePin user={user} onUpdateBalance={onUpdateBalance} onUpdatePiBalance={onUpdatePiBalance} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      case "AirtimeToCash": return <Suspense fallback={lazyFallback}><AirtimeToCash user={user} onBack={() => setView("Dashboard")} isGuest={isGuest} onRequireAuth={onRequireAuth} /></Suspense>;
      default: return renderDashboardHome();
    }
  };

  const renderDashboardHome = () => {
    const { t } = useI18n();
    const amountNum = Number(withdrawAmount) || 0;
    const currentWithdrawFee = getWithdrawalFee(amountNum);
    const depositAmountNum = Number(depositAmount) || 0;
    const currentDepositFee = getDepositFee(depositAmountNum, depositMethod);

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
                <p className="text-[9px] font-black uppercase tracking-widest opacity-75">Combined Net Asset Valuation</p>
                <h2 className="text-3xl font-black tracking-tight">
                  ₦{Number(user.balance + ((user.piBalance || 0) * (livePiQuote?.rate || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <button onClick={() => { fetchUser(); fetchHistory(); }} className="p-2 bg-white/15 rounded-full hover:bg-white/25">
                <RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 text-xs space-y-1.5 w-full">
              <div className="flex justify-between items-start opacity-90">
                <span className="font-medium">π Blockchain Balance:</span>
                <span className="font-bold text-right">
                  {(user.piBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 4 })} π
                  <span className="block text-[10px] opacity-75 font-normal">≈ ₦{Number((user.piBalance || 0) * (livePiQuote?.rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </span>
              </div>
              <div className="flex justify-between items-center opacity-90">
                <span className="font-medium">₦ Local Cash Account:</span>
                <span className="font-bold">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setIsDepositModalOpen(true)} className="flex-1 bg-white text-emerald-700 py-3.5 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2"><CreditCard size={16} /> Fund</button>
              <button onClick={() => setIsWithdrawModalOpen(true)} className="flex-1 bg-emerald-800/40 border border-white/20 text-white py-3.5 rounded-2xl font-black text-xs uppercase">Withdraw</button>
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

        {/* FUNDING VIEW ACCOUNTS OVERLAY */}
        {isDepositModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
              <button onClick={() => { setIsDepositModalOpen(false); setPaymentUrl(null); setDirectDeposit(null); }} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={16} /></button>
              <h3 className="text-xl font-black text-center mb-6 text-slate-800">Account Funding Options</h3>

              {paymentUrl || directDeposit ? (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
                  <h4 className="font-black text-slate-800 text-base">{directDeposit ? "Transfer Coordinates Loaded" : "Gateway Endpoint Generated"}</h4>

                  {directDeposit && (
                    <div className="space-y-2 text-left bg-slate-50 border p-4 rounded-2xl text-xs font-bold text-slate-700">
                      <div className="flex justify-between"><span>Bank:</span><span>{directDeposit.bankName}</span></div>
                      <div className="flex justify-between items-center"><span>Account:</span><button onClick={() => { navigator.clipboard.writeText(directDeposit.accountNumber); showToast("Copied", "success"); }} className="text-emerald-700 font-black flex items-center gap-1">{directDeposit.accountNumber} <Copy size={12} /></button></div>
                      <div className="flex justify-between"><span>Amount:</span><span>₦{directDeposit.amount.toLocaleString()}</span></div>
                    </div>
                  )}

                  {paymentUrl && <a href={paymentUrl} className="block w-full bg-emerald-600 text-white text-center py-4 rounded-xl font-black uppercase">Open Web Checkout</a>}
                  {directDeposit && <button onClick={() => verifyDeposit(directDeposit.reference)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black">Check Settlement</button>}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[{ id: "BankCard", label: "Card / USSD" }, { id: "BankTransfer", label: "Virtual Bank Account" }, { id: "PiNetwork", label: "π External Blockchain" }].map(m => (
                      <button key={m.id} onClick={() => setDepositMethod(m.id)} className={`p-3 border rounded-xl text-xs font-bold ${depositMethod === m.id ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white"}`}>{m.label}</button>
                    ))}
                  </div>

                  <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl font-black mb-4 outline-none" placeholder="Enter Amount (₦)" />

                  {depositMethod === "PiNetwork" && livePiQuote && (
                    <div className="mb-4 bg-purple-50 text-purple-800 border-purple-200 border p-4 rounded-xl text-xs font-bold space-y-1">
                      <div className="flex justify-between"><span>Exchange Standard Lock:</span><span>1 π ≈ ₦{livePiQuote.rate.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm font-black"><span>Total Crypto Pay:</span><span>{livePiQuote.piAmount.toLocaleString()} π</span></div>
                    </div>
                  )}

                  <button onClick={handleStartDeposit} disabled={isStartingDeposit} className="w-full py-4 bg-slate-900 text-white font-black uppercase rounded-xl flex items-center justify-center h-14">
                    {isStartingDeposit ? <Loader2 className="animate-spin" /> : "Initialize Settlement"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* WITHDRAWAL OVERLAY */}
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
              <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={16} /></button>
              <h3 className="text-xl font-black text-center mb-6 text-slate-800">Dispatch Local Funds</h3>

              <select className="w-full p-3 border rounded-xl bg-white mb-3 text-xs font-bold" value={bankCode} onChange={(e) => { setBankCode(e.target.value); if (accountNumber.length === 10) resolveAccount(accountNumber, e.target.value); }}>
                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>

              <input type="text" maxLength={10} className="w-full p-3 border rounded-xl mb-3 text-xs font-bold" placeholder="Destination Account Number" value={accountNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setAccountNumber(val); if (val.length === 10 && bankCode) resolveAccount(val, bankCode); }} />

              <div className="p-3 bg-slate-50 border rounded-xl text-xs font-black text-emerald-800 mb-3 min-h-[40px] flex items-center">
                {isResolving ? <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Verifying Signatures...</span> : <span>{accountName || "Awaiting complete tracking logs..."}</span>}
              </div>

              <input type="number" className="w-full p-3 border rounded-xl mb-4 text-xs font-black" placeholder="Amount (₦)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />

              <button onClick={() => requirePin(doWithdraw)} disabled={isWithdrawing || !accountName || accountName.includes("INVALID")} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase">Execute Transfer</button>
            </div>
          </div>
        )}

        <PinPrompt open={pinOpen} requiredLength={user?.pinLength || null} onConfirm={handlePinConfirm} onClose={() => setPinOpen(false)} error={pinError} />
      </div>
    );
  };

  return renderContent();
};

export default Dashboard;