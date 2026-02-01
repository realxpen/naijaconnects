import { makeClubKonnectRequest, CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

// Helper to pad numbers (e.g. 1 -> "01")
const formatCode = (code: number | string) => {
    return code.toString().padStart(2, '0');
};

export const verifyMeter = async (payload: any) => {
    // ENDPOINT: https://www.nellobytesystems.com/APIVerifyElectricityV1.asp
    // Params: UserID, APIKey, ElectricCompany, MeterNo, MeterType
    
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("ElectricCompany", formatCode(payload.disco)); // "01", "02"...
    params.append("MeterNo", payload.meter);
    params.append("MeterType", formatCode(payload.meter_type)); // "01" (Prepaid) or "02" (Postpaid)

    // Note: The verify endpoint is different (APIVerifyElectricityV1.asp)
    // We need to construct the URL manually or update config to support base URL override
    // But since config uses the base URL for airtime, let's hardcode the verify base here for safety
    const verifyUrl = `https://www.nellobytesystems.com/APIVerifyElectricityV1.asp?${params.toString()}`;
    
    try {
        const response = await fetch(verifyUrl);
        const data = await response.json();
        
        // Normalize response for frontend
        // Success: { "customer_name": "NAME" }
        // Fail: { "customer_name": "INVALID_METERNO" } or similar
        return {
            valid: data.customer_name && data.customer_name !== "INVALID_METERNO",
            customer_name: data.customer_name
        };
    } catch (e) {
        console.error("Verify Error:", e);
        throw new Error("Verification failed");
    }
};

export const buyElectricity = async (payload: any) => {
    // ENDPOINT: https://www.nellobytesystems.com/APIElectricityV1.asp
    
    const requestID = `CK_ELEC_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("ElectricCompany", formatCode(payload.disco));
    params.append("MeterType", formatCode(payload.meter_type));
    params.append("MeterNo", payload.meter);
    params.append("Amount", payload.amount);
    params.append("PhoneNo", payload.phone);
    params.append("RequestID", requestID);

    // Hardcoded base URL for Electricity Purchase
    const buyUrl = `https://www.nellobytesystems.com/APIElectricityV1.asp?${params.toString()}`;

    try {
        const response = await fetch(buyUrl);
        const data = await response.json();

        // Response format: { status, metertoken, ... }
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status,
            token: data.metertoken, // Important for prepaid
            data: data,
            reference: requestID
        };
    } catch (e) {
        console.error("Buy Electricity Error:", e);
        throw e;
    }
};