import { makeAffatechRequest } from "../config.ts";

export const buyRechargePin = async (payload: any) => {
  // Resolve dynamic service details parameters fallbacks
  const targetNetwork = payload.network || payload.service_id;
  const costAmount = payload.amount || payload.network_amount;
  const qty = payload.quantity || 1;

  const body = {
    network: targetNetwork,
    network_amount: costAmount,
    quantity: qty,
    name_on_card: payload.name_on_card || "Swifna",
  };

  try {
    // Recharge pin endpoints expect a trailing slash
    const data = await makeAffatechRequest("/rechargepin/", body, "POST");

    if (data.Status === "successful" || data.status === "success") {
      return {
        success: true,
        message: "Recharge Pin Order Completed",
        pins_list: data.pins_list || data.pins || [],
        data: data,
        reference: data.id || `AFF_PIN_${Date.now()}`,
      };
    } else {
      throw new Error(
        data.api_response || data.error || "Affatech PIN Order Failed",
      );
    }
  } catch (e: any) {
    console.error("Affatech Recharge Pin Error:", e.message);
    throw e;
  }
};
