import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, Eye, Smartphone, ArrowRight, Loader2, Tv, Zap, ArrowLeftRight, X, Building2, RotateCcw
} from 'lucide-react';
import { airtimeService } from '../services/airtimeService';
import { dbService } from '../services/dbService';
import { useDataPlans } from '../hooks/useDataPlans'; 
import { CARRIERS, NETWORK_ID_MAP, NETWORK_PREFIXES, DISCOS, CABLE_PROVIDERS, MOCK_CABLE_PLANS } from '../constants';
import { Carrier, DataPlan } from '../types';

interface DashboardProps {
  user: { name: string; email: string; balance: number };
  onUpdateBalance: (newBalance: number) => void;
}

type ProductType = 'Airtime' | 'Data' | 'Cable' | 'Electricity' | 'AirtimeToCash';

const Dashboard: React.FC<DashboardProps> = ({ user, onUpdateBalance }) => {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [productType, setProductType] = useState<ProductType>('Airtime');
  
  // Inputs
  const [selectedNetworkId, setSelectedNetworkId] = useState<number>(1);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier>(Carrier.MTN);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  
  // Specifics
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cableProvider, setCableProvider] = useState(1);
  const [smartCardNumber, setSmartCardNumber] = useState('');
  const [selectedCablePlan, setSelectedCablePlan] = useState<any>(null);
  const [disco, setDisco] = useState(1);
  const [meterNumber, setMeterNumber] = useState('');
  const [meterType, setMeterType] = useState<1 | 2>(1);

  // Modals & Loading
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false); // <--- NEW STATE
  
  const [autoDetected, setAutoDetected] = useState(true);

  // Hooks
  const { plans: networkPlans, loading: loadingPlans } = useDataPlans(selectedNetworkId);

  // --- 🔄 NEW: MANUAL REFRESH BALANCE ---
  const handleRefreshBalance = async () => {
    setIsRefreshingBalance(true);
    try {
      // Fetch latest profile from DB
      const profile = await dbService.getUserProfile(user.email);
      if (profile) {
        onUpdateBalance(Number(profile.wallet_balance)); // Update parent state
      }
    } catch (error) {
      console.error("Balance refresh failed");
    } finally {
      // Add small delay so user sees the spinner
      setTimeout(() => setIsRefreshingBalance(false), 800);
    }
  };

  // --- AUTO DETECT NETWORK ---
  const handlePhoneChange = (val: string) => { 
    let cleaned = val.replace(/\D/g, ''); 
    if (cleaned.startsWith('234') && cleaned.length > 3) cleaned = '0' + cleaned.slice(3);
    cleaned = cleaned.slice(0, 11);
    
    setPhoneNumber(cleaned);

    if (cleaned.length < 4) {
      setAutoDetected(true);
      return;
    }

    if (autoDetected && cleaned.length >= 4) {
        const prefix4 = cleaned.slice(0, 4);
        const prefix5 = cleaned.length >= 5 ? cleaned.slice(0, 5) : null;
        
        let foundCarrier: Carrier | null = null;
        const carriers = Object.keys(NETWORK_PREFIXES) as Carrier[];

        if (prefix5) {
            for (const c of carriers) if (NETWORK_PREFIXES[c].includes(prefix5)) foundCarrier = c;
        }
        if (!foundCarrier) {
            for (const c of carriers) if (NETWORK_PREFIXES[c].includes(prefix4)) foundCarrier = c;
        }

        if (foundCarrier && foundCarrier !== selectedCarrier) {
            const entry = Object.entries(NETWORK_ID_MAP).find(([id, c]) => c === foundCarrier);
            if (entry) {
                const newId = Number(entry[0]);
                setSelectedNetworkId(newId);
                setSelectedCarrier(foundCarrier);
                setSelectedPlan(null);
            }
        }
    }
  };

  // --- TRANSACTION: DEPOSIT ---
  const handleDeposit = async () => {
    if (!amount || Number(amount) < 100) return alert("Minimum deposit is ₦100");
    setIsProcessing(true);
    try {
        await new Promise(r => setTimeout(r, 2000));
        const newBal = user.balance + Number(amount);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
            user_email: user.email, type: 'Deposit', amount: Number(amount), status: 'Success'
        });
        onUpdateBalance(newBal);
        alert("Deposit Successful!");
        setIsDepositModalOpen(false);
        setAmount('');
    } catch (e) { alert("Deposit Failed"); }
    finally { setIsProcessing(false); }
  };

  // --- TRANSACTION: WITHDRAW ---
  const handleWithdraw = async () => {
    if (!amount || Number(amount) < 100) return alert("Minimum withdrawal is ₦100");
    if (Number(amount) > user.balance) return alert("Insufficient funds");
    setIsProcessing(true);
    try {
        await new Promise(r => setTimeout(r, 2000));
        const newBal = user.balance - Number(amount);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
            user_email: user.email, type: 'Withdrawal', amount: Number(amount), status: 'Success'
        });
        onUpdateBalance(newBal);
        alert("Withdrawal Successful!");
        setIsWithdrawModalOpen(false);
        setAmount('');
    } catch (e) { alert("Withdrawal Failed"); }
    finally { setIsProcessing(false); }
  };

  // --- TRANSACTION: PURCHASE ---
  const handleTransaction = async () => {
    let cost = 0;
    if (productType === 'Airtime' || productType === 'Electricity') cost = Number(amount);
    if (productType === 'Data') cost = Number(selectedPlan?.amount);
    if (productType === 'Cable') cost = Number(selectedCablePlan?.amount);
    
    if (productType !== 'AirtimeToCash' && cost > user.balance) return alert("Insufficient balance");
    setIsProcessing(true);

    try {
      if (productType === 'Data' && selectedPlan) {
        await airtimeService.buyData({ network: selectedNetworkId, mobile_number: phoneNumber, plan: selectedPlan.id, Ported_number: false });
        await dbService.addTransaction({ user_email: user.email, type: 'Data', amount: cost, carrier: selectedCarrier, phoneNumber, status: 'Success' });
      } 
      else if (productType === 'Airtime') {
        await airtimeService.buyAirtime({ network: selectedNetworkId, amount: Number(amount), mobile_number: phoneNumber, Ported_number: false, airtime_type: "VTU" });
        await dbService.addTransaction({ user_email: user.email, type: 'Airtime', amount: cost, carrier: selectedCarrier, phoneNumber, status: 'Success' });
      }
      else if (productType === 'AirtimeToCash') {
         await airtimeService.convertAirtimeToCash({ network: selectedNetworkId, mobile_number: phoneNumber, amount: Number(amount) });
         alert("Request Submitted!");
         setIsConfirming(false); setIsProcessing(false); return;
      }
      
      const newBalance = user.balance - cost;
      onUpdateBalance(newBalance);
      await dbService.updateBalance(user.email, newBalance);
      
      alert("Transaction Successful!");
      setIsConfirming(false);
      setPhoneNumber(''); setAmount(''); setSelectedPlan(null);
    } catch (error: any) {
      alert("Transaction Failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helpers for UI
  const filteredPlans = useMemo(() => networkPlans.filter(p => selectedCategory === 'All' ? true : p.plan_type === selectedCategory).sort((a, b) => Number(a.amount) - Number(b.amount)), [networkPlans, selectedCategory]);
  const availableCategories = useMemo(() => ['All', ...Array.from(new Set(networkPlans.map(p => p.plan_type))).sort()], [networkPlans]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. WALLET CARD (Updated with Refresh) */}
      <section className="bg-emerald-600 p-6 rounded-[35px] shadow-xl text-white space-y-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={120}/></div>
         <div className="relative">
            <div className="flex justify-between items-start">
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1">Available Balance</p>
               {/* REFRESH BUTTON */}
               <button onClick={handleRefreshBalance} className="p-2 bg-emerald-700/50 rounded-full hover:bg-emerald-500 active:scale-90 transition-all">
                  <RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""} />
               </button>
            </div>
            
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-black">{isBalanceVisible ? `₦${user.balance.toLocaleString()}` : '••••••••'}</h2>
              <button onClick={() => setIsBalanceVisible(!isBalanceVisible)} className="p-2 bg-white/10 rounded-full"><Eye size={18}/></button>
            </div>
         </div>
         <div className="flex gap-3 relative">
            <button onClick={() => { setAmount(''); setIsDepositModalOpen(true); }} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-transform">Deposit</button>
            <button onClick={() => { setAmount(''); setIsWithdrawModalOpen(true); }} className="flex-1 bg-emerald-700 border border-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase active:scale-95 transition-transform">Withdraw</button>
         </div>
      </section>

      {/* 2. SERVICES GRID */}
      <div className="grid grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[{ id: 'Airtime', icon: <Smartphone size={18}/> }, { id: 'Data', icon: <Wallet size={18}/> }, { id: 'Cable', icon: <Tv size={18}/> }, { id: 'Electricity', icon: <Zap size={18}/> }]
        .map((item: any) => (
          <button key={item.id} onClick={() => setProductType(item.id)} className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all ${productType === item.id ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {item.icon} <span className="text-[9px] font-black uppercase mt-1">{item.id}</span>
          </button>
        ))}
      </div>

      {/* 3. AIRTIME TO CASH */}
      <button onClick={() => setProductType('AirtimeToCash')} className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all group ${productType === 'AirtimeToCash' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-orange-300'}`}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl group-hover:scale-110 transition-transform"><ArrowLeftRight size={20} /></div>
          <div className="text-left"><h3 className="font-black text-sm dark:text-white uppercase">Airtime to Cash</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Swap Airtime</p></div>
        </div>
        <ArrowRight size={18} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
      </button>

      {/* 4. MAIN FORM */}
      <section className="bg-white dark:bg-slate-800 p-5 rounded-[30px] shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
        {(productType === 'Airtime' || productType === 'Data' || productType === 'AirtimeToCash') && (
          <>
            {productType === 'AirtimeToCash' && <div className="bg-orange-50 text-orange-600 p-3 rounded-xl text-xs font-bold border border-orange-100 mb-2">⚠️ Converting Airtime to Cash. Fees apply.</div>}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {CARRIERS.map(c => (
                <button key={c.id} onClick={() => { 
                    const entry = Object.entries(NETWORK_ID_MAP).find(([id, val]) => val === c.id);
                    if (entry) setSelectedNetworkId(Number(entry[0]));
                    setSelectedCarrier(c.id); 
                    setAutoDetected(false); 
                }} className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${selectedCarrier === c.id ? 'border-emerald-600 bg-emerald-50 scale-105' : 'border-transparent bg-slate-50'}`}>
                  <img src={c.logo} alt={c.id} className="w-8 h-8 object-contain mb-1 rounded-full" />
                </button>
              ))}
            </div>
            <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
               <input type="tel" value={phoneNumber} onChange={e => handlePhoneChange(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="080..." />
            </div>
          </>
        )}

        {(productType === 'Airtime' || productType === 'AirtimeToCash') && (
          <div>
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Amount</label>
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
             <button onClick={() => setIsConfirming(true)} disabled={!amount} className={`w-full mt-4 py-4 text-white rounded-2xl font-black uppercase shadow-lg ${productType === 'AirtimeToCash' ? 'bg-slate-800' : 'bg-emerald-600'}`}>{productType === 'AirtimeToCash' ? 'Convert to Cash' : 'Buy Airtime'}</button>
          </div>
        )}

        {productType === 'Data' && (
          <div>
             <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar mb-2">
                {availableCategories.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{cat}</button>)}
             </div>
             <div className="max-h-[300px] overflow-y-auto space-y-2">
                {loadingPlans ? <div className="text-center p-4"><Loader2 className="animate-spin mx-auto"/></div> : filteredPlans.map(plan => (
                  <button key={plan.id} onClick={() => { setSelectedPlan(plan); setIsConfirming(true); }} className="w-full p-4 flex justify-between items-center bg-slate-50 rounded-2xl hover:border-emerald-500 border-2 border-transparent">
                     <span className="font-bold text-sm">{plan.size} - {plan.plan_type}</span>
                     <span className="font-black text-emerald-600">₦{plan.amount}</span>
                  </button>
                ))}
             </div>
          </div>
        )}

        {productType === 'Cable' && (
          <div className="space-y-4">
             <div className="flex gap-2">
               {CABLE_PROVIDERS.map(p => <button key={p.id} onClick={() => { setCableProvider(p.id); setSelectedCablePlan(null); }} className={`flex-1 py-3 rounded-xl font-black text-xs border-2 ${cableProvider === p.id ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100'}`}>{p.name}</button>)}
             </div>
             <input type="text" value={smartCardNumber} onChange={e => setSmartCardNumber(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="Smart Card / IUC" />
             <select onChange={(e) => setSelectedCablePlan(JSON.parse(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none">
               <option value="">-- Choose Plan --</option>
               {(MOCK_CABLE_PLANS as any)[cableProvider]?.map((plan: any) => <option key={plan.id} value={JSON.stringify(plan)}>{plan.name} - ₦{plan.amount}</option>)}
             </select>
             <button onClick={() => setIsConfirming(true)} disabled={!selectedCablePlan || !smartCardNumber} className="w-full mt-2 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase shadow-lg">Verify & Pay</button>
          </div>
        )}

        {productType === 'Electricity' && (
          <div className="space-y-4">
             <select value={disco} onChange={(e) => setDisco(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none">
               {DISCOS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
             </select>
             <div className="flex gap-2">
                 <button onClick={() => setMeterType(1)} className={`flex-1 py-3 rounded-xl font-bold text-xs ${meterType === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>Prepaid</button>
                 <button onClick={() => setMeterType(2)} className={`flex-1 py-3 rounded-xl font-bold text-xs ${meterType === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>Postpaid</button>
             </div>
             <input type="text" value={meterNumber} onChange={e => setMeterNumber(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="Meter Number" />
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
             <button onClick={() => setIsConfirming(true)} disabled={!amount || !meterNumber} className="w-full mt-2 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase shadow-lg">Pay Bill</button>
          </div>
        )}
      </section>

      {/* --- MODAL: DEPOSIT --- */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[45px] p-8 shadow-2xl relative">
              <button onClick={() => setIsDepositModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={18}/></button>
              <h3 className="text-xl font-black text-center mb-1">Fund Wallet</h3>
              <p className="text-xs text-slate-400 text-center font-bold uppercase tracking-widest mb-6">Secure Payment</p>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none" placeholder="Amount to deposit (₦)" />
              <button onClick={handleDeposit} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase">{isProcessing ? <Loader2 className="animate-spin mx-auto"/> : 'Proceed'}</button>
           </div>
        </div>
      )}

      {/* --- MODAL: WITHDRAW --- */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[45px] p-8 shadow-2xl relative">
              <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={18}/></button>
              <h3 className="text-xl font-black text-center mb-1">Withdraw</h3>
              <p className="text-xs text-slate-400 text-center font-bold uppercase tracking-widest mb-6">Transfer to Bank</p>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-2 outline-none" placeholder="Amount (₦)" />
              <div className="relative mb-4"><Building2 className="absolute left-3 top-4 text-slate-400" size={18} /><input type="text" className="w-full pl-10 p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="Account Number" /></div>
              <button onClick={handleWithdraw} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase">{isProcessing ? <Loader2 className="animate-spin mx-auto"/> : 'Withdraw Funds'}</button>
           </div>
        </div>
      )}

      {/* --- MODAL: CONFIRM PURCHASE --- */}
      {isConfirming && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[45px] p-8 shadow-2xl border-2 border-white/10">
              <h3 className="text-xl font-black text-center mb-1">Confirm {productType}</h3>
              <div className="flex justify-between items-center mb-10 p-5 bg-slate-50 dark:bg-slate-900 rounded-[30px] shadow-inner mt-6">
                 <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Total Pay</span>
                 <span className="font-black text-3xl text-emerald-600 tracking-tighter">₦{productType === 'Data' ? selectedPlan?.amount : amount}</span>
              </div>
              <button onClick={handleTransaction} disabled={isProcessing} className="w-full py-5 bg-emerald-600 text-white rounded-[25px] font-black uppercase tracking-tighter shadow-xl">{isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "Pay Now"}</button>
              <button onClick={() => setIsConfirming(false)} className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest mt-2">Cancel</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default Dashboard;