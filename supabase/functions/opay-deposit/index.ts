import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const merchantId = Deno.env.get("OPAY_MERCHANT_ID");
    const publicKey = Deno.env.get("OPAY_PUBLIC_KEY");
    const baseUrl = Deno.env.get("OPAY_BASE_URL");

    if (!merchantId || !publicKey || !baseUrl) throw new Error("Missing Secrets");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, email, name, method } = await req.json();
    if (!amount) throw new Error("Amount is required");

    const depositAmount = parseFloat(amount);
    
    // --- CALCULATE ESTIMATED FEE (For Record Keeping) ---
    // 1.5% Capped at N2000
    let estimatedFee = depositAmount * 0.015; 
    if (estimatedFee > 2000) estimatedFee = 2000;
    
    // Round to 2 decimals
    estimatedFee = Math.round(estimatedFee * 100) / 100;

    // We do NOT deduct it yet. The user pays the full amount.
    // We just record what the fee WILL be.
    // ----------------------------------------------------

    const amountInKobo = (depositAmount * 100).toFixed(0); 
    const payMethod = method || "BankCard";
    const reference = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Record as PENDING
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      user_email: user.email,
      reference: reference,
      amount: depositAmount, // Record full amount for now
      type: "deposit",
      status: "pending",
      description: `Deposit via ${payMethod}`,
      meta: { 
        gateway: "opay",
        estimated_fee: estimatedFee // <--- Save the expected fee here
      }
    });

    const payload = {
      country: "NG",
      reference: reference,
      amount: {
        total: amountInKobo,
        currency: "NGN",
      },
      returnUrl: req.headers.get("origin") || "http://localhost:3000",
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/opay-webhook`,
      userInfo: {
        userEmail: email || user.email,
        userId: user.id,
        userName: name || "Customer"
      },
      payMethod: payMethod,
      product: {
        name: "Wallet Topup",
        description: `Fund wallet with NGN ${depositAmount}`
      }
    };

    const response = await fetch(`${baseUrl}/api/v1/international/cashier/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${publicKey}`,
        "MerchantId": merchantId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.code !== "00000") throw new Error(data.message || "OPay Failed");

    return new Response(JSON.stringify({ 
      url: data.data.cashierUrl, 
      reference: reference 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
