import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

const hmacSha512Hex = async (secret: string, content: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(content));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const buildVaSignatureBase = (payload: any) => {
  const tr = payload?.transaction_reference;
  const va = payload?.virtual_account_number;
  const c = payload?.currency;
  const p = payload?.principal_amount;
  const s = payload?.settled_amount;
  const cid = payload?.customer_identifier;
  if (!tr || !va || !c || p == null || s == null || !cid) return "";
  return `${tr}|${va}|${c}|${p}|${s}|${cid}`;
};

serve(async (req) => {
  try {
    const bodyText = await req.text();
    if (!bodyText) return new Response("Empty body", { status: 400 });

    const payload = JSON.parse(bodyText);

    const signature =
      req.headers.get("x-squad-encrypted-body") ||
      req.headers.get("x-squad-signature") ||
      "";
    const secretKey = Deno.env.get("SQUAD_SECRET_KEY") || "";

    if (secretKey && signature) {
      const normalized = signature.toLowerCase();
      const candidates: string[] = [];

      candidates.push(await hmacSha512Hex(secretKey, bodyText));
      candidates.push(await hmacSha512Hex(secretKey, JSON.stringify(payload)));

      const vaSignatureBase = buildVaSignatureBase(payload);
      if (vaSignatureBase) {
        candidates.push(await hmacSha512Hex(secretKey, vaSignatureBase));
      }

      const matched = candidates.some((c) => c.toLowerCase() === normalized);
      if (!matched) return new Response("Invalid signature", { status: 401 });
    }

    const reference =
      payload?.TransactionRef ||
      payload?.transaction_ref ||
      payload?.transaction_reference ||
      payload?.Body?.transaction_ref ||
      payload?.Body?.transaction_reference;

    if (!reference) return new Response(JSON.stringify({ received: true }), { status: 200 });

    const rawStatus = String(
      payload?.Body?.transaction_status ||
      payload?.transaction_status ||
      payload?.status ||
      "",
    ).toUpperCase();
    const eventName = String(payload?.Event || payload?.event || "").toUpperCase();

    const isSuccess =
      rawStatus === "SUCCESS" ||
      rawStatus === "SUCCESSFUL" ||
      rawStatus === "COMPLETED" ||
      rawStatus === "PAID" ||
      eventName === "CHARGE_SUCCESSFUL";

    const isFailed =
      rawStatus === "FAILED" ||
      rawStatus === "FAIL" ||
      rawStatus === "ABANDONED" ||
      rawStatus === "CANCELLED" ||
      rawStatus === "MISMATCH" ||
      rawStatus === "EXPIRED";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, user_id, user_email, amount, meta")
      .eq("reference", reference)
      .single();

    if (txnError || !txn) {
      return new Response("Transaction not found", { status: 200 });
    }

    const txnMeta = txn?.meta && typeof txn.meta === "object" ? txn.meta : {};
    const alreadyCredited = Boolean(txnMeta?.balance_credited);

    if (isSuccess) {
      if (txn.status !== "success") {
        const { error } = await supabase
          .from("transactions")
          .update({
            status: "success",
            updated_at: new Date().toISOString(),
            meta: {
              ...txnMeta,
              squad_event: eventName || null,
              squad_status: rawStatus || null,
            },
          })
          .eq("id", txn.id);
        if (error) throw error;
      }

      if (!alreadyCredited) {
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
              .insert({
                id: txn.user_id,
                email: txn.user_email,
                wallet_balance: 0,
              })
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

        const { error: markCreditedError } = await supabase
          .from("transactions")
          .update({
            meta: {
              ...txnMeta,
              squad_event: eventName || null,
              squad_status: rawStatus || null,
              balance_credited: true,
              balance_credited_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", txn.id);
        if (markCreditedError) throw markCreditedError;
      }
    } else if (isFailed) {
      await supabase
        .from("transactions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          meta: {
            ...txnMeta,
            squad_event: eventName || null,
            squad_status: rawStatus || null,
          },
        })
        .eq("id", txn.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
