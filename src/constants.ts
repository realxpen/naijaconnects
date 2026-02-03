// src/constants.ts

// --- 1. TYPE DEFINITIONS ---
export enum Carrier {
  MTN = 'MTN',
  GLO = 'GLO',
  AIRTEL = 'AIRTEL',
  NINEMOBILE = '9MOBILE',
  SMILE = 'SMILE'
}

export interface DataPlan {
  id: number | string;
  name: string;
  price: number;
  network: Carrier;
}

export interface Language {
  id: string;
  name: string;
  flag: string;
}

// --- 2. ASSET IMPORTS ---
import mtnLogo from './assets/logos/mtn.png';
import gloLogo from './assets/logos/glo.png';
import airtelLogo from './assets/logos/airtel.png';
import t2mobileLogo from './assets/logos/t2mobile.png';
import smileLogo from './assets/logos/smile.png';
import waecLogo from './assets/logos/waec.png';
import necoLogo from './assets/logos/neco.png';
import dstvLogo from './assets/logos/dstv.png';
import gotvLogo from './assets/logos/gotv.png';
import startimesLogo from './assets/logos/startimescable.png';
import showmaxLogo from './assets/logos/showmax.png';
import ikejaLogo from './assets/logos/ikedc.png';

// --- 3. MAPPINGS & DATA ---
export const NETWORK_ID_MAP: Record<number, Carrier> = {
  1: Carrier.MTN,
  2: Carrier.GLO,
  3: Carrier.AIRTEL,
  4: Carrier.NINEMOBILE,
  5: Carrier.SMILE
};

export const CARRIERS = [
  { id: 1, enum: Carrier.MTN, name: 'MTN', logo: mtnLogo, color: 'bg-yellow-400' },
  { id: 2, enum: Carrier.GLO, name: 'GLO', logo: gloLogo, color: 'bg-green-600' },
  { id: 3, enum: Carrier.AIRTEL, name: 'AIRTEL', logo: airtelLogo, color: 'bg-red-600' },
  { id: 4, enum: Carrier.NINEMOBILE, name: 'T2MOBILE', logo: t2mobileLogo, subText: '(Formerly 9Mobile)', color: 'bg-green-900' },
  { id: 5, enum: Carrier.SMILE, name: 'SMILE', logo: smileLogo, color: 'bg-pink-600' }
];

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

// --- 4. EXAM PRICING (Updated) ---
export const JAMB_VARIANTS = [
  { id: "utme-no-mock", name: "UTME (No Mock)", amount: 7200 },
  { id: "utme-mock", name: "UTME (With Mock)", amount: 8700 },
  { id: "de", name: "Direct Entry (DE)", amount: 5700 }
];

export const EXAM_TYPES = [
  { id: 'JAMB', name: 'JAMB e-PIN', price: 0, logo: null }, // Price calculated from variant
  { id: 'WAEC', name: 'WAEC Result Checker', price: 3500, logo: waecLogo },
  { id: 'NECO', name: 'NECO Result Checker', price: 1300, logo: necoLogo },
];

export const PREFILLED_AMOUNTS = [1000, 2000, 5000, 10000];
export const RECHARGE_AMOUNTS = [100, 200, 500, 1000];
export const PIN_PRICING: Record<number, number> = { 1: 98, 2: 97, 3: 97, 4: 95, 5: 95 };

export const LANGUAGES: Language[] = [
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { id: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { id: 'fr', name: 'French', flag: '🇫🇷' },
  { id: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { id: 'ng', name: 'Pidgin', flag: '🇳🇬' },
];
