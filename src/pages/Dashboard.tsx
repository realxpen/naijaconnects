import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Smartphone,
  Tv,
  Zap,
  ArrowRight,
  ArrowLeftRight,
  X,
  Loader2,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  CreditCard,
  GraduationCap,
  Printer,
  Building2,
  ChevronDown,
  CheckCircle,
  CheckCircle2,
  Activity,
  Share2,
  Download,
  Copy,
  Image as ImageIcon,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { usePaystackPayment } from "react-paystack";
import { dbService } from "../services/dbService";
import { supabase } from "../supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// IMPORT CONSTANTS
import {
  CARRIERS,
  CABLE_PROVIDERS,
  DISCOS,
  EXAM_TYPES,
  PREFILLED_AMOUNTS,
  RECHARGE_AMOUNTS,
  PIN_PRICING,
  Carrier,
  JAMB_VARIANTS, // <--- Imported
} from "../constants";

// // Updated to include WAEC and NECO for the UI
// const INITIAL_EXAM_TYPES = [
//   { id: 'JAMB', name: 'JAMB e-PIN', price: 0, logo: null },
//   { id: 'WAEC', name: 'WAEC Result Checker', price: 3800, logo: null }, // Price should match Affatech
//   { id: 'NECO', name: 'NECO Token', price: 1200, logo: null }           // Price should match Affatech
// ];

interface DashboardProps {
  user: { name: string; email: string; balance: number; phone?: string };
  onUpdateBalance: (newBalance: number) => void;
}

type ProductType =
  | "Airtime"
  | "Data"
  | "Cable"
  | "Electricity"
  | "Exam"
  | "RechargePin"
  | "AirtimeToCash";

const Dashboard = ({ user, onUpdateBalance }: DashboardProps) => {
  // --- STATES ---
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [productType, setProductType] = useState<ProductType>("Airtime");
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Service States
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [currentCablePlans, setCurrentCablePlans] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Selection States
  const [selectedPlanType, setSelectedPlanType] = useState<string>("ALL");
  const [selectedValidity, setSelectedValidity] = useState<string>("ALL");
  const [selectedNetworkId, setSelectedNetworkId] = useState<number>(1);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier>(Carrier.MTN);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  // Form Inputs
  const [airtimeType, setAirtimeType] = useState<string>("VTU");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [serviceAmount, setServiceAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smartCardNumber, setSmartCardNumber] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Specific Service Inputs
  const [selectedCableProvider, setSelectedCableProvider] =
    useState<string>("gotv");
  const [selectedCablePlan, setSelectedCablePlan] = useState<any>(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [selectedDisco, setSelectedDisco] = useState<string | null>(null);
  const [isDiscoDropdownOpen, setIsDiscoDropdownOpen] = useState(false);
  const [meterType, setMeterType] = useState(1);

  // Exam States
  const [examTypes, setExamTypes] = useState(EXAM_TYPES);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [nameOnCard, setNameOnCard] = useState("");
  const [jambType, setJambType] = useState("utme");
  const [jambProfileID, setJambProfileID] = useState("");
  const [jambPlans, setJambPlans] = useState<any[]>([]);

  // Info & Paystack
  const [airtimeToCashInfo, setAirtimeToCashInfo] = useState<any>(null);
  const [bankList, setBankList] = useState<any[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [pendingDepositRef, setPendingDepositRef] = useState<string | null>(
    null,
  );
  const [currentTxRef, setCurrentTxRef] = useState<string>(`txn_${Date.now()}`);

  // HELPER: Normalize Price
  const normalizePrice = (price: any) => {
    if (!price) return 0;
    if (typeof price === "number") return price;
    const cleanString = price.toString().replace(/[N, ]/g, "");
    return parseFloat(cleanString) || 0;
  };

  useEffect(() => {
    if (!jambType && JAMB_VARIANTS.length > 0) {
      setJambType(JAMB_VARIANTS[0].id);
    }
  }, []);

  // --- DATA FETCHING ---
  const fetchUser = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("balance")
        .eq("email", user.email)
        .single();
      if (data) onUpdateBalance(data.balance);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_email", user.email)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchUser();
  }, [user.email]);

  // --- RESET INPUTS ---
  useEffect(() => {
    setCustomerName("");
    setSmartCardNumber("");
    setMeterNumber("");
    setPhoneNumber("");
    setServiceAmount("");
    setJambProfileID("");
    setSelectedPlan(null);
    setSelectedCablePlan(null);
    setSelectedDisco(null);
  }, [productType]);

  const detectNetwork = (phone: string) => {
    const p = phone.replace(/\D/g, "").slice(0, 4);
    const MTN = [
      "0803",
      "0806",
      "0703",
      "0706",
      "0813",
      "0816",
      "0810",
      "0814",
      "0903",
      "0906",
      "0913",
      "0916",
    ];
    const GLO = [
      "0805",
      "0807",
      "0705",
      "0815",
      "0811",
      "0905",
      "0815",
      "0915",
    ];
    const AIRTEL = [
      "0802",
      "0808",
      "0708",
      "0812",
      "0902",
      "0907",
      "0901",
      "0904",
    ];
    const T2_MOBILE = ["0809", "0818", "0817", "0909", "0908"];
    if (MTN.includes(p)) return { id: 1, carrier: Carrier.MTN };
    if (GLO.includes(p)) return { id: 2, carrier: Carrier.GLO };
    if (AIRTEL.includes(p)) return { id: 3, carrier: Carrier.AIRTEL };
    if (T2_MOBILE.includes(p)) return { id: 4, carrier: Carrier.NINEMOBILE };
    return null;
  };

  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length >= 4) {
      const detected = detectNetwork(phoneNumber);
      if (detected) {
        setSelectedNetworkId(detected.id);
        setSelectedCarrier(detected.carrier);
        if (detected.id !== 1) setAirtimeType("VTU");
      }
    }
  }, [phoneNumber]);

  // --- RECEIPT VIEW ---
  const ReceiptView = ({ tx, onClose }: { tx: any; onClose: () => void }) => {
    const displayRef = tx.ref || `TRX-${tx.id}`;
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-full max-w-sm relative">
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white"
          >
            <X size={20} />
          </button>
          <div className="bg-white rounded-[30px] overflow-hidden shadow-2xl relative">
            <div className="h-24 bg-emerald-600 flex items-center justify-center text-white/20 font-black text-4xl">
              RECEIPT
            </div>
            <div className="px-6 pb-8 -mt-10 relative">
              <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-slate-100">
                <h2 className="text-3xl font-black text-slate-800 mt-4">
                  ₦{tx.amount.toLocaleString()}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  {tx.type}
                </p>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-600">
                  {tx.status}
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex justify-between py-2 border-b border-dashed border-slate-200">
                  <span className="text-xs font-bold text-slate-400">Date</span>
                  <span className="text-xs font-bold text-slate-700">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed border-slate-200">
                  <span className="text-xs font-bold text-slate-400">
                    Reference
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {displayRef}
                  </span>
                </div>
                {tx.meta?.pin && (
                  <div className="bg-slate-100 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400">
                      PIN
                    </p>
                    <p className="text-xl font-black text-slate-800 select-all">
                      {tx.meta.pin}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- API LOGIC ---

  const fetchDataPlans = async () => {
    setIsLoadingPlans(true);
    setAvailablePlans([]); // Clear old plans

    try {
      if (selectedNetworkId === 5) {
        const { data, error } = await supabase.functions.invoke(
          "clubkonnect-proxy",
          {
            body: { action: "fetch_smile_plans" },
          },
        );
        if (error) throw error;
        if (data) setAvailablePlans(data);
      } else {
        const { data, error } = await supabase.functions.invoke(
          "affatech-proxy",
          {
            body: { action: "fetch_data_plans" },
          },
        );
        if (error) throw error;
        if (data) setAvailablePlans(data);
      }
    } catch (e) {
      console.error("Fetch Data Plan Error", e);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const fetchCablePlans = async () => {
    if (!selectedCableProvider) return;
    setIsLoadingPlans(true);
    setCurrentCablePlans([]);
    try {
      const { data, error } = await supabase.functions.invoke(
        "clubkonnect-proxy",
        { body: { action: "fetch_cable_plans" } },
      );
      if (error) throw error;
      const providerKey = selectedCableProvider.toLowerCase();
      if (data && data[providerKey] && Array.isArray(data[providerKey]))
        setCurrentCablePlans(data[providerKey]);
      else setCurrentCablePlans([]);
    } catch (e: any) {
      console.error("Cable Plan Fetch Error:", e);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const fetchExamPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "clubkonnect-proxy",
        { body: { action: "fetch_jamb_plans" } },
      );
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        setJambPlans(data);
      }
    } catch (e) {
      console.error("JAMB Plan Fetch Error:", e);
      setJambPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (productType === "Data") fetchDataPlans();
    if (productType === "Cable") fetchCablePlans();
    if (productType === "Exam") fetchExamPlans();
  }, [productType, selectedNetworkId, selectedCableProvider]);

  const filteredPlans = useMemo(() => {
    let plansForNetwork: any[] = [];
    if (Array.isArray(availablePlans))
      plansForNetwork = availablePlans.filter(
        (p: any) =>
          p.network == selectedNetworkId || p.network_id == selectedNetworkId,
      );
    else plansForNetwork = availablePlans[selectedNetworkId] || [];
    return plansForNetwork.filter((plan: any) => {
      const name = (plan.plan_name || plan.name || "").toUpperCase();
      const typeMatch =
        selectedPlanType === "ALL" ||
        (selectedPlanType === "SME" && name.includes("SME")) ||
        (selectedPlanType === "CG" &&
          (name.includes("CG") || name.includes("CORPORATE"))) ||
        (selectedPlanType === "GIFTING" &&
          (name.includes("GIFT") ||
            (!name.includes("SME") && !name.includes("CG"))));
      const validityMatch =
        selectedValidity === "ALL" ||
        (selectedValidity === "30" &&
          (name.includes("30") || name.includes("MONTH"))) ||
        (selectedValidity === "7" &&
          (name.includes("7") || name.includes("WEEK"))) ||
        (selectedValidity === "1" &&
          (name.includes("1") || name.includes("DAY")));
      return typeMatch && validityMatch;
    });
  }, [availablePlans, selectedNetworkId, selectedPlanType, selectedValidity]);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data } = await supabase.functions.invoke("paystack-transfer", {
          body: { action: "list_banks" },
        });
        if (data?.status)
          setBankList(
            data.data.sort((a: any, b: any) => a.name.localeCompare(b.name)),
          );
      } catch (e) {
        console.error("Bank Error", e);
      }
    };
    fetchBanks();
  }, []);

  const verifyCustomer = async (
    number: string,
    serviceType: "cable" | "electricity",
    providerId: string | number | null,
    mType: number = 1,
  ) => {
    if (number.length < 10 || !providerId) return;
    setCustomerName("Verifying...");
    // Was 15000, change to 45000
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 45000),
    );

    try {
      const payload =
        serviceType === "electricity"
          ? { meter: number, disco: providerId, meter_type: mType }
          : { number, iuc: number, provider: providerId };

      const apiCall = supabase.functions.invoke("clubkonnect-proxy", {
        body: {
          action:
            serviceType === "electricity" ? "verify_meter" : "verify_smartcard",
          payload: payload,
        },
      });

      const result: any = await Promise.race([apiCall, timeout]);

      if (result.error) throw result.error;
      const data = result.data;

      if (
        data &&
        (data.customer_name || data.name || data.content?.Customer_Name)
      ) {
        const name =
          data.customer_name || data.name || data.content?.Customer_Name;
        if (name.includes("INVALID") || name === "Error") {
          setCustomerName("Invalid Number");
        } else {
          setCustomerName(name);
        }
      } else {
        setCustomerName("Invalid Number");
      }
    } catch (e: any) {
      console.error("Verification Error:", e);
      if (e.message === "Timeout") setCustomerName("Timed Out. Try Again.");
      else setCustomerName("Verification Failed");
    }
  };

  const verifyJamb = async (profileId: string, type: string) => {
    if (profileId.length < 10) return;
    setCustomerName("Verifying...");
    try {
      const { data, error } = await supabase.functions.invoke(
        "clubkonnect-proxy",
        {
          body: {
            action: "verify_jamb",
            payload: { profile_id: profileId, exam_type: type },
          },
        },
      );
      if (error) throw error;
      if (data.valid || data.customer_name)
        setCustomerName(data.customer_name || "Verified ID");
      else setCustomerName("Invalid Profile ID");
    } catch (e) {
      setCustomerName("Verification Failed");
    }
  };

  useEffect(() => {
    const verifyAccount = async () => {
      if (accountNumber.length === 10 && bankCode) {
        setAccountName("Verifying...");
        try {
          const { data } = await supabase.functions.invoke(
            "paystack-transfer",
            {
              body: {
                action: "verify",
                account_number: accountNumber,
                bank_code: bankCode,
              },
            },
          );
          if (data?.status) setAccountName(data.data.account_name);
          else setAccountName("Account not found");
        } catch (e) {
          setAccountName("Connection Error");
        }
      } else {
        setAccountName("");
      }
    };
    verifyAccount();
  }, [accountNumber, bankCode]);

  // --- UPDATE 1: UPDATED isFormValid (Includes WAEC/NECO Logic) ---
  const isFormValid = () => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (productType === "Airtime")
      return cleanPhone.length === 11 && Number(serviceAmount) > 0;
    if (productType === "Data")
      return cleanPhone.length === 11 && selectedPlan !== null;

    if (productType === "Cable") {
      return (
        smartCardNumber.length >= 10 &&
        selectedCablePlan !== null &&
        cleanPhone.length === 11 &&
        customerName !== "" &&
        !customerName.includes("Invalid")
      );
    }

    if (productType === "Electricity") {
      return (
        meterNumber.length >= 10 &&
        Number(serviceAmount) > 0 &&
        selectedDisco !== null &&
        customerName !== "" &&
        !customerName.includes("Invalid")
      );
    }

    // --- UPDATED EXAM VALIDATION ---
    if (productType === "Exam") {
      // JAMB: Needs Profile ID & Phone
      if (selectedExam?.id === "JAMB") {
        return (
          jambProfileID.length === 10 &&
          cleanPhone.length === 11 &&
          !customerName.includes("Invalid")
        );
      }
      // WAEC / NECO: Needs Quantity (1-5)
      return selectedExam !== null && quantity >= 1 && quantity <= 5;
    }

    if (productType === "RechargePin")
      return Number(serviceAmount) > 0 && quantity > 0 && nameOnCard.length > 2;
    if (productType === "AirtimeToCash")
      return cleanPhone.length === 11 && Number(serviceAmount) > 0;
    return false;
  };

  const calculateTotalCost = () => {
    if (productType === "Data")
      return normalizePrice(selectedPlan?.amount || selectedPlan?.price);
    if (productType === "Cable")
      return normalizePrice(selectedCablePlan?.amount);

    if (productType === "Exam") {
      if (selectedExam?.id === "JAMB") {
        const plan = JAMB_VARIANTS.find((p) => p.id === jambType);
        return plan ? plan.amount : 0;
      }
      return (selectedExam?.price || 0) * quantity;
    }

    if (productType === "RechargePin") {
      const unitPrice = PIN_PRICING[selectedNetworkId] || 100;
      return unitPrice * (Number(serviceAmount) / 100) * quantity;
    }
    return Number(serviceAmount);
  };

  const paystackConfig = {
    email: user?.email,
    amount: (Number(depositAmount) || 0) * 100,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
    reference: currentTxRef,
  };
  const initializePayment = usePaystackPayment(paystackConfig);
  const handleStartDeposit = () => {
    if (!depositAmount || Number(depositAmount) < 100) {
      alert("Minimum deposit amount is ₦100");
      return;
    }
    setPendingDepositRef(currentTxRef);
    initializePayment({
      onSuccess: () => {
        console.log("Paystack success");
        handleVerifyDeposit();
      },
      onClose: () => console.log("Paystack closed")
    } as any);
  };

  const handleVerifyDeposit = async () => {
    if (!pendingDepositRef) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "verify-deposit",
        { body: { reference: pendingDepositRef } },
      );
      if (error) throw new Error(error.message);
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
      alert(err.message || "Verification failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
      const cost = calculateTotalCost();
      if (productType !== "AirtimeToCash" && cost > user.balance)
        throw new Error("Insufficient Wallet Balance");
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      let proxyFunction = "affatech-proxy";
      let action = "";
      let payload: any = {};

      if (productType === "Electricity") {
        proxyFunction = "clubkonnect-proxy";
        action = "buy_electricity";
        payload = {
          disco: selectedDisco,
          meter: meterNumber,
          amount: cost,
          meter_type: meterType,
          phone: phoneNumber || "08000000000",
        };
      } else if (productType === "Cable") {
        proxyFunction = "clubkonnect-proxy";
        action = "buy_cable";
        payload = {
          provider: selectedCableProvider,
          iuc: smartCardNumber,
          plan_code: selectedCablePlan.id,
          amount: cost,
          phone: cleanPhone,
        };
      }
      // --- UPDATE 2: UPDATED EXAM ROUTING (Route WAEC/NECO to Affatech) ---
      else if (productType === "Exam") {
        // ROUTE 1: JAMB (ClubKonnect)
        if (selectedExam.id === "JAMB") {
          proxyFunction = "clubkonnect-proxy";
          action = "buy_education";
          if (!customerName || customerName.includes("Invalid"))
            throw new Error("Please verify Profile ID first");

          payload = {
            exam_group: "JAMB",
            exam_type: jambType,
            phone: cleanPhone,
            profile_id: jambProfileID,
            amount: cost,
          };
        }
        // ROUTE 2: WAEC / NECO (Affatech)
        else {
          proxyFunction = "affatech-proxy";
          action = "buy_education";
          payload = {
            exam_group: selectedExam.id, // "WAEC" or "NECO"
            quantity: quantity,
            amount: cost,
          };
        }
      } else if (productType === "RechargePin") {
        action = "buy_recharge_pin";
        payload = {
          network: selectedNetworkId,
          amount: serviceAmount,
          quantity: quantity,
          name_on_card: nameOnCard,
        };
      } else if (productType === "Airtime") {
        const isAffatechSpecial =
          selectedNetworkId === 1 &&
          (airtimeType === "Share and Sell" || airtimeType === "awuf4U");
        if (isAffatechSpecial) {
          proxyFunction = "affatech-proxy";
          action = "buy_airtime";
          payload = {
            network: selectedNetworkId,
            phone: cleanPhone,
            amount: cost,
            airtime_type: airtimeType,
          };
        } else {
          proxyFunction = "clubkonnect-proxy";
          action = "buy_airtime";
          payload = {
            network: selectedNetworkId,
            phone: cleanPhone,
            amount: cost,
            airtime_type: airtimeType,
          };
        }
      } else if (productType === "Data") {
        action = "buy_data";
        payload = {
          network: selectedNetworkId,
          phone: cleanPhone,
          plan_id: selectedPlan?.id || selectedPlan?.plan_id,
        };
      } else if (productType === "AirtimeToCash") {
        action = "airtime_to_cash";
        payload = {
          network: selectedNetworkId,
          phone: cleanPhone,
          amount: serviceAmount,
        };
      }

      const { data, error } = await supabase.functions.invoke(proxyFunction, {
        body: { action, payload },
      });
      if (error) throw new Error(error.message);

      if (productType === "AirtimeToCash") {
        setAirtimeToCashInfo({
          message:
            data.message ||
            data.api_response ||
            "Proceed to transfer airtime manually.",
          amount: serviceAmount,
        });
        setIsConfirming(false);
        return;
      }

      const isSuccess =
        data.status === "success" ||
        data.success === true ||
        (data.data &&
          (data.data.status === "ORDER_RECEIVED" ||
            data.data.status === "ORDER_COMPLETED"));

      if (isSuccess) {
        const newBal = user.balance - cost;
        await dbService.updateBalance(user.email, newBal);
        onUpdateBalance(newBal);
        await dbService.addTransaction({
          user_email: user.email,
          type: productType,
          amount: cost,
          status: "Success",
          ref: `TRX-${Date.now()}`,
          meta: {
            pin:
              data.pin ||
              data.token ||
              (data.data && (data.data.carddetails || data.data.metertoken)),
          },
        });
        fetchHistory();
        setIsConfirming(false);
        setPhoneNumber("");
        setServiceAmount("");
        setSmartCardNumber("");
        setMeterNumber("");
        setQuantity(1);
        setSelectedPlan(null);
        setSelectedCablePlan(null);
        setCustomerName("");
        setJambProfileID("");
        if (productType === "RechargePin")
          alert(`Success! Generated ${quantity} Pins. Check Console/DB.`);
        else alert(`Transaction Successful!`);
      } else {
        throw new Error(data?.message || "Transaction Failed");
      }
    } catch (e: any) {
      alert(e.message || "System Error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdrawal = async () => {
    if (Number(withdrawAmount) > user.balance)
      return alert("Insufficient Funds");
    setIsProcessing(true);
    try {
      const { data } = await supabase.functions.invoke("paystack-transfer", {
        body: {
          action: "transfer",
          email: user.email,
          amount: Number(withdrawAmount),
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
        },
      });
      if (data?.status) {
        await fetchUser();
        setIsWithdrawModalOpen(false);
        setWithdrawAmount("");
        alert("Withdrawal Successful!");
      } else {
        alert(data?.message || "Failed.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- UPDATE 3: UPDATED renderServiceInputs (Show Quantity Input for WAEC/NECO) ---
  const renderServiceInputs = () => {
    switch (productType) {
      case "Airtime":
      case "Data":
        return (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {CARRIERS.filter(
                (c: any) => productType !== "Airtime" || c.name !== "SMILE",
              ).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCarrier(c.name as Carrier);
                    setSelectedNetworkId(c.id);
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${selectedNetworkId === c.id ? "border-emerald-600 bg-emerald-50" : "border-transparent bg-slate-50"}`}
                >
                  <img
                    src={c.logo}
                    className="w-8 h-8 object-contain rounded-full"
                  />
                  <span className="text-[7px] font-black mt-1 uppercase text-slate-500">
                    {c.name}
                  </span>
                  {c.subText && (
                    <span className="absolute -bottom-2 text-[5px] text-emerald-600 font-bold whitespace-nowrap">
                      {c.subText}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {productType === "Airtime" && selectedNetworkId === 1 && (
              <div className="flex gap-2 mb-4 bg-slate-50 p-1 rounded-xl overflow-x-auto custom-scrollbar">
                {["VTU", "Share and Sell", "awuf4U", "GistPlus"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setAirtimeType(type)}
                    className={`flex-1 py-2 px-3 whitespace-nowrap rounded-lg text-[10px] font-bold uppercase transition-all ${airtimeType === type ? "bg-white shadow text-emerald-600" : "text-slate-400"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) =>
                setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none mb-4"
              placeholder="Phone Number (080...)"
            />
            {productType === "Data" ? (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                  {["ALL", "SME", "CG", "GIFTING"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedPlanType(t)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${selectedPlanType === t ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                    >
                      {t}
                    </button>
                  ))}
                  <div className="w-[1px] bg-slate-300 h-4 self-center mx-1"></div>
                  {["ALL", "30", "7", "1"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedValidity(v)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${selectedValidity === v ? "bg-orange-500 text-white" : "bg-slate-100"}`}
                    >
                      {v} D
                    </button>
                  ))}
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                  {filteredPlans.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4">
                      {isLoadingPlans ? (
                        <Loader2 className="animate-spin mx-auto" />
                      ) : (
                        "No plans found."
                      )}
                    </p>
                  ) : (
                    filteredPlans.map((p: any) => (
                      <button
                        key={p.id || p.plan_id}
                        onClick={() => setSelectedPlan(p)}
                        className={`w-full p-4 flex justify-between rounded-2xl border-2 transition-all ${selectedPlan?.id === p.id ? "border-emerald-600 bg-emerald-50" : "border-slate-100"}`}
                      >
                        <div className="text-left">
                          <span className="block font-bold text-xs">
                            {p.plan_name || p.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {p.validity}
                          </span>
                        </div>
                        <span className="font-black text-emerald-600 text-sm">
                          ₦
                          {normalizePrice(p.amount || p.price).toLocaleString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                  {PREFILLED_AMOUNTS.map((amt: number) => (
                    <button
                      key={amt}
                      onClick={() => setServiceAmount(amt.toString())}
                      className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 border border-slate-200"
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={serviceAmount}
                  onChange={(e) => setServiceAmount(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
                  placeholder="Amount (₦)"
                />
              </>
            )}
          </>
        );
      case "Cable":
        return (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto">
              {CABLE_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedCableProvider(p.id);
                    setSelectedCablePlan(null);
                    setCustomerName("");
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border-2 ${selectedCableProvider === p.id ? "border-emerald-600 bg-emerald-50" : "border-slate-100"}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) =>
                setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
              placeholder="Customer Phone Number"
            />
            <input
              type="text"
              value={smartCardNumber}
              onChange={(e) => {
                const val = e.target.value;
                setSmartCardNumber(val);
                if (val.length >= 10)
                  verifyCustomer(val, "cable", selectedCableProvider);
              }}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
              placeholder="IUC Number"
            />
            {customerName && (
              <p
                className={`text-[10px] font-bold px-2 ${customerName.includes("Invalid") || customerName.includes("Failed") || customerName.includes("Time") ? "text-red-500" : "text-emerald-500"}`}
              >
                {customerName}
              </p>
            )}
            <div className="relative">
              <select
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none"
                onChange={(e) =>
                  setSelectedCablePlan(
                    e.target.value ? JSON.parse(e.target.value) : null,
                  )
                }
              >
                <option value="">
                  {isLoadingPlans ? "Loading Plans..." : "Select Plan"}
                </option>
                {currentCablePlans.map((p: any) => (
                  <option key={p.id} value={JSON.stringify(p)}>
                    {p.name} - ₦{p.amount.toLocaleString()}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={16}
              />
            </div>
          </div>
        );
      case "Electricity":
        return (
          <div className="space-y-4">
            <div className="relative">
              <button
                onClick={() => setIsDiscoDropdownOpen(!isDiscoDropdownOpen)}
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold flex items-center justify-between border-2 border-transparent focus:border-emerald-500 transition-colors"
              >
                {selectedDisco ? (
                  <div className="flex items-center gap-3">
                    {DISCOS.find((d: any) => d.id === selectedDisco)?.logo && (
                      <img
                        src={DISCOS.find((d: any) => d.id === selectedDisco)?.logo}
                        className="w-6 h-6 object-contain rounded-full"
                      />
                    )}
                    <span>
                      {DISCOS.find((d: any) => d.id === selectedDisco)?.name} (
                      {DISCOS.find((d: any) => d.id === selectedDisco)?.short})
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 font-normal">
                    Select Disco Provider
                  </span>
                )}
                <ChevronDown
                  className={`text-slate-400 transition-transform ${isDiscoDropdownOpen ? "rotate-180" : ""}`}
                  size={16}
                />
              </button>
              {isDiscoDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto border border-slate-100 custom-scrollbar">
                  {DISCOS.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelectedDisco(d.id);
                        setIsDiscoDropdownOpen(false);
                        if (meterNumber.length >= 10)
                          verifyCustomer(
                            meterNumber,
                            "electricity",
                            d.id,
                            meterType,
                          );
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center p-1">
                        {d.logo && (
                          <img
                            src={d.logo}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                      <span className="font-bold text-sm text-slate-700">
                        {d.name}{" "}
                        <span className="text-xs text-slate-400">
                          ({d.short})
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMeterType(1);
                  if (meterNumber && selectedDisco)
                    verifyCustomer(
                      meterNumber,
                      "electricity",
                      selectedDisco,
                      1,
                    );
                }}
                className={`flex-1 p-3 rounded-xl font-bold text-xs border-2 ${meterType === 1 ? "border-emerald-600 bg-emerald-50" : "border-slate-100"}`}
              >
                Prepaid
              </button>
              <button
                onClick={() => {
                  setMeterType(2);
                  if (meterNumber && selectedDisco)
                    verifyCustomer(
                      meterNumber,
                      "electricity",
                      selectedDisco,
                      2,
                    );
                }}
                className={`flex-1 p-3 rounded-xl font-bold text-xs border-2 ${meterType === 2 ? "border-emerald-600 bg-emerald-50" : "border-slate-100"}`}
              >
                Postpaid
              </button>
            </div>
            <input
              type="text"
              value={meterNumber}
              onChange={(e) => {
                setMeterNumber(e.target.value);
                if (e.target.value.length >= 10 && selectedDisco)
                  verifyCustomer(
                    e.target.value,
                    "electricity",
                    selectedDisco,
                    meterType,
                  );
              }}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
              placeholder="Meter Number"
            />
            {customerName && (
              <p
                className={`text-[10px] font-bold px-2 ${customerName.includes("Invalid") || customerName.includes("Failed") || customerName.includes("Time") ? "text-red-500" : "text-emerald-500"}`}
              >
                {customerName}
              </p>
            )}
            <input
              type="number"
              value={serviceAmount}
              onChange={(e) => setServiceAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
              placeholder="Amount (₦)"
            />
          </div>
        );

      case "Exam":
        return (
          <div className="space-y-4">
            {/* Exam Type Tabs */}
            <div className="flex gap-2 overflow-x-auto">
              {examTypes.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSelectedExam(e);
                    setCustomerName("");
                    setQuantity(1);
                  }}
                  className={`flex-1 flex flex-col items-center py-3 px-4 rounded-xl font-bold text-xs whitespace-nowrap border-2 ${selectedExam?.id === e.id ? "border-emerald-600 bg-emerald-50" : "border-slate-100"}`}
                >
                  {e.logo && (
                    <img
                      src={e.logo}
                      className="w-8 h-8 object-contain mb-1 rounded-full"
                    />
                  )}
                  {e.id}
                </button>
              ))}
            </div>

            {/* JAMB UI (Profile ID & Phone) */}
            {selectedExam?.id === "JAMB" && (
              <div className="space-y-3 animate-in slide-in-from-top-2">
                <div className="flex gap-2">
                  {JAMB_VARIANTS.map((variant: any) => (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setJambType(variant.id);
                        if (jambProfileID)
                          verifyJamb(jambProfileID, variant.id);
                      }}
                      className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-bold uppercase border ${jambType === variant.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200 text-slate-500"}`}
                    >
                      {variant.name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={jambProfileID}
                  onChange={(e) => {
                    setJambProfileID(e.target.value);
                    if (e.target.value.length === 10)
                      verifyJamb(e.target.value, jambType);
                  }}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
                  placeholder="JAMB Profile ID (10 digits)"
                  maxLength={10}
                />
                {customerName && (
                  <p
                    className={`text-[10px] font-bold px-2 ${customerName.includes("Invalid") ? "text-red-500" : "text-emerald-500"}`}
                  >
                    {customerName}
                  </p>
                )}
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
                  placeholder="Buyer Phone Number"
                />
              </div>
            )}

            {/* WAEC / NECO UI (Quantity Selector) */}
            {selectedExam?.id !== "JAMB" && selectedExam && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
                    Quantity (Max 5)
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 font-black text-slate-600 disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="font-black text-2xl flex-1 text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(5, quantity + 1))}
                      disabled={quantity >= 5}
                      className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 font-black text-emerald-600 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* Read-Only Amount Display */}
                <div className="bg-emerald-50 p-4 rounded-2xl flex justify-between items-center border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-800">
                    Total Amount:
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    ₦{calculateTotalCost().toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case "RechargePin":
        return (
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 ml-1">
              Select Network
            </p>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {CARRIERS.map((net: any) => (
                <button
                  key={net.id}
                  onClick={() => {
                    setSelectedNetworkId(net.id);
                    setSelectedCarrier(net.name as Carrier);
                  }}
                  className={`p-3 rounded-2xl flex flex-col items-center border-2 transition-all ${selectedNetworkId === net.id ? "border-emerald-600 bg-emerald-50" : "border-slate-100 bg-white"}`}
                >
                  <img
                    src={net.logo}
                    className="w-8 h-8 object-contain rounded-full mb-1"
                  />
                  <span className="text-[7px] font-black uppercase">
                    {net.name}
                  </span>
                  <span className="text-[7px] text-emerald-600 font-bold">
                    ₦{PIN_PRICING[net.id] || 98}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 ml-1">
              Select Pin Denomination
            </p>
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              {RECHARGE_AMOUNTS.map((amt: number) => (
                <button
                  key={amt}
                  onClick={() => setServiceAmount(amt.toString())}
                  className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all ${serviceAmount === amt.toString() ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-100 text-slate-600"}`}
                >
                  ₦{amt}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Pin Quantity (68 pins per A4 Paper)
              </p>
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 bg-white rounded-full shadow-md font-black text-emerald-600"
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <span className="font-black text-2xl">{quantity}</span>
                  <p className="text-[9px] text-slate-400 font-bold">
                    Total Pins
                  </p>
                </div>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 bg-white rounded-full shadow-md font-black text-emerald-600"
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="text"
              value={nameOnCard}
              onChange={(e) => setNameOnCard(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-emerald-500"
              placeholder="Business Name on Card"
            />
            {Number(serviceAmount) > 0 && (
              <div className="bg-emerald-600 p-4 rounded-2xl text-white text-center shadow-lg animate-in zoom-in-95">
                <p className="text-[10px] font-bold uppercase opacity-80">
                  Total Payment
                </p>
                <p className="text-2xl font-black">
                  ₦{calculateTotalCost().toLocaleString()}
                </p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      <section className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl relative">
        <div className="flex justify-between items-start mb-1">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
            Available Balance
          </p>
          <button
            onClick={() => {
              setIsRefreshingBalance(true);
              setTimeout(() => setIsRefreshingBalance(false), 1000);
              fetchUser();
            }}
            className="p-2 bg-emerald-700/50 rounded-full"
          >
            <RotateCcw
              size={14}
              className={isRefreshingBalance ? "animate-spin" : ""}
            />
          </button>
        </div>
        <h2 className="text-4xl font-black mb-6">
          {isBalanceVisible ? `₦${user.balance.toLocaleString()}` : "••••••••"}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex-1 bg-white text-emerald-700 py-4 rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2"
          >
            <CreditCard size={16} /> Fund
          </button>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="flex-1 bg-emerald-700 border border-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase"
          >
            Withdraw
          </button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
        {[
          { id: "Airtime", icon: <Smartphone size={18} /> },
          { id: "Data", icon: <Zap size={18} /> },
          { id: "Cable", icon: <Tv size={18} /> },
          {
            id: "Electricity",
            icon: (
              <div className="relative">
                <Building2 size={18} />
                <Zap
                  size={10}
                  className="absolute -top-1 -right-1 text-yellow-500 fill-yellow-500"
                />
              </div>
            ),
          },
          { id: "Exam", icon: <GraduationCap size={18} /> },
          { id: "RechargePin", icon: <Printer size={18} /> },
        ].map((s: any) => (
          <button
            key={s.id}
            onClick={() => {
              setProductType(s.id as ProductType);
              setServiceAmount("");
              setIsConfirming(false);
            }}
            className={`flex flex-col items-center py-4 rounded-xl transition-all ${productType === s.id ? "bg-white shadow-md text-emerald-600" : "text-slate-400"}`}
          >
            {s.icon}{" "}
            <span className="text-[9px] font-black uppercase mt-1">{s.id}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setProductType("AirtimeToCash")}
        className={`w-full p-5 rounded-[25px] flex items-center justify-between border-2 transition-all ${productType === "AirtimeToCash" ? "bg-orange-50 border-orange-500" : "bg-white border-slate-100"}`}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
            <ArrowLeftRight size={22} />
          </div>
          <div className="text-left">
            <h3 className="font-black text-sm uppercase">Airtime to Cash</h3>
            <p className="text-[10px] text-slate-400 font-bold">
              Swap Airtime for Cash
            </p>
          </div>
        </div>
        <ArrowRight
          size={20}
          className={`${productType === "AirtimeToCash" ? "text-orange-600" : "text-slate-300"}`}
        />
      </button>

      <section className="bg-white dark:bg-slate-800 p-5 rounded-[30px] shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-4">
          {productType === "AirtimeToCash"
            ? "Swap Details"
            : `${productType} Details`}
        </h3>
        {productType === "AirtimeToCash" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {CARRIERS.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedNetworkId(c.id)}
                  className={`p-2 rounded-xl border-2 ${selectedNetworkId === c.id ? "border-orange-500 bg-orange-50" : "border-slate-100"}`}
                >
                  <img src={c.logo} className="w-6 h-6 mx-auto rounded-full" />
                </button>
              ))}
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
              placeholder="Sender Phone Number"
            />
            <input
              type="number"
              value={serviceAmount}
              onChange={(e) => setServiceAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none"
              placeholder="Amount to Sell (₦)"
            />
            {Number(serviceAmount) > 0 && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold">You Receive:</span>
                <span className="text-xl font-black">
                  ₦{(Number(serviceAmount) * 0.85).toFixed(0)}
                </span>
              </div>
            )}
          </div>
        ) : (
          renderServiceInputs()
        )}
        <button
          onClick={() => setIsConfirming(true)}
          disabled={!isFormValid()}
          className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50"
        >
          Proceed
        </button>
      </section>

      <div className="pt-2">
        <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-3 ml-2">
          Recent Activity
        </h3>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-xs text-slate-300 py-4">
              No recent activity
            </p>
          ) : (
            history.map((tx: any) => (
              <button
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="w-full bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${tx.type === "Deposit" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}
                  >
                    {tx.type === "Deposit" ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-xs">{tx.type}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-black text-xs ${tx.type === "Deposit" ? "text-emerald-600" : "text-slate-900"}`}
                >
                  {tx.type === "Deposit" ? "+" : "-"}₦{tx.amount}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedTx && (
        <ReceiptView tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}

      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative">
            <button
              onClick={() => {
                setIsDepositModalOpen(false);
                setPendingDepositRef(null);
              }}
              className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-black text-center mb-6">Fund Wallet</h3>
            {!pendingDepositRef ? (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {PREFILLED_AMOUNTS.map((amt: number) => (
                    <button
                      key={amt}
                      onClick={() => setDepositAmount(amt.toString())}
                      className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 border border-slate-200"
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black mb-4 outline-none border-2 border-transparent focus:border-emerald-500"
                  placeholder="Amount (₦)"
                />
                <button
                  onClick={handleStartDeposit}
                  disabled={!depositAmount}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase disabled:opacity-50"
                >
                  Pay Securely
                </button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl mb-2">
                  <p className="text-xs text-emerald-800 font-bold mb-1">
                    Payment Detected!
                  </p>
                  <p className="text-[10px] text-emerald-600">
                    Please confirm to update your wallet.
                  </p>
                </div>
                <button
                  onClick={handleVerifyDeposit}
                  disabled={isProcessing}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase flex justify-center items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Confirm Payment & Update Wallet"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isConfirming && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 text-center shadow-2xl">
            <h3 className="font-black uppercase mb-2 text-sm text-slate-400">
              Confirm Transaction
            </h3>
            <p className="text-3xl font-black text-emerald-600 mb-2">
              ₦{calculateTotalCost().toLocaleString()}
            </p>
            <p className="text-xs font-bold mb-6 text-slate-500">
              {productType} - {phoneNumber || smartCardNumber || meterNumber}
            </p>
            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase"
            >
              {isProcessing ? (
                <Loader2 className="animate-spin mx-auto" />
              ) : (
                "Confirm & Pay"
              )}
            </button>
            <button
              onClick={() => setIsConfirming(false)}
              className="mt-4 text-slate-400 font-bold uppercase text-[10px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {airtimeToCashInfo && (
        <div className="fixed inset-0 bg-emerald-900/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 text-center shadow-2xl relative">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h3 className="font-black uppercase mb-2 text-lg text-emerald-800">
              Request Initiated
            </h3>
            <div className="bg-slate-50 p-4 rounded-2xl text-left mb-6 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                Instruction
              </p>
              <p className="text-sm font-medium text-slate-700 mb-4">
                {airtimeToCashInfo.message}
              </p>
              <div className="p-3 bg-white rounded-xl border border-dashed border-emerald-300">
                <p className="text-xs font-black text-center text-emerald-600">
                  Please Transfer Manually
                </p>
              </div>
            </div>
            <button
              onClick={() => setAirtimeToCashInfo(null)}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase"
            >
              I Have Transferred
            </button>
          </div>
        </div>
      )}

      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[35px] p-8 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsWithdrawModalOpen(false)}
              className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-black text-center">Withdraw Funds</h3>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-bold outline-none"
            >
              <option value="">Select Bank</option>
              {bankList.map((b: any) => (
                <option key={b.id} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={10}
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, ""))
              }
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none"
              placeholder="Account Number"
            />
            {accountName && (
              <p
                className={`text-[10px] font-black uppercase px-2 ${accountName.includes("Error") ? "text-red-500" : "text-emerald-500"}`}
              >
                {accountName}
              </p>
            )}
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              {PREFILLED_AMOUNTS.map((amt: number) => (
                <button
                  key={amt}
                  onClick={() => setWithdrawAmount(amt.toString())}
                  className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-emerald-100 text-slate-600 whitespace-nowrap border border-slate-200"
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black outline-none"
              placeholder="Amount (₦)"
            />
            <button
              onClick={handleWithdrawal}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase flex justify-center"
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Confirm Withdraw"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
