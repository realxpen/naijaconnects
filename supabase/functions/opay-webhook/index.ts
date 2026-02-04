import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const OPAY_SECRET_KEY = Deno.env.get('OPAY_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!OPAY_SECRET_KEY) throw new Error("Missing OPAY_SECRET_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const body = await req.json();
    const payload = body?.payload;
    const providedSig = body?.sha512;

    if (!payload || !providedSig) {
      return new Response(JSON.stringify({ status: false, message: "Invalid payload" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const sortedPayload = JSON.stringify(sortKeys(payload));
    const computedSig = await hmacSha512(sortedPayload, OPAY_SECRET_KEY);

    if (computedSig !== providedSig) {
      return new Response(JSON.stringify({ status: false, message: "Invalid signature" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    if ((payload.status || "").toUpperCase() !== "SUCCESS") {
      return new Response(JSON.stringify({ status: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const reference = payload.reference;
    const amountVal = Number(payload.amount);
    if (!reference || !amountVal) {
      return new Response(JSON.stringify({ status: false, message: "Missing reference or amount" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: pendingTx } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, status, user_email')
      .eq('reference', reference)
      .single();

    if (pendingTx?.status === 'Success') {
      return new Response(JSON.stringify({ status: true, already: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (pendingTx && Number(pendingTx.amount) !== Number(amountVal)) {
      return new Response(JSON.stringify({ status: false, message: "Amount mismatch" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (!pendingTx?.user_email) {
      return new Response(JSON.stringify({ status: false, message: "User email not found for transaction" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('fund_wallet_secure', {
      user_email_input: pendingTx.user_email,
      amount_input: amountVal,
      ref_input: reference
    });
    if (rpcError || !rpcResult?.success) {
      throw new Error(rpcError?.message || rpcResult?.message || "Funding failed");
    }

    if (pendingTx?.id) {
      await supabaseAdmin.from('transactions').update({ status: 'Success' }).eq('id', pendingTx.id);
    } else {
      await supabaseAdmin.from('transactions').insert({
        user_email: pendingTx?.user_email || "",
        reference,
        amount: amountVal,
        type: 'Deposit',
        status: 'Success'
      });
    }

    return new Response(JSON.stringify({ status: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ status: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})
