// src/services/geminiService.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
// REMOVED: import { MOCK_DATA_PLANS } from "../constants"; 
import { LanguageCode } from "../i18n";

// Initialize Gemini (Ensure VITE_GEMINI_API_KEY is in your .env.local)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export const geminiService = {
  
  // Main entry point for the Assistant
  generateResponse: async (text: string, userContext: { name: string, balance: number }, language: LanguageCode = 'en') => {
    
    // Simulate a small "thinking" delay for realism
    await new Promise(r => setTimeout(r, 1000));
    
    const lowerText = text.toLowerCase();

    // --- 1. LOCAL LOGIC (Instant Answers) ---

    // BALANCE
    if (lowerText.includes('balance') || lowerText.includes('how much')) {
      return `Your current wallet balance is ₦${userContext.balance.toLocaleString()}.`;
    }

    // FUNDING
    if (lowerText.includes('fund') || lowerText.includes('deposit') || lowerText.includes('add money')) {
      return `To fund your wallet, go to the Dashboard and click the white "Deposit" button. You can pay via Bank Transfer or Card.`;
    }

    // AIRTIME/DATA HELP
    if (lowerText.includes('airtime') || lowerText.includes('data')) {
      return "You can buy Airtime and Data directly from the Dashboard. Select your network (MTN, Glo, etc.), enter the phone number, and choose your plan.";
    }

    // GREETINGS (Local fallback if API is slow or offline)
    if ((lowerText.includes('hello') || lowerText.includes('hi')) && !API_KEY) {
      return `Hello ${userContext.name}! I am your Swifna assistant. How can I help you today?`;
    }

    // --- 2. GOOGLE GEMINI API (Smart Fallback) ---
    
    if (API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const languageNames: Record<string, string> = {
          en: 'English',
          yo: 'Yoruba',
          ig: 'Igbo',
          ha: 'Hausa',
          fr: 'French',
          ng: 'Pidgin'
        };

        // We removed the hardcoded MOCK_DATA_PLANS.
        // Instead, the AI will act as a general support agent.
        const systemPrompt = `
          You are "Swifna AI", a helpful Nigerian Telecom assistant.
          User Name: ${userContext.name}
          User Balance: ₦${userContext.balance}
          Current Language: ${languageNames[language] || 'English'}
          
          Task: Answer the user's question about VTU services (Airtime, Data, Cable TV, Electricity).
          
          Rules:
          1. Be concise and friendly.
          2. Use mild Nigerian slang (e.g., "No wahala", "Oshey") if speaking English.
          3. If the user asks for specific data plan prices, tell them to check the "Data" tab on the dashboard for the latest live rates.
          4. Do not invent fake prices.
        `;

        const result = await model.generateContent([systemPrompt, text]);
        const response = result.response;
        return response.text();

      } catch (error) {
        console.error("Gemini API Error:", error);
        // Fall through to default default if API fails
      }
    }

    // --- 3. FINAL FALLBACK ---
    return "I can help you check your balance, fund your wallet, or recommend services. What would you like to know?";
  }
};
