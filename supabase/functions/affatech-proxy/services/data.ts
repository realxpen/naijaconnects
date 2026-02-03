import { makeAffatechRequest } from "../config.ts";

/**
 * 1. FETCH DATA PLANS
 * Normalizes the raw API response into a standard format for the Frontend.
 */
export const fetchDataPlans = async () => {
    try {
        console.log("[Affatech] Fetching data plans...");
        
        // 1. Get raw data
        const response = await makeAffatechRequest('/dataplans/', {}, 'GET');
        
        // 2. Handle different response structures (Array vs Object wrapper)
        const rawPlans = Array.isArray(response) ? response : (response.dataplans || []);

        if (!Array.isArray(rawPlans) || rawPlans.length === 0) {
            console.warn("[Affatech] No plans found in response:", JSON.stringify(response));
            return [];
        }

        // 3. Helper to Map Network Names to IDs (matches your Dashboard.tsx)
        const getNetworkId = (str: string) => {
            const s = str?.toUpperCase() || "";
            if (s.includes("MTN")) return 1;
            if (s.includes("GLO")) return 2;
            if (s.includes("AIRTEL")) return 3;
            if (s.includes("9MOBILE") || s.includes("ETISALAT")) return 4;
            return 0;
        };

        // 4. Return Normalized Data
        return rawPlans.map((p: any) => ({
            id: p.id || p.plan_id,
            network: getNetworkId(p.network),
            plan_name: p.plan || p.name || p.plan_name,
            // Ensure price is a number
            amount: parseFloat(p.price || p.amount || p.plan_amount || "0"), 
            validity: p.month_validate || p.validity || "30 Days",
            plan_type: p.plan_type || "ALL"
        }));

    } catch (e: any) {
        console.error("[Affatech] Fetch Plans Error:", e.message);
        return [];
    }
};

/**
 * 2. BUY DATA
 * Includes validation and detailed logging for debugging.
 */
export const buyData = async (payload: any) => {
    // [DEBUG LOG] See exactly what the frontend sent
    console.log(`[Buy Data Debug] Payload:`, JSON.stringify(payload));

    const { network, phone, plan_id } = payload;

    // 1. Validation: Prevent request if Plan ID is missing
    if (!plan_id) {
        throw new Error("Missing Plan ID. Please select a valid data plan.");
    }

    // 2. Prepare Body
    const body = {
        network: network,
        mobile_number: phone,
        plan: plan_id,
        Ported_number: true
    };

    try {
        // 3. Send Request
        const data = await makeAffatechRequest('/data/', body, 'POST');

        // [DEBUG LOG] See exactly what Affatech replied
        console.log(`[Affatech API Response]`, JSON.stringify(data));

        // 4. Check Success
        if (data.Status === "successful" || data.status === "success") {
            return {
                success: true,
                message: "Data Purchase Successful",
                data: data,
                reference: data.id || `AFF_DATA_${Date.now()}`
            };
        } else {
            // Throw the specific error from the API
            throw new Error(data.api_response || data.error || "Data Transaction Failed");
        }
    } catch (e: any) {
        console.error(`[Buy Data Exception] ${e.message}`);
        throw e;
    }
};