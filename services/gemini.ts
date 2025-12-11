import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (NO CHANGES)
// ==========================================

// ✅ YEH NAYA CODE PASTE KAREIN
const getAllKeys = () => {
  const keys: string[] = [];

  // Vite Pool Support (Browser Safe)
  if (process.env.GEMINI_KEYS_POOL) {
    const pool = process.env.GEMINI_KEYS_POOL;
    if (Array.isArray(pool)) {
      keys.push(...pool);
    } else if (typeof pool === 'string') {
      keys.push(...(pool as string).split(',').map(k => k.trim()));
    }
  }

  // Fallback
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  
  return Array.from(new Set(keys)).filter(k => !!k);
};

const keysPool = getAllKeys();

const getRandomKey = () => {
  if (keysPool.length === 0) return "MISSING_KEY";
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

// ✅ FINAL UPDATED TRIAGE FUNCTION (Best of Both Worlds)
export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const model = CHAT_MODEL_NAME;

  // 1. AAPKA ORIGINAL BADHIYA PROMPT (As it is)
  let systemInstruction = `You are a professional, empathetic Medical Triage AI assistant.
  CURRENT STATUS: Step ${step}/3.
  
  GOAL:
  1. Analyze the user's complaint.
  2. If Step < 2: Ask 1 follow-up question.
  3. If Step == 2: Provide a FINAL VERDICT.

  VERDICT RULES (CRITICAL):
  - You **MUST** specify the exact type of specialist the user should see (e.g., "Gastroenterologist", "Orthopedist", "Dermatologist", "ENT Specialist").
  - **NEVER** just say "see a doctor". You must identify the category.
  - Start the verdict with "**Verdict:**".
  
  MAP RULES (CRITICAL):
  - Use the 'googleMaps' tool to find **specific real clinics** matching that **Specific Specialist** type nearby.
  - **Output 3 Distinct Options.**
  - **Strict Output Format:** You must output links exactly like this:
    * [Clinic Name](http://googleusercontent.com/maps.google.com/search?q=Clinic+Name+City)
  - Do NOT use internal tool links like 'googleMaps/search'. Use full HTTPS links.

  FORMATTING:
  - Use Markdown for bolding (**Verdict**).
  - Keep response short.
  `;

  if (step >= 2) {
    systemInstruction += " Find 3 specific real doctors nearby using Google Maps.";
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
    
    // --- 2. SMART MAP EXTRACTION (UPDATED LOGIC) ---
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let groundingUrls = mapChunks
      .map((c: any) => {
        if (c.maps?.uri) return { title: c.maps.title || "Medical Center", uri: c.maps.uri, source: "Google Maps" };
        if (c.web?.uri && c.web.uri.includes('google.com/maps')) return { title: c.web.title || "Doctor Location", uri: c.web.uri, source: "Google Maps" };
        return null;
      })
      .filter(item => item !== null);

    const lines = text.split('\n');
    const cleanLines: string[] = [];
    
    // ⚡ NEW REGEX: Yeh ab kisi bhi tarah ka link pakad lega (sirf https nahi)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;

    lines.forEach(line => {
        const match = line.match(linkRegex);
        if (match) {
            const title = match[1].replace(/\*/g, '').trim();
            let url = match[2];

            // 🛠️ AUTO-FIX: Agar AI "googleMaps/search" ya broken link deta hai, toh usse fix karo
            if (!url.startsWith('http') || url.includes('search?q') || url.includes('googleMaps/')) {
                // Title (Clinic Name) use karke clean URL banao
                const query = encodeURIComponent(title + " near me");
                url = `http://googleusercontent.com/maps.google.com/search?q=${query}`;
            }

            groundingUrls.push({ title: title, uri: url, source: "Google Maps" });
        } else {
            cleanLines.push(line);
        }
    });
    
    // 3. SMART FALLBACK: Agar phir bhi kuch na mile, toh specialist ke naam se search karo
    if (step === 2 && groundingUrls.length === 0) {
        const specialistMatch = text.match(/(Gastroenterologist|Orthopedist|Dermatologist|Cardiologist|Neurologist|Pediatrician|ENT|Dentist|Doctor)/i);
        const searchTerm = specialistMatch ? specialistMatch[0] : "Specialist Doctor";
        
        groundingUrls.push({ 
            title: `Find ${searchTerm} Nearby`, 
            uri: `http://googleusercontent.com/maps.google.com/search?q=${encodeURIComponent(searchTerm)}+near+me`, 
            source: "Google Maps" 
        });
    }

    // Duplicate links hatao
    const uniqueUrls = groundingUrls.filter((v,i,a)=>a.findIndex(t=>(t.uri === v.uri))===i);

    return { text: cleanLines.join('\n').trim(), groundingUrls: uniqueUrls };

  } catch (error) { 
      console.error(error);
      return { text: "Network error. Please consult a doctor directly.", groundingUrls: [] };
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
