import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { verifyMeter, buyElectricity } from "./services/electricity.ts";
import { fetchCablePlans, verifySmartCard, buyCable } from "./services/cable.ts";
import { buyRechargePin } from "./services/epin.ts"; // Added import for e-PIN service

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
    console.log(`[StroWallet Proxy] Action: ${action}`);

    switch (action) {
        // --- ELECTRICITY ---
        case 'verify_meter':      responseData = await verifyMeter(payload); break;
        case 'buy_electricity':   responseData = await buyElectricity(payload); break;

        // --- CABLE TV ---
        case 'fetch_cable_plans': responseData = await fetchCablePlans(payload); break;
        case 'verify_smartcard':  responseData = await verifySmartCard(payload); break;
        case 'buy_cable':         responseData = await buyCable(payload); break;

        // --- RECHARGE CARD PRINTING (E-PIN) ---
        case 'buy_recharge_pin':  responseData = await buyRechargePin(payload); break;

        default: throw new Error(`Unknown Action: ${action}`);
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
        status: 200 
    });
  }
})