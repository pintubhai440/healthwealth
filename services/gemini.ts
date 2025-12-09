import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (THE HACK) 🛠️
// ==========================================

// Get the pool of keys from vite.config.ts
const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];

if (keysPool.length === 0) {
  console.error("No API Keys found! Please check Vercel Env Variables.");
} else {
  console.log(`Loaded ${keysPool.length} API Keys for rotation.`);
}

// Helper: Pick a random key and return a FRESH client
const getGenAIClient = () => {
  const randomKey = keysPool[Math.floor(Math.random() * keysPool.length)];
  return new GoogleGenAI({ apiKey: randomKey });
};

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

// Model Name
const MODEL_NAME = 'gemini-2.5-flash-lite'; 

// ==========================================
// 2. TRIAGE CHAT
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const model = MODEL_NAME;
  
  // Get a fresh client with a random key
  const client = getGenAIClient();

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
    const response = await client.models.generateContent({
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
        if (c.maps?.uri) {
           return { title: c.maps.title || "Medical Center", uri: c.maps.uri, source: "Google Maps" };
        }
        if (c.web?.uri && c.web.uri.includes('google.com/maps')) {
           return { title: c.web.title || "Doctor Location", uri: c.web.uri, source: "Google Maps" };
        }
        return null;
      })
      .filter(item => item !== null);

    if (groundingUrls.length === 0) {
        const snippets = mapChunks
            .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets || [])
            .map((s: any) => ({ title: s.title || 'Map Link', uri: s.uri || '#' }));
        groundingUrls.push(...snippets);
    }

    return { text, groundingUrls };

  } catch (error) {
    console.error("Triage Error (Retrying might help):", error);
    throw error;
  }
};

// ==========================================
// 3. AUDIO TRANSCRIPTION
// ==========================================

export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
  try {
    const client = getGenAIClient();
    const response = await client.models.generateContent({
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
// 4. TEXT TO SPEECH
// ==========================================

export const generateTTS = async (text: string) => {
  try {
    const client = getGenAIClient();
    const response = await client.models.generateContent({
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
// 5. IMAGE ANALYSIS (MediScanner)
// ==========================================

export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM'
) => {
  const model = MODEL_NAME; 
  const client = getGenAIClient();
  
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
    const response = await client.models.generateContent({
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
// 6. VIDEO ANALYSIS
// ==========================================

export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  const client = getGenAIClient();
  const prompt = `Analyze this video for the Guardian Alert System.
  Task: Verify if the person actually puts a pill in their mouth and swallows it.
  Return JSON: { "action_detected": "string", "success": boolean, "verdict_message": "string" }`;

  try {
    const response = await client.models.generateContent({
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
// 7. DIET PLAN
// ==========================================

export const generateDietPlan = async (condition: string) => {
  const client = getGenAIClient();
  const prompt = `Create a 1-day simple recovery diet plan for: ${condition}. Return JSON...`;
  
  try {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Could not generate diet plan." };
  }
};

// Export one instance just for types/legacy if needed, but prefer internal usage
export const ai = getGenAIClient();
