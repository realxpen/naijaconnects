import { CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY } from "../config.ts";

// --- 1. FETCH LIVE JAMB PLANS ---
export const fetchJambPlans = async () => {
    const url = `https://www.nellobytesystems.com/APIJAMBPackagesV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch JAMB plans");
        
        const rawData = await response.json();
        
        let plans = [];
        if (rawData.JAMB) plans = rawData.JAMB;
        else if (rawData.MOBILE_JAMB) plans = rawData.MOBILE_JAMB;
        
        return plans.map((p: any) => ({
            id: p.PACKAGE_ID,
            name: p.PACKAGE_NAME,
            amount: parseFloat(p.PACKAGE_AMOUNT)
        }));

    } catch (e) {
        console.error("Backend Fetch JAMB Error:", e);
        return [];
    }
};

// --- 2. VERIFY JAMB PROFILE ---
export const verifyJambProfile = async (payload: any) => {
    const params = new URLSearchParams();
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("ExamType", payload.exam_type || "utme");
    params.append("ProfileID", payload.profile_id);

    const url = `https://www.nellobytesystems.com/APIVerifyJAMBV1.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const isValid = data.customer_name && !data.customer_name.includes("INVALID") && !data.customer_name.includes("Error");

        return {
            valid: isValid,
            customer_name: isValid ? data.customer_name : "Invalid Profile ID"
        };
    } catch (e) {
        console.error("Verify JAMB Error:", e);
        throw new Error("Verification failed");
    }
};

// --- 3. BUY JAMB PIN ONLY ---
export const buyEducation = async (payload: any) => {
    // Confirm this is for JAMB
    if (payload.exam_group !== 'JAMB') {
        throw new Error("Invalid Provider: ClubKonnect only handles JAMB.");
    }

    const requestID = `CK_EDU_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const params = new URLSearchParams();
    
    params.append("UserID", CLUBKONNECT_USER_ID);
    params.append("APIKey", CLUBKONNECT_API_KEY);
    params.append("RequestID", requestID);
    params.append("ExamType", payload.exam_type); // utme-mock, utme-no-mock, de
    params.append("PhoneNo", payload.phone || "08000000000"); 

    const url = `https://www.nellobytesystems.com/APIJAMBV1.asp?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // ClubKonnect success is usually ORDER_RECEIVED or ORDER_COMPLETED
        const isSuccess = data.status === "ORDER_RECEIVED" || data.status === "ORDER_COMPLETED";

        return {
            success: isSuccess,
            message: data.status,
            pin: data.carddetails || data.pin, 
            data: data,
            reference: requestID
        };
    } catch (e) {
        throw e;
    }
};