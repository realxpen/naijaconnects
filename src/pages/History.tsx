import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Activity, CheckCircle2, XCircle, Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { Transaction } from '../types';

const History = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  // --- FETCH DATA ---
  useEffect(() => {
    const loadHistory = async () => {
      // In a real app, you'd get the email from a global context/auth
      // For now, we fetch from the DB service (mocking the current user email)
      const user = localStorage.getItem('naija_connect_database_v3');
      if (user) {
        const parsed = JSON.parse(user);
        // Just grabbing the first user found or using a fallback for the demo
        const email = parsed.profiles?.[0]?.email || 'demo@example.com';
        const history = await dbService.getHistory(email);
        setTransactions(history);
      }
      setLoading(false);
    };
    loadHistory();
  }, []);

  // --- CALCULATIONS FOR DASHBOARD ---
  const stats = useMemo(() => {
    const totalSpent = transactions.reduce((acc, curr) => acc + (curr.type !== 'Deposit' ? curr.amount : 0), 0);
    const depositTotal = transactions.reduce((acc, curr) => acc + (curr.type === 'Deposit' ? curr.amount : 0), 0);
    const successCount = transactions.filter(t => t.status === 'Success').length;
    const successRate = transactions.length > 0 ? Math.round((successCount / transactions.length) * 100) : 0;

    return { totalSpent, depositTotal, successRate, totalTx: transactions.length };
  }, [transactions]);

  // --- CHART DATA (Last 7 Days) ---
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
      const amount = transactions
        .filter(t => new Date(t.date).toLocaleDateString() === dayStr && t.type !== 'Deposit')
        .reduce((sum, t) => sum + t.amount, 0);
      return { day: dayName, amount };
    });
  }, [transactions]);

  // Max value for chart scaling
  const maxChartValue = Math.max(...weeklyData.map(d => d.amount), 100);

  // --- FILTERING ---
  const filteredList = transactions.filter(t => {
    const matchesType = filter === 'All' || t.type === filter;
    const matchesSearch = t.phoneNumber?.includes(search) || t.type.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  if (loading) return <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading Activity...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. HEADER */}
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Activity</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Financial Overview</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
           <Calendar size={10} /> Last 30 Days
        </div>
      </div>

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Spent */}
        <div className="bg-slate-900 text-white p-5 rounded-[30px] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={80} /></div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Spent</p>
          <h3 className="text-2xl font-black">₦{stats.totalSpent.toLocaleString()}</h3>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full">
            <ArrowUpRight size={10} /> +12% vs last month
          </div>
        </div>

        {/* Stats Grid */}
        <div className="space-y-3">
           <div className="bg-white dark:bg-slate-800 p-4 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Transactions</p>
                   <h3 className="text-xl font-black dark:text-white">{stats.totalTx}</h3>
                 </div>
                 <div className="bg-blue-50 text-blue-600 p-2 rounded-full"><Activity size={16}/></div>
              </div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-4 rounded-[25px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Success Rate</p>
                   <h3 className="text-xl font-black dark:text-white">{stats.successRate}%</h3>
                 </div>
                 <div className="bg-emerald-50 text-emerald-600 p-2 rounded-full"><CheckCircle2 size={16}/></div>
              </div>
           </div>
        </div>
      </div>

      {/* 3. WEEKLY SPENDING CHART */}
      <section className="bg-white dark:bg-slate-800 p-6 rounded-[35px] shadow-sm border border-slate-100 dark:border-slate-700">
         <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Weekly Spending Trend</h3>
         <div className="flex items-end justify-between h-32 gap-2">
            {weeklyData.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative h-full flex items-end overflow-hidden">
                    <div 
                      className="w-full bg-emerald-500 rounded-t-lg transition-all duration-1000 group-hover:bg-emerald-400"
                      style={{ height: `${(day.amount / maxChartValue) * 100}%` }}
                    ></div>
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                       ₦{day.amount}
                    </div>
                 </div>
                 <span className="text-[9px] font-bold text-slate-400 uppercase">{day.day}</span>
              </div>
            ))}
         </div>
      </section>

      {/* 4. TRANSACTION LIST */}
      <section>
        <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2 custom-scrollbar">
           {['All', 'Airtime', 'Data', 'Deposit', 'Withdrawal', 'AirtimeToCash'].map(cat => (
             <button 
               key={cat} 
               onClick={() => setFilter(cat)}
               className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${filter === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
             >
               {cat === 'AirtimeToCash' ? 'Swap' : cat}
             </button>
           ))}
        </div>

        <div className="space-y-3">
          {filteredList.length === 0 ? (
             <div className="text-center py-10 opacity-40">
                <p className="font-black text-sm uppercase">No Transactions Found</p>
             </div>
          ) : (
             filteredList.map((tx) => (
               <div key={tx.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-50 dark:border-slate-700 shadow-sm hover:border-emerald-200 transition-colors group">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg 
                        ${tx.type === 'Deposit' ? 'bg-emerald-100 text-emerald-600' : 
                          tx.type === 'Withdrawal' ? 'bg-rose-100 text-rose-600' : 
                          tx.type === 'AirtimeToCash' ? 'bg-orange-100 text-orange-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                        {tx.type === 'Deposit' ? <ArrowDownLeft size={18}/> : 
                         tx.type === 'Withdrawal' ? <ArrowUpRight size={18}/> :
                         tx.carrier ? tx.carrier.charAt(0) : <Activity size={18}/>}
                     </div>
                     <div>
                        <h4 className="font-black text-xs uppercase dark:text-white tracking-tight">{tx.type}</h4>
                        <p className="text-[9px] font-bold text-slate-400">{tx.date}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className={`font-black text-sm ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
                        {tx.type === 'Deposit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                     </p>
                     <p className={`text-[8px] font-black uppercase tracking-widest ${tx.status === 'Success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {tx.status}
                     </p>
                  </div>
               </div>
             ))
          )}
        </div>
      </section>
    </div>
  );
};

export default History;