import { makeAffatechRequest } from "../config.ts";

export const buyAirtime = async (payload: any) => {
    // 1. Map Airtime Types to Affatech Standards
    // Affatech typically expects "VTU", "Share and Sell", etc.
    let airtimeType = payload.airtime_type || "VTU";

    // Normalize specific types
    if (airtimeType === 'awuf4U') airtimeType = 'Awuf4U'; 
    if (airtimeType === 'Share and Sell') airtimeType = 'Share and Sell';

    // 2. Prepare Body
    const body = {
        network: payload.network,          // 1=MTN, 2=GLO, etc.
        amount: payload.amount,
        mobile_number: payload.phone,
        Ported_number: true,               // Always safe to set true for stability
        airtime_type: airtimeType          // "VTU", "Share and Sell", "Awuf4U"
    };

    try {
        // 3. Send Request
        const data = await makeAffatechRequest("/topup/", body, "POST");

        // 4. Handle Response
        if (data.Status === "successful" || data.status === "success") {
            return {
                success: true,
                message: "Transaction Successful",
                data: data,
                reference: data.id || `AFF_AIR_${Date.now()}`
            };
        } else {
            throw new Error(data.api_response || data.error || "Transaction Failed");
        }

    } catch (e: any) {
        console.error("Affatech Airtime Error:", e.message);
        throw e;
    }
};