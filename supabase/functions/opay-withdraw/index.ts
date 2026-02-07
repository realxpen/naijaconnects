import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper for HMAC-SHA512 (Standard SHA-512 for Requests)
async function generateHmacSha512(key: string, data: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error("Unauthorized");

    // Input: original_reference (The deposit ID to refund back to)
    const { amount, original_reference } = await req.json();

    const merchantId = Deno.env.get("OPAY_MERCHANT_ID")!;
    const secretKey = Deno.env.get("OPAY_SECRET_KEY")!;
    const baseUrl = Deno.env.get("OPAY_BASE_URL")!;
    
    const newReference = `REFUND-${Date.now()}`;
    const amountInKobo = (parseFloat(amount) * 100);

    // 2. Prepare Payload
    // Keys MUST be sorted alphabetically for OPay signature verification usually, 
    // but the library handles standard JSON. 
    // Note: The Docs for Refund imply specific parameter ordering isn't strictly enforced for JSON bodies 
    // unless using specific SDKs, but best practice is to keep it clean.
    const payloadData = {
      amount: {
        currency: "NGN",
        total: amountInKobo
      },
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/opay-webhook`,
      country: "NG",
      originalReference: original_reference,
      reference: newReference,
      refundWay: "Original"
    };

    const payloadString = JSON.stringify(payloadData);

    // 3. Generate Signature (HMAC-SHA512)
    const signature = await generateHmacSha512(secretKey, payloadString);

    // 4. Record in DB
    await supabase.from('transactions').insert({
      user_id: user.id,
      reference: newReference,
      original_reference: original_reference,
      amount: amount,
      type: 'withdrawal', // Actually a refund
      status: 'pending',
      currency: 'NGN'
    });

    // 5. Call OPay Refund API
    const response = await fetch(`${baseUrl}/api/v1/international/payment/refund/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${signature}`,
        "MerchantId": merchantId,
      },
      body: payloadString,
    });

    const data = await response.json();

    if (data.code !== "00000") {
      await supabase.from('transactions').update({ status: 'failed' }).eq('reference', newReference);
      throw new Error(data.message || "Refund Failed");
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});