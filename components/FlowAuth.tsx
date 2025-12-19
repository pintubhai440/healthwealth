import React, { useState } from 'react';
import { Building2, User, Shield, Stethoscope, ArrowRight, Lock, KeyRound } from 'lucide-react';

interface FlowAuthProps {
  onLogin: (role: string, name: string) => void;
}

export const FlowAuth: React.FC<FlowAuthProps> = ({ onLogin }) => {
  // Step 1: Selection (Business vs Personal)
  // Step 2: Role (Guardian vs Patient)
  // Step 3: Guardian Code Input
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'patient' | 'guardian'>('patient');
  const [code, setCode] = useState('');

  const handleGuardianSubmit = () => {
    if (code.length > 0) {
      onLogin('guardian', 'Guardian User');
    } else {
      alert("Please enter a valid connection code.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
        
        {/* Background Design Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>

        {/* --- STEP 1: BUSINESS vs PERSONAL --- */}
        {step === 1 && (
          <div className="space-y-6">
             <h2 className="text-2xl font-bold text-slate-800 text-center">Select Account Type</h2>
             
             {/* Business (Future Scope) */}
             <div className="border-2 border-dashed border-slate-200 p-4 rounded-2xl flex items-center gap-4 opacity-60 cursor-not-allowed bg-slate-50">
                <div className="bg-slate-200 p-3 rounded-xl">
                    <Building2 className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-500">Business / Hospital</h3>
                    <p className="text-xs text-slate-400 font-medium bg-slate-200 inline-block px-2 py-0.5 rounded mt-1">Future Scope</p>
                </div>
             </div>

             {/* Customer (End User) */}
             <button 
               onClick={() => setStep(2)}
               className="w-full border-2 border-blue-100 p-4 rounded-2xl flex items-center gap-4 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm group"
             >
                <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                    <h3 className="font-bold text-slate-800 text-lg">Customer (End User)</h3>
                    <p className="text-xs text-blue-600 font-medium">Personal & Family Use</p>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400 ml-auto" />
             </button>
          </div>
        )}

        {/* --- STEP 2: PATIENT vs GUARDIAN --- */}
        {step === 2 && (
          <div className="space-y-6">
             <button onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
             <h2 className="text-2xl font-bold text-slate-800 text-center">Are you a...</h2>

             <div className="grid grid-cols-2 gap-4">
                 {/* Guardian Option */}
                 <button 
                   onClick={() => { setRole('guardian'); setStep(3); }}
                   className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-all gap-3 group"
                 >
                    <div className="bg-teal-100 p-4 rounded-full group-hover:bg-teal-200 transition-colors">
                        <Shield className="w-8 h-8 text-teal-700" />
                    </div>
                    <span className="font-bold text-slate-700">Guardian</span>
                 </button>

                 {/* Patient Option */}
                 <button 
                   onClick={() => onLogin('patient', 'Patient User')}
                   className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all gap-3 group"
                 >
                    <div className="bg-blue-100 p-4 rounded-full group-hover:bg-blue-200 transition-colors">
                        <Stethoscope className="w-8 h-8 text-blue-700" />
                    </div>
                    <span className="font-bold text-slate-700">Patient</span>
                 </button>
             </div>
          </div>
        )}

        {/* --- STEP 3: GUARDIAN CODE INPUT --- */}
        {step === 3 && (
          <div className="space-y-6">
             <button onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
             <div className="text-center">
                 <div className="bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-teal-700" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">Enter Access Code</h2>
                 <p className="text-slate-500 text-sm mt-2">Enter the code provided by the patient to monitor their health.</p>
             </div>

             <div className="space-y-4">
                <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Ex: P-1234"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-lg tracking-widest text-slate-800"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700">
                    ℹ️ <strong>Instructions:</strong> This code allows you to view the patient's medicine adherence and SOS alerts.
                </div>

                <button 
                  onClick={handleGuardianSubmit}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-200 transition-all"
                >
                  Connect Profile
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};
