// src/types.ts

// 1. Enums (CRITICAL for constants.ts)
export enum Carrier {
  MTN = 'MTN',
  GLO = 'GLO',
  AIRTEL = 'AIRTEL',
  NINEMOBILE = '9MOBILE'
}

// 2. Interfaces
export interface Language {
  id: string;
  name: string;
  flag: string;
}

export interface DataPlan {
  id: number;
  network: number;
  plan_type: string;
  amount: string;
  size: string;
  validity: string;
  price?: number; // Optional helper for UI
}

export interface Transaction {
  id: string;
  date: string;
  carrier: string;
  type: 'Airtime' | 'Data' | 'Deposit' | 'Withdrawal' | 'System';
  amount: number;
  phoneNumber: string;
  status: 'Success' | 'Failed' | 'Pending';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// 3. API Responses & Payloads
export interface ApiResponse<T = any> {
  status?: string;
  message?: string;
  data?: T;
}

export interface AirtimePayload {
  network: number;
  amount: number;
  mobile_number: string;
  Ported_number: boolean;
  airtime_type: 'VTU' | 'awuf4U' | 'Share and Sell';
}

export interface DataPayload {
  network: number;
  mobile_number: string;
  plan: number;
  Ported_number: boolean;
}