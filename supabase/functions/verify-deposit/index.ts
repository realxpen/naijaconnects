import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sortKeys = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

const hmacSha512 = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const OPAY_SECRET_KEY = Deno.env.get('OPAY_SECRET_KEY')
    const OPAY_MERCHANT_ID = Deno.env.get('OPAY_MERCHANT_ID')
    const OPAY_BASE_URL = Deno.env.get('OPAY_BASE_URL') || "https://sandboxapi.opaycheckout.com"
    const OPAY_COUNTRY = Deno.env.get('OPAY_COUNTRY') || "NG"
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!OPAY_SECRET_KEY || !OPAY_MERCHANT_ID) throw new Error("Missing OPay keys");

    const { reference } = await req.json();
    console.log(`Verifying Deposit Ref: ${reference}`);

    // 1. Verify with OPay Cashier Status
    const statusPayload = { country: OPAY_COUNTRY, reference };
    const sortedPayload = JSON.stringify(sortKeys(statusPayload));
    const signature = await hmacSha512(sortedPayload, OPAY_SECRET_KEY);

    const statusRes = await fetch(`${OPAY_BASE_URL}/api/v1/international/cashier/status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${signature}`,
        MerchantId: OPAY_MERCHANT_ID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(statusPayload)
    });
    const statusData = await statusRes.json();

    if (statusData.code !== "00000") {
      throw new Error(statusData.message || "Failed to verify payment");
    }

    const status = statusData.data?.status;
    if (status !== "SUCCESS") {
      throw new Error(`Payment status: ${status || "UNKNOWN"}`);
    }

    const amountVal = Number(statusData.data?.amount);
    if (!amountVal) throw new Error("Missing amount from status");

    // 2. Initialize Admin Client
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 2a. Validate against pending transaction (if exists)
    const { data: pendingTx } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, status, user_email')
      .eq('reference', reference)
      .single();

    if (pendingTx?.status === 'Success') {
      return new Response(JSON.stringify({ success: true, balance: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (pendingTx && Number(pendingTx.amount) !== Number(amountVal)) {
      throw new Error("Amount mismatch. Verification failed.");
    }

    // 3. Call the SQL Function
    if (!pendingTx) throw new Error("Pending transaction not found");

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('fund_wallet_secure', {
      user_email_input: pendingTx.user_email,
      amount_input: amountVal,
      ref_input: reference
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error(`Database Error: ${rpcError.message}`);
    }

    if (!rpcResult.success) {
      throw new Error(rpcResult.message); 
    }

    // 4. Mark transaction success (if we created it earlier)
    if (pendingTx?.id) {
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'Success' })
        .eq('id', pendingTx.id);
    }

    return new Response(JSON.stringify({ success: true, balance: rpcResult.new_balance }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Verify Deposit Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})
