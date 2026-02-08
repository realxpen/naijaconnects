import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Check, X, Loader2, Copy, AlertCircle, ArrowLeft } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";

const AdminDashboard = ({ onBack }: { onBack: () => void }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { showToast } = useToast();

  // --- FETCH PENDING WITHDRAWALS ---
  const fetchRequests = async () => {
    setLoading(true);
    // Fetch transactions + Join with Profiles to get user name/email
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

  // --- ACTION: APPROVE (Mark Success) ---
  const handleApprove = async (tx: any) => {
    if(!window.confirm(`Confirm transfer of ₦${tx.amount} to ${tx.meta?.account_name}?`)) return;
    
    setProcessingId(tx.id);
    try {
        // 1. Update Transaction Status
        const { error } = await supabase
            .from("transactions")
            .update({ status: "success" })
            .eq("id", tx.id);

        if (error) throw error;
        
        showToast("Transaction Approved!", "success");
        fetchRequests(); // Refresh list
    } catch (e: any) {
        showToast(e.message, "error");
    } finally {
        setProcessingId(null);
    }
  };

  // --- ACTION: REJECT (Refund Money & Mark Failed) ---
  const handleReject = async (tx: any) => {
    const reason = prompt("Reason for rejection? (e.g., Invalid Account)");
    if (!reason) return;

    setProcessingId(tx.id);
    try {
        // 1. Refund the User
        // We need to fetch current balance first to be safe, then add
        const { data: userProfile } = await supabase.from("profiles").select("balance").eq("id", tx.user_id).single();
        
        // Use total_deducted if it exists (amount + fee), otherwise just amount
        const refundAmount = tx.meta?.total_deducted || tx.amount;
        const newBalance = (userProfile?.balance || 0) + refundAmount;

        const { error: refundError } = await supabase
            .from("profiles")
            .update({ balance: newBalance })
            .eq("id", tx.user_id);

        if (refundError) throw new Error("Failed to refund user");

        // 2. Update Transaction to Failed
        const { error: txError } = await supabase
            .from("transactions")
            .update({ 
                status: "failed & Reversed", 
                description: `Failed: ${reason}` // Update description with reason
            })
            .eq("id", tx.id);

        if (txError) throw txError;

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

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-700"/>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Admin Panel</h1>
            <p className="text-sm text-slate-500">Manage Withdrawals</p>
          </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600"/></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed">
            <Check size={40} className="mx-auto mb-2 opacity-20"/>
            <p>All caught up! No pending requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((tx) => (
            <div key={tx.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
              {/* Header Info */}
              <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                <div>
                    <h3 className="font-black text-xl text-slate-800">₦{tx.amount.toLocaleString()}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-emerald-700">{tx.profiles?.name}</p>
                    <p className="text-[10px] text-slate-400">{tx.profiles?.email}</p>
                </div>
              </div>

              {/* Bank Details Card */}
              <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-2 mb-4 border border-slate-100">
                <div className="flex justify-between">
                    <span className="text-slate-500">Bank:</span> 
                    <span className="font-bold text-slate-700">{tx.meta?.bank_name}</span>
                </div>
                <div className="flex justify-between items-center cursor-pointer hover:bg-slate-200 p-1 -mx-1 rounded transition" onClick={() => copyToClipboard(tx.meta?.account_number)}>
                    <span className="text-slate-500">Account:</span> 
                    <span className="font-bold text-blue-600 flex items-center gap-1">{tx.meta?.account_number} <Copy size={12}/></span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span> 
                    <span className="font-bold text-slate-800">{tx.meta?.account_name}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                    <span className="text-slate-500">Fee Charged:</span> 
                    <span className="font-bold text-slate-700">₦{tx.meta?.fee || 0}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={() => handleReject(tx)}
                    disabled={!!processingId}
                    className="py-3 rounded-xl font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 flex items-center justify-center gap-2"
                 >
                    {processingId === tx.id ? <Loader2 className="animate-spin" size={18}/> : <><X size={18}/> Reject</>}
                 </button>
                 
                 <button 
                    onClick={() => handleApprove(tx)}
                    disabled={!!processingId}
                    className="py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center justify-center gap-2"
                 >
                    {processingId === tx.id ? <Loader2 className="animate-spin" size={18}/> : <><Check size={18}/> Approve</>}
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;