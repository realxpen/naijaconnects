import { CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

/**
 * 1. FETCH SMILE PACKAGES
 * Retrieves available bundles from the V2 packages endpoint.
 */
export const fetchSmilePlans = async () => {
    // Note: This endpoint only requires UserID
    const url = `https://www.nellobytesystems.com/APISmilePackagesV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("[Smile Plans] Raw Data Received:", JSON.stringify(data).substring(0, 200));

        /**
         * Nellobyte/ClubKonnect standard JSON structure for Smile usually returns:
         * { "MOBILE_SMILE": [ { "variation_code": "...", "name": "...", "variation_amount": "..." }, ... ] }
         */
        let rawPlans = [];
        if (data.MOBILE_SMILE) {
            rawPlans = data.MOBILE_SMILE;
        } else if (data.SMILE) {
            rawPlans = data.SMILE;
        } else if (Array.isArray(data)) {
            rawPlans = data;
        } else if (data.content && data.content.varations) { // Some Nellobyte proxies use this
            rawPlans = data.content.varations;
        }

        // Map to standard app format: { id, name, price }
        return rawPlans.map((p: any) => ({
            id: p.variation_code || p.PACKAGE_ID || p.code,
            name: p.name || p.PACKAGE_NAME || p.variation_name,
            price: parseFloat(p.variation_amount || p.PACKAGE_AMOUNT || p.amount || "0")
        }));
    } catch (e) {
        console.error("Smile Plans Fetch Error:", e);
        return [];
    }
};

/**
 * 2. VERIFY SMILE ACCOUNT
 * Verifies the Smile Account ID before purchase to prevent errors.
 */
export const verifySmileNumber = async (payload: any) => {
    const { number } = payload;
    // Endpoint: APIVerifySmileV1.asp
    const url = `https://www.nellobytesystems.com/APIVerifySmileV1.asp?UserID=${CLUBKONNECT_USER_ID}&APIKey=${CLUBKONNECT_API_KEY}&MobileNetwork=smile-direct&MobileNumber=${number}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Success: {"customer_name": "NAME"} 
        // Fail: {"customer_name": "INVALID_ACCOUNTNO"}
        const isValid = data.customer_name && 
                        !data.customer_name.includes("INVALID") && 
                        !data.customer_name.includes("Error");

        return {
            valid: isValid,
            customer_name: isValid ? data.customer_name : "Invalid Account Number"
        };
    } catch (e) {
        console.error("Smile Verify Error:", e);
        throw new Error("Smile Verification service timed out.");
    }
};

/**
 * 3. BUY SMILE DATA
 * Submits the purchase request to the Smile API.
 */
export const buySmileData = async (payload: any) => {
    const { number, plan_id, phone } = payload;
    const requestID = `SMILE_${Date.now()}`;
    
    // Exact Parameter Names: MobileNetwork=smile-direct, DataPlan=code, MobileNumber=account_id
    const url = `https://www.nellobytesystems.com/APISmileV1.asp?UserID=${CLUBKONNECT_USER_ID}&APIKey=${CLUBKONNECT_API_KEY}&MobileNetwork=smile-direct&DataPlan=${plan_id}&MobileNumber=${number}&RequestID=${requestID}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Standard Statuses: ORDER_RECEIVED or ORDER_COMPLETED
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status || data.remark || "Transaction Processed",
            data: data,
            reference: requestID
        };
    } catch (e: any) {
        console.error("Smile Purchase Error:", e);
        throw new Error(`Smile Purchase Failed: ${e.message}`);
    }
};