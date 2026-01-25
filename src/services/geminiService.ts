
import { GoogleGenAI } from "@google/genai";
import { MOCK_DATA_PLANS } from "../constants";
import { Language } from "../types";

export const getGeminiRecommendation = async (userQuery: string, language: Language = 'en'): Promise<string> => {
  // Correctly initialize GoogleGenAI with the API key from environment variables as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const languageNames: Record<Language, string> = {
    en: 'English',
    yo: 'Yoruba',
    ig: 'Igbo',
    ha: 'Hausa',
    fr: 'French'
  };

  const systemPrompt = `
    You are an expert Nigerian Telecom assistant called "NaijaConnect AI".
    Your job is to recommend data plans or airtime advice based on the provided plans.
    
    Current available data plans (JSON):
    ${JSON.stringify(MOCK_DATA_PLANS)}
    
    IMPORTANT: You must respond in the ${languageNames[language]} language.
    
    Rules:
    1. Be friendly and helpful. 
    2. If language is English, you can use mild Nigerian slang like "Beta" or "Oshey", but NEVER use the word "abeg".
    3. Always mention the price (₦) and the specific carrier.
    4. If the user asks for a budget (e.g., "I have 500 Naira"), suggest 2-3 of the best options if multiple exist.
    5. Try to use the EXACT name of the plans (e.g., "Monthly 10GB") so the system can identify them.
    6. Keep responses concise. If recommending multiple, list them clearly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userQuery,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    // Use .text property directly as per GenAI SDK guidelines
    return response.text || "Error processing request.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Something went wrong with the connection.";
  }
};
