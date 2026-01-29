import { makeApiRequest } from "../config.ts";

export const buyCable = async (payload: any) => {
    return await makeApiRequest('/cablesub/', { 
        cablename: payload.provider, // 1=GOTV, 2=DSTV, 3=STARTIMES
        cableplan: payload.plan_id, 
        smart_card_number: payload.iuc 
    });
};

export const verifyIUC = async (payload: any) => {
    // Endpoint: /api/validateiuc?smart_card_number=iuc&cablename=id
    const endpoint = `/validateiuc?smart_card_number=${payload.number}&cablename=${payload.provider}`;
    return await makeApiRequest(endpoint, {}, 'GET');
};