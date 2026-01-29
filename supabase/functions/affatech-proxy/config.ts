export const API_CONFIG = {
    // Replace this with your Live Key from Affatech Dashboard
    API_KEY: "Token 6a732e1262fd1733551773b0549d8bfb52a19e20", 
    BASE_URL: "https://www.affatech.com.ng/api",
    
    getHeaders: () => ({
        'Authorization': "Token 6a732e1262fd1733551773b0549d8bfb52a19e20", // Ensure this matches API_KEY
        'Content-Type': 'application/json'
    })
};

export const makeApiRequest = async (endpoint: string, body: any = {}, method = 'POST') => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    console.log(`[Proxy] ${method} -> ${url}`);
    
    const options: any = {
        method: method,
        headers: API_CONFIG.getHeaders()
    };

    if (method === 'POST') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const rawText = await response.text();

    try {
        const data = JSON.parse(rawText);
        return data;
    } catch (e) {
        console.error(`[Provider Error] Raw Response: ${rawText}`);
        throw new Error(`Provider Error: ${rawText.substring(0, 100)}`);
    }
};