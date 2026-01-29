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
    // 1. Force Meter Type to be "1" (Prepaid) or "2" (Postpaid)
    // If frontend sends anything else, default to "1"
    const mType = String(payload.meter_type) === "2" ? "2" : "1";
    
    // 2. Clean the Meter Number (Remove spaces, dashes, or non-numbers)
    const cleanMeter = String(payload.number).replace(/[^0-9]/g, '');
    
    // 3. Get Disco ID
    const discoID = payload.provider;

    // Docs: /api/validatemeter?meternumber=meter&disconame=id&mtype=metertype
    const endpoint = `/validatemeter?meternumber=${cleanMeter}&disconame=${discoID}&mtype=${mType}`;
    
    // DEBUG LOG: Check your Supabase Dashboard Logs to see this URL!
    console.log(`[Electricity] Verifying: ${endpoint}`);

    return await makeApiRequest(endpoint, {}, 'GET');
};