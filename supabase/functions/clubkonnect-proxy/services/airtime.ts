import { makeClubKonnectRequest } from "../config.ts";

export const buyAirtime = async (payload: any) => {
  const networkMap: Record<number | string, string> = {
    1: "01",
    "1": "01", // MTN
    2: "02",
    "2": "02", // GLO
    3: "04",
    "3": "04", // AIRTEL
    4: "03",
    "4": "03", // 9MOBILE
  };

  const mobileNetwork = networkMap[payload.network];
  if (!mobileNetwork)
    throw new Error(
      `Invalid Network Identifier for ClubKonnect mapping engine: ${payload.network}`,
    );

  const requestID =
    payload.reference ||
    `CK_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const targetPhone = payload.phone || payload.mobile_number;

  const params = new URLSearchParams();
  params.append("MobileNetwork", mobileNetwork);
  params.append("Amount", String(payload.amount));
  params.append("MobileNumber", String(targetPhone || "").trim());
  params.append("RequestID", requestID);

  if (String(payload.network) === "1" && payload.airtime_type === "GistPlus") {
    params.append("BonusType", "03");
  }

  // Pass base target endpoint script file string explicitly
  const result = await makeClubKonnectRequest(
    "APIAirtimeV1.asp",
    params.toString(),
  );

  const responseStatus = String(
    result?.status || result?.Status || "",
  ).toUpperCase();
  return {
    success:
      responseStatus === "ORDER_RECEIVED" ||
      responseStatus === "ORDER_COMPLETED",
    message: result.status || result.remark || "Transaction Processed",
    data: result,
    reference: requestID,
  };
};
