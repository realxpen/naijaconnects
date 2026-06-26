import { makeAffatechRequest } from "../config.ts";

export const fetchDataPlans = async () => {
  try {
    console.log("[Affatech] Fetching data plans...");
    const response = await makeAffatechRequest("/dataplans/", {}, "GET");
    const rawPlans = Array.isArray(response)
      ? response
      : response.dataplans || [];

    if (!Array.isArray(rawPlans) || rawPlans.length === 0) {
      console.warn(
        "[Affatech] No plans found in response:",
        JSON.stringify(response),
      );
      return [];
    }

    const getNetworkId = (str: string) => {
      const s = str?.toUpperCase() || "";
      if (s.includes("MTN")) return 1;
      if (s.includes("GLO")) return 2;
      if (s.includes("AIRTEL")) return 3;
      if (s.includes("9MOBILE") || s.includes("ETISALAT")) return 4;
      return 0;
    };

    return rawPlans.map((p: any) => ({
      id: p.id || p.plan_id,
      network: getNetworkId(p.network),
      plan_name: p.plan || p.name || p.plan_name,
      amount: parseFloat(p.price || p.amount || p.plan_amount || "0"),
      validity: p.month_validate || p.validity || "30 Days",
      plan_type: p.plan_type || "ALL",
    }));
  } catch (e: any) {
    console.error("[Affatech] Fetch Plans Error:", e.message);
    return [];
  }
};

export const buyData = async (payload: any) => {
  console.log(`[Buy Data Debug] Payload:`, JSON.stringify(payload));

  const recipientObj = payload.recipient || payload.target_recipient || {};
  const phone = recipientObj.phone || payload.phone || payload.mobile_number;

  // Resolve standard checkout plan parameter keys
  const planId = payload.plan_id || payload.service_id || payload.plan;

  if (!planId) {
    throw new Error(
      "Missing Plan ID. Please select a valid data plan identifier.",
    );
  }

  const body = {
    network: payload.network,
    mobile_number: phone,
    plan: planId,
    Ported_number: true,
  };

  try {
    const data = await makeAffatechRequest("/data/", body, "POST");
    console.log(`[Affatech API Response]`, JSON.stringify(data));

    if (data.Status === "successful" || data.status === "success") {
      return {
        success: true,
        message: "Data Purchase Successful",
        data: data,
        reference: data.id || `AFF_DATA_${Date.now()}`,
      };
    } else {
      throw new Error(
        data.api_response || data.error || "Data Transaction Failed",
      );
    }
  } catch (e: any) {
    console.error(`[Buy Data Exception] ${e.message}`);
    throw e;
  }
};
