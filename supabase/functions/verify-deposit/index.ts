import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!PAYSTACK_SECRET_KEY) throw new Error("Missing PAYSTACK_SECRET_KEY");

    const { reference } = await req.json();
    console.log(`Verifying Deposit Ref: ${reference}`);

    // 1. Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const paystackData = await paystackRes.json();

    // Check strict success status
    if (!paystackData.status || paystackData.data.status !== 'success') {
      console.error("Paystack Status Failed:", paystackData);
      throw new Error('Transaction was not successful on Paystack');
    }

    const email = paystackData.data.customer.email;
    const amountVal = paystackData.data.amount / 100; // Convert Kobo to Naira

    // 2. Initialize Admin Client
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 3. Call the SQL Function
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('fund_wallet_secure', {
      user_email_input: email,
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