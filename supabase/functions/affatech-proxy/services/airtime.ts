import { makeAffatechRequest } from "../config.ts";

export const buyAirtime = async (payload: any) => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/topup/
    // ERROR FIX: Changed endpoint from '/airtime/' to '/topup/'
    
    // Ensure Airtime Type matches API requirements exactly
    // The UI sends "awuf4U", "Share and Sell", or "VTU"
    const airtimeType = payload.airtime_type || "VTU";

    return await makeAffatechRequest('/topup/', {
        network: payload.network,
        amount: payload.amount,
        mobile_number: payload.phone,
        Ported_number: true,
        airtime_type: airtimeType 
    });
};