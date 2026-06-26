import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_CATEGORIES = [
  "data",
  "cable",
  "electricity",
  "exams",
  "recharge_pins",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      action,
      nairaAmount,
      serviceId,
      category,
      paymentId,
      txid,
      reference,
      recipientDetails,
    } = await req.json();

    // Initialize Supabase Admin Client
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(url, serviceKey);
    const piApiKey = Deno.env.get("PI_API_KEY") ?? "";

    // ==========================================
    // ACTION 1: INITIALIZE AND PRICE LOCK WINDOW
    // ==========================================
    if (action === "CREATE_PAYMENT") {
      if (!nairaAmount || !category || !serviceId) {
        return new Response(
          JSON.stringify({
            error:
              "Missing required tracking parameters: nairaAmount, category, and serviceId are mandatory.",
          }),
          { status: 400, headers: corsHeaders },
        );
      }

      const lowerCategory = category.toLowerCase();
      if (!VALID_CATEGORIES.includes(lowerCategory)) {
        return new Response(
          JSON.stringify({
            error: `Invalid utility service category context: ${category}`,
          }),
          { status: 400, headers: corsHeaders },
        );
      }

      let livePiInNaira = 183.15; // Safe fallback base default
      let rateSource = "live market";

      try {
        console.log(
          `[Price Engine] Fetching spot conversion matrix for order: ₦${nairaAmount}`,
        );
        const rateResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=ngn",
        );

        if (!rateResponse.ok)
          throw new Error("CoinGecko API network route offline");

        const marketData = await rateResponse.json();
        const freshRate = marketData["pi-network"]?.ngn;

        if (!freshRate)
          throw new Error("Invalid rate payload data structure parsed");

        livePiInNaira = freshRate;

        // 🔄 CACHE UPDATE: Refresh system settings table backing records
        await supabaseAdmin.from("system_settings").upsert({
          key: "pi_fallback_rate",
          value: { rate: livePiInNaira },
          updated_at: new Date().toISOString(),
        });
      } catch (netError) {
        console.warn(
          "[Price Engine Warning] External gateway drop. Activating DB fallback cache record:",
          netError.message,
        );

        // 🗄️ FETCH CACHE: Read our last known good backup row instead
        const { data: cacheData, error: cacheErr } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "pi_fallback_rate")
          .single();

        if (!cacheErr && cacheData?.value?.rate) {
          livePiInNaira = Number(cacheData.value.rate);
          rateSource = "database cache backup";
        } else {
          rateSource = "hardcoded fallback default";
        }
      }

      // 🆕 Generate precise structural categorization references
      const uniqueId = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const prefix = lowerCategory
        .replace("_", "")
        .substring(0, 4)
        .toUpperCase();
      const generatedReference = `SWF-${prefix}-${uniqueId}`;

      // Compute rate calculations matching frontend state rules
      const rawPiAmount = nairaAmount / livePiInNaira;
      const finalPiAmount = parseFloat((rawPiAmount * 1.1).toFixed(4)); // 10% Protection buffer markup applied

      // 💾 Persist transaction intent state lock block to guarantee atomic confirmation matches
      const { error: lockError } = await supabaseAdmin
        .from("payment_locks")
        .insert({
          reference: generatedReference,
          category: lowerCategory,
          service_id: serviceId,
          naira_amount: nairaAmount,
          pi_amount: finalPiAmount,
          recipient_details: recipientDetails || {},
          status: "pending",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });

      if (lockError) throw lockError;

      console.log(
        `[Price Engine Settle] Locked reference [${generatedReference}]: ${finalPiAmount} π using source: ${rateSource}`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          reference: generatedReference,
          pi_amount: finalPiAmount,
          rate_ngn_per_pi: livePiInNaira,
          buffer_multiplier: 1.1,
          rate_source: rateSource,
          category: lowerCategory,
          expiresInMinutes: 15,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ==========================================
    // ACTION 2: SERVER SIDE HANDSHAKE APPROVAL
    // ==========================================
    if (action === "APPROVE_PAYMENT") {
      if (!paymentId) {
        return new Response(
          JSON.stringify({ error: "Missing Target Payment ID context" }),
          { status: 400, headers: corsHeaders },
        );
      }

      const approveResponse = await fetch(
        `https://api.minepi.com/v2/payments/${paymentId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Key ${piApiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!approveResponse.ok) {
        const approvedErr = await approveResponse.text();
        throw new Error(
          `Pi network gateway rejected approval loop: ${approvedErr}`,
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment approved successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ==========================================
    // ACTION 3: SERVER SIDE COMPLETION & FUNDING
    // ==========================================
    if (action === "COMPLETE_PAYMENT") {
      if (!paymentId || !txid || !reference) {
        return new Response(
          JSON.stringify({
            error:
              "Missing identity validation elements (paymentId/txid/reference)",
          }),
          { status: 400, headers: corsHeaders },
        );
      }

      // 1. Double check state intent records to prevent race condition attacks
      const { data: lockRecord, error: lockFetchErr } = await supabaseAdmin
        .from("payment_locks")
        .select("*")
        .eq("reference", reference)
        .single();

      if (lockFetchErr || !lockRecord) {
        throw new Error(
          `Security validation failure: Unauthorized reference pointer [${reference}] context passed.`,
        );
      }

      if (lockRecord.status === "completed") {
        return new Response(
          JSON.stringify({
            success: true,
            message:
              "Idempotent resolution: Purchase fulfillment already processed.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 2. Finalize verification over Pi core APIs
      const completeResponse = await fetch(
        `https://api.minepi.com/v2/payments/${paymentId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Key ${piApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ txid }),
        },
      );

      if (!completeResponse.ok) {
        const completeErr = await completeResponse.text();
        throw new Error(
          `Pi Network blockchain verification failed: ${completeErr}`,
        );
      }

      const piPaymentDetails = await completeResponse.json();
      const confirmedPiAmount = Number(piPaymentDetails.amount || 0);
      const targetUserUid = piPaymentDetails.user_uid;

      // 3. Resolve internal platform profile rows
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, wallet_balance, pi_balance")
        .eq("pi_uid", targetUserUid)
        .single();

      if (profileErr || !profile) {
        throw new Error(
          "Swifna profile identity record not found for this Pi UID match.",
        );
      }

      // 4. Ledger mutation updates tracking blocks
      const updatedPiBalance =
        Number(profile.pi_balance || 0) + confirmedPiAmount;
      await supabaseAdmin
        .from("profiles")
        .update({ pi_balance: updatedPiBalance })
        .eq("id", profile.id);

      await supabaseAdmin
        .from("payment_locks")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", lockRecord.id);

      // ========================================================
      // 🚀 PROVIDER PIPELINE DELIVERY TRIGGER ROUTER
      // ========================================================
      let providerTriggered = false;
      let distributionPayloadLog: any = {};
      const calculatedCategory = lockRecord.category;
      const targetRecipient =
        lockRecord.recipient_details || recipientDetails || {};

      console.log(
        `[Fulfillment Engine] Routing execution pipeline trigger for category: [${calculatedCategory}]`,
      );

      try {
        const gatewayEndpoint =
          Deno.env.get("PROVIDER_GATEWAY_URL") ||
          "https://api.vtu-provider-gateway.com/v1/deliver";
        const gatewaySecret = Deno.env.get("PROVIDER_AUTH_SECRET") || "";

        // Trigger dynamic value calls down to external utility fulfillment clusters
        const deliveryResponse = await fetch(gatewayEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gatewaySecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderReference: reference,
            serviceId: lockRecord.service_id,
            category: calculatedCategory,
            recipient: targetRecipient,
            fundedValueNaira: lockRecord.naira_amount,
          }),
        });

        if (deliveryResponse.ok) {
          const providerData = await deliveryResponse.json();
          providerTriggered = true;

          // Map response payload schemas cleanly into transaction records
          distributionPayloadLog = {
            token: providerData?.token || providerData?.pin_code || null,
            cards:
              providerData?.generated_cards || providerData?.pins_list || [],
            pin: providerData?.pin || null,
            serial_no:
              providerData?.serial_number || providerData?.serial || null,
            api_raw_response: providerData,
          };
        } else {
          const rawErrText = await deliveryResponse.text();
          console.error(
            `[Fulfillment Alert] Provider api cluster rejected instruction routing blocks: ${rawErrText}`,
          );
          distributionPayloadLog = {
            error_delivery_failed: true,
            upstream_message: rawErrText,
          };
        }
      } catch (providerError) {
        console.error(
          `[Fulfillment Fatal] Unexpected routing drop connection state:`,
          providerError.message,
        );
        distributionPayloadLog = {
          error_exception_triggered: true,
          log: providerError.message,
        };
      }

      // 5. Append transaction records completely configured to map into History viewport rules
      await supabaseAdmin.from("transactions").insert({
        user_id: profile.id,
        user_email: profile.email,
        type:
          calculatedCategory === "deposit"
            ? "Deposit"
            : calculatedCategory.charAt(0).toUpperCase() +
              calculatedCategory.slice(1),
        amount: lockRecord.naira_amount, // Persists standard platform ledger impact
        status:
          providerTriggered || calculatedCategory === "deposit"
            ? "success"
            : "pending",
        reference: reference,
        description: `Processed utility settlement pipeline mapping [${calculatedCategory}] via currency exchange swap (${confirmedPiAmount} π)`,
        meta: {
          pi_payment_id: paymentId,
          blockchain_tx_id: txid,
          currency: "PI",
          payment_channel: "pi_blockchain",
          category: calculatedCategory,
          service_id: lockRecord.service_id,
          // Merge dynamic meta parameters out to components
          ...distributionPayloadLog,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          local_status: providerTriggered ? "success" : "pending",
          message: providerTriggered
            ? "Utility delivery completed successfully"
            : "Payment tracked; fulfillment pipeline handling details via async loop.",
          provider_payload: distributionPayloadLog,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid execution action selector routing instruction passed",
      }),
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
