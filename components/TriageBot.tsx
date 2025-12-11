import React, { useState, useEffect, useRef } from 'react';
import { runTriageTurn, transcribeUserAudio, generateTTS } from '../services/gemini';
import { MessageSquare, Send, MapPin, User, Stethoscope, Mic, MicOff, Volume2, StopCircle, Loader2, RefreshCcw, Navigation } from 'lucide-react';
import { ChatMessage, TriageState } from '../types';
import ReactMarkdown from 'react-markdown';

// Audio Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const TriageBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'model', text: "Namaste! I am your AI Doctor Assistant. Tell me, what health problem are you facing today? (e.g., Stomach pain, Fever)" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.log("Location denied", err)
    );
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Audio Playback Logic
  const playResponseAudio = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        ctx,
        24000,
        1
      );

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      
      setIsSpeaking(true);
      source.start();
    } catch (e) {
      console.error("Audio Playback Error", e);
      setIsSpeaking(false);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          setIsRecording(false);
          setLoading(true);
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            try {
               const text = await transcribeUserAudio(base64String, 'audio/webm');
               setInput(text);
            } catch (e) {
               console.error(e);
               alert("Failed to transcribe audio.");
            } finally {
               setLoading(false);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Mic Error", err);
        alert("Microphone access denied or error.");
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const result = await runTriageTurn(history, userMsg.text, step, location);

      const botMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: result.text 
      };

      setMessages(prev => [...prev, botMsg]);
      
      // If result has grounding maps (Doctors), append a special system message
      if (result.groundingUrls && result.groundingUrls.length > 0) {
         const linksMsg: ChatMessage = {
             id: (Date.now() + 2).toString(),
             role: 'system',
             text: JSON.stringify(result.groundingUrls)
         };
         setMessages(prev => [...prev, linksMsg]);
      }

      setStep(prev => prev + 1);

      generateTTS(result.text).then(audioData => {
         if (audioData) playResponseAudio(audioData);
      });

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', text: 'Error connecting to AI Doctor. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200 relative">
      <div className="bg-teal-600 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            <h2 className="font-bold text-lg">Smart Triage</h2>
        </div>
        <div className="flex items-center gap-3">
             {isSpeaking && (
                 <div className="flex items-center gap-1 bg-teal-700 px-2 py-1 rounded-full text-xs animate-pulse">
                    <Volume2 className="w-3 h-3" /> Speaking...
                 </div>
             )}
            <div className="text-xs bg-teal-700 px-2 py-1 rounded">
                Step {Math.min(step, 3)}/3
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((m) => {
            if (m.role === 'system') {
                // Try to parse as links
                let links = null;
                try {
                    const parsed = JSON.parse(m.text);
                    if (Array.isArray(parsed)) links = parsed;
                } catch {}

                if (links) {
                    return (
                        <div key={m.id} className="flex flex-col gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="font-bold text-blue-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <MapPin className="w-5 h-5 text-red-500" /> Recommended Nearby Doctors
                            </span>
                            <div className="grid gap-3">
                                {links.map((link: any, idx: number) => (
                                    <div 
                                      key={idx} 
                                      className="flex flex-col bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                    >
                                        <div className="p-3 flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="bg-red-50 p-2 rounded-lg text-red-500">
                                                    <MapPin className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">{link.title}</h4>
                                                    <p className="text-xs text-slate-500 mt-1">Medical Professional • Nearby</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <a 
                                           href={link.uri} 
                                           target="_blank" 
                                           rel="noreferrer"
                                           className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <span>Get Directions</span>
                                            <Navigation className="w-4 h-4" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <div key={m.id} className="flex justify-center my-2 animate-in fade-in">
                             <div className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                                {m.text}
                             </div>
                        </div>
                    );
                }
            }

            return (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 px-4 shadow-sm ${
                        m.role === 'user' 
                        ? 'bg-teal-600 text-white rounded-br-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}>
                        <ReactMarkdown
                          className={`text-sm md:text-base ${m.role === 'user' ? 'text-white' : 'text-slate-800'}`}
                          components={{
                            strong: ({node, ...props}) => <span className="font-bold" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-1" {...props} />,
                            li: ({node, ...props}) => <li className="" {...props} />,
                            p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />
                              }}
                          >
                          {m.text}
                          </ReactMarkdown>
                    </div>
                </div>
            );
        })}
        {loading && (
            <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl p-3 rounded-bl-none flex items-center gap-2 shadow-sm">
                    {isRecording ? (
                        <span className="text-xs text-red-500 font-bold flex items-center gap-1 animate-pulse">
                           <Mic className="w-3 h-3" /> Listening...
                        </span>
                    ) : (
                        <>
                           <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></div>
                           <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce delay-75"></div>
                           <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce delay-150"></div>
                        </>
                    )}
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2 items-center">
            {step < 3 && (
                <button 
                  onClick={handleMicClick}
                  disabled={loading}
                  className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse ring-2 ring-red-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
            )}

            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isRecording ? "Listening..." : (step >= 3 ? "Triage Complete." : "Type or speak your answer...")}
                disabled={step >= 3 || isRecording || loading}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500"
            />
            
            {step >= 3 ? (
                 <button onClick={() => window.location.reload()} className="bg-slate-700 text-white p-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2">
                    <RefreshCcw className="w-5 h-5" />
                 </button>
            ) : (
                <button 
                    onClick={handleSend}
                    disabled={loading || !input.trim() || isRecording}
                    className="bg-teal-600 text-white p-3 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-lg shadow-teal-200"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
