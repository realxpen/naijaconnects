import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (origin?: string) => {
  const allowOrigin = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};

type PiRate = {
  rateNgnPerPi: number;
  source: string;
  lastUpdatedAt?: number | string | null;
  raw?: unknown;
};

const piApiBase = Deno.env.get("PI_API_BASE_URL") || "https://api.minepi.com/v2";
const bufferMultiplier = Number(Deno.env.get("PI_RATE_BUFFER_MULTIPLIER") || "1.10");
const rateCacheTtlMs = Number(Deno.env.get("PI_RATE_CACHE_TTL_MS") || "60000");

let cachedRate: { expiresAt: number; value: PiRate } | null = null;

const jsonResponse = (body: Record<string, unknown>, req: Request | null = null, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? getCorsHeaders(req.headers.get("Origin") || undefined) : getCorsHeaders()), "Content-Type": "application/json" },
  });

const readPath = (value: unknown, path: string) => {
  if (!path) return undefined;
  return path.split(".").reduce((current: any, key) => current?.[key], value as any);
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
};

const roundUpPi = (value: number) => Math.ceil(value * 10_000_000) / 10_000_000;

const getPiServerKey = () => {
  const key = Deno.env.get("PI_SERVER_API_KEY") || Deno.env.get("PI_API_KEY");
  if (!key) throw new Error("Missing PI_SERVER_API_KEY");
  return key;
};

const piPlatformFetch = async (path: string, init?: RequestInit) => {
  const key = getPiServerKey();
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Key ${key}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${piApiBase}${path}`, { ...init, headers });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Pi API request failed with ${response.status}`);
  }

  return payload;
};

const fetchCustomRate = async (): Promise<PiRate | null> => {
  const url = Deno.env.get("PI_RATE_SOURCE_URL");
  const path = Deno.env.get("PI_RATE_JSON_PATH");
  if (!url || !path) return null;

  const headers = new Headers();
  const headerName = Deno.env.get("PI_RATE_API_KEY_HEADER");
  const apiKey = Deno.env.get("PI_RATE_API_KEY");
  if (headerName && apiKey) headers.set(headerName, apiKey);

  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`PI rate source failed with ${response.status}`);
  }

  const rate = toNumber(readPath(payload, path));
  if (!rate) throw new Error("PI rate source returned an invalid rate");

  return {
    rateNgnPerPi: rate,
    source: Deno.env.get("PI_RATE_SOURCE_NAME") || "custom",
    lastUpdatedAt: readPath(payload, Deno.env.get("PI_RATE_UPDATED_AT_JSON_PATH") || ""),
    raw: payload,
  };
};

const fetchCoinMarketCapRate = async (): Promise<PiRate | null> => {
  const apiKey = Deno.env.get("COINMARKETCAP_API_KEY");
  if (!apiKey) return null;

  const cmcId = Deno.env.get("PI_CMC_ID");
  const symbol = Deno.env.get("PI_CMC_SYMBOL") || "PI";
  const query = cmcId
    ? `id=${encodeURIComponent(cmcId)}&convert=NGN`
    : `symbol=${encodeURIComponent(symbol)}&convert=NGN`;

  const response = await fetch(
    `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?${query}`,
    { headers: { "X-CMC_PRO_API_KEY": apiKey } },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.status?.error_message || `CoinMarketCap failed with ${response.status}`);
  }

  const quoteRoot = cmcId ? payload?.data?.[cmcId] : payload?.data?.[symbol];
  const firstQuote = Array.isArray(quoteRoot) ? quoteRoot[0] : quoteRoot;
  const rate = toNumber(firstQuote?.quote?.NGN?.price);
  if (!rate) throw new Error("CoinMarketCap returned an invalid PI/NGN rate");

  return {
    rateNgnPerPi: rate,
    source: "coinmarketcap",
    lastUpdatedAt: firstQuote?.quote?.NGN?.last_updated || null,
    raw: firstQuote,
  };
};

const fetchCoinGeckoRate = async (): Promise<PiRate> => {
  const coinId = Deno.env.get("PI_COINGECKO_ID") || "pi-network";
  const apiKey = Deno.env.get("COINGECKO_API_KEY") || Deno.env.get("PI_COINGECKO_API_KEY");
  const baseUrl = apiKey ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
  const headers = apiKey ? { "x-cg-pro-api-key": apiKey } : undefined;

  const response = await fetch(
    `${baseUrl}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=ngn&include_last_updated_at=true`,
    { headers },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `CoinGecko failed with ${response.status}`);
  }

  const rate = toNumber(payload?.[coinId]?.ngn);
  if (!rate) throw new Error("CoinGecko returned an invalid PI/NGN rate");

  return {
    rateNgnPerPi: rate,
    source: "coingecko",
    lastUpdatedAt: payload?.[coinId]?.last_updated_at || null,
    raw: payload?.[coinId],
  };
};

const fetchPiRate = async (): Promise<PiRate> => {
  const now = Date.now();
  if (cachedRate && cachedRate.expiresAt > now) return cachedRate.value;

  const override = toNumber(Deno.env.get("PI_RATE_NGN_OVERRIDE"));
  if (override) {
    const value = { rateNgnPerPi: override, source: "env-override", lastUpdatedAt: new Date().toISOString() };
    cachedRate = { value, expiresAt: now + rateCacheTtlMs };
    return value;
  }

  const value =
    (await fetchCustomRate()) ||
    (await fetchCoinMarketCapRate()) ||
    (await fetchCoinGeckoRate());

  cachedRate = { value, expiresAt: now + rateCacheTtlMs };
  return value;
};

const createQuote = async (amountNgn: number) => {
  if (!Number.isFinite(amountNgn) || amountNgn <= 0) throw new Error("Invalid NGN amount");
  if (!Number.isFinite(bufferMultiplier) || bufferMultiplier < 1) {
    throw new Error("PI_RATE_BUFFER_MULTIPLIER must be at least 1");
  }

  const rate = await fetchPiRate();
  const basePiAmount = amountNgn / rate.rateNgnPerPi;
  const piAmount = roundUpPi(basePiAmount * bufferMultiplier);

  return {
    amount_ngn: amountNgn,
    pi_amount: piAmount,
    base_pi_amount: roundUpPi(basePiAmount),
    rate_ngn_per_pi: rate.rateNgnPerPi,
    buffer_multiplier: bufferMultiplier,
    rate_source: rate.source,
    rate_last_updated_at: rate.lastUpdatedAt || null,
  };
};

const getAuthenticatedUser = async (req: Request, supabase: any) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401 });

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response(JSON.stringify({ error: "Invalid authorization header" }), { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401 });

  return user;
};

const verifyPiAccessToken = async (accessToken: string) => {
  if (!accessToken) throw new Error("Pi access token is required");

  const response = await fetch(`${piApiBase}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || payload?.message || "Unable to verify Pi user");
  return payload;
};

const getOwnedPiTransaction = async (supabase: any, reference: string, user: any) => {
  if (!reference) throw new Error("Reference is required");

  const { data: txn, error } = await supabase
    .from("transactions")
    .select("id, status, user_id, user_email, amount, type, meta")
    .eq("reference", reference)
    .single();

  if (error || !txn) throw new Error("Transaction not found");

  const ownsTxn =
    (txn.user_id && txn.user_id === user.id) ||
    (txn.user_email && user.email && txn.user_email === user.email);

  if (!ownsTxn) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const meta = txn?.meta && typeof txn.meta === "object" ? txn.meta : {};
  if (meta.gateway !== "pi_network") throw new Error("Transaction is not a Pi payment");

  return { txn, meta };
};

const validatePiPayment = (payment: any, reference: string, meta: any) => {
  const expectedPiAmount = Number(meta?.pi_amount);
  const receivedPiAmount = Number(payment?.amount);
  const paymentReference = String(payment?.metadata?.reference || payment?.metadata?.tx_ref || "");
  const expectedPiUid = String(meta?.pi_user?.uid || "");
  const receivedPiUid = String(payment?.user_uid || "");

  if (paymentReference && paymentReference !== reference) {
    throw new Error("Pi payment metadata reference mismatch");
  }

  if (expectedPiUid && receivedPiUid && expectedPiUid !== receivedPiUid) {
    throw new Error("Pi user mismatch for this payment");
  }

  if (expectedPiAmount && Math.abs(receivedPiAmount - expectedPiAmount) > 0.0000001) {
    throw new Error("Pi payment amount mismatch");
  }
};

const updateTransactionMeta = async (supabase: any, id: string, meta: Record<string, unknown>, status?: string) => {
  const updatePayload: Record<string, unknown> = {
    meta,
    updated_at: new Date().toISOString(),
  };
  if (status) updatePayload.status = status;

  const { error } = await supabase.from("transactions").update(updatePayload).eq("id", id);
  if (error) throw error;
};

const creditWalletIfNeeded = async (supabase: any, txn: any, meta: any) => {
  if (meta?.balance_credited) return { credited: false, already_credited: true };

  let targetProfileId: string | null = txn.user_id || null;
  let profileBalance = 0;

  const byId = targetProfileId
    ? await supabase
      .from("profiles")
      .select("id, wallet_balance")
      .eq("id", targetProfileId)
      .maybeSingle()
    : { data: null, error: null as any };

  if (byId.error) throw byId.error;

  if (byId.data?.id) {
    targetProfileId = byId.data.id;
    profileBalance = Number(byId.data.wallet_balance) || 0;
  } else if (txn.user_email) {
    const byEmail = await supabase
      .from("profiles")
      .select("id, wallet_balance")
      .eq("email", txn.user_email)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    if (byEmail.data?.id) {
      targetProfileId = byEmail.data.id;
      profileBalance = Number(byEmail.data.wallet_balance) || 0;
    } else if (txn.user_id && txn.user_email) {
      const created = await supabase
        .from("profiles")
        .insert({ id: txn.user_id, email: txn.user_email, wallet_balance: 0 })
        .select("id, wallet_balance")
        .single();
      if (created.error || !created.data?.id) {
        throw created.error || new Error("Failed to create profile");
      }
      targetProfileId = created.data.id;
      profileBalance = Number(created.data.wallet_balance) || 0;
    }
  }

  if (!targetProfileId) throw new Error("Profile not found for credit operation");

  const newBalance = profileBalance + (Number(txn.amount) || 0);
  const { error: balanceError } = await supabase
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", targetProfileId);
  if (balanceError) throw balanceError;

  return { credited: true, wallet_balance: newBalance };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req.headers.get("Origin") || undefined) });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "quote");

    if (action === "quote") {
      const amountNgn = Number(body?.amount_ngn ?? body?.amount ?? 0);
      return jsonResponse(await createQuote(amountNgn), req);
    }

    if (action === "auth") {
      const accessToken = String(body?.accessToken || "");
      const piUser = await verifyPiAccessToken(accessToken);
      const piUid = piUser.uid;
      const piUsername = piUser.username || `pi_user_${piUid}`;
      const email = `${piUid}@pi.local`;

      // Generate deterministic UUIDv4-like string from piUid
      const encoder = new TextEncoder();
      const uidHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(piUid));
      const uidHashArray = Array.from(new Uint8Array(uidHashBuffer));
      const uidHex = uidHashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      const deterministicUuid = `${uidHex.slice(0, 8)}-${uidHex.slice(8, 12)}-${uidHex.slice(12, 16)}-${uidHex.slice(16, 20)}-${uidHex.slice(20, 32)}`;

      // Generate deterministic password using a hash of the Pi uid + PI_AUTH_SECRET
      const authSecret = Deno.env.get("PI_AUTH_SECRET") || "default-pi-auth-secret-key-123456789";
      const pwHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(piUid + authSecret));
      const pwHashArray = Array.from(new Uint8Array(pwHashBuffer));
      const password = pwHashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Check if user exists in the profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("id", deterministicUuid)
        .maybeSingle();

      if (!profile) {
        // Create the user in Supabase Auth using the deterministic UUID as the ID
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          id: deterministicUuid,
          email,
          password,
          email_confirm: true,
          user_metadata: {
            first_name: piUsername,
            last_name: "PiNetwork",
            phone: "",
            preferred_language: "en",
            pi_uid: piUid,
            pi_username: piUsername,
            pi_wallet_address: piUser.wallet_address || ""
          }
        });

        if (authError) {
          console.warn("Auth user creation warning/error:", authError);
        }

        // Create the profile row in the profiles table
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: deterministicUuid,
            email,
            first_name: piUsername,
            last_name: "PiNetwork",
            wallet_balance: 0,
            preferred_language: "en",
            pi_uid: piUid,
            pi_username: piUsername,
            pi_wallet_address: piUser.wallet_address || ""
          });

        if (insertError) {
          console.warn("Profile creation warning/error:", insertError);
        }
      } else {
        // Update existing profile with Pi metadata if missing
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            pi_uid: piUid,
            pi_username: piUsername,
            pi_wallet_address: piUser.wallet_address || ""
          })
          .eq("id", deterministicUuid);

        if (updateError) {
          console.warn("Profile metadata update warning/error:", updateError);
        }
      }

      return jsonResponse({
        success: true,
        email,
        password,
        pi_user: piUser
      }, req);
    }

    if (action === "link") {
      const user = await getAuthenticatedUser(req, supabase);
      const accessToken = String(body?.accessToken || "");
      const piUser = await verifyPiAccessToken(accessToken);
      const piUid = piUser.uid;
      const piUsername = piUser.username || `pi_user_${piUid}`;

      // Check if this Pi UID is already linked to another account
      const { data: existingLink } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("pi_uid", piUid)
        .maybeSingle();

      if (existingLink && existingLink.id !== user.id) {
        throw new Error(`This Pi account is already linked to another Swifna account (${existingLink.email}).`);
      }

      // Update the user's profile with the Pi metadata
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          pi_uid: piUid,
          pi_username: piUsername,
          pi_wallet_address: piUser.wallet_address || ""
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      return jsonResponse({
        success: true,
        pi_user: piUser
      }, req);
    }

    const user = await getAuthenticatedUser(req, supabase);

    if (action === "start") {
      const amountNgn = Number(body?.amount_ngn ?? body?.amount ?? 0);
      if (!Number.isFinite(amountNgn) || amountNgn < 100) {
        throw new Error("Minimum Pi wallet deposit is ₦100");
      }

      const piUser = await verifyPiAccessToken(String(body?.accessToken || ""));
      const quote = await createQuote(amountNgn);
      const reference = `PI-DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        user_email: user.email,
        reference,
        amount: amountNgn,
        type: "deposit",
        status: "pending",
        description: "Deposit via Pi Network",
        meta: {
          gateway: "pi_network",
          pi_user: piUser,
          pi_amount: quote.pi_amount,
          base_pi_amount: quote.base_pi_amount,
          rate_ngn_per_pi: quote.rate_ngn_per_pi,
          rate_source: quote.rate_source,
          rate_last_updated_at: quote.rate_last_updated_at,
          buffer_multiplier: quote.buffer_multiplier,
          total_paid: quote.amount_ngn,
          estimated_fee: 0,
        },
      });
      if (error) throw error;

      return jsonResponse({ success: true, reference, ...quote, pi_user: piUser }, req);
    }

    const reference = String(body?.reference || "");
    const paymentId = String(body?.paymentId || body?.payment_id || "");
    const { txn, meta } = await getOwnedPiTransaction(supabase, reference, user);

    if (!paymentId) throw new Error("Pi payment ID is required");

    if (action === "approve") {
      const payment = await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}`);
      validatePiPayment(payment, reference, meta);

      const approvedPayment = payment?.status?.developer_approved
        ? payment
        : await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}/approve`, { method: "POST" });

      await updateTransactionMeta(supabase, txn.id, {
        ...meta,
        pi_payment_id: paymentId,
        pi_approval_response: approvedPayment,
        pi_approved_at: new Date().toISOString(),
      });

      return jsonResponse({ success: true, reference, payment: approvedPayment }, req);
    }

    if (action === "complete" || action === "incomplete") {
      const txid = String(body?.txid || body?.tx_id || "");
      const payment = await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}`);
      validatePiPayment(payment, reference, meta);

      const resolvedTxid = txid || payment?.transaction?.txid || "";
      if (!resolvedTxid) throw new Error("Pi transaction ID is required");

      const completedPayment = payment?.status?.developer_completed
        ? payment
        : await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}/complete`, {
          method: "POST",
          body: JSON.stringify({ txid: resolvedTxid }),
        });

      const completionFailed =
        completedPayment?.status?.cancelled ||
        completedPayment?.status?.user_cancelled ||
        completedPayment?.transaction?.verified === false;

      if (completionFailed) {
        await updateTransactionMeta(supabase, txn.id, {
          ...meta,
          pi_payment_id: paymentId,
          pi_txid: resolvedTxid,
          pi_completion_response: completedPayment,
        }, "failed");

        return jsonResponse({ success: false, reference, local_status: "failed", payment: completedPayment }, req, 400);
      }

      const creditResult = await creditWalletIfNeeded(supabase, txn, meta);
      await updateTransactionMeta(supabase, txn.id, {
        ...meta,
        pi_payment_id: paymentId,
        pi_txid: resolvedTxid,
        pi_completion_response: completedPayment,
        balance_credited: true,
        balance_credited_at: meta?.balance_credited_at || new Date().toISOString(),
      }, "success");

      return jsonResponse({
        success: true,
        reference,
        local_status: "success",
        payment: completedPayment,
        ...creditResult,
      }, req);
    }

    if (action === "cancel") {
      let cancelResponse: unknown = null;
      try {
        cancelResponse = await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}/cancel`, { method: "POST" });
      } catch (error) {
        cancelResponse = { error: error instanceof Error ? error.message : "Cancel request failed" };
      }

      await updateTransactionMeta(supabase, txn.id, {
        ...meta,
        pi_payment_id: paymentId,
        pi_cancel_response: cancelResponse,
        pi_cancelled_at: new Date().toISOString(),
      }, "failed");

      return jsonResponse({ success: true, reference, local_status: "failed", payment: cancelResponse }, req);
    }

    // --- SERVICE PAYMENTS (Airtime, Data, Cable, etc.) ---
    if (action === "service_quote") {
      const amountNgn = Number(body?.amount_ngn ?? body?.amount ?? 0);
      return jsonResponse(await createQuote(amountNgn), req);
    }

    if (action === "service_start") {
      const amountNgn = Number(body?.amount_ngn ?? body?.amount ?? 0);
      if (!Number.isFinite(amountNgn) || amountNgn < 50) {
        throw new Error("Minimum Pi service payment is ₦50");
      }

      const piUser = await verifyPiAccessToken(String(body?.accessToken || ""));
      const quote = await createQuote(amountNgn);
      const reference = `PI-SVC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const serviceType = String(body?.service_type || "unknown");
      const serviceDetails = body?.service_details || {};

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        user_email: user.email,
        reference,
        amount: amountNgn,
        type: "service",
        status: "pending",
        description: `${serviceType} payment via Pi Network`,
        meta: {
          gateway: "pi_network",
          service_type: serviceType,
          service_details: serviceDetails,
          pi_user: piUser,
          pi_amount: quote.pi_amount,
          base_pi_amount: quote.base_pi_amount,
          rate_ngn_per_pi: quote.rate_ngn_per_pi,
          rate_source: quote.rate_source,
          rate_last_updated_at: quote.rate_last_updated_at,
          buffer_multiplier: quote.buffer_multiplier,
        },
      });
      if (error) throw error;

      return jsonResponse({ success: true, reference, ...quote, pi_user: piUser }, req);
    }

    if (action === "service_complete") {
      const reference = String(body?.reference || "");
      const paymentId = String(body?.paymentId || body?.payment_id || "");
      const { txn, meta } = await getOwnedPiTransaction(supabase, reference, user);

      if (!paymentId) throw new Error("Pi payment ID is required");

      const txid = String(body?.txid || body?.tx_id || "");
      const payment = await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}`);
      validatePiPayment(payment, reference, meta);

      const resolvedTxid = txid || payment?.transaction?.txid || "";
      if (!resolvedTxid) throw new Error("Pi transaction ID is required");

      const completedPayment = payment?.status?.developer_completed
        ? payment
        : await piPlatformFetch(`/payments/${encodeURIComponent(paymentId)}/complete`, {
          method: "POST",
          body: JSON.stringify({ txid: resolvedTxid }),
        });

      const completionFailed =
        completedPayment?.status?.cancelled ||
        completedPayment?.status?.user_cancelled ||
        completedPayment?.transaction?.verified === false;

      if (completionFailed) {
        await updateTransactionMeta(supabase, txn.id, {
          ...meta,
          pi_payment_id: paymentId,
          pi_txid: resolvedTxid,
          pi_completion_response: completedPayment,
        }, "failed");

        return jsonResponse({ success: false, reference, local_status: "failed", payment: completedPayment }, req, 400);
      }

      // For services, deduct amount without wallet credit (caller will handle service fulfillment)
      const profileId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("id", profileId)
        .single();

      if (profile) {
        const currentBalance = Number(profile.wallet_balance) || 0;
        const newBalance = currentBalance - (Number(txn.amount) || 0);
        await supabase
          .from("profiles")
          .update({ wallet_balance: Math.max(0, newBalance) })
          .eq("id", profileId);
      }

      await updateTransactionMeta(supabase, txn.id, {
        ...meta,
        pi_payment_id: paymentId,
        pi_txid: resolvedTxid,
        pi_completion_response: completedPayment,
        balance_deducted: true,
        balance_deducted_at: new Date().toISOString(),
      }, "success");

      return jsonResponse({
        success: true,
        reference,
        local_status: "success",
        payment: completedPayment,
        service_type: meta?.service_type,
      }, req);
    }

    throw new Error(`Unsupported Pi payment action: ${action}`);
  } catch (error: any) {
    if (error instanceof Response) {
      const text = await error.text();
      return new Response(text, {
        status: error.status,
        headers: { ...(getCorsHeaders(req.headers.get("Origin") || undefined)), "Content-Type": "application/json" },
      });
    }

    return jsonResponse({ error: error?.message || "Pi payment failed" }, req, 400);
  }
});
