export const CLUBKONNECT_BASE_URL = "https://www.nellobytesystems.com/APIAirtimeV1.asp";
export const CLUBKONNECT_USER_ID = Deno.env.get("CLUBKONNECT_USER_ID")!;
export const CLUBKONNECT_API_KEY = Deno.env.get("CLUBKONNECT_API_KEY")!;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const makeClubKonnectRequest = async (queryParams: string) => {
    const url = `${CLUBKONNECT_BASE_URL}?${queryParams}`;
    console.log("Calling ClubKonnect:", url); 

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`ClubKonnect Error: ${response.status}`);
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};