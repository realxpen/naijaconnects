type PiPaymentDTO = {
  identifier?: string;
  amount?: number;
  memo?: string;
  metadata?: Record<string, unknown>;
  transaction?: {
    txid?: string;
    verified?: boolean;
  } | null;
  status?: Record<string, boolean>;
};

type PiAuthResult = {
  user: {
    uid: string;
    username?: string;
  };
  accessToken: string;
};

type PiPaymentData = {
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
};

type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: unknown, paymentData?: PiPaymentData) => void;
};

type PiSDK = {
  init: (options: { version: "2.0"; sandbox?: boolean }) => Promise<void> | void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound?: (payment: PiPaymentDTO) => void,
  ) => Promise<PiAuthResult>;
  createPayment: (paymentData: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
};

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

let piInitPromise: Promise<void> | null = null;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForPiSdk = async () => {
  if (typeof window === "undefined") {
    throw new Error("Pi payments can only run in a browser.");
  }

  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (window.Pi) return window.Pi;
    await wait(250);
  }

  throw new Error("Pi SDK is unavailable. Open Swifna inside Pi Browser and confirm the Pi SDK script is allowed.");
};

export const initPiSdk = async () => {
  const Pi = await waitForPiSdk();
  if (!piInitPromise) {
    const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "").toLowerCase() === "true";
    piInitPromise = Promise.resolve(Pi.init({ version: "2.0", sandbox }));
  }
  return piInitPromise;
};

export const authenticatePiUser = async (
  onIncompletePaymentFound?: (payment: PiPaymentDTO) => void,
) => {
  await initPiSdk();
  if (!window.Pi) throw new Error("Pi SDK is unavailable.");
  return window.Pi.authenticate(["username", "payments"], onIncompletePaymentFound);
};

export const createPiPayment = async (paymentData: PiPaymentData, callbacks: PiPaymentCallbacks) => {
  await initPiSdk();
  if (!window.Pi) throw new Error("Pi SDK is unavailable.");
  window.Pi.createPayment(paymentData, callbacks);
};

export type { PiAuthResult, PiPaymentDTO };
