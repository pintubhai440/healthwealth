import { GoogleGenAI, Modality } from "@google/genai";

// ✅ YEH INTERFACE ADD KAREIN
interface MiniProfile {
  age?: string;
  weight?: string;
  allergies?: string;
  gender?: string;
  condition?: string;
}

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
// 2. TRIAGE CHAT (Updated for Profile)
// ==========================================

export const runTriageTurn = async (
  history: { role: string; text: string }[],
  currentInput: string,
  step: number,
  userLocation?: { lat: number; lng: number },
  profile?: MiniProfile // 👈 Naya Parameter Joda
) => {
  const model = CHAT_MODEL_NAME;

  // ✅ Profile Context Inject Karein
  let profileText = "";
  if (profile) {
    profileText = `
    PATIENT PROFILE (CRITICAL CONTEXT):
    - Age: ${profile.age || 'Unknown'}
    - Gender: ${profile.gender || 'Unknown'}
    - Weight: ${profile.weight || 'Unknown'}
    - Known Allergies: ${profile.allergies || 'None'}
    
    INSTRUCTION: Consider this profile in your diagnosis. If the user suggests a medicine they are allergic to, WARN THEM immediately.`;
  }

  let systemInstruction = `You are a professional, empathetic Medical Triage AI assistant.
  ${profileText}
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
  - Find 3 **Specific Real Clinics** nearby.
  - **Strict Output Format:** You must output links exactly like this:
    * [Clinic Name](https://www.google.com/maps/search/?api=1&query=Clinic+Name+City)
  - Do NOT use internal tool links. Use standard public Google Maps links.

  FORMATTING:
  - Use Markdown for bolding.
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
    
    // --- MAPS EXTRACTION ---
    const mapChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let groundingUrls = mapChunks
      .map((c: any) => {
        if (c.maps?.uri) return { title: c.maps.title || "Medical Center", uri: c.maps.uri, source: "Google Maps" };
        if (c.web?.uri && c.web.uri.includes('google.com/maps')) return { title: c.web.title || "Location", uri: c.web.uri, source: "Google Maps" };
        return null;
      })
      .filter(item => item !== null);

    const lines = text.split('\n');
    const cleanLines: string[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;

    lines.forEach(line => {
        const match = line.match(linkRegex);
        if (match) {
            const title = match[1].replace(/\*/g, '').trim();
            let url = match[2];

            if (!url.startsWith('https://www.google.com/maps') && !url.startsWith('https://maps.google.com')) {
                const query = encodeURIComponent(title + " near me");
                url = `https://www.google.com/maps/search/?api=1&query=${query}`; 
            }

            groundingUrls.push({ title: title, uri: url, source: "Google Maps" });
        } else {
            cleanLines.push(line);
        }
    });
    
    // Fallback Logic
    if (step === 2 && groundingUrls.length === 0) {
        const specialistMatch = text.match(/(Gastroenterologist|Orthopedist|Dermatologist|Cardiologist|Neurologist|Pediatrician|ENT|Dentist|Doctor)/i);
        const searchTerm = specialistMatch ? specialistMatch[0] : "Specialist Doctor";
        
        groundingUrls.push({ 
            title: `Find ${searchTerm} Nearby`, 
            uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchTerm + " near me")}`, 
            source: "Google Maps" 
        });
    }

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
// ==========================================
// 5. IMAGE & VIDEO ANALYSIS
// ==========================================
// 1. type definition update karein
export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  type: 'MEDICINE' | 'DERM' | 'REPORT',
  profile?: MiniProfile 
) => {
  let prompt = "";

  if (type === 'MEDICINE') {
     // ... Medicine Logic (Same as before) ...
     prompt = `Identify this medicine. Return JSON: {name, purpose, dosage_warning}.
     CRITICAL SAFETY CHECK: The user has allergies: "${profile?.allergies || 'None'}".
     If allergens found, warning: "⚠️ DANGER". Otherwise standard warning.`;

  } else if (type === 'DERM') {
     // ... Derm Logic (Same as before) ...
     prompt = `Analyze skin condition. Patient: ${profile?.age || '?'} yrs, ${profile?.gender || ''}.
     Return JSON: {condition_name, verdict, explanation, recommended_action}.`;

  } else if (type === 'REPORT') {
     // ✅ FIXED: UNIVERSAL HOLISTIC LOGIC (For All Report Types)
     prompt = `You are an expert Pathologist & General Physician AI. Analyze this medical lab report (CBC, Lipid, Thyroid, LFT, KFT, Urine, etc.).
     Patient Profile: ${profile?.age || 'Unknown'} years old, ${profile?.gender || 'Unknown'}.

     CRITICAL HOLISTIC LOGIC RULES (Follow Strictly):
     1. **Connect the Dots:** Do NOT analyze parameters in isolation. Look at the relationship between values.
     2. **Conflict Resolution & Examples:**
        - **Thyroid:** If T3/T4 High AND TSH High -> Mark as "Complex/Pituitary Issue" (Don't say thyroid is both fast and slow).
        - **Lipid Profile:** If Total Cholesterol is High BUT HDL (Good Cholesterol) is also High -> This is often OK. Do not panic. Check LDL/HDL ratio instead.
        - **CBC (Anemia):** If Hemoglobin is Low, look at MCV. 
          * MCV Low = Iron Deficiency (Microcytic).
          * MCV High = B12/Folate Deficiency (Macrocytic). -> Give specific advice based on this.
        - **Liver (LFT):** If SGOT/SGPT are mildly elevated but Bilirubin is Normal -> Likely Fatty Liver or Alcohol, not Liver Failure.
        - **Kidney (KFT):** If Creatinine is high, check Urea/BUN. Both high = Kidney stress. Dehydration can also spike these slightly.
     3. **Dummy Data Rule:** If report says "DUMMY", "SAMPLE", or "FORMAT", explicitly mention: "This appears to be a sample report, but here is the analysis of the numbers provided."

     Task:
     1. Identify the Test Type (e.g., Complete Blood Count, Lipid Profile, etc.).
     2. Extract ONLY abnormal or key values.
     3. Provide a 'Medical Interpretation' that explains WHY it is high/low based on the logic above.

     RETURN JSON format:
     {
       "report_type": "e.g., Complete Blood Count (CBC)",
       "summary": "A 2-line summary. Example: 'Red blood cells are low indicating Iron Deficiency Anemia, not general weakness.'",
       "findings": [
          { 
            "parameter": "Hemoglobin", 
            "value": "9.5", 
            "status": "Low", 
            "meaning": "Indicates Anemia." 
          },
          { 
            "parameter": "MCV", 
            "value": "70", 
            "status": "Low", 
            "meaning": "Suggests Iron Deficiency type." 
          }
       ],
       "health_tips": ["Eat Iron-rich foods like Spinach/Red Meat", "Vitamin C helps absorption", "Avoid tea/coffee with meals"],
       "overall_status": "Attention Needed / Normal / Critical"
     }`;
  }

  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e: any) { return { error: `AI Error: ${e.message}` }; }
};

// ✅ UPDATED STRICT VIDEO VERIFICATION FUNCTION
export const analyzeMedicineVideo = async (base64Data: string, mimeType: string) => {
  // 👇 STRICT PROMPT: Isse AI "Acting" aur "Real Intake" me fark kar payega
  const prompt = `
  You are a strict Medical Adherence AI. Analyze this video carefully to verify if the patient ACTUALLY took the medicine.
  
  CHECK FOR THESE 3 STEPS:
  1. Presence of Medicine: Can you see a pill, syrup, or inhaler?
  2. Action: Did the person put it in their mouth?
  3. Swallowing: Did they drink water or swallow?

  CRITERIA FOR SUCCESS (true):
  - The person MUST perform the action of taking the medicine. 
  - Just holding the packet or looking at the camera is "success": false.
  
  RETURN PURE JSON:
  {
    "action_detected": "Describe exactly what the person did (e.g., 'Holding pill but did not swallow' or 'Swallowed pill with water')",
    "success": boolean, 
    "verdict_message": "A short, direct message to the guardian. (e.g., 'Medicine intake confirmed' or 'Alert: Patient stopped halfway')"
  }`;

  try {
    const response = await generateContentWithRetry(CHAT_MODEL_NAME, {
      contents: { 
        parts: [
          { inlineData: { mimeType, data: base64Data } }, 
          { text: prompt } 
        ] 
      },
      config: { responseMimeType: "application/json" }
    });
    return cleanJSON(response.text || "{}");
  } catch (e) { 
    console.error("Video Analysis Error:", e);
    return { error: "Failed to analyze video." }; 
  }
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
// 8. AI COACH EXERCISE ANALYZER (Updated for Body Type)
// ==========================================
export const analyzeExerciseVideo = async (
  base64Data: string, 
  mimeType: string, 
  ailment: string, 
  exercise: string,
  profile?: MiniProfile // 👈 Ye naya parameter zaroori hai
) => {
  const prompt = `You are an expert Physiotherapist AI. 
  Patient Profile: Age ${profile?.age || 'Unknown'}, Weight ${profile?.weight || 'Unknown'}.
  The user has "${ailment}" and is performing "${exercise}".
  Analyze the video for form, safety, and correctness considering their age and weight constraints.
  
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
