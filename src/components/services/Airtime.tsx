import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Smartphone, Wallet, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../../services/piNetworkService";

interface AirtimeProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void;
  onBack: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

const Airtime = ({ user, onUpdateBalance, onUpdatePiBalance, onBack, isGuest = false, onRequireAuth }: AirtimeProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [loading, setLoading] = useState(false);
  const [networkId, setNetworkId] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [airtimeType, setAirtimeType] = useState("VTU");

  // Beneficiary & User Phone State
  const [recentBeneficiaries, setRecentBeneficiaries] = useState<Beneficiary[]>([]);
  const [userPhone, setUserPhone] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  // Frictionless Checkout States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);

  const airtimeAmountNgn = Number(amount || 0);

  // --- 1. INITIALIZE & PRE-FILL USER PHONE ---
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const recents = await beneficiaryService.fetchRecent(auth.user.id, 'airtime', 5);
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

  // --- 2. AUTO-DETECT NETWORK ---
  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length >= 4) {
      const prefix = cleanPhone.slice(0, 4);
      if (["0803", "0806", "0703", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"].includes(prefix)) {
        setNetworkId(1);
        if (airtimeType !== "VTU" && airtimeType !== "Share and Sell" && airtimeType !== "awuf4U") setAirtimeType("VTU");
      } else if (["0805", "0807", "0705", "0815", "0811", "0905", "0915"].includes(prefix)) {
        setNetworkId(2);
        setAirtimeType("VTU");
      } else if (["0802", "0808", "0708", "0812", "0902", "0907", "0901", "0904"].includes(prefix)) {
        setNetworkId(3);
        setAirtimeType("VTU");
      } else if (["0809", "0818", "0817", "0909", "0908"].includes(prefix)) {
        setNetworkId(4);
        setAirtimeType("VTU");
      }
    }
  }, [phoneNumber]);

  // --- 3. BACKGROUND FETCH PI QUOTE FOR REAL-TIME DISPLAY ---
  useEffect(() => {
    if (!airtimeAmountNgn || airtimeAmountNgn <= 0 || isNaN(airtimeAmountNgn)) {
      setLivePiQuote(null);
      return;
    }

    let active = true;
    const fetchQuote = async () => {
      setIsFetchingPiRate(true);
      try {
        const { data, error } = await supabase.functions.invoke("pi-payment-handler", {
          body: {
            action: "CREATE_PAYMENT",
            nairaAmount: airtimeAmountNgn,
            serviceId: "00000000-0000-0000-0000-000000000000"
          }
        });
        if (active && !error && data) {
          setLivePiQuote({
            rate: Number(data.rate_ngn_per_pi || 0),
            piAmount: Number(data.pi_amount || 0)
          });
        }
      } catch (err) {
        console.warn("Failed to fetch live Pi quote:", err);
      } finally {
        if (active) setIsFetchingPiRate(false);
      }
    };

    fetchQuote();
    return () => { active = false; };
  }, [amount]);

  // --- 4. SAVE RECENT NUMBER ---
  const saveRecentNumber = async (number: string) => {
    if (number.length < 11 || number === userPhone) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return;
      await beneficiaryService.upsert({
        user_id: auth.user.id,
        type: 'airtime',
        beneficiary_key: `phone:${number}|net:${networkId}`,
        phone_number: number,
        network: networkId
      });
      const recents = await beneficiaryService.fetchRecent(auth.user.id, 'airtime', 5);
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
  // PIPELINE CHECKOUT FLOW EXECUTORS
  // ==============================================================
  const executeNairaWalletPurchase = async () => {
    if (Number(amount) > user.balance) return showToast(t("airtime.insufficient_balance"), "error");

    setLoading(true);
    try {
      const isAffatechSpecial = networkId === 1 && (airtimeType === "Share and Sell" || airtimeType === "awuf4U");
      const proxyFunc = isAffatechSpecial ? "affatech-proxy" : "clubkonnect-proxy";

      const { data, error } = await supabase.functions.invoke(proxyFunc, {
        body: { action: "buy_airtime", payload: { network: networkId, phone: phoneNumber, amount: Number(amount), airtime_type: airtimeType } },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true ||
        (data.data && (data.data.status === "ORDER_RECEIVED" || data.data.status === "ORDER_COMPLETED"));

      if (isSuccess) {
        const newBal = user.balance - Number(amount);
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({ user_id: user.id, user_email: user.email, type: "Airtime", amount: Number(amount), status: "Success", ref: `AIR-${Date.now()}` });

        saveRecentNumber(phoneNumber);
        setCheckoutOpen(false);
        showSuccess({
          title: "Transfer successful",
          amount: Number(amount),
          message: "Your airtime purchase has been processed successfully.",
          subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
        });
        setPhoneNumber(userPhone);
        setAmount("");
      } else {
        throw new Error(data?.message || "Transaction Failed");
      }
    } catch (e: any) {
      showToast(e.message || t("airtime.failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const executeInternalPiPurchase = async () => {
    if (!livePiQuote || livePiQuote.piAmount <= 0) return showToast("Quote engine compiling weights.", "error");
    if ((user.piBalance || 0) < livePiQuote.piAmount) {
      return showToast(`Insufficient internal Pi balance. You require: ${livePiQuote.piAmount} π`, "error");
    }

    setLoading(true);
    try {
      const carrierName = CARRIERS.find(c => c.id === networkId)?.name || "Network";
      const { data: res, error: rpcErr } = await supabase.rpc("purchase_service_with_internal_pi", {
        p_user_id: user.id,
        p_pi_amount: livePiQuote.piAmount,
        p_service_type: "Airtime",
        p_description: `Purchased ₦${airtimeAmountNgn.toLocaleString()} ${carrierName} Airtime using internal Pi balance for line: ${phoneNumber}`,
        p_meta: { cost_ngn: airtimeAmountNgn, rate: livePiQuote.rate, phone: phoneNumber, network: networkId, type: airtimeType }
      });

      if (rpcErr || !res?.success) throw new Error(res?.message || rpcErr?.message || "Internal debit sequence error.");
      if (onUpdatePiBalance) onUpdatePiBalance(Number(res.new_balance));

      const isAffatechSpecial = networkId === 1 && (airtimeType === "Share and Sell" || airtimeType === "awuf4U");
      const proxyFunc = isAffatechSpecial ? "affatech-proxy" : "clubkonnect-proxy";

      await supabase.functions.invoke(proxyFunc, {
        body: { action: "buy_airtime", payload: { network: networkId, phone: phoneNumber, amount: airtimeAmountNgn, airtime_type: airtimeType } }
      });

      await saveRecentNumber(phoneNumber);
      setCheckoutOpen(false);
      showSuccess({
        title: "Internal Purchase Successful",
        amount: airtimeAmountNgn,
        message: `Deducted ${livePiQuote.piAmount} π from your internal crypto balance sheets.`,
        subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
      });
      setAmount("");
    } catch (e: any) {
      showToast(e.message || "Internal wallet verification execution failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeDirectPiNetworkPurchase = async () => {
    if (!livePiQuote || !phoneNumber) return;
    showToast("Opening secure connection to external Pi App Wallet...", "info");
    setLoading(true);

    try {
      await authenticatePiUser(handleIncompletePiPayment);
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("pi-payment-handler", {
        body: { action: "CREATE_PAYMENT", nairaAmount: airtimeAmountNgn, serviceId: "00000000-0000-0000-0000-000000000000" }
      });

      if (quoteErr || !quote?.success) throw new Error(quote?.error || "Pricing contract instantiation error.");
      const reference = String(quote.reference || "");
      const finalPiCost = Number(quote.pi_amount || 0);

      const carrierName = CARRIERS.find(c => c.id === networkId)?.name || "Network";

      await createPiPayment(
        {
          amount: finalPiCost,
          memo: `Swifna Utility payment: ₦${airtimeAmountNgn.toLocaleString()} ${carrierName} Top-up to ${phoneNumber}`,
          metadata: { reference, network: networkId, phone: phoneNumber, service_type: "airtime" },
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

                const isAffatechSpecial = networkId === 1 && (airtimeType === "Share and Sell" || airtimeType === "awuf4U");
                const proxyFunc = isAffatechSpecial ? "affatech-proxy" : "clubkonnect-proxy";

                await supabase.functions.invoke(proxyFunc, {
                  body: { action: "buy_airtime", payload: { network: networkId, phone: phoneNumber, amount: airtimeAmountNgn, airtime_type: airtimeType } }
                });

                await saveRecentNumber(phoneNumber);
                setCheckoutOpen(false);
                showSuccess({
                  title: "Direct Pi Purchase Ok",
                  amount: airtimeAmountNgn,
                  message: `Blockchain payment completed successfully. ${finalPiCost} π debited.`,
                  subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
                });
                setAmount("");
              })
              .catch(err => showToast(err.message || "Direct wallet confirmation sequence failed.", "error"));
          },
          onCancel: () => showToast("Direct utility checkout cancelled.", "info"),
          onError: (error) => showToast(error instanceof Error ? error.message : "Node signature generation error.", "error"),
        },
      );
    } catch (e: any) {
      showToast(e.message || "Ecosystem initialization failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- PIN ROUTING ORCHESTRATOR ---
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
    if (phoneNumber.length < 11 || !amount || airtimeAmountNgn <= 0) {
      showToast("Please complete phone number and select a valid amount.", "error");
      return;
    }
    setCheckoutOpen(true);
  };

  const presetAmounts = [50, 100, 200, 500, 1000, 2000];

  return (
    <>
      <div className="animate-in slide-in-from-right duration-300 pb-24">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
            <ArrowLeft size={16} /> {t("common.back")}
          </button>
          <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1 rounded-full balance-pill">
            <Wallet size={14} className="text-white" />
            <span className="text-sm font-black text-white">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">

          {/* Phone Input Section (Dark Theme) */}
          <div className="p-6 bg-emerald-700 dark:bg-slate-900 text-white relative">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("airtime.mobile_number")}</label>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t("common.recent")}
              </div>
            </div>

            {/* Input Wrapper */}
            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 backdrop-blur-sm relative">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <img
                  src={CARRIERS.find(c => c.id === networkId)?.logo}
                  className="w-8 h-8 object-contain rounded-full"
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

            {/* Manual Network Selector Dots */}
            <div className="flex gap-2 mt-4 justify-end">
              {CARRIERS.filter(c => c.name !== "SMILE").map(c => (
                <button
                  key={c.id}
                  onClick={() => setNetworkId(c.id)}
                  className={`w-2 h-2 rounded-full transition-all ${networkId === c.id ? "bg-emerald-500 w-6" : "bg-slate-700"}`}
                />
              ))}
            </div>

            {/* MTN Special Options */}
            {networkId === 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {["VTU", "Share and Sell", "awuf4U"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setAirtimeType(type)}
                    className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all whitespace-nowrap ${airtimeType === type ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            <h3 className="font-bold text-slate-700 mb-4">{t("airtime.top_up")}</h3>

            {/* Amount Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`relative p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${amount === amt.toString()
                      ? "border-emerald-600 bg-emerald-50 shadow-md"
                      : "border-slate-100 bg-slate-50 hover:border-emerald-200"
                    }`}
                >
                  {amt === 50 && (
                    <span className="absolute -top-2 bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      {t("airtime.cashback")}
                    </span>
                  )}
                  <span className="text-lg font-black text-slate-800">₦{Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-[9px] font-bold text-slate-400">{t("airtime.pay_amount", { amount: amt })}</span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 font-bold text-center mb-2">{t("airtime.custom_amount")}</p>
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
                placeholder="0"
              />
            </div>
            <button
              onClick={handlePayClick}
              disabled={loading || phoneNumber.length < 11 || !amount}
              className="px-8 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center h-14"
            >
              {t("common.pay")}
            </button>
          </div>
        </div>
      </div>

      {/* --- FRICTIONLESS DIRECT-ACTION CHECKOUT MODAL --- */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[35px] sm:rounded-[35px] p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setCheckoutOpen(false)}
              className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1 mt-1 text-center">Review & Pay Instantly</h3>
            <p className="text-xs text-slate-400 text-center font-medium mb-5">Tap a wallet below to instantly process your ₦{airtimeAmountNgn.toLocaleString()} top-up.</p>

            <div className="space-y-3">
              {/* Direct Wallet Action 1: Naira Cash */}
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
                <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600">₦{airtimeAmountNgn.toLocaleString()}</span>
              </button>

              {/* Direct Wallet Action 2: Swifna Internal Pi Balance */}
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

              {/* Direct Wallet Action 3: External Pi Wallet App */}
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

            {/* Dynamic Core Rate Helper Metadata Display */}
            {livePiQuote && (
              <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
                Exchange Rate Multiplier Matrix Contract Lock: 1 π ≈ ₦{livePiQuote.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            {isFetchingPiRate && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Updating dynamic calculation matrices...
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

export default Airtime;