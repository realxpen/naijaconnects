import { makeClubKonnectRequest } from "../config.ts";

/**
 * 1. FETCH SMILE PACKAGES
 * Retrieves available bundles from the V2 packages endpoint.
 */
export const fetchSmilePlans = async () => {
  try {
    console.log(
      "[Smile Plans] Fetching package bundles via dynamic configuration wrapper...",
    );

    // This endpoint variation handles verification over the dedicated packages ASP controller route
    // Passing an empty query string because UserID and APIKey are automatically injected by makeClubKonnectRequest
    const data = await makeClubKonnectRequest("APISmilePackagesV2.asp", "");

    console.log(
      "[Smile Plans] Raw Data Received Sample:",
      JSON.stringify(data).substring(0, 200),
    );

    let rawPlans = [];
    if (data?.MOBILE_SMILE) {
      rawPlans = data.MOBILE_SMILE;
    } else if (data?.SMILE) {
      rawPlans = data.SMILE;
    } else if (Array.isArray(data)) {
      rawPlans = data;
    } else if (data?.content?.varations) {
      rawPlans = data.content.varations;
    }

    if (!Array.isArray(rawPlans) || rawPlans.length === 0) {
      console.warn(
        "[Smile Plans] No plans parsed out of upstream response structure.",
      );
      return [];
    }

    // Map to standard platform format: { id, name, price }
    return rawPlans.map((p: any) => ({
      id: String(p.variation_code || p.PACKAGE_ID || p.code || "").trim(),
      name: String(
        p.name || p.PACKAGE_NAME || p.variation_name || "Smile Data Bundle",
      ),
      price: parseFloat(
        p.variation_amount || p.PACKAGE_AMOUNT || p.amount || "0",
      ),
    }));
  } catch (e: any) {
    console.error("Smile Plans Fetch Error Exception:", e.message);
    return [];
  }
};

/**
 * 2. VERIFY SMILE ACCOUNT
 * Verifies the Smile Account ID or Number before purchase execution.
 */
export const verifySmileNumber = async (payload: any) => {
  // Graceful normalizations extract target variable indices from nested checkouts safely
  const targetNumber =
    payload.number || payload.phone || payload.meterNo || payload.smartCardNo;

  if (!targetNumber) {
    throw new Error(
      "Validation Mismatch: Missing customer account identification identifier parameter.",
    );
  }

  const queryParams = `MobileNetwork=smile-direct&MobileNumber=${encodeURIComponent(String(targetNumber).trim())}`;

  try {
    const data = await makeClubKonnectRequest(
      "APIVerifySmileV1.asp",
      queryParams,
    );

    // Validation evaluation logic patterns matching ClubKonnect rules
    const customerName = String(
      data?.customer_name || data?.Customer_Name || "",
    ).toUpperCase();
    const isValid =
      customerName.length > 0 &&
      !customerName.includes("INVALID") &&
      !customerName.includes("ERROR");

    return {
      valid: isValid,
      customer_name: isValid ? data.customer_name : "Invalid Account Number",
    };
  } catch (e: any) {
    console.error("Smile Account Verification Failure:", e.message);
    throw new Error(`Smile account loop lookup timeout check: ${e.message}`);
  }
};

/**
 * 3. BUY SMILE DATA
 * Submits automated value execution requests down to the upstream vendor API endpoints.
 */
export const buySmileData = async (payload: any) => {
  // Parameters extraction schema normalizations
  const targetNumber =
    payload.number || payload.phone || payload.meterNo || payload.smartCardNo;
  const planId = payload.plan_id || payload.service_id || payload.id;

  if (!targetNumber || !planId) {
    throw new Error(
      "Validation Mismatch: Processing requires explicit target account identity and plan specification metrics.",
    );
  }

  const requestID =
    payload.reference ||
    `SML-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const queryParams = `MobileNetwork=smile-direct&DataPlan=${encodeURIComponent(String(planId).trim())}&MobileNumber=${encodeURIComponent(String(targetNumber).trim())}&RequestID=${requestID}`;

  try {
    const data = await makeClubKonnectRequest("APISmileV1.asp", queryParams);
    console.log(`[Smile Execution Response Log]`, JSON.stringify(data));

    const responseStatus = String(
      data?.status || data?.Status || "",
    ).toUpperCase();
    const isSuccess =
      responseStatus === "ORDER_RECEIVED" ||
      responseStatus === "ORDER_COMPLETED";

    return {
      success: isSuccess,
      message:
        data?.status || data?.remark || data?.error || "Transaction Executed",
      data: data,
      reference: requestID,
    };
  } catch (e: any) {
    console.error("Smile Purchase Finalize Error Exception:", e.message);
    throw new Error(
      `Upstream Smile Network cluster fulfillment failure: ${e.message}`,
    );
  }
};
