import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ui/ToastProvider";
import {
  ArrowLeft,
  Check,
  X,
  Plus,
  RefreshCcw,
  Users,
  LineChart,
  PieChart,
  Wallet,
} from "lucide-react";

type ProfitRow = {
  id: string;
  month: string;
  total_revenue: number;
  expenses: number;
  net_profit: number;
  investor_pool_percent?: number | null;
  created_at?: string;
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
  created_at?: string;
};

type EquityAllocation = {
  id: string;
  recipient_name: string;
  recipient_role: string;
  recipient_user_id?: string | null;
  total_equity: number;
  start_date: string;
  cliff_months?: number | null;
  vesting_months?: number | null;
  created_at?: string;
};

type Document = {
  id: string;
  title: string;
  target_role: string;
  signature_method: "native" | "external" | "both";
  external_provider?: string | null;
  external_url?: string | null;
  is_active?: boolean;
  created_at?: string;
};

type DocumentVersion = {
  id: string;
  document_id: string;
  version: number;
  body_text: string;
  created_at?: string;
};

type DocumentInvite = {
  id: string;
  document_id: string;
  invited_user_id?: string | null;
  invited_email?: string | null;
  status: "pending" | "signed" | "declined" | "revoked";
  created_at?: string;
};

type DocumentSignature = {
  id: string;
  document_version_id: string;
  user_id: string;
  signature_method: string;
  typed_name: string;
  signed_at?: string;
  external_provider?: string | null;
  external_reference?: string | null;
};

const DEFAULT_POOL_PERCENT = 0.2;
const DEFAULT_CLIFF = 12;
const DEFAULT_VESTING = 48;

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

const formatCurrency = (value: number) =>
  `₦${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const monthsBetween = (start: Date, end: Date) => {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const total = years * 12 + months;
  if (end.getDate() < start.getDate()) return Math.max(0, total - 1);
  return Math.max(0, total);
};

const calculateVested = (allocation: EquityAllocation, asOf = new Date()) => {
  const start = new Date(allocation.start_date);
  const cliff = allocation.cliff_months ?? DEFAULT_CLIFF;
  const vesting = allocation.vesting_months ?? DEFAULT_VESTING;
  const months = monthsBetween(start, asOf);
  if (months < cliff) return 0;
  const vestedMonths = Math.min(months - cliff, vesting - cliff);
  if (vesting <= cliff) return allocation.total_equity;
  return (allocation.total_equity * vestedMonths) / (vesting - cliff);
};

const FounderDashboard = ({ onBack }: { onBack: () => void }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [equityAllocations, setEquityAllocations] = useState<EquityAllocation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);
  const [documentInvites, setDocumentInvites] = useState<DocumentInvite[]>([]);
  const [documentSignatures, setDocumentSignatures] = useState<DocumentSignature[]>([]);
  const [invitePageRows, setInvitePageRows] = useState<DocumentInvite[]>([]);
  const [inviteTotalCount, setInviteTotalCount] = useState(0);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [signaturePageRows, setSignaturePageRows] = useState<DocumentSignature[]>([]);
  const [signatureTotalCount, setSignatureTotalCount] = useState(0);
  const [signatureLoading, setSignatureLoading] = useState(false);

  const [profitForm, setProfitForm] = useState({
    month: monthKey(),
    totalRevenue: "",
    expenses: "",
    poolPercent: (DEFAULT_POOL_PERCENT * 100).toString(),
  });

  const [allocationForm, setAllocationForm] = useState({
    recipientName: "",
    recipientEmail: "",
    recipientUserId: "",
    recipientRole: "employee",
    totalEquity: "",
    startDate: new Date().toISOString().slice(0, 10),
    cliffMonths: DEFAULT_CLIFF.toString(),
    vestingMonths: DEFAULT_VESTING.toString(),
  });

  const [reinvestInputs, setReinvestInputs] = useState<Record<string, string>>({});
  const [roleForm, setRoleForm] = useState({ email: "", role: "investor" });
  const [roleLookup, setRoleLookup] = useState<{ email: string; userId: string; roles: string[] } | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  const [docForm, setDocForm] = useState({
    title: "",
    targetRole: "investor",
    signatureMethod: "native",
    externalProvider: "",
    externalUrl: "",
    bodyText: "",
  });
  const [inviteForm, setInviteForm] = useState({
    docId: "",
    email: "",
  });
  const [versionForm, setVersionForm] = useState({
    docId: "",
    bodyText: "",
  });

  const [inviteFilter, setInviteFilter] = useState({ docId: "all" });
  const [invitePage, setInvitePage] = useState(1);
  const invitePageSize = 8;

  const [signatureFilter, setSignatureFilter] = useState({ docId: "all", role: "all" });
  const [signaturePage, setSignaturePage] = useState(1);
  const signaturePageSize = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profitsRes, investorsRes, equityRes, docsRes, versionsRes] =
        await Promise.all([
        supabase
          .from("monthly_profit_tracker")
          .select("*")
          .order("month", { ascending: false }),
        supabase
          .from("investors")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("equity_allocations")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("documents")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("document_versions")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (profitsRes.error) throw profitsRes.error;
      if (investorsRes.error) throw investorsRes.error;
      if (equityRes.error) throw equityRes.error;
      if (docsRes.error) throw docsRes.error;
      if (versionsRes.error) throw versionsRes.error;

      setProfitRows((profitsRes.data || []) as ProfitRow[]);
      setInvestors((investorsRes.data || []) as Investor[]);
      setEquityAllocations((equityRes.data || []) as EquityAllocation[]);
      setDocuments((docsRes.data || []) as Document[]);
      setDocumentVersions((versionsRes.data || []) as DocumentVersion[]);
    } catch (e: any) {
      showToast(e.message || "Failed to load founder data", "error");
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
  const approvedInvestors = investors.filter((i) => i.status !== "pending" && i.status !== "rejected");
  const totalContribution = approvedInvestors.reduce((sum, i) => sum + (i.contribution || 0), 0);

  const payoutPreview = useMemo(() => {
    const map: Record<string, number> = {};
    approvedInvestors.forEach((inv) => {
      const maxReturn = inv.max_return ?? (inv.contribution || 0) * 1.5;
      const totalReceived = inv.total_received || 0;
      if (totalContribution <= 0 || investorPool <= 0) {
        map[inv.id] = 0;
        return;
      }
      const share = (inv.contribution || 0) / totalContribution;
      const payout = Math.min(share * investorPool, Math.max(0, maxReturn - totalReceived));
      map[inv.id] = Math.max(0, payout);
    });
    return map;
  }, [approvedInvestors, totalContribution, investorPool]);

  const remainingPool = Math.max(0, investorPool - Object.values(payoutPreview).reduce((a, b) => a + b, 0));

  const handleSaveProfit = async () => {
    const totalRevenue = Number(profitForm.totalRevenue || 0);
    const expenses = Number(profitForm.expenses || 0);
    const poolPercentInput = Number(profitForm.poolPercent || 0) / 100;
    const net = totalRevenue - expenses;
    try {
      const { error } = await supabase
        .from("monthly_profit_tracker")
        .upsert(
          {
            month: profitForm.month,
            total_revenue: totalRevenue,
            expenses,
            net_profit: net,
            investor_pool_percent: poolPercentInput || DEFAULT_POOL_PERCENT,
          },
          { onConflict: "month" }
        );
      if (error) throw error;
      showToast("Monthly profit saved", "success");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to save profit row", "error");
    }
  };

  const handleApproveInvestor = async (inv: Investor, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase.from("investors").update({ status }).eq("id", inv.id);
      if (error) throw error;
      showToast(`Investor ${status}`, status === "approved" ? "success" : "info");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to update investor", "error");
    }
  };

  const handleReinvest = async (inv: Investor) => {
    const amount = Number(reinvestInputs[inv.id] || 0);
    if (!amount || amount <= 0) {
      showToast("Enter a valid reinvest amount", "error");
      return;
    }
    try {
      const newContribution = (inv.contribution || 0) + amount;
      const maxReturn = newContribution * 1.5;
      const { error } = await supabase
        .from("investors")
        .update({ contribution: newContribution, max_return: maxReturn })
        .eq("id", inv.id);
      if (error) throw error;
      setReinvestInputs((prev) => ({ ...prev, [inv.id]: "" }));
      showToast("Reinvestment applied", "success");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to apply reinvestment", "error");
    }
  };

  const handleAddAllocation = async () => {
    const totalEquity = Number(allocationForm.totalEquity || 0);
    if (!allocationForm.recipientName.trim() || !totalEquity) {
      showToast("Add recipient and equity amount", "error");
      return;
    }
    try {
      let recipientUserId = allocationForm.recipientUserId.trim() || null;
      const recipientEmail = allocationForm.recipientEmail.trim();
      if (!recipientUserId && recipientEmail) {
        const { data: profile, error: lookupError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", recipientEmail)
          .single();
        if (lookupError || !profile?.id) {
          showToast("Recipient email not found", "error");
          return;
        }
        recipientUserId = profile.id;
      }

      const { error } = await supabase.from("equity_allocations").insert({
        recipient_name: allocationForm.recipientName.trim(),
        recipient_role: allocationForm.recipientRole,
        recipient_user_id: recipientUserId,
        total_equity: totalEquity,
        start_date: allocationForm.startDate,
        cliff_months: Number(allocationForm.cliffMonths || DEFAULT_CLIFF),
        vesting_months: Number(allocationForm.vestingMonths || DEFAULT_VESTING),
      });
      if (error) throw error;
      showToast("Equity allocation added", "success");
      setAllocationForm({
        recipientName: "",
        recipientEmail: "",
        recipientUserId: "",
        recipientRole: "employee",
        totalEquity: "",
        startDate: new Date().toISOString().slice(0, 10),
        cliffMonths: DEFAULT_CLIFF.toString(),
        vestingMonths: DEFAULT_VESTING.toString(),
      });
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to add allocation", "error");
    }
  };

  const totalAllocatedEquity = equityAllocations.reduce((sum, a) => sum + (a.total_equity || 0), 0);

  const handleAssignRole = async () => {
    const email = roleForm.email.trim();
    if (!email) {
      showToast("Enter a user email", "error");
      return;
    }
    try {
      const { data: profile, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (lookupError || !profile?.id) {
        showToast("User not found", "error");
        return;
      }

      const { error } = await supabase.from("user_roles").insert({
        user_id: profile.id,
        role: roleForm.role,
      });
      if (error) throw error;
      showToast("Role assigned", "success");
      if (roleLookup && roleLookup.userId === profile.id) {
        setRoleLookup((prev) =>
          prev && !prev.roles.includes(roleForm.role)
            ? { ...prev, roles: [...prev.roles, roleForm.role].sort() }
            : prev
        );
      }
      setRoleForm({ email: "", role: "investor" });
    } catch (e: any) {
      if (e?.code === "23505") {
        showToast("User already has this role", "info");
        return;
      }
      showToast(e.message || "Failed to assign role", "error");
    }
  };

  const handleCreateDocument = async () => {
    if (!docForm.title.trim() || !docForm.bodyText.trim()) {
      showToast("Add document title and body", "error");
      return;
    }
    try {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          title: docForm.title.trim(),
          target_role: docForm.targetRole,
          signature_method: docForm.signatureMethod,
          external_provider: docForm.externalProvider.trim() || null,
          external_url: docForm.externalUrl.trim() || null,
          is_active: true,
        })
        .select("*")
        .single();
      if (docError) throw docError;
      const { error: verError } = await supabase.from("document_versions").insert({
        document_id: doc.id,
        version: 1,
        body_text: docForm.bodyText,
      });
      if (verError) throw verError;
      showToast("Document created", "success");
      setDocForm({
        title: "",
        targetRole: "investor",
        signatureMethod: "native",
        externalProvider: "",
        externalUrl: "",
        bodyText: "",
      });
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to create document", "error");
    }
  };

  const handleInviteUser = async () => {
    const email = inviteForm.email.trim();
    if (!inviteForm.docId || !email) {
      showToast("Select document and enter email", "error");
      return;
    }
    try {
      const { data: profile, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (lookupError || !profile?.id) {
        showToast("User not found", "error");
        return;
      }
      const { error } = await supabase.from("document_invites").insert({
        document_id: inviteForm.docId,
        invited_user_id: profile.id,
        invited_email: email,
        status: "pending",
      });
      if (error) throw error;
      showToast("Invitation sent", "success");
      setInviteForm({ docId: "", email: "" });
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to send invite", "error");
    }
  };

  const handleAddDocumentVersion = async () => {
    if (!versionForm.docId || !versionForm.bodyText.trim()) {
      showToast("Select document and add new body text", "error");
      return;
    }
    try {
      const versions = documentVersions.filter((v) => v.document_id === versionForm.docId);
      const nextVersion = (versions.sort((a, b) => b.version - a.version)[0]?.version || 0) + 1;
      const { error } = await supabase.from("document_versions").insert({
        document_id: versionForm.docId,
        version: nextVersion,
        body_text: versionForm.bodyText,
      });
      if (error) throw error;
      showToast(`Version ${nextVersion} created`, "success");
      setVersionForm({ docId: "", bodyText: "" });
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Failed to create version", "error");
    }
  };

  const handleInviteStatus = async (inviteId: string, status: "pending" | "revoked") => {
    try {
      const { error } = await supabase
        .from("document_invites")
        .update({ status, created_at: status === "pending" ? new Date().toISOString() : undefined })
        .eq("id", inviteId);
      if (error) throw error;
      showToast(status === "pending" ? "Invite resent" : "Invite revoked", "success");
      fetchInvitesPage();
    } catch (e: any) {
      showToast(e.message || "Failed to update invite", "error");
    }
  };

  const latestVersionByDoc = documents.reduce<Record<string, DocumentVersion | null>>((acc, doc) => {
    const versions = documentVersions.filter((v) => v.document_id === doc.id);
    const latest = versions.sort((a, b) => b.version - a.version)[0] || null;
    acc[doc.id] = latest;
    return acc;
  }, {});

  const filteredInvites = documentInvites.filter((invite) => {
    if (inviteFilter.docId !== "all" && invite.document_id !== inviteFilter.docId) return false;
    return true;
  });
  const inviteTotalPages = Math.max(1, Math.ceil(inviteTotalCount / invitePageSize));

  const filteredSignatures = documentSignatures.filter((sig) => {
    const version = documentVersions.find((v) => v.id === sig.document_version_id);
    const doc = documents.find((d) => d.id === version?.document_id);
    if (signatureFilter.docId !== "all" && doc?.id !== signatureFilter.docId) return false;
    if (signatureFilter.role !== "all" && doc?.target_role !== signatureFilter.role) return false;
    return true;
  });
  const signatureTotalPages = Math.max(1, Math.ceil(signatureTotalCount / signaturePageSize));

  const fetchInvitesPage = async () => {
    setInviteLoading(true);
    try {
      let query = supabase
        .from("document_invites")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (inviteFilter.docId !== "all") {
        query = query.eq("document_id", inviteFilter.docId);
      }
      const from = (invitePage - 1) * invitePageSize;
      const to = from + invitePageSize - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      setInvitePageRows((data || []) as DocumentInvite[]);
      setInviteTotalCount(count || 0);
    } catch (e: any) {
      showToast(e.message || "Failed to load invites", "error");
    } finally {
      setInviteLoading(false);
    }
  };

  const fetchSignaturesPage = async () => {
    setSignatureLoading(true);
    try {
      let versionIds: string[] | null = null;
      if (signatureFilter.docId !== "all") {
        versionIds = documentVersions
          .filter((v) => v.document_id === signatureFilter.docId)
          .map((v) => v.id);
      } else if (signatureFilter.role !== "all") {
        const docIds = documents
          .filter((d) => d.target_role === signatureFilter.role)
          .map((d) => d.id);
        versionIds = documentVersions.filter((v) => docIds.includes(v.document_id)).map((v) => v.id);
      }

      if (versionIds && versionIds.length === 0) {
        setSignaturePageRows([]);
        setSignatureTotalCount(0);
        setSignatureLoading(false);
        return;
      }

      let query = supabase
        .from("document_signatures")
        .select("*", { count: "exact" })
        .order("signed_at", { ascending: false });
      if (versionIds) {
        query = query.in("document_version_id", versionIds);
      }
      const from = (signaturePage - 1) * signaturePageSize;
      const to = from + signaturePageSize - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      setSignaturePageRows((data || []) as DocumentSignature[]);
      setSignatureTotalCount(count || 0);
    } catch (e: any) {
      showToast(e.message || "Failed to load signatures", "error");
    } finally {
      setSignatureLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitesPage();
  }, [inviteFilter.docId, invitePage]);

  useEffect(() => {
    fetchSignaturesPage();
  }, [signatureFilter.docId, signatureFilter.role, signaturePage, documents.length, documentVersions.length]);

  const handleLoadRoles = async () => {
    const email = roleForm.email.trim();
    if (!email) {
      showToast("Enter a user email", "error");
      return;
    }
    setRoleLoading(true);
    try {
      const { data: profile, error: lookupError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .single();
      if (lookupError || !profile?.id) {
        showToast("User not found", "error");
        setRoleLookup(null);
        return;
      }

      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id)
        .order("role", { ascending: true });
      if (roleError) throw roleError;

      setRoleLookup({
        email: profile.email,
        userId: profile.id,
        roles: (roleRows || []).map((r: any) => r.role),
      });
    } catch (e: any) {
      showToast(e.message || "Failed to load roles", "error");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleRemoveRole = async (role: string) => {
    if (!roleLookup) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", roleLookup.userId)
        .eq("role", role);
      if (error) throw error;
      setRoleLookup((prev) =>
        prev ? { ...prev, roles: prev.roles.filter((r) => r !== role) } : prev
      );
      showToast("Role removed", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to remove role", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Founder / CEO Dashboard</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Equity + Revenue Share Control</p>
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
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <LineChart size={14} /> Net Profit (Latest)
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(netProfit)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Month: {currentProfit?.month || "—"}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <Wallet size={14} /> Investor Pool ({Math.round(poolPercent * 100)}%)
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{formatCurrency(investorPool)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Remaining: {formatCurrency(remainingPool)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <Users size={14} /> Approved Investors
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{approvedInvestors.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">Total Invested: {formatCurrency(totalContribution)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <PieChart size={14} /> Reserved Pool
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">20% Equity</div>
          <div className="text-[10px] text-slate-400 mt-1">Allocated: {totalAllocatedEquity.toFixed(2)}%</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">Monthly Profit Tracker</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="month"
            value={profitForm.month}
            onChange={(e) => setProfitForm((prev) => ({ ...prev, month: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="Total Revenue"
            value={profitForm.totalRevenue}
            onChange={(e) => setProfitForm((prev) => ({ ...prev, totalRevenue: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="Expenses"
            value={profitForm.expenses}
            onChange={(e) => setProfitForm((prev) => ({ ...prev, expenses: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="Investor Pool %"
            value={profitForm.poolPercent}
            onChange={(e) => setProfitForm((prev) => ({ ...prev, poolPercent: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={handleSaveProfit}
          className="mt-4 w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700"
        >
          Save Monthly Profit
        </button>
        {profitRows.length > 0 && (
          <div className="mt-4 space-y-2">
            {profitRows.slice(0, 4).map((row) => (
              <div key={row.id} className="flex justify-between text-xs text-slate-500 font-bold">
                <span>{row.month}</span>
                <span>{formatCurrency(row.net_profit || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">Investors Management</h3>
        {loading ? (
          <div className="text-center text-xs text-slate-400 py-6">Loading investors…</div>
        ) : investors.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-6">No investors yet.</div>
        ) : (
          <div className="space-y-3">
            {investors.map((inv) => {
              const maxReturn = inv.max_return ?? (inv.contribution || 0) * 1.5;
              const received = inv.total_received || 0;
              const remainingCap = Math.max(0, maxReturn - received);
              const preview = payoutPreview[inv.id] || 0;
              return (
                <div key={inv.id} className="border border-slate-100 rounded-2xl p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{inv.name || inv.email || "Investor"}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{inv.status || "pending"}</p>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-600">
                      <div>Invested: {formatCurrency(inv.contribution)}</div>
                      <div>Max Return: {formatCurrency(maxReturn)}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-500">
                    <div className="bg-slate-50 rounded-xl p-2">
                      Received<br />{formatCurrency(received)}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      Remaining Cap<br />{formatCurrency(remainingCap)}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      This Month<br />{formatCurrency(preview)}
                    </div>
                  </div>
                  {inv.status === "pending" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleApproveInvestor(inv, "rejected")}
                        className="py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-black flex items-center justify-center gap-1"
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveInvestor(inv, "approved")}
                        className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1"
                      >
                        <Check size={14} /> Approve
                      </button>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      placeholder="Reinvest amount"
                      value={reinvestInputs[inv.id] || ""}
                      onChange={(e) =>
                        setReinvestInputs((prev) => ({ ...prev, [inv.id]: e.target.value }))
                      }
                      className="flex-1 p-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => handleReinvest(inv)}
                      className="px-3 rounded-xl bg-slate-900 text-white text-xs font-black"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-10">
        <h3 className="text-sm font-black text-slate-800 mb-4">Reserved Pool & Equity Allocations</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Recipient name"
            value={allocationForm.recipientName}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, recipientName: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="email"
            placeholder="Recipient email (lookup)"
            value={allocationForm.recipientEmail}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, recipientEmail: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="Recipient user id (optional)"
            value={allocationForm.recipientUserId}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, recipientUserId: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <select
            value={allocationForm.recipientRole}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, recipientRole: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="founder">Founder</option>
            <option value="employee">Employee (ESOP)</option>
            <option value="advisor">Advisor</option>
            <option value="investor">Investor</option>
            <option value="treasury">Treasury</option>
          </select>
          <input
            type="number"
            placeholder="Total equity %"
            value={allocationForm.totalEquity}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, totalEquity: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="date"
            value={allocationForm.startDate}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, startDate: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="Cliff months"
            value={allocationForm.cliffMonths}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, cliffMonths: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="Vesting months"
            value={allocationForm.vestingMonths}
            onChange={(e) => setAllocationForm((prev) => ({ ...prev, vestingMonths: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={handleAddAllocation}
          className="mt-4 w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Add Allocation
        </button>

        <div className="mt-4 space-y-2">
          {equityAllocations.length === 0 ? (
            <p className="text-xs text-slate-400">No allocations yet.</p>
          ) : (
            equityAllocations.map((alloc) => {
              const vested = calculateVested(alloc);
              return (
                <div key={alloc.id} className="flex justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-2">
                  <div>
                    <div className="text-slate-800">{alloc.recipient_name}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{alloc.recipient_role}</div>
                  </div>
                  <div className="text-right">
                    <div>{alloc.total_equity}% total</div>
                    <div className="text-[10px] text-slate-400">Vested: {vested.toFixed(2)}%</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-10">
        <h3 className="text-sm font-black text-slate-800 mb-4">Role Assignment</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="email"
            placeholder="User email"
            value={roleForm.email}
            onChange={(e) => setRoleForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          />
          <select
            value={roleForm.role}
            onChange={(e) => setRoleForm((prev) => ({ ...prev, role: e.target.value }))}
            className="w-full p-3 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="admin">Admin</option>
            <option value="founder">Founder</option>
            <option value="ceo">CEO</option>
            <option value="investor">Investor</option>
            <option value="employee">Employee</option>
            <option value="advisor">Advisor</option>
          </select>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleAssignRole}
            className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest"
          >
            Assign Role
          </button>
          <button
            onClick={handleLoadRoles}
            className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest"
          >
            {roleLoading ? "Loading..." : "Load Roles"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {!roleLookup && (
            <p className="text-[10px] text-slate-400">
              Load roles to view/remove existing roles for a user.
            </p>
          )}
          {roleLookup && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Roles for {roleLookup.email}
              </div>
              {roleLookup.roles.length === 0 ? (
                <p className="text-xs text-slate-500 mt-2">No roles assigned.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {roleLookup.roles.map((role) => (
                    <div key={role} className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{role}</span>
                      <button
                        onClick={() => handleRemoveRole(role)}
                        className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-black uppercase"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-10">
        <h3 className="text-sm font-black text-slate-800 mb-4">Agreements & Invitations</h3>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 mb-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Create Agreement</h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Agreement title"
              value={docForm.title}
              onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            />
            <select
              value={docForm.targetRole}
              onChange={(e) => setDocForm((prev) => ({ ...prev, targetRole: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="founder">Founder</option>
              <option value="investor">Investor</option>
              <option value="employee">Employee</option>
              <option value="advisor">Advisor</option>
              <option value="contractor">Contractor</option>
              <option value="vendor">Vendor</option>
              <option value="board">Board</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={docForm.signatureMethod}
              onChange={(e) => setDocForm((prev) => ({ ...prev, signatureMethod: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="native">Native Signature</option>
              <option value="external">External Only</option>
              <option value="both">Both (external + native)</option>
            </select>
            <input
              type="text"
              placeholder="External provider (optional)"
              value={docForm.externalProvider}
              onChange={(e) => setDocForm((prev) => ({ ...prev, externalProvider: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="External URL (optional)"
              value={docForm.externalUrl}
              onChange={(e) => setDocForm((prev) => ({ ...prev, externalUrl: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500 col-span-2"
            />
          </div>
          <textarea
            placeholder="Agreement body (plain text)"
            value={docForm.bodyText}
            onChange={(e) => setDocForm((prev) => ({ ...prev, bodyText: e.target.value }))}
            className="mt-3 w-full min-h-[140px] p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleCreateDocument}
            className="mt-3 w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
          >
            Create Agreement
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 mb-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Send Invitation</h4>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={inviteForm.docId}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, docId: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="">Select agreement</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.target_role})
                </option>
              ))}
            </select>
            <input
              type="email"
              placeholder="Invitee email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={handleInviteUser}
            className="mt-3 w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest"
          >
            Send Invitation
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 mb-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Create New Version</h4>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={versionForm.docId}
              onChange={(e) => setVersionForm((prev) => ({ ...prev, docId: e.target.value }))}
              className="w-full p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="">Select agreement</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} (latest v{latestVersionByDoc[doc.id]?.version || 1})
                </option>
              ))}
            </select>
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-end">
              New version will auto-increment
            </div>
          </div>
          <textarea
            placeholder="New version body text"
            value={versionForm.bodyText}
            onChange={(e) => setVersionForm((prev) => ({ ...prev, bodyText: e.target.value }))}
            className="mt-3 w-full min-h-[120px] p-3 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleAddDocumentVersion}
            className="mt-3 w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
          >
            Create New Version
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <select
              value={inviteFilter.docId}
              onChange={(e) => {
                setInviteFilter({ docId: e.target.value });
                setInvitePage(1);
              }}
              className="w-full p-2 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="all">All agreements</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
            <div className="text-[10px] font-black uppercase text-slate-400">
              Page {invitePage} / {inviteTotalPages}
            </div>
          </div>

          {inviteLoading ? (
            <p className="text-xs text-slate-400">Loading invitations...</p>
          ) : inviteTotalCount === 0 ? (
            <p className="text-xs text-slate-400">No invitations yet.</p>
          ) : (
            invitePageRows.map((invite) => {
              const doc = documents.find((d) => d.id === invite.document_id);
              return (
                <div key={invite.id} className="flex justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-2">
                  <div>
                    <div className="text-slate-800">{doc?.title || "Agreement"}</div>
                    <div className="text-[10px] text-slate-400 uppercase">
                      {invite.invited_email || invite.invited_user_id}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="capitalize">{invite.status}</div>
                    <div className="text-[10px] text-slate-400">{new Date(invite.created_at || "").toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleInviteStatus(invite.id, "pending")}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600"
                    >
                      Resend
                    </button>
                    <button
                      onClick={() => handleInviteStatus(invite.id, "revoked")}
                      className="px-2 py-1 rounded-lg border border-rose-200 text-[10px] font-black uppercase text-rose-600"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {inviteTotalCount > invitePageSize && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setInvitePage((p) => Math.max(1, p - 1))}
                disabled={invitePage <= 1}
                className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setInvitePage((p) => Math.min(inviteTotalPages, p + 1))}
                disabled={invitePage >= inviteTotalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-10">
        <h3 className="text-sm font-black text-slate-800 mb-4">Signature Audit</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            value={signatureFilter.docId}
            onChange={(e) => {
              setSignatureFilter((prev) => ({ ...prev, docId: e.target.value }));
              setSignaturePage(1);
            }}
            className="w-full p-2 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="all">All agreements</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
          <select
            value={signatureFilter.role}
            onChange={(e) => {
              setSignatureFilter((prev) => ({ ...prev, role: e.target.value }));
              setSignaturePage(1);
            }}
            className="w-full p-2 rounded-xl text-xs font-bold bg-white border border-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="all">All roles</option>
            <option value="founder">Founder</option>
            <option value="investor">Investor</option>
            <option value="employee">Employee</option>
            <option value="advisor">Advisor</option>
            <option value="contractor">Contractor</option>
            <option value="vendor">Vendor</option>
            <option value="board">Board</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {signatureLoading ? (
          <p className="text-xs text-slate-400">Loading signatures...</p>
        ) : signatureTotalCount === 0 ? (
          <p className="text-xs text-slate-400">No signatures yet.</p>
        ) : (
          <div className="space-y-2">
            {signaturePageRows.map((sig) => {
              const version = documentVersions.find((v) => v.id === sig.document_version_id);
              const doc = documents.find((d) => d.id === version?.document_id);
              return (
                <div key={sig.id} className="flex justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-2">
                  <div>
                    <div className="text-slate-800">{doc?.title || "Agreement"}</div>
                    <div className="text-[10px] text-slate-400 uppercase">
                      v{version?.version || "?"} · {sig.typed_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="capitalize">{sig.signature_method}</div>
                    <div className="text-[10px] text-slate-400">
                      {sig.signed_at ? new Date(sig.signed_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {signatureTotalCount > signaturePageSize && (
          <div className="flex items-center justify-between pt-3">
            <button
              onClick={() => setSignaturePage((p) => Math.max(1, p - 1))}
              disabled={signaturePage <= 1}
              className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 disabled:opacity-40"
            >
              Prev
            </button>
            <div className="text-[10px] font-black uppercase text-slate-400">
              Page {signaturePage} / {signatureTotalPages}
            </div>
            <button
              onClick={() => setSignaturePage((p) => Math.min(signatureTotalPages, p + 1))}
              disabled={signaturePage >= signatureTotalPages}
              className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FounderDashboard;
