import { CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

/**
 * Standardizes MeterType to numeric codes.
 * 01 = Prepaid
 * 02 = Postpaid
 */
const getMeterTypeCode = (type: any): string => {
    const val = type?.toString().toLowerCase();
    if (val === "2" || val === "02" || val === "postpaid") {
        return "02";
    }
    return "01";
};

/**
 * Ensures disco codes are always 2 digits (e.g. "01").
 */
const formatDisco = (code: number | string): string => {
    return code.toString().padStart(2, '0');
};

export const verifyMeter = async (payload: any) => {
    const meterTypeCode = getMeterTypeCode(payload.meter_type);
    const discoCode = formatDisco(payload.disco);

    // EXACT capitalization as per documentation
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("ElectricCompany", discoCode);
    params.append("MeterNo", payload.meter);
    params.append("MeterType", meterTypeCode);

    const verifyUrl = `https://www.nellobytesystems.com/APIVerifyElectricityV1.asp?${params.toString()}`;
    
    // Log the URL to your Supabase console to see exactly what is being sent
    console.log(`[Verify Meter] URL: ${verifyUrl}`);

    try {
        const response = await fetch(verifyUrl);
        const data = await response.json();
        
        // Success: {"customer_name":"NAME"}
        // Fail: {"customer_name":"INVALID_METERNO"}
        const isInvalid = !data.customer_name || 
                          data.customer_name.includes("INVALID") || 
                          data.customer_name.includes("MISSING") ||
                          data.customer_name.includes("Error");

        return {
            valid: !isInvalid,
            customer_name: isInvalid ? "Invalid Meter Number" : data.customer_name
        };
    } catch (e) {
        console.error("Verification Error:", e);
        throw new Error("Verification failed - Connection issue");
    }
};

export const buyElectricity = async (payload: any) => {
    const requestID = `CK_ELEC_${Date.now()}`;
    const meterTypeCode = getMeterTypeCode(payload.meter_type);
    const discoCode = formatDisco(payload.disco);

    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("ElectricCompany", discoCode);
    params.append("MeterType", meterTypeCode);
    params.append("MeterNo", payload.meter);
    params.append("Amount", payload.amount.toString());
    params.append("PhoneNo", payload.phone);
    params.append("RequestID", requestID);

    const buyUrl = `https://www.nellobytesystems.com/APIElectricityV1.asp?${params.toString()}`;

    try {
        const response = await fetch(buyUrl);
        const data = await response.json();

        // Status codes: 100 for received, 200 for completed
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status || data.remark || "Processed",
            token: data.metertoken || null, 
            data: data,
            reference: requestID
        };
    } catch (e) {
        console.error("Purchase Error:", e);
        throw e;
    }
};