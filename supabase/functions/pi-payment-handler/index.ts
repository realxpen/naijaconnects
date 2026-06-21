import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, nairaAmount, serviceId, paymentId, txid, reference } =
      await req.json();

    // Initialize Supabase Admin Client
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(url, serviceKey);
    const piApiKey = Deno.env.get("PI_API_KEY") ?? "";

    // ==========================================
    // ACTION 1: INITIALIZE AND PRICE LOCK WINDOW
    // ==========================================
    if (action === "CREATE_PAYMENT") {
      if (!nairaAmount) {
        return new Response(
          JSON.stringify({ error: "Missing required amount parameters" }),
          { status: 400, headers: corsHeaders },
        );
      }

      let livePiInNaira = 183.15; // Hardcoded safety base default
      let rateSource = "live market";

      try {
        console.log(
          `[Price Engine] Querying live conversion matrix for target: ₦${nairaAmount}`,
        );
        const rateResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=ngn",
        );

        if (!rateResponse.ok) throw new Error("CoinGecko API offline");

        const marketData = await rateResponse.json();
        const freshRate = marketData["pi-network"]?.ngn;

        if (!freshRate) throw new Error("Invalid rate data structure parsed");

        livePiInNaira = freshRate;

        // 🔄 CACHE UPDATE: Refresh our last known good rate table background record
        await supabaseAdmin.from("system_settings").upsert({
          key: "pi_fallback_rate",
          value: { rate: livePiInNaira },
          updated_at: new Date().toISOString(),
        });
      } catch (netError) {
        console.warn(
          "[Price Engine Warning] External gateway error. Activating database cache network fallback:",
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

      // Compute pricing calculations with a 10% protection markup multiplier
      const rawPiAmount = nairaAmount / livePiInNaira;
      const finalPiAmount = parseFloat((rawPiAmount * 1.1).toFixed(4));

      console.log(
        `[Price Engine Settle] Price locked: ${finalPiAmount} π using ${rateSource} rate of ₦${livePiInNaira}`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          calculatedPiAmount: finalPiAmount,
          rateLocked: livePiInNaira,
          rateSource,
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
      if (!paymentId || !txid) {
        return new Response(
          JSON.stringify({
            error: "Missing identity tracking hashes (paymentId/txid)",
          }),
          { status: 400, headers: corsHeaders },
        );
      }

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

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, wallet_balance")
        .eq("pi_uid", targetUserUid)
        .single();

      if (profileErr || !profile) {
        throw new Error(
          "Swifna profile identity record not found for this Pi UID.",
        );
      }

      // Convert Pi back to credit using the locked metadata reference amount
      const metaAmountNgn = Number(
        piPaymentDetails.metadata?.amount_ngn || confirmedPiAmount * 150,
      );
      const updatedBalance =
        Number(profile.wallet_balance || 0) + metaAmountNgn;

      await supabaseAdmin
        .from("profiles")
        .update({ wallet_balance: updatedBalance })
        .eq("id", profile.id);
      await supabaseAdmin
        .from("user_wallets")
        .update({ balance: updatedBalance })
        .eq("user_id", profile.id);

      await supabaseAdmin.from("transactions").insert({
        user_id: profile.id,
        user_email: profile.email,
        type: "deposit",
        amount: metaAmountNgn,
        status: "success",
        reference: reference || `PI-${paymentId.substring(0, 8)}`,
        description: `Funded wallet via Pi Network payment (${confirmedPiAmount} π)`,
        meta: {
          pi_payment_id: paymentId,
          blockchain_tx_id: txid,
          fiat_credited: metaAmountNgn,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          local_status: "success",
          message: "Account balance credited successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action parameter" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
