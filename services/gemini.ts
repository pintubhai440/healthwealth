// services/gemini.ts - FIXED FOR OPENROUTER

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = "https://healthwealth.vercel.app"; 
const SITE_NAME = "MediGuard AI";

// Helper for OpenRouter API Calls
const callOpenRouter = async (messages: any[], model: string) => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": model,
        "messages": messages,
        "temperature": 0.7
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("OpenRouter Response Error:", err);
        throw new Error(`OpenRouter Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("AI Call Failed:", error);
    throw error;
  }
};

/**
 * Triage Chat Logic (OpenRouter)
 */
export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const messages = [
    {
      role: "system",
      content: `You are a Smart Triage Doctor (AI). 
      Goal: Diagnose quickly in 3 steps.
      Current Step: ${step}.
      Protocol:
      1. Analyze complaint.
      2. If Step < 2: Ask ONE concise question.
      3. If Step == 2: Provide VERDICT (Risk Level, Doctor Specialist, Home Remedy).`
    },
    ...history.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.text
    })),
    { role: "user", content: currentInput }
  ];

  // 👇 FIX: Using a reliable FREE model on OpenRouter
  const text = await callOpenRouter(messages, "google/gemini-2.0-flash-exp:free");
  
  let groundingUrls: any[] = [];
  if (step >= 2 && userLocation) {
      groundingUrls.push({
          title: "Find Doctors Nearby",
          uri: `https://www.google.com/maps/search/doctors/@${userLocation.lat},${userLocation.lng},14z`
      });
  }

  return { text, groundingUrls };
};

/**
 * Audio Transcription
 */
export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
    return "Audio transcription is limited on OpenRouter free tier. Please type your symptoms.";
};

/**
 * Text to Speech
 */
export const generateTTS = async (text: string) => {
    return null; // TTS not supported via simple OpenRouter chat
};

/**
 * Image Analysis (MediScanner)
 */
export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM'
) => {
  let prompt = type === 'MEDICINE' 
    ? "Identify this medicine. Return ONLY valid JSON: { \"name\": \"...\", \"purpose\": \"...\", \"dosage_warning\": \"...\" }"
    : "Analyze skin. Return ONLY valid JSON: { \"condition_name\": \"...\", \"verdict\": \"Good/Bad\", \"explanation\": \"...\", \"recommended_action\": \"...\" }";

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { 
          type: "image_url", 
          image_url: { 
            url: `data:${mimeType};base64,${base64Data}` 
          } 
        }
      ]
    }
  ];

  try {
      // 👇 FIX: Using Pro Experimental Free (Best for vision)
      const jsonString = await callOpenRouter(messages, "google/gemini-2.0-pro-exp-02-05:free");
      
      const clean = jsonString.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
  } catch (e) {
      console.error(e);
      return { error: "Failed to analyze image via OpenRouter." };
  }
};

/**
 * Video Analysis
 */
export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
    return { error: "Video analysis not supported on OpenRouter connection yet." };
};

/**
 * Diet Plan
 */
export const generateDietPlan = async (condition: string) => {
  const messages = [{ role: "user", content: `Create diet plan for ${condition}. Return JSON...` }];
  try {
      const jsonString = await callOpenRouter(messages, "google/gemini-2.0-flash-exp:free");
      const clean = jsonString.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
  } catch (e) {
      return { error: "Failed to generate plan." };
  }
};

// Export dummy object to satisfy imports
export const ai = { models: { generateContent: () => {} } };
