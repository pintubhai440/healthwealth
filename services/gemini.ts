import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. KEY ROTATION LOGIC (THE HACK 🛠️)
// ==========================================

const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];

if (keysPool.length === 0) {
  console.error("No API Keys found! Please check Vercel Env Variables.");
} else {
  console.log(`Loaded ${keysPool.length} API Keys for rotation.`);
}

const getGenAIClient = () => {
  // Agar pool khali hai toh crash mat hone do
  if (keysPool.length === 0) return new GoogleGenAI({ apiKey: "MISSING_KEY" });
  
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
// 2. TRIAGE CHAT (AGGRESSIVE CLEANER ADDED 🧹)
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
  - You MUST recommend a specific doctor type.
  - You MUST use the 'googleMaps' tool to find real clinics.
  - **DO NOT** output the doctor list in Markdown. 
  - Just say "I recommend seeing a [Doctor Type]. Here are some nearby options:" and STOP. Let the system handle the display.
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
    
    // 1. Standard Google Maps Grounding
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let groundingUrls = mapChunks
      .map((c: any) => {
        if (c.maps?.uri) return { title: c.maps.title || "Medical Center", uri: c.maps.uri, source: "Google Maps" };
        if (c.web?.uri && c.web.uri.includes('google.com/maps')) return { title: c.web.title || "Doctor Location", uri: c.web.uri, source: "Google Maps" };
        return null;
      })
      .filter(item => item !== null);

    // 2. AGGRESSIVE CLEANER: Convert Markdown Links to Cards 🃏
    // Ye logic poori line ko scan karega. Agar usme map link mila, toh usse 'Card' banayega aur text se hata dega.
    const lines = text.split('\n');
    const cleanLines: string[] = [];
    
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?google\.com\/maps[^)]+)\)/;
    const bareLinkRegex = /(https?:\/\/(?:www\.)?google\.com\/maps\S+)/;

    lines.forEach(line => {
        const markdownMatch = line.match(linkRegex);
        const bareMatch = line.match(bareLinkRegex);

        if (markdownMatch) {
            // Case 1: [Title](Link) format
            groundingUrls.push({
                title: markdownMatch[1].replace(/^\*\*|\*\*$/g, '').trim(), // Remove bold stars
                uri: markdownMatch[2],
                source: "Google Maps"
            });
            // Don't add this line to text (hide it)
        } else if (bareMatch) {
            // Case 2: Just a raw link
            // Try to extract a name from the line, e.g., "**Dr. Smith** - https://..."
            const nameMatch = line.match(/\*\*([^*]+)\*\*/); 
            const title = nameMatch ? nameMatch[1] : "View Location";
            
            groundingUrls.push({
                title: title,
                uri: bareMatch[1],
                source: "Google Maps"
            });
             // Don't add this line to text
        } else {
            // No link, keep the line
            cleanLines.push(line);
        }
    });

    text = cleanLines.join('\n').trim();

    // 3. Final Fallback if empty
    if (groundingUrls.length === 0 && step === 2) {
       groundingUrls.push({
         title: "Find Nearby Specialists",
         uri: `https://www.google.com/maps/search/doctors+near+me`,
         source: "Google Maps"
       });
    }

    return { text, groundingUrls };

  } catch (error) {
    console.error("Triage Error:", error);
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
      model: CHAT_MODEL_NAME,
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
// 4. TEXT TO SPEECH (FAST MODEL 🚀)
// ==========================================

export const generateTTS = async (text: string) => {
  try {
    const client = getGenAIClient();
    // Using Flash-Exp for speed, as per your request
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
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
// 5. IMAGE ANALYSIS
// ==========================================

export const analyzeImage = async (base64Data: string, mimeType: string, type: 'MEDICINE' | 'DERM') => {
  const model = CHAT_MODEL_NAME; 
  const client = getGenAIClient();
  
  let prompt = type === 'MEDICINE' 
    ? "Identify this medicine. Return JSON with: name, purpose, dosage_warning." 
    : "Analyze skin condition. Return JSON with: condition_name, verdict, explanation, recommended_action.";

  try {
    const response = await client.models.generateContent({
      model,
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error: any) {
    return { error: `AI Error: ${error.message}` };
  }
};

// ==========================================
// 6. VIDEO ANALYSIS
// ==========================================

export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  const client = getGenAIClient();
  const prompt = `Analyze video. Verify pill intake. Return JSON: { "action_detected", "success": boolean, "verdict_message" }`;

  try {
    const response = await client.models.generateContent({
      model: CHAT_MODEL_NAME,
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Failed to analyze video." };
  }
};

// ==========================================
// 7. DIET PLAN
// ==========================================

export const generateDietPlan = async (condition: string) => {
  const client = getGenAIClient();
  try {
    const response = await client.models.generateContent({
      model: CHAT_MODEL_NAME,
      contents: `Create 1-day diet plan for: ${condition}. Return JSON...`,
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (error) {
    return { error: "Could not generate diet plan." };
  }
};

export const ai = getGenAIClient();
