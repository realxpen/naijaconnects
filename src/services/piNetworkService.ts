import { supabase } from "../supabaseClient";

type PiPaymentDTO = {
  identifier?: string;
  user_uid?: string;
  amount?: number;
  memo?: string;
  metadata?: Record<string, unknown>;
  from_address?: string;
  to_address?: string;
  direction?: "user_to_app" | "app_to_user";
  created_at?: string;
  network?: "Pi Network" | "Pi Testnet";
  transaction?: {
    txid?: string;
    verified?: boolean;
    _link?: string;
  } | null;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
};

type PiAuthResult = {
  user: {
    uid: string;
    username?: string;
    wallet_address?: string;
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
  onError: (error: Error, payment?: PiPaymentDTO) => void;
};

type PiSDK = {
  init: (options: {
    version: "2.0";
    sandbox?: boolean;
  }) => Promise<void> | void;
  authenticate: (
    scopes: Array<"username" | "payments" | "wallet_address">,
    onIncompletePaymentFound?: (payment: PiPaymentDTO) => void,
  ) => Promise<PiAuthResult>;
  createPayment: (
    paymentData: PiPaymentData,
    callbacks: PiPaymentCallbacks,
  ) => void;
  nativeFeaturesList: () => Promise<unknown>;
  openShareDialog: (title: string, message: string) => void;
  openUrlInSystemBrowser: (url: string) => Promise<void>;
};

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

let piInitPromise: Promise<void> | null = null;

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForPiSdk = async () => {
  if (typeof window === "undefined") {
    throw new Error("Pi payments can only run in a browser.");
  }

  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (window.Pi) return window.Pi;
    await wait(250);
  }

  throw new Error(
    "Pi SDK is unavailable. Open Swifna inside Pi Browser and confirm the Pi SDK script is allowed.",
  );
};

export const initPiSdk = async () => {
  const Pi = await waitForPiSdk();
  if (!piInitPromise) {
    const sandbox =
      import.meta.env.DEV ||
      String(import.meta.env.VITE_PI_SANDBOX || "").toLowerCase() === "true";
    piInitPromise = Promise.resolve(Pi.init({ version: "2.0", sandbox }));
  }
  return piInitPromise;
};

export const authenticatePiUser = async (
  onIncompletePaymentFound?: (payment: PiPaymentDTO) => void,
) => {
  await initPiSdk();
  if (!window.Pi) throw new Error("Pi SDK is unavailable.");
  return window.Pi.authenticate(
    ["username", "payments", "wallet_address"],
    onIncompletePaymentFound,
  );
};

export const authenticatePiUserWithWallet = async (
  onIncompletePaymentFound?: (payment: PiPaymentDTO) => void,
) => {
  await initPiSdk();
  if (!window.Pi) throw new Error("Pi SDK is unavailable.");
  return window.Pi.authenticate(
    ["username", "payments", "wallet_address"],
    onIncompletePaymentFound,
  );
};

export const linkPiUserAccount = async (accessToken: string) => {
  // 🔌 Call our brand new verification edge function
  const { data, error } = await supabase.functions.invoke("pi-auth-verify", {
    body: { accessToken },
  });

  if (error) {
    throw new Error(
      error?.message || "Failed to communicate with authentication server",
    );
  }

  // Return the full JSON payload containing { success, linked, piUser, session }
  return data;
};

export const createPiPayment = async (
  paymentData: PiPaymentData,
  callbacks: PiPaymentCallbacks,
) => {
  await initPiSdk();
  if (!window.Pi) throw new Error("Pi SDK is unavailable.");
  window.Pi.createPayment(paymentData, callbacks);
};

export type { PiAuthResult, PiPaymentDTO };
