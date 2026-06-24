import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Zap, Wifi, CheckCircle2, Star, Wallet, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../../services/piNetworkService";

interface DataBundleProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void; // 🪙 Global Pi updates context handler hook
  onBack: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

const DataBundle = ({ user, onUpdateBalance, onUpdatePiBalance, onBack, isGuest = false, onRequireAuth }: DataBundleProps) => {
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

  // Frictionless Checkout States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);

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
        setPhoneNumber(phoneToUse);
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
      if (["0803", "0806", "0703", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"].includes(prefix)) {
        setNetworkId(1);
      } else if (["0805", "0807", "0705", "0815", "0811", "0905", "0915"].includes(prefix)) {
        setNetworkId(2);
      } else if (["0802", "0808", "0708", "0812", "0902", "0907", "0901", "0904"].includes(prefix)) {
        setNetworkId(3);
      } else if (["0809", "0818", "0817", "0909", "0908"].includes(prefix)) {
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

  // --- 3.5. FETCH DYNAMIC PI RATIO ON PLAN SELECTION ---
  const fetchPiQuoteForPlan = async (planNairaCost: number) => {
    setIsFetchingPiRate(true);
    setLivePiQuote(null);
    try {
      const { data, error } = await supabase.functions.invoke("pi-payment-handler", {
        body: {
          action: "CREATE_PAYMENT",
          nairaAmount: planNairaCost,
          serviceId: "00000000-0000-0000-0000-000000000000"
        }
      });
      if (!error && data) {
        setLivePiQuote({
          rate: Number(data.rate_ngn_per_pi || 0),
          piAmount: Number(data.pi_amount || 0)
        });
      }
    } catch (err) {
      console.warn("Failed to update crypto pricing matrices:", err);
    } finally {
      setIsFetchingPiRate(false);
    }
  };

  // --- 4. FILTERING LOGIC ---
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (favoriteOnly && !favoritePlans.has(String(p.plan_id))) return false;
      const name = (p.plan_name || "").toUpperCase();
      const validity = (p.validity || "").toUpperCase();

      let typeMatch = true;
      if (selectedPlanType === "SME") typeMatch = name.includes("SME");
      else if (selectedPlanType === "CG") typeMatch = name.includes("CG") || name.includes("CORPORATE");
      else if (selectedPlanType === "GIFTING") typeMatch = name.includes("GIFT") || (!name.includes("SME") && !name.includes("CG"));

      if (!typeMatch) return false;

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

  const handleIncompletePiPayment = (payment: PiPaymentDTO) => {
    const reference = String(payment?.metadata?.reference || "");
    if (!reference) return;
    void supabase.functions.invoke("pi-payment-handler", {
      body: { action: "COMPLETE_PAYMENT", reference, paymentId: payment?.identifier, txid: payment?.transaction?.txid }
    }).catch(err => console.warn("Incomplete utility error:", err));
  };

  // ==============================================================
  // TRANSACTION PIPELINE RUNNERS
  // ==============================================================
  const executeNairaWalletPurchase = async () => {
    if (!selectedPlan) return;
    if (user.balance < selectedPlan.amount) return showToast(t("data.insufficient_balance"), "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_data",
          payload: { network: networkId, phone: phoneNumber, plan_id: selectedPlan.plan_id },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true;
      if (isSuccess) {
        const newBal = user.balance - selectedPlan.amount;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_id: user.id,
          user_email: user.email,
          type: "Data",
          amount: selectedPlan.amount,
          status: "Success",
          ref: `DAT-${Date.now()}`,
        });

        saveRecentNumber(phoneNumber);
        setCheckoutOpen(false);

        showSuccess({
          title: "Transfer successful",
          amount: Number(selectedPlan.amount),
          message: "Your data purchase has been processed successfully.",
          subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
        });
        setPhoneNumber(userPhone);
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

  const executeInternalPiPurchase = async () => {
    if (!selectedPlan || !livePiQuote || livePiQuote.piAmount <= 0) return showToast("Quote validation unresolved.", "error");
    if ((user.piBalance || 0) < livePiQuote.piAmount) {
      return showToast(`Insufficient internal Pi balance. You require: ${livePiQuote.piAmount} π`, "error");
    }

    setLoading(true);
    try {
      const carrierName = CARRIERS.find(c => c.id === networkId)?.name || "Network";
      const { data: res, error: rpcErr } = await supabase.rpc("purchase_service_with_internal_pi", {
        p_user_id: user.id,
        p_pi_amount: livePiQuote.piAmount,
        p_service_type: "Data",
        p_description: `Purchased ${selectedPlan.plan_name} ${carrierName} Data Pack via internal Pi allocation balance for line: ${phoneNumber}`,
        p_meta: { cost_ngn: selectedPlan.amount, rate: livePiQuote.rate, phone: phoneNumber, network: networkId, plan_id: selectedPlan.plan_id }
      });

      if (rpcErr || !res?.success) throw new Error(res?.message || rpcErr?.message || "Internal wallet transaction validation fault.");
      if (onUpdatePiBalance) onUpdatePiBalance(Number(res.new_balance));

      await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_data",
          payload: { network: networkId, phone: phoneNumber, plan_id: selectedPlan.plan_id },
        },
      });

      await saveRecentNumber(phoneNumber);
      setCheckoutOpen(false);

      showSuccess({
        title: "Internal Purchase Successful",
        amount: selectedPlan.amount,
        message: `Deducted ${livePiQuote.piAmount} π from your internal crypto balance. Data request is being delivered.`,
        subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
      });
      setSelectedPlan(null);
    } catch (e: any) {
      showToast(e.message || "Internal checking transaction dropped.", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeDirectPiNetworkPurchase = async () => {
    if (!selectedPlan || !livePiQuote || !phoneNumber) return;
    showToast("Launching connection to external Pi App Sandbox...", "info");
    setLoading(true);

    try {
      await authenticatePiUser(handleIncompletePiPayment);
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("pi-payment-handler", {
        body: { action: "CREATE_PAYMENT", nairaAmount: selectedPlan.amount, serviceId: "00000000-0000-0000-0000-000000000000" }
      });

      if (quoteErr || !quote?.success) throw new Error(quote?.error || "Pricing matrix session expired.");
      const reference = String(quote.reference || "");
      const finalPiCost = Number(quote.pi_amount || 0);

      const carrierName = CARRIERS.find(c => c.id === networkId)?.name || "Network";

      await createPiPayment(
        {
          amount: finalPiCost,
          memo: `Swifna Utility: Buy ${selectedPlan.plan_name} ${carrierName} Pack to ${phoneNumber}`,
          metadata: { reference, network: networkId, phone: phoneNumber, service_type: "data", plan_id: selectedPlan.plan_id },
        },
        {
          onReadyForServerApproval: (paymentId) => {
            void supabase.functions.invoke("pi-payment-handler", {
              body: { action: "APPROVE_PAYMENT", reference, paymentId }
            });
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            void supabase.functions.invoke("pi-payment-handler", {
              body: { action: "COMPLETE_PAYMENT", reference, paymentId, txid }
            })
              .then(async (data) => {
                if (data?.local_status !== "success") throw new Error("Contract resolution sequence timed out.");

                await supabase.functions.invoke("affatech-proxy", {
                  body: {
                    action: "buy_data",
                    payload: { network: networkId, phone: phoneNumber, plan_id: selectedPlan.plan_id },
                  },
                });

                await saveRecentNumber(phoneNumber);
                setCheckoutOpen(false);

                showSuccess({
                  title: "Direct Pi Purchase Ok",
                  amount: selectedPlan.amount,
                  message: `Blockchain verification confirmed. ${finalPiCost} π debited from application wallet securely.`,
                  subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
                });
                setSelectedPlan(null);
              })
              .catch(err => showToast(err.message || "Direct wallet node signature dropped.", "error"));
          },
          onCancel: () => showToast("Direct purchase cancelled.", "info"),
          onError: (error) => showToast(error instanceof Error ? error.message : "Node signature validation error.", "error"),
        },
      );
    } catch (e: any) {
      showToast(e.message || "Ecosystem sandbox handshake failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- PIN PROMPT CONTROL ---
  const requirePin = (action: () => void) => {
    if (isGuest || !user?.id) {
      showToast("Please login or sign up before doing this.", "info");
      onRequireAuth?.();
      return;
    }
    if (!user?.pinHash) {
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

  const handlePlanSelect = (plan: any) => {
    if (isGuest) return onRequireAuth?.();
    if (phoneNumber.length < 11) {
      showToast("Please enter a valid phone number before picking a data bundle pack.", "error");
      return;
    }
    setSelectedPlan(plan);
    setCheckoutOpen(true);
    fetchPiQuoteForPlan(plan.amount);
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

          {/* Phone Input Section */}
          <div className="p-6 bg-emerald-700 dark:bg-slate-900 text-white relative">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("airtime.mobile_number")}</label>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t("common.recent")}
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 backdrop-blur-sm relative">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <img
                  src={CARRIERS.find(c => c.id === networkId)?.logo}
                  className="w-full h-full object-cover rounded-full"
                  alt="Network"
                />
              </div>

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

            {/* Manual Network Selector */}
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
                  className={`text-xs font-bold pb-2 border-b-2 transition-all px-2 ${activeTab === tab.key
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
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-1 ${favoriteOnly
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
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all ${selectedPlanType === type.key
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
                    className="relative flex flex-col justify-between p-4 rounded-2xl text-left border-2 border-slate-100 bg-slate-50 hover:border-emerald-200 transition-all group"
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

                    <div>
                      <h3 className="text-xl font-black text-slate-800 leading-none mb-1">
                        {getDisplaySize(plan.plan_name)}
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 line-clamp-2 leading-tight h-6">
                        {stripSizeFromName(plan.plan_name)}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-end w-full">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">{t("data.price")}</p>
                        <p className="text-sm font-black text-slate-900">₦{Number(plan.amount).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] uppercase font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                          {`${plan.plan_type || 'PLAN'}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- FRICTIONLESS DIRECT-ACTION CHECKOUT MODAL --- */}
      {checkoutOpen && selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[35px] sm:rounded-[35px] p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setCheckoutOpen(false)}
              className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1 mt-1 text-center">Review & Pay Instantly</h3>
            <p className="text-xs text-slate-400 text-center font-medium mb-5">Tap a wallet below to instantly purchase {selectedPlan.plan_name}.</p>

            <div className="space-y-3">
              {/* Option 1: Naira Wallet Cash */}
              <button
                type="button"
                disabled={loading}
                onClick={() => requirePin(executeNairaWalletPurchase)}
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-emerald-50/40 hover:border-emerald-300 text-left flex justify-between items-center transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <span className="block font-black text-xs uppercase tracking-wide text-slate-700 group-hover:text-emerald-900">Pay with Naira Cash</span>
                    <span className="block text-[11px] text-slate-400 font-bold">Available: ₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600">₦{Number(selectedPlan.amount).toLocaleString()}</span>
              </button>

              {/* Option 2: Internal Swifna Pi Balance */}
              <button
                type="button"
                disabled={loading || !livePiQuote}
                onClick={() => requirePin(executeInternalPiPurchase)}
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-purple-50/40 hover:border-purple-300 text-left flex justify-between items-center transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-600 font-black text-xs w-8 h-8 flex items-center justify-center group-hover:bg-purple-200">
                    π
                  </div>
                  <div>
                    <span className="block font-black text-xs uppercase tracking-wide text-slate-700 group-hover:text-purple-900">Pay with Swifna π Balance</span>
                    <span className="block text-[11px] text-slate-400 font-bold">
                      Available: {(user.piBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} π
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-400 group-hover:text-purple-600">
                  {livePiQuote ? `π ${livePiQuote.piAmount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : "..."}
                </span>
              </button>

              {/* Option 3: External Pi App Wallet */}
              <button
                type="button"
                disabled={loading || !livePiQuote}
                onClick={() => requirePin(executeDirectPiNetworkPurchase)}
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-amber-50/40 hover:border-amber-300 text-left flex justify-between items-center transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-600 text-xs w-8 h-8 flex items-center justify-center group-hover:bg-amber-200">
                    🚀
                  </div>
                  <div>
                    <span className="block font-black text-xs uppercase tracking-wide text-slate-700 group-hover:text-amber-900">Pay with Direct π Wallet App</span>
                    <span className="block text-[11px] text-slate-400 font-bold">Deduct direct from external app wallet</span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-400 group-hover:text-amber-600">
                  {livePiQuote ? `π ${livePiQuote.piAmount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : "..."}
                </span>
              </button>
            </div>

            {/* Rate Multiplier footer context info */}
            {livePiQuote && (
              <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
                Contract Exchange Locking Rate: 1 π ≈ ₦{livePiQuote.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            {isFetchingPiRate && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Fetching latest network exchange ratio weights...
              </div>
            )}
          </div>
        </div>
      )}

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

export default DataBundle;