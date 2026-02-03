import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Building2, ChevronRight, Check, Zap, Wallet, History, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { DISCOS } from "../../constants";

interface ElectricityProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const Electricity = ({ user, onUpdateBalance, onBack }: ElectricityProps) => {
  const [loading, setLoading] = useState(false);
  const [disco, setDisco] = useState<string | null>(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState(1); // 1 = Prepaid, 2 = Postpaid
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [showDiscoModal, setShowDiscoModal] = useState(false);

  // Recents State
  const [showRecents, setShowRecents] = useState(false);
  const [recentMeters, setRecentMeters] = useState<string[]>([]);

  // --- 1. INITIALIZE & PRE-FILL ---
  useEffect(() => {
    const saved = localStorage.getItem("electricity_recents");
    if (saved) setRecentMeters(JSON.parse(saved));

    // Pre-fill phone for token delivery
    if (user.phone) setPhone(user.phone);
  }, [user]);

  // --- 2. VERIFY METER ---
  const verifyMeter = async (number: string) => {
    if (number.length < 10 || !disco) return;
    setCustomerName("Verifying...");
    
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "verify_meter",
          payload: { meter: number, disco: disco, meter_type: meterType },
        },
      });

      if (error) throw error;
      const name = data.customer_name || data.name || data.content?.Customer_Name;
      setCustomerName(name && !name.includes("INVALID") ? name : "Invalid Meter");
    } catch (e) {
      setCustomerName("Verification Failed");
    }
  };

  // --- 3. SAVE RECENT METER ---
  const saveRecentMeter = (meter: string) => {
      if (meter.length < 10) return;
      const filtered = recentMeters.filter(m => m !== meter);
      const newRecents = [meter, ...filtered].slice(0, 5); 
      setRecentMeters(newRecents);
      localStorage.setItem("electricity_recents", JSON.stringify(newRecents));
  };

  // --- 4. PURCHASE LOGIC ---
  const handlePurchase = async () => {
    if (!amount || !meterNumber || !disco || !customerName || customerName.includes("Invalid")) return;
    if (user.balance < Number(amount)) return alert("Insufficient Balance");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "buy_electricity",
          payload: {
            disco,
            meter: meterNumber,
            amount: Number(amount),
            meter_type: meterType,
            phone: phone || "08000000000",
          },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true || (data.data && data.data.status === "ORDER_RECEIVED");

      if (isSuccess) {
        const newBal = user.balance - Number(amount);
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_email: user.email,
          type: "Electricity",
          amount: Number(amount),
          status: "Success",
          ref: `ELEC-${Date.now()}`,
          meta: { token: data.token || data.metertoken || "Token sent to phone" }
        });
        
        saveRecentMeter(meterNumber);

        alert(`Success! Token: ${data.token || data.metertoken || "Check receipt"}`);
        setMeterNumber("");
        setAmount("");
        setCustomerName("");
      } else {
        throw new Error(data.message || "Transaction Failed");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const presetAmounts = [1000, 2000, 3000, 5000, 10000, 20000];
  const selectedDiscoObj = DISCOS.find(d => d.id === disco);

  return (
    <div className="animate-in slide-in-from-right duration-300 pb-24 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full">
            <Wallet size={14} className="text-emerald-600"/>
            <span className="text-sm font-black text-emerald-600">₦{user.balance.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Top Section (Dark) */}
        <div className="p-6 bg-slate-900 text-white">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Service Provider</label>
            
            {/* Disco Selector Card */}
            <button 
                onClick={() => setShowDiscoModal(true)}
                className="w-full flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors mb-6"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        {selectedDiscoObj?.logo ? (
                            <img src={selectedDiscoObj.logo} className="w-6 h-6 object-contain" />
                        ) : (
                            <Building2 size={20} className="text-slate-400" />
                        )}
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm">{selectedDiscoObj?.name || "Select Electricity"}</p>
                        {selectedDiscoObj && <p className="text-[10px] text-slate-400">{selectedDiscoObj.short}</p>}
                    </div>
                </div>
                <ChevronRight size={20} className="text-slate-500" />
            </button>

            {/* Meter Type Toggle */}
            <div className="flex bg-slate-800 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setMeterType(1)}
                    className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        meterType === 1 ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    Prepaid {meterType === 1 && <Check size={12} />}
                </button>
                <button 
                    onClick={() => setMeterType(2)}
                    className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        meterType === 2 ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    Postpaid {meterType === 2 && <Check size={12} />}
                </button>
            </div>

            {/* Meter Input */}
            <div className="relative">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Meter / Account Number</label>
                    <div className="flex items-center gap-2">
                        {customerName && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${customerName.includes("Invalid") ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                                {customerName}
                            </span>
                        )}
                        <button 
                            onClick={() => setShowRecents(!showRecents)}
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full hover:bg-emerald-400/20 transition-colors"
                        >
                            <History size={12} /> Recent
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700 backdrop-blur-sm">
                    <Zap size={20} className="text-slate-500" />
                    <input
                        type="text"
                        value={meterNumber}
                        onChange={(e) => {
                            setMeterNumber(e.target.value);
                            if (e.target.value.length >= 10 && disco) verifyMeter(e.target.value);
                        }}
                        className="bg-transparent w-full font-bold text-white outline-none placeholder:text-slate-600"
                        placeholder="Enter Meter Number"
                    />
                </div>

                {/* Recents Dropdown */}
                {showRecents && (
                    <div className="mt-3 bg-slate-800 rounded-xl p-2 animate-in slide-in-from-top-2 border border-slate-700 absolute z-20 left-0 right-0 shadow-2xl">
                        <div className="flex justify-between items-center px-2 mb-2 border-b border-slate-700 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Select Recent Meter</span>
                            <button onClick={() => setShowRecents(false)}><X size={14} className="text-slate-500 hover:text-white"/></button>
                        </div>
                        <div className="max-h-[150px] overflow-y-auto custom-scrollbar">
                            {recentMeters.map((m, i) => (
                                <button 
                                    key={i}
                                    onClick={() => { setMeterNumber(m); setShowRecents(false); if(disco) verifyMeter(m); }}
                                    className="w-full flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg transition-colors text-left border-b border-slate-700/50 last:border-0"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-600">
                                        <Zap size={14} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-300 font-mono">{m}</span>
                                </button>
                            ))}
                            {recentMeters.length === 0 && (
                                <p className="text-center text-[10px] text-slate-500 py-4">No saved meters</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Body Section (Amounts) */}
        <div className="p-5">
            <h3 className="font-bold text-slate-700 mb-4 text-sm">Select Amount</h3>
            <div className="grid grid-cols-3 gap-3">
                {presetAmounts.map((amt) => (
                    <button
                        key={amt}
                        onClick={() => setAmount(amt.toString())}
                        className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all py-4 ${
                            amount === amt.toString() 
                            ? "border-emerald-600 bg-emerald-50 shadow-md" 
                            : "border-slate-100 bg-slate-50 hover:border-emerald-200"
                        }`}
                    >
                        <span className="text-lg font-black text-slate-800">₦{amt.toLocaleString()}</span>
                        <span className="text-[9px] font-bold text-slate-400">Pay ₦{amt.toLocaleString()}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-3">
             <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-4 border-2 border-transparent focus-within:border-emerald-500 transition-colors">
                <span className="text-slate-400 font-bold mr-1">₦</span>
                <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent w-full h-full font-black text-slate-800 outline-none text-lg"
                    placeholder="Enter Amount"
                />
             </div>
             <button
                onClick={handlePurchase}
                disabled={loading || !customerName || customerName.includes("Invalid") || !amount}
                className="px-8 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center"
            >
                {loading ? <Loader2 className="animate-spin" /> : "Pay"}
            </button>
        </div>

      </div>

      {/* Disco Selection Modal */}
      {showDiscoModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
             <div className="bg-white w-full max-w-sm rounded-[30px] overflow-hidden shadow-2xl">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                     <h3 className="font-black text-slate-800">Select Provider</h3>
                     <button onClick={() => setShowDiscoModal(false)} className="p-2 bg-slate-200 rounded-full"><ArrowLeft size={16}/></button>
                 </div>
                 <div className="max-h-[60vh] overflow-y-auto p-2">
                     {DISCOS.map((d: any) => (
                        <button
                            key={d.id}
                            onClick={() => { setDisco(d.id); setShowDiscoModal(false); setCustomerName(""); }}
                            className="w-full p-4 flex items-center gap-4 hover:bg-emerald-50 rounded-2xl transition-colors border-b border-slate-50 last:border-0"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                {d.logo ? <img src={d.logo} className="w-6 h-6 object-contain"/> : <Building2 size={20} className="text-slate-400"/>}
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800">{d.name}</p>
                                <p className="text-[10px] text-slate-400">{d.short}</p>
                            </div>
                        </button>
                     ))}
                 </div>
             </div>
        </div>
      )}

    </div>
  );
};

export default Electricity;