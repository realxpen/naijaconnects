import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference || "").trim();
    if (!reference) throw new Error("Reference is required");

    const baseUrl = Deno.env.get("SQUAD_BASE_URL") || "https://sandbox-api-d.squadco.com";
    const secretKey = Deno.env.get("SQUAD_SECRET_KEY");
    if (!secretKey) throw new Error("Missing Squad configuration");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, user_id, user_email, amount, type, meta")
      .eq("reference", reference)
      .single();

    if (txnError || !txn) throw new Error("Transaction not found");

    const ownsTxn =
      (txn.user_id && txn.user_id === user.id) ||
      (txn.user_email && user.email && txn.user_email === user.email);

    if (!ownsTxn) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyResp = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    const raw = await verifyResp.text();
    let verifyData: any = null;
    try {
      verifyData = raw ? JSON.parse(raw) : {};
    } catch {
      verifyData = { raw };
    }

    if (!verifyResp.ok) {
      return new Response(JSON.stringify({
        error: verifyData?.message || verifyData?.error || "Failed to verify transaction",
        squad_response: verifyData,
      }), {
        status: verifyResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawStatus = String(
      verifyData?.data?.transaction_status ||
      verifyData?.transaction_status ||
      verifyData?.data?.status ||
      verifyData?.status ||
      "",
    ).toUpperCase();

    const isSuccess =
      rawStatus === "SUCCESS" ||
      rawStatus === "SUCCESSFUL" ||
      rawStatus === "COMPLETED" ||
      rawStatus === "PAID";

    const isFailed =
      rawStatus === "FAILED" ||
      rawStatus === "FAIL" ||
      rawStatus === "ABANDONED" ||
      rawStatus === "CANCELLED";

    const txnMeta = txn?.meta && typeof txn.meta === "object" ? txn.meta : {};
    const alreadyCredited = Boolean(txnMeta?.balance_credited);

    if (isSuccess) {
      if (txn.status !== "success") {
        const { error } = await supabase
          .from("transactions")
          .update({
            status: "success",
            updated_at: new Date().toISOString(),
            meta: {
              ...txnMeta,
              squad_status: rawStatus || null,
              squad_verify_response: verifyData?.data ?? verifyData ?? null,
            },
          })
          .eq("id", txn.id);
        if (error) throw error;
      }

      if (!alreadyCredited) {
        let targetProfileId: string | null = txn.user_id || null;
        let profileBalance = 0;

        const byId = targetProfileId
          ? await supabase
            .from("profiles")
            .select("id, wallet_balance")
            .eq("id", targetProfileId)
            .maybeSingle()
          : { data: null, error: null as any };

        if (byId.error) throw byId.error;

        if (byId.data?.id) {
          targetProfileId = byId.data.id;
          profileBalance = Number(byId.data.wallet_balance) || 0;
        } else if (txn.user_email) {
          const byEmail = await supabase
            .from("profiles")
            .select("id, wallet_balance")
            .eq("email", txn.user_email)
            .maybeSingle();
          if (byEmail.error) throw byEmail.error;
          if (byEmail.data?.id) {
            targetProfileId = byEmail.data.id;
            profileBalance = Number(byEmail.data.wallet_balance) || 0;
          } else if (txn.user_id && txn.user_email) {
            const created = await supabase
              .from("profiles")
              .insert({ id: txn.user_id, email: txn.user_email, wallet_balance: 0 })
              .select("id, wallet_balance")
              .single();
            if (created.error || !created.data?.id) {
              throw created.error || new Error("Failed to create profile");
            }
            targetProfileId = created.data.id;
            profileBalance = Number(created.data.wallet_balance) || 0;
          }
        }

        if (!targetProfileId) throw new Error("Profile not found for credit operation");

        const newBalance = profileBalance + (Number(txn.amount) || 0);
        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", targetProfileId);
        if (balanceError) throw balanceError;

        const { error: markCreditedError } = await supabase
          .from("transactions")
          .update({
            meta: {
              ...txnMeta,
              squad_status: rawStatus || null,
              squad_verify_response: verifyData?.data ?? verifyData ?? null,
              balance_credited: true,
              balance_credited_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", txn.id);
        if (markCreditedError) throw markCreditedError;
      }
    } else if (isFailed) {
      await supabase
        .from("transactions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          meta: {
            ...txnMeta,
            squad_status: rawStatus || null,
            squad_verify_response: verifyData?.data ?? verifyData ?? null,
          },
        })
        .eq("id", txn.id);
    }

    return new Response(JSON.stringify({
      success: true,
      reference,
      local_status: isSuccess ? "success" : isFailed ? "failed" : txn.status,
      squad_status: rawStatus || null,
      squad_response: verifyData?.data ?? verifyData ?? null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
