import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Import Services
import { buyAirtime } from "./services/airtime.ts";
import { buyData, fetchDataPlans } from "./services/data.ts";
import { buyEducation } from "./services/education.ts";
import { airtimeToCash } from "./services/airtime_cash.ts";
import { buyRechargePin } from "./services/recharge.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON body");
    }

    // Support both direct legacy proxy calls and automated pipeline dispatches
    const action = body.action || body.category;
    const incomingPayload = body.payload || body;

    console.log(`[Affatech Proxy Router] Incoming Event Type: ${action}`);

    // Normalize checkouts payload fields securely down to backend modules format
    const recipientObj =
      incomingPayload.recipient || incomingPayload.target_recipient || {};
    const normalizedPayload = {
      ...incomingPayload,
      // Fallback extractions for utility providers mappings
      phone: recipientObj.phone || incomingPayload.phone,
      meter_number: recipientObj.meter_number || incomingPayload.meter_number,
      smartcard_id: recipientObj.smartcard_id || incomingPayload.smartcard_id,
      id: incomingPayload.service_id || incomingPayload.id,
    };

    let responseData;

    switch (action?.toLowerCase()) {
      case "buy_airtime":
      case "airtime":
        responseData = await buyAirtime(normalizedPayload);
        break;
      case "buy_data":
      case "data":
        responseData = await buyData(normalizedPayload);
        break;
      case "fetch_data_plans":
        responseData = await fetchDataPlans();
        break;
      case "buy_education":
      case "exams":
        responseData = await buyEducation(normalizedPayload);
        break;
      case "airtime_to_cash":
        responseData = await airtimeToCash(normalizedPayload);
        break;
      case "buy_recharge_pin":
      case "recharge_pins":
        responseData = await buyRechargePin(normalizedPayload);
        break;

      default:
        throw new Error(`Unknown structural route action: ${action}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[Affatech Proxy Error]:", error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
