import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (THE HACK 🛠️)
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

// Model Name (Jaisa tumne kaha, SAME rakha hai)
const MODEL_NAME = 'gemini-2.5-flash-lite'; 

// ==========================================
// 2. TRIAGE CHAT (UPDATED FOR CARDS FIX 🃏)
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
  3. If Step == 2: Provide a FINAL VERDICT.
  
  IMPORTANT FOR STEP 2:
  - You MUST recommend a specific type of doctor (e.g., Dermatologist, General Physician).
  - You MUST use the 'googleMaps' tool to find real clinics near the user's location.
  - **DO NOT** write the address or links in your text response.
  - Just say: "I recommend seeing a [Doctor Type]. Here are some nearby options:" and let the system show the cards.
  `;

  if (step >= 2) {
    systemInstruction += " You have access to Google Maps. USE IT to find a relevant doctor nearby.";
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
    
    let text = response.text || "I couldn't generate a response.";
    
    // 1. Try Standard Grounding Extraction (Jo Google khud deta hai)
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let groundingUrls = mapChunks
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

    // 2. FALLBACK: Markdown Link Parser (THE CLEANER 🧹)
    // Agar AI ne galti se text mein links likh diye, toh unhe yahan pakad lo
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/www\.google\.com\/maps[^)]+)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(text)) !== null) {
        groundingUrls.push({
            title: match[1].replace(/^\*\*|\*\*$/g, ''), // Remove bolding
            uri: match[2],
            source: "Google Maps"
        });
    }

    // 3. Clean the text (Text mein se wo links hata do taaki safayi rahe)
    if (groundingUrls.length > 0) {
        text = text.replace(markdownLinkRegex, '').replace(/\*\s*-\s*$/gm, '').trim(); 
    }

    // 4. Final Fallback (Agar kuch bhi na mile toh search link bana do)
    if (groundingUrls.length === 0 && step === 2) {
       groundingUrls.push({
         title: "Find Nearby Specialists",
         uri: `https://www.google.com/maps/search/doctor+near+me`,
         source: "Google Maps"
       });
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
    // MODEL NAME SAME RAKHA HAI JAISA TUMNE KAHA
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts', 
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

// Default export
export const ai = getGenAIClient();
