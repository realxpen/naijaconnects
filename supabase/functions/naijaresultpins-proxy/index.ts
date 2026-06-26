import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("NAIJARESULTPINS_API_TOKEN");
    if (!token)
      throw new Error(
        "Missing NaijaResultPins API token configuration in edge runtime.",
      );

    const baseUrl = "https://www.naijaresultpins.com/api/v1";
    const body = await req.json().catch(() => ({}));

    // Normalize both direct action selectors and transactional engine categorization loops
    const action = String(body?.action || body?.category || "")
      .trim()
      .toLowerCase();
    const payload = body?.payload || body || {};

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // --- 1. PRODUCT LIST ROUTE ---
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

    // --- 2. ACCOUNT ROUTE ---
    if (action === "account_info") {
      const resp = await fetch(`${baseUrl}/account`, {
        method: "GET",
        headers,
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

    // --- 3. EXAM CARD / EDUCATION FULFILLMENT PIPELINE ---
    if (
      action === "buy_card" ||
      action === "exams" ||
      action === "buy_education"
    ) {
      // Robust payload extraction handles both dashboard UI and pi-payment-handler dispatches
      const cardTypeId = String(
        payload?.card_type_id || payload?.service_id || "",
      ).trim();
      const quantity = Number(payload?.quantity || 1); // Defaults to single voucher unit purchase

      if (!cardTypeId) {
        throw new Error(
          "Validation mismatch: card_type_id or standardized service_id is required.",
        );
      }
      if (quantity <= 0) {
        throw new Error(
          "Validation mismatch: Invalid item count quantity specified.",
        );
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
      let vendorData: any = {};

      try {
        vendorData = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Upstream Provider Gateway crash (Non-JSON response): ${text.substring(0, 100)}`,
        );
      }

      // Check if the vendor returned a valid successful structural response
      const isVendorSuccess =
        vendorData?.success === true ||
        vendorData?.Status === "successful" ||
        vendorData?.status === "success";

      if (isVendorSuccess) {
        // Safe mapping formats arrays of vouchers matching the target UI Layout schemas
        const rawPinsList =
          vendorData?.pins_list || vendorData?.cards || vendorData?.data || [];

        // Build fallback list array elements if response returns a flattened single string code instead
        const normalizedPinsList =
          Array.isArray(rawPinsList) && rawPinsList.length > 0
            ? rawPinsList.map((c: any) => ({
                pin: String(c?.pin || c?.pin_code || "").trim(),
                serialNo: String(
                  c?.serial_no || c?.serialNumber || c?.serial || "",
                ).trim(),
              }))
            : vendorData?.pin
              ? [
                  {
                    pin: String(vendorData.pin),
                    serialNo: String(vendorData?.serial_no || ""),
                  },
                ]
              : [];

        return new Response(
          JSON.stringify({
            success: true,
            message: "Exam Voucher Delivery Completed",
            pins_list: normalizedPinsList,
            pin: normalizedPinsList[0]?.pin || "Check Details",
            reference:
              vendorData?.reference ||
              vendorData?.id ||
              `SWF_EXAM_${Date.now()}`,
            raw_provider_data: vendorData,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      } else {
        throw new Error(
          vendorData?.message ||
            vendorData?.error ||
            "Upstream vendor failed validation handling parameters.",
        );
      }
    }

    throw new Error(
      `Proxy Routing rejection: Unknown action parameter [${action}] context passed.`,
    );
  } catch (error: any) {
    console.error("[NaijaResultPins Proxy Exception]:", error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
