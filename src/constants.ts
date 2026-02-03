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
// --- IMPORT LOGOS EXPLICITLY ---

// Carriers
import mtnLogo from './assets/logos/mtn.png';
import gloLogo from './assets/logos/glo.png';
import airtelLogo from './assets/logos/airtel.png';
import nineMobileLogo from './assets/logos/t2mobile.png'; // Assuming t2mobile is 9mobile
import smileLogo from './assets/logos/smile.png';

// Cable TV
import dstvLogo from './assets/logos/dstv.png';
import gotvLogo from './assets/logos/gotv.png';
import startimesLogo from './assets/logos/startimescable.png';
import showmaxLogo from './assets/logos/showmax.png';

// Electricity (Discos)
import ikejaLogo from './assets/logos/ikedc.png';
import ekoLogo from './assets/logos/eko.png';
import abujaLogo from './assets/logos/abuja.png';
import ibadanLogo from './assets/logos/ibedc.png';
import enuguLogo from './assets/logos/enugu.png';
import portharcourtLogo from './assets/logos/portharcourt.png';
import kanoLogo from './assets/logos/kano.png';
import kadunaLogo from './assets/logos/kaduna.png';
import josLogo from './assets/logos/jos_jed.png';
import beninLogo from './assets/logos/benin.png';
import yolaLogo from './assets/logos/yola.png';

// Exams
import jambLogo from './assets/logos/jamb.png';
import waecLogo from './assets/logos/waec.png';
import necoLogo from './assets/logos/neco.png';

// ... (keep your existing Enum definitions like Carrier, etc.)
export enum Carrier {
  MTN = "MTN",
  GLO = "GLO",
  AIRTEL = "AIRTEL",
  NINEMOBILE = "9MOBILE",
  SMILE = "SMILE"
}
];

// --- 4. EXAM PRICING (Updated) ---
export const JAMB_VARIANTS = [
  { id: "utme-no-mock", name: "UTME (No Mock)", amount: 7200 },
  { id: "utme-mock", name: "UTME (With Mock)", amount: 8700 },
  { id: "de", name: "Direct Entry (DE)", amount: 5700 }
];

export const EXAM_TYPES = [
  { id: 'JAMB', name: 'JAMB e-PIN', price: 0, logo: null }, // Price calculated from variant
  { id: 'WAEC', name: 'WAEC Result Checker', price: 3500, logo: waecLogo }, // ₦3,500
  { id: 'NECO', name: 'NECO Result Checker', price: 1300, logo: necoLogo }, // ₦1,300
];

export const PREFILLED_AMOUNTS = [1000, 2000, 5000, 10000];
export const RECHARGE_AMOUNTS = [100, 200, 500, 1000];
export const PIN_PRICING: Record<number, number> = { 1: 98, 2: 97, 3: 97, 4: 95, 5: 95 };

export const LANGUAGES: Language[] = [
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'ng', name: 'Pidgin', flag: '🇳🇬' },
];