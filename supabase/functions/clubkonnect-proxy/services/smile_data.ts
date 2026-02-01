import { makeClubKonnectRequest, CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

// --- 1. FETCH SMILE PLANS ---
export const fetchSmilePlans = async () => {
    // ENDPOINT: APISmilePackagesV2.asp
    const url = `https://www.nellobytesystems.com/APISmilePackagesV2.asp?UserID=${CLUBKONNECT_USER_ID}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch Smile plans");

        const rawData = await response.json();
        
        // Structure is usually { "MOBILE_NETWORK": { "smile-direct": [ { "PRODUCT": [...] } ] } }
        // We need to dig in and find the products.
        let products = [];

        if (rawData.MOBILE_NETWORK && rawData.MOBILE_NETWORK['smile-direct']) {
            const networkData = rawData.MOBILE_NETWORK['smile-direct'];
            if (Array.isArray(networkData) && networkData[0]?.PRODUCT) {
                products = networkData[0].PRODUCT;
            }
        }

        // Normalize to our app's format
        return products.map((p: any) => ({
            id: p.PACKAGE_ID,
            name: p.PACKAGE_NAME,
            amount: parseFloat(p.PACKAGE_AMOUNT),
            network: 'SMILE' // UI helper
        })).sort((a: any, b: any) => a.amount - b.amount);

    } catch (e) {
        console.error("Smile Plan Error:", e);
        return [];
    }
};

// --- 2. VERIFY SMILE ACCOUNT ---
export const verifySmileNumber = async (payload: any) => {
    // ENDPOINT: APIVerifySmileV1.asp
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("MobileNetwork", "smile-direct");
    params.append("MobileNumber", payload.phone);

    const url = `https://www.nellobytesystems.com/APIVerifySmileV1.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Success: { "customer_name": "JOHN DOE" }
        // Error: { "customer_name": "INVALID_ACCOUNTNO" }
        const isValid = data.customer_name && !data.customer_name.includes("INVALID");

        return {
            valid: isValid,
            customer_name: isValid ? data.customer_name : "Invalid Smile ID"
        };
    } catch (e) {
        throw new Error("Verification failed");
    }
};

// --- 3. BUY SMILE DATA ---
export const buySmileData = async (payload: any) => {
    const requestID = `CK_SMILE_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("MobileNetwork", "smile-direct");
    params.append("DataPlan", payload.plan_id);
    params.append("MobileNumber", payload.phone);
    params.append("RequestID", requestID);

    const url = `https://www.nellobytesystems.com/APISmileV1.asp?${params.toString()}`;

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