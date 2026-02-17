import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  if (/^\d{3}$/.test(code) && legacyToSquadBankCode[code]) return legacyToSquadBankCode[code];

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
    const { account_number, bank_code, bank_name } = await req.json();

    if (!account_number || !bank_code) {
      throw new Error("Missing account number or bank code");
    }

    const secretKey = Deno.env.get("SQUAD_SECRET_KEY");
    const baseUrl = Deno.env.get("SQUAD_BASE_URL") || "https://sandbox-api-d.squadco.com";
    if (!secretKey) throw new Error("Missing Squad configuration");

    const squadBankCode = resolveSquadBankCode(bank_code, bank_name);
    if (!squadBankCode) {
      return new Response(JSON.stringify({
        valid: false,
        message: "Unsupported bank for Squad payout. Please use another bank.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(`${baseUrl}/payout/account/lookup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank_code: squadBankCode,
        account_number: String(account_number),
      }),
    });

    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    const ok = response.ok && (data?.success === true || Number(data?.status) === 200);
    if (!ok) {
      return new Response(JSON.stringify({
        valid: false,
        message: data?.message || data?.error || "Could not resolve account",
        squad_bank_code: squadBankCode,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountName = data?.data?.account_name || data?.data?.accountName || "";
    const accountNumber = data?.data?.account_number || data?.data?.accountNumber || String(account_number);

    return new Response(JSON.stringify({
      valid: true,
      account_name: accountName,
      account_number: accountNumber,
      squad_bank_code: squadBankCode,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

