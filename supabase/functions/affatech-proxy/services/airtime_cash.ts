import { makeApiRequest } from "../config.ts";

export const airtimeToCash = async (payload: any) => {
    // Endpoint: /api/Airtime_funding/
    // Payload: { network, mobile_number, amount }
    return await makeApiRequest('/Airtime_funding/', { 
        network: payload.network, 
        mobile_number: payload.phone, 
        amount: payload.amount
    });
};