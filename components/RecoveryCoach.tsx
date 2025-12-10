import React, { useState, useRef, useEffect } from 'react';
import { generateDietPlan, findYoutubeVideos, analyzeExerciseForm, generateTTS } from '../services/gemini';
import { Modality, GoogleGenAI } from '@google/genai';
import { Play, Mic, MicOff, Activity, Salad, Youtube, Volume2, UserCheck, Loader2, StopCircle, ArrowRight, Dumbbell, Search, Video, ExternalLink, Trophy, Target, TrendingUp, Award, Zap, Star, Heart } from 'lucide-react';

const keysPool = (process.env.GEMINI_KEYS_POOL as unknown as string[]) || [];
const getRandomKey = () => keysPool.length > 0 ? keysPool[Math.floor(Math.random() * keysPool.length)] : (process.env.GEMINI_API_KEY || "MISSING_KEY");
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
  const [videoResults, setVideoResults] = useState<string[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Live Coach State
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [coachStatus, setCoachStatus] = useState("Ready");
  const [coachForm, setCoachForm] = useState({ ailment: '', exerciseName: '' });
  const [isCoachSetupDone, setIsCoachSetupDone] = useState(false);
  
  // Coach Scoring System
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [reps, setReps] = useState<number>(0);
  const [level, setLevel] = useState<string>('Beginner');
  const [calories, setCalories] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);

  // --- Diet Logic ---
  const handleGetDiet = async () => {
    if (!condition) return;
    setDietLoading(true);
    try {
      const plan = await generateDietPlan(`${condition} for ${days} days`);
      setDietPlan(plan);
    } catch (e) { console.error(e); } 
    finally { setDietLoading(false); }
  };

  // --- Video Search Logic (MULTIPLE VIDEOS 🔥) ---
  const handleVideoSearch = async () => {
      if(!videoQuery) return;
      setVideoLoading(true);
      setVideoResults([]);
      setSelectedVideoId(null);
      try {
          const videoIds = await findYoutubeVideos(videoQuery, 5);
          if(videoIds.length > 0) {
            setVideoResults(videoIds);
            setSelectedVideoId(videoIds[0]);
          } else {
            alert("No videos found. Try different keywords.");
          }
      } catch(e) {
          console.error(e);
          alert("Search failed. Please try again.");
      } finally {
          setVideoLoading(false);
      }
  };

  // --- Exercise Analysis Logic ---
  const analyzeCurrentFrame = async () => {
    if (!canvasRef.current || !videoRef.current || isAnalyzing) return;
    
    try {
      setIsAnalyzing(true);
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];
      
      const result = await analyzeExerciseForm(base64, coachForm.exerciseName);
      
      if (result.score >= 7) {
        const newReps = reps + 1;
        setReps(newReps);
        setScore(prev => prev + result.score);
        setCalories(prev => prev + Math.floor(result.score * 0.5));
        
        // Update level based on score
        const totalScore = score + result.score;
        if (totalScore >= 100) setLevel('Expert');
        else if (totalScore >= 60) setLevel('Advanced');
        else if (totalScore >= 30) setLevel('Intermediate');
        
        // Send feedback via Gemini Live if connected
        if (sessionRef.current && result.feedback) {
          sessionRef.current.sendRealtimeInput({ text: result.feedback });
        }
      }
      
      setFeedback(result.feedback);
      
      // Convert feedback to speech
      if (result.feedback) {
        const audioData = await generateTTS(result.feedback);
        if (audioData) playAudioResponse(audioData);
      }
      
    } catch (error) {
      console.error("Frame analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Live Coach Logic ---
  const startLiveSession = async () => {
    try {
      setCoachStatus("Connecting...");
      
      // Get camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) { 
        videoRef.current.srcObject = stream; 
        videoRef.current.play(); 
      }

      // Setup Audio Context
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Audio processing for Gemini Live
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = inputData[i] * 32767;
        }
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

      // Connect to Gemini Live
      const client = new GoogleGenAI({ apiKey: getRandomKey() });
      const session = await client.live.connect({
        model: 'gemini-2.0-flash-exp', 
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are a fitness AI Coach. User has "${coachForm.ailment}" and is doing "${coachForm.exerciseName}". 
          Your tasks:
          1. Give real-time form feedback
          2. Count reps (say "Good rep!" when correct)
          3. Give motivational encouragement
          4. Provide safety tips
          5. Speak in short, clear phrases
          
          Current stats: Score: ${score}, Reps: ${reps}, Level: ${level}
          
          Be encouraging and professional.`,
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Kore' } 
            } 
          }
        }
      });

      // Handle AI responses
      session.on('content', (content: any) => {
        const audioData = content.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) playAudioResponse(audioData);
        
        // Extract text feedback
        const text = content.modelTurn?.parts?.[0]?.text;
        if (text) {
          setFeedback(prev => text + " " + prev);
          
          // Auto-detect rep completion
          const lowerText = text.toLowerCase();
          if (lowerText.includes('good rep') || lowerText.includes('perfect') || 
              lowerText.includes('count') || lowerText.includes('excellent')) {
            setReps(prev => prev + 1);
            setScore(prev => prev + 10);
            setCalories(prev => prev + 5);
          }
        }
      });

      session.on('error', (error: any) => {
        console.error("Live session error:", error);
      });

      setConnected(true);
      setCoachStatus("Active");
      sessionRef.current = session;

      // Send video frames every second
      videoIntervalRef.current = window.setInterval(() => {
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
      }, 1000);

      // Analyze form every 5 seconds
      analysisIntervalRef.current = window.setInterval(() => {
        if (connected && !isAnalyzing) {
          analyzeCurrentFrame();
        }
      }, 5000);

    } catch (err) { 
      console.error("Session start error:", err);
      setConnected(false); 
      setCoachStatus("Failed");
      alert("Connection Failed. Please check camera/mic permissions."); 
    }
  };

  const playAudioResponse = async (base64Audio: string) => {
    try {
      const audioCtx = new AudioContextClass({ sampleRate: 24000 });
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for(let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }
      const buffer = audioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (e) { 
      console.error("Audio playback error:", e); 
    }
  };

  const stopSession = () => {
    // Cleanup all resources
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    
    setConnected(false);
    setCoachStatus("Ended");
    
    // Show final score summary
    alert(`Session Ended!\n\nFinal Score: ${score}\nReps: ${reps}\nLevel: ${level}\nCalories: ${calories}`);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setScore(0);
      setReps(0);
      setLevel('Beginner');
      setCalories(0);
      setFeedback('');
      setIsCoachSetupDone(false);
    }, 3000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
      if (sessionRef.current) sessionRef.current.close();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* TABS */}
      <div className="flex p-1 bg-slate-200 rounded-xl overflow-x-auto">
        <button 
          onClick={() => setActiveTab('PLAN')} 
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${
            activeTab === 'PLAN' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'
          }`}
        >
          <Salad className="w-4 h-4" /> Diet Plan
        </button>
        <button 
          onClick={() => setActiveTab('VIDEO')} 
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${
            activeTab === 'VIDEO' ? 'bg-white shadow text-red-600' : 'text-slate-500'
          }`}
        >
          <Youtube className="w-4 h-4" /> Video Search
        </button>
        <button 
          onClick={() => setActiveTab('COACH')} 
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${
            activeTab === 'COACH' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
          }`}
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
              className="flex-1 p-3 border rounded-xl bg-slate-50 outline-none" 
            />
            <select 
              value={days} 
              onChange={(e) => setDays(e.target.value)} 
              className="p-3 border rounded-xl bg-slate-50 outline-none"
            >
              <option value="3">3 Days</option>
              <option value="7">7 Days</option>
            </select>
            <button 
              onClick={handleGetDiet} 
              disabled={dietLoading || !condition} 
              className="bg-emerald-600 text-white px-6 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50"
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
                  <div key={idx} className="border border-slate-200 p-4 rounded-xl hover:shadow-md transition-shadow">
                    <h5 className="font-bold text-emerald-600 text-sm uppercase mb-2 flex items-center gap-2">
                      <Salad className="w-4 h-4" /> {meal.name}
                    </h5>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                      {meal.items.map((it: string, i: number) => (
                        <li key={i} className="pl-2">{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              
              {dietPlan.youtube_queries && dietPlan.youtube_queries.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-slate-700 mb-2">Suggested Exercises:</h4>
                  <div className="flex flex-wrap gap-2">
                    {dietPlan.youtube_queries.map((query: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveTab('VIDEO');
                          setVideoQuery(query);
                          setTimeout(() => handleVideoSearch(), 100);
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-sm transition-colors"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: VIDEO SEARCH (MULTIPLE VIDEOS 🔥) --- */}
      {activeTab === 'VIDEO' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-2">AI Video Finder</h3>
          <p className="text-slate-500 text-sm mb-4">Smart search for Yoga & Exercises.</p>
          
          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Enter Yoga or Exercise name (e.g. Surya Namaskar)" 
              value={videoQuery} 
              onChange={(e) => setVideoQuery(e.target.value)} 
              className="flex-1 p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-red-500"
            />
            <button 
              onClick={handleVideoSearch}
              disabled={!videoQuery || videoLoading}
              className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {videoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
            </button>
          </div>

          {videoResults.length > 0 ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              {/* MAIN VIDEO PLAYER */}
              <div className="bg-black rounded-xl overflow-hidden aspect-video border-2 border-slate-300">
                {selectedVideoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1&rel=0&modestbranding=1`}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video player"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gradient-to-br from-red-900/30 to-black">
                    <Youtube className="w-16 h-16 opacity-50 mb-3" />
                    <p className="text-lg font-medium">Select a video to play</p>
                  </div>
                )}
              </div>
              
              {/* VIDEO SELECTION GRID */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Video className="w-4 h-4" /> More Videos ({videoResults.length} found)
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {videoResults.map((videoId, idx) => (
                    <button
                      key={videoId}
                      onClick={() => setSelectedVideoId(videoId)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                        selectedVideoId === videoId 
                          ? 'border-red-500 ring-2 ring-red-200 shadow-md' 
                          : 'border-slate-300 hover:border-red-400 hover:shadow-sm'
                      }`}
                    >
                      <img 
                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                        alt={`Video ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-white text-xs font-medium truncate text-left">
                          Video {idx + 1}
                        </p>
                      </div>
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {idx + 1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* YOUTUBE LINK */}
              {selectedVideoId && (
                <div className="flex justify-between items-center">
                  <a 
                    href={`https://www.youtube.com/watch?v=${selectedVideoId}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Open on YouTube
                  </a>
                  
                  <button
                    onClick={() => {
                      setActiveTab('COACH');
                      if (videoQuery) {
                        setCoachForm(prev => ({ ...prev, exerciseName: videoQuery }));
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Activity className="w-4 h-4" /> Try with AI Coach
                  </button>
                </div>
              )}
            </div>
          ) : videoLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 animate-pulse">Searching for videos...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
              <Video className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">Search to find yoga/exercise videos</p>
              <p className="text-sm mt-1">Try: "Surya Namaskar", "Pushups", "Yoga for Back Pain"</p>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: LIVE AI COACH --- */}
      {activeTab === 'COACH' && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 animate-in fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Dumbbell className="w-6 h-6 text-green-400" /> Live AI Coach
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {coachForm.ailment ? `For: ${coachForm.ailment}` : 'Setup required'}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
              connected ? 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse' : 
              'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              {connected ? "LIVE ●" : "OFFLINE"}
            </div>
          </div>

          {/* STATS PANEL */}
          {connected && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-in slide-in-from-top">
              <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <div className="text-2xl font-bold text-yellow-400">{score}</div>
                </div>
                <div className="text-xs text-slate-300">SCORE</div>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-blue-400" />
                  <div className="text-2xl font-bold text-blue-400">{reps}</div>
                </div>
                <div className="text-xs text-slate-300">REPS</div>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <div className="text-2xl font-bold text-green-400">{level}</div>
                </div>
                <div className="text-xs text-slate-300">LEVEL</div>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <div className="text-2xl font-bold text-orange-400">{calories}</div>
                </div>
                <div className="text-xs text-slate-300">CALORIES</div>
              </div>
            </div>
          )}

          {/* AI FEEDBACK */}
          {connected && feedback && (
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4 animate-in fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-slate-200">AI Feedback</span>
                {isAnalyzing && (
                  <div className="ml-auto flex items-center gap-1 text-xs text-amber-400">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-300">{feedback}</p>
            </div>
          )}

          {/* SETUP FORM OR CAMERA VIEW */}
          {!isCoachSetupDone ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-400" /> Setup Your Session
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                      Injury / Condition
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Back Pain, Knee Injury, Shoulder Strain" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={coachForm.ailment}
                      onChange={e => setCoachForm({...coachForm, ailment: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                      Exercise Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Squats, Pushups, Plank, Yoga Stretch" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={coachForm.exerciseName}
                      onChange={e => setCoachForm({...coachForm, exerciseName: e.target.value})}
                    />
                  </div>
                  
                  <button 
                    onClick={() => setIsCoachSetupDone(true)}
                    disabled={!coachForm.ailment || !coachForm.exerciseName}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-3 rounded-lg font-bold mt-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Play className="w-5 h-5 fill-current" /> Open Camera & Start Session
                  </button>
                </div>
              </div>
              
              <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-400 text-center">
                  💡 <span className="font-medium">Tip:</span> Ensure good lighting and show your full body for best analysis
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* CAMERA VIEW */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700">
                <video 
                  ref={videoRef} 
                  muted 
                  className={`w-full h-full object-cover transform scale-x-[-1] ${!connected && 'opacity-50'}`} 
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {!connected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900/80 to-black/80">
                    <div className="text-center p-6">
                      <div className="bg-slate-800 p-4 rounded-full inline-block mb-4">
                        <Activity className="w-12 h-12 text-green-400" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Ready to Start</h4>
                      <p className="text-slate-300 mb-6 max-w-md">
                        You'll be doing <span className="font-bold text-green-300">{coachForm.exerciseName}</span> for <span className="font-bold text-blue-300">{coachForm.ailment}</span>.
                        AI will guide you in real-time.
                      </p>
                      <button 
                        onClick={startLiveSession}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-8 py-3 rounded-full font-bold shadow-lg transform hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                      >
                        <Play className="w-5 h-5 fill-current" /> Start Live Session
                      </button>
                    </div>
                  </div>
                )}
                
                {connected && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-end">
                    <div className="bg-slate-800/80 px-3 py-1 rounded text-sm text-green-300 border border-green-500/30 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      {coachStatus}
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-3 rounded-full transition-all ${
                          isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                        title={isMuted ? "Unmute Mic" : "Mute Mic"}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                      
                      <button 
                        onClick={stopSession}
                        className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                      >
                        <StopCircle className="w-4 h-4" /> End Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* EXERCISE INFO */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-200">
                      <span className="text-green-400">{coachForm.exerciseName}</span> Session
                    </h4>
                    <p className="text-sm text-slate-400">For: {coachForm.ailment}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">
                      {score >= 80 ? 'Excellent!' : 
                       score >= 50 ? 'Good Progress!' : 
                       'Keep Going!'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span className="text-slate-300">Live Feedback</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="w-4 h-4 text-purple-400" />
                      <span className="text-slate-300">Real-time Scoring</span>
                    </div>
                  </div>
                  
                  {connected && (
                    <div className="text-xs text-green-400 animate-pulse">
                      ● AI Coach Active
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
