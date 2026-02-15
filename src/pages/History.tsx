import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, Activity, CheckCircle2, Search, ArrowUpRight, ArrowDownLeft, Calendar,
  Smartphone, Zap, Tv, GraduationCap, Printer, ArrowLeftRight, Loader2, X, Copy,
  BarChart3, LineChart, PieChart
} from 'lucide-react';
import { supabase } from "../supabaseClient";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useI18n } from '../i18n';
import { useToast } from "../components/ui/ToastProvider";

// --- LOGO IMPORTS ---
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

interface Transaction {
  id: string; // Changed to string to match UUID
  created_at: string;
  type: string;
  amount: number;
  status: string;
  ref?: string;
  reference?: string;
  request_id?: string;
  user_id?: string;
  description?: string; 
  meta?: any; 
}

const History = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  
  // --- VISUALIZATION STATE ---
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut'>('bar');

  // --- RECEIPT STATE ---
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // --- FETCH DATA (FIXED) ---
  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch by user_id OR fallback to user_email for legacy rows
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
        .order('created_at', { ascending: false }); // No limit = show all

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    // 2. Add Realtime Listener (Updates history instantly)
    const channel = supabase
      .channel('history_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
            // Only refresh if it affects the current user (optional check, or just refresh)
            fetchTransactions();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- STATISTICS (Case Insensitive) ---
  const stats = useMemo(() => {
    const totalSpent = transactions
      .filter(t => t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const successCount = transactions.filter(t => t.status.toLowerCase() === 'success').length;
    const totalCount = transactions.length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

    return { totalSpent, successRate, totalTx: totalCount };
  }, [transactions]);

  // --- PREPARE CHART DATA ---
  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return d;
    });

    return last7Days.map(date => {
      const dayStr = date.toLocaleDateString();
      const dayName = days[date.getDay()];
      const dailyAmount = transactions
        .filter(t => {
            const tDate = new Date(t.created_at).toLocaleDateString();
            return tDate === dayStr && t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return { day: dayName, amount: dailyAmount };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    let total = 0;

    transactions.forEach(t => {
        if (t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success') {
            categories[t.type] = (categories[t.type] || 0) + t.amount;
            total += t.amount;
        }
    });

    return Object.keys(categories).map(key => ({
        name: key,
        value: categories[key],
        percentage: total > 0 ? Math.round((categories[key] / total) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const maxChartValue = Math.max(...weeklyData.map(d => d.amount), 100);

  // --- FILTERING ---
  const filteredList = transactions.filter(t => {
    const matchesType = filter === 'All' || t.type.toLowerCase() === filter.toLowerCase();
    const ref = t.ref || t.reference || "";
    const matchesSearch = 
        ref.toLowerCase().includes(search.toLowerCase()) || 
        t.type.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  // --- LOGO LOGIC ---
  const getLogoOrIcon = (transaction: Transaction) => {
      const desc = (transaction.description || "").toUpperCase();
      const type = (transaction.type || "").toUpperCase();
      const combined = desc + " " + type; 

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

      switch(transaction.type) {
          case 'Airtime': return <Smartphone size={18} />;
          case 'Data': return <Zap size={18} />;
          case 'Cable': return <Tv size={18} />;
          case 'Electricity': return <Zap size={18} />;
          case 'Exam': return <GraduationCap size={18} />;
          case 'RechargePin': return <Printer size={18} />;
          case 'Deposit': return <ArrowDownLeft size={18} />;
          case 'withdrawal': // Lowercase match
          case 'Withdrawal': return <ArrowUpRight size={18} />;
          case 'AirtimeToCash': return <ArrowLeftRight size={18} />;
          default: return <Activity size={18} />;
      }
  };

  const getColorClass = (type: string) => {
      const t = type.toLowerCase();
      if (t === 'deposit') return 'bg-emerald-100 text-emerald-600';
      if (t === 'withdrawal') return 'bg-rose-100 text-rose-600';
      if (t === 'airtimetocash') return 'bg-orange-100 text-orange-600';
      return 'bg-slate-100 text-slate-600';
  };

  // --- RECEIPT VIEW COMPONENT (match Dashboard) ---
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
                            <h2 className="text-3xl font-black text-slate-800">{"\u20A6"}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
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
                                {(meta.units_purchased || meta.units) && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Units Purchased</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{meta.units_purchased || meta.units}</span>
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
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{t("history.loading")}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. HEADER */}
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t("history.activity")}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("history.financial_overview")}</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
           <Calendar size={10} /> {t("common.recent")}
        </div>
      </div>

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 text-white p-5 rounded-[30px] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={80} /></div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{t("history.total_spent")}</p>
          <h3 className="text-2xl font-black">₦{stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <p className="text-[9px] text-slate-500 font-bold mt-1">{t("history.lifetime_spending")}</p>
        </div>

        <div className="space-y-3">
           <div className="bg-white dark:bg-slate-800 p-4 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t("history.transactions")}</p>
                   <h3 className="text-xl font-black dark:text-white">{stats.totalTx}</h3>
                 </div>
                 <div className="bg-blue-50 text-blue-600 p-2 rounded-full"><Activity size={16}/></div>
              </div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-4 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t("history.success_rate")}</p>
                   <h3 className="text-xl font-black dark:text-white">{stats.successRate}%</h3>
                 </div>
                 <div className="bg-emerald-50 text-emerald-600 p-2 rounded-full"><CheckCircle2 size={16}/></div>
              </div>
           </div>
        </div>
      </div>

      {/* 3. DYNAMIC VISUALIZATION CHART */}
      <section className="bg-white dark:bg-slate-800 p-6 rounded-[35px] shadow-sm border border-slate-100 dark:border-slate-700">
         <div className="flex justify-between items-center mb-6">
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{t("history.spending_analysis")}</h3>
             {/* CHART SWITCHER */}
             <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-full">
                 <button onClick={() => setChartType('bar')} className={`p-2 rounded-full transition-all ${chartType === 'bar' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>
                     <BarChart3 size={14}/>
                 </button>
                 <button onClick={() => setChartType('line')} className={`p-2 rounded-full transition-all ${chartType === 'line' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>
                     <LineChart size={14}/>
                 </button>
                 <button onClick={() => setChartType('donut')} className={`p-2 rounded-full transition-all ${chartType === 'donut' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>
                     <PieChart size={14}/>
                 </button>
             </div>
         </div>

         {/* VISUALIZATION CONTENT */}
         <div className="h-40 relative">
            
            {/* VIEW 1: BAR CHART */}
            {chartType === 'bar' && (
                <div className="flex items-end justify-between h-full gap-2">
                    {weeklyData.map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative flex items-end overflow-hidden" style={{height: '100%'}}>
                            <div 
                            className="w-full bg-emerald-500 rounded-t-lg transition-all duration-1000 group-hover:bg-emerald-400"
                            style={{ height: `${(day.amount / (maxChartValue || 1)) * 100}%` }}
                            ></div>
                            {/* Tooltip */}
                            {day.amount > 0 && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    ₦{day.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{day.day.charAt(0)}</span>
                    </div>
                    ))}
                </div>
            )}

            {/* VIEW 2: LINE CHART (SVG) */}
            {chartType === 'line' && (
                <div className="h-full w-full relative flex flex-col justify-between">
                    <svg className="w-full h-[85%] overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            points={weeklyData.map((d, i) => {
                                const x = (i / (weeklyData.length - 1)) * 100;
                                const y = 100 - ((d.amount / (maxChartValue || 1)) * 100);
                                return `${x},${y}`;
                            }).join(' ')}
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Dots */}
                        {weeklyData.map((d, i) => (
                            <circle 
                                key={i}
                                cx={(i / (weeklyData.length - 1)) * 100}
                                cy={100 - ((d.amount / (maxChartValue || 1)) * 100)}
                                r="1.5" 
                                fill="white"
                                stroke="#10b981"
                                strokeWidth="0.5"
                                className="hover:r-2 transition-all cursor-pointer"
                            >
                                <title>₦{d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</title>
                            </circle>
                        ))}
                    </svg>
                    <div className="flex justify-between mt-2">
                        {weeklyData.map((d, i) => (
                            <span key={i} className="text-[9px] font-bold text-slate-400 uppercase w-4 text-center">{d.day.charAt(0)}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW 3: DONUT CHART (Categories) */}
            {chartType === 'donut' && (
                <div className="flex h-full items-center justify-center gap-6">
                    {/* Simple CSS Conic Gradient Donut */}
                    <div className="w-32 h-32 rounded-full relative" 
                         style={{ 
                             background: `conic-gradient(
                                 #10b981 0% ${categoryData[0]?.percentage || 0}%, 
                                 #f59e0b ${categoryData[0]?.percentage || 0}% ${(categoryData[0]?.percentage || 0) + (categoryData[1]?.percentage || 0)}%, 
                                 #3b82f6 ${(categoryData[0]?.percentage || 0) + (categoryData[1]?.percentage || 0)}% 100%
                             )` 
                         }}>
                        <div className="absolute inset-4 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-col">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t("history.top")}</span>
                            <span className="text-lg font-black text-slate-800 dark:text-white">{categoryData[0]?.name || t("history.na")}</span>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="space-y-2">
                        {categoryData.slice(0, 3).map((cat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{cat.name}</p>
                                    <p className="text-xs font-black text-slate-800 dark:text-white">{cat.percentage}%</p>
                                </div>
                            </div>
                        ))}
                        {categoryData.length === 0 && <p className="text-xs text-slate-400">{t("history.no_data")}</p>}
                    </div>
                </div>
            )}

         </div>
      </section>

      {/* 4. SEARCH & LIST */}
      <section>
        <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                    type="text" 
                    placeholder={t("history.search_transactions")} 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold outline-none border border-slate-100 dark:border-slate-700 focus:border-emerald-500 transition-colors"
                />
            </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
           {[
             { key: 'All', label: t("history.filter.all") },
             { key: 'Deposit', label: t("history.filter.deposit") },
             { key: 'Withdrawal', label: t("dashboard.withdraw") },
             { key: 'Airtime', label: t("dashboard.airtime") },
             { key: 'Data', label: t("dashboard.data") },
             { key: 'Cable', label: t("dashboard.cable") },
             { key: 'Electricity', label: t("dashboard.electricity") },
             { key: 'Exam', label: t("dashboard.exam") },
             { key: 'RechargePin', label: t("dashboard.recharge_pin") }
           ].map(cat => (
             <button 
               key={cat.key} 
               onClick={() => setFilter(cat.key)}
               className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${filter === cat.key ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
             >
               {cat.label}
             </button>
           ))}
        </div>

        {/* TRANSACTION LIST */}
        <div className="space-y-3">
          {filteredList.length === 0 ? (
             <div className="text-center py-10 opacity-40">
                <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-black text-sm uppercase text-slate-300">{t("history.no_transactions_found")}</p>
             </div>
          ) : (
             filteredList.map((tx) => (
               <button 
                  key={tx.id} 
                  onClick={() => setSelectedTx(tx)} 
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-50 dark:border-slate-700 shadow-sm hover:border-emerald-200 transition-colors group text-left"
               >
                  <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg p-1 ${getColorClass(tx.type)}`}>
                          <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-full">
                            {getLogoOrIcon(tx)}
                          </div>
                      </div>
                      <div>
                          <h4 className="font-black text-xs uppercase dark:text-white tracking-tight">{tx.type}</h4>
                          <p className="text-[9px] font-bold text-slate-400">{new Date(tx.created_at).toLocaleString()}</p>
                          <p className="text-[8px] font-mono text-slate-300 mt-0.5 max-w-[150px] truncate">
                             {tx.ref || tx.reference || `TRX-${tx.id}`}
                          </p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className={`font-black text-sm ${tx.type.toLowerCase() === 'deposit' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
                          {tx.type.toLowerCase() === 'deposit' ? '+' : '-'}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${tx.status.toLowerCase() === 'success' ? 'text-emerald-500' : tx.status.toLowerCase() === 'pending' ? 'text-orange-400' : 'text-rose-500'}`}>
                          {tx.status}
                      </p>
                  </div>
               </button>
             ))
          )}
        </div>
      </section>

      {/* RENDER RECEIPT MODAL */}
      {selectedTx && (
          <ReceiptView tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}

    </div>
  );
};

export default History;
