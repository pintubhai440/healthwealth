import React, { useState, useRef } from 'react';
import { generateDietPlan } from '../services/gemini';
import { Modality, GoogleGenAI } from '@google/genai';
import { Play, Mic, MicOff, Activity, Salad, Youtube, Volume2, UserCheck, Loader2, StopCircle, ArrowRight, Dumbbell, Search, Video } from 'lucide-react';

// ==========================================
// KEY ROTATION FOR LIVE SESSION 🛠️
// ==========================================
const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];

const getRandomKey = () => {
  if (keysPool.length === 0) return process.env.GEMINI_API_KEY || "MISSING_KEY";
  return keysPool[Math.floor(Math.random() * keysPool.length)];
};

const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

export const RecoveryCoach: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PLAN' | 'VIDEO' | 'COACH'>('PLAN');

  // Diet State
  const [condition, setCondition] = useState('');
  const [days, setDays] = useState('3');
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [dietLoading, setDietLoading] = useState(false);

  // Video Search State
  const [videoQuery, setVideoQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  // Live Coach State
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [coachStatus, setCoachStatus] = useState("Ready");
  const [coachForm, setCoachForm] = useState({ ailment: '', exerciseName: '' });
  const [isCoachSetupDone, setIsCoachSetupDone] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // --- Diet Logic ---
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

  // --- Live Coach Logic ---
  const startLiveSession = async () => {
    try {
      setCoachStatus("Connecting...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: { width: 320, height: 240 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

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

      const apiKey = getRandomKey();
      const client = new GoogleGenAI({ apiKey });
      
      const session = await client.live.connect({
        model: 'gemini-2.0-flash-exp', 
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: `You are a Physical Therapy Coach. 
            User has: "${coachForm.ailment}". 
            Exercise: "${coachForm.exerciseName}".
            Give short, encouraging feedback.`,
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
      setCoachStatus("Active");
      sessionRef.current = session;

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
      alert("Connection Failed. Check Quota/Network.");
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
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* --- TABS NAVIGATION --- */}
      <div className="flex p-1 bg-slate-200 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('PLAN')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'PLAN' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}
        >
          <Salad className="w-4 h-4" /> Diet Plan
        </button>
        <button
          onClick={() => setActiveTab('VIDEO')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'VIDEO' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}
        >
          <Youtube className="w-4 h-4" /> Video Search
        </button>
        <button
          onClick={() => setActiveTab('COACH')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'COACH' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
        >
          <Activity className="w-4 h-4" /> AI Coach
        </button>
      </div>

      {/* --- TAB 1: DIET PLAN --- */}
      {activeTab === 'PLAN' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Recovery Diet Generator</h3>
            
            <div className="flex flex-col md:flex-row gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="Condition (e.g. Viral Fever)"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="flex-1 p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                
                <select 
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="3">3 Days</option>
                    <option value="5">5 Days</option>
                    <option value="7">7 Days</option>
                </select>

                <button 
                    onClick={handleGetDiet}
                    disabled={dietLoading || !condition}
                    className="bg-emerald-600 text-white px-6 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center"
                >
                    {dietLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate"}
                </button>
            </div>

            {dietPlan && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="bg-emerald-50 p-4 rounded-xl text-emerald-800 text-sm border border-emerald-100">
                        {dietPlan.advice}
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        {dietPlan.meals?.map((meal: any, idx: number) => (
                            <div key={idx} className="border border-slate-200 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                                <h5 className="font-bold text-emerald-600 text-sm uppercase mb-2">{meal.name}</h5>
                                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                    {meal.items.map((it: string, i: number) => <li key={i}>{it}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* --- TAB 2: VIDEO SEARCH --- */}
      {activeTab === 'VIDEO' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Exercise Video Finder</h3>
            <p className="text-slate-500 text-sm mb-4">Find Yoga or Exercises instantly.</p>
            
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="Enter Yoga or Exercise name (e.g. Surya Namaskar)" 
                    value={videoQuery} 
                    onChange={(e) => setVideoQuery(e.target.value)} 
                    className="flex-1 p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-red-500"
                />
                <button 
                    onClick={() => setActiveVideo(videoQuery)}
                    disabled={!videoQuery}
                    className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2"
                >
                    <Search className="w-4 h-4" /> Search
                </button>
            </div>

            {activeVideo ? (
                <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-black aspect-video">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(activeVideo)}`}
                        title="Exercise Video" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                    <Video className="w-10 h-10 mb-2 opacity-50" />
                    <p>Search to play video</p>
                </div>
            )}
        </div>
      )}

      {/* --- TAB 3: LIVE COACH --- */}
      {activeTab === 'COACH' && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Dumbbell className="w-6 h-6 text-green-400" /> Live AI Coach
                    </h3>
                    <p className="text-slate-400 text-xs">Real-time posture correction</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${connected ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    {connected ? "LIVE ●" : "OFFLINE"}
                </div>
            </div>

            {/* SETUP FORM */}
            {!isCoachSetupDone ? (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 uppercase">Injury / Condition</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Lower Back Pain"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mt-1 text-white focus:border-green-500 outline-none"
                            value={coachForm.ailment}
                            onChange={e => setCoachForm({...coachForm, ailment: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase">Exercise Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Cobra Stretch"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mt-1 text-white focus:border-green-500 outline-none"
                            value={coachForm.exerciseName}
                            onChange={e => setCoachForm({...coachForm, exerciseName: e.target.value})}
                        />
                    </div>
                    <button 
                        onClick={() => setIsCoachSetupDone(true)}
                        disabled={!coachForm.ailment || !coachForm.exerciseName}
                        className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
                    >
                        Open Camera <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                /* CAMERA VIEW */
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 mb-4">
                    <video 
                        ref={videoRef} 
                        muted 
                        className={`w-full h-full object-cover transform scale-x-[-1] ${!connected && 'opacity-50'}`} 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {!connected && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <button 
                                onClick={startLiveSession}
                                className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-bold shadow-lg transform hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <Play className="w-5 h-5 fill-current" /> Start Session
                            </button>
                            <button onClick={() => setIsCoachSetupDone(false)} className="mt-4 text-xs text-slate-400 underline hover:text-white">
                                Back to Setup
                            </button>
                        </div>
                    )}

                    {connected && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-end">
                            <div className="bg-slate-800/80 px-3 py-1 rounded text-sm text-green-300 border border-green-500/30 animate-pulse">
                                {coachStatus}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsMuted(!isMuted)} 
                                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700/80 text-white hover:bg-slate-600'}`}
                                >
                                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={stopSession} 
                                    className="bg-red-600/90 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 text-sm flex items-center gap-2"
                                >
                                    <StopCircle className="w-4 h-4" /> End
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};
