import React, { useState } from "react";
import { authHeaders } from "../utils/api";
import { motion, AnimatePresence } from "motion/react";
import { X, Lock, Key, AlertCircle, CheckCircle } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, isRtl } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(isRtl ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      setError(
        isRtl
          ? "كلمة المرور يجب أن تكون 4 أحرف على الأقل"
          : "Password must be at least 4 characters",
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 2000);
      } else {
        setError(
          data.error ||
            (isRtl ? "فشل تغيير كلمة المرور" : "Failed to change password"),
        );
      }
    } catch (err) {
      setError(isRtl ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {isRtl ? "تغيير كلمة المرور" : "Change Password"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isRtl
                      ? "قم بتحديث بيانات الأمان الخاصة بك"
                      : "Update your security credentials"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {isRtl
                    ? "تم تغيير كلمة المرور بنجاح"
                    : "Password changed successfully"}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block px-1">
                  {isRtl ? "كلمة المرور الحالية" : "Current Password"}
                </label>
                <div className="relative">
                  <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={currentPassword ?? ""}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-800"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block px-1">
                  {isRtl ? "كلمة المرور الجديدة" : "New Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={newPassword ?? ""}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-800"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block px-1">
                  {isRtl ? "تأكيد كلمة المرور" : "Confirm New Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword ?? ""}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-800"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  {isLoading
                    ? isRtl
                      ? "جاري الحفظ..."
                      : "Saving..."
                    : isRtl
                      ? "حفظ التغييرات"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
