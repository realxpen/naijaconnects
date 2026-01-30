import { makeAffatechRequest } from "../config.ts";

export const airtimeToCash = async (payload: any) => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/airtimetocash/
    return await makeAffatechRequest('/airtimetocash/', {
        network: payload.network,
        amount: payload.amount,
        mobile_number: payload.phone
    });
};