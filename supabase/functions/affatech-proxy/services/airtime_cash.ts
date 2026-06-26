import { makeAffatechRequest } from "../config.ts";

export const airtimeToCash = async (payload: any) => {
  // Normalizing targeting metrics from structured checkout
  const recipientObj = payload.recipient || payload.target_recipient || {};
  const phone = recipientObj.phone || payload.phone || payload.mobile_number;

  // DOCUMENTATION: https://www.affatech.com.ng/api/airtimetocash/
  return await makeAffatechRequest("/airtimetocash/", {
    network: payload.network,
    amount: payload.amount,
    mobile_number: phone,
  });
};
