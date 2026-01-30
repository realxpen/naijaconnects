import { STRO_CONFIG } from "../config.ts";

// Helper: Map Frontend ID (1,2,3,4) to Strowallet Network Names
const getNetworkName = (id: number | string) => {
    const map: Record<string, string> = {
        "1": "MTN",
        "2": "Glo",
        "3": "Airtel",
        "4": "9mobile"
    };
    return map[String(id)] || "MTN";
};

export const buyRechargePin = async (payload: any) => {
    // 1. Get Credentials
    const publicKey = STRO_CONFIG.getPublicKey();
    
    // 2. Prepare Parameters
    const params = new URLSearchParams({
        public_key: publicKey,
        card_network: getNetworkName(payload.network),
        value: String(payload.amount), // e.g., "100"
        quantity: String(payload.quantity || 1)
        // Note: We omit 'mode' to use the default (Production/Live) environment 
        // determined by your Key. If testing, Strowallet might default to sandbox.
    });

    // 3. Construct URL (POST with Query Params)
    const url = `${STRO_CONFIG.BASE_URL}/buy_epin/?${params.toString()}`;
    
    console.log(`[StroWallet] POST EPIN -> ${url}`);

    // 4. Send Request
    const response = await fetch(url, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    });

    const rawText = await response.text();
    try {
        const data = JSON.parse(rawText);
        // Normalize response for Frontend
        // Strowallet usually returns { success: true, message: "...", data: [...] }
        return data; 
    } catch (e) {
        throw new Error(`StroWallet Error: ${rawText.substring(0, 100)}`);
    }
};