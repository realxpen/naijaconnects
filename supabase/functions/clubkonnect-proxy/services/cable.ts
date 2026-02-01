import { makeClubKonnectRequest, CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

export const fetchCablePlans = async () => {
    // 1. Fetch LIVE data from ClubKonnect
    const url = `https://www.nellobytesystems.com/APICableTVPackagesV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
    
    try {
        const response = await fetch(url);
        const rawData = await response.json();
        
        // 2. Prepare a clean container for our plans
        const cleanPlans: Record<string, any[]> = {
            dstv: [],
            gotv: [],
            startimes: [],
            showmax: []
        };

        // 3. Helper to extract products from the specific API structure
        // Structure is: { TV_ID: { "DStv": [ { "PRODUCT": [...] } ] } }
        const extract = (apiKeys: string[]) => {
            if (!rawData.TV_ID) return [];

            for (const key of apiKeys) {
                // Check if key exists (e.g. "DStv" or "DSTV")
                const providerData = rawData.TV_ID[key]; 
                
                // Navigate into the nested array
                if (Array.isArray(providerData) && providerData[0] && Array.isArray(providerData[0].PRODUCT)) {
                    return providerData[0].PRODUCT.map((p: any) => ({
                        id: p.PACKAGE_ID,
                        name: p.PACKAGE_NAME,
                        amount: parseFloat(p.PACKAGE_AMOUNT)
                    })).sort((a: any, b: any) => a.amount - b.amount);
                }
            }
            return [];
        };

        // 4. Map ClubKonnect's keys to our App's keys
        cleanPlans.dstv = extract(["DStv", "DSTV"]);
        cleanPlans.gotv = extract(["GOtv", "GOTV"]);
        cleanPlans.startimes = extract(["Startimes", "STARTIMES"]);
        cleanPlans.showmax = extract(["Showmax", "SHOWMAX"]);

        // 5. Return clean data to Frontend
        return cleanPlans;

    } catch (e) {
        console.error("Backend Cable Fetch Error:", e);
        throw e;
    }
};

// ... (Keep verifySmartCard and buyCable below exactly as they were) ...
export const verifySmartCard = async (payload: any) => {
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("CableTV", payload.provider); 
    params.append("SmartCardNo", payload.iuc);

    const url = `https://www.nellobytesystems.com/APIVerifyCableTVV1.0.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return {
            valid: data.customer_name && !data.customer_name.includes("INVALID"),
            customer_name: data.customer_name
        };
    } catch (e) {
        throw e;
    }
};

export const buyCable = async (payload: any) => {
    const requestID = `CK_CAB_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("CableTV", payload.provider);
    params.append("Package", payload.plan_code);
    params.append("SmartCardNo", payload.iuc);
    params.append("PhoneNo", payload.phone);
    params.append("RequestID", requestID);

    const url = `https://www.nellobytesystems.com/APICableTVV1.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status,
            data: data,
            reference: requestID
        };
    } catch (e) {
        throw e;
    }
};