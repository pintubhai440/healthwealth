import React, { useState } from 'react';
import { supabase } from '../services/supabase'; // ✅ Database connection joda
import { Building2, User, Shield, Stethoscope, ArrowRight, Lock, KeyRound, Mail, Loader2, LogIn } from 'lucide-react';

interface FlowAuthProps {
  onLogin: (role: string, name: string) => void;
}

export const FlowAuth: React.FC<FlowAuthProps> = ({ onLogin }) => {
  // Step 1: Selection (Business vs Personal)
  // Step 2: Role (Guardian vs Patient)
  // Step 3: Guardian Code Input
  // Step 4: Business/Doctor Login (AB YEH REAL DATABASE SE CHALEGA ✅)
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'patient' | 'guardian' | 'doctor'>('patient');
  const [code, setCode] = useState('');
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // ✅ Loading animation ke liye
  const [isSignUp, setIsSignUp] = useState(false); // ✅ Login/Signup switch ke liye

  const handleGuardianSubmit = () => {
    if (code.length > 0) {
      onLogin('guardian', 'Guardian User');
    } else {
      alert("Please enter a valid connection code.");
    }
  };

  // ✅ NAYA: Real Database Login Function
  const handleAuth = async () => {
      if (!email || !password) {
          alert("Please enter email and password");
          return;
      }

      setLoading(true);
      try {
          if (isSignUp) {
              // --- SIGN UP LOGIC (Naya Account) ---
              const { error } = await supabase.auth.signUp({
                  email: email,
                  password: password,
              });
              if (error) throw error;
              alert("Account Created! You can now Log In.");
              setIsSignUp(false); // Wapas login par bhejo
          } else {
              // --- LOGIN LOGIC (Purana Account) ---
              const { data, error } = await supabase.auth.signInWithPassword({
                  email: email,
                  password: password,
              });
              
              if (error) throw error;
              
              // Login Success!
              // Hum role ko 'doctor' maan rahe hain kyunki ye step 4 hai, 
              // par aap chaho toh 'patient' bhi bhej sakte ho.
              onLogin('doctor', data.user.email || 'Dr. User'); 
          }
      } catch (error: any) {
          alert(error.message || "Login failed. Check details.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
        
        {/* Background Design Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>

        {/* --- STEP 1: BUSINESS vs PERSONAL (SAME AS BEFORE) --- */}
        {step === 1 && (
          <div className="space-y-6">
             <h2 className="text-2xl font-bold text-slate-800 text-center">Select Account Type</h2>
             
             {/* Business Button */}
             <button 
                onClick={() => setStep(4)}
                className="w-full border-2 border-slate-100 p-4 rounded-2xl flex items-center gap-4 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group"
             >
                <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-slate-200 transition-colors">
                    <Building2 className="w-6 h-6 text-slate-500" />
                </div>
                <div className="text-left">
                    <h3 className="font-bold text-slate-800 text-lg">Business / Hospital</h3>
                    <p className="text-xs text-slate-500 font-medium">Doctors & Clinics Login</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-slate-500" />
             </button>

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

        {/* --- STEP 2: PATIENT vs GUARDIAN (SAME AS BEFORE) --- */}
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

        {/* --- STEP 3: GUARDIAN CODE INPUT (SAME AS BEFORE) --- */}
        {step === 3 && (
          <div className="space-y-6">
             <button onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
             <div className="text-center">
                 <div className="bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-teal-700" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">Enter Access Code</h2>
                 <p className="text-slate-500 text-sm mt-2">Enter the code provided by the patient.</p>
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
                <button 
                  onClick={handleGuardianSubmit}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-200 transition-all"
                >
                  Connect Profile
                </button>
             </div>
          </div>
        )}

        {/* --- STEP 4: BUSINESS LOGIN (UPDATED WITH SUPABASE ✅) --- */}
        {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right">
                <button onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
                
                <div className="text-center mb-6">
                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                        <Stethoscope className="w-8 h-8 text-white" />
                    </div>
                    {/* ✅ Header Text Changes Dynamically */}
                    <h2 className="text-2xl font-bold text-slate-800">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                    <p className="text-slate-500 text-sm mt-1">Secure Database Login</p>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center focus-within:ring-2 ring-blue-500">
                        <Mail className="w-5 h-5 text-slate-400 mr-3" />
                        <input 
                            type="email" 
                            placeholder="doctor@hospital.com"
                            className="bg-transparent outline-none w-full text-slate-800"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center focus-within:ring-2 ring-blue-500">
                        <Lock className="w-5 h-5 text-slate-400 mr-3" />
                        <input 
                            type="password" 
                            placeholder="••••••••"
                            className="bg-transparent outline-none w-full text-slate-800"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    
                    {/* ✅ REAL Login Button */}
                    <button 
                        onClick={handleAuth}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Sign Up" : <><LogIn className="w-4 h-4"/> Sign In</>)}
                    </button>
                </div>

                {/* ✅ Login/Signup Toggle */}
                <div className="text-center mt-4 border-t border-slate-100 pt-4">
                     <p className="text-sm text-slate-500">
                        {isSignUp ? "Already have an account?" : "New to MediGuard?"}
                        <button 
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="font-bold text-blue-600 ml-2 hover:underline"
                        >
                          {isSignUp ? "Log In" : "Create Account"}
                        </button>
                     </p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
