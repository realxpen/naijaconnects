import { makeClubKonnectRequest, CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

// --- VERIFY JAMB PROFILE ---
export const verifyJambProfile = async (payload: any) => {
    // ENDPOINT: https://www.nellobytesystems.com/APIVerifyJAMBV1.asp
    // Params: ExamType (jamb), ProfileID
    
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("ExamType", payload.exam_type || "utme"); // utme or de
    params.append("ProfileID", payload.profile_id);

    const url = `https://www.nellobytesystems.com/APIVerifyJAMBV1.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Success: { "customer_name": "NAME" }
        // Error: { "customer_name": "INVALID_ACCOUNTNO" }
        const isValid = data.customer_name && !data.customer_name.includes("INVALID");

        return {
            valid: isValid,
            customer_name: isValid ? data.customer_name : "Invalid Profile ID"
        };
    } catch (e) {
        console.error("Verify JAMB Error:", e);
        throw new Error("Verification failed");
    }
};

// --- BUY EDUCATION PINS (JAMB, WAEC, NECO) ---
export const buyEducation = async (payload: any) => {
    const requestID = `CK_EDU_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const params = new URLSearchParams();
    
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("RequestID", requestID);

    let endpoint = "";

    // --- CASE 1: JAMB ---
    if (payload.exam_group === 'JAMB') {
        endpoint = "APIJAMBV1.asp";
        // ExamType: 'utme-mock', 'utme-no-mock', 'de'
        params.append("ExamType", payload.exam_type); 
        params.append("PhoneNo", payload.phone || "08000000000"); // Required for JAMB
        // JAMB usually doesn't take 'ProfileID' in the buy request, 
        // but some APIs map 'PhoneNo' to the profile registration number. 
        // Following the docs provided: PhoneNo=recipient_phoneno
    } 
    
    // --- CASE 2: WAEC ---
    else if (payload.exam_group === 'WAEC') {
        endpoint = "APIWAECV1.asp";
        params.append("ExamType", "waec");
        params.append("PhoneNo", payload.phone || "08000000000");
    }

    // --- CASE 3: NECO ---
    else if (payload.exam_group === 'NECO') {
        endpoint = "APINECOV1.asp";
        params.append("ExamType", "neco");
        params.append("PhoneNo", payload.phone || "08000000000");
    }

    const url = `https://www.nellobytesystems.com/${endpoint}?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Check success based on status code/text
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status,
            // PINs are usually returned in 'carddetails' or 'pin' field
            pin: data.carddetails || data.pin || data.metertoken, 
            data: data,
            reference: requestID
        };
    } catch (e) {
        console.error("Buy Education Error:", e);
        throw e;
    }
};