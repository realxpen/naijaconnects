import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, Tv, Zap, ArrowRight, ArrowLeftRight, X, Loader2, RotateCcw,
  TrendingUp, TrendingDown, CreditCard, GraduationCap, Printer, Building2, ChevronDown, CheckCircle
} from 'lucide-react';
import { usePaystackPayment } from 'react-paystack';
import { dbService } from '../services/dbService';
import { CARRIERS, NETWORK_ID_MAP } from '../constants'; 
import { Carrier } from '../types';
import { supabase } from "../supabaseClient";

interface DashboardProps {
  user: { name: string; email: string; balance: number };
  onUpdateBalance: (newBalance: number) => void;
}

type ProductType = 'Airtime' | 'Data' | 'Cable' | 'Electricity' | 'Exam' | 'RechargePin' | 'AirtimeToCash';

const PREFILLED_AMOUNTS = [1000, 2000, 5000, 10000];
const RECHARGE_AMOUNTS = [100, 200, 500, 1000];

// --- CONSTANTS ---
const CABLE_PROVIDERS = [
    { id: 1, name: 'GOTV' }, { id: 2, name: 'DSTV' }, { id: 3, name: 'STARTIMES' }
];

// Fallback plans if API fails (Affatech IDs)
const CABLE_PLANS: any = {
    1: [
        { id: 34, name: "GOtv Smallie - Monthly", amount: 1900 },
        { id: 16, name: "GOtv Jinja - Monthly", amount: 3900 },
        { id: 17, name: "GOtv Jolli - Monthly", amount: 5800 },
        { id: 2,  name: "GOtv Max - Monthly", amount: 8500 },
        { id: 47, name: "GOtv Supa - Monthly", amount: 11400 },
        { id: 49, name: "GOtv Super Plus - Monthly", amount: 16800 },
    ],
    2: [
        { id: 20, name: "DStv Padi - Monthly", amount: 4400 },
        { id: 6,  name: "DStv Yanga - Monthly", amount: 6000 },
        { id: 19, name: "DStv Confam - Monthly", amount: 11000 },
        { id: 7,  name: "DStv Compact - Monthly", amount: 19000 },
        { id: 8,  name: "DStv Compact Plus - Monthly", amount: 30000 },
        { id: 9,  name: "DStv Premium - Monthly", amount: 44500 },
    ],
    3: [
        { id: 37, name: "Nova - 1 Week", amount: 600 },
        { id: 14, name: "Nova - 1 Month", amount: 1900 },
        { id: 38, name: "Basic - 1 Week", amount: 1250 },
        { id: 50, name: "Basic - 1 Month", amount: 3700 },
        { id: 11, name: "Classic - 1 Month", amount: 6200 },
    ]
};

const DISCOS = [
    { id: 1, name: 'Ikeja', short: 'IKEDC' }, { id: 2, name: 'Eko', short: 'EKEDC' },
    { id: 3, name: 'Abuja', short: 'AEDC' }, { id: 4, name: 'Kano', short: 'KEDCO' },
    { id: 5, name: 'Enugu', short: 'EEDC' }, { id: 6, name: 'P.Harcourt', short: 'PHED' },
    { id: 7, name: 'Ibadan', short: 'IBEDC' }, { id: 8, name: 'Kaduna', short: 'KAEDCO' },
    { id: 9, name: 'Jos', short: 'JED' }, { id: 10, name: 'Benin', short: 'BEDC' },
    { id: 11, name: 'Yola', short: 'YEDC' },
];

const EXAM_TYPES = [
    { id: 'WAEC', name: 'WAEC Result Checker', price: 3800 },
    { id: 'NECO', name: 'NECO Result Checker', price: 1500 },
    { id: 'NABTEB', name: 'NABTEB Result Checker', price: 1200 },
];

// --- AUTO DETECT NETWORK ---
const detectNetwork = (phone: string) => {
  const p = phone.replace(/\D/g, '').slice(0, 4);
  
  const MTN = ['0803','0806','0703','0706','0813','0816','0810','0814','0903','0906','0913','0916'];
  const GLO = ['0805','0807','0705','0815','0811','0905','0915'];
  const AIRTEL = ['0802','0808','0708','0812','0902','0907','0901','0904'];
  
  // FIXED: Renamed from '9MOBILE' to 'T2_MOBILE' (Variables can't start with numbers)
  const T2_MOBILE = ['0809','0818','0817','0909','0908'];

  if (MTN.includes(p)) return { id: 1, carrier: Carrier.MTN };
  if (GLO.includes(p)) return { id: 2, carrier: Carrier.GLO };
  if (AIRTEL.includes(p)) return { id: 3, carrier: Carrier.AIRTEL };
  
  // Updated check using the new variable name
  if (T2_MOBILE.includes(p)) return { id: 4, carrier: Carrier.ETISALAT }; 
  
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ user, onUpdateBalance }) => {
  // --- STATES ---
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [productType, setProductType] = useState<ProductType>('Airtime');
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Service States
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState<string>('ALL');
  const [selectedValidity, setSelectedValidity] = useState<string>('ALL');
  const [selectedNetworkId, setSelectedNetworkId] = useState<number>(1);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier>(Carrier.MTN);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  
  // Inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [serviceAmount, setServiceAmount] = useState(''); 
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smartCardNumber, setSmartCardNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCableProvider, setSelectedCableProvider] = useState(1);
  const [selectedCablePlan, setSelectedCablePlan] = useState<any>(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [selectedDisco, setSelectedDisco] = useState<number | null>(null);
  const [meterType, setMeterType] = useState(1);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [nameOnCard, setNameOnCard] = useState('');

  // Airtime to Cash specific
  const [airtimeToCashInfo, setAirtimeToCashInfo] = useState<any>(null); // To store response instructions

  // Bank Withdrawal
  const [bankList, setBankList] = useState<any[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // Paystack
  const [pendingDepositRef, setPendingDepositRef] = useState<string | null>(null);
  const [currentTxRef, setCurrentTxRef] = useState<string>(`txn_${Date.now()}`);

  // --- INITIAL DATA ---
  const fetchUser = async () => {
    try {
      const { data } = await supabase.from("profiles").select("balance").eq("email", user.email).single();
      if (data) onUpdateBalance(data.balance);
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await supabase.from('transactions').select('*').eq('user_email', user.email).order('created_at', { ascending: false }).limit(5);
      if(data) setHistory(data);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { fetchHistory(); fetchUser(); }, [user.email]);

  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length >= 4) {
      const detected = detectNetwork(phoneNumber);
      if (detected) {
        setSelectedNetworkId(detected.id);
        setSelectedCarrier(detected.carrier);
      }
    }
  }, [phoneNumber]);

  // --- FETCH DATA PLANS (DYNAMIC) ---
  const fetchDataPlans = async () => {
      setIsLoadingPlans(true);
      try {
          const { data, error } = await supabase.functions.invoke('affatech-proxy', {
              body: { action: 'fetch_data_plans' }
          });
          if(error) throw error;
          // Flatten data if it comes as { "1": [...], "2": [...] } or keep as array
          if(data) setAvailablePlans(data);
      } catch(e) { console.error("Fetch Plan Error", e); }
      finally { setIsLoadingPlans(false); }
  };

  useEffect(() => {
      if(productType === 'Data' && availablePlans.length === 0) {
          fetchDataPlans();
      }
  }, [productType]);

  const filteredPlans = useMemo(() => {
      // Logic to parse different API response structures
      let plansForNetwork: any[] = [];
      if (Array.isArray(availablePlans)) {
          plansForNetwork = availablePlans.filter(p => p.network == selectedNetworkId || p.network_id == selectedNetworkId);
      } else {
          // If object structure { "1": [...], ... }
          plansForNetwork = availablePlans[selectedNetworkId] || [];
      }

      return plansForNetwork.filter((plan: any) => {
          const name = (plan.plan_name || plan.name || "").toUpperCase();
          // Filter Types
          const typeMatch = selectedPlanType === 'ALL' 
              || (selectedPlanType === 'SME' && name.includes('SME'))
              || (selectedPlanType === 'CG' && (name.includes('CG') || name.includes('CORPORATE')))
              || (selectedPlanType === 'GIFTING' && (name.includes('GIFT') || !name.includes('SME') && !name.includes('CG')));
          // Filter Validity
          const validityMatch = selectedValidity === 'ALL'
              || (selectedValidity === '30' && (name.includes('30') || name.includes('MONTH')))
              || (selectedValidity === '7' && (name.includes('7') || name.includes('WEEK')))
              || (selectedValidity === '1' && (name.includes('1') || name.includes('DAY')));
          return typeMatch && validityMatch;
      });
  }, [availablePlans, selectedNetworkId, selectedPlanType, selectedValidity]);

  // --- BANKS ---
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data } = await supabase.functions.invoke('paystack-transfer', { body: { action: 'list_banks' } });
        if (data?.status) setBankList(data.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (e) { console.error("Bank Error", e); }
    };
    fetchBanks();
  }, []);

  // --- VALIDATION & COST ---
  const isFormValid = () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (productType === 'Airtime') return cleanPhone.length === 11 && Number(serviceAmount) > 0;
    if (productType === 'Data') return cleanPhone.length === 11 && selectedPlan !== null;
    if (productType === 'Cable') return smartCardNumber.length >= 10 && selectedCablePlan !== null && !customerName.includes("Invalid");
    if (productType === 'Electricity') return meterNumber.length >= 10 && Number(serviceAmount) > 0 && selectedDisco !== null && !customerName.includes("Invalid");
    if (productType === 'Exam') return selectedExam !== null && quantity > 0;
    if (productType === 'RechargePin') return Number(serviceAmount) > 0 && quantity > 0 && nameOnCard.length > 2;
    if (productType === 'AirtimeToCash') return cleanPhone.length === 11 && Number(serviceAmount) > 0;
    return false;
  };

  const calculateTotalCost = () => {
    if (productType === 'Data') return Number(selectedPlan?.amount || selectedPlan?.price);
    if (productType === 'Cable') return Number(selectedCablePlan?.amount);
    if (productType === 'Exam') return (selectedExam?.price || 0) * quantity;
    if (productType === 'RechargePin') return Number(serviceAmount) * quantity;
    return Number(serviceAmount);
  };

  /// --- VERIFY UTILITY (Updated Debug Version) ---
 // --- VERIFY UTILITY (DEBUG VERSION) ---
  const verifyCustomer = async (number: string, serviceType: 'cable' | 'electricity', providerId: number | null, mType: number = 1) => {
    if (number.length < 10 || !providerId) return;
    
    setCustomerName("Verifying...");
    
    try {
        const payload: any = { type: serviceType, number, provider: providerId };
        if (serviceType === 'electricity') payload.meter_type = mType;

        const { data, error } = await supabase.functions.invoke('affatech-proxy', {
            body: { action: 'verify_customer', payload }
        });

        if (error) throw error;

        // --- DEBUGGING LOGIC ---
        console.log("API Response:", data); // Check Console (F12)

        if (data) {
            // 1. Try to find the name automatically
            const name = data.name || 
                         data.customer_name || 
                         data.customerName ||
                         (data.content && data.content.Customer_Name) || 
                         (data.content && data.content.name) ||
                         (data.details && data.details.name);

            if (name) {
                setCustomerName(name);
            } else {
                // 2. IF NAME NOT FOUND: Show the RAW JSON on screen so we can see it
                // We truncate it to 60 chars to fit the screen
                setCustomerName("RAW: " + JSON.stringify(data).slice(0, 60) + "...");
            }
        } else {
             setCustomerName("Invalid Number");
        }
    } catch (e: any) { 
        console.error(e);
        setCustomerName("Verification Failed"); 
    }
  };

  // --- VERIFY ACCOUNT (WITHDRAWAL) ---
  useEffect(() => {
    const verifyAccount = async () => {
      if (accountNumber.length === 10 && bankCode) {
        setAccountName("Verifying...");
        try {
          const { data } = await supabase.functions.invoke('paystack-transfer', {
            body: { action: 'verify', account_number: accountNumber, bank_code: bankCode }
          });
          if (data?.status) setAccountName(data.data.account_name);
          else setAccountName("Account not found");
        } catch (e) { setAccountName("Connection Error"); }
      } else { setAccountName(""); }
    };
    verifyAccount();
  }, [accountNumber, bankCode]);

 //  PAYSTACK DEPOSIT FLOW
  // ============================================
  useEffect(() => {
      if(isDepositModalOpen && !pendingDepositRef) {
          setCurrentTxRef(`txn_${Date.now()}`);
      }
  }, [isDepositModalOpen, pendingDepositRef]);

  const paystackConfig = {
    email: user?.email,
    amount: (Number(depositAmount) || 0) * 100, 
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
    reference: currentTxRef 
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const handleStartDeposit = () => {
      if (!depositAmount || Number(depositAmount) < 100) {
        alert("Minimum deposit amount is ₦100");
        return;
      }
      setPendingDepositRef(currentTxRef);
      initializePayment(
          (response: any) => { console.log("Paystack closed/success"); }, 
          () => { console.log("Paystack closed"); }
      );
  };

  const handleVerifyDeposit = async () => {
    if (!pendingDepositRef) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-deposit', {
        body: { reference: pendingDepositRef },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      if (data.success) {
        onUpdateBalance(data.balance);
        await fetchUser();
        setPendingDepositRef(null);
        setDepositAmount("");
        setIsDepositModalOpen(false);
        fetchHistory();
        alert(`Success! Wallet funded.`);
      } 
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Verification failed. If you were debited, please contact support.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- CORE PURCHASE LOGIC ---
  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
        const cost = calculateTotalCost();
        // Skip balance check for AirtimeToCash
        if (productType !== 'AirtimeToCash' && cost > user.balance) throw new Error("Insufficient Wallet Balance");

        const cleanPhone = phoneNumber.replace(/\D/g, '');
        let action = '';
        let payload: any = {};

        if(productType === 'Airtime') { action = 'buy_airtime'; payload = { network: selectedNetworkId, phone: cleanPhone, amount: cost }; }
        else if (productType === 'Data') { action = 'buy_data'; payload = { network: selectedNetworkId, phone: cleanPhone, plan_id: selectedPlan?.id || selectedPlan?.plan_id }; }
        else if (productType === 'Cable') { action = 'buy_cable'; payload = { provider: selectedCableProvider, iuc: smartCardNumber, plan_id: selectedCablePlan.id }; }
        else if (productType === 'Electricity') { action = 'buy_electricity'; payload = { disco: selectedDisco, meter: meterNumber, amount: cost, meter_type: meterType }; }
        else if (productType === 'Exam') { action = 'buy_epin'; payload = { exam_name: selectedExam.id, quantity: quantity }; }
        else if (productType === 'RechargePin') { action = 'buy_recharge_pin'; payload = { network: selectedNetworkId, amount: serviceAmount, quantity: quantity, name_on_card: nameOnCard }; }
        else if (productType === 'AirtimeToCash') { 
            action = 'airtime_to_cash'; 
            payload = { network: selectedNetworkId, phone: cleanPhone, amount: serviceAmount }; 
        }

        const { data, error } = await supabase.functions.invoke('affatech-proxy', { body: { action, payload } });
        if (error) throw new Error(error.message);

        // 1. HANDLE AIRTIME TO CASH SUCCESS
        if (productType === 'AirtimeToCash') {
             // Show instruction from API response
             const instruction = data.message || data.api_response || "Proceed to transfer airtime manually.";
             setAirtimeToCashInfo({ message: instruction, amount: serviceAmount });
             setIsConfirming(false); // Close confirm modal
             // Don't deduct balance or log success yet, user has to transfer manually
             return; 
        }

        // 2. HANDLE STANDARD SUCCESS
        if (data && (data.status === 'success' || data.success === 'true' || data.Status === 'successful')) {
            const newBal = user.balance - cost;
            await dbService.updateBalance(user.email, newBal);
            onUpdateBalance(newBal);
            
            await dbService.addTransaction({
                user_email: user.email, type: productType, amount: cost, status: 'Success', ref: `TRX-${Date.now()}`
            });

            fetchHistory();
            alert(`Transaction Successful!`);
            setIsConfirming(false);
            // Reset
            setPhoneNumber(''); setServiceAmount(''); setSmartCardNumber(''); setMeterNumber(''); setQuantity(1); setSelectedPlan(null); setSelectedCablePlan(null);
        } else {
            throw new Error(data?.message || "Transaction Failed from Provider");
        }
    } catch (e: any) { alert(e.message || "System Error"); } 
    finally { setIsProcessing(false); }
  };

  const handleWithdrawal = async () => {
     if(Number(withdrawAmount) > user.balance) return alert("Insufficient Funds");
     setIsProcessing(true);
     try {
        const { data } = await supabase.functions.invoke('paystack-transfer', {
            body: { action: 'transfer', email: user.email, amount: Number(withdrawAmount), bank_code: bankCode, account_number: accountNumber, account_name: accountName }
        });
        if(data?.status) {
            await fetchUser(); setIsWithdrawModalOpen(false); setWithdrawAmount('');
            alert("Withdrawal Successful!");
        } else { alert(data?.message || "Failed."); }
     } catch(e: any) { alert(e.message); }
     finally { setIsProcessing(false); }
  };

  const renderServiceInputs = () => {
    switch (productType) {
        case 'Airtime':
        case 'Data':
            return (
                <>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        {CARRIERS.map(c => (
                            <button key={c.id} onClick={() => { setSelectedCarrier(c.id); setSelectedNetworkId(Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id))); }} className={`aspect-square rounded-2xl flex items-center justify-center border-2 transition-all ${selectedCarrier === c.id ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50'}`}>
                                <img src={c.logo} className="w-8 h-8 object-contain rounded-full" />
                            </button>
                        ))}
                    </div>
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none mb-4" placeholder="Phone Number (080...)" />
                    {productType === 'Data' ? (
                         <>
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                                {['ALL', 'SME', 'CG', 'GIFTING'].map(t => <button key={t} onClick={()=>setSelectedPlanType(t)} className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${selectedPlanType===t?'bg-emerald-600 text-white':'bg-slate-100'}`}>{t}</button>)}
                                <div className="w-[1px] bg-slate-300 h-4 self-center mx-1"></div>
                                {['ALL', '30', '7', '1'].map(v => <button key={v} onClick={()=>setSelectedValidity(v)} className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${selectedValidity===v?'bg-orange-500 text-white':'bg-slate-100'}`}>{v} D</button>)}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                                {filteredPlans.length === 0 ? <p className="text-center text-xs text-slate-400 py-4">{isLoadingPlans ? <Loader2 className="animate-spin mx-auto"/> : "No plans found."}</p> : 
                                filteredPlans.map((p: any) => (
                                    <button key={p.id || p.plan_id} onClick={() => setSelectedPlan(p)} className={`w-full p-4 flex justify-between rounded-2xl border-2 transition-all ${selectedPlan?.id === p.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>
                                        <div className="text-left"><span className="block font-bold text-xs">{p.plan_name || p.name}</span><span className="text-[10px] text-slate-400 font-bold">{p.validity}</span></div><span className="font-black text-emerald-600 text-sm">₦{p.amount || p.price}</span>
                                    </button>
                                ))}
                            </div>
                         </>
                    ) : (
                        <>
                            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">{PREFILLED_AMOUNTS.map(amt => <button key={amt} onClick={() => setServiceAmount(amt.toString())} className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 border border-slate-200">₦{amt.toLocaleString()}</button>)}</div>
                            <input type="number" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
                        </>
                    )}
                </>
            );
        case 'Cable':
            return (
                <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto">
                        {CABLE_PROVIDERS.map(p => <button key={p.id} onClick={() => { setSelectedCableProvider(p.id); setSelectedCablePlan(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border-2 ${selectedCableProvider === p.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>{p.name}</button>)}
                    </div>
                    <input type="text" value={smartCardNumber} onChange={e => { setSmartCardNumber(e.target.value); if(e.target.value.length >= 10) verifyCustomer(e.target.value, 'cable', selectedCableProvider); }} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="IUC Number" />
                    {customerName && <p className={`text-[10px] font-bold px-2 ${customerName.includes("Invalid") ? "text-red-500" : "text-emerald-500"}`}>{customerName}</p>}
                    <div className="relative">
                        <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none" onChange={(e) => setSelectedCablePlan(JSON.parse(e.target.value))}>
                            <option value="">Select Plan</option>
                            {CABLE_PLANS[selectedCableProvider]?.map((p: any) => <option key={p.id} value={JSON.stringify(p)}>{p.name} - ₦{p.amount.toLocaleString()}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>
            );
        case 'Electricity':
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                        {DISCOS.map(d => (
                            <button key={d.id} onClick={() => { setSelectedDisco(d.id); if(meterNumber.length >= 10) verifyCustomer(meterNumber, 'electricity', d.id, meterType); }} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${selectedDisco === d.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-white'}`}>
                                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500 mb-1">{d.name.substring(0,2)}</div>
                                <span className="text-[8px] font-bold">{d.short}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setMeterType(1); if(meterNumber && selectedDisco) verifyCustomer(meterNumber, 'electricity', selectedDisco, 1); }} className={`flex-1 p-3 rounded-xl font-bold text-xs border-2 ${meterType === 1 ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>Prepaid</button>
                        <button onClick={() => { setMeterType(2); if(meterNumber && selectedDisco) verifyCustomer(meterNumber, 'electricity', selectedDisco, 2); }} className={`flex-1 p-3 rounded-xl font-bold text-xs border-2 ${meterType === 2 ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>Postpaid</button>
                    </div>
                    <input type="text" value={meterNumber} onChange={e => { setMeterNumber(e.target.value); if(e.target.value.length >= 10 && selectedDisco) verifyCustomer(e.target.value, 'electricity', selectedDisco, meterType); }} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Meter Number" />
                    {customerName && <p className={`text-[10px] font-bold px-2 ${customerName.includes("Invalid") ? "text-red-500" : "text-emerald-500"}`}>{customerName}</p>}
                    <input type="number" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
                </div>
            );
        case 'Exam':
            return (
                <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto">{EXAM_TYPES.map(e => <button key={e.id} onClick={() => setSelectedExam(e)} className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs whitespace-nowrap border-2 ${selectedExam?.id === e.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>{e.id}</button>)}</div>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-slate-500">Qty:</span>
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 bg-white rounded-full shadow font-black">-</button>
                        <span className="font-black text-xl">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 bg-white rounded-full shadow font-black">+</button>
                    </div>
                    {selectedExam && <p className="text-center font-black text-emerald-600 text-xl">Total: ₦{(selectedExam.price * quantity).toLocaleString()}</p>}
                </div>
            );
        case 'RechargePin':
            return (
                <div className="space-y-4">
                     <div className="grid grid-cols-4 gap-3 mb-4">
                        {CARRIERS.map(c => <button key={c.id} onClick={() => { setSelectedCarrier(c.id); setSelectedNetworkId(Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id))); }} className={`aspect-square rounded-2xl flex items-center justify-center border-2 transition-all ${selectedCarrier === c.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}><img src={c.logo} className="w-8 h-8 object-contain rounded-full" /></button>)}
                    </div>
                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2">{RECHARGE_AMOUNTS.map(amt => <button key={amt} onClick={() => setServiceAmount(amt.toString())} className={`px-3 py-2 rounded-xl text-xs font-bold border ${serviceAmount === amt.toString() ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>₦{amt}</button>)}</div>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-slate-500">Qty:</span>
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 bg-white rounded-full shadow font-black">-</button>
                        <span className="font-black text-xl">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 bg-white rounded-full shadow font-black">+</button>
                    </div>
                    <input type="text" value={nameOnCard} onChange={e => setNameOnCard(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Name on Card" />
                    {Number(serviceAmount) > 0 && <p className="text-center font-black text-emerald-600 text-xl">Total: ₦{(Number(serviceAmount) * quantity).toLocaleString()}</p>}
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* 1. WALLET */}
      <section className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl relative">
         <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Available Balance</p>
            <button onClick={() => { setIsRefreshingBalance(true); setTimeout(() => setIsRefreshingBalance(false), 1000); fetchUser(); }} className="p-2 bg-emerald-700/50 rounded-full"><RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""}/></button>
         </div>
         <h2 className="text-4xl font-black mb-6">{isBalanceVisible ? `₦${user.balance.toLocaleString()}` : '••••••••'}</h2>
         <div className="flex gap-3">
            <button onClick={() => setIsDepositModalOpen(true)} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2"><CreditCard size={16}/> Fund</button>
            <button onClick={() => setIsWithdrawModalOpen(true)} className="flex-1 bg-emerald-700 border border-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase">Withdraw</button>
         </div>
      </section>

      {/* 2. SERVICES */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[
            { id: 'Airtime', icon: <Smartphone size={18}/> }, { id: 'Data', icon: <Zap size={18}/> }, { id: 'Cable', icon: <Tv size={18}/> }, 
            { id: 'Electricity', icon: (<div className="relative"><Building2 size={18} /><Zap size={10} className="absolute -top-1 -right-1 text-yellow-500 fill-yellow-500" /></div>) },
            { id: 'Exam', icon: <GraduationCap size={18}/> }, { id: 'RechargePin', icon: <Printer size={18}/> }
        ].map((s:any) => (
            <button key={s.id} onClick={() => { setProductType(s.id as ProductType); setServiceAmount(''); setIsConfirming(false); }} className={`flex flex-col items-center py-4 rounded-xl transition-all ${productType === s.id ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}>
                {s.icon} <span className="text-[9px] font-black uppercase mt-1">{s.id}</span>
            </button>
        ))}
      </div>

      {/* 3. AIRTIME TO CASH */}
      <button onClick={() => setProductType('AirtimeToCash')} className={`w-full p-5 rounded-[25px] flex items-center justify-between border-2 transition-all ${productType === 'AirtimeToCash' ? 'bg-orange-50 border-orange-500' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4"><div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><ArrowLeftRight size={22} /></div><div className="text-left"><h3 className="font-black text-sm uppercase">Airtime to Cash</h3><p className="text-[10px] text-slate-400 font-bold">Swap Airtime for Cash</p></div></div>
          <ArrowRight size={20} className={`${productType === 'AirtimeToCash' ? 'text-orange-600' : 'text-slate-300'}`}/>
      </button>

      {/* 4. MAIN FORM */}
      <section className="bg-white dark:bg-slate-800 p-5 rounded-[30px] shadow-sm border border-slate-100 dark:border-slate-800">
         <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-4">{productType === 'AirtimeToCash' ? 'Swap Details' : `${productType} Details`}</h3>
         
         {productType === 'AirtimeToCash' ? (
             <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">{CARRIERS.map(c => <button key={c.id} onClick={() => setSelectedNetworkId(Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id)))} className={`p-2 rounded-xl border-2 ${selectedNetworkId === Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id)) ? 'border-orange-500 bg-orange-50' : 'border-slate-100'}`}><img src={c.logo} className="w-6 h-6 mx-auto rounded-full"/></button>)}</div>
                <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Sender Phone Number" />
                <input type="number" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Amount to Sell (₦)" />
                {Number(serviceAmount) > 0 && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex justify-between items-center"><span className="text-xs font-bold">You Receive:</span><span className="text-xl font-black">₦{(Number(serviceAmount) * 0.85).toFixed(0)}</span></div>}
             </div>
         ) : renderServiceInputs()}

         <button onClick={() => setIsConfirming(true)} disabled={!isFormValid()} className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50">Proceed</button>
      </section>

      {/* 5. HISTORY */}
      <div className="pt-2">
         <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-3 ml-2">Recent Activity</h3>
         <div className="space-y-2">
            {history.length === 0 ? <p className="text-center text-xs text-slate-300 py-4">No recent activity</p> : history.map((tx: any) => (
                <div key={tx.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${tx.type === 'Deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{tx.type === 'Deposit' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}</div>
                        <div><p className="font-bold text-xs">{tx.type}</p><p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p></div>
                    </div>
                    <span className={`font-black text-xs ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-slate-900'}`}>{tx.type === 'Deposit' ? '+' : '-'}₦{tx.amount}</span>
                </div>
            ))}
         </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. DEPOSIT MODAL */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
                <button onClick={() => { setIsDepositModalOpen(false); setPendingDepositRef(null); }} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={16}/></button>
                <h3 className="text-xl font-black text-center mb-6">Fund Wallet</h3>
                {!pendingDepositRef ? (
                    <>
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">{PREFILLED_AMOUNTS.map(amt => <button key={amt} onClick={() => setDepositAmount(amt.toString())} className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 border border-slate-200">₦{amt.toLocaleString()}</button>)}</div>
                    <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border-2 border-transparent focus:border-emerald-500" placeholder="Amount (₦)" />
                    <button onClick={handleStartDeposit} disabled={!depositAmount} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50">Pay Securely</button>
                    </>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl mb-2"><p className="text-xs text-emerald-800 font-bold mb-1">Payment Detected!</p><p className="text-[10px] text-emerald-600">Please confirm to update your wallet.</p></div>
                        <button onClick={handleVerifyDeposit} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase flex justify-center items-center gap-2">{isProcessing ? <Loader2 className="animate-spin"/> : "Confirm Payment & Update Wallet"}</button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* 2. CONFIRMATION MODAL */}
      {isConfirming && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 text-center shadow-2xl">
              <h3 className="font-black uppercase mb-2 text-sm text-slate-400">Confirm Transaction</h3>
              <p className="text-3xl font-black text-emerald-600 mb-2">₦{calculateTotalCost().toLocaleString()}</p>
              <p className="text-xs font-bold mb-6 text-slate-500">{productType} - {phoneNumber || smartCardNumber || meterNumber}</p>
              <button onClick={handlePurchase} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase">{isProcessing ? <Loader2 className="animate-spin mx-auto"/> : "Confirm & Pay"}</button>
              <button onClick={() => setIsConfirming(false)} className="mt-4 text-slate-400 font-bold uppercase text-[10px]">Cancel</button>
            </div>
         </div>
      )}

      {/* 3. AIRTIME TO CASH INSTRUCTION MODAL */}
      {airtimeToCashInfo && (
         <div className="fixed inset-0 bg-emerald-900/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 text-center shadow-2xl relative">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
              <h3 className="font-black uppercase mb-2 text-lg text-emerald-800">Request Initiated</h3>
              <div className="bg-slate-50 p-4 rounded-2xl text-left mb-6 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Instruction</p>
                  <p className="text-sm font-medium text-slate-700 mb-4">{airtimeToCashInfo.message}</p>
                  <div className="p-3 bg-white rounded-xl border border-dashed border-emerald-300">
                      <p className="text-xs font-black text-center text-emerald-600">Please Transfer Manually</p>
                  </div>
              </div>
              <button onClick={() => setAirtimeToCashInfo(null)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase">I Have Transferred</button>
            </div>
         </div>
      )}

      {/* 4. WITHDRAW MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative space-y-4">
              <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={16}/></button>
              <h3 className="text-xl font-black text-center">Withdraw Funds</h3>
              <select value={bankCode} onChange={e => setBankCode(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-bold outline-none"><option value="">Select Bank</option>{bankList.map((b) => <option key={b.id} value={b.code}>{b.name}</option>)}</select>
              <input type="text" maxLength={10} value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="Account Number" />
              {accountName && <p className={`text-[10px] font-black uppercase px-2 ${accountName.includes("Error") ? "text-red-500" : "text-emerald-500"}`}>{accountName}</p>}
              <div className="flex gap-2 mb-2 overflow-x-auto pb-2">{PREFILLED_AMOUNTS.map(amt => <button key={amt} onClick={() => setWithdrawAmount(amt.toString())} className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 whitespace-nowrap border border-slate-200">₦{amt.toLocaleString()}</button>)}</div>
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
              <button onClick={handleWithdrawal} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase flex justify-center">{isProcessing ? <Loader2 className="animate-spin"/> : "Confirm Withdraw"}</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;