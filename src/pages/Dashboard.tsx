import * as React from "react";
import { useState, useEffect } from "react";
import {
  Smartphone, Tv, Zap, ArrowRight, ArrowLeftRight, X, Loader2,
  RotateCcw, TrendingUp, TrendingDown, CreditCard, GraduationCap, Printer, Building2
} from "lucide-react";
import { usePaystackPayment } from "react-paystack";
import { supabase } from "../supabaseClient";
import { dbService } from "../services/dbService";

// IMPORT SERVICES
import Airtime from "../components/services/Airtime";
import DataBundle from "../components/services/DataBundle";
import CableTv from "../components/services/CableTv";
import Electricity from "../components/services/Electricity";
import Exams from "../components/services/Exams";
import RechargePin from "../components/services/RechargePin";
import AirtimeToCash from "../components/services/AirtimeToCash";

interface DashboardProps {
  user: { name: string; email: string; balance: number; phone?: string };
  onUpdateBalance: (newBalance: number) => void;
  // Optional: If you add this prop from your parent layout, it can force a reset
  activeTab?: string; 
}

type ViewState = "Dashboard" | "Airtime" | "Data" | "Cable" | "Electricity" | "Exam" | "RechargePin" | "AirtimeToCash";

const Dashboard = ({ user, onUpdateBalance, activeTab }: DashboardProps) => {
  const [view, setView] = useState<ViewState>("Dashboard");
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  // Wallet Modal States
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [currentTxRef, setCurrentTxRef] = useState<string>(`txn_${Date.now()}`);

  // --- DATA FETCHING ---
  const fetchUser = async () => {
    try {
      const { data } = await supabase.from("profiles").select("balance").eq("email", user.email).single();
      if (data) onUpdateBalance(data.balance);
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await supabase.from("transactions").select("*").eq("user_email", user.email).order("created_at", { ascending: false }).limit(5);
      if (data) setHistory(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchHistory(); fetchUser(); }, [user.email]);

  // --- PAYSTACK LOGIC ---
  const paystackConfig = {
    email: user?.email,
    amount: (Number(depositAmount) || 0) * 100,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
    reference: currentTxRef,
  };
  const initializePayment = usePaystackPayment(paystackConfig);

  const handleStartDeposit = () => {
    if (!depositAmount || Number(depositAmount) < 100) return alert("Min ₦100");
    initializePayment({
      onSuccess: async () => {
         const newBal = user.balance + Number(depositAmount);
         await dbService.updateBalance(user.email, newBal);
         onUpdateBalance(newBal);
         await dbService.addTransaction({
             user_email: user.email, type: 'Deposit', amount: Number(depositAmount), status: 'Success', ref: currentTxRef
         });
         setIsDepositModalOpen(false);
         setDepositAmount("");
         setCurrentTxRef(`txn_${Date.now()}`); // reset ref
         alert("Wallet Funded Successfully!");
         fetchHistory();
      },
      onClose: () => console.log("Closed")
    } as any);
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
        // UPDATED: Passed user prop here for auto-fill
        return <AirtimeToCash user={user} onBack={() => setView("Dashboard")} />;
      default:
        return renderDashboardHome();
    }
  };

  const renderDashboardHome = () => (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* WALLET CARD */}
      <section className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl relative">
        <div className="flex justify-between items-start mb-1">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Available Balance</p>
          <button onClick={() => { setIsRefreshingBalance(true); fetchUser(); setTimeout(() => setIsRefreshingBalance(false), 1000); }} className="p-2 bg-emerald-700/50 rounded-full">
            <RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""} />
          </button>
        </div>
        <h2 className="text-4xl font-black mb-6">₦{user.balance.toLocaleString()}</h2>
        <div className="flex gap-3">
          <button onClick={() => setIsDepositModalOpen(true)} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2">
            <CreditCard size={16} /> Fund
          </button>
          <button className="flex-1 bg-emerald-700 border border-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase opacity-80 cursor-not-allowed">
            Withdraw
          </button>
        </div>
      </section>

      {/* SERVICE GRID */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[
          { id: "Airtime", icon: <Smartphone size={18} /> },
          { id: "Data", icon: <Zap size={18} /> },
          { id: "Cable", icon: <Tv size={18} /> },
          { 
            id: "Electricity", 
            // UPDATED: Custom "Raised to Power" Icon
            icon: (
                <div className="relative">
                    <Building2 size={18} />
                    <Zap 
                        size={10} 
                        className="absolute -top-2 -right-1 text-yellow-500 fill-yellow-500" 
                        strokeWidth={3}
                    />
                </div>
            ) 
          },
          { id: "Exam", icon: <GraduationCap size={18} /> },
          { id: "RechargePin", icon: <Printer size={18} /> },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setView(s.id as ViewState)}
            className="flex flex-col items-center py-4 rounded-xl text-slate-400 hover:bg-white hover:text-emerald-600 transition-all"
          >
            {s.icon} <span className="text-[9px] font-black uppercase mt-1">{s.id}</span>
          </button>
        ))}
      </div>

      <button onClick={() => setView("AirtimeToCash")} className="w-full p-5 rounded-[25px] flex items-center justify-between border-2 border-slate-100 bg-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><ArrowLeftRight size={22} /></div>
          <div className="text-left">
            <h3 className="font-black text-sm uppercase">Airtime to Cash</h3>
            <p className="text-[10px] text-slate-400 font-bold">Swap Airtime for Cash</p>
          </div>
        </div>
        <ArrowRight size={20} className="text-slate-300" />
      </button>

      {/* HISTORY */}
      <div className="pt-2">
        <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-3 ml-2">Recent Activity</h3>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-center text-xs text-slate-300 py-4">No recent activity</p>}
          {history.map((tx) => (
            <div key={tx.id} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${tx.type === "Deposit" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                  {tx.type === "Deposit" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </div>
                <div>
                  <p className="font-bold text-xs">{tx.type}</p>
                  <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`font-black text-xs ${tx.type === "Deposit" ? "text-emerald-600" : "text-slate-900"}`}>
                {tx.type === "Deposit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* DEPOSIT MODAL */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button onClick={() => setIsDepositModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={16} /></button>
            <h3 className="text-xl font-black text-center mb-6">Fund Wallet</h3>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                 {[100, 500, 1000, 2000, 5000].map(amt => (
                     <button key={amt} onClick={() => setDepositAmount(amt.toString())} className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">₦{amt}</button>
                 ))}
            </div>
            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border border-slate-200" placeholder="Amount (₦)" />
            <button onClick={handleStartDeposit} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase">Pay Securely</button>
          </div>
        </div>
      )}
    </div>
  );

  return renderContent();
};

export default Dashboard;