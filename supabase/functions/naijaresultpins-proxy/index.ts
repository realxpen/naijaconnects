import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("NAIJARESULTPINS_API_TOKEN");
    if (!token) throw new Error("Missing NaijaResultPins API token");

    const baseUrl = "https://www.naijaresultpins.com/api/v1";
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const payload = body?.payload || {};

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    if (action === "list_products") {
      const resp = await fetch(baseUrl, { method: "GET", headers });
      const text = await resp.text();
      let data: any = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch {
        data = { raw: text };
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "buy_card") {
      const cardTypeId = String(payload?.card_type_id || "").trim();
      const quantity = Number(payload?.quantity || 0);
      if (!cardTypeId || !quantity || quantity <= 0) {
        throw new Error("Missing card_type_id or invalid quantity");
      }

      const resp = await fetch(`${baseUrl}/exam-card/buy`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          card_type_id: cardTypeId,
          quantity: String(quantity),
        }),
      });
      const text = await resp.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "account_info") {
      const resp = await fetch(`${baseUrl}/account`, { method: "GET", headers });
      const text = await resp.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Unknown action");
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

