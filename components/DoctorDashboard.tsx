import React, { useState } from 'react';
import { Users, Calendar, Activity, Clock, CheckCircle, XCircle, FileText, ChevronRight, MessageSquare, Star, Search, Brain, AlertTriangle } from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'REQUESTS'>('SCHEDULE');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // --- MOCK DATA (Video Jaisa) ---
  const stats = [
    { label: "Patients", value: "24", sub: "+12% today", icon: <Users className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50" },
    { label: "Consults", value: "8", sub: "Scheduled", icon: <Calendar className="w-5 h-5 text-purple-600" />, bg: "bg-purple-50" },
    { label: "AI Score", value: "98%", sub: "Response Rate", icon: <Activity className="w-5 h-5 text-green-600" />, bg: "bg-green-50" },
  ];

  const requests = [
    { id: 1, name: "Rahul Sharma", issue: "Frequent Headaches", time: "Today, 04:00 PM", status: "New Patient", urgency: "HIGH" },
    { id: 2, name: "Priya Singh", issue: "MRI Report Review", time: "Tomorrow, 12:30 PM", status: "Follow Up", urgency: "MEDIUM" },
  ];

  const schedule = [
    { id: 101, name: "Dr. Anita Desai", type: "Video Call", reason: "Routine Check", time: "02:30 PM" },
    { id: 102, name: "Rahul Sharma", type: "In-Clinic", reason: "Follow up on Migraine", time: "11:00 AM" }
  ];

  // --- VIEW: PATIENT CONSULTATION (Jab Patient par click karein) ---
  if (selectedPatient) {
      return (
          <div className="bg-white min-h-[600px] rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-right">
              {/* Header */}
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center gap-3">
                  <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                      ← Back
                  </button>
                  <div>
                      <h2 className="font-bold text-lg text-slate-800">{selectedPatient.name}</h2>
                      <p className="text-xs text-slate-500">Male • 28 Years • +91 98765 43210</p>
                  </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[500px]">
                  {/* 🤖 AI TRIAGE SUMMARY (Video Feature) */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="flex items-center gap-2 font-bold text-blue-800 mb-2">
                          <Brain className="w-4 h-4" /> AI Triage Summary
                      </h4>
                      <p className="text-sm text-blue-900 leading-relaxed">
                          Patient reports severe cough and mild fever for 3 days. History of mild asthma.
                          Vitals from wearable: HR 88 bpm.
                      </p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                          <span className="bg-white text-blue-600 px-2 py-1 rounded text-xs font-bold border border-blue-100">Possible: Bronchitis</span>
                          <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold border border-red-100">Allergy: Penicillin</span>
                      </div>
                  </div>

                  {/* Rx & Notes Input */}
                  <div className="space-y-4">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <FileText className="w-5 h-5" /> Rx & Notes
                      </h3>
                      
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Diagnosis</label>
                          <input type="text" placeholder="e.g. Acute Bronchitis" className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 ring-blue-500" />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Medications</label>
                          <div className="flex gap-2">
                              <input type="text" placeholder="Add medicine (e.g. Paracetamol)" className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 ring-blue-500" />
                              <button className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700">+</button>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Follow Up</label>
                          <input type="text" placeholder="e.g. 5 Days" className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 ring-blue-500" />
                      </div>
                  </div>

                  <button 
                    onClick={() => { alert("Prescription Sent to Patient!"); setSelectedPatient(null); }}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                  >
                      Complete Consultation
                  </button>
              </div>
          </div>
      );
  }

  // --- VIEW: MAIN DASHBOARD ---
  return (
    <div className="space-y-6">
      {/* Doctor Profile Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                  VS
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-slate-800">Dr. Vikram Singh</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">Neurologist</span>
                      <span>• Accepting Patients</span>
                  </div>
              </div>
          </div>
          <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1 text-amber-500 font-bold text-xl justify-end">
                  4.9 <Star className="w-5 h-5 fill-current" />
              </div>
              <p className="text-xs text-slate-400">1,204 Reviews</p>
          </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
          {stats.map((s, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                      {s.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">{s.value}</h3>
                  <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                  <p className="text-[10px] text-green-600 mt-1">{s.sub}</p>
              </div>
          ))}
      </div>

      {/* Tabs & Lists */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
          <div className="flex border-b border-slate-100">
              <button 
                onClick={() => setActiveTab('SCHEDULE')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'SCHEDULE' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400'}`}
              >
                  Schedule (2)
              </button>
              <button 
                onClick={() => setActiveTab('REQUESTS')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'REQUESTS' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400'}`}
              >
                  Requests <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-xs ml-1">2</span>
              </button>
          </div>

          <div className="p-4 space-y-3">
              {activeTab === 'SCHEDULE' ? (
                  schedule.map((item) => (
                      <div key={item.id} className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer group" onClick={() => setSelectedPatient({ name: item.name })}>
                          <div className="bg-white p-3 rounded-lg shadow-sm text-center min-w-[60px]">
                              <span className="block text-xs text-blue-600 font-bold uppercase">{item.time.split(' ')[1]}</span>
                              <span className="block text-lg font-bold text-slate-800">{item.time.split(' ')[0]}</span>
                          </div>
                          <div className="ml-4 flex-1">
                              <h4 className="font-bold text-slate-800 group-hover:text-blue-600">{item.name}</h4>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                  {item.type === 'Video Call' ? <Activity className="w-3 h-3 text-blue-500"/> : <Users className="w-3 h-3 text-green-500"/>}
                                  {item.reason}
                              </p>
                          </div>
                          <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
                      </div>
                  ))
              ) : (
                  requests.map((req) => (
                      <div key={req.id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm animate-in fade-in">
                          <div className="flex justify-between items-start mb-3">
                              <div className="flex gap-3">
                                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">
                                      {req.name[0]}
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800">{req.name}</h4>
                                      <div className="flex gap-2 mt-1">
                                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{req.status}</span>
                                          {req.urgency === 'HIGH' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Urgent</span>}
                                      </div>
                                  </div>
                              </div>
                              <span className="text-xs text-slate-400">{req.time}</span>
                          </div>
                          <div className="flex gap-2 mt-4">
                              <button className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2">
                                  <XCircle className="w-4 h-4" /> Decline
                              </button>
                              <button 
                                onClick={() => setSelectedPatient(req)}
                                className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 flex items-center justify-center gap-2"
                              >
                                  <CheckCircle className="w-4 h-4" /> Accept & View
                              </button>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};
