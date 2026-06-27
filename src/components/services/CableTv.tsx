import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Tv, CheckCircle2, User, Wallet, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CABLE_PROVIDERS } from "../../constants";
import { useToast } from "../ui/ToastProvider";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../../services/piNetworkService";

interface CableTvProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void;
  onBack: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

const CableTv = ({ user, onUpdateBalance, onUpdatePiBalance, onBack, isGuest = false, onRequireAuth }: CableTvProps) => {
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
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

  // Frictionless Checkout Overlay States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);

  // Recents State
  const [recentBeneficiaries, setRecentBeneficiaries] = useState<Beneficiary[]>([]);

  const cableCostNgn = selectedPlan ? parseFloat(selectedPlan.amount) : 0;

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

    if (user.phone) setPhone(user.phone);
  }, [user]);

  // --- 2. FETCH PLANS ---
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      setPlans([]);
      setSelectedPlan(null);
      setActiveTab("All");
      try {
        const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
          body: { action: "fetch_cable_plans" },
        });
        if (error) throw error;
        const key = provider.toLowerCase();
        if (data && data[key]) {
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

  // --- 2.5. FETCH PI VALUATION PIPELINE RATIOS ---
  const fetchPiQuoteForCable = async (costInNaira: number) => {
    if (!costInNaira || costInNaira <= 0) return;
    setIsFetchingPiRate(true);
    setLivePiQuote(null);
    try {
      const { data, error } = await supabase.functions.invoke("pi-payment-handler", {
        body: {
          action: "CREATE_PAYMENT",
          nairaAmount: costInNaira,
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
      console.warn("Failed to update cryptocurrency calculation matrices:", err);
    } finally {
      setIsFetchingPiRate(false);
    }
  };

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

  const handleIncompletePiPayment = (payment: PiPaymentDTO) => {
    const reference = String(payment?.metadata?.reference || "");
    if (!reference) return;
    void supabase.functions.invoke("pi-payment-handler", {
      body: { action: "COMPLETE_PAYMENT", reference, paymentId: payment?.identifier, txid: payment?.transaction?.txid }
    }).catch(err => console.warn("Incomplete pipeline resolution fault:", err));
  };

  // ==============================================================
  // STRATEGIC PIPELINE RUNNERS
  // ==============================================================
  const executeNairaWalletPurchase = async () => {
    if (!selectedPlan || !iuc) return;
    if (user.balance < cableCostNgn) return showToast("Insufficient Balance", "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "buy_cable",
          payload: { provider, iuc, plan_code: selectedPlan.id, amount: cableCostNgn, phone: phone || "08000000000" },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true || (data.data && data.data.status === "ORDER_RECEIVED");

      if (isSuccess) {
        const newBal = user.balance - cableCostNgn;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({ user_id: user.id, user_email: user.email, type: "Cable", amount: cableCostNgn, status: "Success", ref: `CAB-${Date.now()}` });

        saveRecentIuc(iuc);
        setCheckoutOpen(false);

        showSuccess({
          title: "Transfer successful",
          amount: Number(cableCostNgn),
          message: "Your cable subscription has been processed successfully.",
          subtitle: iuc ? `FOR ${iuc}` : undefined,
        });
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

  const executeInternalPiPurchase = async () => {
    if (!selectedPlan || !livePiQuote || livePiQuote.piAmount <= 0) return showToast("Quote processing calculation invalid.", "error");
    if ((user.piBalance || 0) < livePiQuote.piAmount) {
      return showToast(`Insufficient internal Pi balance. You require: ${livePiQuote.piAmount} π`, "error");
    }

    setLoading(true);
    try {
      const providerLabel = CABLE_PROVIDERS.find(p => p.id === provider)?.name || provider;
      const { data: res, error: rpcErr } = await supabase.rpc("purchase_service_with_internal_pi", {
        p_user_id: user.id,
        p_pi_amount: livePiQuote.piAmount,
        p_service_type: "Cable",
        p_description: `Subscribed to ${selectedPlan.name} (${providerLabel.toUpperCase()}) pack using internal Pi wallet ledger balance for smartcard: ${iuc}`,
        p_meta: { cost_ngn: cableCostNgn, rate: livePiQuote.rate, iuc, provider, plan_code: selectedPlan.id }
      });

      if (rpcErr || !res?.success) throw new Error(res?.message || rpcErr?.message || "Internal debit sequence error.");
      if (onUpdatePiBalance) onUpdatePiBalance(Number(res.new_balance));

      await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "buy_cable",
          payload: { provider, iuc, plan_code: selectedPlan.id, amount: cableCostNgn, phone: phone || "08000000000" },
        },
      });

      saveRecentIuc(iuc);
      setCheckoutOpen(false);

      showSuccess({
        title: "Internal Purchase Successful",
        amount: cableCostNgn,
        message: `Deducted ${livePiQuote.piAmount} π from internal ledger sheets. Subscription is active.`,
        subtitle: iuc ? `FOR ${iuc}` : undefined,
      });
      setIuc("");
      setCustomerName("");
      setSelectedPlan(null);
    } catch (e: any) {
      showToast(e.message || "Internal network check dropped.", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeDirectPiNetworkPurchase = async () => {
    if (!selectedPlan || !livePiQuote || !iuc) return;
    showToast("Launching connection protocol to external Pi App Sandbox...", "info");
    setLoading(true);

    try {
      await authenticatePiUser(handleIncompletePiPayment);
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("pi-payment-handler", {
        body: { action: "CREATE_PAYMENT", nairaAmount: cableCostNgn, serviceId: "00000000-0000-0000-0000-000000000000" }
      });

      if (quoteErr || !quote?.success) throw new Error(quote?.error || "Pricing tracking matrix token dropped.");
      const reference = String(quote.reference || "");
      const finalPiCost = Number(quote.pi_amount || 0);

      const providerLabel = CABLE_PROVIDERS.find(p => p.id === provider)?.name || provider;

      await createPiPayment(
        {
          amount: finalPiCost,
          memo: `Swifna Utility: ${providerLabel.toUpperCase()} (${selectedPlan.name}) setup contract to ${iuc}`,
          metadata: { reference, provider, iuc, plan_code: selectedPlan.id, service_type: "cable", amount: cableCostNgn },
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
              .then(async ({ data }) => {
                if (data?.local_status !== "success") throw new Error("Contract tracking verification sequence timed out.");

                await supabase.functions.invoke("clubkonnect-proxy", {
                  body: {
                    action: "buy_cable",
                    payload: { provider, iuc, plan_code: selectedPlan.id, amount: cableCostNgn, phone: phone || "08000000000" },
                  },
                });

                saveRecentIuc(iuc);
                setCheckoutOpen(false);

                showSuccess({
                  title: "Direct Pi Purchase Ok",
                  amount: cableCostNgn,
                  message: `Blockchain verification payload confirmed. ${finalPiCost} π debited securely from application wallet.`,
                  subtitle: iuc ? `FOR ${iuc}` : undefined,
                });
                setIuc("");
                setCustomerName("");
                setSelectedPlan(null);
              })
              .catch(err => showToast(err.message || "Direct node distribution failure.", "error"));
          },
          onCancel: () => showToast("Direct utility purchase sequence terminated by client.", "info"),
          onError: (error) => showToast(error instanceof Error ? error.message : "Node encryption generation error.", "error"),
        },
      );
    } catch (e: any) {
      showToast(e.message || "Ecosystem handshake failure.", "error");
    } finally {
      setLoading(false);
    }
  };

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

  const handlePayClick = () => {
    if (isGuest) return onRequireAuth?.();
    if (!selectedPlan || !iuc || customerName.includes("Invalid") || customerName === "Verifying...") {
      showToast("Please verify card number and select a television pack before proceeding.", "error");
      return;
    }
    setCheckoutOpen(true);
    fetchPiQuoteForCable(cableCostNgn);
  };

  return (
    <>
      <div className="animate-in slide-in-from-right duration-300 pb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1 rounded-full balance-pill">
            <Wallet size={14} className="text-white" />
            <span className="text-sm font-black text-white">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                  className={`flex-1 min-w-[80px] py-3 px-4 rounded-xl font-bold text-xs border-2 whitespace-nowrap transition-all ${provider === p.id
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300"
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Smartcard Input Section */}
          <div className="p-6 bg-emerald-700 dark:bg-slate-900 text-white relative">
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
                  className={`text-xs font-bold pb-2 transition-all ${activeTab === tab ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-400 hover:text-slate-600"
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
                    className={`relative p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between min-h-[100px] group ${selectedPlan?.id === p.id
                      ? "border-emerald-600 bg-emerald-50 shadow-sm"
                      : "border-slate-100 bg-slate-50 hover:border-emerald-200"
                      }`}
                  >
                    {selectedPlan?.id === p.id && <CheckCircle2 size={16} className="absolute top-2 right-2 text-emerald-600" />}

                    <div>
                      <h3 className="text-sm font-black text-slate-800 leading-tight mb-2 line-clamp-2">{p.name}</h3>
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

          {/* Fixed Bottom Action bar */}
          <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
            <button
              onClick={handlePayClick}
              disabled={loading || !selectedPlan || !customerName || customerName.includes("Invalid") || customerName === "Verifying..."}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2 h-14"
            >
              <span>Pay</span>
              {selectedPlan && <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{parseFloat(selectedPlan.amount).toLocaleString()}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* --- FRICTIONLESS DIRECT-ACTION CHECKOUT OVERLAY MODAL --- */}
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
            <p className="text-xs text-slate-400 text-center font-medium mb-5">Tap a wallet below to instantly process your ₦{cableCostNgn.toLocaleString()} television sub.</p>

            <div className="space-y-3">
              {/* Action Option 1: Local Fiat balance wallet */}
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
                <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600">₦{cableCostNgn.toLocaleString()}</span>
              </button>

              {/* Action Option 2: Internal application ledger crypto token allocation */}
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

              {/* Action Option 3: External Sandbox web ecosystem protocol wallet */}
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

            {/* Rate contract synchronization metadata labels footer */}
            {livePiQuote && (
              <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
                Contract Locker Matrix Multiplier: 1 π ≈ ₦{livePiQuote.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            {isFetchingPiRate && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Fetching real-time exchange ratios...
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

export default CableTv;