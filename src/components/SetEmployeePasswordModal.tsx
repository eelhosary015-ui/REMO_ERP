import React, { useState } from "react";
import { Key, X, Check, Lock, Sparkles, RefreshCw } from "lucide-react";
import { Employee } from "../types";

interface SetEmployeePasswordModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SetEmployeePasswordModal: React.FC<SetEmployeePasswordModalProps> = ({
  employee,
  onClose,
  onSuccess
}) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const chars = "1234567890";
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(rand);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.trim().length < 4) {
      setError("كلمة المرور يجب أن تكون 4 أرقام/أحرف على الأقل");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/hr/employees/${employee.id}/set-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "فشل تحديث كلمة المرور");
      } else {
        setSuccessMsg(`تم تعيين كلمة مرور الموبايل بنجاح للموظف: ${password.trim()}`);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">تعيين كلمة مرور الموبايل للموظف</h3>
            <p className="text-xs text-slate-400">
              {employee.name} • كود: #{employee.employee_code || employee.fingerprint_code || employee.id}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              كلمة المرور الجديدة للتطبيق الموبايل
            </label>
            <div className="relative">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور (مثال: 123456)"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition font-mono"
                required
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="button"
            onClick={generateRandomPassword}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>توليد كلمة مرور عشوائية سريعة (6 أرقام)</span>
          </button>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>حفظ كلمة المرور للتطبيق</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetEmployeePasswordModal;
