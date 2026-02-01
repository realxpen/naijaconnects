// src/constants.ts

import { Carrier, DataPlan, Language } from './types';

// --- ASSET IMPORTS (NEW) ---
import mtnLogo from './assets/logos/mtn.png';
import gloLogo from './assets/logos/glo.png';
import airtelLogo from './assets/logos/airtel.png';
import t2mobileLogo from './assets/logos/t2mobile.png'; // formerly 9mobile
import smileLogo from './assets/logos/smile.png';
import waecLogo from './assets/logos/waec.png';
import necoLogo from './assets/logos/neco.png';
import dstvLogo from './assets/logos/dstv.png';
import gotvLogo from './assets/logos/gotv.png';
import startimesLogo from './assets/logos/startimescable.png';
import showmaxLogo from './assets/logos/showmax.png';
import ikejaLogo from './assets/logos/ikedc.png';

// --- 1. NETWORK ID MAPPING ---
// Maps API IDs to Carrier Enums for logic handling
export const NETWORK_ID_MAP: Record<number, Carrier> = {
  1: Carrier.MTN,
  2: Carrier.GLO,
  3: Carrier.AIRTEL,
  4: Carrier.NINEMOBILE, // Maps to T2MOBILE in UI
  5: Carrier.SMILE
};

// --- 2. CARRIER LIST (UI Data) ---
// Merged: Uses new local Logos + Existing color schemes
export const CARRIERS = [
  { id: 1, enum: Carrier.MTN, name: 'MTN', logo: mtnLogo, color: 'bg-yellow-400' },
  { id: 2, enum: Carrier.GLO, name: 'GLO', logo: gloLogo, color: 'bg-green-600' },
  { id: 3, enum: Carrier.AIRTEL, name: 'AIRTEL', logo: airtelLogo, color: 'bg-red-600' },
  { id: 4, enum: Carrier.NINEMOBILE, name: 'T2MOBILE', logo: t2mobileLogo, subText: '(Formerly 9Mobile)', color: 'bg-green-900' },
  { id: 5, enum: Carrier.SMILE, name: 'SMILE', logo: smileLogo, color: 'bg-pink-600' }
];

// --- 3. BILL PAYMENT PROVIDERS (Detailed) ---

export const CABLE_PROVIDERS = [
  { id: 'gotv', name: 'GOtv', logo: gotvLogo }, 
  { id: 'dstv', name: 'DStv', logo: dstvLogo }, 
  { id: 'startimes', name: 'StarTimes', logo: startimesLogo }, 
  { id: 'showmax', name: 'Showmax', logo: showmaxLogo }
];

export const DISCOS = [
  { id: '01', name: 'Eko', short: 'EKEDC', logo: 'https://via.placeholder.com/50?text=EKO' }, 
  { id: '02', name: 'Ikeja', short: 'IKEDC', logo: ikejaLogo }, 
  { id: '03', name: 'Abuja', short: 'AEDC', logo: 'https://via.placeholder.com/50?text=AEDC' }, 
  { id: '04', name: 'Kano', short: 'KEDCO', logo: 'https://via.placeholder.com/50?text=KEDCO' },
  { id: '05', name: 'P.Harcourt', short: 'PHED', logo: 'https://via.placeholder.com/50?text=PHED' },
  { id: '06', name: 'Jos', short: 'JED', logo: 'https://via.placeholder.com/50?text=JOS' }, 
  { id: '07', name: 'Ibadan', short: 'IBEDC', logo: 'https://via.placeholder.com/50?text=IBEDC' }, 
  { id: '08', name: 'Kaduna', short: 'KAEDCO', logo: 'https://via.placeholder.com/50?text=KD' },
  { id: '09', name: 'Enugu', short: 'EEDC', logo: 'https://via.placeholder.com/50?text=EEDC' }, 
  { id: '10', name: 'Benin', short: 'BEDC', logo: 'https://via.placeholder.com/50?text=BENIN' },
  { id: '11', name: 'Yola', short: 'YEDC', logo: 'https://via.placeholder.com/50?text=YOLA' },
  { id: '12', name: 'Aba', short: 'APLE', logo: 'https://via.placeholder.com/50?text=ABA' },
];

export const EXAM_TYPES = [
  { id: 'JAMB', name: 'JAMB e-PIN', price: 4500, logo: null }, 
  { id: 'WAEC', name: 'WAEC Result Checker', price: 3500, logo: waecLogo }, 
  { id: 'NECO', name: 'NECO Result Checker', price: 1350, logo: necoLogo },
];

// --- 4. NETWORK PREFIXES (For Auto-Detect) ---
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

// --- 5. PRICING & DEFAULTS ---
export const PREFILLED_AMOUNTS = [1000, 2000, 5000, 10000];
export const RECHARGE_AMOUNTS = [100, 200, 500, 1000];
export const PIN_PRICING: Record<number, number> = { 1: 98, 2: 97, 3: 97, 4: 95, 5: 95 };

// --- 6. LANGUAGES & TRANSLATIONS ---
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

// --- 7. MOCK DATA PLANS ---
export const MOCK_DATA_PLANS: Record<string, DataPlan[]> = {
  [Carrier.MTN]: [],
  [Carrier.GLO]: [],
  [Carrier.AIRTEL]: [],
  [Carrier.NINEMOBILE]: []
};

// Mock Cable Plans (Updated keys to match CABLE_PROVIDERS IDs)
export const MOCK_CABLE_PLANS: Record<string, { id: number; name: string; amount: number }[]> = {
  'gotv': [ 
    { id: 16, name: 'GOtv Jinja', amount: 3900 },
    { id: 17, name: 'GOtv Jolli', amount: 5800 },
    { id: 2, name: 'GOtv Max', amount: 8500 },
    { id: 47, name: 'GOtv Supa', amount: 11400 },
  ],
  'dstv': [ 
    { id: 20, name: 'DStv Padi', amount: 4400 },
    { id: 6, name: 'DStv Yanga', amount: 6000 },
    { id: 19, name: 'DStv Confam', amount: 11000 },
    { id: 7, name: 'DStv Compact', amount: 19000 },
    { id: 9, name: 'DStv Premium', amount: 44500 },
  ],
  'startimes': [ 
    { id: 14, name: 'Nova', amount: 1900 },
    { id: 38, name: 'Basic', amount: 3700 },
    { id: 11, name: 'Classic', amount: 6200 },
    { id: 15, name: 'Super', amount: 8800 },
  ]
};