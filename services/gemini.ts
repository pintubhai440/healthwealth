import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// CLIENT SETUP
// ==========================================

// Client 1: Chatbot & General Use (Purani Key) -> Uses Gemini 2.5 Flash
const apiKey1 = process.env.API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey1 });

// Client 2: MediScanner (Nayi Key) -> Uses Gemini 2.5 Pro
// Note: Agar API_KEY_2 set nahi hai, to ye fallback karke purani key use karega
const apiKey2 = process.env.API_KEY_2 || apiKey1;
const aiScanner = new GoogleGenAI({ apiKey: apiKey2 });

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// JSON Response ko saaf karne ke liye (Markdown hatata hai)
const cleanJSON = (text: string) => {
  if (!text) return {};
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    // Return empty object or error flag instead of crashing
    return { error: "Failed to parse AI response." };
  }
};

// ==========================================
// 1. TRIAGE CHAT (Uses Gemini 2.5 Flash)
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  // Aapki request ke hisaab se 2.5 Flash set kiya hai
  const model = 'gemini-2.5-flash';
  
  let systemInstruction = `You are a Smart Triage Doctor (AI). 
  Goal: Diagnose the user's condition quickly using exactly 2 follow-up questions total, then provide a verdict.
  Current Step: ${step} (0-indexed).
  Protocol:
  1. Analyze the user's complaint.
  2. If Step < 2: Ask ONE concise question.
  3. If Step == 2: Provide a FINAL VERDICT.`;

  if (step >= 2) {
    systemInstruction += " You have access to Google Maps to find a relevant doctor nearby if location is provided.";
  }

  const tools: any[] = [];
  const toolConfig: any = {};

  if (step >= 2 && userLocation) {
    tools.push({ googleMaps: {} });
    toolConfig.retrievalConfig = {
      latLng: { latitude: userLocation.lat, longitude: userLocation.lng }
    };
  }

  const cleanHistory = history
    .filter(h => h.role === 'user' || h.role === 'model')
    .map(h => ({ role: h.role, parts: [{ text: h.text }] }));

  try {
    // Uses 'ai' client (First Key)
    const response = await ai.models.generateContent({
      model,
      contents: [
        ...cleanHistory,
        { role: 'user', parts: [{ text: currentInput }] }
      ],
      config: {
        systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        toolConfig: tools.length > 0 ? toolConfig : undefined,
      }
    });
    
    const text = response.text || "I couldn't generate a response.";
    
    // Maps Grounding
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingUrls = mapChunks
      .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets || [])
      .map((s: any) => ({ title: s.title || 'Map Link', uri: s.uri || '#' }))
      .concat(mapChunks.filter(c => c.maps?.uri).map(c => ({ title: c.maps?.title || 'Map Location', uri: c.maps?.uri })));

    return { text, groundingUrls };

  } catch (error) {
    console.error(`Triage Error with model ${model}:`, error);
    throw error;
  }
};

// ==========================================
// 2. AUDIO TRANSCRIPTION (Uses Gemini 2.5 Flash)
// ==========================================

export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
  const model = 'gemini-2.5-flash';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Transcribe this audio. Return only the transcription text." }
        ]
      }
    });
    return response.text?.trim() || "";
  } catch (e) {
    console.error("Transcription failed", e);
    return "";
  }
};

// ==========================================
// 3. TEXT TO SPEECH (Standard Model)
// ==========================================

export const generateTTS = async (text: string) => {
  // TTS ke liye 2.0 Flash Exp best hai, 2.5 shayad TTS support na kare abhi
  const model = 'gemini-2.0-flash-exp'; 
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    console.error("TTS failed", e);
    return null;
  }
};

// ==========================================
// 4. IMAGE ANALYSIS (Uses Gemini 2.5 Pro + NEW KEY)
// ==========================================

export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM'
) => {
  // Aapki request ke hisaab se 2.5 Pro set kiya hai
  const model = 'gemini-2.5-pro'; 
  
  let prompt = "";
  if (type === 'MEDICINE') {
    prompt = "Identify this medicine. Return a JSON object (no markdown) with fields: name, purpose, and dosage_warning (string).";
  } else {
    prompt = `Analyze this skin condition. Warning: Educational purpose only. 
    Return a JSON object (no markdown) with: 
    - condition_name (string)
    - verdict (enum: 'Good', 'Bad', 'Very Bad')
    - explanation (string)
    - recommended_action (string)`;
  }

  try {
    // Uses 'aiScanner' client (Second Key)
    const response = await aiScanner.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    return cleanJSON(response.text || "{}");
  } catch (error) {
    console.error("MediScanner Error:", error);
    // Fallback error message for UI
    return { error: "Failed to analyze image. Ensure API Key allows this model." };
  }
};

// ==========================================
// 5. VIDEO ANALYSIS (Uses Gemini 2.5 Flash + NEW KEY)
// ==========================================

export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  const model = 'gemini-2.5-flash';
  
  const prompt = `Analyze this video for the Guardian Alert System.
  Task: Verify if the person actually puts a pill in their mouth and swallows it.
  Return JSON: { "action_detected": "string", "success": boolean, "verdict_message": "string" }`;

  try {
    // Uses 'aiScanner' client (Second Key)
    const response = await aiScanner.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    return cleanJSON(response.text || "{}");
  } catch (error) {
    console.error("Video Analysis Error:", error);
    return { error: "Failed to analyze video." };
  }
};

// ==========================================
// 6. DIET PLAN (Uses Gemini 2.5 Flash)
// ==========================================

export const generateDietPlan = async (condition: string) => {
  const model = 'gemini-2.5-flash';
  const prompt = `Create a 1-day simple recovery diet plan for: ${condition}. Return JSON...`;
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Could not generate diet plan." };
  }
};

export { ai };
