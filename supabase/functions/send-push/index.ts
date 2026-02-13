// supabase/functions/send-push/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 1. Setup Keys (Make sure these are set in Supabase Secrets!)
const vapidKeys = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
  subject: 'mailto:admin@swifna.com' // Your admin email
};

webpush.setVapidDetails(
  vapidKeys.subject,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Get Data from Request
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title || !body) {
      throw new Error("Missing user_id, title, or body");
    }

    // 3. Fetch Subscriptions for User
    // We select the 'subscription' column which contains the JSON object { endpoint, keys: { ... } }
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('subscription') 
      .eq('user_id', user_id);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No subscriptions found for user ${user_id}`);
      return new Response(JSON.stringify({ success: true, message: "User has no devices registered" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${subscriptions.length} devices for user ${user_id}`);

    // 4. Send Notification to all devices
    const notificationPayload = JSON.stringify({ title, body, url });

    const sendPromises = subscriptions.map(async (row) => {
      try {
        // row.subscription is the JSON object we saved from the frontend
        await webpush.sendNotification(row.subscription, notificationPayload);
        return { success: true };
      } catch (err: any) {
        console.error("Push Error:", err);

        // If subscription is dead (410 Gone), delete it from DB to clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("Cleaning up dead subscription...");
          // We use the endpoint to find and delete the exact row
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription->>endpoint', row.subscription.endpoint); 
        }
        return { success: false, error: err.message };
      }
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});