import React, { useState, useEffect, useRef } from "react";
import { authHeaders } from "../utils/api";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Bot,
  Send,
  X,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  Database,
  HelpCircle,
  Zap,
  Info,
  Maximize2,
  Minimize2
} from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  hasSystemContext?: boolean;
}

interface AIChatAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChatAssistantModal: React.FC<AIChatAssistantModalProps> = ({
  isOpen,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "أهلاً بك! أنا **المساعد الذكي لنظام REMO Pro** المدعوم بتقنية **Google Gemini API**. كيف يمكنني مساعدتك اليوم في إدارة المطعم، المبيعات، الحسابات، أو الموارد البشرية؟",
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ hasApiKey: boolean; model: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchApiStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchApiStatus = async () => {
    try {
      const res = await fetch("/api/ai/chat/status", {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch AI status:", e);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const userMsgText = (textToSend || prompt).trim();
    if (!userMsgText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMsgText,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      hasSystemContext: includeContext
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setPrompt("");
    setIsLoading(true);

    try {
      // Build history payload for Gemini chat
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          text: m.content
        }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt: userMsgText,
          history: historyPayload,
          includeSystemContext: includeContext
        })
      });

      
      const data = await res.json();
      if (res.ok && data.success) {
        let reply = data.reply;
        let actionTriggered = false;

        // Check for executeAction JSON block
        const jsonMatch = reply.match(/\`\`\`json\n([\s\S]*?)\`\`\`/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.executeAction) {
              // Trigger the event
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("ai_action", { detail: parsed }));
              }, 500);
              
              // Remove the JSON block from the reply so the user doesn't see it
              reply = reply.replace(jsonMatch[0], "").trim();
              if (!reply) {
                reply = "تم تنفيذ الإجراء المطلوب بنجاح يا فندم! هل هناك شيء آخر؟";
              }
              actionTriggered = true;
            }
          } catch (e) {
            console.error("Failed to parse AI action JSON:", e);
          }
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `⚠️ ${data.message || "عذراً، تعذر الحصول على إجابة من الذكاء الاصطناعي."}`,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("AI Chat fetch error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "⚠️ حدث خطأ في الاتصال بالشبكة أو الخادم أثناء معالجة الطلب.",
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopiedId(id);
    setTimeout(() => setIsCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome-" + Date.now(),
        role: "assistant",
        content:
          "تم مسح المحادثة. أنا جاهز لمساعدتك مجدداً بأي استفسار أو تحليل في نظام **REMO Pro**!",
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  const quickPrompts = [
    { label: "📊 ملخص أداء النظام اليوم", icon: TrendingUp },
    { label: "💡 نصائح لزيادة الأرباح وتقليل الهدر", icon: Zap },
    { label: "👥 كيف أضيف موظف جديد وأحتسب الراتب؟", icon: HelpCircle },
    { label: "📦 طريقة تسوية وتتبع كميات المخزون", icon: Database }
  ];

  const formatContent = (content: string) => {
    // Simple markdown-style bold and bullet formatter
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      let formattedLine = line;
      // Bold text **text**
      const parts = formattedLine.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={idx} className={line.startsWith("- ") || line.startsWith("* ") ? "mr-3 my-0.5 flex gap-2 items-start" : "my-0.5"}>
          {(line.startsWith("- ") || line.startsWith("* ")) && (
            <span className="text-teal-400 font-bold">•</span>
          )}
          <span>
            {parts.map((part, pIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={pIdx} className="font-bold text-teal-300">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </span>
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className={`bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isExpanded
              ? "w-full max-w-6xl h-[92vh]"
              : "w-full max-w-2xl h-[720px] max-h-[90vh]"
          }`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-teal-500/20">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-teal-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white">
                    مساعد الذكاء الاصطناعي (AI Chat API)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {apiStatus?.model || "gemini-3.6-flash"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-xs text-slate-400">
                    {apiStatus?.hasApiKey
                      ? "المحرك الذكي متصل وجاهز للتحليل"
                      : "بانتظار مفتاح API المتوفر بالنظام"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIncludeContext(!includeContext)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  includeContext
                    ? "bg-teal-500/10 border-teal-500/40 text-teal-300"
                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
                title="تثبيت أو إلغاء تضمين إحصائيات النظام اليومية"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {includeContext ? "بيانات حية مفعلة" : "بدون بيانات حية"}
                </span>
              </button>

              <button
                onClick={clearChat}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="مسح المحادثة"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
                title={isExpanded ? "تصغير" : "توسيع"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="bg-slate-950/40 px-4 py-2 border-b border-slate-800/50 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp.label)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/60 hover:bg-teal-500/20 text-slate-300 hover:text-teal-200 border border-slate-700/60 hover:border-teal-500/40 whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5"
              >
                <qp.icon className="w-3.5 h-3.5 text-teal-400" />
                <span>{qp.label}</span>
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-900/50">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold shadow-md ${
                      isUser
                        ? "bg-teal-600 text-white"
                        : "bg-slate-800 text-teal-400 border border-slate-700"
                    }`}
                  >
                    {isUser ? "أنت" : <Bot className="w-5 h-5 text-teal-400" />}
                  </div>

                  <div className={`max-w-[85%] space-y-1 ${isUser ? "text-left" : "text-right"}`}>
                    <div
                      className={`p-4 rounded-3xl text-sm leading-relaxed shadow-lg ${
                        isUser
                          ? "bg-teal-600 text-white rounded-tl-none font-medium"
                          : "bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tr-none"
                      }`}
                    >
                      <div className="space-y-1">{formatContent(msg.content)}</div>
                    </div>

                    <div className={`flex items-center gap-2 px-2 text-[10px] text-slate-400 ${isUser ? "justify-end" : "justify-start"}`}>
                      <span>{msg.timestamp}</span>
                      {msg.hasSystemContext && (
                        <span className="text-teal-400 font-semibold">• متضمن بيانات النظام الحية</span>
                      )}
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-teal-300 transition-colors mr-2 flex items-center gap-0.5"
                        >
                          {isCopiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 animate-spin text-teal-400" />
                </div>
                <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-3xl rounded-tr-none flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs font-bold text-slate-300">جاري التحليل وصياغة الرد بواسطة Gemini...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-4 bg-slate-950/90 border-t border-slate-800/80 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={prompt ?? ""}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="اسأل المساعد الذكي عن أي شيء بالنظام، أو اطلب تحليلاً أو نصيحة..."
                disabled={isLoading}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
              />

              <VoiceInputButton
                onTranscript={(text) => setPrompt((prev) => (prev ? prev + " " + text : text))}
                className="bg-slate-800 text-teal-400 border-slate-700 hover:bg-slate-700/80 hover:text-teal-300 py-3 px-3.5"
              />

              <button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className="px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
              >
                <span className="hidden sm:inline">إرسال</span>
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </form>
            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400">
              <span>💡 يتم استخدام نموذج **gemini-3.6-flash** المباشر عبر السيرفر بأعلى معايير الأمان</span>
              <span>REMO AI Assistant</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
