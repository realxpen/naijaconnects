import { makeAffatechRequest } from "../config.ts";

export const buyExamPin = async (payload: any) => {
    // DOCUMENTATION: https://www.affatech.com.ng/api/epin/
    // UPDATED: Added trailing slash '/'
    return await makeAffatechRequest('/epin/', {
        exam_name: payload.exam_name, 
        quantity: String(payload.quantity || 1)
    });
};