import React, { useState } from "react";
import { ArrowLeft, Loader2, BookOpen, User, Phone, Check } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { EXAM_TYPES, JAMB_VARIANTS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";
import PinPrompt from "../PinPrompt";
import ConfirmTransactionModal from "../ConfirmTransactionModal";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";

interface ExamsProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const Exams = ({ user, onUpdateBalance, onBack }: ExamsProps) => {
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  // --- 2. CALCULATE COST ---
  const calculateCost = () => {
    if (!selectedExam) return 0;
    if (selectedExam.id === "JAMB") {
        return JAMB_VARIANTS.find(v => v.id === jambType)?.amount || 4700;
    }
    return (selectedExam.price || 3500) * quantity;
  };

  // --- 3. PURCHASE LOGIC ---
  const doPurchase = async () => {
    if (!selectedExam) return;
    const cost = calculateCost();

    if (user.balance < cost) return showToast(t("data.insufficient_balance"), "error");
    if (selectedExam.id === "JAMB" && (!jambProfileID || customerName.includes("Invalid"))) return showToast(t("exam.verify_profile_id"), "error");

    setLoading(true);
    try {
      let proxyFunc = "affatech-proxy";
      let action = "buy_education";
      let payload: any = {};

      if (selectedExam.id === "JAMB") {
        proxyFunc = "clubkonnect-proxy";
        payload = {
           exam_group: "JAMB",
           exam_type: jambType,
           profile_id: jambProfileID,
           phone: phone || "08000000000",
           amount: cost
        };
      } else {
        // WAEC / NECO
        payload = {
           exam_group: selectedExam.id,
           quantity: quantity,
           amount: cost
        };
      }

      const { data, error } = await supabase.functions.invoke(proxyFunc, {
        body: { action, payload }
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true;

      if (isSuccess) {
        const newBal = user.balance - cost;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_id: user.id,
          user_email: user.email,
          type: "Exam",
          amount: cost,
          status: "Success",
          ref: `EXM-${Date.now()}`,
          meta: { 
             pin: data.pin || data.token || (data.data && data.data.pin),
             details: `Exam: ${selectedExam.id}`
          }
        });
        showSuccess({
          title: "Transfer successful",
          amount: Number(cost),
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
    setConfirmOpen(true);
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
        
        {/* Top Section (Dark) */}
        <div className="p-6 bg-slate-900 text-white">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t("exam.select_exam")}</label>
            
            {/* Exam Selection Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {EXAM_TYPES.map((e: any) => (
                    <button
                        key={e.id}
                        onClick={() => { setSelectedExam(e); setCustomerName(""); }}
                        className={`relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${
                            selectedExam?.id === e.id 
                            ? "bg-slate-800 border-emerald-500 ring-1 ring-emerald-500" 
                            : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                        }`}
                    >
                        {selectedExam?.id === e.id && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                             {e.logo ? <img src={e.logo} className="w-6 h-6 object-contain"/> : <BookOpen size={18} className="text-slate-400"/>}
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

        {/* Middle Section (Configuration) */}
        <div className="p-5">
            {selectedExam?.id === "JAMB" ? (
                <div>
                     <h3 className="font-bold text-slate-700 mb-3 text-sm">{t("exam.exam_type")}</h3>
                     <div className="flex gap-3">
                        {JAMB_VARIANTS.map(v => (
                            <button 
                                key={v.id} 
                                onClick={() => setJambType(v.id)} 
                                className={`flex-1 p-4 rounded-2xl border-2 text-left transition-all ${
                                    jambType === v.id 
                                    ? "border-emerald-600 bg-emerald-50" 
                                    : "border-slate-100 bg-white"
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-xs font-black uppercase ${jambType === v.id ? "text-emerald-700" : "text-slate-500"}`}>{v.name}</span>
                                    {jambType === v.id && <Check size={14} className="text-emerald-600" />}
                                </div>
                                <span className="text-lg font-black text-slate-800">₦{v.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </button>
                        ))}
                     </div>
                </div>
            ) : (
                <div>
                    <h3 className="font-bold text-slate-700 mb-3 text-sm">{t("exam.quantity")}</h3>
                    <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                        <button 
                            onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                            className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-2xl font-black">-</span>
                        </button>
                        
                        <div className="text-center">
                            <span className="block text-3xl font-black text-slate-800">{quantity}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{t("exam.pins")}</span>
                        </div>
                        
                        <button 
                            onClick={() => setQuantity(Math.min(5, quantity + 1))} 
                            className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                            <span className="text-2xl font-black">+</span>
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
             <button
                onClick={handlePurchase}
                disabled={loading || (selectedExam.id === "JAMB" && (!jambProfileID || customerName.includes("Invalid")))}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                        <span>{t("exam.purchase")}</span>
                        <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{calculateCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </>
                )}
            </button>
        </div>

      </div>
      </div> {/* <--- THIS WAS MISSING! (Closes animate-in div) */}

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
      subtitle={selectedExam?.id ? `FOR ${selectedExam.id}` : undefined}
      amountLabel="Total Pay"
      amount={Number(calculateCost())}
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

export default Exams;
