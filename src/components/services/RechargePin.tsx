import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Printer, Wallet, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS, PIN_PRICING, RECHARGE_AMOUNTS } from "../../constants";
import { useToast } from "../ui/ToastProvider";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../../services/piNetworkService";

interface RechargePinProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void;
  onBack: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

const RechargePin = ({ user, onUpdateBalance, onUpdatePiBalance, onBack, isGuest = false, onRequireAuth }: RechargePinProps) => {
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [loading, setLoading] = useState(false);
  const [networkId, setNetworkId] = useState(1);
  const [amount, setAmount] = useState("100");
  const [quantity, setQuantity] = useState(1);
  const [nameOnCard, setNameOnCard] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  // Frictionless Checkout Overlay States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);

  // --- 1. CALCULATE COST ---
  const pinCostNgn = useMemo(() => {
    const unitPrice = PIN_PRICING[networkId] || 100;
    return unitPrice * (Number(amount) / 100) * quantity;
  }, [networkId, amount, quantity]);

  // --- 1.5. FETCH PI VALUATION PRICING FLOW MATRICES ---
  const fetchPiQuoteForPins = async (costInNaira: number) => {
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
    if (!amount || !nameOnCard) return showToast("Please fill all fields", "error");
    if (user.balance < pinCostNgn) return showToast("Insufficient Balance", "error");
    if (quantity > 10) return showToast("Max 10 pins at a time", "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_recharge_pin",
          payload: { network: networkId, amount: amount, quantity: quantity, name_on_card: nameOnCard },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true;

      if (isSuccess) {
        const newBal = user.balance - pinCostNgn;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_id: user.id,
          user_email: user.email,
          type: "RechargePin",
          amount: pinCostNgn,
          status: "Success",
          ref: `PIN-${Date.now()}`,
          meta: { pin: "See 'My Pins' or Receipt", quantity: quantity, denomination: amount }
        });

        setCheckoutOpen(false);
        showSuccess({
          title: "Transfer successful",
          amount: Number(pinCostNgn),
          message: `Generated ${quantity} PINs successfully.`,
          subtitle: nameOnCard ? `FOR ${nameOnCard}` : undefined,
        });
        setNameOnCard("");
        setQuantity(1);
      } else {
        throw new Error(data.message || "Failed to generate pins");
      }
    } catch (e: any) {
      showToast(e.message || "Failed to generate pins", "error");
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
      const carrierLabel = CARRIERS.find(c => c.id === networkId)?.name || "Network";
      const { data: res, error: rpcErr } = await supabase.rpc("purchase_service_with_internal_pi", {
        p_user_id: user.id,
        p_pi_amount: livePiQuote.piAmount,
        p_service_type: "Recharge PINs",
        p_description: `Generated (${quantity}x) ₦${amount} ${carrierLabel} Recharge PINs using internal Swifna Pi allocation for: ${nameOnCard}`,
        p_meta: { cost_ngn: pinCostNgn, rate: livePiQuote.rate, networkId, amount, quantity, nameOnCard }
      });

      if (rpcErr || !res?.success) throw new Error(res?.message || rpcErr?.message || "Internal database balance context allocation fault.");
      if (onUpdatePiBalance) onUpdatePiBalance(Number(res.new_balance));

      await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_recharge_pin",
          payload: { network: networkId, amount: amount, quantity: quantity, name_on_card: nameOnCard },
        },
      });

      setCheckoutOpen(false);
      showSuccess({
        title: "Internal Purchase Successful",
        amount: pinCostNgn,
        message: `Deducted ${livePiQuote.piAmount} π from internal balance. PIN tokens are visible under receipt logs.`,
        subtitle: nameOnCard ? `FOR ${nameOnCard}` : undefined,
      });
      setNameOnCard("");
      setQuantity(1);
    } catch (e: any) {
      showToast(e.message || "Internal settlement transaction failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeDirectPiNetworkPurchase = async () => {
    if (!livePiQuote || !nameOnCard) return;
    showToast("Launching direct verification node via Pi Wallet App...", "info");
    setLoading(true);

    try {
      await authenticatePiUser(handleIncompletePiPayment);
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("pi-payment-handler", {
        body: { action: "CREATE_PAYMENT", nairaAmount: pinCostNgn, serviceId: "00000000-0000-0000-0000-000000000000" }
      });

      if (quoteErr || !quote?.success) throw new Error(quote?.error || "Ecosystem pricing session expired.");
      const reference = String(quote.reference || "");
      const finalPiCost = Number(quote.pi_amount || 0);

      const carrierLabel = CARRIERS.find(c => c.id === networkId)?.name || "Network";

      await createPiPayment(
        {
          amount: finalPiCost,
          memo: `Swifna Utility: Generate (${quantity}x) ₦${amount} ${carrierLabel} Recharge PINs matching business title: ${nameOnCard}`,
          metadata: { reference, networkId, amount, quantity, nameOnCard, service_type: "recharge_pins" },
        },
        {
          onReadyForServerApproval: (paymentId) => {
            void supabase.functions.invoke("pi-payment-handler", { body: { action: "APPROVE_PAYMENT", reference, paymentId } });
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            void supabase.functions.invoke("pi-payment-handler", { body: { action: "COMPLETE_PAYMENT", reference, paymentId, txid } })
              .then(async ({ data }) => {
                if (data?.local_status !== "success") throw new Error("Contract resolution pipeline dropped.");

                await supabase.functions.invoke("affatech-proxy", {
                  body: {
                    action: "buy_recharge_pin",
                    payload: { network: networkId, amount: amount, quantity: quantity, name_on_card: nameOnCard },
                  },
                });

                setCheckoutOpen(false);
                showSuccess({
                  title: "Direct Pi Purchase Ok",
                  amount: pinCostNgn,
                  message: `Blockchain payload processed. ${finalPiCost} π debited from application wallet profile securely.`,
                  subtitle: nameOnCard ? `FOR ${nameOnCard}` : undefined,
                });
                setNameOnCard("");
                setQuantity(1);
              })
              .catch(err => showToast(err.message || "Direct wallet synchronization failed.", "error"));
          },
          onCancel: () => showToast("Direct purchase cancelled.", "info"),
          onError: (error) => showToast(error instanceof Error ? error.message : "Node signature validation error.", "error"),
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
    if (!amount || !nameOnCard.trim()) {
      showToast("Please select a denomination and fill out your business card name.", "error");
      return;
    }
    setCheckoutOpen(true);
    fetchPiQuoteForPins(pinCostNgn);
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

          {/* Top Section (Dark Theme Accent layout) */}
          <div className="p-6 bg-slate-900 text-white">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Select Network</label>

            {/* Network Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {CARRIERS.map((net) => (
                <button
                  key={net.id}
                  onClick={() => setNetworkId(net.id)}
                  className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${networkId === net.id
                    ? "bg-slate-800 border-emerald-500 ring-1 ring-emerald-500"
                    : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    <img src={net.logo} alt={`${net.name} carrier network logo`} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-bold uppercase">{net.name}</span>
                </button>
              ))}
            </div>

            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Business Name</label>
            <input
              type="text"
              value={nameOnCard}
              onChange={(e) => setNameOnCard(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
              placeholder="Enter Business Name"
            />
          </div>

          {/* Middle Section (Denomination & Quantity parameter selectors) */}
          <div className="p-5">
            <h3 className="font-bold text-slate-700 mb-3 text-sm">Denomination</h3>
            <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-4">
              {RECHARGE_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`min-w-[80px] py-3 px-2 rounded-xl text-xs font-black border-2 transition-all ${amount === amt.toString()
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-md"
                    : "border-slate-100 bg-white text-slate-500 hover:border-emerald-200"
                    }`}
                >
                  ₦{Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </button>
              ))}
            </div>

            <h3 className="font-bold text-slate-700 mb-3 text-sm">Quantity</h3>
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                title="Decrease pin quantity"
                aria-label="Decrease pin quantity"
                className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <span className="text-2xl font-black">-</span>
              </button>

              <div className="text-center">
                <span className="block text-3xl font-black text-slate-800">{quantity}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">PINs</span>
              </div>

              <button
                type="button"
                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                title="Increase pin quantity"
                aria-label="Increase pin quantity"
                className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <span className="text-2xl font-black">+</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 text-center mt-3">
              Max 10 pins per generation profile.
            </p>
          </div>

          {/* Footer Trigger Action Bar */}
          <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
            <button
              onClick={handlePayClick}
              disabled={loading || !nameOnCard}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2 h-14"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  <span>Generate</span>
                  <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{pinCostNgn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- FRICTIONLESS DIRECT-ACTION CHECKOUT MODAL OVERLAY --- */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[35px] sm:rounded-[35px] p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setCheckoutOpen(false)}
              title="Close modal"
              aria-label="Close modal"
              className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1 mt-1 text-center">Review & Pay Instantly</h3>
            <p className="text-xs text-slate-400 text-center font-medium mb-5">Tap a wallet below to instantly purchase your ₦{pinCostNgn.toLocaleString()} recharge pins.</p>

            <div className="space-y-3">
              {/* Action 1: Local Naira Cash Account wallet context sheet */}
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
                <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600">₦{pinCostNgn.toLocaleString()}</span>
              </button>

              {/* Action 2: Swifna internal allocation ledger database token balance sheets */}
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

              {/* Action 3: External app ecosystem profile direct node verification wallet */}
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

            {/* Real-time exchange locked multiplier labels footer display */}
            {livePiQuote && (
              <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
                Contract Locker Matrix Multiplier: 1 π ≈ ₦{livePiQuote.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            {isFetchingPiRate && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Fetching real-time evaluation values...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RechargePin;