export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const AFFATECH_CONFIG = {
    // UPDATED: Added 'www.' back as per documentation
    BASE_URL: "https://www.affatech.com.ng/api", 
    
    getHeaders: () => {
        const apiKey = Deno.env.get("AFFATECH_API_KEY");
        if (!apiKey) throw new Error("Server Config Error: Missing AFFATECH_API_KEY");
        
        return {
            "Content-Type": "application/json",
            "Authorization": `Token ${apiKey}` 
        };
    }
};

export const makeAffatechRequest = async (endpoint: string, payload: any = {}, method = 'POST') => {
    const url = `${AFFATECH_CONFIG.BASE_URL}${endpoint}`;
    
    console.log(`[Affatech] ${method} -> ${url}`);

    const options: any = {
        method: method,
        headers: AFFATECH_CONFIG.getHeaders(),
    };

    if (method === 'POST') {
        options.body = JSON.stringify(payload);
    }

    try {
        const response = await fetch(url, options);
        const rawText = await response.text();
        
        try {
            return JSON.parse(rawText);
        } catch {
            // Log the raw text if parsing fails (helps debug HTML error pages)
            throw new Error(`Affatech Error (Non-JSON): ${rawText.substring(0, 100)}`);
        }
    } catch (e: any) {
        throw new Error(`Network Error: ${e.message}`);
    }
};