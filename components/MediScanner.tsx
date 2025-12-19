import React, { useState, useRef, useEffect } from 'react';
import { Camera, Pill, CheckCircle, AlertTriangle, Loader2, Video, Mail, User, Heart, Send, ArrowRight, FileText, ClipboardList, Activity } from 'lucide-react';
import { analyzeImage, analyzeMedicineVideo } from '../services/gemini';
import { supabase } from '../services/supabase'; 
import emailjs from '@emailjs/browser';

// ==========================================
// CONFIG: EmailJS Setup
// ==========================================
const EMAIL_CONFIG = {
  SERVICE_ID: "service_bf8gm8x",
  TEMPLATE_ID: "template_gdclmll",
  PUBLIC_KEY: "US_ygwyKqgstVBeVe"
};

// ✅ Interface update kiya: 'REPORT' mode add kiya
interface MediScannerProps {
  defaultMode?: 'ID' | 'VERIFY' | 'REPORT';
  hideTabs?: boolean;
}

export const MediScanner: React.FC<MediScannerProps> = ({ defaultMode = 'ID', hideTabs = false }) => {
  // ✅ Mode state mein 'REPORT' add kiya
  const [mode, setMode] = useState<'ID' | 'VERIFY' | 'REPORT'>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ✅ User Profile State (Allergy Check aur Report Analysis ke liye)
  const [userProfile, setUserProfile] = useState<any>(null);

  // GUARDIAN FORM STATE (Purana Feature - Safe hai)
  const [guardianForm, setGuardianForm] = useState({
    patientName: '',
    relation: 'Father',
    email: '' 
  });
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // ✅ Profile Fetch Effect
  useEffect(() => {
    const loadProfile = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if(user) {
         const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
         if(data) setUserProfile(data);
       }
    };
    loadProfile();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);
    setEmailStatus(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type;

      try {
        if (mode === 'ID') {
          // Medicine ID Logic (Purana)
          const res = await analyzeImage(base64String, mimeType, 'MEDICINE', userProfile);
          setResult(res);
        } else if (mode === 'REPORT') {
          // ✅ NAYA LOGIC: Report Analysis
          // Note: Ensure services/gemini.ts is updated to handle 'REPORT' type
          const res = await analyzeImage(base64String, mimeType, 'REPORT', userProfile);
          setResult(res);
        } else {
          // Video Verification Logic (Purana)
          const res = await analyzeMedicineVideo(base64String, mimeType);
          setResult(res);
          handleEmailAlert(res, guardianForm);
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

  const handleEmailAlert = async (res: any, details: any) => {
      if (EMAIL_CONFIG.PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
          setEmailStatus("setup_needed");
          return;
      }

      setEmailStatus("sending");
      
      const statusMessage = res.success 
        ? `Great news! ${details.patientName} (${details.relation}) has successfully taken their medicine.`
        : `URGENT ALERT: ${details.patientName} (${details.relation}) has MISSED or NOT taken their medicine properly. Please check on them immediately.`;

      const emailParams = {
        to_name: "Guardian",
        to_email: details.email,
        message: statusMessage,
        patient_name: details.patientName,
        status: res.success ? "MEDICINE TAKEN ✅" : "MISSED ALERT ⚠️"
      };

      try {
        await emailjs.send(
            EMAIL_CONFIG.SERVICE_ID,
            EMAIL_CONFIG.TEMPLATE_ID,
            emailParams,
            EMAIL_CONFIG.PUBLIC_KEY
        );
        setEmailStatus("sent");
      } catch (error) {
        console.error("Email Failed:", error);
        setEmailStatus("failed");
      }
  };

  return (
    <div className="space-y-6">
      {/* ✅ Tabs: Ab 3 Tabs hain (Reports Add kiya) */}
      {!hideTabs && (
        <div className="flex p-1 bg-slate-200 rounded-xl overflow-x-auto">
          <button
            onClick={() => { setMode('ID'); setResult(null); }}
            className={`flex-1 py-2 px-2 rounded-lg font-medium text-xs md:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-2 ${mode === 'ID' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}
          >
             <Pill className="w-4 h-4" /> Identify
          </button>
          
          <button
            onClick={() => { setMode('VERIFY'); setResult(null); }}
            className={`flex-1 py-2 px-2 rounded-lg font-medium text-xs md:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-2 ${mode === 'VERIFY' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
          >
             <Video className="w-4 h-4" /> Guardian
          </button>

          {/* 🔥 NEW TAB: LAB REPORT */}
          <button
            onClick={() => { setMode('REPORT'); setResult(null); }}
            className={`flex-1 py-2 px-2 rounded-lg font-medium text-xs md:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-2 ${mode === 'REPORT' ? 'bg-white shadow text-purple-700' : 'text-slate-500'}`}
          >
             <FileText className="w-4 h-4" /> Reports
          </button>
        </div>
      )}

      {/* GUARDIAN FORM (Sirf Verify Mode me dikhega - Purana Feature) */}
      {mode === 'VERIFY' && !isFormSubmitted && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 animate-in fade-in">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" /> Patient Setup
              </h3>
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Patient Name</label>
                      <div className="flex items-center bg-slate-50 rounded-lg px-3 border focus-within:ring-2 ring-blue-200">
                          <User className="w-4 h-4 text-slate-400" />
                          <input 
                             type="text" 
                             className="w-full bg-transparent p-3 outline-none text-slate-800"
                             placeholder="E.g. Ramesh Ji"
                             value={guardianForm.patientName}
                             onChange={e => setGuardianForm({...guardianForm, patientName: e.target.value})}
                          />
                      </div>
                  </div>
                  
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Relation</label>
                      <select 
                         className="w-full bg-slate-50 p-3 rounded-lg border outline-none text-slate-800"
                         value={guardianForm.relation}
                         onChange={e => setGuardianForm({...guardianForm, relation: e.target.value})}
                      >
                          <option>Father</option>
                          <option>Mother</option>
                          <option>Grandfather</option>
                          <option>Grandmother</option>
                          <option>Other</option>
                      </select>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Guardian Email</label>
                      <div className="flex items-center bg-slate-50 rounded-lg px-3 border focus-within:ring-2 ring-blue-200">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <input 
                             type="email" 
                             className="w-full bg-transparent p-3 outline-none text-slate-800"
                             placeholder="guardian@example.com"
                             value={guardianForm.email}
                             onChange={e => setGuardianForm({...guardianForm, email: e.target.value})}
                          />
                      </div>
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Real-time Email Alerts
                      </p>
                  </div>

                  <button 
                      onClick={() => setIsFormSubmitted(true)}
                      disabled={!guardianForm.patientName || !guardianForm.email}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                      Save & Continue <ArrowRight className="w-4 h-4" />
                  </button>
              </div>
          </div>
      )}

      {/* Upload Area (Updated for 3 Modes) */}
      {((mode === 'ID' || mode === 'REPORT') || (mode === 'VERIFY' && isFormSubmitted)) && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-opacity-50 transition-colors relative overflow-hidden group 
              ${mode === 'REPORT' ? 'border-purple-200 bg-purple-50 hover:bg-purple-100' : 'border-teal-200 bg-teal-50 hover:bg-teal-100'}
            `}
          >
            {mode === 'VERIFY' && (
                <div className="absolute top-2 right-2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div> LIVE
                </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept={mode === 'VERIFY' ? "video/*" : "image/*"}
              capture={mode === 'VERIFY' ? "user" : undefined} 
              onChange={handleFileChange}
            />
            
            <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
              {mode === 'ID' && <Camera className="w-8 h-8 text-teal-600" />}
              {mode === 'VERIFY' && <Video className="w-8 h-8 text-blue-600" />}
              {/* ✅ Naya Icon Reports ke liye */}
              {mode === 'REPORT' && <ClipboardList className="w-8 h-8 text-purple-600" />}
            </div>
            
            <p className="text-teal-900 font-medium text-center">
              {mode === 'ID' ? "Tap to snap medicine photo" : 
               mode === 'VERIFY' ? `Record ${guardianForm.patientName} taking medicine` : 
               "Upload Lab Report (Photo)"}
            </p>
            <p className="text-teal-600 text-sm mt-1">
              {mode === 'ID' ? "We'll tell you what it is." : 
               mode === 'VERIFY' ? "Max 5 seconds video." : 
               "Blood Test, Thyroid, CBC, etc."}
            </p>
            
            {mode === 'VERIFY' && (
                <button 
                   onClick={(e) => { e.stopPropagation(); setIsFormSubmitted(false); setResult(null); }}
                   className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
                >
                    Change Patient Details
                </button>
            )}
          </div>
      )}

      {/* Loading & Results */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-8 text-teal-600">
          <Loader2 className="w-10 h-10 animate-spin mb-3" />
          <p className="animate-pulse font-medium">
             {mode === 'ID' ? "Analyzing Pill..." : 
              mode === 'VERIFY' ? "Guardian AI is Verifying..." : 
              "Reading Lab Report..."}
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`p-4 text-white font-bold flex items-center gap-2
            ${result.error ? 'bg-red-500' : 
              mode === 'REPORT' ? 'bg-purple-600' : 
              (mode === 'VERIFY' && !result.success) ? 'bg-red-600' : 'bg-teal-600'}`}>
            
            <h3 className="font-bold flex items-center gap-2">
              {result.error || (mode === 'VERIFY' && !result.success) ? <AlertTriangle /> : <CheckCircle />}
              {mode === 'ID' ? "Medicine Identified" : 
               mode === 'VERIFY' ? "Guardian Status Report" : 
               "Report Analysis"}
            </h3>
          </div>
          
          <div className="p-5 space-y-4">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : mode === 'REPORT' ? (
              // ✅ NAYA FEATURE: REPORT DISPLAY UI
              <div className="space-y-4">
                 <div className="flex justify-between items-start">
                    <div>
                       <h3 className="font-bold text-lg text-slate-800">{result.report_type || "Medical Report"}</h3>
                       <p className="text-sm text-slate-500">{result.summary}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold 
                      ${result.overall_status?.includes('Normal') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {result.overall_status}
                    </span>
                 </div>

                 {/* Findings Table */}
                 <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                          <tr>
                             <th className="p-3">Parameter</th>
                             <th className="p-3">Value</th>
                             <th className="p-3">Meaning</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {result.findings?.map((item: any, idx: number) => (
                             <tr key={idx} className={item.status !== 'Normal' ? 'bg-amber-50/50' : ''}>
                                <td className="p-3 font-medium text-slate-800">{item.parameter}</td>
                                <td className="p-3">
                                   <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                      item.status === 'High' ? 'bg-red-100 text-red-700' : 
                                      item.status === 'Low' ? 'bg-blue-100 text-blue-700' : 
                                      'bg-green-100 text-green-700'
                                   }`}>
                                      {item.value} ({item.status})
                                   </span>
                                </td>
                                <td className="p-3 text-slate-500 text-xs">{item.meaning}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>

                 {/* Health Tips */}
                 <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <h4 className="font-bold text-purple-800 text-sm mb-2 flex items-center gap-2">
                       <Activity className="w-4 h-4" /> AI Recommendations
                    </h4>
                    <ul className="list-disc list-inside text-sm text-purple-900 space-y-1">
                       {result.health_tips?.map((tip: string, i: number) => (
                          <li key={i}>{tip}</li>
                       ))}
                    </ul>
                 </div>
              </div>

            ) : mode === 'ID' ? (
               // ID MODE RESULT (PURANA)
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
                  <p className="text-xl font-bold text-slate-800 mb-2">{result.name || "Unknown"}</p>
                  <label className="text-xs font-bold text-slate-400 uppercase">Purpose</label>
                  <p className="text-slate-700">{result.purpose}</p>
                  {result.dosage_warning && (
                      <div className="mt-2 bg-amber-50 p-2 rounded text-xs text-amber-700 border border-amber-200">
                          ⚠️ {result.dosage_warning}
                      </div>
                  )}
               </div>
            ) : (
              // GUARDIAN VERIFY RESULT (PURANA)
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Action:</span>
                  <span className="font-medium text-slate-800">{result.action_detected}</span>
                </div>
                
                <div className={`mt-2 p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h4 className={`font-bold ${result.success ? 'text-green-800' : 'text-red-800'} mb-2`}>
                        {result.success ? "Medicine Taken ✅" : "Missed / Not Taken ❌"}
                    </h4>
                    
                    <div className="mt-3 bg-white p-3 rounded border border-slate-200 shadow-inner">
                        <div className="flex items-center gap-2 mb-2">
                            {emailStatus === "sending" ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : emailStatus === "sent" ? (
                                <Mail className="w-4 h-4 text-green-500" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Guardian Alert System
                            </span>
                        </div>
                        
                        <p className={`text-sm font-medium ${
                            emailStatus === "sending" ? 'text-slate-400' : 
                            emailStatus === "sent" ? 'text-green-700' : 'text-red-600'
                        }`}>
                            {emailStatus === "setup_needed" ? "⚠️ Configure EmailJS in code to send alerts." :
                             emailStatus === "sending" ? `Sending email to ${guardianForm.email}...` : 
                             emailStatus === "sent" ? `Alert successfully sent to ${guardianForm.email} ✅` :
                             "Failed to send email alert. Check Console."}
                        </p>
                    </div>
                </div>
                <p className="text-sm text-slate-600 italic border-t pt-3 mt-2">"{result.verdict_message}"</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
