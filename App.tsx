import React, { useState } from 'react';
import { FeatureView } from './types';
import { TriageBot } from './components/TriageBot';
import { MediScanner } from './components/MediScanner';
import { DermCheck } from './components/DermCheck';
import { RecoveryCoach } from './components/RecoveryCoach';
import { FlowAuth } from './components/FlowAuth'; // ✅ Naya Auth Import
import { HeartPulse, Stethoscope, Scan, Activity, ChevronRight, Pill, ShieldPlus, LogOut, Siren } from 'lucide-react';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>('patient');
  const [userName, setUserName] = useState<string>('');

  const [view, setView] = useState<FeatureView>(FeatureView.HOME);

  // Login Handler (FlowAuth se connect hai)
  const handleLogin = (role: string, name: string) => {
    setUserRole(role);
    setUserName(name);
    setIsAuthenticated(true);
  };

  // Logout Handler
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole('patient');
    setView(FeatureView.HOME);
  };

  // ✅ SOS Alert Handler (Drawing Feature)
  const handleSOS = () => {
    alert("🆘 SOS ALERT SENT! \n\nEmergency contacts and nearby hospitals have been notified with your live location.");
  };

  // ✅ MAIN LOGIC: Agar login nahi hai, to Drawing wala Flow dikhao
  if (!isAuthenticated) {
    return <FlowAuth onLogin={handleLogin} />;
  }

  // --- APP DASHBOARD (Features same rahenge) ---
  const features = [
    {
      id: FeatureView.TRIAGE,
      title: "Smart Triage",
      desc: "Chat with AI Doctor for instant diagnosis.",
      icon: <Stethoscope className="w-8 h-8 text-teal-500" />,
      color: "bg-teal-50 hover:bg-teal-100 border-teal-200"
    },
    {
      id: FeatureView.MEDISCAN,
      title: "Medi-Scanner",
      desc: "Identify pills & verify adherence with video.",
      icon: <Pill className="w-8 h-8 text-blue-500" />,
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200"
    },
    {
      id: FeatureView.DERMCHECK,
      title: "Derm-Check",
      desc: "Scan skin issues for an instant verdict.",
      icon: <Scan className="w-8 h-8 text-rose-500" />,
      color: "bg-rose-50 hover:bg-rose-100 border-rose-200"
    },
    {
      id: FeatureView.RECOVERY,
      title: "Recovery Studio",
      desc: "Diet plans & Live AI Coach.",
      icon: <Activity className="w-8 h-8 text-emerald-500" />,
      color: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            onClick={() => setView(FeatureView.HOME)} 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="bg-teal-600 p-2 rounded-lg">
               <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600 hidden md:block">
              MediGuard AI
            </h1>
            <h1 className="text-xl font-bold text-teal-600 md:hidden">MediGuard</h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* ✅ SOS BUTTON (Drawing Request) */}
             <button 
                onClick={handleSOS}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 animate-pulse shadow-lg shadow-red-200"
             >
                <Siren className="w-4 h-4" /> <span className="hidden md:inline">SOS</span>
             </button>

             {view !== FeatureView.HOME && (
                <button 
                  onClick={() => setView(FeatureView.HOME)}
                  className="text-sm font-medium text-slate-500 hover:text-teal-600 hidden md:block"
                >
                  Home
                </button>
             )}
             
             <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                title="Sign Out"
             >
                <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {view === FeatureView.HOME && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3 mb-10">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${userRole === 'guardian' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-700'}`}>
                  {userRole === 'guardian' ? '🛡️ Guardian Mode' : '👤 Patient Dashboard'}
              </span>
              
              <h2 className="text-3xl font-bold text-slate-800">
                Hello, {userRole === 'guardian' ? 'Guardian' : 'Patient'}
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                {userRole === 'guardian' 
                  ? "Monitoring patient adherence and alerts in real-time."
                  : "Instant triage, medication verification, and recovery coaching."}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {features.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setView(f.id)}
                  className={`p-6 rounded-2xl border text-left transition-all group ${f.color} shadow-sm hover:shadow-md`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        {f.icon}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-600">{f.desc}</p>
                </button>
              ))}
            </div>

            {/* Hackathon Badge */}
            <div className="mt-12 bg-slate-800 text-white p-6 rounded-2xl flex items-center justify-between shadow-xl">
               <div>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><ShieldPlus className="w-5 h-5"/> Team AURAlytics</h3>
                  <p className="text-slate-400 text-sm">Prototype Version 1.0</p>
               </div>
            </div>
          </div>
        )}

        {/* Feature Views (UNCHANGED - SAFE) */}
        <div className="animate-in zoom-in-95 duration-300">
            {view === FeatureView.TRIAGE && <TriageBot />}
            {view === FeatureView.MEDISCAN && <MediScanner />}
            {view === FeatureView.DERMCHECK && <DermCheck />}
            {view === FeatureView.RECOVERY && <RecoveryCoach />}
        </div>

      </main>
    </div>
  );
}
