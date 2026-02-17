import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const legacyToSquadBankCode: Record<string, string> = {
  "044": "000014",
  "063": "000014",
  "058": "000013",
  "011": "000016",
  "033": "000004",
  "032": "000018",
  "070": "000007",
  "214": "000003",
  "050": "000010",
  "082": "000002",
  "057": "000015",
  "221": "000012",
  "232": "000001",
  "215": "000011",
  "068": "000021",
  "035": "000017",
  "035A": "000017",
  "023": "000009",
  "100002": "100002",
  "999991": "100033",
  "999992": "100004",
  "50211": "090267",
};

const resolveSquadBankCode = (bankCode?: string, bankName?: string) => {
  const code = String(bankCode || "").trim();
  if (legacyToSquadBankCode[code]) return legacyToSquadBankCode[code];
  if (/^\d{6}$/.test(code)) return code;

  const normalized = String(bankName || "").toLowerCase();
  if (normalized.includes("access")) return "000014";
  if (normalized.includes("gtbank") || normalized.includes("guaranty")) return "000013";
  if (normalized.includes("zenith")) return "000015";
  if (normalized.includes("first bank")) return "000016";
  if (normalized.includes("uba")) return "000004";
  if (normalized.includes("fidelity")) return "000007";
  if (normalized.includes("union")) return "000018";
  if (normalized.includes("wema") || normalized.includes("alat")) return "000017";
  if (normalized.includes("fcmb")) return "000003";
  if (normalized.includes("ecobank")) return "000010";
  if (normalized.includes("stanbic")) return "000012";
  if (normalized.includes("sterling")) return "000001";
  if (normalized.includes("keystone")) return "000002";
  if (normalized.includes("kuda")) return "090267";
  if (normalized.includes("palmpay")) return "100033";
  if (normalized.includes("opay")) return "100004";
  if (normalized.includes("paga")) return "100002";
  return "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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

    const secretKey = Deno.env.get("SQUAD_SECRET_KEY");
    const baseUrl = Deno.env.get("SQUAD_BASE_URL") || "https://sandbox-api-d.squadco.com";
    const merchantId = Deno.env.get("SQUAD_MERCHANT_ID") || "K67U59SK";
    const transferPath = Deno.env.get("SQUAD_PAYOUT_TRANSFER_PATH") || "/payout/transfer";
    if (!secretKey) throw new Error("Missing Squad configuration");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const amount = Number(body?.amount || 0);
    const fee = Number(body?.fee || 0);
    const accountNumber = String(body?.account_number || "").trim();
    const accountName = String(body?.account_name || "").trim();
    const bankCode = String(body?.bank_code || "").trim();
    const bankName = String(body?.bank_name || "").trim();
    const narration = String(body?.narration || `Withdrawal for ${user.email || user.id}`).trim();

    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (!accountNumber || !accountName || !bankCode) throw new Error("Missing bank details");
    if (fee < 0) throw new Error("Invalid fee");

    const squadBankCode = resolveSquadBankCode(bankCode, bankName);
    if (!squadBankCode) throw new Error("Unsupported bank for Squad payout");

    const reference = `${merchantId}_WD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const { data: txId, error: secureWithdrawError } = await supabaseUser.rpc("request_withdrawal_secure", {
      p_amount: amount,
      p_bank_code: bankCode,
      p_bank_name: bankName,
      p_account_number: accountNumber,
      p_account_name: accountName,
      p_fee: fee,
      p_reference: reference,
      p_category: "user_withdrawal_squad",
      p_deduct_immediately: true,
    });
    if (secureWithdrawError || !txId) {
      throw new Error(secureWithdrawError?.message || "Failed to create withdrawal");
    }

    const amountInKobo = Math.round(amount * 100);
    const payoutPayload = {
      transaction_reference: reference,
      bank_code: squadBankCode,
      account_number: accountNumber,
      account_name: accountName,
      amount: amountInKobo,
      currency_id: "NGN",
      narration,
    };

    const payoutResp = await fetch(`${baseUrl}${transferPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payoutPayload),
    });

    const raw = await payoutResp.text();
    let payoutData: any = {};
    try {
      payoutData = raw ? JSON.parse(raw) : {};
    } catch {
      payoutData = { raw };
    }

    const statusCode = Number(payoutData?.status || payoutResp.status || 0);
    const transferStatus = String(
      payoutData?.data?.transaction_status ||
      payoutData?.data?.status ||
      payoutData?.message ||
      "",
    ).toLowerCase();

    const hardFail = [400, 401, 403, 404, 412].includes(statusCode);
    const isSuccess = statusCode === 200 || transferStatus.includes("success");
    const isUncertain = statusCode === 422 || statusCode === 424;

    const { data: txRow } = await supabaseAdmin
      .from("transactions")
      .select("id, meta")
      .eq("id", txId)
      .maybeSingle();

    const currentMeta = txRow?.meta && typeof txRow.meta === "object" ? txRow.meta : {};

    if (hardFail) {
      const totalRefund = amount + fee;
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", user.id)
        .single();
      const currentBalance = Number(profile?.wallet_balance || 0);

      await supabaseAdmin
        .from("profiles")
        .update({ wallet_balance: currentBalance + totalRefund })
        .eq("id", user.id);

      await supabaseAdmin
        .from("transactions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          meta: {
            ...currentMeta,
            squad_bank_code: squadBankCode,
            payout_response: payoutData,
            payout_refunded: true,
            payout_refunded_at: new Date().toISOString(),
            payout_fee_refund: fee,
          },
        })
        .eq("id", txId);

      return new Response(JSON.stringify({
        success: false,
        message: payoutData?.message || "Payout failed and wallet refunded",
        reference,
        local_status: "failed",
        squad_status_code: statusCode,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const localStatus = isSuccess ? "success" : "pending";
    await supabaseAdmin
      .from("transactions")
      .update({
        status: localStatus,
        updated_at: new Date().toISOString(),
        meta: {
          ...currentMeta,
          squad_bank_code: squadBankCode,
          payout_response: payoutData,
          payout_status_code: statusCode,
          payout_uncertain: isUncertain,
        },
      })
      .eq("id", txId);

    return new Response(JSON.stringify({
      success: true,
      message: isSuccess
        ? "Withdrawal completed"
        : "Withdrawal submitted. Processing in progress.",
      reference,
      local_status: localStatus,
      squad_status_code: statusCode,
      squad_response: payoutData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

