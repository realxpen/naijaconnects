import { makeApiRequest } from "../config.ts";

export const buyElectricity = async (payload: any) => {
    return await makeApiRequest('/billpayment/', { 
        disco_name: payload.disco, 
        amount: payload.amount, 
        meter_number: payload.meter, 
        MeterType: payload.meter_type // 1=PREPAID, 2=POSTPAID
    });
};

export const verifyMeter = async (payload: any) => {
    // Endpoint: /api/validatemeter?meternumber=meter&disconame=id&mtype=metertype
    const endpoint = `/validatemeter?meternumber=${payload.number}&disconame=${payload.provider}&mtype=${payload.meter_type || 1}`;
    return await makeApiRequest(endpoint, {}, 'GET');
};