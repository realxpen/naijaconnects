import { makeClubKonnectRequest } from "../config.ts";

export const fetchJambPlans = async () => {
  try {
    // Centralized utility cleans paths and auto-appends User Credentials
    const rawData = await makeClubKonnectRequest("APIJAMBPackagesV2.asp", "");

    let plans = [];
    if (rawData?.JAMB) plans = rawData.JAMB;
    else if (rawData?.MOBILE_JAMB) plans = rawData.MOBILE_JAMB;

    return plans.map((p: any) => ({
      id: p.PACKAGE_ID,
      name: p.PACKAGE_NAME,
      amount: parseFloat(p.PACKAGE_AMOUNT),
    }));
  } catch (e: any) {
    console.error("Backend Fetch JAMB Error:", e.message);
    return [];
  }
};

export const verifyJambProfile = async (payload: any) => {
  const profileId = payload.profile_id || payload.profileId || payload.number;
  const params = new URLSearchParams();
  params.append("ExamType", payload.exam_type || "utme");
  params.append("ProfileID", String(profileId || "").trim());

  try {
    const data = await makeClubKonnectRequest(
      "APIVerifyJAMBV1.asp",
      params.toString(),
    );
    const customerName = String(data?.customer_name || "").toUpperCase();
    const isValid =
      customerName.length > 0 &&
      !customerName.includes("INVALID") &&
      !customerName.includes("ERROR");

    return {
      valid: isValid,
      customer_name: isValid ? data.customer_name : "Invalid Profile ID",
    };
  } catch (e: any) {
    console.error("Verify JAMB Error:", e.message);
    throw new Error("Verification failed");
  }
};

export const buyEducation = async (payload: any) => {
  const examGroup = payload.exam_group || payload.category || "JAMB";
  if (String(examGroup).toUpperCase() !== "JAMB") {
    throw new Error(
      "Invalid Provider Alignment: ClubKonnect node only handles JAMB code dispatches.",
    );
  }

  const requestID =
    payload.reference ||
    `CK_EDU_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const targetPhone = payload.phone || payload.mobile_number || "08000000000";
  const examType = payload.exam_type || payload.service_id || "utme-no-mock";

  const params = new URLSearchParams();
  params.append("RequestID", requestID);
  params.append("ExamType", examType); // utme-mock, utme-no-mock, de
  params.append("PhoneNo", targetPhone);

  try {
    const data = await makeClubKonnectRequest(
      "APIJAMBV1.asp",
      params.toString(),
    );
    const responseStatus = String(
      data?.status || data?.Status || "",
    ).toUpperCase();
    const isSuccess =
      responseStatus === "ORDER_RECEIVED" ||
      responseStatus === "ORDER_COMPLETED";

    return {
      success: isSuccess,
      message: data.status,
      pin: data.carddetails || data.pin || null,
      data: data,
      reference: requestID,
    };
  } catch (e) {
    throw e;
  }
};
