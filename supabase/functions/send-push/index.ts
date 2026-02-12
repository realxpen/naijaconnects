import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import webpush from "npm:web-push";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@swifna.com";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({}, 200);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase service role" }, 500);
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonResponse({ error: "Missing VAPID keys" }, 500);
  }

  try {
    const { title, message, url } = await req.json();
    const payload = JSON.stringify({
      title: title || "Swifna",
      body: message || "",
      url: url || "https://swifna-liart.vercel.app/",
    });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: "Failed to fetch subscriptions", details: text }, 500);
    }
    const subs = await res.json();

    let sent = 0;
    let failed = 0;

    for (const s of subs) {
      const subscription = s.subscription && s.subscription.endpoint
        ? s.subscription
        : {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          };
      try {
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as any)?.statusCode;
        if (status === 404 || status === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          });
        }
      }
    }

    return jsonResponse({ sent, failed });
  } catch (e) {
    return jsonResponse({ error: "Push send failed", details: String(e) }, 500);
  }
});
