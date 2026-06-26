import { makeAffatechRequest } from "../config.ts";

export const buyEducation = async (payload: any) => {
  // Map service fields if passing from explicit automated selection contexts
  const examGroup =
    payload.exam_group || payload.service_id || payload.exam_name;
  const qty = payload.quantity || 1;

  const body = {
    exam_name: examGroup, // "WAEC" or "NECO"
    quantity: String(qty),
  };

  try {
    const data = await makeAffatechRequest("/epin/", body, "POST");

    if (data.Status === "successful" || data.status === "success") {
      return {
        success: true,
        message: "Transaction Successful",
        // Aligning field formats for frontend components consumption layout
        pin: data.pin || data.pins || "Check Receipt",
        // Support multiple cards array mappings if returned by vendor
        pins_list:
          data.pins_list ||
          (data.pin
            ? [{ pin: data.pin, serial_number: data.serial_number || "" }]
            : []),
        data: data,
        reference: data.id || `AFF_EDU_${Date.now()}`,
      };
    } else {
      throw new Error(
        data.api_response || data.error || "Affatech Transaction Failed",
      );
    }
  } catch (e: any) {
    console.error("Affatech Education Error:", e.message);
    throw e;
  }
};
