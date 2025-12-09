import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (THE HACK 🛠️)
// ==========================================

const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];

if (keysPool.length === 0) {
  console.warn("⚠️ Warning: No API Keys found in Pool. Using fallback/single key if available.");
} else {
  console.log(`✅ Loaded ${keysPool.length} API Keys for rotation.`);
}

const getGenAIClient = () => {
  if (keysPool.length === 0) {
     const fallbackKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
     if (!fallbackKey) console.error("❌ CRITICAL: No API Key found anywhere!");
     return new GoogleGenAI({ apiKey: fallbackKey || "MISSING_KEY" });
  }
  const randomKey = keysPool[Math.floor(Math.random() * keysPool.length)];
  return new GoogleGenAI({ apiKey: randomKey });
};

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

const CHAT_MODEL_NAME = 'gemini-2.5-flash-lite'; 

// ==========================================
// 2. TRIAGE CHAT
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const model = CHAT_MODEL_NAME;
  const client = getGenAIClient();

  let systemInstruction = `You are a Smart Triage Doctor (AI). 
  Current Step: ${step} (0-indexed).
  Protocol:
  1. Analyze user's complaint.
  2. If Step < 2: Ask ONE concise question.
  3. If Step == 2: Provide a FINAL VERDICT.
  
  IMPORTANT FOR STEP 2 (VERDICT):
  - You MUST recommend a specific doctor type (e.g., Neurologist, ENT).
  - **MANDATORY:** You MUST find **EXACTLY 3 DISTINCT** nearby clinics/doctors using Google Maps.
  - Just say: "I recommend seeing a [Doctor Type]. Here are 3 nearby options:" and STOP. 
  `;

  if (step >= 2) {
    systemInstruction += " You have access to Google Maps. USE IT.";
  }

  const tools: any[] = [];
  const toolConfig: any = {};

  if (step >= 2 && userLocation) {
    tools.push({ googleMaps: {} });
    toolConfig.retrievalConfig = {
      latLng: { latitude: userLocation.lat, longitude: userLocation.lng }
    };
  }

  const cleanHistory = history.map(h => ({ role: h.role, parts: [{ text: h.text }] }));

  try {
    const response = await client.models.generateContent({
      model,
      contents: [...cleanHistory, { role: 'user', parts: [{ text: currentInput }] }],
      config: { systemInstruction, tools: tools.length > 0 ? tools : undefined, toolConfig: tools.length > 0 ? toolConfig : undefined }
    });
    
    let text = response.text || "I couldn't generate a response.";
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let groundingUrls = mapChunks.map((c: any) => {
        if (c.maps?.uri) return { title: c.maps.title || "Medical Center", uri: c.maps.uri, source: "Google Maps" };
        if (c.web?.uri?.includes('maps.google.com')) return { title: c.web.title || "Location", uri: c.web.uri, source: "Google Maps" };
        return null;
    }).filter(i => i);

    const lines = text.split('\n');
    const cleanLines: string[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?google\.com\/maps[^)]+)\)/;
    const bareLinkRegex = /(https?:\/\/(?:www\.)?google\.com\/maps\S+)/;

    lines.forEach(line => {
        const markdownMatch = line.match(linkRegex);
        const bareMatch = line.match(bareLinkRegex);
        if (markdownMatch) {
            groundingUrls.push({ title: markdownMatch[1].replace(/^\*\*|\*\*$/g, '').trim(), uri: markdownMatch[2], source: "Google Maps" });
        } else if (bareMatch) {
            const nameMatch = line.match(/\*\*([^*]+)\*\*/); 
            groundingUrls.push({ title: nameMatch ? nameMatch[1] : "View Location", uri: bareMatch[1], source: "Google Maps" });
        } else {
            cleanLines.push(line);
        }
    });
    text = cleanLines.join('\n').trim();

    if (groundingUrls.length === 0 && step === 2) {
       groundingUrls.push(
         { title: "Nearby Specialist 1", uri: `http://googleusercontent.com/maps.google.com/search?q=Doctor+Near+Me`, source: "Google Maps" },
         { title: "Nearby Specialist 2", uri: `http://googleusercontent.com/maps.google.com/search?q=Clinic+Near+Me`, source: "Google Maps" },
         { title: "Nearby Specialist 3", uri: `http://googleusercontent.com/maps.google.com/search?q=Hospital+Near+Me`, source: "Google Maps" }
       );
    }
    return { text, groundingUrls };
  } catch (error) { throw error; }
};

// ==========================================
// 3. AUDIO TRANSCRIPTION
// ==========================================
export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
  try {
    const client = getGenAIClient();
    const response = await client.models.generateContent({
      model: CHAT_MODEL_NAME,
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Transcribe this audio." }] }
    });
    return response.text?.trim() || "";
  } catch (e) { return ""; }
};

// ==========================================
// 4. TEXT TO SPEECH
// ==========================================
export const generateTTS = async (text: string) => {
  try {
    const client = getGenAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts', 
      contents: { parts: [{ text }] },
      config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) { return null; }
};

// ==========================================
// 5. IMAGE ANALYSIS
// ==========================================
export const analyzeImage = async (base64Data: string, mimeType: string, type: 'MEDICINE' | 'DERM') => {
  const model = CHAT_MODEL_NAME; 
  const client = getGenAIClient();
  const prompt = type === 'MEDICINE' ? "Identify medicine. Return JSON: {name, purpose, dosage_warning}." : "Analyze skin. Return JSON: {condition_name, verdict, explanation, recommended_action}.";
  try {
    const response = await client.models.generateContent({
      model,
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e: any) { return { error: `AI Error: ${e.message}` }; }
};

// ==========================================
// 6. VIDEO ANALYSIS
// ==========================================
export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  const client = getGenAIClient();
  try {
    const response = await client.models.generateContent({
      model: CHAT_MODEL_NAME,
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Verify pill intake. Return JSON: {action_detected, success: boolean, verdict_message}" }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e) { return { error: "Failed to analyze video." }; }
};

// ==========================================
// 7. DIET PLAN (UPDATED PROMPT ✅)
// ==========================================
export const generateDietPlan = async (condition: string) => {
  const client = getGenAIClient();
  // FIXED PROMPT: Enforcing valid JSON structure
  const prompt = `You are a Nutritionist. Create a recovery diet plan for: ${condition}.
  RETURN ONLY PURE JSON with this exact structure (no markdown):
  {
    "advice": "Short professional advice string",
    "meals": [
      { "name": "Breakfast", "items": ["Item 1", "Item 2"] },
      { "name": "Lunch", "items": ["Item 1", "Item 2"] },
      { "name": "Dinner", "items": ["Item 1", "Item 2"] }
    ]
  }`;
  
  try {
    const response = await client.models.generateContent({
      model: CHAT_MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Could not generate diet plan." };
  }
};

export const ai = getGenAIClient();
