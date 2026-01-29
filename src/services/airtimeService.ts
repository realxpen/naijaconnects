// src/services/airtimeService.ts
import { 
  AirtimePayload, 
  DataPayload, 
  ElectricityPayload, 
  CablePayload, 
  ApiResponse,
  DataPlan 
} from '../types';

// ⚠️ AFFATECH CONFIG
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://www.affatech.com.ng/api';
const API_TOKEN = import.meta.env.VITE_AFFATECH_TOKEN || 'YOUR_AFFATECH_API_KEY'; 

const headers = {
  'Authorization': `Token ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

/**
 * Helper to handle fetch requests with standardized error handling
 */
const apiRequest = async <T>(endpoint: string, method: 'GET' | 'POST', body?: any): Promise<T> => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API Error ${response.status}: Request failed`);
    }

    return data;
  } catch (error) {
    console.error(`Affatech API Error (${endpoint}):`, error);
    throw error;
  }
};

export const airtimeService = {
  
  // --- 1. FETCH PLANS & NETWORKS ---
  
  /**
   * Fetches all available data plans and maps them to the App's DataPlan interface.
   */
  getAllDataPlans: async (): Promise<DataPlan[]> => {
    try {
      // Affatech returns a list of data variations/plans
      const response: any = await apiRequest('/network/', 'GET');
      
      if (!response || !Array.isArray(response)) return [];

      // Map Affatech fields to local App interface
      return response.map((p: any) => ({
        id: p.id,
        network: p.network,      // 1=MTN, 2=GLO, 3=AIRTEL, 4=9MOBILE
        plan_type: p.plan_type,  // SME, Gifting, Corporate Gifting
        amount: p.plan_amount,
        size: p.plan_size,       // e.g., "1.0GB"
        validity: p.month_validate
      }));
    } catch (e) {
      console.warn("Falling back to empty plans due to fetch error.");
      return [];
    }
  },

  getNetworks: async () => {
    return apiRequest('/get/network/', 'GET');
  },

  // --- 2. VALIDATION SERVICES ---

  validateMeter: async (meterNumber: string, discoId: number, meterType: number) => {
    const query = `?meternumber=${meterNumber}&disconame=${discoId}&mtype=${meterType}`;
    return apiRequest(`/validatemeter${query}`, 'GET');
  },

  validateCableIUC: async (smartCardNumber: string, cableNameId: number) => {
    const query = `?smart_card_number=${smartCardNumber}&cablename=${cableNameId}`;
    return apiRequest(`/validateiuc${query}`, 'GET');
  },

  // --- 3. TRANSACTION SERVICES ---

  buyAirtime: async (payload: AirtimePayload) => {
    return apiRequest<ApiResponse>('/topup/', 'POST', payload);
  },

  buyData: async (payload: DataPayload) => {
    return apiRequest<ApiResponse>('/data/', 'POST', payload);
  },

  buyElectricity: async (payload: ElectricityPayload) => {
    return apiRequest<ApiResponse>('/billpayment/', 'POST', payload);
  },

  buyCable: async (payload: CablePayload) => {
    return apiRequest<ApiResponse>('/cablesub/', 'POST', payload);
  },

  convertAirtimeToCash: async (payload: { network: number, mobile_number: string, amount: number }) => {
    return apiRequest<ApiResponse>('/Airtime_funding/', 'POST', payload);
  }
};