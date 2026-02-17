import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toChannel = (method?: string) => {
  switch (method) {
    case "BankTransfer":
      return ["transfer"];
    case "BankUssd":
      return ["ussd"];
    case "BankCard":
    default:
      return ["card"];
  }
};

const extractTransferDetails = (data: any) => {
  const root = data?.data ?? data ?? {};
  const accountNumber =
    root?.virtual_account_number ||
    root?.account_number ||
    root?.accountNumber ||
    root?.bank_account_number ||
    root?.beneficiary_account_number;
  const bankName =
    root?.bank_name ||
    root?.bank ||
    root?.bankName;
  const accountName =
    root?.account_name ||
    root?.accountName ||
    root?.beneficiary_name;
  const expiresAt =
    root?.expiry_date ||
    root?.expires_at ||
    root?.valid_till ||
    root?.transaction_expiry;

  if (!accountNumber) return null;
  return {
    account_number: String(accountNumber),
    bank_name: bankName ? String(bankName) : "",
    account_name: accountName ? String(accountName) : "",
    expires_at: expiresAt ? String(expiresAt) : "",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const secretKey = Deno.env.get("SQUAD_SECRET_KEY");
    const baseUrl = Deno.env.get("SQUAD_BASE_URL") || "https://sandbox-api-d.squadco.com";

    if (!secretKey) throw new Error("Missing Squad configuration");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, email, name, method } = await req.json();
    if (!amount) throw new Error("Amount is required");

    const walletCreditAmount = Number(amount);
    if (!Number.isFinite(walletCreditAmount) || walletCreditAmount <= 0) {
      throw new Error("Invalid amount");
    }

    const payMethod = method || "BankCard";
    let estimatedFee = 0;
    if (payMethod === "BankTransfer" || payMethod === "BankUssd") {
      estimatedFee = 50;
    } else {
      estimatedFee = walletCreditAmount * 0.015;
      if (estimatedFee > 2000) estimatedFee = 2000;
    }
    estimatedFee = Math.round(estimatedFee * 100) / 100;
    const totalToPay = walletCreditAmount + estimatedFee;
    const amountInKobo = Math.round(totalToPay * 100);

    const reference = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      user_email: user.email,
      reference,
      amount: walletCreditAmount,
      type: "deposit",
      status: "pending",
      description: `Deposit via ${payMethod}`,
      meta: {
        gateway: "squad",
        estimated_fee: estimatedFee,
        total_paid: totalToPay,
        payment_method: payMethod,
        payment_channels: toChannel(payMethod),
      },
    });

    if (insertError) throw insertError;

    const callbackUrl = req.headers.get("origin") || "http://localhost:3000";
    const isDirectBankTransfer = payMethod === "BankTransfer";
    const transferDurationSeconds = Number(Deno.env.get("SQUAD_DVA_DURATION_SECONDS") || "900");

    const targetUrl = isDirectBankTransfer
      ? `${baseUrl}/virtual-account/initiate-dynamic-virtual-account`
      : `${baseUrl}/transaction/initiate`;

    const payload = isDirectBankTransfer
      ? {
        amount: Number(totalToPay.toFixed(2)),
        transaction_ref: reference,
        duration: Number.isFinite(transferDurationSeconds) ? transferDurationSeconds : 900,
        email: email || user.email,
      }
      : {
        amount: amountInKobo,
        email: email || user.email,
        currency: "NGN",
        initiate_type: "inline",
        transaction_ref: reference,
        callback_url: callbackUrl,
        payment_channels: toChannel(payMethod),
        customer_name: name || user.user_metadata?.full_name || "Customer",
        pass_charge: false,
      };

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!resp.ok) {
      const message = data?.message || data?.error || "Failed to initialize Squad payment";
      throw new Error(message);
    }

    if (isDirectBankTransfer) {
      const transfer = extractTransferDetails(data);
      if (!transfer) {
        throw new Error(`Dynamic VA details missing in response: ${JSON.stringify(data || {})}`);
      }

      return new Response(JSON.stringify({
        mode: "direct_transfer",
        reference,
        amount: Number(totalToPay.toFixed(2)),
        transfer,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutUrl =
      data?.data?.checkout_url ||
      data?.data?.checkoutUrl ||
      data?.data?.url ||
      data?.checkout_url ||
      data?.checkoutUrl ||
      data?.url;

    if (!checkoutUrl) {
      throw new Error(`Squad checkout URL missing in response: ${JSON.stringify(data || {})}`);
    }

    return new Response(JSON.stringify({ mode: "checkout", url: checkoutUrl, reference }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
