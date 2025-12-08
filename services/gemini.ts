import { GoogleGenAI, Type, Schema, FunctionDeclaration, Modality } from "@google/genai";

// Initialize Gemini Client
// CRITICAL: We assume process.env.API_KEY is available as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Triage Chat Logic
 * Uses gemini-2.5-flash for speed or gemini-3-pro-preview for complex reasoning if needed.
 * Incorporates Google Maps for finding doctors in the verdict phase.
 */
export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number }
) => {
  const isFinalTurn = step >= 2;
  // Default to Pro for final turn, Flash for questions
  let model = isFinalTurn ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  
  let systemInstruction = `You are a Smart Triage Doctor (AI). 
  Goal: Diagnose the user's condition quickly using exactly 2 follow-up questions total, then provide a verdict.
  Current Step: ${step} (0-indexed).
  
  Protocol:
  1. Analyze the user's complaint.
  2. If Step < 2: Ask ONE concise, medically relevant follow-up question to narrow down the diagnosis. Do not repeat questions.
  3. If Step == 2: Provide a FINAL VERDICT.
     - Format: "VERDICT: [Condition Name]"
     - Risk Level: Low / Medium / High.
     - Recommendation: suggest a specific doctor specialist.
     - Advice: Simple home remedy or immediate action.
  `;

  if (isFinalTurn) {
    systemInstruction += " You have access to Google Maps to find a relevant doctor nearby if location is provided.";
  }

  const tools: any[] = [];
  const toolConfig: any = {};

  if (isFinalTurn && userLocation) {
    tools.push({ googleMaps: {} });
    toolConfig.retrievalConfig = {
      latLng: {
        latitude: userLocation.lat,
        longitude: userLocation.lng
      }
    };
  }

  // Filter out system messages from history to prevent API errors
  const cleanHistory = history
    .filter(h => h.role === 'user' || h.role === 'model')
    .map(h => ({ role: h.role, parts: [{ text: h.text }] }));

  const generate = async (selectedModel: string) => {
    return await ai.models.generateContent({
      model: selectedModel,
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
  };

  try {
    const response = await generate(model);
    
    // Extract text and grounding
    const text = response.text || "I couldn't generate a response.";
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingUrls = mapChunks
      .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets || [])
      .map((s: any) => ({ title: s.title || 'Map Link', uri: s.uri || '#' }))
      .concat(
        mapChunks.filter(c => c.maps?.uri).map(c => ({ title: c.maps?.title || 'Map Location', uri: c.maps?.uri }))
      );

    return { text, groundingUrls };

  } catch (error) {
    console.error("Triage Error with model", model, error);
    
    // Fallback logic: If Pro fails, try Flash
    if (model === 'gemini-2.5-pro') {
      try {
        console.log("Retrying with gemini-2.5-flash...");
        const fallbackResponse = await generate('gemini-2.5-flash');
        const text = fallbackResponse.text || "I couldn't generate a response.";
        // Flash might also return grounding if configured
        const mapChunks = fallbackResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingUrls = mapChunks
           .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets || [])
           .map((s: any) => ({ title: s.title || 'Map Link', uri: s.uri || '#' }))
           .concat(
             mapChunks.filter(c => c.maps?.uri).map(c => ({ title: c.maps?.title || 'Map Location', uri: c.maps?.uri }))
           );
        return { text, groundingUrls };
      } catch (fallbackError) {
        console.error("Fallback failed", fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
};

/**
 * Audio Transcription (STT)
 */
export const transcribeUserAudio = async (base64Data: string, mimeType: string) => {
  const model = 'gemini-2.5-flash';
  try {
    const response = await ai.models.generateContent({
      model,
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

/**
 * Text to Speech (TTS)
 */
export const generateTTS = async (text: string) => {
  const model = 'gemini-2.5-flash-preview-tts';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    console.error("TTS failed", e);
    return null;
  }
};

/**
 * Image Analysis (Medi-Scanner ID & Derm-Check)
 */
export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM'
) => {
  const model = 'gemini-2.5-pro'; // High reasoning for medical image analysis
  
  let prompt = "";
  if (type === 'MEDICINE') {
    prompt = "Identify this medicine. Return a JSON with: name, purpose, and dosage_warning (string).";
  } else {
    prompt = `Analyze this skin condition. Warning: Educational purpose only. 
    Return a JSON with: 
    - condition_name (string)
    - verdict (enum: 'Good', 'Bad', 'Very Bad') - 'Good' means minor/healing, 'Bad' means needs checkup, 'Very Bad' means urgent.
    - explanation (string)
    - recommended_action (string)`;
  }

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 2048 } // Use thinking for accuracy
    }
  });

  return JSON.parse(response.text || "{}");
};

/**
 * Video Analysis (Guardian Alert)
 */
export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  // Use Flash for faster video processing as per requirements
  const model = 'gemini-2.5-flash';
  
  const prompt = `Analyze this video for the Guardian Alert System.
  Task: Verify if the person actually puts a pill in their mouth and swallows it.
  Return JSON: 
  { 
    "action_detected": "Describe the action seen (e.g., 'Swallowing pill', 'Holding pill only', 'No action')", 
    "success": boolean (true ONLY if swallowing is confirmed), 
    "verdict_message": "Short message for the user." 
  }`;

  const response = await ai.models.generateContent({
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

  return JSON.parse(response.text || "{}");
};

/**
 * Diet Plan Generation
 */
export const generateDietPlan = async (condition: string) => {
  const model = 'gemini-2.5-flash';
  
  const prompt = `Create a 1-day simple recovery diet plan for someone with: ${condition}.
  Also suggest 3 specific YouTube search queries to find recovery exercises for this.
  Return JSON: { 
    "advice": "string",
    "meals": [ { "name": "Breakfast/Lunch/Dinner", "items": ["string"] } ],
    "youtube_queries": ["string"]
  }`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  return JSON.parse(response.text || "{}");
};

// Export the client for Live API usage in components
export { ai };
