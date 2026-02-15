import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Check, X, Loader2, Copy, ArrowLeft, Megaphone, Banknote, Send } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import AdminBroadcasts from "../components/AdminBroadcasts"; // <--- ENSURE THIS IMPORT EXISTS
import AdminPush from "../components/AdminPush";

const AdminDashboard = ({ onBack }: { onBack: () => void }) => {
  // 1. ADDED TAB STATE
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'broadcasts' | 'push'>('withdrawals');
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reconcileRef, setReconcileRef] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const { showToast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*, profiles(name, email)") 
      .eq("type", "withdrawal")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleApprove = async (tx: any) => {
    const meta = tx.meta || tx.metadata || {};
    if(!window.confirm(`Confirm transfer of ₦${tx.amount} to ${meta?.account_name}?`)) return;
    setProcessingId(tx.id);
    try {
        const { error } = await supabase.from("transactions").update({ status: "success" }).eq("id", tx.id);
        if (error) throw error;
        showToast("Transaction Approved!", "success");
        fetchRequests();
    } catch (e: any) {
        showToast(e.message, "error");
    } finally {
        setProcessingId(null);
    }
  };

  const handleReject = async (tx: any) => {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;
    setProcessingId(tx.id);
    try {
        const { data: userProfile } = await supabase.from("profiles").select("wallet_balance").eq("id", tx.user_id).single();
        const meta = tx.meta || tx.metadata || {};
        const refundAmount = meta?.total_deducted || tx.amount;
        const newBalance = (userProfile?.wallet_balance || 0) + refundAmount;

        await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", tx.user_id);
        
        await supabase.from("transactions").update({ 
            status: "failed", 
            description: `Failed: ${reason}` 
        }).eq("id", tx.id);

        showToast("Request Rejected & User Refunded", "info");
        fetchRequests();
    } catch (e: any) {
        showToast(e.message, "error");
    } finally {
        setProcessingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied!", "info");
  };

  const handleApproveV2 = async (tx: any) => {
    const meta = tx.meta || tx.metadata || {};
    if (!window.confirm(`Confirm transfer of ₦${tx.amount} to ${meta?.account_name}?`)) return;
    setProcessingId(tx.id);
    try {
      const wasDeducted = meta?.wallet_deducted !== false;
      if (!wasDeducted) {
        const { data: userProfile, error: profileErr } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", tx.user_id)
          .single();
        if (profileErr) throw profileErr;

        const totalDeducted = Number(meta?.total_deducted || tx.amount || 0);
        const currentBal = Number(userProfile?.wallet_balance || 0);
        if (currentBal < totalDeducted) {
          throw new Error("User has insufficient wallet balance at approval time.");
        }

        const { error: debitErr } = await supabase
          .from("profiles")
          .update({ wallet_balance: currentBal - totalDeducted })
          .eq("id", tx.user_id);
        if (debitErr) throw debitErr;
      }

      const { error } = await supabase.from("transactions").update({ status: "success" }).eq("id", tx.id);
      if (error) throw error;
      showToast("Transaction Approved!", "success");
      fetchRequests();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectV2 = async (tx: any) => {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;
    setProcessingId(tx.id);
    try {
      const meta = tx.meta || tx.metadata || {};
      const wasDeducted = meta?.wallet_deducted !== false;

      if (wasDeducted) {
        const { data: userProfile, error: profileErr } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", tx.user_id)
          .single();
        if (profileErr) throw profileErr;

        const refundAmount = Number(meta?.total_deducted || tx.amount || 0);
        const newBalance = Number(userProfile?.wallet_balance || 0) + refundAmount;
        const { error: refundErr } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", tx.user_id);
        if (refundErr) throw refundErr;
      }

      await supabase.from("transactions").update({
        status: "failed",
        description: `Failed: ${reason}`,
      }).eq("id", tx.id);

      showToast(wasDeducted ? "Request Rejected & User Refunded" : "Request Rejected", "info");
      fetchRequests();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReconcileDeposit = async () => {
    const reference = reconcileRef.trim();
    if (!reference) {
      showToast("Enter a deposit reference", "error");
      return;
    }
    setReconciling(true);
    try {
      const { data, error } = await supabase.rpc("reconcile_deposit_reference", {
        p_reference: reference,
        p_credit_if_success: true,
      });
      if (error) throw error;
      const status = (data as any)?.status || "success";
      const credited = (data as any)?.credited ? "credited" : "not credited";
      showToast(`Reconciled: ${status} (${credited})`, "success");
      setReconcileRef("");
    } catch (e: any) {
      showToast(e.message || "Failed to reconcile reference", "error");
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 animate-in fade-in">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-700"/>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Admin Panel</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Master Control</p>
          </div>
      </div>

      {/* 2. TAB BUTTONS (SWITCHER) */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <button 
            onClick={() => setActiveTab('withdrawals')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'withdrawals' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
              <Banknote size={16}/> Withdrawals
              {requests.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('broadcasts')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'broadcasts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
              <Megaphone size={16}/> Broadcasts
          </button>
          <button 
            onClick={() => setActiveTab('push')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'push' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
              <Send size={16}/> Push
          </button>
      </div>

      {/* 3. CONDITIONAL RENDERING */}
      <div className="max-w-4xl mx-auto">
          
          {/* SHOW BROADCAST SCREEN */}
          {activeTab === 'broadcasts' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                  <AdminBroadcasts />
              </div>
          )}

          {activeTab === 'push' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                  <AdminPush />
              </div>
          )}

          {/* SHOW WITHDRAWAL LIST */}
          {activeTab === 'withdrawals' && (
              <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-black text-slate-800 mb-2">Reconcile Deposit</h3>
                    <p className="text-xs text-slate-500 mb-3">
                      Fix a successful deposit stuck in pending and credit wallet once.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="DEP-..."
                        value={reconcileRef}
                        onChange={(e) => setReconcileRef(e.target.value)}
                        className="md:col-span-2 w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={handleReconcileDeposit}
                        disabled={reconciling}
                        className="w-full py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center justify-center gap-2 transition disabled:opacity-70"
                      >
                        {reconciling ? <Loader2 className="animate-spin" size={18}/> : "Run Reconcile"}
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600"/></div>
                  ) : requests.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                        <Check size={48} className="mx-auto mb-3 opacity-20"/>
                        <p className="font-bold">All caught up!</p>
                        <p className="text-xs">No pending withdrawals.</p>
                    </div>
                  ) : (
                    requests.map((tx) => (
                        <div key={tx.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                          {(() => {
                            const meta = tx.meta || tx.metadata || {};
                            return (
                              <>
                          <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                            <div>
                                <h3 className="font-black text-xl text-slate-800">₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase">{new Date(tx.created_at).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-emerald-700">{tx.profiles?.name}</p>
                                <p className="text-[10px] text-slate-400">{tx.profiles?.email}</p>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-2 mb-4 border border-slate-100">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Bank:</span> 
                                <span className="font-bold text-slate-700">{meta?.bank_name}</span>
                            </div>
                            <div className="flex justify-between items-center cursor-pointer hover:bg-slate-200 p-1 -mx-1 rounded transition" onClick={() => copyToClipboard(tx.meta?.account_number)}>
                                <span className="text-slate-500">Account:</span> 
                                <span className="font-bold text-blue-600 flex items-center gap-1">{meta?.account_number} <Copy size={12}/></span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Name:</span> 
                                <span className="font-bold text-slate-800">{meta?.account_name}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                                <span className="text-slate-500">Fee Charged:</span> 
                                <span className="font-bold text-slate-700">₦{Number(meta?.fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                             <button 
                                onClick={() => handleRejectV2(tx)}
                                disabled={!!processingId}
                                className="py-3 rounded-xl font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 flex items-center justify-center gap-2 transition"
                             >
                                {processingId === tx.id ? <Loader2 className="animate-spin" size={18}/> : <><X size={18}/> Reject</>}
                             </button>
                             
                             <button 
                                onClick={() => handleApproveV2(tx)}
                                disabled={!!processingId}
                                className="py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center justify-center gap-2 transition"
                             >
                                {processingId === tx.id ? <Loader2 className="animate-spin" size={18}/> : <><Check size={18}/> Approve</>}
                             </button>
                          </div>
                              </>
                            );
                          })()}
                        </div>
                    ))
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default AdminDashboard;
