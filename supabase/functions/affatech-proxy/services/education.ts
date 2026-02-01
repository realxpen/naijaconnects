import { makeAffatechRequest } from "../config.ts";

export const buyEducation = async (payload: any) => {
    // 1. Prepare Body
    const body = {
        exam_name: payload.exam_group, // "WAEC" or "NECO"
        quantity: payload.quantity     // "1", "2", etc.
    };

    try {
        // 2. Use the Helper (Handles Auth, Headers, and URL automatically)
        const data = await makeAffatechRequest("/epin/", body, "POST");

        // 3. Check Success (Affatech uses 'Status' or 'status')
        if (data.Status === "successful" || data.status === "success") {
             return {
                success: true,
                message: "Transaction Successful",
                pin: data.pin || data.pins || "Check Receipt",
                data: data,
                reference: `AFF_${Date.now()}`
            };
        } else {
            // Throw specific API error if available
            throw new Error(data.api_response || data.error || "Affatech Transaction Failed");
        }

    } catch (e: any) {
        console.error("Affatech Education Error:", e.message);
        throw e;
    }
};