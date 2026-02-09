import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Building2, ChevronRight, Check, Zap, Wallet } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { DISCOS } from "../../constants";
import { useToast } from "../ui/ToastProvider";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import PinPrompt from "../PinPrompt";
import ConfirmTransactionModal from "../ConfirmTransactionModal";
import { hashPin } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";

interface ElectricityProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const Electricity = ({ user, onUpdateBalance, onBack }: ElectricityProps) => {
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [loading, setLoading] = useState(false);
  const [disco, setDisco] = useState<string | null>(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState(1); // 1 = Prepaid, 2 = Postpaid
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [showDiscoModal, setShowDiscoModal] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Recents State
  const [recentBeneficiaries, setRecentBeneficiaries] = useState<Beneficiary[]>([]);

  // --- 1. INITIALIZE & PRE-FILL ---
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'electricity', 5);
        setRecentBeneficiaries(recents);
      } catch (e) {
        console.error("Error fetching beneficiaries:", e);
      }
    };
    loadRecents();

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
  const saveRecentMeter = async (meter: string) => {
      if (meter.length < 10 || !disco) return;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        await beneficiaryService.upsert({
          user_id: auth.user.id,
          type: 'electricity',
          beneficiary_key: `meter:${meter}|disco:${disco}|type:${meterType}`,
          meter_number: meter,
          disco,
          meter_type: String(meterType)
        });
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'electricity', 5);
        setRecentBeneficiaries(recents);
      } catch (e) {
        console.error("Error saving beneficiary:", e);
      }
  };

  // --- 4. PURCHASE LOGIC ---
  const doPurchase = async () => {
    if (!amount || !meterNumber || !disco || !customerName || customerName.includes("Invalid")) return;
    if (user.balance < Number(amount)) return showToast("Insufficient Balance", "error");

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
          user_id: user.id,
          user_email: user.email,
          type: "Electricity",
          amount: Number(amount),
          status: "Success",
          ref: `ELEC-${Date.now()}`,
          meta: { token: data.token || data.metertoken || "Token sent to phone" }
        });
        
        saveRecentMeter(meterNumber);

        showSuccess({
          title: "Transfer successful",
          amount: Number(amount),
          message: `Token: ${data.token || data.metertoken || "Check receipt"}`,
          subtitle: meterNumber ? `FOR ${meterNumber}` : undefined,
        });
        setMeterNumber("");
        setAmount("");
        setCustomerName("");
      } else {
        throw new Error(data.message || "Transaction Failed");
      }
    } catch (e: any) {
      showToast(e.message || "Transaction Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const requirePin = (action: () => void) => {
    if (!user?.pinHash || !user?.id) {
      showToast("Please set your PIN in Profile", "error");
      return;
    }
    setPendingAction(() => action);
    setPinError("");
    setPinOpen(true);
  };

  const handlePinConfirm = async (pin: string) => {
    if (!user?.pinHash || !user?.id) return;
    const h = await hashPin(pin, user.id);
    if (h !== user.pinHash) {
      setPinError("Incorrect PIN");
      return;
    }
    setPinOpen(false);
    const act = pendingAction;
    setPendingAction(null);
    if (act) act();
  };

  const handlePurchase = () => {
    setConfirmOpen(true);
  };

  const presetAmounts = [1000, 2000, 3000, 5000, 10000, 20000];
  const selectedDiscoObj = DISCOS.find(d => d.id === disco);

  return (
    <>
    <div className="animate-in slide-in-from-right duration-300 pb-24 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1 rounded-full balance-pill">
            <Wallet size={14} className="text-emerald-600"/>
            <span className="text-sm font-black text-emerald-600">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Top Section (Dark) */}
        <div className="p-6 bg-emerald-700 dark:bg-slate-900 text-white">
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
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Recent
                        </div>
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

                {/* Recent Recipients Chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                    {recentBeneficiaries.map((b) => (
                        <button
                          key={b.beneficiary_key}
                          onClick={() => {
                            if (b.meter_number) setMeterNumber(b.meter_number);
                            if (b.disco) setDisco(b.disco);
                            if (b.meter_type) setMeterType(Number(b.meter_type));
                            if (b.meter_number && (b.disco || disco)) verifyMeter(b.meter_number);
                          }}
                          className="px-3 py-1 rounded-full text-[10px] font-bold border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500 transition-colors"
                        >
                          {b.meter_number}
                        </button>
                    ))}
                    {recentBeneficiaries.length === 0 && (
                      <span className="text-[10px] text-slate-500">No saved meters</span>
                    )}
                </div>
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
                        <span className="text-lg font-black text-slate-800">₦{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-[9px] font-bold text-slate-400">Pay ₦{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
    <PinPrompt
      open={pinOpen}
      requiredLength={user?.pinLength || null}
      onConfirm={handlePinConfirm}
      onClose={() => setPinOpen(false)}
      error={pinError}
    />
    <ConfirmTransactionModal
      open={confirmOpen}
      title="Confirm Transaction"
      subtitle={meterNumber ? `FOR ${meterNumber}` : undefined}
      amountLabel="Total Pay"
      amount={Number(amount || 0)}
      confirmLabel="Purchase Now"
      onConfirm={() => {
        setConfirmOpen(false);
        requirePin(doPurchase);
      }}
      onClose={() => setConfirmOpen(false)}
    />
    </>
  );
};

export default Electricity;
