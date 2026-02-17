import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ui/ToastProvider";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { calculateTransferServiceFee } from "../utils/paymentFees";

type ProfitRow = {
  id: string;
  month: string;
  total_revenue: number;
  expenses: number;
  net_profit: number;
  investor_pool_percent?: number | null;
  is_distributed?: boolean | null;
};

type Investor = {
  id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  contribution: number;
  total_received?: number | null;
  max_return?: number | null;
  status?: "pending" | "approved" | "rejected";
};

type Payout = {
  id: string;
  month: string;
  amount: number;
  created_at?: string;
};

const DEFAULT_POOL_PERCENT = 0.2;
const BANKS = [
  { code: "", name: "Select Bank" },
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
];

const formatCurrency = (value: number) =>
  `₦${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const InvestorDashboard = ({
  onBack,
  userId,
  email,
}: {
  onBack: () => void;
  userId: string;
  email: string;
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [reinvestAmount, setReinvestAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [investAmount, setInvestAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const getWithdrawalFee = (amount: number) => calculateTransferServiceFee(amount);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [investorRes, allRes, profitRes, profileRes] = await Promise.all([
        supabase
          .from("investors")
          .select("*")
          .or(`user_id.eq.${userId},email.eq.${email}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase.from("investors").select("*").order("created_at", { ascending: false }),
        supabase.from("monthly_profit_tracker").select("*").order("month", { ascending: false }),
        supabase.from("profiles").select("wallet_balance").eq("id", userId).single(),
      ]);

      if (investorRes.error && investorRes.error.code !== "PGRST116") throw investorRes.error;
      if (allRes.error) throw allRes.error;
      if (profitRes.error) throw profitRes.error;
      if (profileRes.error) throw profileRes.error;

      setInvestor((investorRes.data as Investor) || null);
      setAllInvestors((allRes.data || []) as Investor[]);
      setProfitRows((profitRes.data || []) as ProfitRow[]);
      setWalletBalance(profileRes.data?.wallet_balance || 0);

      if (investorRes.data?.id) {
        const { data: payoutData, error: payoutErr } = await supabase
          .from("investor_payouts")
          .select("*")
          .eq("investor_id", investorRes.data.id)
          .order("month", { ascending: false });
        if (payoutErr) throw payoutErr;
        setPayouts((payoutData || []) as Payout[]);
      } else {
        setPayouts([]);
      }
    } catch (e: any) {
      showToast(e.message || "Failed to load investor data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentProfit = profitRows[0];
  const poolPercent = (currentProfit?.investor_pool_percent ?? DEFAULT_POOL_PERCENT) || DEFAULT_POOL_PERCENT;
  const netProfit = currentProfit?.net_profit || 0;
  const investorPool = netProfit * poolPercent;
  const approvedInvestors = allInvestors.filter((i) => i.status !== "pending" && i.status !== "rejected");
  const totalContribution = approvedInvestors.reduce((sum, i) => sum + (i.contribution || 0), 0);

  const payoutPreview = useMemo(() => {
    if (!investor) return 0;
    const maxReturn = investor.max_return ?? (investor.contribution || 0) * 1.5;
    const totalReceived = investor.total_received || 0;
    if (totalContribution <= 0 || investorPool <= 0) return 0;
    const share = (investor.contribution || 0) / totalContribution;
    return Math.min(share * investorPool, Math.max(0, maxReturn - totalReceived));
  }, [investor, totalContribution, investorPool]);

  const handleReinvestRequest = async () => {
    const amount = Number(reinvestAmount || 0);
    if (!amount || amount <= 0 || !investor) {
      showToast("Enter a valid reinvest amount", "error");
      return;
    }
    if (amount > walletBalance) {
      showToast("Insufficient wallet balance", "error");
      return;
    }
    try {
      const { error } = await supabase.rpc("request_reinvest_from_wallet", {
        p_amount: amount,
      });
      if (error) throw error;
      showToast("Reinvestment request sent (amount locked from wallet)", "success");
      setReinvestAmount("");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to submit reinvestment request", "error");
    }
  };

  const handleInvestFromWallet = async () => {
    const amount = Number(investAmount || 0);
    if (!amount || amount <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    try {
      const { error } = await supabase.rpc("invest_from_wallet", { p_amount: amount });
      if (error) throw error;
      showToast("Investment added from wallet", "success");
      setInvestAmount("");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to invest from wallet", "error");
    }
  };

  const handleWithdrawRequest = async () => {
    const requestedAmount = Number(withdrawAmount || 0);
    const fee = getWithdrawalFee(requestedAmount);
    if (!requestedAmount || requestedAmount <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    if (requestedAmount <= fee) {
      showToast("Amount must be greater than withdrawal fee", "error");
      return;
    }
    if (requestedAmount > walletBalance) {
      showToast("Insufficient wallet balance", "error");
      return;
    }
    const netPayoutAmount = requestedAmount - fee;
    if (!bankCode || !bankName || !accountNumber || !accountName) {
      showToast("Fill all bank details", "error");
      return;
    }
    if (accountName === "INVALID ACCOUNT" || accountName === "SYSTEM ERROR") {
      showToast("Please verify account details", "error");
      return;
    }
    try {
      setIsWithdrawing(true);
      const { error } = await supabase.rpc("request_withdrawal_secure", {
        p_amount: netPayoutAmount,
        p_bank_code: bankCode,
        p_bank_name: bankName,
        p_account_number: accountNumber,
        p_account_name: accountName,
        p_fee: fee,
        p_reference: `INV-WD-${Date.now()}`,
        p_category: "investor_withdrawal",
        p_deduct_immediately: true,
      });
      if (error) throw error;

      showToast(`Withdrawal request submitted. You will receive ${formatCurrency(netPayoutAmount)}.`, "success");
      setWithdrawAmount("");
      setBankCode("");
      setBankName("");
      setAccountNumber("");
      setAccountName("");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to request withdrawal", "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const resolveAccount = async (acct: string, bank: string) => {
    if (acct.length !== 10 || !bank) return;
    setIsResolving(true);
    setAccountName("");
    try {
      const { data, error } = await supabase.functions.invoke("verify-account", {
        body: { account_number: acct, bank_code: bank },
      });
      if (error) throw new Error(error.message);
      if (data?.valid) {
        setAccountName(data.account_name);
      } else {
        setAccountName("INVALID ACCOUNT");
        showToast(data?.message || "Account not found", "error");
      }
    } catch (e: any) {
      setAccountName("SYSTEM ERROR");
      showToast(e.message || "Account verification failed", "error");
    } finally {
      setIsResolving(false);
    }
  };

  if (!investor && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 pb-20">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Investor Dashboard</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Revenue Share Summary</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center text-xs text-slate-400">
          No investor profile found for this account.
        </div>
      </div>
    );
  }

  const maxReturn = investor?.max_return ?? (investor?.contribution || 0) * 1.5;
  const totalReceived = investor?.total_received || 0;
  const remainingCap = Math.max(0, maxReturn - totalReceived);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Investor Dashboard</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Revenue Share Summary</p>
        </div>
        <button
          onClick={fetchData}
          className="ml-auto p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
          title="Refresh"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Invested</div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(investor?.contribution || 0)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Max Return (1.5x)</div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(maxReturn)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Total Received</div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(totalReceived)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Remaining Cap</div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(remainingCap)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm col-span-2">
          <div className="text-xs font-bold uppercase text-slate-400">Wallet Balance</div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(walletBalance)}</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">Add Investment From Wallet</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Enter amount"
            value={investAmount}
            onChange={(e) => setInvestAmount(e.target.value)}
            className="flex-1 p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleInvestFromWallet}
            className="px-4 rounded-xl bg-emerald-600 text-white text-xs font-black"
          >
            Invest
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Investment pulls funds from your wallet balance.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">This Month Payout</h3>
        <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
          <span>Net Profit (latest)</span>
          <span>{formatCurrency(netProfit)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-slate-500 font-bold mt-2">
          <span>Investor Pool ({Math.round(poolPercent * 100)}%)</span>
          <span>{formatCurrency(investorPool)}</span>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center">
          <p className="text-[10px] uppercase font-black text-slate-400">Estimated Payout</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(payoutPreview)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">Request Withdrawal</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            placeholder="Amount"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <select
            value={bankCode}
            onChange={(e) => {
              const code = e.target.value;
              setBankCode(code);
              setBankName(BANKS.find((b) => b.code === code)?.name || "");
              if (accountNumber.length === 10) resolveAccount(accountNumber, code);
            }}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          >
            {BANKS.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Account number"
            value={accountNumber}
            onChange={(e) => {
              const acct = e.target.value.replace(/\D/g, "").slice(0, 10);
              setAccountNumber(acct);
              if (acct.length === 10 && bankCode) resolveAccount(acct, bankCode);
            }}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="Account name"
            value={accountName}
            readOnly
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
        </div>
        <div className="mt-2 text-[10px] font-bold text-slate-500 flex justify-between">
          <span>{isResolving ? "Verifying account..." : `Withdrawal fee: ${formatCurrency(getWithdrawalFee(Number(withdrawAmount || 0) || 0))}`}</span>
          <span>You will receive: {formatCurrency(Math.max(0, (Number(withdrawAmount || 0) || 0) - getWithdrawalFee(Number(withdrawAmount || 0) || 0)))}</span>
        </div>
        <button
          onClick={handleWithdrawRequest}
          disabled={isWithdrawing}
          className="mt-3 w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-70"
        >
          {isWithdrawing ? "Submitting..." : "Submit Withdrawal"}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">Reinvestment</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Enter amount"
            value={reinvestAmount}
            onChange={(e) => setReinvestAmount(e.target.value)}
            className="flex-1 p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleReinvestRequest}
            className="px-4 rounded-xl bg-slate-900 text-white text-xs font-black"
          >
            Request
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Requests are approved by the Founder team.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-black text-slate-800 mb-4">Payout History</h3>
        {loading ? (
          <p className="text-xs text-slate-400">Loading payouts…</p>
        ) : payouts.length === 0 ? (
          <p className="text-xs text-slate-400">No payouts yet.</p>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex justify-between text-xs font-bold text-slate-600">
                <span>{p.month}</span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestorDashboard;
