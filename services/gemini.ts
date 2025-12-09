import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// CLIENT SETUP
// ==========================================

// Client 1: First Key
const apiKey1 = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey1) console.error("API_KEY is missing! Check Vercel Env Variables.");
const ai = new GoogleGenAI({ apiKey: apiKey1 });

// Client 2: Second Key (Try to use this primarily for Lite model)
const apiKey2 = process.env.API_KEY_2 || apiKey1;
const aiScanner = new GoogleGenAI({ apiKey: apiKey2 });

// Helper to clean JSON
const cleanJSON = (text: string) => {
  if (!text) return {};
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return { error: "AI response format error." };
  }
};

// 👇 SOLUTION: Using 'Lite' model. 
// Ye model stable hai aur iska quota main models se alag hota hai.
const MODEL_NAME = 'gemini-2.5-flash-lite'; 

// ==========================================
// 1. TRIAGE CHAT
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const model = MODEL_NAME;
  
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
    // Uses Scanner Client (Key 2) for better luck with quota
    const response = await aiScanner.models.generateContent({
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
    
    // Improved Grounding Extraction
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const groundingUrls = mapChunks
      .map((c: any) => {
        // Priority 1: Direct Map URI
        if (c.maps?.uri) {
           return { 
             title: c.maps.title || "Medical Center", 
             uri: c.maps.uri,
             source: "Google Maps"
           };
        }
        // Priority 2: Web URI that looks like a map
        if (c.web?.uri && c.web.uri.includes('google.com/maps')) {
           return {
             title: c.web.title || "Doctor Location",
             uri: c.web.uri,
             source: "Google Maps"
           };
        }
        return null;
      })
      .filter(item => item !== null); // Remove nulls

    // Fallback if the previous code's method was working better for specific snippets
    if (groundingUrls.length === 0) {
        const snippets = mapChunks
            .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets || [])
            .map((s: any) => ({ title: s.title || 'Map Link', uri: s.uri || '#' }));
        groundingUrls.push(...snippets);
    }

    return { text, groundingUrls };

  } catch (error) {
    console.error("Triage Error:", error);
    throw error;
  }
};

// ==========================================
// 2. AUDIO TRANSCRIPTION
// ==========================================

export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
  try {
    const response = await aiScanner.models.generateContent({
      model: MODEL_NAME,
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
// 3. TEXT TO SPEECH
// ==========================================

export const generateTTS = async (text: string) => {
  try {
    // Lite models generally don't support TTS directly, trying Flash TTS
    // Using apiKey1 (older key) for this specific task
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-tts', 
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
// 4. IMAGE ANALYSIS (MediScanner)
// ==========================================

export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM'
) => {
  // Using Flash-Lite for images
  const model = MODEL_NAME; 
  
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
  } catch (error: any) {
    console.error("MediScanner Error:", error);
    return { error: `AI Error: Please try again. (${error.message || 'Quota Exceeded'})` };
  }
};

// ==========================================
// 5. VIDEO ANALYSIS
// ==========================================

export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  const prompt = `Analyze this video for the Guardian Alert System.
  Task: Verify if the person actually puts a pill in their mouth and swallows it.
  Return JSON: { "action_detected": "string", "success": boolean, "verdict_message": "string" }`;

  try {
    const response = await aiScanner.models.generateContent({
      model: MODEL_NAME,
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
// 6. DIET PLAN
// ==========================================

export const generateDietPlan = async (condition: string) => {
  const prompt = `Create a 1-day simple recovery diet plan for: ${condition}. Return JSON...`;
  
  try {
    const response = await aiScanner.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Could not generate diet plan." };
  }
};

export { ai };
