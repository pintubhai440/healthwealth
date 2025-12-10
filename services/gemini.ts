import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (THE HACK 🛠️)
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
// 2. TRIAGE CHAT (FIXED PROMPT HERE ✅)
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const model = CHAT_MODEL_NAME;

  // 🔥 FIXED SYSTEM INSTRUCTION: Added "Hidden Thought" rules
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
    
    // Extract Maps Data
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

    // Smart Fallback
    if (step === 2 && groundingUrls.length < 3) {
       let doctorType = "Doctor";
       if (text.toLowerCase().includes("dermatologist")) doctorType = "Dermatologist";
       
       const needed = 3 - groundingUrls.length;
       for(let i=0; i<needed; i++) {
          groundingUrls.push({ title: `Nearby ${doctorType}`, uri: `http://googleusercontent.com/maps.google.com/search?q=${doctorType}+near+me`, source: "Google Maps" });
       }
    }

    return { text, groundingUrls };

  } catch (error) { throw error; }
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
// 6. DIET PLAN (FIXED PROMPT)
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
// 7. YOUTUBE VIDEO FINDER (MULTIPLE VIDEOS) 🔥
// ==========================================
export const findYoutubeVideos = async (query: string, count: number = 5) => {
  const prompt = `Find ${count} popular, relevant YouTube videos for: "${query}" (Yoga/Exercise tutorial). 
  Return ONLY a JSON array of video IDs. Example: ["dQw4w9WgXcQ", "abc123def45", "xyz789pqr01"]
  Do NOT return markdown, explanation, or URLs. Just the array.`;

  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, { 
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const text = response.text?.trim() || "";
    let videoIds: string[] = [];
    
    try {
      // Try to parse JSON
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed)) {
        videoIds = parsed.slice(0, count);
      }
    } catch {
      // Fallback: extract any 11-character video IDs from text
      const idRegex = /[a-zA-Z0-9_-]{11}/g;
      const matches = text.match(idRegex) || [];
      videoIds = matches.slice(0, count);
    }
    
    // Ensure we have unique IDs
    videoIds = [...new Set(videoIds)].filter(id => id.length === 11);
    
    // If we still don't have enough, add fallbacks for common searches
    if (videoIds.length < count) {
      const fallbackIds: Record<string, string[]> = {
        'surya namaskar': ['_PjX0Fh6PQQ', 'QZ4H2Q2N_7w', 'zT-9hVK6pVM', 'iC5Qk0DIFv4', 'L1qKqQ8Q1vU'],
        'yoga': ['v7AYKMP6rOE', 'pWak2F3hP0E', 'sTANio_2E0Q', '4pKly2JojMw', 'AbRlL5M1QJs'],
        'exercise': ['IODxDxX7oi4', 'mlVetheEU0k', 'cD8SbLCp3Fw', 'Q6d4wj5Q5vI', 'WIH0-XB5-6I'],
        'pushup': ['IODxDxX7oi4', 'Eh00_rniF8E', 't1jG2qK1-7k', 'oocF7g5W6xg', 'qy2Pc8j8H-g'],
        'squat': ['aclHkVaku9U', 'YaXPRqUwItQ', 'QmYjQ5y4-1E', 'U3HlEF_E9fY', 'bEv6CCg2BC8'],
        'back pain': ['9OG6pVZ9Toc', '2LUdn9-mf6s', '9bR-elyulBw', 'iC5Qk0DIFv4', 'QZ4H2Q2N_7w']
      };
      
      const lowerQuery = query.toLowerCase();
      for (const [key, ids] of Object.entries(fallbackIds)) {
        if (lowerQuery.includes(key) && videoIds.length < count) {
          // Add only new IDs
          ids.forEach(id => {
            if (!videoIds.includes(id) && videoIds.length < count) {
              videoIds.push(id);
            }
          });
          break;
        }
      }
    }
    
    return videoIds.slice(0, count);
  } catch (error) {
    console.error("YouTube search error:", error);
    return [];
  }
};

// ==========================================
// 8. EXERCISE FORM ANALYSIS
// ==========================================
export const analyzeExerciseForm = async (base64Image: string, exercise: string) => {
  const prompt = `Analyze this person doing ${exercise}. Give feedback on:
  1. Form correctness (score 1-10)
  2. Key improvements needed
  3. Safety tips
  Return JSON: {score: number, feedback: string, tips: string[]}`;
  
  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        { text: prompt }
      ]},
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e: any) {
    return { score: 0, feedback: "Analysis failed. Please try again.", tips: ["Ensure good lighting", "Show full body"] };
  }
};

// ==========================================
// 9. BACKWARD COMPATIBILITY
// ==========================================
export const findYoutubeVideo = async (query: string) => {
  const videos = await findYoutubeVideos(query, 1);
  return videos[0] || null;
};

// Helper function needed for Triage
const getGenAIClient = () => {
    const apiKey = getRandomKey();
    return new GoogleGenAI({ apiKey });
};

export const ai = getGenAIClient();

// Export all functions
export {
  runTriageTurn,
  transcribeUserAudio,
  generateTTS,
  analyzeImage,
  analyzeMedicineVideo,
  generateDietPlan,
  findYoutubeVideo,
  findYoutubeVideos,
  analyzeExerciseForm,
  ai
};
