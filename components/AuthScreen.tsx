import React, { useState } from 'react';
import { Mail, Lock, User, Stethoscope, ArrowRight, Activity } from 'lucide-react';

interface AuthProps {
  onLogin: (role: string) => void;
}

export const AuthScreen: React.FC<AuthProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    // Abhi ke liye bas login dikhane ke liye
    if (email && password) {
      onLogin(role);
    } else {
      alert("Please enter email and password demo");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            Sign in to MediGuard AI
          </p>
        </div>

        {/* Role Toggle */}
        <div className="bg-slate-100 p-1 rounded-xl flex mb-6">
          <button
            onClick={() => setRole('patient')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              role === 'patient' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <User className="w-4 h-4" /> Patient
          </button>
          <button
            onClick={() => setRole('doctor')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              role === 'doctor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Stethoscope className="w-4 h-4" /> Doctor
          </button>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 ml-1">EMAIL</label>
             <div className="flex items-center border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                <Mail className="w-5 h-5 text-slate-400 mr-3" />
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
             </div>
          </div>

          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 ml-1">PASSWORD</label>
             <div className="flex items-center border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                <Lock className="w-5 h-5 text-slate-400 mr-3" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
             </div>
          </div>
          
          {!isSignUp && (
            <div className="flex justify-end">
              <button className="text-xs font-bold text-blue-600 hover:text-blue-700">
                Forgot Password?
              </button>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button 
          onClick={handleSubmit}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl mt-8 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
        >
          {isSignUp ? "Sign Up" : "Sign In"} <ArrowRight className="w-5 h-5" />
        </button>

        {/* Toggle Login/Signup */}
        <div className="mt-6 text-center pt-6 border-t border-slate-100">
          <p className="text-slate-500 text-sm">
            {isSignUp ? "Already have an account?" : "New to MediGuard AI?"}
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-bold text-blue-600 ml-2 hover:underline"
            >
              {isSignUp ? "Sign In" : "Create Account"}
            </button>
          </p>
        </div>

        {/* Demo Text */}
        <div className="mt-8 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Demo Credentials</p>
            <p className="text-xs text-slate-500">Any email & password will work for now.</p>
        </div>

      </div>
    </div>
  );
};
