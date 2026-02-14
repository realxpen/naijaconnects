import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Zap, Wifi, CheckCircle2, Star } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import PinPrompt from "../PinPrompt";
import ConfirmTransactionModal from "../ConfirmTransactionModal";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";

interface DataBundleProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const DataBundle = ({ user, onUpdateBalance, onBack }: DataBundleProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [loading, setLoading] = useState(false);
  const [networkId, setNetworkId] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // UI States
  const [activeTab, setActiveTab] = useState<"HOT" | "Daily" | "Weekly" | "Monthly">("HOT");
  const [selectedPlanType, setSelectedPlanType] = useState("ALL"); // ALL, SME, CG, GIFTING
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoritePlans, setFavoritePlans] = useState<Set<string>>(new Set());

  // Recents & User Phone State
  const [recentBeneficiaries, setRecentBeneficiaries] = useState<Beneficiary[]>([]);
  const [userPhone, setUserPhone] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // --- 1. INITIALIZE & PRE-FILL USER PHONE ---
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'data', 5);
        setRecentBeneficiaries(recents);
      } catch (e) {
        console.error("Error fetching beneficiaries:", e);
      }
    };
    loadRecents();

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

  useEffect(() => {
    if (!user?.id) return;
    const key = `swifna_fav_plans_${user.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return setFavoritePlans(new Set());
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setFavoritePlans(new Set(arr));
    } catch {
      setFavoritePlans(new Set());
    }
  }, [user?.id]);

  const toggleFavorite = (planId: string) => {
    if (!user?.id) return;
    const next = new Set(favoritePlans);
    if (next.has(planId)) next.delete(planId);
    else next.add(planId);
    setFavoritePlans(next);
    const key = `swifna_fav_plans_${user.id}`;
    localStorage.setItem(key, JSON.stringify(Array.from(next)));
  };

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
      if (favoriteOnly && !favoritePlans.has(String(p.plan_id))) return false;
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
  }, [plans, activeTab, selectedPlanType, favoriteOnly, favoritePlans]);

  // --- 5. SAVE RECENT NUMBER ---
  const saveRecentNumber = async (number: string) => {
      if (number.length < 11 || number === userPhone) return;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        await beneficiaryService.upsert({
          user_id: auth.user.id,
          type: 'data',
          beneficiary_key: `phone:${number}|net:${networkId}`,
          phone_number: number,
          network: networkId
        });
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'data', 5);
        setRecentBeneficiaries(recents);
      } catch (e) {
        console.error("Error saving beneficiary:", e);
      }
  };

  // --- 6. PURCHASE LOGIC ---
  const doPurchaseForPlan = async (plan: any) => {
    if (!plan || !phoneNumber) return;
    if (user.balance < plan.amount) return showToast(t("data.insufficient_balance"), "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_data",
          payload: {
            network: networkId,
            phone: phoneNumber,
            plan_id: plan.plan_id,
          },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true;
      if (isSuccess) {
        const newBal = user.balance - plan.amount;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_id: user.id,
          user_email: user.email,
          type: "Data",
          amount: plan.amount,
          status: "Success",
          ref: `DAT-${Date.now()}`,
        });
        
        saveRecentNumber(phoneNumber);

        showSuccess({
          title: "Transfer successful",
          amount: Number(plan.amount),
          message: "Your data purchase has been processed successfully.",
          subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
        });
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
    const ok = await verifyPinHash(pin, user.pinHash, { userId: user.id, email: user.email });
    if (!ok) {
      setPinError("Incorrect PIN");
      return;
    }
    setPinOpen(false);
    const act = pendingAction;
    setPendingAction(null);
    if (act) act();
  };

  const handlePurchase = () => {
    if (!selectedPlan) return;
    setConfirmOpen(true);
  };

  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan);
    if (phoneNumber.length < 11) return;
    setConfirmOpen(true);
  };

  const getDisplaySize = (name: string) => {
    const match = name.match(/(\d+\.?\d*)\s*(GB|MB|TB)/i);
    return match ? `${match[1]} ${match[2]}` : "DATA";
  };

  const stripSizeFromName = (name: string) => {
    return name.replace(/(\d+\.?\d*)\s*(GB|MB|TB)/gi, '').replace(/\s+/g, ' ').trim();
  };

  return (
    <>
    <div className="animate-in slide-in-from-right duration-300 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
          <ArrowLeft size={16} /> {t("common.back")}
        </button>
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">{t("common.balance")}:</span>
            <span className="text-sm font-black text-emerald-600">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Phone Input Section (Updated to match Airtime) */}
        <div className="p-6 bg-emerald-700 dark:bg-slate-900 text-white relative">
            <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("airtime.mobile_number")}</label>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {t("common.recent")}
                </div>
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

            {/* Recent Recipients Chips */}
            <div className="mt-3 flex flex-wrap gap-2">
                {userPhone && (
                    <button
                      onClick={() => setPhoneNumber(userPhone)}
                      className="px-3 py-1 rounded-full text-[10px] font-bold border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500 transition-colors"
                    >
                      {t("common.my_number")}
                    </button>
                )}
                {recentBeneficiaries.map((b) => (
                    <button
                      key={b.beneficiary_key}
                      onClick={() => {
                        if (b.phone_number) setPhoneNumber(b.phone_number);
                        if (b.network) setNetworkId(b.network);
                      }}
                      className="px-3 py-1 rounded-full text-[10px] font-bold border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500 transition-colors"
                    >
                      {b.phone_number}
                    </button>
                ))}
                {recentBeneficiaries.length === 0 && !userPhone && (
                  <span className="text-[10px] text-slate-500">{t("common.no_recent_transactions")}</span>
                )}
            </div>
            
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
                 <button
                    onClick={() => setFavoriteOnly(!favoriteOnly)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-1 ${
                        favoriteOnly
                        ? "bg-emerald-700 text-white shadow-md dark:bg-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                 >
                    <Star size={12} className={favoriteOnly ? "text-yellow-300" : "text-slate-400"} />
                    Favorites
                 </button>
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
                            ? "bg-emerald-700 text-white shadow-md dark:bg-slate-900" 
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
                            onClick={() => handlePlanSelect(plan)}
                            className={`relative flex flex-col justify-between p-4 rounded-2xl text-left border-2 transition-all group ${
                                selectedPlan?.plan_id === plan.plan_id
                                ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200 ring-offset-1"
                                : "border-slate-100 bg-slate-50 hover:border-emerald-200"
                            }`}
                        >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(String(plan.plan_id));
                              }}
                              className="absolute top-2 right-2 p-1 rounded-full bg-white/80 border border-slate-200 hover:border-emerald-400 transition-colors"
                            >
                              <Star
                                size={14}
                                className={favoritePlans.has(String(plan.plan_id)) ? "text-yellow-400 fill-yellow-400" : "text-slate-300"}
                              />
                            </button>
                            {selectedPlan?.plan_id === plan.plan_id && (
                                <div className="absolute top-2 left-2 text-emerald-600">
                                    <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-xl font-black text-slate-800 leading-none mb-1">
                                    {getDisplaySize(plan.plan_name)}
                                </h3>
                                <p className="text-[9px] font-bold text-slate-400 line-clamp-2 leading-tight h-6">
                                    {stripSizeFromName(plan.plan_name)}
                                </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold mb-0.5">{t("data.price")}</p>
                                    <p className="text-sm font-black text-slate-900">₦{Number(plan.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] uppercase font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                        {`${plan.plan_type || 'PLAN'} (${plan.validity || ''})`}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
        
        {/* Footer Action removed: purchase now happens on plan selection */}

      </div>
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
      subtitle={phoneNumber ? `FOR ${phoneNumber}` : undefined}
      amountLabel="Total Pay"
      amount={Number(selectedPlan?.amount || 0)}
      confirmLabel="Purchase Now"
      onConfirm={() => {
        setConfirmOpen(false);
        if (!selectedPlan) return;
        requirePin(() => doPurchaseForPlan(selectedPlan));
      }}
      onClose={() => setConfirmOpen(false)}
    />
    </>
  );
};

export default DataBundle;
