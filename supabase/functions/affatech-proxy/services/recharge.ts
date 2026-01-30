import { makeAffatechRequest } from "../config.ts";

export const buyRechargePin = async (payload: any) => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/rechargepin/
    // UPDATED: Added trailing slash '/' which is required
    return await makeAffatechRequest('/rechargepin/', {
        network: payload.network,         
        network_amount: payload.amount,   
        quantity: payload.quantity,
        name_on_card: payload.name_on_card || "NaijaConnect"
    });
};