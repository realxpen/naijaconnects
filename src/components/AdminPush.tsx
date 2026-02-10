import React, { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useToast } from "./ui/ToastProvider";

const AdminPush = () => {
  const { showToast } = useToast();
  const [title, setTitle] = useState("Swifna");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("https://swifna-liart.vercel.app/");
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<{ sent: number; failed: number } | null>(null);

  const handleSend = async () => {
    if (!message.trim()) {
      showToast("Enter a message", "error");
      return;
    }
    setSending(true);
    setSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { title, message, url },
      });
      if (error) throw error;
      if (data?.sent !== undefined) {
        setSummary({ sent: data.sent, failed: data.failed ?? 0 });
        showToast(`Push sent: ${data.sent}`, "success");
      } else {
        showToast("Push sent", "success");
      }
    } catch (e: any) {
      showToast(e.message || "Failed to send push", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-[25px] shadow-sm border border-slate-100 p-5">
      <h3 className="text-lg font-black text-slate-800 mb-1">Push Notifications</h3>
      <p className="text-xs text-slate-400 font-bold uppercase mb-4">Send to all subscribers</p>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message"
          rows={4}
          className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Open URL"
          className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full h-12 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-70"
        >
          {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
          {sending ? "Sending..." : "Send Push"}
        </button>
      </div>

      {summary && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-bold text-emerald-700">
          Sent: {summary.sent} • Failed: {summary.failed}
        </div>
      )}
    </div>
  );
};

export default AdminPush;
