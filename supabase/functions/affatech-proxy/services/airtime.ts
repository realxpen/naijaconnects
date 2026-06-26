import { makeAffatechRequest } from "../config.ts";

export const buyAirtime = async (payload: any) => {
  // Extract normalized parameters matching frictionless payloads
  const recipientObj = payload.recipient || payload.target_recipient || {};
  const phone = recipientObj.phone || payload.phone || payload.mobile_number;

  let airtimeType = payload.airtime_type || "VTU";
  if (airtimeType === "awuf4U") airtimeType = "Awuf4U";
  if (airtimeType === "Share and Sell") airtimeType = "Share and Sell";

  const body = {
    network: payload.network, // 1=MTN, 2=GLO, etc.
    amount: payload.amount,
    mobile_number: phone,
    Ported_number: true,
    airtime_type: airtimeType,
  };

  try {
    const data = await makeAffatechRequest("/topup/", body, "POST");

    if (data.Status === "successful" || data.status === "success") {
      return {
        success: true,
        message: "Transaction Successful",
        data: data,
        reference: data.id || `AFF_AIR_${Date.now()}`,
      };
    } else {
      throw new Error(data.api_response || data.error || "Transaction Failed");
    }
  } catch (e: any) {
    console.error("Affatech Airtime Error:", e.message);
    throw e;
  }
};
