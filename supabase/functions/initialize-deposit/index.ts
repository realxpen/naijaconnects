import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log("initialize-deposit hit");
    const OPAY_PUBLIC_KEY = Deno.env.get('OPAY_PUBLIC_KEY')
    const OPAY_MERCHANT_ID = Deno.env.get('OPAY_MERCHANT_ID')
    const OPAY_BASE_URL = Deno.env.get('OPAY_BASE_URL') || "https://sandboxapi.opaycheckout.com"
    const OPAY_RETURN_URL = Deno.env.get('OPAY_RETURN_URL')
    const OPAY_CALLBACK_URL = Deno.env.get('OPAY_CALLBACK_URL')
    const OPAY_CANCEL_URL = Deno.env.get('OPAY_CANCEL_URL')
    const OPAY_COUNTRY = Deno.env.get('OPAY_COUNTRY') || "NG"
    const OPAY_CURRENCY = Deno.env.get('OPAY_CURRENCY') || "NGN"
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!OPAY_PUBLIC_KEY || !OPAY_MERCHANT_ID) throw new Error("Missing OPay keys");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const { email, amount } = await req.json();
    console.log("initialize-deposit payload", { email, amount });
    if (!email || !amount) throw new Error("Missing email or amount");
    if (!OPAY_RETURN_URL || !OPAY_CALLBACK_URL) throw new Error("Missing OPay return/callback URL");

    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum < 100) throw new Error("Invalid amount");

    const reference = `dep_${crypto.randomUUID()}`.toLowerCase();

    // 1. Initialize OPay Cashier Payment
    const initRes = await fetch(`${OPAY_BASE_URL}/api/v1/international/cashier/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPAY_PUBLIC_KEY}`,
        MerchantId: OPAY_MERCHANT_ID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        country: OPAY_COUNTRY,
        reference,
        amount: {
          total: Math.round(amountNum * 100),
          currency: OPAY_CURRENCY
        },
        returnUrl: OPAY_RETURN_URL,
        callbackUrl: OPAY_CALLBACK_URL,
        cancelUrl: OPAY_CANCEL_URL || OPAY_RETURN_URL,
        customerVisitSource: "BROWSER",
        userInfo: {
          userEmail: email
        },
        product: {
          name: "Wallet Funding",
          description: "NaijaConnect wallet top-up"
        }
      })
    });
    const initData = await initRes.json();
    if (initData.code !== "00000") throw new Error(initData.message || "Failed to initialize transaction");
    if (!initData.data?.cashierUrl) throw new Error("No cashierUrl returned");

    // 2. Insert Pending Transaction
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabaseAdmin.from('transactions').insert({
      user_email: email,
      reference,
      amount: amountNum,
      type: 'Deposit',
      status: 'Pending'
    });

    return new Response(JSON.stringify({
      success: true,
      reference: initData.data?.reference,
      cashier_url: initData.data?.cashierUrl,
      order_no: initData.data?.orderNo
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})
