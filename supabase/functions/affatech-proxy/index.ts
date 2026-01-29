import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Import all our isolated services
import { buyAirtime } from "./services/airtime.ts";
import { airtimeToCash } from "./services/airtime_cash.ts"; // <--- New Import
import { buyData, fetchDataPlans } from "./services/data.ts";
import { buyElectricity, verifyMeter } from "./services/electricity.ts";
import { buyCable, verifyIUC } from "./services/cable.ts";
import { buyExamPin } from "./services/exam.ts";
import { buyRechargePin } from "./services/recharge.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    let body = {};
    try { body = await req.json(); } catch (e) { throw new Error("Invalid JSON body"); }
    const { action, payload } = body;

    let responseData;
    console.log(`[Router] Action: ${action}`);

    switch (action) {
        // --- AIRTIME ---
        case 'buy_airtime':
            responseData = await buyAirtime(payload);
            break;

        // --- AIRTIME TO CASH (New) ---
        case 'airtime_to_cash':
            responseData = await airtimeToCash(payload);
            break;

        // --- DATA ---
        case 'buy_data':
            responseData = await buyData(payload);
            break;
        case 'fetch_data_plans':
            responseData = await fetchDataPlans();
            break;

        // --- ELECTRICITY ---
        case 'buy_electricity':
            responseData = await buyElectricity(payload);
            break;

        // --- CABLE TV ---
        case 'buy_cable':
            responseData = await buyCable(payload);
            break;

        // --- EXAM PINS ---
        case 'buy_epin':
            responseData = await buyExamPin(payload);
            break;

        // --- RECHARGE PINS ---
        case 'buy_recharge_pin':
            responseData = await buyRechargePin(payload);
            break;

        // --- VERIFICATION (Routes to specific services) ---
        case 'verify_customer':
            if (payload.type === 'electricity') {
                responseData = await verifyMeter(payload);
            } 
            else if (payload.type === 'cable') {
                responseData = await verifyIUC(payload);
            } 
            else {
                throw new Error("Verification type not supported or missing");
            }
            break;

        default:
            throw new Error(`Unknown Action: ${action}`);
    }

    return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
    });

  } catch (error: any) {
    console.error("[Router Error]", error.message);
    return new Response(JSON.stringify({ 
        success: false, 
        message: error.message || "Internal Server Error" 
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 // We return 200 so frontend can display the error cleanly
    });
  }
})