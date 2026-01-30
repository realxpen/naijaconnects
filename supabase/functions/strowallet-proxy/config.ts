export const STRO_CONFIG = {
    // BASE URL is now the root API
    BASE_URL: "https://strowallet.com/api",
    
    getPublicKey: () => {
        const key = Deno.env.get("STROWALLET_PUBLIC_KEY");
        if (!key) throw new Error("Server Config Error: Missing STROWALLET_PUBLIC_KEY");
        return key;
    }
};

export const makeStroRequest = async (endpoint: string, payload: any = {}, method = 'POST') => {
    const url = `${STRO_CONFIG.BASE_URL}${endpoint}`;
    
    const options: any = {
        method: method,
        headers: { "Content-Type": "application/json" }
    };

    if (method === 'POST') {
        options.body = JSON.stringify({
            public_key: STRO_CONFIG.getPublicKey(),
            ...payload
        });
    } 
    
    console.log(`[StroWallet] ${method} -> ${url}`);

    const response = await fetch(url, options);
    const rawText = await response.text();
    
    try {
        return JSON.parse(rawText);
    } catch (e) {
        throw new Error(`StroWallet Error: ${rawText.substring(0, 100)}`);
    }
};