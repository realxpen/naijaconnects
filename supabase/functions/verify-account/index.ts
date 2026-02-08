import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      throw new Error("Missing account number or bank code");
    }

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) throw new Error("Server configuration error");

    // Call Paystack API (GET request as per docs)
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.status === false) {
      // Paystack returns 422 or 400 if account is invalid
      return new Response(JSON.stringify({ valid: false, message: "Could not resolve account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success! Return the name.
    return new Response(JSON.stringify({ 
      valid: true, 
      account_name: data.data.account_name,
      account_number: data.data.account_number 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});