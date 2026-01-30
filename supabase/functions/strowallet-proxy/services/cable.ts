import { makeStroRequest, STRO_CONFIG } from "../config.ts";

const getServiceId = (id: number | string) => {
    const map: any = { "1": "gotv", "2": "dstv", "3": "startimes", "4": "showmax" };
    return map[String(id)] || String(id).toLowerCase();
};

export const fetchCablePlans = async (payload: any) => {
    const serviceId = getServiceId(payload.provider);
    const publicKey = STRO_CONFIG.getPublicKey();
    
    // Manual Query String for GET request
    const endpoint = `/cable-subscription/plans/?public_key=${publicKey}&service_id=${serviceId}`;
    return await makeStroRequest(endpoint, {}, 'GET');
};

export const verifySmartCard = async (payload: any) => {
    return await makeStroRequest('/cable-subscription/verify-merchant/', {
        service_id: getServiceId(payload.provider),
        customer_id: payload.number
    });
};

export const buyCable = async (payload: any) => {
    return await makeStroRequest('/cable-subscription/request/', {
        service_id: getServiceId(payload.provider),
        customer_id: payload.iuc,
        variation_code: payload.plan_id,
        amount: payload.amount,
        phone: payload.phone || "08000000000",
        service_name: payload.plan_name 
    });
};