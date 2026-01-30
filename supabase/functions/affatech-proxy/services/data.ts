import { makeAffatechRequest } from "../config.ts";

export const fetchDataPlans = async () => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/dataplans/
    return await makeAffatechRequest('/dataplans/', {}, 'GET');
};

export const buyData = async (payload: any) => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/data/
    return await makeAffatechRequest('/data/', {
        network: payload.network,
        mobile_number: payload.phone,
        plan: payload.plan_id,
        Ported_number: true
    });
};