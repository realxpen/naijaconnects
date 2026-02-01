import { makeClubKonnectRequest, CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

export const fetchCablePlans = async () => {
    // ENDPOINT: https://www.nellobytesystems.com/APICableTVPackagesV2.asp
    // This returns the full list of packages for all providers
    const url = `https://www.nellobytesystems.com/APICableTVPackagesV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data; 
    } catch (e) {
        console.error("Fetch Cable Plans Error:", e);
        throw new Error("Failed to fetch cable plans");
    }
};

export const verifySmartCard = async (payload: any) => {
    // ENDPOINT: https://www.nellobytesystems.com/APIVerifyCableTVV1.0.asp
    // Params: UserID, APIKey, CableTV, SmartCardNo
    
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("CableTV", payload.provider); // dstv, gotv, startimes, showmax
    params.append("SmartCardNo", payload.iuc);

    const url = `https://www.nellobytesystems.com/APIVerifyCableTVV1.0.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Response: { "customer_name": "NAME" } or { "customer_name": "INVALID_SMARTCARDNO" }
        return {
            valid: data.customer_name && !data.customer_name.includes("INVALID"),
            customer_name: data.customer_name
        };
    } catch (e) {
        console.error("Verify Cable Error:", e);
        throw new Error("Verification failed");
    }
};

export const buyCable = async (payload: any) => {
    // ENDPOINT: https://www.nellobytesystems.com/APICableTVV1.asp
    
    const requestID = `CK_CAB_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("CableTV", payload.provider);
    params.append("Package", payload.plan_code);
    params.append("SmartCardNo", payload.iuc);
    params.append("PhoneNo", payload.phone);
    params.append("RequestID", requestID);
    // params.append("CallBackURL", "...");

    const url = `https://www.nellobytesystems.com/APICableTVV1.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Success check based on docs
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status,
            data: data,
            reference: requestID
        };
    } catch (e) {
        console.error("Buy Cable Error:", e);
        throw e;
    }
};