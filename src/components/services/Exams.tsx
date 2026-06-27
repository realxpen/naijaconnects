import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, BookOpen, User, Phone, Check, Wallet, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { EXAM_TYPES, JAMB_VARIANTS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";
import { authenticatePiUser, createPiPayment, type PiPaymentDTO } from "../../services/piNetworkService";

interface ExamsProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onUpdatePiBalance?: (newPiBalance: number) => void;
  onBack: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

const Exams = ({ user, onUpdateBalance, onUpdatePiBalance, onBack, isGuest = false, onRequireAuth }: ExamsProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { showSuccess } = useSuccessScreen();
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(EXAM_TYPES[0]);
  const [quantity, setQuantity] = useState(1);

  // JAMB Specific
  const [jambProfileID, setJambProfileID] = useState("");
  const [jambType, setJambType] = useState("utme");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const [waecOption, setWaecOption] = useState<"scratch" | "verification">("scratch");
  const [examCatalog, setExamCatalog] = useState<Record<string, { cardTypeId: string; unitAmount: number; cardName: string }>>({});

  // Frictionless Checkout Overlay States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [livePiQuote, setLivePiQuote] = useState<{ rate: number; piAmount: number } | null>(null);
  const [isFetchingPiRate, setIsFetchingPiRate] = useState(false);

  const WAEC_OPTIONS = [
    { id: "scratch" as const, label: "Scratch Card", key: "WAEC" as const },
    { id: "verification" as const, label: "Verification Pin", key: "WAEC_VERIFICATION" as const },
  ];

  const examCostNgn = useMemo(() => {
    if (!selectedExam) return 0;
    if (selectedExam.id === "JAMB") {
      return JAMB_VARIANTS.find(v => v.id === jambType)?.amount || 4700;
    }
    if (selectedExam.id === "WAEC") {
      const waecKey = waecOption === "verification" ? "WAEC_VERIFICATION" : "WAEC";
      const waecUnit = examCatalog[waecKey]?.unitAmount || (waecOption === "verification" ? 3700 : 3340);
      return waecUnit * quantity;
    }
    const unit = examCatalog[selectedExam?.id]?.unitAmount || selectedExam.price || 3500;
    return unit * quantity;
  }, [selectedExam, jambType, waecOption, quantity, examCatalog]);

  const mapCatalogByExamType = (rows: any[]) => {
    const mapped: Record<string, { cardTypeId: string; unitAmount: number; cardName: string }> = {};
    for (const row of rows || []) {
      const name = String(row?.card_name || "").toUpperCase();
      const cardTypeId = String(row?.card_type_id || "");
      const unitAmount = Number(row?.unit_amount || 0);
      if (!cardTypeId || !unitAmount) continue;
      if (name.includes("WAEC VERIFICATION")) {
        mapped.WAEC_VERIFICATION = { cardTypeId, unitAmount, cardName: String(row?.card_name || "WAEC Verification Pin") };
        continue;
      }
      if (name.includes("WAEC")) mapped.WAEC = { cardTypeId, unitAmount, cardName: String(row?.card_name || "WAEC Scratch Card") };
      if (name.includes("NECO")) mapped.NECO = { cardTypeId, unitAmount, cardName: String(row?.card_name || "NECO TOKEN") };
      if (name.includes("NABTEB")) mapped.NABTEB = { cardTypeId, unitAmount, cardName: String(row?.card_name || "NABTEB Scratch Card") };
      if (name.includes("NBAIS")) mapped.NBAIS = { cardTypeId, unitAmount, cardName: String(row?.card_name || "NBAIS Scratch Card") };
      if (name.includes("EXAMINIFY BIOMETRIC")) mapped.EXAMINIFY_BIOMETRIC = { cardTypeId, unitAmount, cardName: String(row?.card_name || "EXAMINIFY BIOMETRIC TOKEN") };
    }
    return mapped;
  };

  const loadExamCatalog = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("naijaresultpins-proxy", {
        body: { action: "list_products" },
      });
      if (error) throw error;
      const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const mapped = mapCatalogByExamType(rows);
      setExamCatalog(mapped);
    } catch (e) {
      setExamCatalog({});
    }
  };

  useEffect(() => {
    loadExamCatalog();
  }, []);

  // --- FETCH DYNAMIC PI VALUATION METRICS ---
  const fetchPiQuoteForExams = async (costInNaira: number) => {
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
      console.warn("Failed to synchronize crypto matrices:", err);
    } finally {
      setIsFetchingPiRate(false);
    }
  };

  // --- 1. VERIFY JAMB ---
  const verifyJamb = async (profileId: string) => {
    if (profileId.length !== 10) return;
    setCustomerName(t("exam.verifying"));
    try {
      const { data, error } = await supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action: "verify_jamb",
          payload: { profile_id: profileId, exam_type: jambType },
        },
      });
      if (error) throw error;
      setCustomerName(data.valid || data.customer_name ? (data.customer_name || t("exam.verified_id")) : t("exam.invalid_profile_id"));
    } catch (e) {
      setCustomerName(t("exam.verification_failed"));
    }
  };

  const handleIncompletePiPayment = (payment: PiPaymentDTO) => {
    const reference = String(payment?.metadata?.reference || "");
    if (!reference) return;
    void supabase.functions.invoke("pi-payment-handler", {
      body: { action: "COMPLETE_PAYMENT", reference, paymentId: payment?.identifier, txid: payment?.transaction?.txid }
    }).catch(err => console.warn("Incomplete utility track dropped:", err));
  };

  // ==============================================================
  // PIPELINE TRANSACTION RUNNERS
  // ==============================================================
  const executeNairaWalletPurchase = async () => {
    if (!selectedExam) return;
    if (user.balance < examCostNgn) return showToast(t("data.insufficient_balance"), "error");

    setLoading(true);
    try {
      let proxyFunc = "affatech-proxy";
      let action = "buy_education";
      let payload: any = {};

      if (selectedExam.id === "JAMB") {
        proxyFunc = "clubkonnect-proxy";
        action = "buy_education";
        payload = { exam_group: "JAMB", exam_type: jambType, profile_id: jambProfileID, phone: phone || "08000000000", amount: examCostNgn };
      } else {
        proxyFunc = "naijaresultpins-proxy";
        action = "buy_card";
        const productKey = selectedExam.id === "WAEC" ? (waecOption === "verification" ? "WAEC_VERIFICATION" : "WAEC") : selectedExam.id;
        const cardTypeId = examCatalog[productKey]?.cardTypeId;
        if (!cardTypeId) throw new Error("Exam product currently unavailable. Please try again later.");
        payload = { card_type_id: cardTypeId, quantity };
      }

      const { data, error } = await supabase.functions.invoke(proxyFunc, { body: { action, payload } });
      if (error) throw new Error(error.message);

      const isSuccess = data?.status === "success" || data?.success === true || data?.status === true || data?.code === "000";

      if (isSuccess) {
        const newBal = user.balance - examCostNgn;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_id: user.id,
          user_email: user.email,
          type: "Exam",
          amount: examCostNgn,
          status: "Success",
          ref: `EXM-${Date.now()}`,
          meta: {
            pin: data.pin || data.token || (data.data && data.data.pin),
            cards: data.cards || data.data?.cards || [],
            details: `Exam: ${selectedExam.id}${selectedExam.id === "WAEC" ? ` (${waecOption})` : ""}`
          }
        });

        setCheckoutOpen(false);
        showSuccess({
          title: "Transfer successful",
          amount: Number(examCostNgn),
          message: "Your exam purchase has been processed successfully.",
          subtitle: selectedExam?.id ? `FOR ${selectedExam.id}` : undefined,
        });
        setJambProfileID("");
        setCustomerName("");
        setQuantity(1);
      } else {
        throw new Error(data.message || t("exam.purchase_failed"));
      }
    } catch (e: any) {
      showToast(e.message || t("exam.purchase_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const executeInternalPiPurchase = async () => {
    if (!selectedExam || !livePiQuote || livePiQuote.piAmount <= 0) return showToast("Conversion value weight parsing failed.", "error");
    if ((user.piBalance || 0) < livePiQuote.piAmount) {
      return showToast(`Insufficient internal Pi balance. You require: ${livePiQuote.piAmount} π`, "error");
    }

    setLoading(true);
    try {
      const label = selectedExam.id === "WAEC" ? `WAEC (${waecOption.toUpperCase()})` : selectedExam.id;
      const { data: res, error: rpcErr } = await supabase.rpc("purchase_service_with_internal_pi", {
        p_user_id: user.id,
        p_pi_amount: livePiQuote.piAmount,
        p_service_type: "Exam Pins",
        p_description: `Purchased (${quantity}x) ${label} Exam registration profile pin via internal Swifna Pi context ledger.`,
        p_meta: { cost_ngn: examCostNgn, rate: livePiQuote.rate, exam_id: selectedExam.id, qty: quantity, waec_opt: waecOption, jamb_id: jambProfileID, jamb_type: jambType }
      });

      if (rpcErr || !res?.success) throw new Error(res?.message || rpcErr?.message || "Internal cryptocurrency tracking fault.");
      if (onUpdatePiBalance) onUpdatePiBalance(Number(res.new_balance));

      // Fire down-stream background vendor provisioning pipeline hook
      let proxyFunc = "affatech-proxy";
      let action = "buy_education";
      let payload: any = {};

      if (selectedExam.id === "JAMB") {
        proxyFunc = "clubkonnect-proxy";
        action = "buy_education";
        payload = { exam_group: "JAMB", exam_type: jambType, profile_id: jambProfileID, phone: phone || "08000000000", amount: examCostNgn };
      } else {
        proxyFunc = "naijaresultpins-proxy";
        action = "buy_card";
        const productKey = selectedExam.id === "WAEC" ? (waecOption === "verification" ? "WAEC_VERIFICATION" : "WAEC") : selectedExam.id;
        payload = { card_type_id: examCatalog[productKey]?.cardTypeId, quantity };
      }

      await supabase.functions.invoke(proxyFunc, { body: { action, payload } });

      setCheckoutOpen(false);
      showSuccess({
        title: "Internal Purchase Successful",
        amount: examCostNgn,
        message: `Deducted ${livePiQuote.piAmount} π securely from internal ledger. Registration token sequence generated successfully.`,
        subtitle: selectedExam?.id ? `FOR ${selectedExam.id}` : undefined,
      });
      setJambProfileID("");
      setCustomerName("");
      setQuantity(1);
    } catch (e: any) {
      showToast(e.message || "Internal network connection broken.", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeDirectPiNetworkPurchase = async () => {
    if (!selectedExam || !livePiQuote) return;
    showToast("Launching direct verification nodes via Pi Wallet App...", "info");
    setLoading(true);

    try {
      await authenticatePiUser(handleIncompletePiPayment);
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("pi-payment-handler", {
        body: { action: "CREATE_PAYMENT", nairaAmount: examCostNgn, serviceId: "00000000-0000-0000-0000-000000000000" }
      });

      if (quoteErr || !quote?.success) throw new Error(quote?.error || "Pricing index compilation context timed out.");
      const reference = String(quote.reference || "");
      const finalPiCost = Number(quote.pi_amount || 0);
      const label = selectedExam.id === "WAEC" ? `WAEC (${waecOption.toUpperCase()})` : selectedExam.id;

      await createPiPayment(
        {
          amount: finalPiCost,
          memo: `Swifna Education: Buy (${quantity}x) ${label} Pin voucher profiles`,
          metadata: { reference, exam_id: selectedExam.id, qty: quantity, waec_opt: waecOption, service_type: "exams", amount: examCostNgn, jamb_id: jambProfileID, jamb_type: jambType },
        },
        {
          onReadyForServerApproval: (paymentId) => {
            void supabase.functions.invoke("pi-payment-handler", { body: { action: "APPROVE_PAYMENT", reference, paymentId } });
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            void supabase.functions.invoke("pi-payment-handler", { body: { action: "COMPLETE_PAYMENT", reference, paymentId, txid } })
              .then(async ({ data }) => {
                if (data?.local_status !== "success") throw new Error("Contract tracking sequence mapping dropped.");

                let proxyFunc = "affatech-proxy";
                let action = "buy_education";
                let payload: any = {};

                if (selectedExam.id === "JAMB") {
                  proxyFunc = "clubkonnect-proxy";
                  action = "buy_education";
                  payload = { exam_group: "JAMB", exam_type: jambType, profile_id: jambProfileID, phone: phone || "08000000000", amount: examCostNgn };
                } else {
                  proxyFunc = "naijaresultpins-proxy";
                  action = "buy_card";
                  const productKey = selectedExam.id === "WAEC" ? (waecOption === "verification" ? "WAEC_VERIFICATION" : "WAEC") : selectedExam.id;
                  payload = { card_type_id: examCatalog[productKey]?.cardTypeId, quantity };
                }

                await supabase.functions.invoke(proxyFunc, { body: { action, payload } });

                setCheckoutOpen(false);
                showSuccess({
                  title: "Direct Pi Purchase Ok",
                  amount: examCostNgn,
                  message: `Blockchain payload validated securely. ${finalPiCost} π debited from application wallet profile.`,
                  subtitle: selectedExam?.id ? `FOR ${selectedExam.id}` : undefined,
                });
                setJambProfileID("");
                setCustomerName("");
                setQuantity(1);
              })
              .catch(err => showToast(err.message || "Direct wallet confirmation sequence dropped.", "error"));
          },
          onCancel: () => showToast("Direct utility checkout abandoned by client terminal.", "info"),
          onError: (error) => showToast(error instanceof Error ? error.message : "Node signature validation tracking fault.", "error"),
        },
      );
    } catch (e: any) {
      showToast(e.message || "Ecosystem sandbox workspace connection failure.", "error");
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
    if (selectedExam.id === "JAMB" && (!jambProfileID || customerName.includes("Invalid") || customerName === "Verifying...")) {
      showToast(t("exam.verify_profile_id"), "error");
      return;
    }
    setCheckoutOpen(true);
    fetchPiQuoteForExams(examCostNgn);
  };

  return (
    <>
      <div className="animate-in slide-in-from-right duration-300 pb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
            <ArrowLeft size={16} /> {t("common.back")}
          </button>
          <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1 rounded-full balance-pill">
            <span className="text-xs font-bold text-slate-400">{t("common.balance")}:</span>
            <span className="text-sm font-black text-white">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">

          {/* Top Section (Dark Theme Accent Layout Context) */}
          <div className="p-6 bg-slate-900 text-white">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t("exam.select_exam")}</label>

            {/* Exam Selection Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {EXAM_TYPES.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => { setSelectedExam(e); setCustomerName(""); }}
                  className={`relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 h-20 ${selectedExam?.id === e.id
                    ? "bg-slate-800 border-emerald-500 ring-1 ring-emerald-500"
                    : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                    }`}
                >
                  {selectedExam?.id === e.id && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    {e.logo ? <img src={e.logo} alt={`${e.id} exam logo`} className="w-6 h-6 object-contain" /> : <BookOpen size={18} className="text-slate-400" />}
                  </div>
                  <span className="text-xs font-bold">{e.id}</span>
                </button>
              ))}
            </div>

            {/* JAMB Specific Inputs */}
            {selectedExam?.id === "JAMB" && (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">{t("exam.profile_id")}</label>
                  {customerName && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${customerName.includes("Invalid") || customerName.includes("Failed") ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                      {customerName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700 backdrop-blur-sm mb-3">
                  <User size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={jambProfileID}
                    onChange={(e) => {
                      setJambProfileID(e.target.value);
                      if (e.target.value.length === 10) verifyJamb(e.target.value);
                    }}
                    className="bg-transparent w-full font-bold text-white outline-none placeholder:text-slate-600"
                    placeholder={t("exam.enter_profile_id")}
                    maxLength={10}
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700 backdrop-blur-sm">
                  <Phone size={18} className="text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-transparent w-full font-bold text-white outline-none placeholder:text-slate-600"
                    placeholder={t("profile.phone_number")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Middle Section (Configuration Parameters) */}
          <div className="p-5">
            {selectedExam?.id === "JAMB" ? (
              <div>
                <h3 className="font-bold text-slate-700 mb-3 text-sm">{t("exam.exam_type")}</h3>
                <div className="flex gap-3">
                  {JAMB_VARIANTS.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setJambType(v.id)}
                      className={`flex-1 p-4 rounded-2xl border-2 text-left transition-all ${jambType === v.id
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-slate-100 bg-white"
                        }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-black uppercase ${jambType === v.id ? "text-emerald-700" : "text-slate-500"}`}>{v.name}</span>
                        {jambType === v.id && <Check size={14} className="text-emerald-600" />}
                      </div>
                      <span className="text-lg font-black text-slate-800">₦{v.amount.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {selectedExam?.id === "WAEC" && (
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-700 mb-3 text-sm">WAEC Product Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {WAEC_OPTIONS.map((opt) => {
                        const unit = examCatalog[opt.key]?.unitAmount || (opt.id === "verification" ? 3700 : 3340);
                        return (
                          <button
                            type="button"
                            key={opt.id}
                            onClick={() => setWaecOption(opt.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${waecOption === opt.id ? "border-emerald-600 bg-emerald-50" : "border-slate-100 bg-white"
                              }`}
                          >
                            <div className={`text-[10px] font-black uppercase ${waecOption === opt.id ? "text-emerald-700" : "text-slate-500"}`}>
                              {opt.label}
                            </div>
                            <div className="text-sm font-black text-slate-800">
                              ₦{Number(unit).toLocaleString()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <h3 className="font-bold text-slate-700 mb-3 text-sm">{t("exam.quantity")}</h3>
                <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    title="Decrease quantity"
                    aria-label="Decrease quantity"
                    className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-2xl font-black">-</span>
                  </button>

                  <div className="text-center">
                    <span className="block text-3xl font-black text-slate-800">{quantity}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{t("exam.pins")}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(5, quantity + 1))}
                    title="Increase quantity"
                    aria-label="Increase quantity"
                    className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <span className="text-2xl font-black">+</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Bottom Layout Trigger Bar Context */}
          <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
            <button
              type="button"
              onClick={handlePayClick}
              disabled={loading || (selectedExam?.id === "JAMB" && (!jambProfileID || customerName.includes("Invalid") || customerName === "Verifying..."))}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2 h-14"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  <span>{t("exam.purchase")}</span>
                  <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{examCostNgn.toLocaleString()}</span>
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
              type="button"
              onClick={() => setCheckoutOpen(false)}
              title="Close modal"
              aria-label="Close modal"
              className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1 mt-1 text-center">Review & Pay Instantly</h3>
            <p className="text-xs text-slate-400 text-center font-medium mb-5">Tap a wallet choice layout below to purchase your exam profile codes.</p>

            <div className="space-y-3">
              {/* Direct Action Option 1: Local Fiat balance wallet account context sheets */}
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
                <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600">₦{examCostNgn.toLocaleString()}</span>
              </button>

              {/* Direct Action Option 2: Internal application ledger database crypto allocations */}
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

              {/* Direct Action Option 3: External Sandbox ecosystem browser wallet extension profile wrapper */}
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

            {/* Dynamic real-time token tracking metadata footer lock indicators */}
            {livePiQuote && (
              <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
                Contract Exchange Factor Locks: 1 π ≈ ₦{livePiQuote.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            {isFetchingPiRate && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Refreshing dynamic exchange evaluations...
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

export default Exams;