import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, ArrowLeftRight, CheckCircle, Wallet, Smartphone, AlertCircle } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { CARRIERS } from "../../constants";

interface AirtimeToCashProps {
  user: any; // Added user prop
  onBack: () => void;
}

const AirtimeToCash = ({ user, onBack }: AirtimeToCashProps) => {
  const [loading, setLoading] = useState(false);
  const [networkId, setNetworkId] = useState(1);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [info, setInfo] = useState<any>(null);

  // --- 1. PRE-FILL OWNER PHONE ---
  useEffect(() => {
    const fetchUserPhone = async () => {
        let phoneToUse = user.phone;

        // If phone not in user object, fetch from DB
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
            setPhone(phoneToUse);
        }
    };
    fetchUserPhone();
  }, [user]);

  // --- 2. AUTO-DETECT NETWORK ---
  useEffect(() => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length >= 4) {
      const prefix = cleanPhone.slice(0, 4);
      // MTN
      if (["0803", "0806", "0703", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"].includes(prefix)) setNetworkId(1);
      // GLO
      else if (["0805", "0807", "0705", "0815", "0811", "0905", "0915"].includes(prefix)) setNetworkId(2);
      // AIRTEL
      else if (["0802", "0808", "0708", "0812", "0902", "0907", "0901", "0904"].includes(prefix)) setNetworkId(3);
      // 9MOBILE
      else if (["0809", "0818", "0817", "0909", "0908"].includes(prefix)) setNetworkId(4);
    }
  }, [phone]);

  // --- 3. SUBMIT LOGIC ---
  const handleSubmit = async () => {
    if (!phone || !amount) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("affatech-proxy", {
        body: {
          action: "airtime_to_cash",
          payload: {
            network: networkId,
            phone: phone,
            amount: amount,
          },
        },
      });

      if (error) throw new Error(error.message);

      setInfo({
         message: data.message || data.api_response || "Proceed to transfer airtime manually to the admin number provided below.",
         amount: amount,
         receive: (Number(amount) * 0.8).toFixed(0)
      });

    } catch (e: any) {
      alert(e.message || "Failed to initiate");
    } finally {
      setLoading(false);
    }
  };

  // --- 4. SUCCESS VIEW ---
  if (info) {
      return (
        <div className="animate-in slide-in-from-right duration-300 pb-20 fixed inset-0 z-50 bg-white flex flex-col">
            <div className="p-4">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase mb-4">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

           <div className="flex-1 px-6 flex flex-col items-center justify-center text-center -mt-10">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100 ring-4 ring-emerald-50">
                 <CheckCircle size={40} />
              </div>
              <h3 className="font-black uppercase mb-2 text-2xl text-slate-800">Request Initiated</h3>
              <p className="text-slate-500 font-medium mb-8 max-w-xs mx-auto text-sm">
                  Please complete the transfer to finalize your cash request.
              </p>
              
              <div className="w-full max-w-sm bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Instruction</p>
                  <p className="text-sm font-bold text-slate-800 leading-relaxed mb-6">{info.message}</p>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                      <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">You Sent</p>
                          <p className="text-lg font-black text-slate-800">₦{Number(info.amount).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">You Receive</p>
                          <p className="text-lg font-black text-emerald-600">₦{Number(info.receive).toLocaleString()}</p>
                      </div>
                  </div>
              </div>
           </div>

           <div className="p-6 bg-white border-t border-slate-100">
              <button onClick={onBack} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase shadow-lg shadow-emerald-200 active:scale-95 transition-transform">
                 I Have Transferred
              </button>
           </div>
        </div>
      )
  }

  // --- 5. FORM VIEW ---
  return (
    <div className="animate-in slide-in-from-right duration-300 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
            <ArrowLeftRight size={14} className="text-orange-600"/>
            <span className="text-xs font-black text-orange-600">Swap Airtime</span>
        </div>
      </div>

      <div className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Top Section (Dark) */}
        <div className="p-6 bg-slate-900 text-white relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Sender Mobile Number</label>
            
            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 backdrop-blur-sm mb-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                    <img 
                        src={CARRIERS.find(c => c.id === networkId)?.logo} 
                        className="w-full h-full object-cover rounded-full"
                        alt="Network Logo"
                    />
                </div>
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="bg-transparent w-full text-2xl font-black text-white outline-none placeholder:text-slate-600"
                    placeholder="080..."
                />
            </div>

            {/* Manual Network Selector */}
            <div className="flex gap-2 justify-end">
                 {CARRIERS.filter(c => c.name !== "SMILE").map(c => (
                     <button 
                        key={c.id}
                        onClick={() => setNetworkId(c.id)}
                        className={`w-2 h-2 rounded-full transition-all ${networkId === c.id ? "bg-orange-500 w-6" : "bg-slate-700"}`}
                     />
                 ))}
            </div>
        </div>

        {/* Body Section */}
        <div className="p-5">
            <h3 className="font-bold text-slate-700 mb-4 text-sm">Conversion Details</h3>
            
            {/* Amount Input */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Amount to Sell</label>
                 <div className="flex items-center">
                    <span className="text-slate-400 font-bold mr-2 text-xl">₦</span>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-transparent w-full font-black text-slate-800 outline-none text-3xl placeholder:text-slate-300"
                        placeholder="0"
                    />
                 </div>
            </div>

            {/* Calculation Card */}
            <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Wallet size={80} className="text-orange-600" />
                </div>
                
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <p className="text-[10px] font-black text-orange-400 uppercase mb-1">You Receive</p>
                        <p className="text-3xl font-black text-orange-600">
                             ₦{amount ? (Number(amount) * 0.8).toLocaleString() : "0"}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="bg-white text-orange-600 text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm border border-orange-100">
                            80% Rate
                        </span>
                    </div>
                </div>
                <p className="text-[10px] text-orange-400/80 mt-2 relative z-10 font-medium">
                    Funds added to wallet instantly after verification.
                </p>
            </div>

            <div className="mt-4 flex gap-3 items-start bg-blue-50 p-3 rounded-xl border border-blue-100">
                 <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                     Note: The transfer is manual. You will be given an admin number to transfer the airtime to in the next step.
                 </p>
            </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
             <button
                onClick={handleSubmit}
                disabled={loading || !amount || !phone}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg active:scale-95 transition-transform"
            >
                {loading ? <Loader2 className="animate-spin" /> : "Proceed to Swap"}
            </button>
        </div>

      </div>
    </div>
  );
};

export default AirtimeToCash;