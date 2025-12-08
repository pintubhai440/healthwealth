import React, { useState, useEffect, useRef } from 'react';
import { generateDietPlan, ai } from '../services/gemini';
import { LiveServerMessage, Modality } from '@google/genai';
import { Play, Mic, MicOff, Activity, Salad, Youtube, Volume2, UserCheck } from 'lucide-react';

// Live API Helpers for Audio
const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

export const RecoveryCoach: React.FC = () => {
  // Diet State
  const [condition, setCondition] = useState('');
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [dietLoading, setDietLoading] = useState(false);

  // Live Coach State
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [postureStatus, setPostureStatus] = useState("Waiting for session...");
  
  // Refs for Live API
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const audioQueueRef = useRef<Array<AudioBuffer>>([]);
  const isPlayingRef = useRef(false);

  // --- Diet Logic ---
  const handleGetDiet = async () => {
    if (!condition) return;
    setDietLoading(true);
    try {
      const plan = await generateDietPlan(condition);
      setDietPlan(plan);
    } catch (e) {
      console.error(e);
    } finally {
      setDietLoading(false);
    }
  };

  // --- Live API Logic ---
  const startLiveSession = async () => {
    try {
      // 1. Setup Audio Input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 320, height: 240 } });
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
        // Convert Float32 to PCM Int16
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = inputData[i] * 32767;
        }
        // Base64 encode
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        sessionRef.current.sendRealtimeInput({
            media: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
            }
        });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // 2. Connect to Gemini
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: `You are an expert Physical Therapy Coach. 
            You can see the user via video. 
            Your job is to check their posture and encourage them.
            Keep responses short and motivating. 
            If they ask about diet, refer them to the diet section below.`,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        },
        callbacks: {
            onopen: () => {
                setConnected(true);
                setPostureStatus("AI Coach is watching & listening...");
            },
            onmessage: async (msg: LiveServerMessage) => {
                // Handle Audio Output
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    playAudioResponse(audioData);
                }
            },
            onclose: () => {
                setConnected(false);
                setPostureStatus("Session ended.");
            }
        }
      });
      
      sessionRef.current = session;

      // 3. Start Video Streaming
      videoIntervalRef.current = window.setInterval(async () => {
        if (!sessionRef.current || !canvasRef.current || !videoRef.current) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            
            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
            sessionRef.current.sendRealtimeInput({
                media: {
                    mimeType: "image/jpeg",
                    data: base64
                }
            });
        }
      }, 1000); // 1 FPS for video to save bandwidth

    } catch (err) {
      console.error("Live Connect Error:", err);
      alert("Could not start live session. Check permissions/API key.");
    }
  };

  const playAudioResponse = async (base64Audio: string) => {
    // Simple decoding and playback queue
    const audioCtx = new AudioContextClass({ sampleRate: 24000 }); // Output rate
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Convert PCM to AudioBuffer
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;

    const buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  };

  const stopSession = () => {
    if (sessionRef.current) {
        // sessionRef.current.close(); // Method might not exist on the simplified object depending on SDK version
        // Ideally just close connections
    }
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    
    setConnected(false);
    setPostureStatus("Session Stopped");
    // Reload to fully clear for hackathon purposes
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      {/* Diet Section */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-emerald-700">
          <Salad className="w-6 h-6" /> Recovery Diet Plan
        </h3>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="E.g., Sprained Ankle, Viral Fever"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button 
            onClick={handleGetDiet}
            disabled={dietLoading}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700"
          >
            {dietLoading ? "Generating..." : "Get Plan"}
          </button>
        </div>

        {dietPlan && (
           <div className="space-y-4 animate-in fade-in">
              <div className="bg-emerald-50 p-4 rounded-lg text-emerald-800">
                 {dietPlan.advice}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                 {dietPlan.meals?.map((meal: any, idx: number) => (
                    <div key={idx} className="border p-3 rounded-lg">
                       <h4 className="font-bold text-slate-700 mb-2">{meal.name}</h4>
                       <ul className="list-disc list-inside text-sm text-slate-600">
                          {meal.items.map((it: string, i: number) => <li key={i}>{it}</li>)}
                       </ul>
                    </div>
                 ))}
              </div>
              <div className="space-y-2">
                 <h4 className="font-bold flex items-center gap-2 text-red-600"><Youtube className="w-4 h-4" /> Recommended Exercises</h4>
                 {dietPlan.youtube_queries?.map((q: string, i: number) => (
                    <a 
                      key={i} 
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block text-blue-600 hover:underline text-sm"
                    >
                      Watch: {q}
                    </a>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* Live Coach Section */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-2xl overflow-hidden relative">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
               <Activity className="w-6 h-6 text-green-400" /> Live AI Coach
            </h3>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${connected ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
               <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
               {connected ? "LIVE" : "OFFLINE"}
            </div>
         </div>

         <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 mb-4">
            <video 
                ref={videoRef} 
                muted 
                className={`w-full h-full object-cover transform scale-x-[-1] ${!connected && 'opacity-30'}`} 
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {!connected && (
               <div className="absolute inset-0 flex items-center justify-center">
                  <button 
                    onClick={startLiveSession}
                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105 flex items-center gap-2"
                  >
                     <Play className="w-5 h-5 fill-current" /> Start Session
                  </button>
               </div>
            )}
            
            {connected && (
               <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <div className="bg-black/60 backdrop-blur px-3 py-2 rounded text-sm text-green-300 border border-green-500/30">
                     {postureStatus}
                  </div>
                  <div className="flex gap-2">
                     <button 
                       onClick={() => setIsMuted(!isMuted)}
                       className={`p-3 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                     >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                     </button>
                     <button 
                        onClick={stopSession}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 text-sm"
                     >
                        End
                     </button>
                  </div>
               </div>
            )}
         </div>

         <div className="text-slate-400 text-sm flex gap-4">
             <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Voice Output
             </div>
             <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Posture Tracking
             </div>
         </div>
      </div>
    </div>
  );
};
