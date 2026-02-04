import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, Activity, CheckCircle2, Search, ArrowUpRight, ArrowDownLeft, Calendar,
  Smartphone, Zap, Tv, GraduationCap, Printer, ArrowLeftRight, Loader2, X, Share2, Download, Copy, 
  Image as ImageIcon, FileText, BarChart3, LineChart, PieChart
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
  id: number;
  created_at: string;
  type: string;
  amount: number;
  status: string;
  ref?: string;
  reference?: string;
  request_id?: string;
  user_email?: string;
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

  // --- FETCH DATA ---
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
          setLoading(false);
          return; 
        }

        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setTransactions(data || []);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  // --- STATISTICS ---
  const stats = useMemo(() => {
    const totalSpent = transactions
      .filter(t => t.type !== 'Deposit' && t.status === 'Success')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const successCount = transactions.filter(t => t.status === 'Success').length;
    const totalCount = transactions.length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

    return { totalSpent, successRate, totalTx: totalCount };
  }, [transactions]);

  // --- PREPARE CHART DATA ---
  
  // 1. Weekly Data (For Bar/Line)
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
            return tDate === dayStr && t.type !== 'Deposit' && t.status === 'Success';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return { day: dayName, amount: dailyAmount };
    });
  }, [transactions]);

  // 2. Category Data (For Donut)
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    let total = 0;

    transactions.forEach(t => {
        if (t.type !== 'Deposit' && t.status === 'Success') {
            categories[t.type] = (categories[t.type] || 0) + t.amount;
            total += t.amount;
        }
    });

    // Convert to array and sort
    return Object.keys(categories).map(key => ({
        name: key,
        value: categories[key],
        percentage: total > 0 ? Math.round((categories[key] / total) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const maxChartValue = Math.max(...weeklyData.map(d => d.amount), 100);

  // --- FILTERING ---
  const filteredList = transactions.filter(t => {
    const matchesType = filter === 'All' || t.type === filter;
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
          case 'Withdrawal': return <ArrowUpRight size={18} />;
          case 'AirtimeToCash': return <ArrowLeftRight size={18} />;
          default: return <Activity size={18} />;
      }
  };

  const getColorClass = (type: string) => {
      if (type === 'Deposit') return 'bg-emerald-100 text-emerald-600';
      if (type === 'Withdrawal') return 'bg-rose-100 text-rose-600';
      if (type === 'AirtimeToCash') return 'bg-orange-100 text-orange-600';
      return 'bg-slate-100 text-slate-600';
  };

  // --- RECEIPT VIEW COMPONENT ---
  const ReceiptView = ({ tx, onClose }: { tx: Transaction; onClose: () => void }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [saveMenuOpen, setSaveMenuOpen] = useState(false);

    const displayRef = tx.ref || tx.reference || tx.request_id || `TRX-${tx.id}`;

    const generateImage = async (): Promise<Blob | null> => {
        if (!receiptRef.current) return null;
        try {
            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: '#ffffff',
                scale: 2, 
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
                        text: t("dashboard.receipt_for", { type: tx.type, amount: tx.amount }),
                        files: [file]
                    });
                } catch (e) {
                    console.log("Share cancelled or failed", e);
                }
            } else {
                showToast(t("history.share_not_supported"), "info");
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
            const canvas = await html2canvas(receiptRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`receipt_${displayRef}.pdf`);
            setSaveMenuOpen(false);
        } catch (e) {
            showToast(t("dashboard.error_generating_pdf"), "error");
        }
        setIsGenerating(false);
    };

    const handleCopyRef = () => {
        navigator.clipboard.writeText(displayRef).then(() => {
            showToast(t("history.reference_copied_clipboard"), "success");
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full max-w-sm relative">
                <button onClick={onClose} className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors">
                    <X size={20}/>
                </button>

                <div ref={receiptRef} className="bg-white rounded-[30px] overflow-hidden shadow-2xl relative">
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
                            <h2 className="text-3xl font-black text-slate-800">₦{tx.amount.toLocaleString()}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{tx.type}</p>
                            
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${tx.status === 'Success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {tx.status === 'Success' ? <CheckCircle2 size={12}/> : <X size={12}/>}
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
                            
                            {tx.meta && tx.meta.pin && (
                                <div className="bg-slate-100 p-3 rounded-xl text-center mt-2 border border-dashed border-slate-300">
                                    <p className="text-[10px] font-black uppercase text-slate-400">{t("history.pin_token")}</p>
                                    <p className="text-xl font-black text-slate-800 tracking-widest select-all">{tx.meta.pin}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center opacity-30">
                            <p className="font-black text-xs uppercase">{t("app.name")}</p>
                            <p className="text-[8px] font-bold">{t("history.generated_receipt")}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex gap-3">
                    <button onClick={handleShare} disabled={isGenerating} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg">
                        {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Share2 size={16}/>} {t("common.share")}
                    </button>
                    
                    <div className="relative flex-1">
                        <button onClick={() => setSaveMenuOpen(!saveMenuOpen)} disabled={isGenerating} className="w-full bg-white text-slate-700 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-lg">
                            <Download size={16}/> {t("common.save")}
                        </button>

                        {saveMenuOpen && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2">
                                <button onClick={handleSaveImage} className="w-full p-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100">
                                    <ImageIcon size={14} className="text-emerald-600"/> {t("common.save_image")}
                                </button>
                                <button onClick={handleSavePDF} className="w-full p-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center gap-2">
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
          <h3 className="text-2xl font-black">₦{stats.totalSpent.toLocaleString()}</h3>
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
                                    ₦{day.amount.toLocaleString()}
                                </div>
                            )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{day.day}</span>
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
                                r="1.5" // visual size depends on scaling, using small value
                                fill="white"
                                stroke="#10b981"
                                strokeWidth="0.5"
                                className="hover:r-2 transition-all cursor-pointer"
                            >
                                <title>₦{d.amount.toLocaleString()}</title>
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
                      <p className={`font-black text-sm ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
                          {tx.type === 'Deposit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                      </p>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${tx.status === 'Success' ? 'text-emerald-500' : tx.status === 'Pending' ? 'text-orange-400' : 'text-rose-500'}`}>
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
