import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!PAYSTACK_SECRET_KEY) throw new Error("Missing PAYSTACK_SECRET_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || "";

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

    if (hash !== signature) {
      return jsonResponse({ status: false, message: "Invalid signature" }, 401);
    }

    const event = JSON.parse(rawBody);
    if (event?.event !== "charge.success") {
      return jsonResponse({ status: true, ignored: true });
    }

    const data = event.data || {};
    const reference = data.reference;
    const email = data.customer?.email;
    const amountVal = Number(data.amount) / 100;

    if (!reference || !email || !amountVal) {
      return jsonResponse({ status: false, message: "Missing required fields" }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: pendingTx } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, status')
      .eq('reference', reference)
      .single();

    if (pendingTx?.status === 'Success') {
      return jsonResponse({ status: true, already: true });
    }

    if (pendingTx && Number(pendingTx.amount) !== Number(amountVal)) {
      return jsonResponse({ status: false, message: "Amount mismatch" }, 400);
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('fund_wallet_secure', {
      user_email_input: email,
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
        user_email: email,
        reference,
        amount: amountVal,
        type: 'Deposit',
        status: 'Success'
      });
    }

    return jsonResponse({ status: true });
  } catch (error: any) {
    return jsonResponse({ status: false, message: error.message }, 500);
  }
})
