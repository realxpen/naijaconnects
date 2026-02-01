import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./config.ts";
import { buyAirtime } from "./services/airtime.ts";
import { verifyMeter, buyElectricity } from "./services/electricity.ts"; // <--- Import

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, payload } = await req.json();
    let data;

    switch (action) {
      case 'buy_airtime':
        data = await buyAirtime(payload);
        break;
      
      // --- NEW ELECTRICITY ACTIONS ---
      case 'verify_meter':
        data = await verifyMeter(payload);
        break;
      case 'buy_electricity':
        data = await buyElectricity(payload);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});