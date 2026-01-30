import { makeStroRequest } from "../config.ts";

const getDiscoTag = (id: number | string) => {
    const map: Record<string, string> = {
        "1": "ikeja-electric",      "2": "eko-electric",
        "3": "abuja-electric",      "4": "kano-electric",
        "5": "enugu-electric",      "6": "portharcourt-electric",
        "7": "ibadan-electric",     "8": "kaduna-electric",
        "9": "jos-electric",        "10": "benin-electric",
        "11": "yola-electric"
    };
    return map[String(id)] || "ikeja-electric";
};

const getMeterType = (type: number | string) => {
    return String(type) === "2" ? "postpaid" : "prepaid";
};

export const verifyMeter = async (payload: any) => {
    // Added /electricity prefix because BASE_URL is now just /api
    return await makeStroRequest('/electricity/verify-merchant/', {
        service_name: getDiscoTag(payload.provider),
        meter_number: payload.number,
        meter_type: getMeterType(payload.meter_type)
    });
};

export const buyElectricity = async (payload: any) => {
    return await makeStroRequest('/electricity/request/', {
        service_name: getDiscoTag(payload.disco),
        meter_number: payload.meter,
        meter_type: getMeterType(payload.meter_type),
        amount: payload.amount,
        phone: payload.phone || "08000000000"
    });
};