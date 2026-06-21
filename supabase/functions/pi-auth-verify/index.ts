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
    const { accessToken } = await req.json();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Securely verify token with the official Pi Network API
    const piResponse = await fetch("https://api.minepi.com/v2/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!piResponse.ok) {
      const errText = await piResponse.text();
      return new Response(
        JSON.stringify({ error: `Invalid token from Pi Network: ${errText}` }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const piUserData = await piResponse.json();
    const piUid = piUserData.uid;
    const piUsername = piUserData.username;

    // 2. Initialize Supabase Admin Client
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(url, key);

    // 3. Find the profile matching this Pi identity
    let { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("pi_uid", piUid)
      .maybeSingle();

    if (profileError) throw profileError;

    let targetEmail = profile?.email;

    // 4. If the profile doesn't exist yet, register a brand new user row safely
    if (!profile) {
      targetEmail = `${piUid}@pi.local`;

      const { data: authUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: targetEmail,
          email_confirm: true,
        });

      if (createError) throw createError;

      // Insert profile mirroring the new auth ID
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authUser.user.id,
          email: targetEmail,
          pi_uid: piUid,
          pi_username: piUsername,
        });

      if (insertError) throw insertError;
    }

    // 5. Generate the official native Supabase magiclink login route
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
      });

    if (linkError) throw linkError;

    // 6. Return the safe web redirect link straight back to the client app
    return new Response(
      JSON.stringify({
        success: true,
        linked: true,
        link: linkData.properties?.action_link,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[Edge Function Error]:", error);
    return new Response(JSON.stringify({ error: error.message || error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
