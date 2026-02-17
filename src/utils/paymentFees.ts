export type DepositMethod = "BankCard" | "BankTransfer" | "BankUssd";

export const LOCAL_PAYMENT_LINK_RATE = 0.012; // 1.2%
export const LOCAL_PAYMENT_LINK_CAP = 1500;
export const VIRTUAL_ACCOUNT_RATE = 0.0025; // 0.25%
export const VIRTUAL_ACCOUNT_CAP = 1000;

export const calculateLocalPaymentLinkFee = (amount: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(amount * LOCAL_PAYMENT_LINK_RATE, LOCAL_PAYMENT_LINK_CAP);
};

export const calculateVirtualAccountFee = (amount: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(amount * VIRTUAL_ACCOUNT_RATE, VIRTUAL_ACCOUNT_CAP);
};

// International payment-link pricing from your schedule.
export const calculateInternationalPaymentLinkFeeUSD = (amountUsd: number): number => {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  if (amountUsd < 50) return 2.5;
  if (amountUsd <= 100) return 5;
  return amountUsd * 0.039;
};

export const calculateDepositFee = (amount: number, method: DepositMethod): number => {
  if (method === "BankTransfer") return calculateVirtualAccountFee(amount);
  return calculateLocalPaymentLinkFee(amount);
};

// Transfer service fee range: ₦8 - ₦40
export const calculateTransferServiceFee = (amount: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount <= 5000) return 8;
  if (amount <= 50000) return 20;
  return 40;
};

