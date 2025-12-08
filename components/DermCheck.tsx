import React, { useState, useRef } from 'react';
import { ScanFace, AlertOctagon, Info, Upload } from 'lucide-react';
import { analyzeImage } from '../services/gemini';

export const DermCheck: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const res = await analyzeImage(base64String, file.type, 'DERM');
        setResult(res);
      } catch (err) {
        setResult({ error: "Could not analyze image. Try a clearer photo." });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 flex gap-3">
        <AlertOctagon className="w-6 h-6 text-rose-500 flex-shrink-0" />
        <p className="text-sm text-rose-800">
          <strong>Disclaimer:</strong> This is an AI tool for educational purposes only. It is NOT a substitute for professional medical advice. Always consult a dermatologist.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
         <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-6 text-white text-center">
            <ScanFace className="w-12 h-12 mx-auto mb-2 opacity-90" />
            <h2 className="text-2xl font-bold">Derm-Check</h2>
            <p className="text-rose-100">AI Skin Condition Analyzer</p>
         </div>

         <div className="p-6">
            {!result && !loading && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition-all group"
              >
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
                 <Upload className="w-10 h-10 text-slate-400 group-hover:text-rose-500 mb-3 transition-colors" />
                 <span className="text-slate-500 font-medium group-hover:text-rose-600">Upload Skin Photo</span>
              </div>
            )}

            {loading && (
              <div className="h-64 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 animate-pulse">Analyzing textures and redness...</p>
              </div>
            )}

            {result && (
              <div className="animate-in fade-in duration-500">
                 {result.error ? (
                   <div className="text-center text-red-500 p-4">{result.error}</div>
                 ) : (
                   <div className="space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-800">{result.condition_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          result.verdict === 'Good' ? 'bg-green-100 text-green-700' :
                          result.verdict === 'Bad' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          Verdict: {result.verdict}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                          <Info className="w-4 h-4" /> Analysis
                        </h4>
                        <p className="text-slate-600 leading-relaxed">{result.explanation}</p>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg border-l-4 border-rose-500">
                        <h4 className="font-bold text-slate-800 mb-1">Recommended Action</h4>
                        <p className="text-slate-600 text-sm">{result.recommended_action}</p>
                      </div>

                      <button 
                        onClick={() => setResult(null)}
                        className="w-full py-3 bg-slate-100 text-slate-600 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                      >
                        Scan Another
                      </button>
                   </div>
                 )}
              </div>
            )}
         </div>
      </div>
    </div>
  );
};