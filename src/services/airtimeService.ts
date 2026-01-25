// src/services/airtimeService.ts
import { 
  AirtimePayload, 
  DataPayload, 
  ElectricityPayload, // Imported from types.ts
  CablePayload,       // Imported from types.ts
  ApiResponse 
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://www.affatech.com.ng/api';
const API_TOKEN = import.meta.env.VITE_AFFATECH_TOKEN || ''; // Ensure this is in your .env.local

const headers = {
  'Authorization': `Token ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Helper function to handle fetch requests
const apiRequest = async <T>(endpoint: string, method: 'GET' | 'POST', body?: any): Promise<T> => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error ${response.status}: Request failed`);
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

export const airtimeService = {
  
  // --- 1. Info Fetching ---
  getNetworks: async () => {
    return apiRequest('/get/network/', 'GET');
  },

  getDataPlans: async () => {
    return apiRequest('/network/', 'GET'); 
  },

  // --- 2. Validation Services ---
  validateMeter: async (meterNumber: string, discoId: number, meterType: number) => {
    const query = `?meternumber=${meterNumber}&disconame=${discoId}&mtype=${meterType}`;
    return apiRequest(`/validatemeter${query}`, 'GET');
  },

  validateCableIUC: async (smartCardNumber: string, cableNameId: number) => {
    const query = `?smart_card_number=${smartCardNumber}&cablename=${cableNameId}`;
    return apiRequest(`/validateiuc${query}`, 'GET');
  },

  // --- 3. Purchase Services ---
  buyAirtime: async (payload: AirtimePayload) => {
    return apiRequest<ApiResponse>('/topup/', 'POST', payload);
  },

  buyData: async (payload: DataPayload) => {
    return apiRequest<ApiResponse>('/data/', 'POST', payload);
  },

  // Buy Electricity
  buyElectricity: async (payload: ElectricityPayload) => {
    return apiRequest<ApiResponse>('/billpayment/', 'POST', payload);
  },

  // Buy Cable TV
  buyCable: async (payload: CablePayload) => {
    return apiRequest<ApiResponse>('/cablesub/', 'POST', payload);
  },

  // Airtime to Cash (Funding)
  convertAirtimeToCash: async (payload: { network: number, mobile_number: string, amount: number }) => {
    return apiRequest<ApiResponse>('/Airtime_funding/', 'POST', payload);
  }
};