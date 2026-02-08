import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Unauthorized");

    const { amount, account_number, bank_code, bank_name, account_name } = await req.json();
    const withdrawAmount = Number(amount);

    if (withdrawAmount < 100) throw new Error("Minimum withdrawal is ₦100");

    // --- OFFICIAL TIERED FEE LOGIC ---
    let FEE = 0;

    if (withdrawAmount <= 5000) {
        FEE = 10;
    } else if (withdrawAmount <= 50000) {
        FEE = 25;
    } else {
        FEE = 50; // Above 50,000
    }
    
    const totalDeduction = withdrawAmount + FEE; 
    // ---------------------------------

    // Check Balance
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();

    if (!profile) throw new Error("Profile not found");
    if (profile.balance < totalDeduction) {
      throw new Error(`Insufficient balance. You need ₦${totalDeduction} (incl. ₦${FEE} fee)`);
    }

    // Deduct Balance (Amount + Fee)
    const newBalance = profile.balance - totalDeduction;
    
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", user.id);

    if (updateError) throw new Error("Failed to update balance");

    // Record Transaction
    const reference = `WTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    await supabase.from("transactions").insert({
      user_id: user.id,
      reference: reference,
      amount: withdrawAmount, // Amount Requested
      type: "withdrawal",
      status: "pending",
      description: `Withdrawal to ${bank_name}`,
      meta: { 
        bank_code, bank_name, account_name, account_number,
        fee: FEE,
        total_deducted: totalDeduction
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Withdrawal request submitted", 
      new_balance: newBalance 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
