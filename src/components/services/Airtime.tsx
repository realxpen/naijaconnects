import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Smartphone, Wallet } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS } from "../../constants";
import { useI18n } from "../../i18n";
import { useToast } from "../ui/ToastProvider";
import PinPrompt from "../PinPrompt";
import ConfirmTransactionModal from "../ConfirmTransactionModal";
import { hashPin } from "../../utils/pin";
import { beneficiaryService, Beneficiary } from "../../services/beneficiaryService";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";

interface AirtimeProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const Airtime = ({ user, onUpdateBalance, onBack }: AirtimeProps) => {
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
            setPhoneNumber(phoneToUse); // <--- AUTO-FILL INPUT HERE
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
        if (airtimeType !== "VTU" && airtimeType !== "Share and Sell" && airtimeType !== "awuf4U") setAirtimeType("VTU");
      }
      // GLO
      else if (["0805", "0807", "0705", "0815", "0811", "0905", "0915"].includes(prefix)) {
        setNetworkId(2);
        setAirtimeType("VTU");
      }
      // AIRTEL
      else if (["0802", "0808", "0708", "0812", "0902", "0907", "0901", "0904"].includes(prefix)) {
        setNetworkId(3);
        setAirtimeType("VTU");
      }
      // 9MOBILE
      else if (["0809", "0818", "0817", "0909", "0908"].includes(prefix)) {
        setNetworkId(4);
        setAirtimeType("VTU");
      }
    }
  }, [phoneNumber]);

  // --- 3. SAVE RECENT NUMBER ---
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

  // --- 4. PURCHASE LOGIC ---
  const doPurchase = async () => {
    if (!amount || !phoneNumber) return;
    if (Number(amount) > user.balance) return showToast(t("airtime.insufficient_balance"), "error");
    
    setLoading(true);
    try {
      const isAffatechSpecial = networkId === 1 && (airtimeType === "Share and Sell" || airtimeType === "awuf4U");
      const proxyFunc = isAffatechSpecial ? "affatech-proxy" : "clubkonnect-proxy";
      
      const { data, error } = await supabase.functions.invoke(proxyFunc, {
        body: {
          action: "buy_airtime",
          payload: {
            network: networkId,
            phone: phoneNumber,
            amount: Number(amount),
            airtime_type: airtimeType,
          },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true || 
        (data.data && (data.data.status === "ORDER_RECEIVED" || data.data.status === "ORDER_COMPLETED"));

      if (isSuccess) {
        const newBal = user.balance - Number(amount);
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_email: user.email,
          type: "Airtime",
          amount: Number(amount),
          status: "Success",
          ref: `AIR-${Date.now()}`,
        });
        
        // Save to Recents
        saveRecentNumber(phoneNumber);

        showSuccess({
          title: "Transfer successful",
          amount: Number(amount),
          message: "Your airtime purchase has been processed successfully.",
          subtitle: phoneNumber ? `FOR ${phoneNumber}` : undefined,
        });
        setPhoneNumber(userPhone); // Reset to user phone
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
    setConfirmOpen(true);
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
            <Wallet size={14} className="text-white"/>
            <span className="text-sm font-black text-emerald-600">₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                {/* Network Icon */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                    <img 
                        src={CARRIERS.find(c => c.id === networkId)?.logo} 
                        className="w-8 h-8 object-contain rounded-full"
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
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all whitespace-nowrap ${
                        airtimeType === type ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"
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
                        className={`relative p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                            amount === amt.toString() 
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
                onClick={handlePurchase}
                disabled={loading || phoneNumber.length < 11 || !amount}
                className="px-8 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center"
            >
                {loading ? <Loader2 className="animate-spin" /> : t("common.pay")}
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
    <ConfirmTransactionModal
      open={confirmOpen}
      title="Confirm Transaction"
      subtitle={phoneNumber ? `FOR ${phoneNumber}` : undefined}
      amountLabel="Total Pay"
      amount={Number(amount || 0)}
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

export default Airtime;
