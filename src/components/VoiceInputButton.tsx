import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle, Volume2, Sparkles, Languages } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  placeholder?: string;
  className?: string;
  lang?: "ar-EG" | "en-US";
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = "",
  lang = "ar-EG"
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLang, setSelectedLang] = useState(lang);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check browser compatibility
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const startListening = () => {
    setErrorMessage(null);
    setInterimTranscript("");
    
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage("ميزة التعرف على الصوت غير مدعومة في هذا المتصفح.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false; // Stop listening when user stops speaking
      rec.interimResults = true; // Show results in real time
      rec.lang = selectedLang;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }
        if (final) {
          onTranscript(final);
          setInterimTranscript("");
        }
      };

      rec.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "not-allowed") {
          console.error("Speech recognition error", event.error);
        }
        if (event.error === "not-allowed") {
          const isInIframe = window.self !== window.top;
          if (isInIframe) {
            setErrorMessage("عذراً، المتصفح يحجب الميكروفون داخل الإطار التجريبي. يرجى فتح النظام في نافذة جديدة (Open in a new tab) لتفعيل الإدخال الصوتي بنجاح!");
          } else {
            setErrorMessage("تم رفض إذن الميكروفون. يرجى تفعيل الصلاحية في شريط عنوان المتصفح.");
          }
        } else if (event.error === "no-speech") {
          setErrorMessage("لم يتم الكشف عن صوت متحدث. يرجى المحاولة ثانية.");
        } else {
          setErrorMessage("حدث خطأ في قراءة الصوت: " + event.error);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      setErrorMessage("فشل في بدء نظام التعرف على الصوت.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        title="التعرف على الصوت غير مدعوم في هذا المتصفح"
        className="p-2.5 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
      >
        <MicOff className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5 shrink-0">
      {/* Listening State indicator and interim transcript box */}
      {isListening && (
        <div className="absolute bottom-full mb-3 right-0 z-50 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700/80 p-3 w-64 text-right animate-bounce">
          <div className="flex items-center justify-between mb-1">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
              جاري الاستماع الآن...
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            </span>
          </div>
          
          <p className="text-xs font-medium text-slate-200 line-clamp-2">
            {interimTranscript || "تحدث الآن، وسأقوم بكتابة ما تقوله..."}
          </p>

          <div className="flex gap-1 mt-2">
            <div className="h-1 bg-teal-500 rounded-full animate-pulse flex-1"></div>
            <div className="h-1 bg-teal-500 rounded-full animate-pulse flex-1 [animation-delay:0.2s]"></div>
            <div className="h-1 bg-teal-500 rounded-full animate-pulse flex-1 [animation-delay:0.4s]"></div>
          </div>
        </div>
      )}

      {/* Error Tooltip */}
      {errorMessage && (
        <div className="absolute bottom-full mb-3 right-0 z-50 bg-red-900/95 border border-red-800 text-white text-xs rounded-xl p-2.5 w-60 text-right shadow-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">تنبيه الميكروفون</p>
            <p className="text-[10px] text-red-200">{errorMessage}</p>
          </div>
          <button 
            onClick={() => setErrorMessage(null)} 
            className="text-white/60 hover:text-white mr-auto text-xs font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Language Toggle Button */}
      <button
        type="button"
        onClick={() => setSelectedLang(prev => prev === "ar-EG" ? "en-US" : "ar-EG")}
        title="تغيير لغة التحدث (عربي / إنجليزي)"
        className="p-1.5 text-[10px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1 hover:border-teal-400 transition-colors"
      >
        <Languages className="w-3.5 h-3.5" />
        <span>{selectedLang === "ar-EG" ? "عربي" : "EN"}</span>
      </button>

      {/* Main Mic Trigger Button */}
      <button
        type="button"
        onClick={toggleListening}
        className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
          isListening
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30 ring-4 ring-red-500/20 scale-105 animate-pulse"
            : "bg-teal-50 hover:bg-teal-100/80 border border-teal-200 text-teal-700 hover:text-teal-800"
        } ${className}`}
        title={isListening ? "إيقاف التسجيل الصوتي" : "البدء بالإدخال الصوتي"}
      >
        {isListening ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
      </button>
    </div>
  );
};
