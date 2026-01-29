import { makeApiRequest } from "../config.ts";

export const buyRechargePin = async (payload: any) => {
    return await makeApiRequest('/rechargepin/', { 
        network: payload.network, 
        network_amount: payload.amount, 
        quantity: payload.quantity,
        name_on_card: payload.name_on_card
    });
};