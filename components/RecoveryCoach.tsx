import React, { useState, useRef, useEffect } from 'react';
import { generateDietPlan } from '../services/gemini';
import { LiveServerMessage, Modality, GoogleGenAI } from '@google/genai';
import { Play, Mic, MicOff, Activity, Salad, Youtube, Volume2, UserCheck, Loader2, StopCircle, Calendar, Dumbbell, Stethoscope, ArrowRight } from 'lucide-react';

// ==========================================
// 1. KEY ROTATION LOGIC (20 KEYS HACK 🛠️)
// ==========================================
const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];

const getRandomKey = () => {
  // Agar pool khali hai toh fallback environment variable use karo
  if (keysPool.length === 0) return process.env.GEMINI_API_KEY || "MISSING_KEY";
  return keysPool[Math.floor(Math.random() * keysPool.length)];
};

// Audio Helpers
const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

export const RecoveryCoach: React.FC = () => {
  // --- Diet State ---
  const [condition, setCondition] = useState('');
  const [days, setDays] = useState('3'); // Default 3 days
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [dietLoading, setDietLoading] = useState(false);

  // --- Live Coach State ---
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [coachStatus, setCoachStatus] = useState("Ready to start");
  
  // Coach Setup Form (New Requirement)
  const [coachForm, setCoachForm] = useState({
      ailment: '', // e.g. Knee Surgery
      exerciseName: '', // e.g. Leg Raise
  });
  const [isCoachSetupDone, setIsCoachSetupDone] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // ==================================================
  // 1. ADVANCED DIET PLAN LOGIC (Duration + Embeds)
  // ==================================================
  const handleGetDiet = async () => {
    if (!condition) return;
    setDietLoading(true);
    
    // Combine Condition + Days for the AI Prompt
    const fullQuery = `${condition} for ${days} days duration`;
    
    try {
      const plan = await generateDietPlan(fullQuery);
      setDietPlan(plan);
    } catch (e) {
      console.error(e);
    } finally {
      setDietLoading(false);
    }
  };

  // ==================================================
  // 2. LIVE AI COACH LOGIC (Context Aware)
  // ==================================================
  const startLiveSession = async () => {
    try {
      setCoachStatus("Connecting to AI...");
      
      // A. Setup Camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: { width: 320, height: 240 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // B. Setup Audio
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = inputData[i] * 32767;
        }
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        sessionRef.current.sendRealtimeInput({
            media: { mimeType: "audio/pcm;rate=16000", data: base64Audio }
        });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // C. Connect using Random Key
      const apiKey = getRandomKey();
      const client = new GoogleGenAI({ apiKey });
      
      // DYNAMIC SYSTEM INSTRUCTION (Based on User Inputs)
      const dynamicInstruction = `You are an expert Physical Therapy Coach. 
      The user is suffering from: "${coachForm.ailment}".
      The doctor recommended this exercise: "${coachForm.exerciseName}".
      
      Your Job:
      1. Watch the video stream.
      2. Check if they are doing "${coachForm.exerciseName}" correctly.
      3. Give short, encouraging feedback (e.g., "Keep your back straight", "Good job").
      4. Be gentle but professional.`;

      const session = await client.live.connect({
        model: 'gemini-2.0-flash-exp', 
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: dynamicInstruction,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        }
      });

      session.on('content', (content: any) => {
          const audioData = content.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) playAudioResponse(audioData);
      });

      setConnected(true);
      setCoachStatus(`Monitoring: ${coachForm.exerciseName}`);
      sessionRef.current = session;

      // Start Video Stream (1 FPS)
      videoIntervalRef.current = window.setInterval(() => {
        if (!sessionRef.current || !canvasRef.current || !videoRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
            sessionRef.current.sendRealtimeInput({ media: { mimeType: "image/jpeg", data: base64 } });
        }
      }, 1000); 

    } catch (err) {
      console.error("Live Error:", err);
      alert("Connection failed. Quota might be full or network issue.");
      setCoachStatus("Error");
      setConnected(false);
    }
  };

  const playAudioResponse = async (base64Audio: string) => {
    try {
        const audioCtx = new AudioContextClass({ sampleRate: 24000 });
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;
        const buffer = audioCtx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
    } catch (e) { console.error(e); }
  };

  const stopSession = () => {
    if (sessionRef.current) sessionRef.current = null;
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setConnected(false);
    setCoachStatus("Session Ended");
    window.location.reload();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* 1. DIET PLANNER SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-emerald-700">
          <Salad className="w-6 h-6" /> Recovery Diet & Videos
        </h3>
        
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <input 
            type="text" 
            placeholder="Condition (e.g. Viral Fever, Fracture)"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
          />
          
          <select 
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
          >
              <option value="3">3 Days</option>
              <option value="5">5 Days</option>
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
          </select>

          <button 
            onClick={handleGetDiet}
            disabled={dietLoading || !condition}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {dietLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Plan"}
          </button>
        </div>

        {dietPlan && (
           <div className="space-y-6 animate-in fade-in">
              <div className="bg-emerald-50 p-4 rounded-xl text-emerald-800 text-sm md:text-base border border-emerald-100">
                 💡 <strong>Coach Advice:</strong> {dietPlan.advice}
              </div>
              
              {/* Diet Cards */}
              <div className="grid md:grid-cols-3 gap-4">
                 {dietPlan.meals?.map((meal: any, idx: number) => (
                    <div key={idx} className="border border-slate-200 p-4 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                       <h4 className="font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">{meal.name}</h4>
                       <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                          {meal.items.map((it: string, i: number) => <li key={i}>{it}</li>)}
                       </ul>
                    </div>
                 ))}
              </div>

              {/* VIDEO EMBEDS (YouTube In-App) */}
              <div>
                 <h4 className="font-bold flex items-center gap-2 text-red-600 text-sm uppercase tracking-wide mb-3">
                    <Youtube className="w-4 h-4" /> Recommended Exercise Videos
                 </h4>
                 <div className="grid md:grid-cols-2 gap-4">
                    {dietPlan.youtube_queries?.slice(0, 2).map((q: string, i: number) => (
                        <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-black">
                            {/* Embedded Search Player */}
                            <iframe 
                                width="100%" 
                                height="200" 
                                src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(q)}`}
                                title="YouTube video player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                            <div className="p-2 bg-white text-xs font-bold text-slate-700 truncate">
                                🔎 Search: {q}
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* 2. LIVE COACH SECTION */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl overflow-hidden relative border border-slate-800">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
               <Activity className="w-6 h-6 text-green-400" /> Live AI Coach
            </h3>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${connected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
               <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
               {connected ? "LIVE" : "OFFLINE"}
            </div>
         </div>

         {/* SETUP FORM (Shown before camera) */}
         {!isCoachSetupDone && (
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-in fade-in">
                 <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-blue-400" /> Coach Setup
                 </h4>
                 <div className="space-y-4">
                     <div>
                         <label className="text-xs text-slate-400 uppercase">What's the Injury/Ailment?</label>
                         <input 
                            type="text" 
                            placeholder="e.g. Lower Back Pain, Frozen Shoulder"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 mt-1 text-white focus:border-green-500 outline-none"
                            value={coachForm.ailment}
                            onChange={e => setCoachForm({...coachForm, ailment: e.target.value})}
                         />
                     </div>
                     <div>
                         <label className="text-xs text-slate-400 uppercase">Doctor's Recommended Exercise?</label>
                         <input 
                            type="text" 
                            placeholder="e.g. Cobra Stretch, Squats"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 mt-1 text-white focus:border-green-500 outline-none"
                            value={coachForm.exerciseName}
                            onChange={e => setCoachForm({...coachForm, exerciseName: e.target.value})}
                         />
                     </div>
                     <button 
                        onClick={() => setIsCoachSetupDone(true)}
                        disabled={!coachForm.ailment || !coachForm.exerciseName}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                        Continue to Camera <ArrowRight className="w-4 h-4" />
                     </button>
                 </div>
             </div>
         )}

         {/* CAMERA VIEW (Shown after setup) */}
         {isCoachSetupDone && (
             <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 mb-4 animate-in zoom-in-95">
                <video 
                    ref={videoRef} 
                    muted 
                    className={`w-full h-full object-cover transform scale-x-[-1] ${!connected && 'opacity-30 blur-sm'}`} 
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {!connected && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                      <button 
                        onClick={startLiveSession}
                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all transform hover:scale-105 flex items-center gap-3 text-lg"
                      >
                         <Play className="w-6 h-6 fill-current" /> Start {coachForm.exerciseName}
                      </button>
                      <p className="text-slate-400 mt-4 text-sm">Powered by Gemini 2.0 Flash Live</p>
                      <button onClick={() => setIsCoachSetupDone(false)} className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline">Change Details</button>
                   </div>
                )}
                
                {connected && (
                   <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-end">
                      <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-lg text-sm text-green-300 border border-green-500/30 animate-pulse">
                         {coachStatus}
                      </div>
                      <div className="flex gap-3">
                         <button 
                           onClick={() => setIsMuted(!isMuted)}
                           className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700/80 text-white hover:bg-slate-600'}`}
                         >
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                         </button>
                         <button 
                            onClick={stopSession}
                            className="bg-red-600/90 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 text-sm flex items-center gap-2"
                         >
                            <StopCircle className="w-5 h-5" /> End
                         </button>
                      </div>
                   </div>
                )}
             </div>
         )}

         {/* INFO BAR */}
         <div className="grid grid-cols-2 gap-4 text-slate-400 text-sm">
             <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <Volume2 className="w-4 h-4 text-blue-400" /> 
                <span>AI Voice Feedback</span>
             </div>
             <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <Dumbbell className="w-4 h-4 text-purple-400" /> 
                <span>Exercise Correction</span>
             </div>
         </div>
      </div>
    </div>
  );
};
