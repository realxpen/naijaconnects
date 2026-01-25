// src/constants.ts

import { Carrier, DataPlan, Language } from './types';

// --- 1. NETWORK ID MAPPING ---
// This maps the API ID (e.g. 1) to our Carrier Enum (e.g. MTN)
export const NETWORK_ID_MAP: Record<number, Carrier> = {
  1: Carrier.MTN,
  2: Carrier.GLO,
  3: Carrier.NINEMOBILE,
  4: Carrier.AIRTEL
};

// --- 2. NETWORK PREFIXES (For Auto-Detect) ---
export const NETWORK_PREFIXES: Record<string, string[]> = {
  [Carrier.MTN]: [
    '0803', '0806', '0810', '0813', '0814', '0816', 
    '0903', '0906', '0913', '0916', 
    '0703', '0706', '0704', '07025', '07026'
  ],
  [Carrier.GLO]: [
    '0805', '0807', '0811', '0705', '0905', '0815', '0915'
  ],
  [Carrier.NINEMOBILE]: [
    '0809', '0817', '0818', '0909', '0908'
  ],
  [Carrier.AIRTEL]: [
    '0802', '0808', '0812', '0701', '0708', 
    '0902', '0907', '0901', '0912', '0904', '0911'
  ]
};

// --- 3. CARRIER LIST (For UI Icons) ---
export const CARRIERS = [
  { id: Carrier.MTN, logo: 'https://upload.wikimedia.org/wikipedia/commons/9/93/New-mtn-logo.jpg', color: 'bg-yellow-400' },
  { id: Carrier.GLO, logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Glo_button.png/1200px-Glo_button.png', color: 'bg-green-600' },
  { id: Carrier.AIRTEL, logo: 'https://upload.wikimedia.org/wikipedia/commons/bc/Airtel_logo_2010.svg', color: 'bg-red-600' },
  { id: Carrier.NINEMOBILE, logo: 'https://upload.wikimedia.org/wikipedia/commons/9/98/9mobile_Logo.png', color: 'bg-green-900' },
];

// --- 4. LANGUAGES & TRANSLATIONS ---
export const LANGUAGES: Language[] = [
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'ng', name: 'Pidgin', flag: '🇳🇬' },
];

export const TRANSLATIONS: any = {
  en: { 
    welcome: 'Welcome Back', 
    create: 'Create Account', 
    signin: 'Sign In', 
    signup: 'Sign Up',
    buy: 'Buy',
    history: 'History',
    airtime: 'Airtime',
    data: 'Data',
    recharge_now: 'Recharge Now',
    select_net: 'Select Network',
    wallet_bal: 'Wallet Balance'
  },
  ng: { 
    welcome: 'How far', 
    create: 'Join Us', 
    signin: 'Enter', 
    signup: 'Join Body',
    buy: 'Buy am',
    history: 'Wetin u do',
    airtime: 'Credit',
    data: 'Data',
    recharge_now: 'Load am',
    select_net: 'Pick Network',
    wallet_bal: 'Ur Money'
  },
};

// --- 5. MOCK DATA (Fallback) ---
export const MOCK_DATA_PLANS: Record<string, DataPlan[]> = {
  [Carrier.MTN]: [],
  [Carrier.GLO]: [],
  [Carrier.AIRTEL]: [],
  [Carrier.NINEMOBILE]: []
};

// --- 6. BILL PAYMENT CONSTANTS (New) ---

export const DISCOS = [
  { id: 1, name: 'Ikeja Electric' },
  { id: 2, name: 'Eko Electric' },
  { id: 3, name: 'Abuja Electric' },
  { id: 4, name: 'Kano Electric' },
  { id: 5, name: 'Enugu Electric' },
  { id: 6, name: 'Port Harcourt Electric' },
  { id: 7, name: 'Ibadan Electric' },
  { id: 8, name: 'Kaduna Electric' },
  { id: 9, name: 'Jos Electric' },
  { id: 10, name: 'Benin Electric' },
  { id: 11, name: 'Yola Electric' }
];

export const CABLE_PROVIDERS = [
  { id: 1, name: 'GOTV' },
  { id: 2, name: 'DSTV' },
  { id: 3, name: 'STARTIMES' }
];

// Mock Cable Plans (Since we don't have a live API for plans yet)
export const MOCK_CABLE_PLANS: Record<number, { id: number; name: string; amount: number }[]> = {
  1: [ // GOTV
    { id: 16, name: 'GOtv Jinja', amount: 3900 },
    { id: 17, name: 'GOtv Jolli', amount: 5800 },
    { id: 2, name: 'GOtv Max', amount: 8500 },
    { id: 47, name: 'GOtv Supa', amount: 11400 },
  ],
  2: [ // DSTV
    { id: 20, name: 'DStv Padi', amount: 4400 },
    { id: 6, name: 'DStv Yanga', amount: 6000 },
    { id: 19, name: 'DStv Confam', amount: 11000 },
    { id: 7, name: 'DStv Compact', amount: 19000 },
    { id: 9, name: 'DStv Premium', amount: 44500 },
  ],
  3: [ // STARTIMES
    { id: 14, name: 'Nova', amount: 1900 },
    { id: 38, name: 'Basic', amount: 3700 },
    { id: 11, name: 'Classic', amount: 6200 },
    { id: 15, name: 'Super', amount: 8800 },
  ]
};