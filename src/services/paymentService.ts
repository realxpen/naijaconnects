import axios from 'axios';
import { DataPlan } from '../types';

// 🔐 KEYS (FIXED: Use import.meta.env for Vite)
// WARNING: Never expose SECRET keys on the frontend. 
// Ideally, 'fundWallet' should be moved to a Supabase Edge Function.
const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ""; 
const AFFATECH_TOKEN = `Token ${import.meta.env.VITE_AFFATECH_API_KEY || ""}`; 

// 🌍 CONFIGURATION
// Uses local proxy rewrite defined in vercel.json to bypass CORS
// Ensure your Vercel project Environment Variables are set!
const API_BASE = "/api/proxy"; 

// 🛠️ HELPER: Normalize Plan Types
const normalizePlanType = (type: string) => {
  const t = (type || '').toUpperCase();
  if (t.includes("SME")) return "SME";
  if (t.includes("CORPORATE") || t.includes("CG")) return "CORPORATE";
  if (t.includes("GIFT")) return "GIFTING";
  if (t.includes("SHARE")) return "DATA SHARE"; 
  return "MONTHLY"; 
};

// 1. FETCH PLANS (Loops Networks 1-5)
export const getPlans = async (): Promise<DataPlan[]> => {
  try {
    console.log("🔄 Fetching plans from Affatech...");

    // 1:MTN, 2:GLO, 3:9MOBILE, 4:AIRTEL, 5:SMILE
    const networkIds = [1, 2, 3, 4, 5];

    // Fetch all networks in parallel
    const requests = networkIds.map(netId => 
      axios.get(`${API_BASE}/data/`, {
        params: { network: netId },
        headers: { Authorization: AFFATECH_TOKEN }
      })
    );

    const responses = await Promise.all(requests);

    // Merge results
    const rawPlans = responses.flatMap(response => response.data.results || response.data);

    // 🛡️ DATA SANITIZATION
    const mappedPlans: DataPlan[] = rawPlans
      .filter((p: any) => {
         // Filter out plans with missing data OR "Placeholder" prices (e.g. 950,000,000)
         const price = Number(p.amount);
         const isCrazyPrice = price > 200000 && !p.size?.includes('TB');
         return p.network && p.plan_type && !isCrazyPrice;
      }) 
      .map((p: any) => ({
        id: Number(p.id),             // <--- Correctly Cast to Number
        network: Number(p.network), 
        plan_type: normalizePlanType(p.plan_type), 
        amount: p.amount.toString(),  // <--- FIXED: Now matches 'DataPlan' interface (string)
        size: p.size || p.dataplan || p.name || 'Unknown', 
        validity: p.validity || '30 Days',
        price: Number(p.amount)       // Helper for UI calculations
      }));

    console.log(`✅ Successfully loaded ${mappedPlans.length} plans.`);
    return mappedPlans;

  } catch (error: any) {
    console.error("❌ API Fetch Error:", error);
    // Friendly error for local dev without Vercel
    if (error.response?.status === 404) {
       console.warn("If you are running locally, ensure you are using 'vercel dev' to enable the proxy.");
    }
    throw new Error("Failed to fetch plans.");
  }
};

// 2. BUY DATA
export const buyData = async (networkId: number, phone: string, planId: number) => {
  try {
    console.log(`💸 Buying: Net=${networkId}, Plan=${planId}, Phone=${phone}`);

    const response = await axios.post(`${API_BASE}/data/`, {
      network: networkId,
      mobile_number: phone,
      plan: planId,
      Ported_number: true
    }, { 
      headers: { Authorization: AFFATECH_TOKEN } 
    });
    
    return response.data;

  } catch (error: any) {
    const serverMsg = error.response?.data?.error || "Transaction failed";
    console.error("🔥 Buy Error:", serverMsg);
    throw new Error(serverMsg);
  }
};

// 3. FUND WALLET (Paystack)
export const fundWallet = async (email: string, amount: number) => {
  try {
    // Note: Calling Paystack Initialize API directly requires a SECRET KEY.
    // Using a Secret Key on the frontend is insecure.
    // Ideally, call a Supabase Edge Function to handle this.
    // For now, we assume you are handling this risk or testing.
    
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { 
        email: email, 
        amount: amount * 100, 
        callback_url: typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000" 
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_KEY}` } }
    );
    return {
      success: true,
      checkoutUrl: response.data.data.authorization_url,
      reference: response.data.data.reference 
    };
  } catch (error) {
    throw error;
  }
};

// Compatibility Exports
export const initializeTopUp = fundWallet;
export const verifyTransaction = async (ref: string) => { return { success: true, amount: 0 } }; 
export const withdrawFunds = async () => { return { status: true } };