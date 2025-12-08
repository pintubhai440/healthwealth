import React, { useState } from 'react';
import { FeatureView } from './types';
import { TriageBot } from './components/TriageBot';
import { MediScanner } from './components/MediScanner';
import { DermCheck } from './components/DermCheck';
import { RecoveryCoach } from './components/RecoveryCoach';
import { HeartPulse, Stethoscope, Scan, Activity, ChevronRight, Pill, ShieldPlus } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<FeatureView>(FeatureView.HOME);

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
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600">
              MediGuard AI
            </h1>
          </div>
          {view !== FeatureView.HOME && (
            <button 
              onClick={() => setView(FeatureView.HOME)}
              className="text-sm font-medium text-slate-500 hover:text-teal-600"
            >
              Back to Home
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {view === FeatureView.HOME && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3 mb-10">
              <h2 className="text-3xl font-bold text-slate-800">Your Personal AI Health Assistant</h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Instant triage, medication verification, and recovery coaching powered by Gemini 2.5 & 3 Pro.
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

            <div className="mt-12 bg-indigo-900 text-white p-6 rounded-2xl flex items-center justify-between shadow-xl">
               <div>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><ShieldPlus className="w-5 h-5"/> Hackathon Prototype</h3>
                  <p className="text-indigo-200 text-sm">Powered by Google Gemini 2.5 Flash & 3 Pro Preview.</p>
               </div>
               <div className="hidden md:block opacity-50 text-6xl">🤖</div>
            </div>
          </div>
        )}

        {/* Feature Views */}
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