import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./config.ts";

// Services
import { buyAirtime } from "./services/airtime.ts";
import { verifyMeter, buyElectricity } from "./services/electricity.ts";
import { fetchCablePlans, verifySmartCard, buyCable } from "./services/cable.ts";
import { fetchSmilePlans, verifySmileNumber, buySmileData } from "./services/smile_data.ts";
import { fetchJambPlans, verifyJambProfile, buyEducation } from "./services/education.ts";

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Parse Request Body
    const body = await req.json();
    const { action, payload } = body;

    console.log(`[ClubKonnect Proxy] Processing action: ${action}`);
    
    let data;

    // 3. Route Actions
    switch (action) {
      // --- AIRTIME ---
      case 'buy_airtime': 
        data = await buyAirtime(payload); 
        break;
      
      // --- ELECTRICITY ---
      case 'verify_meter': 
        data = await verifyMeter(payload); 
        break;
      case 'buy_electricity': 
        data = await buyElectricity(payload); 
        break;
      
      // --- CABLE TV ---
      case 'fetch_cable_plans': 
        data = await fetchCablePlans(); 
        break;
      case 'verify_smartcard': 
        data = await verifySmartCard(payload); 
        break;
      case 'buy_cable': 
        data = await buyCable(payload); 
        break;
      
      // --- SMILE DATA ---
      case 'fetch_smile_plans': 
        data = await fetchSmilePlans(); 
        break;
      case 'verify_smile': 
        data = await verifySmileNumber(payload); 
        break;
      case 'buy_smile_data': 
        data = await buySmileData(payload); 
        break;

      // --- JAMB / EDUCATION ---
      case 'fetch_jamb_plans': 
        data = await fetchJambPlans(); 
        break;
      case 'verify_jamb': 
        data = await verifyJambProfile(payload); 
        break;
      case 'buy_education': 
        data = await buyEducation(payload); 
        break;
      
      default: 
        throw new Error(`Unknown action requested: ${action}`);
    }

    // 4. Return Success Response
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[Proxy Error] ${error.message}`);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});