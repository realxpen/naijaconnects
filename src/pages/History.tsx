import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Activity, CheckCircle2, Search, ArrowUpRight, ArrowDownLeft, Calendar,
  Smartphone, Zap, Tv, GraduationCap, Printer, ArrowLeftRight, Loader2
} from 'lucide-react';
import { supabase } from "../supabaseClient";

// Define the shape of your Transaction based on your DB schema
interface Transaction {
  id: number;
  created_at: string;
  type: string;
  amount: number;
  status: string;
  ref?: string;
  user_email?: string;
  // Add metadata fields if your DB has them (e.g., description, phone number)
  description?: string; 
}

const History = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  // --- FETCH REAL DATA FROM SUPABASE ---
  useEffect(() => {
    const loadHistory = async () => {
      try {
        // 1. Get Current User
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user || !user.email) {
          setLoading(false);
          return; 
        }

        // 2. Fetch Transactions for this user
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false })
          .limit(100); // Limit to last 100 for performance

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

  // --- CALCULATE STATISTICS ---
  const stats = useMemo(() => {
    const totalSpent = transactions
      .filter(t => t.type !== 'Deposit' && t.status === 'Success')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const depositTotal = transactions
      .filter(t => t.type === 'Deposit' && t.status === 'Success')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const successCount = transactions.filter(t => t.status === 'Success').length;
    const totalCount = transactions.length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

    return { totalSpent, depositTotal, successRate, totalTx: totalCount };
  }, [transactions]);

  // --- CHART DATA (Last 7 Days) ---
  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    // Create array of last 7 dates
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return d;
    });

    return last7Days.map(date => {
      const dayStr = date.toLocaleDateString();
      const dayName = days[date.getDay()];
      
      // Sum successful spending for this specific day
      const dailyAmount = transactions
        .filter(t => {
            const tDate = new Date(t.created_at).toLocaleDateString();
            return tDate === dayStr && t.type !== 'Deposit' && t.status === 'Success';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return { day: dayName, amount: dailyAmount };
    });
  }, [transactions]);

  // Max value for chart scaling (prevent division by zero)
  const maxChartValue = Math.max(...weeklyData.map(d => d.amount), 100);

  // --- FILTERING LOGIC ---
  const filteredList = transactions.filter(t => {
    const matchesType = filter === 'All' || t.type === filter;
    // Search by Reference ID or Description/Type
    const matchesSearch = 
        (t.ref && t.ref.toLowerCase().includes(search.toLowerCase())) || 
        t.type.toLowerCase().includes(search.toLowerCase());
    
    return matchesType && matchesSearch;
  });

  // --- HELPER: GET ICON ---
  const getIcon = (type: string) => {
      switch(type) {
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

  // --- HELPER: GET COLOR ---
  const getColorClass = (type: string) => {
      if (type === 'Deposit') return 'bg-emerald-100 text-emerald-600';
      if (type === 'Withdrawal') return 'bg-rose-100 text-rose-600';
      if (type === 'AirtimeToCash') return 'bg-orange-100 text-orange-600';
      return 'bg-slate-100 text-slate-600';
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading History...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. HEADER */}
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Activity</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Financial Overview</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
           <Calendar size={10} /> Recent
        </div>
      </div>

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Spent */}
        <div className="bg-slate-900 text-white p-5 rounded-[30px] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={80} /></div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Spent</p>
          <h3 className="text-2xl font-black">₦{stats.totalSpent.toLocaleString()}</h3>
          <p className="text-[9px] text-slate-500 font-bold mt-1">Lifetime spending</p>
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
         <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Last 7 Days Spending</h3>
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
                        ₦{day.amount.toLocaleString()}
                    </div>
                 </div>
                 <span className="text-[9px] font-bold text-slate-400 uppercase">{day.day}</span>
              </div>
            ))}
         </div>
      </section>

      {/* 4. TRANSACTION SEARCH & FILTER */}
      <section>
        <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                    type="text" 
                    placeholder="Search type or ref..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold outline-none border border-slate-100 dark:border-slate-700 focus:border-emerald-500 transition-colors"
                />
            </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
           {['All', 'Deposit', 'Airtime', 'Data', 'Cable', 'Electricity', 'Exam', 'RechargePin'].map(cat => (
             <button 
               key={cat} 
               onClick={() => setFilter(cat)}
               className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${filter === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
             >
               {cat}
             </button>
           ))}
        </div>

        {/* 5. TRANSACTION LIST */}
        <div className="space-y-3">
          {filteredList.length === 0 ? (
             <div className="text-center py-10 opacity-40">
                <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-black text-sm uppercase text-slate-300">No Transactions Found</p>
             </div>
          ) : (
             filteredList.map((tx) => (
               <div key={tx.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-50 dark:border-slate-700 shadow-sm hover:border-emerald-200 transition-colors group">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${getColorClass(tx.type)}`}>
                        {getIcon(tx.type)}
                     </div>
                     <div>
                        <h4 className="font-black text-xs uppercase dark:text-white tracking-tight">{tx.type}</h4>
                        <p className="text-[9px] font-bold text-slate-400">{new Date(tx.created_at).toLocaleString()}</p>
                        {tx.ref && <p className="text-[8px] font-mono text-slate-300 mt-0.5">{tx.ref}</p>}
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
               </div>
             ))
          )}
        </div>
      </section>
    </div>
  );
};

export default History;