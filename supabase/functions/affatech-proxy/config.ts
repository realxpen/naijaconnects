export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

export const AFFATECH_CONFIG = {
  // Standard secure base URL as per vendor specification
  BASE_URL: "https://www.affatech.com.ng/api",

  getHeaders: () => {
    const apiKey = Deno.env.get("AFFATECH_API_KEY");
    if (!apiKey)
      throw new Error(
        "Server Config Error: Missing AFFATECH_API_KEY inside edge engine.",
      );

    return {
      "Content-Type": "application/json",
      Authorization: `Token ${apiKey}`,
    };
  },
};

export const makeAffatechRequest = async (
  endpoint: string,
  payload: any = {},
  method = "POST",
) => {
  // 🧼 URL Sanitation: Ensure a single slash exists between the base API URL and endpoint paths
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${AFFATECH_CONFIG.BASE_URL}${cleanEndpoint}`;

  console.log(`[Affatech Request] ${method} -> ${url}`);

  const options: any = {
    method: method,
    headers: AFFATECH_CONFIG.getHeaders(),
  };

  // Include payload body if request isn't an explicit GET fetch call
  if (method !== "GET") {
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(url, options);
    const rawText = await response.text();

    try {
      return JSON.parse(rawText);
    } catch {
      // Catches any 502 Bad Gateway or raw HTML cloudflare/vendor crash text gracefully for the frontend logs
      throw new Error(
        `Affatech Gateway Error (Non-JSON): ${rawText.substring(0, 150)}`,
      );
    }
  } catch (e: any) {
    throw new Error(`Upstream Network Error: ${e.message}`);
  }
};
