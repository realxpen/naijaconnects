import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, Tv, Zap, ArrowRight, ArrowLeftRight, X, Loader2, RotateCcw,
  TrendingUp, TrendingDown, CreditCard, GraduationCap, Printer, Building2, ChevronDown
} from 'lucide-react';
import { usePaystackPayment } from 'react-paystack';
import { dbService } from '../services/dbService';
// Constants imported locally or from file. Removing CABLE imports as we define them locally now.
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

// --- 1. UPDATED CABLE PROVIDERS (Specific IDs for Affatech) ---
const CABLE_PROVIDERS = [
    { id: 1, name: 'GOTV' },
    { id: 2, name: 'DSTV' },
    { id: 3, name: 'STARTIMES' }
];

// --- 2. UPDATED CABLE PLANS (Hardcoded to match API IDs) ---
const CABLE_PLANS: any = {
    // 1 = GOTV
    1: [
        { id: 34, name: "GOtv Smallie - Monthly", amount: 1900 },
        { id: 16, name: "GOtv Jinja - Monthly", amount: 3900 },
        { id: 17, name: "GOtv Jolli - Monthly", amount: 5800 },
        { id: 2,  name: "GOtv Max - Monthly", amount: 8500 },
        { id: 47, name: "GOtv Supa - Monthly", amount: 11400 },
        { id: 49, name: "GOtv Super Plus - Monthly", amount: 16800 },
    ],
    // 2 = DSTV
    2: [
        { id: 20, name: "DStv Padi - Monthly", amount: 4400 },
        { id: 28, name: "DStv Padi + ExtraView", amount: 10400 },
        { id: 6,  name: "DStv Yanga - Monthly", amount: 6000 },
        { id: 27, name: "DStv Yanga + ExtraView", amount: 12000 },
        { id: 19, name: "DStv Confam - Monthly", amount: 11000 },
        { id: 26, name: "DStv Confam + ExtraView", amount: 17000 },
        { id: 7,  name: "DStv Compact - Monthly", amount: 19000 },
        { id: 29, name: "DStv Compact + Extra View", amount: 25000 },
        { id: 8,  name: "DStv Compact Plus - Monthly", amount: 30000 },
        { id: 31, name: "DStv Compact Plus - Extra View", amount: 36000 },
        { id: 9,  name: "DStv Premium - Monthly", amount: 44500 },
        { id: 30, name: "DStv Premium + Extra View", amount: 50500 },
        { id: 24, name: "DStv Premium French", amount: 25550 },
        { id: 25, name: "DStv Premium Asia", amount: 20500 },
    ],
    // 3 = STARTIMES
    3: [
        { id: 37, name: "Nova - 1 Week", amount: 600 },
        { id: 14, name: "Nova - 1 Month", amount: 1900 },
        { id: 38, name: "Basic - 1 Week", amount: 1250 },
        { id: 50, name: "Basic - 1 Month", amount: 3700 },
        { id: 40, name: "Classic - 1 Week", amount: 1900 },
        { id: 11, name: "Classic - 1 Month", amount: 6200 },
        { id: 41, name: "Super - 1 Week", amount: 3000 },
        { id: 15, name: "Super - 1 Month", amount: 8800 },
        { id: 51, name: "Smart (Dish) - 1 Month", amount: 4200 },
        { id: 48, name: "Special - 1 Month", amount: 5650 },
        { id: 5,  name: "Asian Bouquet", amount: 20295 },
    ]
};

// --- DISCOS ---
const DISCOS = [
    { id: 1, name: 'Ikeja Electric (IKEDC)' },
    { id: 2, name: 'Eko Electric (EKEDC)' },
    { id: 3, name: 'Abuja Electric (AEDC)' },
    { id: 4, name: 'Kano Electric (KEDCO)' },
    { id: 5, name: 'Enugu Electric (EEDC)' },
    { id: 6, name: 'Port Harcourt (PHED)' },
    { id: 7, name: 'Ibadan Electric (IBEDC)' },
    { id: 8, name: 'Kaduna Electric (KAEDCO)' },
    { id: 9, name: 'Jos Electric (JED)' },
    { id: 10, name: 'Benin Electric (BEDC)' },
    { id: 11, name: 'Yola Electric (YEDC)' },
];

const EXAM_TYPES = [
    { id: 'WAEC', name: 'WAEC Result Checker', price: 3800 },
    { id: 'NECO', name: 'NECO Result Checker', price: 1500 },
    { id: 'NABTEB', name: 'NABTEB Result Checker', price: 1200 },
];

const MANUAL_DATA_PLANS = [
    // ... (Keep existing manual data plans) ...
    { id: 378, network: 1, plan_name: "500MB SME (30 Days)", amount: 400, validity: "30 Days", type: "SME" },
    { id: 403, network: 1, plan_name: "1GB SME (30 Days)", amount: 600, validity: "30 Days", type: "SME" },
    { id: 402, network: 1, plan_name: "2GB SME (30 Days)", amount: 1100, validity: "30 Days", type: "SME" },
    { id: 44,  network: 1, plan_name: "3GB SME (30 Days)", amount: 1600, validity: "30 Days", type: "SME" },
    { id: 8,   network: 1, plan_name: "5GB SME (30 Days)", amount: 2150, validity: "30 Days", type: "SME" },
    { id: 223, network: 1, plan_name: "10GB SME (30 Days)", amount: 4700, validity: "30 Days", type: "SME" },
    { id: 213, network: 1, plan_name: "1GB Corporate (30 Days)", amount: 650, validity: "30 Days", type: "CG" },
    { id: 214, network: 1, plan_name: "2GB Corporate (30 Days)", amount: 1100, validity: "30 Days", type: "CG" },
    { id: 216, network: 1, plan_name: "5GB Corporate (30 Days)", amount: 2100, validity: "30 Days", type: "CG" },
    { id: 268, network: 2, plan_name: "500MB CG (30 Days)", amount: 250, validity: "30 Days", type: "CG" },
    { id: 269, network: 2, plan_name: "1GB CG (30 Days)", amount: 500, validity: "30 Days", type: "CG" },
    { id: 270, network: 2, plan_name: "2GB CG (30 Days)", amount: 950, validity: "30 Days", type: "CG" },
    { id: 271, network: 2, plan_name: "3GB CG (30 Days)", amount: 1450, validity: "30 Days", type: "CG" },
    { id: 273, network: 2, plan_name: "5GB CG (30 Days)", amount: 2400, validity: "30 Days", type: "CG" },
    { id: 272, network: 2, plan_name: "10GB CG (30 Days)", amount: 4600, validity: "30 Days", type: "CG" },
    { id: 405, network: 3, plan_name: "1GB Gifting (7 Days)", amount: 950, validity: "7 Days", type: "GIFTING" },
    { id: 395, network: 3, plan_name: "2GB Gifting (30 Days)", amount: 1650, validity: "30 Days", type: "GIFTING" },
    { id: 397, network: 3, plan_name: "8GB Gifting (30 Days)", amount: 3200, validity: "30 Days", type: "GIFTING" },
    { id: 277, network: 4, plan_name: "1GB CG (30 Days)", amount: 450, validity: "30 Days", type: "CG" },
    { id: 279, network: 4, plan_name: "2GB CG (30 Days)", amount: 850, validity: "30 Days", type: "CG" },
    { id: 280, network: 4, plan_name: "3GB CG (30 Days)", amount: 1250, validity: "30 Days", type: "CG" },
];

const detectNetwork = (phone: string) => {
  const p = phone.replace(/\D/g, '').slice(0, 4);
  const MTN_PREFIXES = ['0803','0806','0703','0706','0813','0816','0810','0814','0903','0906','0913','0916'];
  const GLO_PREFIXES = ['0805','0807','0705','0815','0811','0905','0915'];
  const AIRTEL_PREFIXES = ['0802','0808','0708','0812','0902','0907','0901','0904'];
  const ETISALAT_PREFIXES = ['0809','0818','0817','0909','0908'];

  if (MTN_PREFIXES.includes(p)) return { id: 1, carrier: Carrier.MTN };
  if (GLO_PREFIXES.includes(p)) return { id: 2, carrier: Carrier.GLO };
  if (AIRTEL_PREFIXES.includes(p)) return { id: 3, carrier: Carrier.AIRTEL };
  if (ETISALAT_PREFIXES.includes(p)) return { id: 4, carrier: Carrier.ETISALAT };
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ user, onUpdateBalance }) => {
  // --- UI STATES ---
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [productType, setProductType] = useState<ProductType>('Airtime');
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // --- DATA PLAN STATES ---
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlanType, setSelectedPlanType] = useState<string>('ALL');
  const [selectedValidity, setSelectedValidity] = useState<string>('ALL');

  // --- DEPOSIT STATES ---
  const [pendingDepositRef, setPendingDepositRef] = useState<string | null>(null);
  const [currentTxRef, setCurrentTxRef] = useState<string>(`txn_${Date.now()}`);

  // --- INPUT STATES ---
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [serviceAmount, setServiceAmount] = useState(''); 
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Service Specifics
  const [selectedNetworkId, setSelectedNetworkId] = useState<number>(1);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier>(Carrier.MTN);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  
  // Cable & Electric
  const [smartCardNumber, setSmartCardNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCableProvider, setSelectedCableProvider] = useState(1);
  const [selectedCablePlan, setSelectedCablePlan] = useState<any>(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [selectedDisco, setSelectedDisco] = useState<number>(1);
  const [meterType, setMeterType] = useState(1); // 1 = Prepaid, 2 = Postpaid

  // Exam & Recharge Pin
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [nameOnCard, setNameOnCard] = useState('');

  // Bank Withdrawal
  const [bankList, setBankList] = useState<{name: string, code: string, id: number}[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // --- HELPER: REFRESH USER DATA ---
  const fetchUser = async () => {
    try {
      const { data } = await supabase.from("profiles").select("balance").eq("email", user.email).single();
      if (data) onUpdateBalance(data.balance);
    } catch (e) { console.error("Error fetching profile:", e); }
  };

  // --- FETCH HISTORY ---
  const fetchHistory = async () => {
    try {
      const { data } = await supabase.from('transactions').select('*').eq('user_email', user.email).order('created_at', { ascending: false }).limit(5);
      if(data) setHistory(data);
    } catch(e) { console.error("History error", e); }
  };

  useEffect(() => { fetchHistory(); fetchUser(); }, [user.email]);

  // --- AUTO DETECT NETWORK ---
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

  // --- LOAD MANUAL PLANS ---
  useEffect(() => {
      if(productType === 'Data') {
          setAvailablePlans(MANUAL_DATA_PLANS);
      }
  }, [productType]);

  // --- FILTER PLANS LOGIC ---
  const filteredPlans = useMemo(() => {
      const plansForNetwork = availablePlans.filter(p => p.network == selectedNetworkId);

      return plansForNetwork.filter((plan: any) => {
          const type = (plan.type || "").toUpperCase();
          const typeMatch = selectedPlanType === 'ALL' 
              || (selectedPlanType === 'SME' && type === 'SME')
              || (selectedPlanType === 'CG' && type === 'CG')
              || (selectedPlanType === 'GIFTING' && type === 'GIFTING');

          const validityMatch = selectedValidity === 'ALL'
              || (selectedValidity === '30' && plan.validity.includes('30'))
              || (selectedValidity === '7' && plan.validity.includes('7'))
              || (selectedValidity === '1' && plan.validity.includes('1'));

          return typeMatch && validityMatch;
      });
  }, [availablePlans, selectedNetworkId, selectedPlanType, selectedValidity]);

  // --- FETCH LIVE BANKS ---
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data } = await supabase.functions.invoke('paystack-transfer', { body: { action: 'list_banks' } });
        if (data?.status) setBankList(data.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (e) { console.error("Failed to load banks"); }
    };
    fetchBanks();
  }, []);

  // --- VALIDATION HELPER ---
  const isFormValid = () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (productType === 'Airtime') return cleanPhone.length === 11 && Number(serviceAmount) > 0;
    if (productType === 'Data') return cleanPhone.length === 11 && selectedPlan !== null;
    if (productType === 'Cable') return smartCardNumber.length >= 10 && selectedCablePlan !== null && !customerName.includes("Invalid");
    if (productType === 'Electricity') return meterNumber.length >= 10 && Number(serviceAmount) > 0 && !customerName.includes("Invalid");
    if (productType === 'Exam') return selectedExam !== null && quantity > 0;
    if (productType === 'RechargePin') return Number(serviceAmount) > 0 && quantity > 0 && nameOnCard.length > 2;
    if (productType === 'AirtimeToCash') return cleanPhone.length === 11 && Number(serviceAmount) > 0;
    return false;
  };

  // --- CALCULATE COST HELPER ---
  const calculateTotalCost = () => {
    if (productType === 'Data') return Number(selectedPlan?.amount);
    if (productType === 'Cable') return Number(selectedCablePlan?.amount); // ADDED
    if (productType === 'Exam') return (selectedExam?.price || 0) * quantity;
    if (productType === 'RechargePin') return Number(serviceAmount) * quantity;
    return Number(serviceAmount);
  };

  // --- VERIFY CUSTOMER (METER / IUC) ---
  const verifyCustomer = async (number: string, serviceType: 'cable' | 'electricity', providerId: number, mType: number = 1) => {
    if(number.length < 10) return;
    setCustomerName("Verifying...");
    try {
        let payload: any = {};
        if (serviceType === 'electricity') {
            payload = { type: 'electricity', number: number, provider: providerId, meter_type: mType };
        } else {
            // New Cable Payload: type=cable, number=iuc, provider=cablename_id
            payload = { type: 'cable', number: number, provider: providerId };
        }

        const { data } = await supabase.functions.invoke('affatech-proxy', {
            body: { action: 'verify_customer', payload }
        });
        
        // Handle various response shapes
        if(data && (data.name || data.customer_name || (data.content && data.content.Customer_Name))) {
             setCustomerName(data.name || data.customer_name || data.content.Customer_Name);
        } else if (data && data.description) {
             setCustomerName(data.description);
        } else {
             setCustomerName("Invalid Number");
        }
    } catch(e) { setCustomerName("Verification Failed"); }
  };

  // --- VERIFY BANK ACCOUNT (WITHDRAWAL) ---
  useEffect(() => {
    const verifyAccount = async () => {
      if (accountNumber.length === 10 && bankCode) {
        setAccountName("Verifying...");
        try {
          const { data, error } = await supabase.functions.invoke('paystack-transfer', {
            body: { action: 'verify', account_number: accountNumber, bank_code: bankCode }
          });
          if (error) throw error;
          if (data?.status) setAccountName(data.data.account_name);
          else setAccountName(data?.message || "Account not found");
        } catch (e) { setAccountName("Connection Error"); }
      } else { setAccountName(""); }
    };
    verifyAccount();
  }, [accountNumber, bankCode]);

  // ============================================
  //  PAYSTACK DEPOSIT FLOW
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

  // --- PURCHASE EXECUTION (AFFATECH) ---
  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
        const cost = calculateTotalCost();
        if (cost > user.balance) throw new Error("Insufficient Wallet Balance");

        const cleanPhone = phoneNumber.replace(/\D/g, '');
        let action = '';
        let payload: any = {};

        if(productType === 'Airtime') { 
            action = 'buy_airtime'; 
            payload = { network: selectedNetworkId, phone: cleanPhone, amount: cost }; 
        }
        else if (productType === 'Data') { 
            action = 'buy_data'; 
            payload = { network: selectedNetworkId, phone: cleanPhone, plan_id: selectedPlan?.id }; 
        }
        else if (productType === 'Cable') { 
            action = 'buy_cable'; 
            // Docs: { "cablename": id, "cableplan": id, "smart_card_number": meter }
            payload = { 
                provider: selectedCableProvider, 
                iuc: smartCardNumber, 
                plan_id: selectedCablePlan.id 
            }; 
        }
        else if (productType === 'Electricity') { 
            action = 'buy_electricity'; 
            payload = { 
                disco: selectedDisco, 
                meter_number: meterNumber, 
                amount: cost, 
                meter_type: meterType 
            }; 
        }
        else if (productType === 'Exam') {
            action = 'buy_epin';
            payload = { exam_name: selectedExam.id, quantity: quantity };
        }
        else if (productType === 'RechargePin') {
            action = 'buy_recharge_pin';
            payload = { network: selectedNetworkId, amount: serviceAmount, quantity: quantity, name_on_card: nameOnCard };
        }

        const { data, error } = await supabase.functions.invoke('affatech-proxy', { body: { action, payload } });
        if (error) throw new Error(error.message);

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
            setPhoneNumber(''); setServiceAmount(''); setSmartCardNumber(''); setMeterNumber(''); setQuantity(1); setNameOnCard(''); setSelectedPlan(null);
        } else {
            throw new Error(data?.message || "Transaction Failed from Provider");
        }
    } catch (e: any) { alert(e.message || "System Error"); } 
    finally { setIsProcessing(false); }
  };

  // --- WITHDRAWAL EXECUTION ---
  const handleWithdrawal = async () => {
     if(!accountName || accountName.includes("Error") || accountName.includes("not found")) return alert("Invalid Account");
     if(Number(withdrawAmount) > user.balance) return alert("Insufficient Funds");
     
     setIsProcessing(true);
     try {
        const { data, error } = await supabase.functions.invoke('paystack-transfer', {
            body: { email: user.email, amount: Number(withdrawAmount), bank_code: bankCode, account_number: accountNumber, account_name: accountName }
        });
        if (error) throw error;

        if(data?.status) {
            const newBal = user.balance - Number(withdrawAmount);
            await dbService.updateBalance(user.email, newBal);
            onUpdateBalance(newBal);
            
            await dbService.addTransaction({
                user_email: user.email, type: 'Withdrawal', amount: Number(withdrawAmount), status: 'Success', ref: `WD-${Date.now()}`
            });

            fetchHistory();
            setIsWithdrawModalOpen(false); setWithdrawAmount(''); setAccountNumber(''); setAccountName('');
            alert("Withdrawal Successful! Funds sent.");
        } else { alert(data?.message || "Withdrawal Failed."); }
     } catch(e: any) { alert(`System Error: ${e.message}`); }
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
                                <div className="flex gap-2">
                                    {['ALL', 'SME', 'CG', 'GIFTING'].map(type => (
                                        <button key={type} onClick={() => setSelectedPlanType(type)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border whitespace-nowrap ${selectedPlanType === type ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{type}</button>
                                    ))}
                                </div>
                                <div className="w-[1px] bg-slate-300 h-6 self-center mx-1"></div>
                                <div className="flex gap-2">
                                    {['ALL', '30', '7', '1'].map(val => (
                                        <button key={val} onClick={() => setSelectedValidity(val)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border whitespace-nowrap ${selectedValidity === val ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{val === 'ALL' ? 'Any Time' : `${val} Days`}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                                {filteredPlans.length === 0 ? <p className="text-center text-xs text-slate-400 py-4">No plans found for this filter.</p> : 
                                filteredPlans.map((p: any) => (
                                    <button key={p.id} onClick={() => setSelectedPlan(p)} className={`w-full p-4 flex justify-between rounded-2xl border-2 transition-all ${selectedPlan?.id === p.id ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50'}`}>
                                        <div className="text-left">
                                            <span className="block font-bold text-xs">{p.plan_name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">{p.validity}</span>
                                        </div>
                                        <span className="font-black text-emerald-600 text-sm">₦{p.amount}</span>
                                    </button>
                                ))}
                            </div>
                         </>
                    ) : (
                        <>
                            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                                {PREFILLED_AMOUNTS.map(amt => (
                                    <button key={amt} onClick={() => setServiceAmount(amt.toString())} className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 whitespace-nowrap border border-slate-200">₦{amt.toLocaleString()}</button>
                                ))}
                            </div>
                            <input type="number" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
                        </>
                    )}
                </>
            );
        case 'Cable':
            return (
                <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto">
                        {CABLE_PROVIDERS.map(p => <button key={p.id} onClick={() => { setSelectedCableProvider(p.id); setSelectedCablePlan(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs whitespace-nowrap border-2 ${selectedCableProvider === p.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>{p.name}</button>)}
                    </div>
                    <input type="text" value={smartCardNumber} onChange={e => { setSmartCardNumber(e.target.value); if(e.target.value.length >= 10) verifyCustomer(e.target.value, 'cable', selectedCableProvider); }} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Smart Card / IUC Number" />
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
                    <div className="relative">
                        <select 
                            value={selectedDisco} 
                            onChange={e => {
                                const newDisco = Number(e.target.value);
                                setSelectedDisco(newDisco);
                                if(meterNumber.length >= 10) verifyCustomer(meterNumber, 'electricity', newDisco, meterType);
                            }} 
                            className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none"
                        >
                            {DISCOS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setMeterType(1); if(meterNumber.length >= 10) verifyCustomer(meterNumber, 'electricity', selectedDisco, 1); }} 
                            className={`flex-1 p-3 rounded-xl font-bold text-xs border-2 ${meterType === 1 ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}
                        >
                            Prepaid
                        </button>
                        <button 
                            onClick={() => { setMeterType(2); if(meterNumber.length >= 10) verifyCustomer(meterNumber, 'electricity', selectedDisco, 2); }} 
                            className={`flex-1 p-3 rounded-xl font-bold text-xs border-2 ${meterType === 2 ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}
                        >
                            Postpaid
                        </button>
                    </div>
                    <input type="text" value={meterNumber} onChange={e => { setMeterNumber(e.target.value); if(e.target.value.length >= 10) verifyCustomer(e.target.value, 'electricity', selectedDisco, meterType); }} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Meter Number" />
                    {customerName && <p className={`text-[10px] font-bold px-2 ${customerName.includes("Invalid") ? "text-red-500" : "text-emerald-500"}`}>{customerName}</p>}
                    <input type="number" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Amount (₦)" />
                </div>
            );
        case 'Exam':
            return (
                <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto">
                        {EXAM_TYPES.map(e => <button key={e.id} onClick={() => setSelectedExam(e)} className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs whitespace-nowrap border-2 ${selectedExam?.id === e.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100'}`}>{e.id}</button>)}
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-slate-500">Quantity:</span>
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
                        {CARRIERS.map(c => (
                            <button key={c.id} onClick={() => { setSelectedCarrier(c.id); setSelectedNetworkId(Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id))); }} className={`aspect-square rounded-2xl flex items-center justify-center border-2 transition-all ${selectedCarrier === c.id ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50'}`}>
                                <img src={c.logo} className="w-8 h-8 object-contain rounded-full" />
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                        {RECHARGE_AMOUNTS.map(amt => <button key={amt} onClick={() => setServiceAmount(amt.toString())} className={`px-3 py-2 rounded-xl text-xs font-bold border ${serviceAmount === amt.toString() ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>₦{amt}</button>)}
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-slate-500">Quantity:</span>
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
      {/* 1. WALLET CARD */}
      <section className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl relative">
         <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Available Balance</p>
            <button onClick={() => { setIsRefreshingBalance(true); setTimeout(() => setIsRefreshingBalance(false), 1000); fetchUser(); }} className="p-2 bg-emerald-700/50 rounded-full"><RotateCcw size={14} className={isRefreshingBalance ? "animate-spin" : ""}/></button>
         </div>
         <h2 className="text-4xl font-black mb-6">{isBalanceVisible ? `₦${user.balance.toLocaleString()}` : '••••••••'}</h2>
         <div className="flex gap-3">
            <button onClick={() => setIsDepositModalOpen(true)} className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2"><CreditCard size={16}/> Fund Wallet</button>
            <button onClick={() => setIsWithdrawModalOpen(true)} className="flex-1 bg-emerald-700 border border-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase">Withdraw</button>
         </div>
      </section>

      {/* 2. SERVICES GRID */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[
            { id: 'Airtime', icon: <Smartphone size={18}/> }, 
            { id: 'Data', icon: <Zap size={18}/> }, 
            { id: 'Cable', icon: <Tv size={18}/> }, 
            { id: 'Electricity', icon: (
                <div className="relative">
                    <Building2 size={18} />
                    <Zap size={10} className="absolute -top-1 -right-1 text-yellow-500 fill-yellow-500" />
                </div>
            ) },
            { id: 'Exam', icon: <GraduationCap size={18}/> },
            { id: 'RechargePin', icon: <Printer size={18}/> }
        ].map((s:any) => (
            <button key={s.id} onClick={() => { setProductType(s.id as ProductType); setServiceAmount(''); setIsConfirming(false); }} className={`flex flex-col items-center py-4 rounded-xl transition-all ${productType === s.id ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}>
                {s.icon} <span className="text-[9px] font-black uppercase mt-1">{s.id}</span>
            </button>
        ))}
      </div>

      {/* 3. AIRTIME TO CASH CARD */}
      <button onClick={() => setProductType('AirtimeToCash')} className={`w-full p-5 rounded-[25px] flex items-center justify-between border-2 transition-all ${productType === 'AirtimeToCash' ? 'bg-orange-50 border-orange-500' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
             <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><ArrowLeftRight size={22} /></div>
             <div className="text-left"><h3 className="font-black text-sm uppercase">Airtime to Cash</h3><p className="text-[10px] text-slate-400 font-bold">Sell Airtime for Cash</p></div>
          </div>
          <ArrowRight size={20} className={`${productType === 'AirtimeToCash' ? 'text-orange-600' : 'text-slate-300'}`}/>
      </button>

      {/* 4. MAIN FORM AREA */}
      <section className="bg-white dark:bg-slate-800 p-5 rounded-[30px] shadow-sm border border-slate-100 dark:border-slate-800">
         <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-4">{productType === 'AirtimeToCash' ? 'Swap Details' : `${productType} Details`}</h3>
         
         {productType === 'AirtimeToCash' ? (
             <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                     {CARRIERS.map(c => <button key={c.id} onClick={() => setSelectedNetworkId(Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id)))} className={`p-2 rounded-xl border-2 ${selectedNetworkId === Number(Object.keys(NETWORK_ID_MAP).find(k => NETWORK_ID_MAP[Number(k)] === c.id)) ? 'border-orange-500 bg-orange-50' : 'border-slate-100'}`}><img src={c.logo} className="w-6 h-6 mx-auto rounded-full"/></button>)}
                </div>
                <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Sender Phone Number" />
                <input type="number" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none" placeholder="Amount to Sell (₦)" />
                {Number(serviceAmount) > 0 && (
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex justify-between items-center">
                        <span className="text-xs font-bold">You Receive:</span>
                        <span className="text-xl font-black">₦{(Number(serviceAmount) * 0.85).toFixed(0)}</span>
                    </div>
                )}
             </div>
         ) : renderServiceInputs()}

         {productType !== 'Data' && productType !== 'Cable' && (
             <button onClick={() => setIsConfirming(true)} disabled={!isFormValid()} className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                Proceed
             </button>
         )}
         {(productType === 'Data' || productType === 'Cable') && (
             <button onClick={() => setIsConfirming(true)} disabled={!isFormValid()} className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                Proceed
             </button>
         )}
      </section>

      {/* 5. HISTORY SECTION */}
      <div className="pt-2">
         <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-3 ml-2">Recent Activity</h3>
         <div className="space-y-2">
            {history.length === 0 ? <p className="text-center text-xs text-slate-300 py-4">No recent activity</p> : history.map((tx: any) => (
                <div key={tx.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${tx.type === 'Deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {tx.type === 'Deposit' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                        </div>
                        <div>
                            <p className="font-bold text-xs">{tx.type}</p>
                            <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <span className={`font-black text-xs ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.type === 'Deposit' ? '+' : '-'}₦{tx.amount}
                    </span>
                </div>
            ))}
         </div>
      </div>

      {/* --- MODALS (Deposit, Confirm, Withdraw) --- */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
                <button onClick={() => { setIsDepositModalOpen(false); setPendingDepositRef(null); }} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={16}/></button>
                <h3 className="text-xl font-black text-center mb-6">Fund Wallet</h3>
                {!pendingDepositRef ? (
                    <>
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        {PREFILLED_AMOUNTS.map(amt => <button key={amt} onClick={() => setDepositAmount(amt.toString())} className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 whitespace-nowrap border border-slate-200">₦{amt.toLocaleString()}</button>)}
                    </div>
                    <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border-2 border-transparent focus:border-emerald-500" placeholder="Amount (₦)" />
                    <button onClick={handleStartDeposit} disabled={!depositAmount} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50">Pay Securely</button>
                    </>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl mb-2"><p className="text-xs text-emerald-800 font-bold mb-1">Payment Detected!</p><p className="text-[10px] text-emerald-600">Please confirm to update your wallet.</p></div>
                        <button onClick={handleVerifyDeposit} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase flex justify-center items-center gap-2">{isProcessing ? <Loader2 className="animate-spin"/> : "Confirm Payment & Update Wallet"}</button>
                        <button onClick={() => setPendingDepositRef(null)} className="text-xs text-red-500 font-bold underline">Cancel</button>
                    </div>
                )}
            </div>
        </div>
      )}

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