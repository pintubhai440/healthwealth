import React, { useState, useRef } from 'react';
import { Camera, Pill, CheckCircle, AlertTriangle, Loader2, Video, Bell, Mail } from 'lucide-react';
import { analyzeImage, analyzeMedicineVideo } from '../services/gemini';

export const MediScanner: React.FC = () => {
  const [mode, setMode] = useState<'ID' | 'VERIFY'>('ID');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type;

      try {
        if (mode === 'ID') {
          const res = await analyzeImage(base64String, mimeType, 'MEDICINE');
          setResult(res);
        } else {
          const res = await analyzeMedicineVideo(base64String, mimeType);
          setResult(res);
        }
      } catch (err) {
        console.error(err);
        setResult({ error: "Failed to analyze. Please ensure the media is clear." });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1 bg-slate-200 rounded-xl">
        <button
          onClick={() => { setMode('ID'); setResult(null); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${mode === 'ID' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Pill className="w-4 h-4" /> Identify Medicine
          </div>
        </button>
        <button
          onClick={() => { setMode('VERIFY'); setResult(null); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${mode === 'VERIFY' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Video className="w-4 h-4" /> Guardian Verify
          </div>
        </button>
      </div>

      {/* Upload Area */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-teal-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-teal-50 cursor-pointer hover:bg-teal-100 transition-colors"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept={mode === 'ID' ? "image/*" : "video/*"}
          onChange={handleFileChange}
        />
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          {mode === 'ID' ? <Camera className="w-8 h-8 text-teal-600" /> : <Video className="w-8 h-8 text-teal-600" />}
        </div>
        <p className="text-teal-900 font-medium">
          {mode === 'ID' ? "Tap to snap medicine photo" : "Upload 5s video for verification"}
        </p>
        <p className="text-teal-600 text-sm mt-1">
          {mode === 'ID' ? "We'll tell you what it is." : "Record yourself taking the pill."}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-8 text-teal-600">
          <Loader2 className="w-10 h-10 animate-spin mb-3" />
          <p className="animate-pulse font-medium">
             {mode === 'ID' ? "Analyzing Pill..." : "Processing Video (Gemini Flash)..."}
          </p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`p-4 ${result.error ? 'bg-red-500' : (mode === 'VERIFY' && !result.success) ? 'bg-red-600' : 'bg-teal-600'} text-white`}>
            <h3 className="font-bold flex items-center gap-2">
              {result.error || (mode === 'VERIFY' && !result.success) ? <AlertTriangle /> : <CheckCircle />}
              {mode === 'ID' ? "Medicine Identified" : "Guardian Verification"}
            </h3>
          </div>
          
          <div className="p-5 space-y-4">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : mode === 'ID' ? (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Name</label>
                  <p className="text-xl font-bold text-slate-800">{result.name || "Unknown"}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purpose</label>
                  <p className="text-slate-700">{result.purpose}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                  <label className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                     <AlertTriangle className="w-3 h-3" /> Dosage Warning
                  </label>
                  <p className="text-amber-800 text-sm mt-1">{result.dosage_warning}</p>
                </div>
              </>
            ) : (
              // GUARDIAN VERIFY RESULT
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Action Detected:</span>
                  <span className="font-medium text-slate-800">{result.action_detected}</span>
                </div>
                
                <div className={`mt-2 p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h4 className={`font-bold ${result.success ? 'text-green-800' : 'text-red-800'} mb-2`}>
                        {result.success ? "Medicine Taken ✅" : "Verification Failed ❌"}
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                        {result.success ? (
                            <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle className="w-4 h-4" /> 
                                <span>Status: Confirmed. Guardian not disturbed.</span>
                            </div>
                        ) : (
                            <div className="space-y-2 animate-in slide-in-from-left-2">
                                <p className="text-red-700 font-medium">Medicine intake not detected.</p>
                                <div className="flex items-center gap-2 text-slate-700 bg-white/50 p-2 rounded">
                                    <Bell className="w-4 h-4 text-amber-500" /> 
                                    <span>Reminder sent to User's Device</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700 bg-white/50 p-2 rounded">
                                    <Mail className="w-4 h-4 text-red-500" /> 
                                    <span>Alert Email sent to Family Guardian</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <p className="text-sm text-slate-600 italic border-t pt-3 mt-2">{result.verdict_message}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};