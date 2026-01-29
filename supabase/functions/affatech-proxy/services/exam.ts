import { makeApiRequest } from "../config.ts";

export const buyExamPin = async (payload: any) => {
    return await makeApiRequest('/epin/', { 
        exam_name: payload.exam_name, // WAEC, NECO, NABTEB
        quantity: payload.quantity 
    });
};