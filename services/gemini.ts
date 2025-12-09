// services/gemini.ts - UPDATED FOR OPENROUTER

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = "https://healthwealth.vercel.app"; // Your site URL
const SITE_NAME = "MediGuard AI";

// Helper for OpenRouter API Calls
const callOpenRouter = async (messages: any[], model: string = "google/gemini-2.0-flash-lite-preview-02-05") => {
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
        "messages": messages
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter Error: ${err}`);
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
  // Construct messages in OpenAI format
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

  // Using a free/cheap Google model via OpenRouter
  const text = await callOpenRouter(messages, "google/gemini-2.0-flash-lite-preview-02-05:free");
  
  // Fake grounding for now (OpenRouter doesn't return Google Maps metadata directly)
  let groundingUrls: any[] = [];
  if (step >= 2 && userLocation) {
      // We can manually generate a search link
      const query = "doctor near me";
      groundingUrls.push({
          title: "Find Doctors Nearby",
          uri: `https://www.google.com/maps/search/doctors/@${userLocation.lat},${userLocation.lng},14z`
      });
  }

  return { text, groundingUrls };
};

/**
 * Audio Transcription (Note: OpenRouter is mostly text/image chat)
 * We might need to stick to Google API for this or use a simple workaround.
 * For now, returning a mock or error if key is missing.
 */
export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
    // OpenRouter doesn't support direct audio upload easily in this format.
    // Return a dummy text for hackathon or fallback to Google Key if present.
    return "Audio transcription via OpenRouter is limited. Please type your symptom.";
};

/**
 * Text to Speech
 */
export const generateTTS = async (text: string) => {
    // OpenRouter doesn't do TTS. Return null to skip audio.
    return null;
};

/**
 * Image Analysis (MediScanner)
 * OpenRouter supports image inputs for some models!
 */
export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM'
) => {
  let prompt = type === 'MEDICINE' 
    ? "Identify this medicine. Return JSON: { \"name\": \"...\", \"purpose\": \"...\", \"dosage_warning\": \"...\" }"
    : "Analyze skin. Return JSON: { \"condition_name\": \"...\", \"verdict\": \"Good/Bad\", \"explanation\": \"...\", \"recommended_action\": \"...\" }";

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
      ]
    }
  ];

  try {
      // Use a vision-capable model
      const jsonString = await callOpenRouter(messages, "google/gemini-flash-1.5");
      // Clean and parse
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
    // Video is tricky via OpenRouter standard API. 
    return { error: "Video analysis not supported on OpenRouter connection yet." };
};

/**
 * Diet Plan
 */
export const generateDietPlan = async (condition: string) => {
  const messages = [{ role: "user", content: `Create diet plan for ${condition}. Return JSON...` }];
  try {
      const jsonString = await callOpenRouter(messages);
      const clean = jsonString.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
  } catch (e) {
      return { error: "Failed to generate plan." };
  }
};

// Export dummy object to satisfy imports
export const ai = { models: { generateContent: () => {} } };
