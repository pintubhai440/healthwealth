import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Building2, User, Shield, Stethoscope, ArrowRight, Lock, KeyRound, Mail, Loader2, LogIn, Activity, AlertCircle } from 'lucide-react';

interface FlowAuthProps {
  // ✅ UPDATE 1: onLogin ab optional 'guardianCode' bhi lega
  onLogin: (role: string, name: string, guardianCode?: string) => void;
}

export const FlowAuth: React.FC<FlowAuthProps> = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'patient' | 'guardian' | 'doctor'>('patient');
  
  // ✅ UPDATE 2: Guardian Name ka naya state
  const [code, setCode] = useState('');
  const [guardianName, setGuardianName] = useState('');

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Patient Profile Form State
  const [profile, setProfile] = useState({
    full_name: '',
    Last_name: '',
    age: '',
    gender: 'Male',
    height: '',
    weight: '',
    allergies: ''
  });

  // ✅ UPDATE 3: Submit function ab Name aur Code dono check karega
  const handleGuardianSubmit = () => {
    if (code.length > 0 && guardianName.length > 0) {
      onLogin('guardian', guardianName, code);
    } else {
      alert("Please enter both your Name and the Patient's Code.");
    }
  };

  // Auth Logic with Profile Saving (Same as before)
  const handleAuth = async () => {
      if (!email || !password) {
          alert("Please enter email and password");
          return;
      }

      setLoading(true);
      try {
          if (isSignUp) {
              const { data, error } = await supabase.auth.signUp({
                  email: email,
                  password: password,
              });
              if (error) throw error;

              if (role === 'patient' && data.user) {
                  const { error: profileError } = await supabase
                      .from('profiles')
                      .insert([
                          {
                              id: data.user.id,
                              email: email,
                              full_name: profile.full_name,
                              Last_name: profile.Last_name,
                              age: profile.age ? parseInt(profile.age) : null,
                              gender: profile.gender,
                              height: profile.height,
                              weight: profile.weight,
                              allergies: profile.allergies
                          }
                      ]);
                  if (profileError) console.error("Profile Save Error:", profileError);
              }

              alert("Account Created! You are logged in.");
              onLogin(role, profile.full_name || 'New User');

          } else {
              const { data, error } = await supabase.auth.signInWithPassword({
                  email: email,
                  password: password,
              });
              
              if (error) throw error;
              
              let displayName = data.user.email || 'User';
              if (role === 'patient') {
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', data.user.id)
                    .single();
                  if (profileData) displayName = profileData.full_name;
              }

              onLogin(role, displayName); 
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
        
        {/* Background Design */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>

        {/* --- STEP 1: BUSINESS vs PERSONAL --- */}
        {step === 1 && (
          <div className="space-y-6">
             <h2 className="text-2xl font-bold text-slate-800 text-center">Select Account Type</h2>
             
             {/* Business Button */}
             <button 
                onClick={() => { setRole('doctor'); setStep(4); }}
                className="w-full border-2 border-slate-100 p-4 rounded-2xl flex items-center gap-4 bg-white hover:bg-slate-50 transition-all shadow-sm group"
             >
                <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-slate-200">
                    <Building2 className="w-6 h-6 text-slate-500" />
                </div>
                <div className="text-left">
                    <h3 className="font-bold text-slate-800 text-lg">Business / Hospital</h3>
                    <p className="text-xs text-slate-500 font-medium">Doctors & Clinics Login</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 ml-auto" />
             </button>

             {/* Customer Button */}
             <button 
               onClick={() => setStep(2)}
               className="w-full border-2 border-blue-100 p-4 rounded-2xl flex items-center gap-4 bg-blue-50 hover:bg-blue-100 transition-all shadow-sm group"
             >
                <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200">
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
                 <button 
                   onClick={() => { setRole('guardian'); setStep(3); }}
                   className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-all gap-3"
                 >
                    <div className="bg-teal-100 p-4 rounded-full">
                        <Shield className="w-8 h-8 text-teal-700" />
                    </div>
                    <span className="font-bold text-slate-700">Guardian</span>
                 </button>

                 <button 
                   onClick={() => { setRole('patient'); setStep(5); }}
                   className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all gap-3"
                 >
                    <div className="bg-blue-100 p-4 rounded-full">
                        <Stethoscope className="w-8 h-8 text-blue-700" />
                    </div>
                    <span className="font-bold text-slate-700">Patient</span>
                 </button>
             </div>
          </div>
        )}

        {/* --- ✅ UPDATE 4: GUARDIAN STEP (Name + Code) --- */}
        {step === 3 && (
          <div className="space-y-6">
             <button onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
             <div className="text-center">
                 <div className="bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-teal-700" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">Guardian Access</h2>
                 <p className="text-slate-500 text-sm mt-2">Enter your name & patient's code.</p>
             </div>
             
             {/* 1. Guardian Name Input */}
             <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Your Name</label>
                <input 
                    type="text" 
                    placeholder="e.g. Papa / Ramesh"
                    className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                />
             </div>

             {/* 2. Access Code Input */}
             <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Patient Access Code</label>
                <input 
                    type="text" 
                    placeholder="e.g. P-1234"
                    className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                />
             </div>

             <button 
                onClick={handleGuardianSubmit} 
                className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all"
             >
                Connect to Patient
             </button>
          </div>
        )}

        {/* --- STEP 5: PATIENT PROFILE FORM --- */}
        {step === 5 && (
            <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                <div className="text-center mb-2">
                    <h2 className="text-xl font-bold text-slate-800">Your Health Profile</h2>
                    <p className="text-xs text-slate-500">This is helps your diet & recovery.</p>
                </div>

                <div className="space-y-3 h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Form Inputs (Same as before) */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Patient Name *</label>
                        <input type="text" value={profile.full_name} onChange={e=>setProfile({...profile, full_name: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none focus:border-blue-500" placeholder="e.g. Rahul Kumar" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Title (Optional)</label>
                        <input type="text" value={profile.Last_name} onChange={e=>setProfile({...profile, Last_name: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none" placeholder="e.g. chauhan / kumari / sigh" />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Age *</label>
                            <input type="number" value={profile.age} onChange={e=>setProfile({...profile, age: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none" placeholder="25" />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Gender *</label>
                            <select value={profile.gender} onChange={e=>setProfile({...profile, gender: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none">
                                <option>Male</option><option>Female</option><option>Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Height</label>
                            <input type="text" value={profile.height} onChange={e=>setProfile({...profile, height: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none" placeholder="5'10" />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Weight</label>
                            <input type="text" value={profile.weight} onChange={e=>setProfile({...profile, weight: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none" placeholder="70 kg" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Allergies (Important)</label>
                        <textarea value={profile.allergies} onChange={e=>setProfile({...profile, allergies: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg outline-none h-16 resize-none" placeholder="e.g. Peanuts, Dust, Penicillin" />
                    </div>
                </div>

                <button 
                    onClick={() => {
                        if(!profile.full_name || !profile.age) {
                            alert("Name and Age are required!");
                            return;
                        }
                        setIsSignUp(true); 
                        setStep(4); 
                    }}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200"
                >
                    Save & Continue
                </button>
            </div>
        )}

        {/* --- STEP 4: AUTH (Login/Signup) --- */}
        {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right">
                <button onClick={() => setStep(role === 'patient' ? 5 : 1)} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
                
                <div className="text-center mb-6">
                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                        {role === 'doctor' ? <Building2 className="w-8 h-8 text-white" /> : <User className="w-8 h-8 text-white" />}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                    <p className="text-slate-500 text-sm mt-1">{role === 'patient' ? "Secure your health data" : "Hospital Login"}</p>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center focus-within:ring-2 ring-blue-500">
                        <Mail className="w-5 h-5 text-slate-400 mr-3" />
                        <input 
                            type="email" 
                            placeholder="name@example.com"
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
                    
                    <button 
                        onClick={handleAuth}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Create & Save Profile" : "Sign In")}
                    </button>
                </div>

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
