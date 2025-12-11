import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (NO CHANGES)
// ==========================================

const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];

if (keysPool.length === 0) {
  console.warn("⚠️ Warning: No API Keys found. Using fallback.");
} else {
  console.log(`✅ Loaded ${keysPool.length} API Keys for rotation.`);
}

const getRandomKey = () => {
  if (keysPool.length === 0) return process.env.GEMINI_API_KEY || process.env.API_KEY || "MISSING_KEY";
  return keysPool[Math.floor(Math.random() * keysPool.length)];
};

const generateContentWithRetry = async (modelName: string, params: any, retries = 3) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const apiKey = getRandomKey();
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({ model: modelName, ...params });
      return response; 
    } catch (error: any) {
      lastError = error;
      if (error.status === 429 || error.status === 503 || error.message?.includes('429')) {
         continue; 
      }
      throw error; 
    }
  }
  throw lastError; 
};

const cleanJSON = (text: string) => {
  if (!text) return {};
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return { error: "AI format error." };
  }
};

const CHAT_MODEL_NAME = 'gemini-2.5-flash-lite'; 

// ==========================================
// 2. TRIAGE CHAT (RESTORED ORIGINAL LOGIC ✅)
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const model = CHAT_MODEL_NAME;

  let systemInstruction = `You are a professional, empathetic Medical Triage AI assistant.
  CURRENT INTERNAL STATUS (DO NOT REVEAL TO USER):
  - Current Step: ${step}/3
  
  YOUR GOAL:
  1. Analyze the user's complaint.
  2. If Step < 2: Ask ONE concise, relevant follow-up question to clarify symptoms. Do NOT list protocols.
  3. If Step == 2: Provide a specific VERDICT (e.g., "Likely Migraine", "Possible Infection") and recommend a doctor type.

  CRITICAL RULES:
  - **NEVER** output the text "Step:", "Protocol:", or "Analyze complaint." to the user.
  - Speak naturally like a caring human doctor.
  - Keep responses short (under 50 words unless giving a verdict).
  
  MAPPING INSTRUCTIONS (Only for Step 2):
  - When recommending a doctor (e.g., Dermatologist), imply you are checking nearby.
  - You MUST generate exactly 3 distinct location options using the 'googleMaps' tool if available.
  `;

  if (step >= 2) {
    systemInstruction += " Use Google Maps to find 3 real locations.";
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
    const response = await generateContentWithRetry(model, {
      contents: [...cleanHistory, { role: 'user', parts: [{ text: currentInput }] }],
      config: { systemInstruction, tools: tools.length > 0 ? tools : undefined, toolConfig: tools.length > 0 ? toolConfig : undefined }
    });
    
    let text = response.text || "I couldn't generate a response.";
    
    // --- MAPS EXTRACTION LOGIC (This was missing/broken before) ---
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let groundingUrls = mapChunks
      .map((c: any) => {
        if (c.maps?.uri) return { title: c.maps.title || "Medical Center", uri: c.maps.uri, source: "Google Maps" };
        if (c.web?.uri && c.web.uri.includes('maps.google.com')) return { title: c.web.title || "Doctor Location", uri: c.web.uri, source: "Google Maps" };
        return null;
      })
      .filter(item => item !== null);

    // Cleaner Logic
    const lines = text.split('\n');
    const cleanLines: string[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?google\.com\/maps[^)]+)\)/;
    const bareLinkRegex = /(https?:\/\/(?:www\.)?google\.com\/maps\S+)/;

    lines.forEach(line => {
        const markdownMatch = line.match(linkRegex);
        const bareMatch = line.match(bareLinkRegex);
        if (markdownMatch) {
            groundingUrls.push({ title: markdownMatch[1].replace(/\*/g, '').trim(), uri: markdownMatch[2], source: "Google Maps" });
        } else if (bareMatch) {
            const nameMatch = line.match(/\*\*([^*]+)\*\*/); 
            groundingUrls.push({ title: nameMatch ? nameMatch[1] : "View Location", uri: bareMatch[1], source: "Google Maps" });
        } else {
            cleanLines.push(line);
        }
    });
    text = cleanLines.join('\n').trim();

    // Fallback if AI fails to give maps but we are on Step 2
    if (step === 2 && groundingUrls.length === 0) {
       groundingUrls.push({ title: "Search Nearby Doctors", uri: "https://www.google.com/maps/search/doctors+near+me", source: "Google Maps" });
    }

    return { text, groundingUrls };

  } catch (error) { 
      // Return safe error so app doesn't crash
      console.error(error);
      return { text: "I'm having trouble connecting to the network, but you should see a doctor immediately.", groundingUrls: [] };
  }
};

// ==========================================
// 3. AUDIO TRANSCRIPTION
// ==========================================
export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Transcribe audio." }] }
    });
    return response.text?.trim() || "";
  } catch (e) { return ""; }
};

// ==========================================
// 4. TEXT TO SPEECH
// ==========================================
export const generateTTS = async (text: string) => {
  try {
    const response = await generateContentWithRetry('gemini-2.5-flash-preview-tts', {
      contents: { parts: [{ text }] },
      config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) { return null; }
};

// ==========================================
// 5. IMAGE & VIDEO ANALYSIS
// ==========================================
export const analyzeImage = async (base64Data: string, mimeType: string, type: 'MEDICINE' | 'DERM') => {
  const prompt = type === 'MEDICINE' ? "Identify medicine. Return JSON: {name, purpose, dosage_warning}." : "Analyze skin. Return JSON: {condition_name, verdict, explanation, recommended_action}.";
  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e: any) { return { error: `AI Error: ${e.message}` }; }
};

export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Verify pill intake. Return JSON: {action_detected, success: boolean, verdict_message}" }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e) { return { error: "Failed to analyze video." }; }
};

// ==========================================
// 6. DIET PLAN
// ==========================================
export const generateDietPlan = async (condition: string) => {
  const prompt = `You are a Nutritionist. Create a recovery diet plan for: ${condition}.
  RETURN ONLY PURE JSON with this exact structure (no markdown):
  {
    "advice": "Short professional advice string",
    "meals": [
      { "name": "Breakfast", "items": ["Item 1", "Item 2"] },
      { "name": "Lunch", "items": ["Item 1", "Item 2"] },
      { "name": "Dinner", "items": ["Item 1", "Item 2"] }
    ],
    "youtube_queries": ["Yoga for ${condition}", "Exercise for ${condition}"]
  }`;
  
  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Could not generate diet plan." };
  }
};

// ==========================================
// 7. YOUTUBE VIDEO FINDER (UPDATED - SAFE SEARCH)
// ==========================================
export const findYoutubeVideo = async (query: string) => {
  // Returns Array of 3 search terms instead of broken IDs
  const prompt = `Generate 3 distinct, specific YouTube search queries for: "${query}".
  RETURN ONLY PURE JSON ARRAY:
  [
    { "title": "Beginner Yoga for Back Pain", "search_term": "Yoga for Back Pain relief exercises" },
    { "title": "10 Min Relief Workout", "search_term": "10 min back pain relief workout" },
    { "title": "Physiotherapy Tips", "search_term": "Physiotherapy exercises for back pain" }
  ]`;

  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, { 
      contents: prompt,
      config: { responseMimeType: "application/json" } 
    });
    const data = cleanJSON(response.text || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

// ==========================================
// 8. AI COACH EXERCISE ANALYZER (ADDED ✅)
// ==========================================
export const analyzeExerciseVideo = async (base64Data: string, mimeType: string, ailment: string, exercise: string) => {
  const prompt = `You are an expert Physiotherapist AI. 
  The user has "${ailment}" and is performing "${exercise}".
  Analyze the video for form, safety, and correctness.
  
  RETURN PURE JSON:
  {
    "score": "Integer 1-10",
    "feedback": "Short summary of their form.",
    "tips": ["Tip 1", "Tip 2", "Tip 3 to improve"]
  }`;

  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e) {
    return { error: "Failed to analyze exercise." };
  }
};

// Helper function needed for Triage (Strictly needed by some legacy imports)
export const ai = new GoogleGenAI({ apiKey: getRandomKey() });
