import { makeClubKonnectRequest } from "../config.ts";

const getMeterTypeCode = (type: any): string => {
  const val = type?.toString().toLowerCase();
  if (val === "2" || val === "02" || val === "postpaid") {
    return "02";
  }
  return "01";
};

const formatDisco = (code: number | string): string => {
  return code.toString().padStart(2, "0");
};

export const verifyMeter = async (payload: any) => {
  const meterNo = payload.meterNo || payload.meter || payload.meter_number;
  const meterTypeCode = getMeterTypeCode(payload.meter_type);
  const discoCode = formatDisco(payload.disco || payload.service_id);

  const params = new URLSearchParams();
  params.append("ElectricCompany", discoCode);
  params.append("MeterNo", String(meterNo || "").trim());
  params.append("MeterType", meterTypeCode);

  try {
    const data = await makeClubKonnectRequest(
      "APIVerifyElectricityV1.asp",
      params.toString(),
    );

    const customerName = String(
      data?.customer_name || data?.Customer_Name || "",
    ).toUpperCase();
    const isInvalid =
      customerName.length === 0 ||
      customerName.includes("INVALID") ||
      customerName.includes("MISSING") ||
      customerName.includes("ERROR");

    return {
      valid: !isInvalid,
      customer_name: isInvalid ? "Invalid Meter Number" : data.customer_name,
    };
  } catch (e: any) {
    console.error("Verification Error:", e.message);
    throw new Error("Verification failed - Connection issue");
  }
};

export const buyElectricity = async (payload: any) => {
  const requestID = payload.reference || `CK_ELEC_${Date.now()}`;
  const meterNo = payload.meterNo || payload.meter || payload.meter_number;
  const meterTypeCode = getMeterTypeCode(payload.meter_type);
  const discoCode = formatDisco(payload.disco || payload.service_id);
  const targetPhone = payload.phone || payload.mobile_number || "08000000000";

  const params = new URLSearchParams();
  params.append("ElectricCompany", discoCode);
  params.append("MeterType", meterTypeCode);
  params.append("MeterNo", String(meterNo || "").trim());
  params.append("Amount", payload.amount.toString());
  params.append("PhoneNo", targetPhone);
  params.append("RequestID", requestID);

  try {
    const data = await makeClubKonnectRequest(
      "APIElectricityV1.asp",
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
      message: data.status || data.remark || "Processed",
      token: data.metertoken || data.token || null,
      data: data,
      reference: requestID,
    };
  } catch (e: any) {
    console.error("Electricity Purchase Error:", e.message);
    throw e;
  }
};
