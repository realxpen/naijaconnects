import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "./config.ts";

// Import Services
import { buyAirtime } from "./services/airtime.ts";
import { buyData, fetchDataPlans } from "./services/data.ts";
import { buyEducation } from "./services/education.ts"; // <--- UPDATED IMPORT
import { airtimeToCash } from "./services/airtime_cash.ts";
import { buyRechargePin } from "./services/recharge.ts"; 

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    let body = {};
    try { body = await req.json(); } catch (e) { throw new Error("Invalid JSON body"); }
    const { action, payload } = body;

    console.log(`[Affatech Proxy] Action: ${action}`);

    let responseData;

    switch (action) {
        case 'buy_airtime':       responseData = await buyAirtime(payload); break;
        case 'buy_data':          responseData = await buyData(payload); break;
        case 'fetch_data_plans':  responseData = await fetchDataPlans(); break;
        
        // UPDATED: Matches 'buy_education' sent from Dashboard.tsx
        case 'buy_education':     responseData = await buyEducation(payload); break; 
        
        case 'airtime_to_cash':   responseData = await airtimeToCash(payload); break;
        case 'buy_recharge_pin':  responseData = await buyRechargePin(payload); break;

        default: throw new Error(`Unknown Action: ${action}`);
    }

    return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
    });

  } catch (error: any) {
    console.error("Backend Error:", error.message);
    return new Response(JSON.stringify({ success: false, message: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 // We return 200 so the frontend can read the error message
    });
  }
})