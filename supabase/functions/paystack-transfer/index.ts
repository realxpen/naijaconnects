import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. CORS Setup
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!PAYSTACK_SECRET_KEY) throw new Error("Missing Config");

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Safe Body Parsing
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const { action, account_number, bank_code, amount, email, reference } = body;

    const makeReference = () => {
      const ref = `wd_${crypto.randomUUID()}`;
      return ref.toLowerCase();
    };

    const isValidReference = (ref: string) => {
      return /^[a-z0-9_-]{16,50}$/.test(ref);
    };

    // ============================================================
    // 1. LIST BANKS (This was missing!)
    // ============================================================
    if (action === 'list_banks') {
      const res = await fetch('https://api.paystack.co/bank?currency=NGN', {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // ============================================================
    // 2. VERIFY ACCOUNT NAME (Resolve)
    // ============================================================
    if (action === 'verify') {
      const res = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // ============================================================
    // 3. TRANSFER (Withdrawal)
    // ============================================================
    if (action === 'transfer') {
        if (!account_number || !bank_code || !amount || !email) throw new Error("Missing transfer details");

        // A. Check & Deduct Balance
        const { data: userProfile } = await supabaseAdmin.from('profiles').select('balance, id').eq('email', email).single();
        
        if (!userProfile || Number(userProfile.balance) < Number(amount)) {
             throw new Error("Insufficient wallet balance");
        }

        const { error: deductError } = await supabaseAdmin.from('profiles')
            .update({ balance: Number(userProfile.balance) - Number(amount) })
            .eq('email', email);

        if (deductError) throw new Error("Database error");

        try {
            // B. Resolve Account
            const resolveRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, { 
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } 
            });
            const resolveData = await resolveRes.json();
            if (!resolveData.status) throw new Error("Invalid Account Number");

            // C. Create Recipient
            const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    type: "nuban", 
                    name: resolveData.data.account_name, 
                    account_number: account_number, 
                    bank_code: bank_code, 
                    currency: "NGN" 
                }),
            });
            const recipientData = await recipientRes.json();
            if (!recipientData.status) throw new Error("Failed to create beneficiary");

            // D. Initiate Transfer
            const uniqueRef = reference && isValidReference(reference) ? reference : makeReference();
            const transferRes = await fetch("https://api.paystack.co/transfer", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    source: "balance", 
                    amount: amount * 100, 
                    recipient: recipientData.data.recipient_code, 
                    reason: `Withdrawal for ${email}`, 
                    reference: uniqueRef 
                }),
            });
            const finalData = await transferRes.json();

            if (!finalData.status) throw new Error(finalData.message);
            if (finalData.data?.status === 'otp') throw new Error("Please disable Transfer OTP in Paystack Settings");

            // E. Log Pending/Success
            const transferStatus = finalData.data?.status || "pending";
            const txStatus = transferStatus === "success" ? "Success" : "Pending";
            await supabaseAdmin.from('transactions').insert({
                user_email: email, reference: uniqueRef, amount: amount, type: 'Withdrawal', status: txStatus
            });

            return new Response(JSON.stringify(finalData), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 
            });

        } catch (error: any) {
            // F. Auto-Refund on Failure
            await supabaseAdmin.rpc('fund_wallet_secure', { 
                user_email_input: email, amount_input: Number(amount), ref_input: `refund-${Date.now()}` 
            });
            throw error;
        }
    }

    // ============================================================
    // 4. VERIFY TRANSFER (Polling)
    // ============================================================
    if (action === 'verify_transfer') {
        if (!reference || !isValidReference(reference)) throw new Error("Invalid transfer reference");

        const verifyRes = await fetch(`https://api.paystack.co/transfer/verify/${reference}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.status) throw new Error(verifyData.message || "Verification failed");

        const status = verifyData.data?.status || "pending";
        const { data: tx } = await supabaseAdmin
            .from('transactions')
            .select('id, user_email, amount, status')
            .eq('reference', reference)
            .single();

        if (tx) {
            if (status === "success") {
                await supabaseAdmin.from('transactions').update({ status: "Success" }).eq('id', tx.id);
            } else if (status === "failed" || status === "reversed") {
                if (tx.status !== "Failed" && tx.status !== "Reversed") {
                    await supabaseAdmin.rpc('fund_wallet_secure', { 
                        user_email_input: tx.user_email, amount_input: Number(tx.amount), ref_input: `refund-${Date.now()}` 
                    });
                }
                await supabaseAdmin.from('transactions').update({ status: status === "reversed" ? "Reversed" : "Failed" }).eq('id', tx.id);
            }
        }

        return new Response(JSON.stringify({ status: true, transfer_status: status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
        });
    }

    // Default Fallback
    return new Response(JSON.stringify({ status: false, message: "Invalid Action" }), { 
         headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ status: false, message: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 
    })
  }
})
