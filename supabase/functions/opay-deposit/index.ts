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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 5. Verify User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth Error Details:", userError); 
      return new Response(JSON.stringify({ 
        error: "User Validation Failed", 
        details: userError?.message || "Unknown auth error" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Create Admin Client (For Database Inserts)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 7. Parse Body & Payment Method
    const { amount, email, name, method } = await req.json();
    if (!amount) throw new Error("Amount is required");

    const depositAmount = parseFloat(amount);

    // --- FEE CALCULATION LOGIC ---
    // Change this value if you want to charge a fee (e.g. 50 Naira)
    const FEE = 0; 
    
    // User pays: Amount + Fee
    const totalPayable = depositAmount + FEE; 
    
    // OPay expects Kobo (Total Amount)
    const amountInKobo = (totalPayable * 100).toFixed(0); 
    // -----------------------------

    // Validate Method (Default to BankCard if invalid or missing)
    const validMethods = ["BankCard", "BankTransfer", "BankUssd", "OpayWalletNgQR"];
    const payMethod = validMethods.includes(method) ? method : "BankCard";

    // 8. Generate Reference
    const reference = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 9. Create Pending Transaction Record
    const { error: dbError } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      reference: reference,
      amount: depositAmount, // We credit the User ONLY the amount they asked for (excluding fee)
      type: "deposit",
      status: "pending",
      description: `Deposit via ${payMethod}`,
      meta: {
        fee: FEE,
        total_paid: totalPayable,
        gateway: "opay"
      }
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
        total: amountInKobo, // Charging Amount + Fee
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
