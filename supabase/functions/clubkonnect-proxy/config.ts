export const CLUBKONNECT_USER_ID = Deno.env.get("CLUBKONNECT_USER_ID") ?? "";
export const CLUBKONNECT_API_KEY = Deno.env.get("CLUBKONNECT_API_KEY") ?? "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

/**
 * Executes a structural query request down to ClubKonnect's category endpoints
 * @param serviceEndpoint File name of the specific service (e.g., 'APIElectricityV1.asp')
 * @param queryParams Formatted API query parameters string
 */
export const makeClubKonnectRequest = async (
  serviceEndpoint: string,
  queryParams: string,
) => {
  // 🧼 Clean endpoint to avoid double slashes or accidental pathing drops
  const fileTarget = serviceEndpoint.startsWith("/")
    ? serviceEndpoint.substring(1)
    : serviceEndpoint;

  // Dynamic endpoint base cluster mapping
  const url = `https://www.nellobytesystems.com/${fileTarget}?UserID=${CLUBKONNECT_USER_ID}&APIKey=${CLUBKONNECT_API_KEY}&${queryParams}`;

  // Anonymize key parameters inside logs to protect system credentials security bounds
  console.log(
    `[ClubKonnect Dispatch] Target Route -> ${fileTarget}?${queryParams.substring(0, 45)}...`,
  );

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok)
      throw new Error(`Upstream Server Exception Code: ${response.status}`);

    const rawText = await response.text();

    try {
      return JSON.parse(rawText);
    } catch {
      // Safely catches raw text errors from Nellobytes clusters if internal database routes crash
      throw new Error(
        `ClubKonnect Gateway Error (Non-JSON response): ${rawText.substring(0, 150)}`,
      );
    }
  } catch (error: any) {
    console.error(`[ClubKonnect Network Error]: ${error.message}`);
    throw error;
  }
};
