import { makeClubKonnectRequest, CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

export const buyAirtime = async (payload: any) => {
    // 1. Map Frontend IDs to ClubKonnect Codes
    const networkMap: Record<number, string> = {
        1: "01", // MTN
        2: "02", // GLO
        3: "04", // AIRTEL
        4: "03", // 9MOBILE
    };

    const mobileNetwork = networkMap[payload.network];
    if (!mobileNetwork) throw new Error("Invalid Network ID for ClubKonnect");

    // 2. Generate Unique Request ID
    const requestID = `CK_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // 3. Build Query Parameters
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("MobileNetwork", mobileNetwork);
    params.append("Amount", payload.amount);
    params.append("MobileNumber", payload.phone);
    params.append("RequestID", requestID);
    // params.append("CallBackURL", "https://your-callback-url.com"); 

    // --- NEW: HANDLE GISTPLUS (MTN ONLY) ---
    // Docs: 03 = MTN GistPlus (400%)
    if (payload.network === 1 && payload.airtime_type === 'GistPlus') {
        params.append("BonusType", "03");
    }

    // 4. Send Request
    const result = await makeClubKonnectRequest(params.toString());

    return {
        success: result.status === "ORDER_RECEIVED" || result.status === "ORDER_COMPLETED",
        message: result.status || "Transaction Processed",
        data: result,
        reference: requestID
    };
};