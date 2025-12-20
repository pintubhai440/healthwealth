import React, { useState, useEffect } from 'react';
import { FeatureView } from './types';
import { TriageBot } from './components/TriageBot';
import { MediScanner } from './components/MediScanner';
import { DermCheck } from './components/DermCheck';
import { RecoveryCoach } from './components/RecoveryCoach';
import { FlowAuth } from './components/FlowAuth';
import { DoctorDashboard } from './components/DoctorDashboard';
// ✅ Icons Updated (Key, UserCheck, Sun, Moon added)
import { 
  HeartPulse, Stethoscope, Scan, Activity, ChevronRight, 
  Pill, ShieldPlus, LogOut, Siren, ShieldCheck, FileText, Key, UserCheck,
  Sun, Moon 
} from 'lucide-react';

export default function App() {
  // --- STATE MANAGEMENT ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>('patient');
  const [userName, setUserName] = useState<string>('');
  const [view, setView] = useState<FeatureView>(FeatureView.HOME);

  // ✅ 1. Patient ke liye Secret Code State
  const [patientSecretCode, setPatientSecretCode] = useState("P-1234"); 
  // ✅ 2. Guardian ke liye Connection State
  const [guardianConnectedTo, setGuardianConnectedTo] = useState<string>('');

  // ✅ DARK MODE STATE - localStorage se load karo
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage aur system preference
    const savedTheme = localStorage.getItem('mediguard-theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // System preference check karo
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // ✅ DARK MODE TOGGLE LOGIC (Effect with localStorage)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mediguard-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mediguard-theme', 'light');
    }
  }, [darkMode]);

  // --- HANDLERS ---
  const handleLogin = (role: string, name: string, code?: string) => {
    setUserRole(role);
    setUserName(name);
    
    if (role === 'patient') {
        // Patient login kare toh code generate kar lo (Simulation)
        const randomCode = "P-" + Math.floor(1000 + Math.random() * 9000);
        setPatientSecretCode(randomCode);
    } 
    else if (role === 'guardian') {
        // Guardian Logic: Check Code
        if (code && code.startsWith("P-")) {
           setGuardianConnectedTo("Rahul Kumar (Patient)"); // Demo Patient Name
           setView(FeatureView.GUARDIAN); // Seedha Guardian Verify par le jao
        } else {
           alert("Invalid Patient Code! Please ask the patient for the correct code starting with P-");
           return;
        }
    }
    
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole('patient');
    setView(FeatureView.HOME);
    setGuardianConnectedTo('');
  };

  const handleSOS = () => {
    alert("🆘 SOS ALERT SENT! \n\nEmergency contacts and nearby hospitals have been notified with your live location.");
  };

  // ✅ IMPROVED Theme Toggle Component with better UI
  const ThemeToggle = () => (
    <div className="flex items-center">
      <button 
        onClick={() => setDarkMode(!darkMode)} 
        className="relative p-2 rounded-full transition-all bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 group"
        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? (
          <>
            <Sun className="w-5 h-5" />
            <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Light Mode
            </span>
          </>
        ) : (
          <>
            <Moon className="w-5 h-5" />
            <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Dark Mode
            </span>
          </>
        )}
      </button>
    </div>
  );

  // --- 1. AUTH SCREEN CHECK ---
  if (!isAuthenticated) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <FlowAuth onLogin={handleLogin} />
        {/* Auth screen ke liye bhi theme toggle */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
      </div>
    );
  }

  // --- 2. DOCTOR DASHBOARD CHECK ---
  if (userRole === 'doctor') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                   <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">MediGuard <span className="text-blue-600 dark:text-blue-400">Pro</span></h1>
             </div>
             
             <div className="flex items-center gap-3">
                 <ThemeToggle />
                 <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400 font-bold uppercase">Logged in as</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{userName}</p>
                 </div>
                 <button onClick={handleLogout} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 dark:text-slate-400 hover:text-red-600 rounded-full transition-all" title="Sign Out">
                    <LogOut className="w-5 h-5" />
                 </button>
             </div>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-4 py-8">
           <DoctorDashboard />
        </main>
      </div>
    );
  }

  // --- 3. GUARDIAN DASHBOARD VIEW ---
  if (userRole === 'guardian') {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
           {/* Guardian Navbar */}
           <nav className="bg-teal-700 dark:bg-teal-900 text-white sticky top-0 z-50 shadow-md transition-colors duration-300">
             <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <ShieldCheck className="w-6 h-6 text-teal-200" />
                   <h1 className="text-xl font-bold">MediGuard <span className="text-teal-200">Connect</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <div className="text-right hidden sm:block">
                       <p className="text-[10px] text-teal-200 font-bold uppercase">Guardian</p>
                       <p className="text-sm font-bold">{userName}</p>
                    </div>
                    <button onClick={handleLogout} className="p-2 bg-teal-800 hover:bg-teal-600 rounded-full transition-all">
                       <LogOut className="w-5 h-5" />
                    </button>
                </div>
             </div>
           </nav>

           <main className="max-w-3xl mx-auto px-4 py-8">
               {/* Patient Info Card */}
               <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex items-center justify-between animate-in slide-in-from-top-4 transition-colors">
                   <div>
                       <h2 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">Monitoring Patient</h2>
                       <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                           <UserCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" /> {guardianConnectedTo}
                       </h3>
                   </div>
                   <div className="text-right">
                       <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                           ● Live Status: Active
                       </span>
                   </div>
               </div>

               {/* Guardian Features */}
               <div className="space-y-6">
                   <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-teal-100 dark:border-teal-900/30 overflow-hidden transition-colors">
                       <div className="bg-teal-50 dark:bg-teal-900/20 p-4 border-b border-teal-100 dark:border-teal-900/30">
                           <h3 className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2">
                               <Activity className="w-5 h-5" /> Daily Adherence Check
                           </h3>
                       </div>
                       <div className="p-4">
                           <MediScanner defaultMode="VERIFY" hideTabs={true} />
                       </div>
                   </div>
               </div>
           </main>
        </div>
      );
  }

  // --- 4. PATIENT DASHBOARD FEATURES ---
  const features = [
    {
      id: FeatureView.TRIAGE,
      title: "Smart Triage",
      desc: "Chat with AI Doctor for instant diagnosis.",
      icon: <Stethoscope className="w-8 h-8 text-teal-500" />,
      color: "bg-teal-50 hover:bg-teal-100 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800 dark:hover:bg-teal-900/30"
    },
    {
      id: FeatureView.REPORT,
      title: "Lab Reports",
      desc: "Upload Blood/Thyroid reports for simple analysis.",
      icon: <FileText className="w-8 h-8 text-indigo-500" />,
      color: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 dark:hover:bg-indigo-900/30"
    },
    {
      id: FeatureView.MEDISCAN,
      title: "Medi-Scanner",
      desc: "Identify pills instantly.",
      icon: <Pill className="w-8 h-8 text-blue-500" />,
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:hover:bg-blue-900/30"
    },
    {
      id: FeatureView.GUARDIAN,
      title: "Guardian Verify",
      desc: "Remote adherence check & alerts.",
      icon: <ShieldCheck className="w-8 h-8 text-purple-500" />,
      color: "bg-purple-50 hover:bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:hover:bg-purple-900/30"
    },
    {
      id: FeatureView.DERMCHECK,
      title: "Derm-Check",
      desc: "Scan skin issues for an instant verdict.",
      icon: <Scan className="w-8 h-8 text-rose-500" />,
      color: "bg-rose-50 hover:bg-rose-100 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800 dark:hover:bg-rose-900/30"
    },
    {
      id: FeatureView.RECOVERY,
      title: "Recovery Studio",
      desc: "Diet plans & Live AI Coach.",
      icon: <Activity className="w-8 h-8 text-emerald-500" />,
      color: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:hover:bg-emerald-900/30"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* NAVBAR */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div onClick={() => setView(FeatureView.HOME)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="bg-teal-600 p-2 rounded-lg">
               <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-400 hidden md:block">MediGuard AI</h1>
            <h1 className="text-xl font-bold text-teal-600 dark:text-teal-400 md:hidden">MediGuard</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <ThemeToggle />
             
             {/* Theme Indicator */}
             <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
               <span className={`px-2 py-1 rounded-full ${darkMode ? 'bg-slate-800 text-yellow-300' : 'bg-slate-200 text-slate-600'}`}>
                 {darkMode ? 'Dark' : 'Light'}
               </span>
             </div>
             
             <button onClick={handleSOS} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 animate-pulse shadow-lg shadow-red-200 dark:shadow-red-900/50">
                <Siren className="w-4 h-4" /> <span className="hidden md:inline">SOS</span>
             </button>
             {view !== FeatureView.HOME && (
                <button onClick={() => setView(FeatureView.HOME)} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hidden md:block">Home</button>
             )}
             <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Sign Out">
                <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* HOME VIEW */}
        {view === FeatureView.HOME && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* GUARDIAN ACCESS KEY CARD */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black rounded-2xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden border border-slate-700 dark:border-slate-800">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                <div>
                    <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <Key className="w-4 h-4" /> Guardian Access Key
                    </h3>
                    <p className="text-3xl font-mono font-bold tracking-widest text-teal-400">{patientSecretCode}</p>
                    <p className="text-slate-400 text-xs mt-2">Share this code with your Guardian to allow access.</p>
                </div>
                <div className="hidden sm:block">
                     <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                        <ShieldCheck className="w-8 h-8 text-teal-400" />
                     </div>
                </div>
            </div>

            <div className="text-center space-y-3 mb-10">
              <div className="flex items-center justify-center gap-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${userRole === 'guardian' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'}`}>
                    {userRole === 'guardian' ? '🛡️ Guardian Mode' : '👤 Patient Dashboard'}
                </span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${darkMode ? 'bg-slate-800 text-yellow-300' : 'bg-slate-200 text-slate-600'}`}>
                    {darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Hello, {userName || 'Patient'}</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                {userRole === 'guardian' ? "Monitoring patient adherence and alerts in real-time." : "Instant triage, medication verification, and recovery coaching."}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {features.map((f) => (
                <button key={f.id} onClick={() => setView(f.id)} className={`p-6 rounded-2xl border text-left transition-all group ${f.color} shadow-sm hover:shadow-md`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">{f.icon}</div>
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-12 bg-slate-800 dark:bg-black text-white p-6 rounded-2xl flex items-center justify-between shadow-xl border border-slate-700 dark:border-slate-800">
               <div>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><ShieldPlus className="w-5 h-5"/> Team AURAlytics</h3>
                  <p className="text-slate-400 text-sm">MVP Version 2.0</p>
               </div>
               <div className="text-xs text-slate-400">
                 Current Theme: <span className="font-bold text-teal-300">{darkMode ? 'Dark' : 'Light'}</span>
               </div>
            </div>
          </div>
        )}

        {/* ACTIVE FEATURE VIEW */}
        <div className="animate-in zoom-in-95 duration-300">
            {view === FeatureView.TRIAGE && <TriageBot />}
            
            {/* 1. MediScanner (Pill ID Mode) */}
            {view === FeatureView.MEDISCAN && <MediScanner defaultMode="ID" hideTabs={true} />}
            
            {/* 2. Guardian Verify (Video Verify Mode) */}
            {view === FeatureView.GUARDIAN && <MediScanner defaultMode="VERIFY" hideTabs={true} />}

            {/* ✅ 3. Lab Report Mode */}
            {view === FeatureView.REPORT && <MediScanner defaultMode="REPORT" hideTabs={true} />}
            
            {view === FeatureView.DERMCHECK && <DermCheck />}
            {view === FeatureView.RECOVERY && <RecoveryCoach />}
        </div>
      </main>
    </div>
  );
}
