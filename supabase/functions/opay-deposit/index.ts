import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Check for missing secrets
    const merchantId = Deno.env.get("OPAY_MERCHANT_ID");
    const publicKey = Deno.env.get("OPAY_PUBLIC_KEY");
    const baseUrl = Deno.env.get("OPAY_BASE_URL");

    if (!merchantId || !publicKey || !baseUrl) {
      throw new Error("Missing Server Secrets (OPAY_MERCHANT_ID, OPAY_PUBLIC_KEY, etc)");
    }

    // 3. Get Auth Header
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization Header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create User-Scoped Supabase Client (For Auth Verification)
    // This is the standard way to verify the user in Edge Functions
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 5. Verify User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth Error Details:", userError); // Log to Supabase Dashboard
      return new Response(JSON.stringify({ 
        error: "User Validation Failed", 
        details: userError?.message || "Unknown auth error" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Create Admin Client (For Database Inserts)
    // We use the Service Role key here to bypass RLS when creating the transaction
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 7. Parse Body
    const { amount, email, name } = await req.json();
    if (!amount) throw new Error("Amount is required");

    // 8. Generate Reference
    const reference = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const amountInKobo = (parseFloat(amount) * 100).toString();

    // 9. Create Pending Transaction Record
    const { error: dbError } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      reference: reference,
      amount: amount,
      type: "deposit",
      status: "pending"
    });

    if (dbError) {
      console.error("DB Insert Error:", dbError);
      throw new Error(`Database Error: ${dbError.message}`);
    }

    // 10. Call OPay Cashier API
    const payload = {
      country: "NG",
      reference: reference,
      amount: {
        total: amountInKobo,
        currency: "NGN",
      },
      returnUrl: req.headers.get("origin") || "http://localhost:3000",
      callbackUrl: "https://xsidcywceipiyybqeouc.supabase.co/functions/v1/opay-webhook",
      userInfo: {
        userEmail: email || user.email,
        userId: user.id,
        userName: name || "Customer"
      },
      payMethod: "BankCard",
      product: {
        name: "Wallet Topup",
        description: "Deposit to user wallet"
      }
    };

    console.log("Sending Payload to OPay:", JSON.stringify(payload));

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
    
    // Log OPay response for debugging
    console.log("OPay API Response:", data);

    if (data.code !== "00000") {
      throw new Error(`OPay Failed: ${data.message || "Unknown error"}`);
    }

    // 11. Return Success
    return new Response(JSON.stringify({ 
      url: data.data.cashierUrl, 
      reference: reference 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("General Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});