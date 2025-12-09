import React, { useState, useRef } from 'react';
import { Camera, Pill, CheckCircle, AlertTriangle, Loader2, Video, Mail, User, Heart, Send, ArrowRight } from 'lucide-react';
import { analyzeImage, analyzeMedicineVideo } from '../services/gemini';
import emailjs from '@emailjs/browser';

// ==========================================
// CONFIG: EmailJS Setup (Free Account)
// ==========================================
// 1. Go to https://www.emailjs.com/ -> Sign Up
// 2. Add Service (Gmail) -> Copy Service ID
// 3. Create Template -> Copy Template ID
// 4. Account -> Copy Public Key
const EMAIL_CONFIG = {
  SERVICE_ID: "service_bf8gm8x",     // Yahan Apna Service ID daalo
  TEMPLATE_ID: "template_gdclmll",   // Yahan Apna Template ID daalo
  PUBLIC_KEY: "US_ygwyKqgstVBeVe"      // Yahan Apni Public Key daalo
};

export const MediScanner: React.FC = () => {
  const [mode, setMode] = useState<'ID' | 'VERIFY'>('ID');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GUARDIAN FORM STATE
  const [guardianForm, setGuardianForm] = useState({
    patientName: '',
    relation: 'Father',
    email: '' 
  });
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

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
          // Identify Medicine Logic (TOUCHED NOTHING HERE)
          const res = await analyzeImage(base64String, mimeType, 'MEDICINE');
          setResult(res);
        } else {
          // VIDEO VERIFICATION LOGIC
          const res = await analyzeMedicineVideo(base64String, mimeType);
          setResult(res);
          
          // SEND REAL EMAIL ALERT
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

  // 🚀 REAL EMAIL SENDER LOGIC
  const handleEmailAlert = async (res: any, details: any) => {
      // Check if config is placeholder
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
        console.log("Real Email Sent Successfully!");
      } catch (error) {
        console.error("Email Failed:", error);
        setEmailStatus("failed");
      }
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

      {/* GUARDIAN FORM (Sirf Verify Mode me dikhega) */}
      {mode === 'VERIFY' && !isFormSubmitted && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 animate-in fade-in">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" /> Patient Setup
              </h3>
              <div className="space-y-4">
                  {/* Name Input */}
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
                  
                  {/* Relation Input */}
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

                  {/* Email Input */}
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

      {/* Upload Area (ID Mode ya Form submit hone ke baad) */}
      {((mode === 'ID') || (mode === 'VERIFY' && isFormSubmitted)) && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-teal-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-teal-50 cursor-pointer hover:bg-teal-100 transition-colors relative overflow-hidden group"
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
              accept={mode === 'ID' ? "image/*" : "video/*"}
              capture={mode === 'VERIFY' ? "user" : undefined} 
              onChange={handleFileChange}
            />
            <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
              {mode === 'ID' ? <Camera className="w-8 h-8 text-teal-600" /> : <Video className="w-8 h-8 text-blue-600" />}
            </div>
            <p className="text-teal-900 font-medium text-center">
              {mode === 'ID' ? "Tap to snap medicine photo" : `Record ${guardianForm.patientName} taking medicine`}
            </p>
            <p className="text-teal-600 text-sm mt-1">
              {mode === 'ID' ? "We'll tell you what it is." : "Max 5 seconds video."}
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
             {mode === 'ID' ? "Analyzing Pill..." : "Guardian AI is Verifying..."}
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`p-4 ${result.error ? 'bg-red-500' : (mode === 'VERIFY' && !result.success) ? 'bg-red-600' : 'bg-teal-600'} text-white`}>
            <h3 className="font-bold flex items-center gap-2">
              {result.error || (mode === 'VERIFY' && !result.success) ? <AlertTriangle /> : <CheckCircle />}
              {mode === 'ID' ? "Medicine Identified" : "Guardian Status Report"}
            </h3>
          </div>
          
          <div className="p-5 space-y-4">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : mode === 'ID' ? (
               // ID MODE RESULT (TOUCHED NOTHING)
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
              // GUARDIAN VERIFY RESULT (EMAIL ONLY)
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Action:</span>
                  <span className="font-medium text-slate-800">{result.action_detected}</span>
                </div>
                
                <div className={`mt-2 p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h4 className={`font-bold ${result.success ? 'text-green-800' : 'text-red-800'} mb-2`}>
                        {result.success ? "Medicine Taken ✅" : "Missed / Not Taken ❌"}
                    </h4>
                    
                    {/* EMAIL STATUS BOX */}
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
