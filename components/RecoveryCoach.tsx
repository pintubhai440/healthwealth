import React, { useState, useRef, useEffect } from 'react';
import { generateDietPlan, findYoutubeVideo, analyzeExerciseFrame } from '../services/gemini';
import { Play, Activity, Salad, Youtube, Loader2, Dumbbell, Search, Video, ExternalLink, StopCircle, Volume2, Trophy, RotateCcw } from 'lucide-react';

export const RecoveryCoach: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PLAN' | 'VIDEO' | 'COACH'>('PLAN');

  // Diet & Video State
  const [condition, setCondition] = useState('');
  const [days, setDays] = useState('3');
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [dietLoading, setDietLoading] = useState(false);
  const [videoQuery, setVideoQuery] = useState('');
  const [videoResults, setVideoResults] = useState<Array<{ title: string; videoId: string }>>([]);
  const [videoLoading, setVideoLoading] = useState(false);

  // Live Coach State
  const [isCoachActive, setIsCoachActive] = useState(false);
  const [coachForm, setCoachForm] = useState({ ailment: '', exerciseName: '' });
  const [isCoachSetupDone, setIsCoachSetupDone] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState("AI Waiting...");
  const [feedbackColor, setFeedbackColor] = useState("text-slate-200");
  
  // 🔥 NEW: Scoring State
  const [repCount, setRepCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<any>(null);

  // Browser Speech
  const speakFeedback = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

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

  // --- Video Search Logic ---
  const handleVideoSearch = async () => {
      if(!videoQuery) return;
      setVideoLoading(true);
      setVideoResults([]);
      try {
          const results = await findYoutubeVideo(videoQuery);
          if (results && results.length > 0) setVideoResults(results);
          else alert("No videos found.");
      } catch(e) { console.error(e); } 
      finally { setVideoLoading(false); }
  };

  // --- LIVE COACH LOGIC ---
  const startCoaching = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      
      setIsCoachActive(true);
      setShowSummary(false); // Hide summary if restarting
      setRepCount(0);        // Reset Score
      setCoachFeedback("Connecting...");
      speakFeedback("Starting session. Let's count those reps.");

      intervalRef.current = setInterval(async () => {
         if (!videoRef.current || !canvasRef.current) return;
         
         const ctx = canvasRef.current.getContext('2d');
         if(ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            
            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.4).split(',')[1];
            
            setCoachFeedback("Watching...");
            
            const feedback = await analyzeExerciseFrame(base64, coachForm.ailment, coachForm.exerciseName);
            
            if (feedback && feedback.length > 2) {
                setCoachFeedback(feedback);
                
                // 🔥 SCORING LOGIC: Agar feedback negative nahi hai, toh count badhao
                const isNegative = feedback.toLowerCase().includes("stop") || feedback.toLowerCase().includes("bad") || feedback.toLowerCase().includes("wrong");
                
                if (isNegative) {
                    setFeedbackColor("text-red-400 font-bold animate-pulse");
                } else {
                    setFeedbackColor("text-green-400 font-medium");
                    // Increment Score
                    setRepCount(prev => prev + 1);
                }

                speakFeedback(feedback);
            }
         }
      }, 4000); 

    } catch (err) {
      alert("Camera access failed.");
      setIsCoachActive(false);
    }
  };

  const stopCoaching = () => {
     if (isCoachActive) {
        // 🔥 Show Summary when manually stopped
        setShowSummary(true);
        speakFeedback(`Session finished. You completed approximately ${repCount} good repetitions.`);
     }

     setIsCoachActive(false);
     if (intervalRef.current) clearInterval(intervalRef.current);
     if (window.speechSynthesis) window.speechSynthesis.cancel();
     if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
     }
  };

  useEffect(() => { return () => stopCoaching(); }, []);

  return (
    <div className="space-y-6">
      {/* TABS */}
      <div className="flex p-1 bg-slate-200 rounded-xl overflow-x-auto">
        <button onClick={() => setActiveTab('PLAN')} className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'PLAN' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}>
          <Salad className="w-4 h-4" /> Diet Plan
        </button>
        <button onClick={() => setActiveTab('VIDEO')} className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'VIDEO' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}>
          <Youtube className="w-4 h-4" /> Video Search
        </button>
        <button onClick={() => setActiveTab('COACH')} className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'COACH' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
          <Activity className="w-4 h-4" /> AI Coach
        </button>
      </div>

      {/* --- TAB 1: DIET PLAN --- */}
      {activeTab === 'PLAN' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Recovery Diet Generator</h3>
            <div className="flex flex-col md:flex-row gap-2 mb-6">
                <input type="text" placeholder="Condition (e.g. Viral Fever)" value={condition} onChange={(e) => setCondition(e.target.value)} className="flex-1 p-3 border rounded-xl bg-slate-50 outline-none" />
                <select value={days} onChange={(e) => setDays(e.target.value)} className="p-3 border rounded-xl bg-slate-50 outline-none">
                    <option value="3">3 Days</option><option value="7">7 Days</option>
                </select>
                <button onClick={handleGetDiet} disabled={dietLoading || !condition} className="bg-emerald-600 text-white px-6 rounded-xl font-bold">
                    {dietLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate"}
                </button>
            </div>
            {dietPlan && (
                <div className="space-y-4">
                    <div className="bg-emerald-50 p-4 rounded-xl text-emerald-800 text-sm">{dietPlan.advice}</div>
                    <div className="grid md:grid-cols-3 gap-4">
                        {dietPlan.meals?.map((meal: any, idx: number) => (
                            <div key={idx} className="border p-4 rounded-xl">
                                <h5 className="font-bold text-emerald-600 text-sm uppercase mb-2">{meal.name}</h5>
                                <ul className="list-disc list-inside text-sm text-slate-600">{meal.items.map((it: string, i: number) => <li key={i}>{it}</li>)}</ul>
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
            <h3 className="text-xl font-bold text-slate-800 mb-2">AI Video Finder</h3>
            <div className="flex gap-2 mb-6">
                <input type="text" placeholder="Enter Exercise name..." value={videoQuery} onChange={(e) => setVideoQuery(e.target.value)} className="flex-1 p-3 border rounded-xl bg-slate-50 outline-none" />
                <button onClick={handleVideoSearch} disabled={!videoQuery || videoLoading} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                    {videoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
                </button>
            </div>
            {videoResults.length > 0 ? (
                <div className="grid gap-3">
                    {videoResults.map((video, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 mb-3 sm:mb-0 w-full sm:w-auto">
                                <div className="bg-red-50 p-2 rounded-lg text-red-600"><Youtube className="w-6 h-6" /></div>
                                <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{video.title}</h4>
                            </div>
                            <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                                <Play className="w-4 h-4" /> Watch <ExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                        </div>
                    ))}
                </div>
            ) : !videoLoading && <div className="text-center text-slate-400 py-10">Search to find videos</div>}
        </div>
      )}

      {/* --- TAB 3: LIVE COACH (SCORING & SUMMARY) --- */}
      {activeTab === 'COACH' && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Dumbbell className="w-6 h-6 text-green-400" /> Live AI Coach</h3>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isCoachActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{isCoachActive ? "ACTIVE ●" : "READY"}</div>
            </div>
            {!isCoachSetupDone ? (
                <div className="space-y-4">
                    <input type="text" placeholder="Your Injury (e.g. Lower Back Pain)" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none" value={coachForm.ailment} onChange={e => setCoachForm({...coachForm, ailment: e.target.value})} />
                    <input type="text" placeholder="Exercise you want to do (e.g. Deadlift)" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none" value={coachForm.exerciseName} onChange={e => setCoachForm({...coachForm, exerciseName: e.target.value})} />
                    <button onClick={() => setIsCoachSetupDone(true)} disabled={!coachForm.ailment || !coachForm.exerciseName} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold mt-2">Setup Coach</button>
                </div>
            ) : (
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 mb-4 group">
                    <video ref={videoRef} muted className={`w-full h-full object-cover transform scale-x-[-1] ${!isCoachActive && 'opacity-50'}`} />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* START BUTTON */}
                    {!isCoachActive && !showSummary && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <button onClick={startCoaching} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-bold shadow-lg transform hover:scale-105 transition-all flex items-center gap-2">
                                <Play className="w-5 h-5 fill-current" /> Start Analysis
                            </button>
                        </div>
                    )}

                    {/* LIVE OVERLAY */}
                    {isCoachActive && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col items-center">
                             <div className="flex items-center justify-between w-full mb-4 px-4">
                                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest">
                                    <Volume2 className="w-3 h-3 animate-pulse" /> AI Speaking
                                </div>
                                <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                                    <Trophy className="w-3 h-3 text-yellow-400" />
                                    <span className="text-sm font-bold text-yellow-400">Score: {repCount}</span>
                                </div>
                             </div>
                             
                            <div className={`text-xl font-bold text-center mb-4 px-4 py-2 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 ${feedbackColor}`}>
                                "{coachFeedback}"
                            </div>
                            <button onClick={stopCoaching} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                                <StopCircle className="w-4 h-4" /> Stop Session
                            </button>
                        </div>
                    )}

                    {/* 🔥 SUMMARY REPORT (Stop dabane ke baad) */}
                    {showSummary && !isCoachActive && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                            <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                            <h3 className="text-2xl font-bold text-white mb-2">Session Complete!</h3>
                            <p className="text-slate-300 mb-6">You maintained good form for:</p>
                            
                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-8">
                                {repCount}
                            </div>
                            
                            <button 
                                onClick={() => { setShowSummary(false); startCoaching(); }}
                                className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" /> Restart Session
                            </button>
                            <button 
                                onClick={() => setShowSummary(false)}
                                className="mt-4 text-slate-400 text-sm hover:text-white underline"
                            >
                                Close
                            </button>
                        </div>
                    )}
                    
                    {!isCoachActive && !showSummary && (
                        <button onClick={() => setIsCoachSetupDone(false)} className="absolute top-4 left-4 text-xs text-slate-400 hover:text-white underline">
                            ← Change Setup
                        </button>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};
