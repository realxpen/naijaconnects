import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { verifyMeter, buyElectricity } from "./services/electricity.ts";

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
        case 'verify_meter':
            responseData = await verifyMeter(payload);
            break;

        case 'buy_electricity':
            responseData = await buyElectricity(payload);
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
        status: 200 
    });
  }
})