import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Activity, CheckCircle2, Search, ArrowUpRight, ArrowDownLeft, Calendar,
  Smartphone, Zap, Tv, GraduationCap, Printer, ArrowLeftRight, Loader2, PieChart, LineChart, BarChart3
} from 'lucide-react';
import { supabase } from "../supabaseClient";
import { useI18n } from '../i18n';

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

// --- COMPONENT IMPORTS ---
import ReceiptModal, { Transaction } from '../components/ReceiptModal';

// --- GLOBAL MULTI-CURRENCY EXTRACTION RESOLVER ---
const getCurrencyDetails = (tx: Transaction) => {
  const meta = tx.meta || {};
  const channel = String(meta.payment_channel || meta.channel || '').toLowerCase();
  const desc = String(tx.description || '').toLowerCase();
  const type = String(tx.type || '').toLowerCase();

  const isPi = channel.includes('pi') || desc.includes('pi') || desc.includes('π');
  const isBlockchain = channel === 'pi_blockchain' || desc.includes('blockchain') || desc.includes('raw');

  let cryptoVal = 0;
  let nairaVal = tx.amount;

  if (isPi) {
    const match = desc.match(/([\d.]+)\s*(?:π|pi)/);
    if (match && match[1]) {
      cryptoVal = parseFloat(match[1]);
      nairaVal = tx.amount;
    } else {
      if (tx.amount < 500 && type !== 'deposit') {
        cryptoVal = tx.amount;
        nairaVal = tx.amount * 176.17;
      } else {
        nairaVal = tx.amount;
        cryptoVal = tx.amount / 176.17;
      }
    }

    return {
      label: isBlockchain ? 'Pi Blockchain' : 'Internal Pi',
      isCrypto: true,
      cryptoVal,
      nairaVal,
      colorClass: isBlockchain
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
    };
  }

  return {
    label: 'Naira Cash',
    isCrypto: false,
    cryptoVal: 0,
    nairaVal: tx.amount,
    colorClass: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
  };
};

const History = () => {
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut'>('bar');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

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
    const channel = supabase
      .channel('history_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => { fetchTransactions(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const stats = useMemo(() => {
    const totalSpentNaira = transactions
      .filter(t => t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success' && !getCurrencyDetails(t).isCrypto)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalSpentPi = transactions
      .filter(t => t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success' && getCurrencyDetails(t).isCrypto)
      .reduce((acc, curr) => acc + getCurrencyDetails(curr).cryptoVal, 0);

    const successCount = transactions.filter(t => t.status.toLowerCase() === 'success').length;
    const totalCount = transactions.length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

    return { totalSpentNaira, totalSpentPi, successRate, totalTx: totalCount };
  }, [transactions]);

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
          return tDate === dayStr && t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success' && !getCurrencyDetails(t).isCrypto;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return { day: dayName, amount: dailyAmount };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    let total = 0;
    transactions.forEach(t => {
      if (t.type.toLowerCase() !== 'deposit' && t.status.toLowerCase() === 'success' && !getCurrencyDetails(t).isCrypto) {
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

  const filteredList = transactions.filter(t => {
    const matchesType = filter === 'All' || t.type.toLowerCase() === filter.toLowerCase();
    const ref = t.ref || t.reference || "";
    const matchesSearch = ref.toLowerCase().includes(search.toLowerCase()) || t.type.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getLogoOrIcon = (transaction: Transaction) => {
    const desc = (transaction.description || "").toUpperCase();
    const type = (transaction.type || "").toUpperCase();
    const combined = desc + " " + type;

    if (combined.includes("MTN")) return <img src={mtnLogo} className="w-full h-full object-contain rounded-full" alt="MTN" />;
    if (combined.includes("GLO")) return <img src={gloLogo} className="w-full h-full object-contain rounded-full" alt="GLO" />;
    if (combined.includes("AIRTEL")) return <img src={airtelLogo} className="w-full h-full object-contain rounded-full" alt="Airtel" />;
    if (combined.includes("9MOBILE") || combined.includes("T2MOBILE")) return <img src={t2mobileLogo} className="w-full h-full object-contain rounded-full" alt="9mobile" />;
    if (combined.includes("SMILE")) return <img src={smileLogo} className="w-full h-full object-contain rounded-full" alt="Smile" />;
    if (combined.includes("DSTV")) return <img src={dstvLogo} className="w-full h-full object-contain rounded-full" alt="DSTV" />;
    if (combined.includes("GOTV")) return <img src={gotvLogo} className="w-full h-full object-contain rounded-full" alt="GOtv" />;
    if (combined.includes("STARTIMES")) return <img src={startimesLogo} className="w-full h-full object-contain rounded-full" alt="Startimes" />;
    if (combined.includes("SHOWMAX")) return <img src={showmaxLogo} className="w-full h-full object-contain rounded-full" alt="Showmax" />;
    if (combined.includes("IKEJA") || combined.includes("IKEDC")) return <img src={ikejaLogo} className="w-full h-full object-contain rounded-full" alt="Ikeja" />;
    if (combined.includes("EKO") || combined.includes("EKEDC")) return <img src={ekoLogo} className="w-full h-full object-contain rounded-full" alt="Eko" />;
    if (combined.includes("ABUJA") || combined.includes("AEDC")) return <img src={abujaLogo} className="w-full h-full object-contain rounded-full" alt="Abuja" />;
    if (combined.includes("KANO") || combined.includes("KEDCO")) return <img src={kanoLogo} className="w-full h-full object-contain rounded-full" alt="Kano" />;
    if (combined.includes("PORT") || combined.includes("PHED")) return <img src={portharcourtLogo} className="w-full h-full object-contain rounded-full" alt="PHED" />;
    if (combined.includes("JOS") || combined.includes("JED")) return <img src={josLogo} className="w-full h-full object-contain rounded-full" alt="Jos" />;
    if (combined.includes("IBADAN") || combined.includes("IBEDC")) return <img src={ibedcLogo} className="w-full h-full object-contain rounded-full" alt="IBEDC" />;
    if (combined.includes("KADUNA") || combined.includes("KAEDCO")) return <img src={kadunaLogo} className="w-full h-full object-contain rounded-full" alt="Kaduna" />;
    if (combined.includes("ENUGU") || combined.includes("EEDC")) return <img src={enuguLogo} className="w-full h-full object-contain rounded-full" alt="Enugu" />;
    if (combined.includes("BENIN") || combined.includes("BEDC")) return <img src={beninLogo} className="w-full h-full object-contain rounded-full" alt="Benin" />;
    if (combined.includes("YOLA") || combined.includes("YEDC")) return <img src={yolaLogo} className="w-full h-full object-contain rounded-full" alt="Yola" />;
    if (combined.includes("ABA") || combined.includes("APLE")) return <img src={abaLogo} className="w-full h-full object-contain rounded-full" alt="Aba" />;
    if (combined.includes("WAEC")) return <img src={waecLogo} className="w-full h-full object-contain rounded-full" alt="WAEC" />;
    if (combined.includes("NECO")) return <img src={necoLogo} className="w-full h-full object-contain rounded-full" alt="NECO" />;
    if (combined.includes("JAMB")) return <img src={jambLogo} className="w-full h-full object-contain rounded-full" alt="JAMB" />;

    switch (transaction.type) {
      case 'Airtime': return <Smartphone size={18} />;
      case 'Data': return <Zap size={18} />;
      case 'Cable': return <Tv size={18} />;
      case 'Electricity': return <Zap size={18} />;
      case 'Exam': return <GraduationCap size={18} />;
      case 'RechargePin': return <Printer size={18} />;
      case 'Deposit': return <ArrowDownLeft size={18} />;
      case 'withdrawal':
      case 'Withdrawal': return <ArrowUpRight size={18} />;
      case 'AirtimeToCash': return <ArrowLeftRight size={18} />;
      default: return <Activity size={18} />;
    }
  };

  const getColorClass = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'deposit') return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400';
    if (t === 'withdrawal') return 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';
    if (t === 'airtimetocash') return 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
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
        <div className="bg-slate-900 text-white p-5 rounded-[30px] shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={60} /></div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Naira Outflow</p>
            <h3 className="text-xl font-black">₦{stats.totalSpentNaira.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Pi Outflow</p>
            <h3 className="text-base font-bold text-amber-400">π{stats.totalSpentPi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="grid grid-rows-2 gap-3">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[22px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t("history.transactions")}</p>
                <h3 className="text-xl font-black dark:text-white">{stats.totalTx}</h3>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 p-2 rounded-full"><Activity size={14} /></div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[22px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t("history.success_rate")}</p>
                <h3 className="text-xl font-black dark:text-white">{stats.successRate}%</h3>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-full"><CheckCircle2 size={14} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CHART ANALYSIS */}
      <section className="bg-white dark:bg-slate-800 p-6 rounded-[35px] shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Naira Spending Insights</h3>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-full">
            <button aria-label="Bar chart" onClick={() => setChartType('bar')} className={`p-2 rounded-full transition-all ${chartType === 'bar' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}><BarChart3 size={14} /></button>
            <button aria-label="Line chart" onClick={() => setChartType('line')} className={`p-2 rounded-full transition-all ${chartType === 'line' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}><LineChart size={14} /></button>
            <button aria-label="Donut chart" onClick={() => setChartType('donut')} className={`p-2 rounded-full transition-all ${chartType === 'donut' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}><PieChart size={14} /></button>
          </div>
        </div>

        <div className="h-40 relative">
          {chartType === 'bar' && (
            <div className="flex items-end justify-between h-full gap-2">
              {weeklyData.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative flex items-end overflow-hidden" style={{ height: '100%' }}>
                    <div className="w-full bg-emerald-500 rounded-t-lg transition-all duration-1000 group-hover:bg-emerald-400" style={{ height: `${(day.amount / (maxChartValue || 1)) * 100}%` }}></div>
                    {day.amount > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        ₦{day.amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{day.day.charAt(0)}</span>
                </div>
              ))}
            </div>
          )}

          {chartType === 'line' && (
            <div className="h-full w-full relative flex flex-col justify-between">
              <svg className="w-full h-[85%] overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline fill="none" stroke="#10b981" strokeWidth="3" points={weeklyData.map((d, i) => `${(i / (weeklyData.length - 1)) * 100},${100 - ((d.amount / (maxChartValue || 1)) * 100)}`).join(' ')} vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="flex justify-between mt-2">
                {weeklyData.map((d, i) => <span key={i} className="text-[9px] font-bold text-slate-400 uppercase w-4 text-center">{d.day.charAt(0)}</span>)}
              </div>
            </div>
          )}

          {chartType === 'donut' && (
            <div className="flex h-full items-center justify-center gap-6">
              <div className="w-28 h-28 rounded-full relative" style={{ background: `conic-gradient(#10b981 0% ${categoryData[0]?.percentage || 0}%, #f59e0b ${categoryData[0]?.percentage || 0}% ${(categoryData[0]?.percentage || 0) + (categoryData[1]?.percentage || 0)}%, #3b82f6 ${(categoryData[0]?.percentage || 0) + (categoryData[1]?.percentage || 0)}% 100%)` }}>
                <div className="absolute inset-4 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("history.top")}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[80px]">{categoryData[0]?.name || t("history.na")}</span>
                </div>
              </div>
              <div className="space-y-1">
                {categoryData.slice(0, 2).map((cat, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{cat.name}</p>
                      <p className="text-xs font-black dark:text-white">{cat.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. SEARCH & FILTERS */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={t("history.search_transactions")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-colors"
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

        {/* TRANSACTION LIST CARDS */}
        <div className="space-y-3">
          {filteredList.length === 0 ? (
            <div className="text-center py-10 opacity-40">
              <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="font-black text-sm uppercase text-slate-300">{t("history.no_transactions_found")}</p>
            </div>
          ) : (
            filteredList.map((tx) => {
              const currency = getCurrencyDetails(tx);
              const isDep = tx.type.toLowerCase() === 'deposit';

              return (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-50 dark:border-slate-700 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg p-1 ${getColorClass(tx.type)}`}>
                      <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-full">
                        {getLogoOrIcon(tx)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs uppercase dark:text-white tracking-tight">{tx.type}</h4>
                        <span className={`text-[8px] font-extrabold tracking-wide uppercase px-1.5 py-0.5 rounded ${currency.colorClass}`}>
                          {currency.label}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{new Date(tx.created_at).toLocaleString()}</p>
                      <p className="text-[8px] font-mono text-slate-300 dark:text-slate-500 max-w-[150px] truncate">
                        {tx.ref || tx.reference || `TRX-${tx.id}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`font-black text-sm ${isDep ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {isDep ? '+' : '-'}₦{(currency.nairaVal || tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {currency.isCrypto && (
                      <p className={`text-[10px] font-bold ${isDep ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-slate-500'} mt-0.5`}>
                        {isDep ? '+' : '-'}π{(currency.cryptoVal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </p>
                    )}
                    <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${tx.status.toLowerCase() === 'success' ? 'text-emerald-500' : tx.status.toLowerCase() === 'pending' ? 'text-orange-400' : 'text-rose-500'}`}>
                      {tx.status}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* RENDER DEDICATED RECEIPT MODAL */}
      {selectedTx && (
        <ReceiptModal
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          currency={getCurrencyDetails(selectedTx)}
          logoNode={getLogoOrIcon(selectedTx)}
          colorClass={getColorClass(selectedTx.type)}
        />
      )}

    </div>
  );
};

export default History;