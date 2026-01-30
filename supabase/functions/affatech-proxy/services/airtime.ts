import { makeAffatechRequest } from "../config.ts";

export const buyAirtime = async (payload: any) => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/airtime/
    return await makeAffatechRequest('/airtime/', {
        network: payload.network,
        amount: payload.amount,
        mobile_number: payload.phone,
        Ported_number: true,
        airtime_type: "VTU"
    });
};