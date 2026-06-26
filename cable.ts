import { makeClubKonnectRequest } from "../config.ts";

export const fetchCablePlans = async () => {
  try {
    const rawData = await makeClubKonnectRequest(
      "APICableTVPackagesV2.asp",
      "",
    );

    const cleanPlans: Record<string, any[]> = {
      dstv: [],
      gotv: [],
      startimes: [],
      showmax: [],
    };

    const extract = (apiKeys: string[]) => {
      if (!rawData?.TV_ID) return [];
      for (const key of apiKeys) {
        const providerData = rawData.TV_ID[key];
        if (
          Array.isArray(providerData) &&
          providerData[0] &&
          Array.isArray(providerData[0].PRODUCT)
        ) {
          return providerData[0].PRODUCT.map((p: any) => ({
            id: p.PACKAGE_ID,
            name: p.PACKAGE_NAME,
            amount: parseFloat(p.PACKAGE_AMOUNT),
          })).sort((a: any, b: any) => a.amount - b.amount);
        }
      }
      return [];
    };

    cleanPlans.dstv = extract(["DStv", "DSTV"]);
    cleanPlans.gotv = extract(["GOtv", "GOTV"]);
    cleanPlans.startimes = extract(["Startimes", "STARTIMES"]);
    cleanPlans.showmax = extract(["Showmax", "SHOWMAX"]);

    return cleanPlans;
  } catch (e: any) {
    console.error("Backend Cable Fetch Error:", e.message);
    throw e;
  }
};

export const verifySmartCard = async (payload: any) => {
  const smartCardNo =
    payload.smartCardNo || payload.iuc || payload.smartcard_id;
  const provider = payload.provider || payload.cable_tv || payload.service_id;

  const params = new URLSearchParams();
  params.append("CableTV", String(provider || "").toLowerCase());
  params.append("SmartCardNo", String(smartCardNo || "").trim());

  try {
    const data = await makeClubKonnectRequest(
      "APIVerifyCableTVV1.0.asp",
      params.toString(),
    );
    const customerName = String(data?.customer_name || "").toUpperCase();

    return {
      valid:
        customerName.length > 0 &&
        !customerName.includes("INVALID") &&
        !customerName.includes("ERROR"),
      customer_name: data.customer_name || "Unknown Customer",
    };
  } catch (e) {
    throw e;
  }
};

export const buyCable = async (payload: any) => {
  const requestID =
    payload.reference ||
    `CK_CAB_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const smartCardNo =
    payload.smartCardNo || payload.iuc || payload.smartcard_id;
  const provider = payload.provider || payload.cable_tv;
  const targetPlan = payload.plan_code || payload.service_id || payload.package;
  const targetPhone = payload.phone || payload.mobile_number || "08000000000";

  const params = new URLSearchParams();
  params.append("CableTV", String(provider || "").toLowerCase());
  params.append("Package", String(targetPlan || "").trim());
  params.append("SmartCardNo", String(smartCardNo || "").trim());
  params.append("PhoneNo", targetPhone);
  params.append("RequestID", requestID);

  try {
    const data = await makeClubKonnectRequest(
      "APICableTVV1.asp",
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
      data: data,
      reference: requestID,
    };
  } catch (e) {
    throw e;
  }
};
