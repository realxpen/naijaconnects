import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../supabaseClient";

type AgreementsPageProps = {
  userId: string;
  onBack: () => void;
};

const AgreementsPage: React.FC<AgreementsPageProps> = ({ userId, onBack }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" | "" }>({ text: "", type: "" });
  const [agreementSign, setAgreementSign] = useState<Record<string, { name: string; checked: boolean; method?: string }>>({});

  const loadAgreements = async () => {
    setLoading(true);
    try {
      const { data: invites, error } = await supabase
        .from("document_invites")
        .select("id, status, document_id, created_at")
        .eq("invited_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const docIds = Array.from(new Set((invites || []).map((i: any) => i.document_id)));
      let docs: any[] = [];
      let versions: any[] = [];
      let signatures: any[] = [];
      if (docIds.length) {
        const docRes = await supabase.from("documents").select("*").in("id", docIds);
        if (docRes.error) throw docRes.error;
        docs = docRes.data || [];

        const verRes = await supabase.from("document_versions").select("*").in("document_id", docIds);
        if (verRes.error) throw verRes.error;
        versions = verRes.data || [];

        const versionIds = versions.map((v: any) => v.id);
        if (versionIds.length) {
          const sigRes = await supabase
            .from("document_signatures")
            .select("id, document_version_id, user_id, signature_method, typed_name, signed_at")
            .eq("user_id", userId)
            .in("document_version_id", versionIds)
            .order("signed_at", { ascending: false });
          if (sigRes.error) throw sigRes.error;
          signatures = sigRes.data || [];
        }
      }

      const latestByDoc: Record<string, any> = {};
      versions.forEach((v) => {
        const existing = latestByDoc[v.document_id];
        if (!existing || v.version > existing.version) latestByDoc[v.document_id] = v;
      });

      const latestSigByVersion: Record<string, any> = {};
      signatures.forEach((s) => {
        if (!latestSigByVersion[s.document_version_id]) latestSigByVersion[s.document_version_id] = s;
      });

      const mapped = (invites || []).map((invite: any) => {
        const doc = docs.find((d) => d.id === invite.document_id);
        const version = latestByDoc[invite.document_id];
        const signature = version?.id ? latestSigByVersion[version.id] : null;
        return { invite, doc, version, signature };
      });
      setRows(mapped);
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to load agreements", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgreements();
  }, [userId]);

  const handleSignAgreement = async (inviteId: string) => {
    const entry = rows.find((a) => a.invite.id === inviteId);
    if (!entry) return;
    const sig = agreementSign[inviteId];
    if (!sig?.checked || !sig?.name?.trim()) {
      setMsg({ text: "Please check acknowledgement and type your name", type: "error" });
      return;
    }
    try {
      const method = entry.doc?.signature_method === "external" ? "external" : sig.method || "native";
      const { error } = await supabase.from("document_signatures").insert({
        document_version_id: entry.version?.id,
        user_id: userId,
        signature_method: method,
        typed_name: sig.name.trim(),
        external_provider: entry.doc?.external_provider || null,
        external_reference: entry.doc?.external_url || null,
      });
      if (error) throw error;

      const { error: updErr } = await supabase
        .from("document_invites")
        .update({ status: "signed" })
        .eq("id", inviteId);
      if (updErr) throw updErr;

      setAgreementSign((prev) => ({ ...prev, [inviteId]: { name: "", checked: false } }));
      setMsg({ text: "Agreement signed", type: "success" });
      loadAgreements();
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to sign agreement", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Agreements</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Review and Sign Documents</p>
        </div>
      </div>

      {msg.text && (
        <div className={`mb-4 rounded-xl p-3 text-xs font-bold ${msg.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading agreements...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-slate-400">No pending agreements.</p>
        ) : (
          rows.map((row) => (
            <div key={row.invite.id} className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
              <div className="text-xs font-black text-slate-800">{row.doc?.title || "Agreement"}</div>
              <div className="text-[10px] text-slate-400 uppercase">
                Role: {row.doc?.target_role || "role"} · Version: v{row.version?.version || "?"} · Status: {row.invite.status}
              </div>
              <div className="max-h-44 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                {row.version?.body_text || "Document text not found."}
              </div>

              {row.invite.status === "signed" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  Signed by <span className="font-bold">{row.signature?.typed_name || "N/A"}</span> on{" "}
                  <span className="font-bold">
                    {row.signature?.signed_at ? new Date(row.signature.signed_at).toLocaleString() : "N/A"}
                  </span>
                </div>
              )}

              {row.doc?.signature_method !== "native" && row.doc?.external_url && row.invite.status === "pending" && (
                <button
                  onClick={() => window.open(row.doc.external_url, "_blank")}
                  className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest"
                >
                  Open External Signature
                </button>
              )}

              {row.invite.status === "pending" && (
                <>
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                    <input
                      type="checkbox"
                      checked={agreementSign[row.invite.id]?.checked || false}
                      onChange={(e) =>
                        setAgreementSign((prev) => ({
                          ...prev,
                          [row.invite.id]: { ...(prev[row.invite.id] || {}), checked: e.target.checked },
                        }))
                      }
                    />
                    I acknowledge and agree to the terms above.
                  </label>
                  <input
                    type="text"
                    placeholder="Type your full name"
                    value={agreementSign[row.invite.id]?.name || ""}
                    onChange={(e) =>
                      setAgreementSign((prev) => ({
                        ...prev,
                        [row.invite.id]: { ...(prev[row.invite.id] || {}), name: e.target.value },
                      }))
                    }
                    className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => handleSignAgreement(row.invite.id)}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
                  >
                    Sign {row.doc?.title || "Agreement"} (v{row.version?.version || "?"})
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgreementsPage;
