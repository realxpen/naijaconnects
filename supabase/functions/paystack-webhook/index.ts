Set-Content -Path "supabase/functions/opay-webhook/index.ts" -Value 'import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha3_512 } from "https://esm.sh/js-sha3@0.8.0";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const secretKey = Deno.env.get("OPAY_SECRET_KEY")!;
    
    // Check for empty body
    const bodyText = await req.text();
    if (!bodyText) return new Response("Empty body", { status: 400 });

    const body = JSON.parse(bodyText);
    const payload = body.payload;

    if (!payload || !payload.reference) {
       return new Response("Invalid payload", { status: 200 });
    }

    // 1. Calculate Signature (HMAC-SHA3-512)
    const calculatedSignature = sha3_512.hmac(secretKey, JSON.stringify(payload));
    
    // 2. Find Transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, user_id, amount")
      .eq("reference", payload.reference)
      .single();

    if (txnError || !txn) {
      console.error("Transaction not found:", payload.reference);
      return new Response("Transaction not found", { status: 200 });
    }

    // 3. Update Status
    const opayStatus = payload.status; 

    if (opayStatus === "SUCCESS" && txn.status !== "success") {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ 
          status: "success", 
          opay_order_no: payload.orderNo,
          updated_at: new Date().toISOString() 
        })
        .eq("id", txn.id);

      if (updateError) throw updateError;

      // Update User Balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", txn.user_id)
        .single();
        
      if (profile) {
          const newBalance = (profile.balance || 0) + Number(txn.amount);
          await supabase
            .from("profiles")
            .update({ balance: newBalance })
            .eq("id", txn.user_id);
      }
      
    } else if (opayStatus === "FAIL") {
       await supabase
        .from("transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", txn.id);
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});'