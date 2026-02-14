import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const bodyText = await req.text();
    if (!bodyText) return new Response("Empty body", { status: 400 });

    const body = JSON.parse(bodyText);
    const payload = body.payload ?? body.data ?? body;
    const reference = payload.reference || payload.outTradeNo;

    if (!reference) {
      return new Response("Invalid payload", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, user_id, amount, meta")
      .eq("reference", reference)
      .single();

    if (txnError || !txn) {
      return new Response("Transaction not found", { status: 200 });
    }

    const rawStatus = String(payload.status || payload.code || "").toUpperCase();
    const isSuccess = rawStatus === "SUCCESS" || rawStatus === "SUCCESSFUL" || rawStatus === "00000";
    const isFailed = rawStatus === "FAIL" || rawStatus === "FAILED";

    const txnMeta = txn?.meta && typeof txn.meta === "object" ? txn.meta : {};
    const alreadyCredited = Boolean(txnMeta?.balance_credited);

    if (isSuccess) {
      if (txn.status !== "success") {
        const { error } = await supabase
          .from("transactions")
          .update({ status: "success", updated_at: new Date().toISOString() })
          .eq("id", txn.id);
        if (error) throw error;
      }

      if (!alreadyCredited) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", txn.user_id)
          .single();
        if (profileError || !profile) throw profileError || new Error("Profile not found");

        const currentBalance = Number(profile.wallet_balance) || 0;
        const depositAmount = Number(txn.amount) || 0;
        const newBalance = currentBalance + depositAmount;

        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", txn.user_id);
        if (balanceError) throw balanceError;

        const { error: metaError } = await supabase
          .from("transactions")
          .update({
            meta: {
              ...txnMeta,
              balance_credited: true,
              balance_credited_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", txn.id);
        if (metaError) throw metaError;
      }
    } else if (isFailed) {
      await supabase
        .from("transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", txn.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
