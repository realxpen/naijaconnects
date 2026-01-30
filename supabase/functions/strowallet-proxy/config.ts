export const STRO_CONFIG = {
    BASE_URL: "https://strowallet.com/api/electricity",
    
    // Helper to get key safely
    getPublicKey: () => {
        const key = Deno.env.get("STROWALLET_PUBLIC_KEY");
        if (!key) throw new Error("Server Config Error: Missing STROWALLET_PUBLIC_KEY");
        return key;
    }
};

// Generic Helper for Strowallet Requests
export const makeStroRequest = async (endpoint: string, payload: any) => {
    const url = `${STRO_CONFIG.BASE_URL}${endpoint}`;
    
    // Inject Public Key into every request body
    const body = {
        public_key: STRO_CONFIG.getPublicKey(),
        ...payload
    };

    console.log(`[StroWallet] POST -> ${url}`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const rawText = await response.text();
    try {
        return JSON.parse(rawText);
    } catch (e) {
        throw new Error(`StroWallet Error: ${rawText.substring(0, 100)}`);
    }
};