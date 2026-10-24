import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Database, Download, Upload } from "lucide-react";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string | null;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  status,
  onBackup,
  onRestore,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-md p-8 rounded-3xl relative shadow-2xl border border-slate-200"
          >
            <button
              onClick={onClose}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
                <Database className="w-10 h-10 text-orange-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">
                  السرية والتحكم
                </h2>
                <p className="text-slate-500">
                  إدارة النسخ الاحتياطي واستعادة بيانات النظام
                </p>
              </div>

              <div className="grid grid-cols-1 w-full gap-4">
                <button
                  onClick={onBackup}
                  className="flex items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-4 rounded-2xl transition-all text-slate-700 font-medium"
                >
                  <Download className="w-5 h-5 text-blue-600" />
                  <span>عمل نسخة احتياطية (Backup)</span>
                </button>

                <label className="flex items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-4 rounded-2xl transition-all cursor-pointer text-slate-700 font-medium">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  <span>استعادة نسخة احتياطية (Restore)</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={onRestore}
                  />
                </label>
              </div>

              {status && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`p-3 rounded-xl text-sm w-full font-medium ${status.includes("فشل") ? "bg-red-50 text-red-600 border border-red-100" : "bg-blue-50 text-blue-600 border border-blue-100"}`}
                >
                  {status}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
