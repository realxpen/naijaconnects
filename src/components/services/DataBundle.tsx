import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Zap, Wifi, CheckCircle2, History, User, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";

interface DataBundleProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const DataBundle = ({ user, onUpdateBalance, onBack }: DataBundleProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [networkId, setNetworkId] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // UI States
  const [activeTab, setActiveTab] = useState<"HOT" | "Daily" | "Weekly" | "Monthly">("HOT");
  const [selectedPlanType, setSelectedPlanType] = useState("ALL"); // ALL, SME, CG, GIFTING
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  // Recents & User Phone State
  const [showRecents, setShowRecents] = useState(false);
  const [recentNumbers, setRecentNumbers] = useState<string[]>([]);
  const [userPhone, setUserPhone] = useState("");

  // --- 1. INITIALIZE & PRE-FILL USER PHONE ---
  useEffect(() => {
    // Load local recent numbers
    const saved = localStorage.getItem("data_recents");
    if (saved) setRecentNumbers(JSON.parse(saved));

    // Fetch user's phone and PRE-FILL input
    const fetchUserPhone = async () => {
        let phoneToUse = user.phone;

        if (!phoneToUse) {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('phone')
                    .eq('email', user.email)
                    .single();
                
                if (data?.phone) phoneToUse = data.phone;
            } catch (e) {
                console.error("Error fetching user phone:", e);
            }
        }

        if (phoneToUse) {
            setUserPhone(phoneToUse);
            setPhoneNumber(phoneToUse); // <--- AUTO-FILL INPUT
        }
    };
    fetchUserPhone();
  }, [user]);

  // --- 2. ROBUST AUTO-DETECT NETWORK ---
  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length >= 4) {
      const prefix = cleanPhone.slice(0, 4);

      // MTN
      if (["0803", "0806", "0703", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"].includes(prefix)) {
        setNetworkId(1);
      }
      // GLO
      else if (["0805", "0807", "0705", "0815", "0811", "0905", "0915"].includes(prefix)) {
        setNetworkId(2);
      }
      // AIRTEL
      else if (["0802", "0808", "0708", "0812", "0902", "0907", "0901", "0904"].includes(prefix)) {
        setNetworkId(3);
      }
      // 9MOBILE
      else if (["0809", "0818", "0817", "0909", "0908"].includes(prefix)) {
        setNetworkId(4);
      }
    }
  }, [phoneNumber]);

  // --- 3. FETCH PLANS ---
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      setPlans([]);
      setSelectedPlan(null);
      try {
        const { data, error } = await supabase
          .from("data_plans")
          .select("*")
          .eq("network_id", networkId);

        if (error) throw error;
        if (data) setPlans(data);
      } catch (e) {
        console.error("Fetch Plan Error", e);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [networkId]);

  // --- 4. FILTERING LOGIC ---
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const name = (p.plan_name || "").toUpperCase();
      const validity = (p.validity || "").toUpperCase();

      // A. Data Type Filter
      let typeMatch = true;
      if (selectedPlanType === "SME") typeMatch = name.includes("SME");
      else if (selectedPlanType === "CG") typeMatch = name.includes("CG") || name.includes("CORPORATE");
      else if (selectedPlanType === "GIFTING") typeMatch = name.includes("GIFT") || (!name.includes("SME") && !name.includes("CG"));
      
      if (!typeMatch) return false;

      // B. Tab (Validity) Filter
      if (activeTab === "HOT") return true; 
      
      if (activeTab === "Daily") {
        return validity.includes("1 DAY") || validity.includes("2 DAY") || validity.includes("24") || name.includes("DAILY");
      }
      if (activeTab === "Weekly") {
        return validity.includes("7 DAY") || validity.includes("14 DAY") || validity.includes("WEEK");
      }
      if (activeTab === "Monthly") {
        return validity.includes("30") || validity.includes("MONTH");
      }

      return true;
    });
  }, [plans, activeTab, selectedPlanType]);

  // --- 5. SAVE RECENT NUMBER ---
  const saveRecentNumber = (number: string) => {
      if (number.length < 11 || number === userPhone) return;
      const filtered = recentNumbers.filter(n => n !== number);
      const newRecents = [number, ...filtered].slice(0, 5); 
      setRecentNumbers(newRecents);
      localStorage.setItem("data_recents", JSON.stringify(newRecents));
  };

  // --- 6. PURCHASE LOGIC ---
  const handlePurchase = async () => {
    if (!selectedPlan || !phoneNumber) return;
    if (user.balance < selectedPlan.amount) return showToast(t("data.insufficient_balance"), "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_data",
          payload: {
            network: networkId,
            phone: phoneNumber,
            plan_id: selectedPlan.plan_id,
          },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true;
      if (isSuccess) {
        const newBal = user.balance - selectedPlan.amount;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_email: user.email,
          type: "Data",
          amount: selectedPlan.amount,
          status: "Success",
          ref: `DAT-${Date.now()}`,
        });
        
        saveRecentNumber(phoneNumber);

        showToast(t("data.success_sent", { plan: selectedPlan.plan_name }), "success");
        setPhoneNumber(userPhone); // Reset to user
        setSelectedPlan(null);
      } else {
        throw new Error(data.message || "Failed");
      }
    } catch (e: any) {
      showToast(e.message || t("data.transaction_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const getDisplaySize = (name: string) => {
    const match = name.match(/(\d+\.?\d*)\s*(GB|MB|TB)/i);
    return match ? `${match[1]} ${match[2]}` : "DATA";
  };

  return (
    <div className="animate-in slide-in-from-right duration-300 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
          <ArrowLeft size={16} /> {t("common.back")}
        </button>
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">{t("common.balance")}:</span>
            <span className="text-sm font-black text-emerald-600">₦{user.balance.toLocaleString()}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Phone Input Section (Updated to match Airtime) */}
        <div className="p-6 bg-slate-900 text-white relative">
            <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("airtime.mobile_number")}</label>
                <button 
                    onClick={() => setShowRecents(!showRecents)}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full hover:bg-emerald-400/20 transition-colors"
                >
                    <History size={12} /> {t("common.recent")}
                </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 backdrop-blur-sm relative">
                {/* Network Icon */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                    <img 
                        src={CARRIERS.find(c => c.id === networkId)?.logo} 
                        className="w-full h-full object-cover rounded-full"
                        alt="Network"
                    />
                </div>
                
                {/* Input */}
                <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="bg-transparent w-full text-2xl font-black text-white outline-none placeholder:text-slate-600"
                    placeholder="080..."
                />
            </div>

            {/* Recents Dropdown */}
            {showRecents && (
                <div className="mt-3 bg-slate-800 rounded-xl p-2 animate-in slide-in-from-top-2 border border-slate-700 absolute z-20 left-6 right-6 shadow-2xl">
                    <div className="flex justify-between items-center px-2 mb-2 border-b border-slate-700 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t("data.select_recent")}</span>
                        <button onClick={() => setShowRecents(false)}><X size={14} className="text-slate-500 hover:text-white"/></button>
                    </div>
                    
                    {/* My Number */}
                    {userPhone && (
                        <button 
                            onClick={() => { setPhoneNumber(userPhone); setShowRecents(false); }}
                            className="w-full flex items-center gap-3 p-3 bg-emerald-900/30 border border-emerald-900/50 hover:bg-emerald-900/50 rounded-lg transition-colors text-left mb-2 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <User size={14} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{t("common.my_number")}</p>
                                <p className="text-[10px] text-emerald-400 font-mono tracking-wide">{userPhone}</p>
                            </div>
                        </button>
                    )}

                    {/* Recent Transactions */}
                    <div className="max-h-[150px] overflow-y-auto custom-scrollbar">
                        {recentNumbers.map((num, i) => (
                            <button 
                                key={i}
                                onClick={() => { setPhoneNumber(num); setShowRecents(false); }}
                                className="w-full flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg transition-colors text-left border-b border-slate-700/50 last:border-0"
                            >
                                <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-600">
                                    <History size={14} />
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-300 font-mono">{num}</span>
                                    <span className="text-[9px] text-slate-500">{t("data.recent_data")}</span>
                                </div>
                            </button>
                        ))}
                        {recentNumbers.length === 0 && (
                            <p className="text-center text-[10px] text-slate-500 py-4">{t("common.no_recent_transactions")}</p>
                        )}
                    </div>
                </div>
            )}
            
            {/* Manual Network Selector (Optional override) */}
            <div className="flex gap-2 mt-4 justify-end">
                 {CARRIERS.filter(c => c.name !== "SMILE").map(c => (
                     <button 
                        key={c.id}
                        onClick={() => setNetworkId(c.id)}
                        className={`w-2 h-2 rounded-full transition-all ${networkId === c.id ? "bg-emerald-500 w-6" : "bg-slate-700"}`}
                     />
                 ))}
            </div>
        </div>

        {/* Data Plans Section */}
        <div className="p-4">
            {/* TABS */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                {[
                  { key: "HOT", label: t("data.tab.hot") },
                  { key: "Daily", label: t("data.tab.daily") },
                  { key: "Weekly", label: t("data.tab.weekly") },
                  { key: "Monthly", label: t("data.tab.monthly") }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`text-xs font-bold pb-2 border-b-2 transition-all px-2 ${
                            activeTab === tab.key 
                            ? "text-emerald-600 border-emerald-600" 
                            : "text-slate-400 border-transparent hover:text-slate-600"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* SUB-TABS */}
            <div className="flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2">
                 {[
                   { key: "ALL", label: t("data.type.all") },
                   { key: "SME", label: t("data.type.sme") },
                   { key: "CG", label: t("data.type.cg") },
                   { key: "GIFTING", label: t("data.type.gifting") }
                 ].map(type => (
                     <button
                        key={type.key}
                        onClick={() => setSelectedPlanType(type.key)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                            selectedPlanType === type.key 
                            ? "bg-slate-900 text-white shadow-md" 
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                     >
                        {type.label}
                     </button>
                 ))}
            </div>

            {/* PLANS GRID */}
            {loadingPlans ? (
                <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></div>
            ) : filteredPlans.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">{t("data.no_plans")}</div>
            ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredPlans.map((plan) => (
                        <button
                            key={plan.plan_id}
                            onClick={() => setSelectedPlan(plan)}
                            className={`relative flex flex-col justify-between p-4 rounded-2xl text-left border-2 transition-all group ${
                                selectedPlan?.plan_id === plan.plan_id
                                ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200 ring-offset-1"
                                : "border-slate-100 bg-slate-50 hover:border-emerald-200"
                            }`}
                        >
                            {selectedPlan?.plan_id === plan.plan_id && (
                                <div className="absolute top-2 right-2 text-emerald-600">
                                    <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-xl font-black text-slate-800 leading-none mb-1">
                                    {getDisplaySize(plan.plan_name)}
                                </h3>
                                <p className="text-[9px] font-bold text-slate-400 line-clamp-2 leading-tight h-6">
                                    {plan.plan_name}
                                </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold mb-0.5">{t("data.price")}</p>
                                    <p className="text-sm font-black text-slate-900">₦{plan.amount}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] uppercase font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                        {plan.validity}
                                    </p>
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
                disabled={loading || !selectedPlan || phoneNumber.length < 11}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                        <span>{t("data.buy_bundle")}</span>
                        {selectedPlan && <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{selectedPlan.amount}</span>}
                    </>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};

export default DataBundle;
