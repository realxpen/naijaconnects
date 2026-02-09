import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Tv, CheckCircle2, User, Wallet } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CABLE_PROVIDERS } from "../../constants";
import { useToast } from "../ui/ToastProvider";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import PinPrompt from "../PinPrompt";
import { hashPin } from "../../utils/pin";

interface CableTvProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const CableTv = ({ user, onUpdateBalance, onBack }: CableTvProps) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gotv");
  const [iuc, setIuc] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  // Recents State
  const [recentBeneficiaries, setRecentBeneficiaries] = useState<Beneficiary[]>([]);

  // --- 1. INITIALIZE & LOAD RECENTS ---
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'cable', 5);
        setRecentBeneficiaries(recents);
      } catch (e) {
        console.error("Error fetching beneficiaries:", e);
      }
    };
    loadRecents();
    
    // Pre-fill phone if available
    if (user.phone) setPhone(user.phone);
  }, [user]);

  // --- 2. FETCH PLANS ---
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      setPlans([]);
      setSelectedPlan(null);
      try {
        const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
          body: { action: "fetch_cable_plans" },
        });
        if (error) throw error;
        const key = provider.toLowerCase();
        if (data && data[key]) {
             // Sort by price ascending
             const sorted = data[key].sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));
             setPlans(sorted);
        }
      } catch (e) {
        console.error("Cable Plan Error", e);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [provider]);

  // --- 3. VERIFY SMARTCARD ---
  const verifyIuc = async (number: string) => {
    if (number.length < 10) return;
    setCustomerName("Verifying...");
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "verify_smartcard",
          payload: { number, iuc: number, provider },
        },
      });

      if (error) throw error;
      const name = data.customer_name || data.name || data.content?.Customer_Name;
      setCustomerName(name && !name.includes("INVALID") ? name : "Invalid Number");
    } catch (e) {
      setCustomerName("Verification Failed");
    }
  };

  // --- 4. FILTER PLANS ---
  const filteredPlans = useMemo(() => {
      if (activeTab === "All") return plans;
      return plans.filter(p => {
          const name = p.name.toLowerCase();
          if (activeTab === "Monthly") return name.includes("month") || (!name.includes("day") && !name.includes("week"));
          if (activeTab === "Weekly") return name.includes("week");
          if (activeTab === "Daily") return name.includes("day");
          return true;
      });
  }, [plans, activeTab]);

  // --- 5. SAVE RECENT ---
  const saveRecentIuc = async (number: string) => {
      if (number.length < 10) return;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        await beneficiaryService.upsert({
          user_id: auth.user.id,
          type: 'cable',
          beneficiary_key: `iuc:${number}|prov:${provider}`,
          smart_card_number: number,
          provider
        });
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'cable', 5);
        setRecentBeneficiaries(recents);
      } catch (e) {
        console.error("Error saving beneficiary:", e);
      }
  };

  // --- 6. PURCHASE ---
  const doPurchase = async () => {
    if (!selectedPlan || !iuc || customerName.includes("Invalid")) return;
    const cost = parseFloat(selectedPlan.amount);
    if (user.balance < cost) return showToast("Insufficient Balance", "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "buy_cable",
          payload: {
            provider,
            iuc,
            plan_code: selectedPlan.id,
            amount: cost,
            phone: phone || "08000000000",
          },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true || (data.data && data.data.status === "ORDER_RECEIVED");

      if (isSuccess) {
        const newBal = user.balance - cost;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_email: user.email,
          type: "Cable",
          amount: cost,
          status: "Success",
          ref: `CAB-${Date.now()}`,
        });
        
        saveRecentIuc(iuc);

        showToast("Cable Subscription Successful!", "success");
        setIuc("");
        setCustomerName("");
        setSelectedPlan(null);
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
    requirePin(doPurchase);
  };

  return (
    <>
    <div className="animate-in slide-in-from-right duration-300 pb-20">
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
        
        {/* Provider Selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-100">
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
            {CABLE_PROVIDERS.map((p) => (
                <button
                key={p.id}
                onClick={() => { setProvider(p.id); setPlans([]); setSelectedPlan(null); setActiveTab("All"); setCustomerName(""); }}
                className={`flex-1 min-w-[80px] py-3 px-4 rounded-xl font-bold text-xs border-2 whitespace-nowrap transition-all ${
                    provider === p.id 
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-md" 
                    : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300"
                }`}
                >
                {p.name}
                </button>
            ))}
            </div>
        </div>

        {/* Smartcard Input Section (Dark Theme style) */}
        <div className="p-6 bg-slate-900 text-white relative">
            <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Smartcard / IUC</label>
                <div className="flex items-center gap-2">
                    {customerName && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${customerName.includes("Invalid") || customerName.includes("Failed") ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                            {customerName}
                        </span>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Recent
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700 backdrop-blur-sm mb-4 relative">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                    <User size={16} />
                </div>
                <input
                    type="text"
                    value={iuc}
                    onChange={(e) => {
                        setIuc(e.target.value);
                        if (e.target.value.length >= 10) verifyIuc(e.target.value);
                    }}
                    className="bg-transparent w-full font-bold text-white outline-none placeholder:text-slate-600"
                    placeholder="Enter IUC Number"
                />
            </div>

            {/* Recent Recipients Chips */}
            <div className="mt-2 flex flex-wrap gap-2">
                {recentBeneficiaries.map((b) => (
                    <button
                      key={b.beneficiary_key}
                      onClick={() => {
                        if (b.smart_card_number) {
                          setIuc(b.smart_card_number);
                          verifyIuc(b.smart_card_number);
                        }
                        if (b.provider) setProvider(b.provider);
                      }}
                      className="px-3 py-1 rounded-full text-[10px] font-bold border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500 transition-colors"
                    >
                      {b.smart_card_number}
                    </button>
                ))}
                {recentBeneficiaries.length === 0 && (
                  <span className="text-[10px] text-slate-500">No saved cards</span>
                )}
            </div>

            <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-transparent border-b border-slate-700 p-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500 transition-colors"
                placeholder="Buyer Phone Number (Optional)"
            />
        </div>

        {/* Plans Section */}
        <div className="p-4">
             {/* Filter Tabs */}
             <div className="flex gap-4 mb-4 border-b border-slate-100 pb-2">
                {["All", "Monthly", "Weekly", "Daily"].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-xs font-bold pb-2 transition-all ${
                            activeTab === tab ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-400 hover:text-slate-600"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
             </div>

             {loadingPlans ? (
                 <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></div>
             ) : (
                 <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                     {filteredPlans.length === 0 && <p className="col-span-2 text-center text-xs text-slate-400 py-4">No plans found.</p>}
                     
                     {filteredPlans.map((p) => (
                         <button
                           key={p.id}
                           onClick={() => setSelectedPlan(p)}
                           className={`relative p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between min-h-[100px] group ${
                               selectedPlan?.id === p.id 
                               ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-200" 
                               : "border-slate-100 bg-slate-50 hover:border-emerald-200"
                           }`}
                         >
                            {selectedPlan?.id === p.id && <CheckCircle2 size={16} className="absolute top-2 right-2 text-emerald-600" />}
                            
                            <div>
                                <h3 className="text-sm font-black text-slate-800 leading-tight mb-2 line-clamp-2">{p.name}</h3>
                                {/* Duration Pill */}
                                <span className="inline-block bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-orange-200">
                                    {p.name.toLowerCase().includes("week") ? "Weekly" : p.name.toLowerCase().includes("day") ? "Daily" : "1 Month"}
                                </span>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-slate-400">Price</p>
                                    <span className="block text-lg font-black text-slate-900">₦{parseFloat(p.amount).toLocaleString()}</span>
                                </div>
                            </div>
                         </button>
                     ))}
                 </div>
             )}
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
             <button
                onClick={handlePurchase}
                disabled={loading || !selectedPlan || !customerName || customerName.includes("Invalid")}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                        <span>Pay</span>
                        {selectedPlan && <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{parseFloat(selectedPlan.amount).toLocaleString()}</span>}
                    </>
                )}
            </button>
        </div>

      </div>
    </div>
    <PinPrompt
      open={pinOpen}
      requiredLength={user?.pinLength || null}
      onConfirm={handlePinConfirm}
      onClose={() => setPinOpen(false)}
      error={pinError}
    />
    </>
  );
};

export default CableTv;