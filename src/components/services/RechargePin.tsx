import React, { useState } from "react";
import { ArrowLeft, Loader2, Printer, Wallet } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { dbService } from "../../services/dbService";
import { CARRIERS, PIN_PRICING, RECHARGE_AMOUNTS } from "../../constants";
import { useToast } from "../ui/ToastProvider";

interface RechargePinProps {
  user: any;
  onUpdateBalance: (newBalance: number) => void;
  onBack: () => void;
}

const RechargePin = ({ user, onUpdateBalance, onBack }: RechargePinProps) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [networkId, setNetworkId] = useState(1);
  const [amount, setAmount] = useState("100");
  const [quantity, setQuantity] = useState(1);
  const [nameOnCard, setNameOnCard] = useState("");

  // --- 1. CALCULATE COST ---
  const calculateTotalCost = () => {
    // PIN_PRICING is percentage/unit cost. Assuming standard logic.
    const unitPrice = PIN_PRICING[networkId] || 100;
    // Total = (Price per unit * (Denomination / 100)) * Quantity
    const total = unitPrice * (Number(amount) / 100) * quantity;
    return total;
  };

  // --- 2. PURCHASE LOGIC ---
  const handlePurchase = async () => {
    if (!amount || !nameOnCard) return showToast("Please fill all fields", "error");
    const cost = calculateTotalCost();
    
    if (user.balance < cost) return showToast("Insufficient Balance", "error");
    if (quantity > 10) return showToast("Max 10 pins at a time", "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "buy_recharge_pin",
          payload: {
            network: networkId,
            amount: amount,
            quantity: quantity,
            name_on_card: nameOnCard,
          },
        },
      });

      if (error) throw new Error(error.message);

      const isSuccess = data.status === "success" || data.success === true;

      if (isSuccess) {
        const newBal = user.balance - cost;
        onUpdateBalance(newBal);
        await dbService.updateBalance(user.email, newBal);
        await dbService.addTransaction({
          user_email: user.email,
          type: "RechargePin",
          amount: cost,
          status: "Success",
          ref: `PIN-${Date.now()}`,
          meta: {
            pin: "See 'My Pins' or Receipt",
            quantity: quantity,
            denomination: amount
          }
        });
        showToast(`Success! Generated ${quantity} Pins.`, "success");
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

  return (
    <div className="animate-in slide-in-from-right duration-300 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full">
            <Wallet size={14} className="text-emerald-600"/>
            <span className="text-sm font-black text-emerald-600">₦{user.balance.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Top Section (Dark) */}
        <div className="p-6 bg-slate-900 text-white">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Select Network</label>
            
            {/* Network Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {CARRIERS.map((net) => (
                    <button
                        key={net.id}
                        onClick={() => setNetworkId(net.id)}
                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${
                            networkId === net.id 
                            ? "bg-slate-800 border-emerald-500 ring-1 ring-emerald-500" 
                            : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                        }`}
                    >
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                             <img src={net.logo} className="w-full h-full object-cover"/>
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

        {/* Middle Section (Denomination & Quantity) */}
        <div className="p-5">
            <h3 className="font-bold text-slate-700 mb-3 text-sm">Denomination</h3>
            <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-4">
                {RECHARGE_AMOUNTS.map((amt) => (
                    <button
                        key={amt}
                        onClick={() => setAmount(amt.toString())}
                        className={`min-w-[80px] py-3 px-2 rounded-xl text-xs font-black border-2 transition-all ${
                            amount === amt.toString() 
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-md" 
                            : "border-slate-100 bg-white text-slate-500 hover:border-emerald-200"
                        }`}
                    >
                        ₦{amt}
                    </button>
                ))}
            </div>

            <h3 className="font-bold text-slate-700 mb-3 text-sm">Quantity</h3>
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                    className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <span className="text-2xl font-black">-</span>
                </button>
                
                <div className="text-center">
                    <span className="block text-3xl font-black text-slate-800">{quantity}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">PINs</span>
                </div>
                
                <button 
                    onClick={() => setQuantity(Math.min(10, quantity + 1))} 
                    className="w-12 h-12 bg-white shadow-sm rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                    <span className="text-2xl font-black">+</span>
                </button>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center mt-3">
                Max 10 pins per generation.
            </p>
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
             <button
                onClick={handlePurchase}
                disabled={loading || !nameOnCard}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                        <span>Generate</span>
                        <span className="bg-emerald-700/50 px-2 py-0.5 rounded text-xs">₦{calculateTotalCost().toLocaleString()}</span>
                    </>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};

export default RechargePin;
