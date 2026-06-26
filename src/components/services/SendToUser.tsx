import React, { useState } from "react";
import { ArrowLeft, Loader2, UserCheck, Wallet, Send, AlertCircle } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../ui/ToastProvider";
import PinPrompt from "../PinPrompt";
import { verifyPinHash } from "../../utils/pin";
import { useSuccessScreen } from "../ui/SuccessScreenProvider";

interface SendToUserProps {
    user: any;
    onUpdateBalance: (newBalance: number) => void;
    onBack: () => void;
    isGuest?: boolean;
    onRequireAuth?: () => void;
}

const SendToUser = ({ user, onUpdateBalance, onBack, isGuest = false, onRequireAuth }: SendToUserProps) => {
    const { showToast } = useToast();
    const { showSuccess } = useSuccessScreen();
    const [loading, setLoading] = useState(false);
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");

    // Security PIN states
    const [pinOpen, setPinOpen] = useState(false);
    const [pinError, setPinError] = useState("");
    const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

    const transferCostNgn = Number(amount || 0);
    const presetAmounts = [500, 1000, 2000, 5000, 10000, 20000];

    const handleTransferExecution = async () => {
        if (!recipient.trim() || transferCostNgn <= 0) return;
        setLoading(true);

        try {
            // Call the secure Database RPC pipeline directly
            const { data, error } = await supabase.rpc("transfer_naira_p2p", {
                p_sender_id: user.id,
                p_recipient_identifier: recipient.trim(),
                p_amount: transferCostNgn,
            });

            if (error) throw error;

            if (data?.success) {
                const updatedBal = Number(data.new_sender_balance);
                onUpdateBalance(updatedBal);

                showSuccess({
                    title: "Transfer Successful",
                    amount: transferCostNgn,
                    message: `You have successfully transferred cash to ${data.recipient_name || recipient}`,
                    subtitle: `Sent Instantly`,
                });

                setRecipient("");
                setAmount("");
            } else {
                throw new Error(data?.message || "Transfer sequence broken.");
            }
        } catch (e: any) {
            showToast(e.message || "P2P System connection timed out.", "error");
        } finally {
            setLoading(false);
        }
    };

    const requirePin = (action: () => void) => {
        if (isGuest || !user?.id) {
            showToast("Please login or sign up before transferring funds.", "info");
            onRequireAuth?.();
            return;
        }
        if (!user?.pinHash) {
            showToast("Please set up your security PIN in your profile first.", "error");
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

    const handleSubmitClick = () => {
        if (isGuest) return onRequireAuth?.();
        if (!recipient.trim()) return showToast("Please input a recipient email or phone number.", "error");
        if (transferCostNgn <= 0) return showToast("Please complete a valid value amount parameter.", "error");
        if (user.balance < transferCostNgn) return showToast("Insufficient wallet cash balance.", "error");

        requirePin(handleTransferExecution);
    };

    return (
        <>
            <div className="animate-in slide-in-from-right duration-300 pb-20">
                {/* Header Navigation */}
                <div className="flex justify-between items-center mb-6">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1 rounded-full balance-pill">
                        <Wallet size={14} className="text-white" />
                        <span className="text-sm font-black text-white">
                            Fiat Balance: ₦{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    
                        <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1 rounded-full balance-pill">
                            <Wallet size={14} className="text-white" />
                            <span className="text-sm font-black text-white">
                                PI Balance: {user.piBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} π
                            </span>
                        </div>
                    
                </div>

                <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
                    {/* Recipient Header Layout Block */}
                    <div className="p-6 bg-slate-900 text-white relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                            Recipient Information
                        </label>

                        <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-emerald-400">
                                <UserCheck size={18} />
                            </div>
                            <input
                                type="text"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                className="bg-transparent w-full text-base font-bold text-white outline-none placeholder:text-slate-600"
                                placeholder="Enter Email or Phone Line"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">Enter the target Swifna user username identifier credential.</p>
                    </div>

                    {/* Configuration Space */}
                    <div className="p-5">
                        <h3 className="font-bold text-slate-700 mb-3 text-sm">Select Amount</h3>
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {presetAmounts.map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => setAmount(amt.toString())}
                                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center ${amount === amt.toString() ? "border-emerald-600 bg-emerald-50 shadow-md" : "border-slate-100 bg-slate-50"
                                        }`}
                                >
                                    <span className="text-sm font-black text-slate-800">₦{amt.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Input Layout */}
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center px-4 border-2 border-slate-100 focus-within:border-emerald-500 transition-colors mb-4">
                            <span className="text-slate-400 font-black mr-2 text-xl">₦</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="bg-transparent w-full h-full font-black text-slate-800 outline-none text-2xl placeholder:text-slate-300"
                                placeholder="0.00"
                            />
                        </div>

                        <div className="flex gap-3 items-start bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                                Peer transfers happen inside secure engine blocks. Confirmed transactions cannot be reversed once processed down ledger systems.
                            </p>
                        </div>
                    </div>

                    {/* Sticky Processing Action Button */}
                    <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                        <button
                            onClick={handleSubmitClick}
                            disabled={loading || !recipient.trim() || transferCostNgn <= 0}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg active:scale-95 transition-transform h-14"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <><Send size={16} /> Send Cash instantly</>}
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
        </>
    );
};

export default SendToUser;