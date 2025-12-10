import React, { useState, useRef } from 'react';
import { generateDietPlan, findYoutubeVideo, analyzeExerciseVideo } from '../services/gemini';
import { Play, Activity, Salad, Youtube, Loader2, Search, ExternalLink, Dumbbell, StopCircle, Video, CheckCircle, AlertCircle } from 'lucide-react';

export const RecoveryCoach: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PLAN' | 'VIDEO' | 'COACH'>('PLAN');

  // Diet State
  const [condition, setCondition] = useState('');
  const [days, setDays] = useState('3');
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [dietLoading, setDietLoading] = useState(false);

  // Video Search State
  const [videoQuery, setVideoQuery] = useState('');
  const [videoResults, setVideoResults] = useState<any[]>([]); // Array for multiple videos
  const [videoLoading, setVideoLoading] = useState(false);

  // AI Coach State (Record -> Stop -> Analyze)
  const [coachForm, setCoachForm] = useState({ ailment: '', exerciseName: '' });
  const [isCoachSetupDone, setIsCoachSetupDone] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [coachResult, setCoachResult] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  // --- Video Search Logic (3-5 Links) ---
  const handleVideoSearch = async () => {
      if(!videoQuery) return;
      setVideoLoading(true);
      setVideoResults([]);
      try {
          const videos = await findYoutubeVideo(videoQuery);
          if(videos && videos.length > 0) setVideoResults(videos);
          else alert("No videos found. Try a specific keyword like 'Back Pain Yoga'.");
      } catch(e) {
          console.error(e);
      } finally {
          setVideoLoading(false);
      }
  };

  // --- AI Coach Logic (Record -> Analyze) ---
  const openCamera = async () => {
     try {
         const stream = await navigator.mediaDevices.getUserMedia({ video: true });
         if (videoRef.current) {
             videoRef.current.srcObject = stream;
             videoRef.current.play();
         }
         setIsCoachSetupDone(true);
         setCoachResult(null);
     } catch(err) {
         alert("Camera permission denied.");
     }
  };

  const startRecording = () => {
      if (!videoRef.current?.srcObject) return;
      
      const stream = videoRef.current.srcObject as MediaStream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
          setIsAnalyzing(true);
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              try {
                  const result = await analyzeExerciseVideo(base64, 'video/webm', coachForm.ailment, coachForm.exerciseName);
                  setCoachResult(result);
              } catch (e) {
                  alert("Analysis failed. Try again.");
              } finally {
                  setIsAnalyzing(false);
              }
          };
      };

      recorder.start();
      setIsRecording(true);
  };

  const stopRecording = () => {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
  };

  const resetCoach = () => {
      setIsCoachSetupDone(false);
      setCoachResult(null);
      setCoachForm({ ailment: '', exerciseName: '' });
      if (videoRef.current?.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
  };

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

      {/* --- TAB 2: VIDEO SEARCH (LIST MODE 3-5 Links) --- */}
      {activeTab === 'VIDEO' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-2">AI Video Finder</h3>
            <p className="text-slate-500 text-sm mb-4">Find 3-5 best exercises for your condition.</p>
            
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
                    className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2"
                >
                    {videoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
                </button>
            </div>

            <div className="space-y-3">
                {videoResults.length > 0 ? (
                    videoResults.map((video: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100 transition-colors animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-4">
                                <div className="bg-red-100 p-3 rounded-full text-red-600">
                                    <Play className="w-5 h-5 fill-current" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base">{video.title}</h4>
                                    <p className="text-xs text-slate-500">{video.channel}</p>
                                </div>
                            </div>
                            <a 
                                href={`https://www.youtube.com/watch?v=${video.id}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        </div>
                    ))
                ) : (
                    !videoLoading && (
                        <div className="flex flex-col items-center justify-center h-32 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                            <Video className="w-8 h-8 mb-2 opacity-50" />
                            <p>Enter a topic to see top 3 results</p>
                        </div>
                    )
                )}
            </div>
        </div>
      )}

      {/* --- TAB 3: AI COACH (RECORD -> STOP -> SCORE) --- */}
      {activeTab === 'COACH' && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Dumbbell className="w-6 h-6 text-blue-400" /> AI Coach</h3>
                {isRecording && <div className="animate-pulse text-red-500 font-bold flex items-center gap-1">● REC</div>}
            </div>

            {!isCoachSetupDone ? (
                <div className="space-y-4 max-w-md mx-auto py-4">
                    <p className="text-slate-400 text-sm text-center mb-4">Tell me about your pain and exercise.</p>
                    <div className="space-y-3">
                        <label className="text-xs text-slate-400 uppercase font-bold">Where is the pain?</label>
                        <input type="text" placeholder="e.g. Lower Back" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-blue-500" value={coachForm.ailment} onChange={e => setCoachForm({...coachForm, ailment: e.target.value})} />
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs text-slate-400 uppercase font-bold">Exercise Name</label>
                        <input type="text" placeholder="e.g. Squats" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-blue-500" value={coachForm.exerciseName} onChange={e => setCoachForm({...coachForm, exerciseName: e.target.value})} />
                    </div>
                    <button onClick={openCamera} disabled={!coachForm.ailment || !coachForm.exerciseName} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold mt-4 shadow-lg shadow-blue-900/20">Open Camera Coach</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* VIDEO AREA */}
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                        {!coachResult && !isAnalyzing ? (
                             <video ref={videoRef} muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                        ) : isAnalyzing ? (
                             <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10">
                                 <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                                 <p className="text-blue-200 font-medium animate-pulse">Analyzing your form...</p>
                             </div>
                        ) : (
                             // RESULT OVERLAY
                             <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                                 <div className={`p-4 rounded-full mb-4 ${parseInt(coachResult.score) > 7 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                     <h2 className="text-5xl font-bold">{coachResult.score}/10</h2>
                                 </div>
                                 <h3 className="text-xl font-bold text-white mb-2">Analysis Complete</h3>
                                 <p className="text-slate-300 max-w-sm mb-6">{coachResult.feedback}</p>
                                 
                                 <div className="bg-slate-800 p-4 rounded-xl text-left w-full max-w-sm mb-6">
                                     <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Tips to Improve</h4>
                                     <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                                         {coachResult.tips?.map((tip: string, i: number) => <li key={i}>{tip}</li>)}
                                     </ul>
                                 </div>
                                 
                                 <button onClick={resetCoach} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-full text-sm font-bold">Try Another Exercise</button>
                             </div>
                        )}
                        
                        {/* CONTROLS (Only visible when no result) */}
                        {!coachResult && !isAnalyzing && (
                            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                                {!isRecording ? (
                                    <button onClick={startRecording} className="bg-red-600 hover:bg-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition-all border-4 border-slate-900">
                                        <div className="w-6 h-6 bg-white rounded-sm"></div> 
                                    </button>
                                ) : (
                                    <button onClick={stopRecording} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 border border-slate-600 animate-pulse">
                                        <StopCircle className="w-5 h-5 text-red-500" /> Stop & Analyze
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {!coachResult && (
                        <p className="text-center text-slate-500 text-xs">
                            {isRecording ? "Exercise now! Press Stop when done." : "Press the Red button to start recording."}
                        </p>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};
