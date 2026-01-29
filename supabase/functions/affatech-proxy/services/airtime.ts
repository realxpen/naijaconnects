import { makeApiRequest } from "../config.ts";

export const buyAirtime = async (payload: any) => {
    return await makeApiRequest('/topup/', { 
        network: payload.network, 
        mobile_number: payload.phone, 
        amount: payload.amount, 
        Ported_number: true, 
        airtime_type: "VTU" 
    });
};