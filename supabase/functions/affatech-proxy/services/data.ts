import { makeApiRequest } from "../config.ts";

export const buyData = async (payload: any) => {
    return await makeApiRequest('/data/', { 
        network: payload.network, 
        mobile_number: payload.phone, 
        plan: payload.plan_id, 
        Ported_number: true 
    });
};

export const fetchDataPlans = async () => {
    // GET request to fetch available networks/plans
    return await makeApiRequest('/network/', {}, 'GET');
};