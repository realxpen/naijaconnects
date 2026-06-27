import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Building2, ChevronRight, Check, Zap, Wallet, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { DISCOS } from "../../constants";
import { useToast } from "../ui/ToastProvider";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../../services/piNetworkService";

interface ElectricityProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void;
  onBack: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

const Electricity = ({ user, onUpdateBalance, onUpdatePiBalance, onBack, isGuest = false, onRequireAuth }: ElectricityProps) => {
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [loading, setLoading] = useState(false);
  const [disco, setDisco] = useState<string | null>(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState(1); // 1 = Prepaid, 2 = Postpaid
  const [amount, setAmount] = useState("");
  const [amountWarning, setAmountWarning] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [showDiscoModal, setShowDiscoModal] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);

  // Frictionless Checkout Overlay States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);

  // Recents State
  const [recentBeneficiaries, setRecentBeneficiaries] = useState<Beneficiary[]>([]);

  const electricityCostNgn = Number(amount || 0);

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

  // --- 2.5. FETCH PI VALUATION PRICING FLOW MATRICES ---
  const fetchPiQuoteForElectricity = async (costInNaira: number) => {
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
      console.warn("Failed to synchronize cryptocurrency calculation values:", err);
    } finally {
      setIsFetchingPiRate(false);
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

  const validateAmount = (value: string) => {
    if (!value) {
      setAmountWarning(null);
      return;
    }
    const amt = Number(value);
    if (Number.isNaN(amt)) {
      setAmountWarning(null);
      return;
    }
    if (amt < 600) setAmountWarning("Minimum vend amount is ₦600");
    else if (amt > 200000) setAmountWarning("Maximum vend amount is ₦200,000");
    else setAmountWarning(null);
  };

  const handleIncompletePiPayment = (payment: PiPaymentDTO) => {
    const reference = String(payment?.metadata?.reference || "");
    if (!reference) return;
    void supabase.functions.invoke("pi-payment-handler", {
      body: { action: "COMPLETE_PAYMENT", reference, paymentId: payment?.identifier, txid: payment?.transaction?.txid }
    }).catch(err => console.warn("Incomplete pipeline resolution fault:", err));
  };

  // ==============================================================
  // PIPELINE CHECKOUT ACTION RUNNERS
  // ==============================================================
  const executeNairaWalletPurchase = async () => {
    if (!amount || !meterNumber || !disco || !customerName || customerName.includes("Invalid")) return;
    if (user.balance < electricityCostNgn) return showToast("Insufficient Balance", "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "buy_electricity",
          payload: { disco, meter: meterNumber, amount: electricityCostNgn, meter_type: meterType, phone: phone || "08000000000" },
        },
      });

      if (error) throw new Error(error.message);

      const txnStatus = data?.data?.transactionstatus || data?.data?.status;
      const isSuccess =
        data?.status === "success" ||
        data?.success === true ||
        txnStatus === "ORDER_RECEIVED" ||
        data?.message === "TXN_HISTORY";

      if (isSuccess) {
        const newBal = user.balance - electricityCostNgn;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_id: user.id,
          user_email: user.email,
          type: "Electricity",
          amount: electricityCostNgn,
          status: "Success",
          ref: `ELEC-${Date.now()}`,
          meta: {
            token: data.token || data.metertoken || data?.data?.metertoken || "Token sent to phone",
            provider: data?.data?.productname || DISCOS.find(d => d.id === disco)?.name || disco,
            meter_number: data?.data?.meterno || meterNumber,
            customer_name: customerName,
            meter_type: meterType,
            meter_type_label: meterType === 1 ? "Prepaid" : "Postpaid"
          }
        });

        if (saveBeneficiary) saveRecentMeter(meterNumber);
        setCheckoutOpen(false);

        showSuccess({
          title: "Transfer successful",
          amount: electricityCostNgn,
          message: `Token: ${data.token || data.metertoken || data?.data?.metertoken || "Check receipt"}`,
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

  const executeInternalPiPurchase = async () => {
    if (!livePiQuote || livePiQuote.piAmount <= 0) return showToast("Quote compilation incomplete.", "error");
    if ((user.piBalance || 0) < livePiQuote.piAmount) {
      return showToast(`Insufficient internal Pi balance. You require: ${livePiQuote.piAmount} π`, "error");
    }

    setLoading(true);
    try {
      const discoLabel = DISCOS.find(d => d.id === disco)?.name || disco;
      const typeLabel = meterType === 1 ? "Prepaid" : "Postpaid";

      const { data: res, error: rpcErr } = await supabase.rpc("purchase_service_with_internal_pi", {
        p_user_id: user.id,
        p_pi_amount: livePiQuote.piAmount,
        p_service_type: "Electricity",
        p_description: `Purchased ₦${electricityCostNgn.toLocaleString()} ${discoLabel} (${typeLabel}) power token via Swifna internal Pi allocation for meter: ${meterNumber}`,
        p_meta: { cost_ngn: electricityCostNgn, rate: livePiQuote.rate, meter: meterNumber, disco, meter_type: meterType }
      });

      if (rpcErr || !res?.success) throw new Error(res?.message || rpcErr?.message || "Internal cryptocurrency ledger debit error.");
      if (onUpdatePiBalance) onUpdatePiBalance(Number(res.new_balance));

      const { data: coreRes } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "buy_electricity",
          payload: { disco, meter: meterNumber, amount: electricityCostNgn, meter_type: meterType, phone: phone || "08000000000" },
        },
      });

      if (saveBeneficiary) saveRecentMeter(meterNumber);
      setCheckoutOpen(false);

      showSuccess({
        title: "Internal Purchase Successful",
        amount: electricityCostNgn,
        message: `Deducted ${livePiQuote.piAmount} π from crypto wallet sheet. Token sequence delivered: ${coreRes?.token || coreRes?.metertoken || "Sent to phone"}`,
        subtitle: meterNumber ? `FOR ${meterNumber}` : undefined,
      });
      setMeterNumber("");
      setAmount("");
      setCustomerName("");
    } catch (e: any) {
      showToast(e.message || "Internal settlement transaction failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeDirectPiNetworkPurchase = async () => {
    if (!livePiQuote || !meterNumber || !disco) return;
    showToast("Launching encryption payload nodes to external Pi App Wallet...", "info");
    setLoading(true);

    try {
      await authenticatePiUser(handleIncompletePiPayment);
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("pi-payment-handler", {
        body: { action: "CREATE_PAYMENT", nairaAmount: electricityCostNgn, serviceId: "00000000-0000-0000-0000-000000000000" }
      });

      if (quoteErr || !quote?.success) throw new Error(quote?.error || "Ecosystem tracking quote timed out.");
      const reference = String(quote.reference || "");
      const finalPiCost = Number(quote.pi_amount || 0);

      const discoLabel = DISCOS.find(d => d.id === disco)?.name || disco;
      const typeLabel = meterType === 1 ? "Prepaid" : "Postpaid";

      await createPiPayment(
        {
          amount: finalPiCost,
          memo: `Swifna Power contract: Buy ₦${electricityCostNgn.toLocaleString()} ${discoLabel} (${typeLabel}) token for meter ${meterNumber}`,
          metadata: { reference, disco, meter: meterNumber, meter_type: meterType, service_type: "electricity", amount: electricityCostNgn },
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
                if (data?.local_status !== "success") throw new Error("Ecosystem node signature contract validation dropped.");

                const { data: finalVendorRes } = await supabase.functions.invoke("clubkonnect-proxy", {
                  body: {
                    action: "buy_electricity",
                    payload: { disco, meter: meterNumber, amount: electricityCostNgn, meter_type: meterType, phone: phone || "08000000000" },
                  },
                });

                if (saveBeneficiary) saveRecentMeter(meterNumber);
                setCheckoutOpen(false);

                showSuccess({
                  title: "Direct Pi Purchase Ok",
                  amount: electricityCostNgn,
                  message: `Blockchain payload validated. ${finalPiCost} π debited. Token issued: ${finalVendorRes?.token || "Dispatched to operator device"}`,
                  subtitle: meterNumber ? `FOR ${meterNumber}` : undefined,
                });
                setMeterNumber("");
                setAmount("");
                setCustomerName("");
              })
              .catch(err => showToast(err.message || "Direct wallet synchronization failed.", "error"));
          },
          onCancel: () => showToast("Direct electricity purchase sequence cancelled by user.", "info"),
          onError: (error) => showToast(error instanceof Error ? error.message : "Blockchain ledger signature tracking fault.", "error"),
        },
      );
    } catch (e: any) {
      showToast(e.message || "Ecosystem authentication connection failed.", "error");
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
    if (!disco || !meterNumber || !amount || customerName.includes("Invalid") || customerName === "Verifying...") {
      showToast("Please verify meter account and fill in a valid amount before proceeding.", "error");
      return;
    }
    if (Number(amount) < 600 || Number(amount) > 200000) {
      showToast("Vend requirements range between ₦600 and ₦200,000.", "error");
      return;
    }
    setCheckoutOpen(true);
    fetchPiQuoteForElectricity(electricityCostNgn);
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
            <Wallet size={14} className="text-white" />
            <span className="text-sm font-black text-white">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">

          {/* Top Section (Dark) */}
          <div className="p-6 bg-emerald-700 dark:bg-slate-900 text-white">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Service Provider</label>

            {/* Disco Selector Card */}
            <button
              onClick={() => setShowDiscoModal(true)}
              title="Select electricity provider"
              aria-label="Select electricity provider"
              className="w-full flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  {selectedDiscoObj?.logo ? (
                    <img src={selectedDiscoObj.logo} alt={`${selectedDiscoObj.name || "Provider"} logo`} className="w-6 h-6 object-contain" />
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
                onClick={() => { setMeterType(1); setCustomerName(""); }}
                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${meterType === 1 ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                Prepaid {meterType === 1 && <Check size={12} />}
              </button>
              <button
                onClick={() => { setMeterType(2); setCustomerName(""); }}
                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${meterType === 2 ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${customerName.includes("Invalid") || customerName.includes("Failed") ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
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
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">
                  <input
                    type="checkbox"
                    checked={saveBeneficiary}
                    onChange={(e) => setSaveBeneficiary(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  Save beneficiary after purchase
                </label>
                <button
                  type="button"
                  onClick={() => saveRecentMeter(meterNumber)}
                  className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400"
                >
                  Save now
                </button>
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
                  onClick={() => {
                    const v = amt.toString();
                    setAmount(v);
                    validateAmount(v);
                  }}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all py-4 ${amount === amt.toString()
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
          <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-3 flex-col">
            {amountWarning && (
              <div className="text-[11px] font-black text-rose-500 text-center bg-rose-50 p-2 rounded-xl border border-rose-100 animate-in fade-in">
                ⚠️ {amountWarning}
              </div>
            )}
            <div className="flex gap-3 w-full">
              <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-4 border-2 border-transparent focus-within:border-emerald-500 transition-colors">
                <span className="text-slate-400 font-bold mr-1">₦</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    validateAmount(e.target.value);
                  }}
                  className="bg-transparent w-full h-full font-black text-slate-800 outline-none text-lg"
                  placeholder="Enter Amount"
                />
              </div>
              <button
                onClick={handlePayClick}
                disabled={loading || !customerName || customerName.includes("Invalid") || customerName === "Verifying..." || !amount || !!amountWarning}
                className="px-8 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center h-14"
              >
                Pay
              </button>
            </div>
          </div>
        </div>

        {/* Disco Selection Modal */}
        {showDiscoModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[30px] overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-slate-800">Select Provider</h3>
                <button onClick={() => setShowDiscoModal(false)} title="Close modal" aria-label="Close modal" className="p-2 bg-slate-200 rounded-full"><ArrowLeft size={16} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {DISCOS.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => { setDisco(d.id); setShowDiscoModal(false); setCustomerName(""); }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-emerald-50 rounded-2xl transition-colors border-b border-slate-50 last:border-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      {d.logo ? <img src={d.logo} className="w-6 h-6 object-contain" /> : <Building2 size={20} className="text-slate-400" />}
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

      {/* --- FRICTIONLESS DIRECT-ACTION CHECKOUT MODAL OVERLAY --- */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[35px] sm:rounded-[35px] p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setCheckoutOpen(false)}
              title="Close checkout"
              aria-label="Close checkout"
              className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1 mt-1 text-center">Review & Pay Instantly</h3>
            <p className="text-xs text-slate-400 text-center font-medium mb-5">Tap a wallet below to instantly buy your ₦{electricityCostNgn.toLocaleString()} electricity token.</p>

            <div className="space-y-3">
              {/* Direct Action 1: Naira cash account balance debit */}
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
                <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600">₦{electricityCostNgn.toLocaleString()}</span>
              </button>

              {/* Direct Action 2: Swifna local custom ledger token database allocation */}
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

              {/* Direct Action 3: Direct Core SDK sandbox ecosystem browser profile wallet application */}
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

            {/* Dynamic calculations contract locking rate matrix reference display */}
            {livePiQuote && (
              <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
                Contract Lock Exchange Weight: 1 π ≈ ₦{livePiQuote.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            {isFetchingPiRate && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Fetching live valuation weights...
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

export default Electricity;