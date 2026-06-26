import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./config.ts";

// Services
import { buyAirtime } from "./services/airtime.ts";
import { verifyMeter, buyElectricity } from "./services/electricity.ts";
import {
  fetchCablePlans,
  verifySmartCard,
  buyCable,
} from "./services/cable.ts";
import {
  fetchSmilePlans,
  verifySmileNumber,
  buySmileData,
} from "./services/smile_data.ts";
import {
  fetchJambPlans,
  verifyJambProfile,
  buyEducation,
} from "./services/education.ts";

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Parse Request Body
    const body = await req.json();

    // Normalize actions coming from frontend triggers or automated transaction dispatches
    const action = String(body?.action || body?.category || "")
      .trim()
      .toLowerCase();
    const incomingPayload = body?.payload || body || {};

    console.log(`[ClubKonnect Proxy] Processing action/category: ${action}`);

    // Normalize target parameter variables to keep sub-services safe from nested object mismatches
    const recipientObj =
      incomingPayload.recipient || incomingPayload.target_recipient || {};
    const normalizedPayload = {
      ...incomingPayload,
      phone:
        recipientObj.phone ||
        incomingPayload.phone ||
        incomingPayload.mobile_number,
      meterNo:
        recipientObj.meter_number ||
        incomingPayload.meter_number ||
        incomingPayload.meterNo ||
        incomingPayload.meter_no,
      smartCardNo:
        recipientObj.smartcard_id ||
        incomingPayload.smartcard_id ||
        incomingPayload.smartCardNo ||
        incomingPayload.smartcard_no,
      service_id:
        incomingPayload.service_id ||
        incomingPayload.id ||
        incomingPayload.plan_id,
    };

    let data;

    // 3. Route Actions (Normalized mapping switches)
    switch (action) {
      // --- AIRTIME ---
      case "buy_airtime":
      case "airtime":
        data = await buyAirtime(normalizedPayload);
        break;

      // --- ELECTRICITY ---
      case "verify_meter":
        data = await verifyMeter(normalizedPayload);
        break;
      case "buy_electricity":
      case "electricity":
        data = await buyElectricity(normalizedPayload);
        break;

      // --- CABLE TV ---
      case "fetch_cable_plans":
        data = await fetchCablePlans();
        break;
      case "verify_smartcard":
        data = await verifySmartCard(normalizedPayload);
        break;
      case "buy_cable":
      case "cable":
        data = await buyCable(normalizedPayload);
        break;

      // --- SMILE DATA ---
      case "fetch_smile_plans":
        data = await fetchSmilePlans();
        break;
      case "verify_smile":
        data = await verifySmileNumber(normalizedPayload);
        break;
      case "buy_smile_data":
        data = await buySmileData(normalizedPayload);
        break;

      // --- JAMB / EDUCATION / EXAMS ---
      case "fetch_jamb_plans":
        data = await fetchJambPlans();
        break;
      case "verify_jamb":
        data = await verifyJambProfile(normalizedPayload);
        break;
      case "buy_education":
      case "exams":
        data = await buyEducation(normalizedPayload);
        break;

      default:
        throw new Error(
          `Proxy Router Rejection: Unknown execution target variant context [${action}]`,
        );
    }

    // 4. Return Success Response
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error(`[Proxy Error] ${error.message}`);

    // Return a 200/400 JSON block so the automated payment handler reads the rejection safely
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Upstream pipeline transaction failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
