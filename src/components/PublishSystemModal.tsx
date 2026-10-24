import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Globe,
  X,
  QrCode,
  Smartphone,
  Store
} from "lucide-react";

interface PublishSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemName: string;
}

export const PublishSystemModal: React.FC<PublishSystemModalProps> = ({
  isOpen,
  onClose,
  systemName
}) => {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${baseUrl}/public`;
  const tableMenuUrl = `${baseUrl}/menu/1/1`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                <Globe className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-base">نشر النظام للموجّه العام (Publish Mode)</h3>
                <p className="text-xs text-blue-100">رابط القائمة العامة والطلبات الذاتية للعملاء</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-900">
              <Store className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-bold">
                النظام متاح للعملاء كصفحة عامة مستقلة بدون الحاجة لتسجيل دخول. يمكنك مشاركة الرابط أو استخدامه في شاشات العرض أو كيو-آر الطاولات.
              </div>
            </div>

            {/* Public Link 1 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>الرابط المباشر للمنيو العام (Public Menu)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl ?? ""}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-700 outline-none select-all"
                />
                <button
                  onClick={() => copyToClipboard(publicUrl, "public")}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {copiedLink === "public" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink === "public" ? "تم النسخ" : "نسخ"}</span>
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors"
                  title="فتح بتبويب جديد"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Public Link 2 - Table QR */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>رابط منيو الطاولات المباشر (الفرع 1 / طاولة 1)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={tableMenuUrl ?? ""}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-700 outline-none select-all"
                />
                <button
                  onClick={() => copyToClipboard(tableMenuUrl, "table")}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {copiedLink === "table" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink === "table" ? "تم النسخ" : "نسخ"}</span>
                </button>
                <a
                  href={tableMenuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors"
                  title="فتح بتبويب جديد"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
