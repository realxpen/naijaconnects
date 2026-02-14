import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const bodyText = await req.text();
    if (!bodyText) return new Response("Empty body", { status: 400 });

    const body = JSON.parse(bodyText);
    const payload = body.payload ?? body.data ?? body;
    const reference =
      payload.reference ||
      payload.outTradeNo ||
      payload.merchantTradeNo ||
      payload.merchantOrderNo ||
      payload.orderReference ||
      payload.txnRef;

    if (!reference) {
      return new Response("Invalid payload", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, user_id, user_email, amount, meta")
      .eq("reference", reference)
      .single();

    if (txnError || !txn) {
      return new Response("Transaction not found", { status: 200 });
    }

    const rawStatus = String(
      payload.status ||
      payload.transactionStatus ||
      payload.resultCode ||
      payload.code ||
      ""
    ).toUpperCase();

    const isSuccess =
      rawStatus === "SUCCESS" ||
      rawStatus === "SUCCESSFUL" ||
      rawStatus === "COMPLETED" ||
      rawStatus === "PAID" ||
      rawStatus === "00000";

    const isFailed =
      rawStatus === "FAIL" ||
      rawStatus === "FAILED" ||
      rawStatus === "CANCELLED" ||
      rawStatus === "REVERSED";

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
            // Recover from missing profile rows so successful payments are not stranded.
            const created = await supabase
              .from("profiles")
              .insert({
                id: txn.user_id,
                email: txn.user_email,
                wallet_balance: 0,
              })
              .select("id, wallet_balance")
              .single();
            if (created.error || !created.data?.id) throw created.error || new Error("Failed to create profile");
            targetProfileId = created.data.id;
            profileBalance = Number(created.data.wallet_balance) || 0;
          }
        }

        if (!targetProfileId) throw new Error("Profile not found for credit operation");

        const currentBalance = profileBalance;
        const depositAmount = Number(txn.amount) || 0;
        const newBalance = currentBalance + depositAmount;

        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", targetProfileId);
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
