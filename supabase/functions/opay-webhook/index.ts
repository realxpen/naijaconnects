import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { sha3_512 } from "https://esm.sh/js-sha3@0.8.0"; // Optional: Uncomment if you enforce strict security later

serve(async (req) => {
  console.log("🔔 Webhook received!");

  try {
    // 1. Parse Body safely
    const bodyText = await req.text();
    if (!bodyText) return new Response("Empty body", { status: 400 });

    const body = JSON.parse(bodyText);
    const payload = body.payload ?? body.data ?? body;
    console.log("📦 Payload:", JSON.stringify(payload)); // Log payload to see what OPay sends

    // 2. Get Reference (Handle both 'reference' and 'outTradeNo')
    const reference = payload.reference || payload.outTradeNo;
    
    if (!reference) {
      console.error("❌ No reference found in payload");
      return new Response("Invalid payload", { status: 200 });
    }

    // 3. Setup Supabase Admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Find Transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, user_id, amount")
      .eq("reference", reference)
      .single();

    if (txnError || !txn) {
      console.error(`❌ Transaction not found: ${reference}`);
      return new Response("Transaction not found", { status: 200 });
    }

    // 5. Check Status (The Fix: Added "00000" and "INITIAL")
    // OPay uses "00000" or "SUCCESS" for success. "INITIAL" means pending.
    const rawStatus = String(payload.status || payload.code || "").toUpperCase();
    
    // Log the status we found so you can debug
    console.log(`🔎 Txn: ${reference}, OPay Status: ${rawStatus}, DB Status: ${txn.status}`);

    const isSuccess = rawStatus === "SUCCESS" || rawStatus === "SUCCESSFUL" || rawStatus === "00000";
    const isFailed = rawStatus === "FAIL" || rawStatus === "FAILED";

    // 6. Process Success
    if (isSuccess && txn.status !== "success") {
      console.log(`✅ Marking ${reference} as success...`);

      // A. Update Transaction Status
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ 
          status: "success", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", txn.id);

      if (updateError) {
        console.error("❌ Failed to update transaction:", updateError);
        throw updateError;
      }

      // B. Update User Balance (The Critical Part)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("id", txn.user_id)
        .single();

      if (profileError || !profile) {
        console.error("❌ Profile not found for user:", txn.user_id);
      } else {
        const currentBalance = Number(profile.wallet_balance) || 0;
        const depositAmount = Number(txn.amount);
        const newBalance = currentBalance + depositAmount;

        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", txn.user_id);

        if (balanceError) {
          console.error("❌ Balance update failed:", balanceError);
        } else {
          console.log(`💰 Balance Updated! User: ${txn.user_id}, ${currentBalance} -> ${newBalance}`);
        }
      }
      
    } else if (isFailed) {
       console.log(`⚠️ Marking ${reference} as failed.`);
       await supabase
        .from("transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", txn.id);
    } else {
       console.log(`ℹ️ Status '${rawStatus}' is not final. Skipping.`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("🔥 Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
