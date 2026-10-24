import React, { useState, useRef } from "react";
import {
  X,
  Printer,
  Download,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Calendar,
  ShieldCheck,
  ExternalLink,
  QrCode,
  Sparkles,
  Maximize2,
  Copy,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface PreviewDocument {
  id?: string | number;
  name?: string;
  title?: string;
  category?: string;
  fileName?: string;
  fileUrl?: string;
  uploadDate?: string;
  expiryDate?: string;
  size?: string;
  status?: string;
  employeeName?: string;
  employeeCode?: string;
  nationalId?: string;
  department?: string;
  jobTitle?: string;
  notes?: string;
  documentNumber?: string;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: PreviewDocument | null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document: doc
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !doc) return null;

  const docTitle = doc.title || doc.name || "مستند رسمي للموظف";
  const docCategory = doc.category || "مستند عام";
  const docFileName = doc.fileName || `${docTitle}.pdf`;
  const fileUrl = doc.fileUrl && doc.fileUrl !== "#" ? doc.fileUrl : "";

  // Check file type
  const isImage =
    fileUrl.startsWith("data:image/") ||
    fileUrl.startsWith("blob:") ||
    fileUrl.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)($|\?)/i);

  const isPdf =
    fileUrl.startsWith("data:application/pdf") ||
    fileUrl.match(/\.pdf($|\?)/i);

  const handlePrint = () => {
    // For real PDF files, print the actual PDF instead of printing the generated metadata card.
    if (isPdf && fileUrl) {
      const pdfWindow = window.open(fileUrl, "_blank", "width=1100,height=900");
      if (!pdfWindow) {
        alert("يرجى السماح بالنوافذ المنبثقة لطباعة المستند.");
        return;
      }
      try {
        pdfWindow.addEventListener("load", () => {
          setTimeout(() => {
            try { pdfWindow.focus(); pdfWindow.print(); } catch { /* browser PDF viewer may handle printing itself */ }
          }, 500);
        }, { once: true });
      } catch {
        // The PDF viewer may not expose a normal load event; the document is still opened for manual printing.
      }
      return;
    }

    const printWindow = window.open("", "_blank", "width=950,height=1050");
    if (!printWindow) {
      window.print();
      return;
    }

    const empName = doc.employeeName || "الموظف المعتمد";
    const empCode = doc.employeeCode || "EMP-101";
    const natId = doc.nationalId || "-";
    const dep = doc.department || "الإدارة";
    const job = doc.jobTitle || "موظف";
    const printDate = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const docRefNum = `DOC-${doc.id || Math.floor(100000 + Math.random() * 900000)}`;

    const contentHtml = isImage && fileUrl
      ? `
        <div class="doc-header">
          <div class="logo-section">
            <h2>مؤسسة Remo Pro</h2>
            <p>إدارة الموارد البشرية وشؤون العاملين HR</p>
          </div>
          <div class="meta-section">
            <div><strong>رقم المرجع:</strong> ${docRefNum}</div>
            <div><strong>تاريخ الطباعة:</strong> ${printDate}</div>
            <div><strong>نوع المستند:</strong> ${docTitle}</div>
          </div>
        </div>

        <div class="emp-strip">
          <div><strong>اسم الموظف:</strong> ${empName}</div>
          <div><strong>كود الموظف:</strong> ${empCode}</div>
          <div><strong>الرقم القومي:</strong> ${natId}</div>
          <div><strong>الوظيفة/القسم:</strong> ${job} - ${dep}</div>
        </div>

        <div class="image-box">
          <img src="${fileUrl}" alt="${docTitle}" />
        </div>

        <div class="doc-footer">
          <div>
            <p>توقيع مسؤول الموارد البشرية</p>
            <div class="sig-line">إدارة شؤون العاملين</div>
          </div>
          <div class="stamp-box">
            <span>Remo Pro HR</span>
            <span>معتمد رسمياً</span>
            <span>${empCode}</span>
          </div>
          <div>
            <p>توقيع وختم الإدارة</p>
            <div class="sig-line">الإدارة العامة</div>
          </div>
        </div>
      `
      : printRef.current
      ? printRef.current.innerHTML
      : `
        <div class="doc-header">
          <div class="logo-section">
            <h2>مؤسسة Remo Pro</h2>
            <p>إدارة الموارد البشرية وشؤون العاملين HR</p>
          </div>
          <div class="meta-section">
            <div><strong>رقم المرجع:</strong> ${docRefNum}</div>
            <div><strong>تاريخ الطباعة:</strong> ${printDate}</div>
          </div>
        </div>
        <div class="emp-strip">
          <div><strong>اسم الموظف:</strong> ${empName} (${empCode})</div>
          <div><strong>المستند:</strong> ${docTitle} (${docCategory})</div>
        </div>
        <p style="text-align:center; padding: 40px; font-size:18px;">مستند رسمي معتمد في ملف الموظف الإلكتروني</p>
      `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>طباعة مستند - ${docTitle} - ${empName}</title>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 15px;
            color: #0f172a;
            background-color: #ffffff;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper {
            max-width: 800px;
            margin: 0 auto;
            border: 2px solid #1e293b;
            padding: 24px;
            border-radius: 12px;
            background: #ffffff;
          }
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .logo-section h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 900;
            color: #1e3a8a;
          }
          .logo-section p {
            margin: 2px 0 0 0;
            font-size: 12px;
            color: #475569;
            font-weight: 700;
          }
          .meta-section {
            text-align: left;
            font-size: 11px;
            color: #334155;
            direction: ltr;
            line-height: 1.5;
          }
          .emp-strip {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 16px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 18px;
            font-size: 12px;
          }
          .image-box {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 15px 0;
            min-height: 380px;
            max-height: 600px;
            border: 1px dashed #94a3b8;
            border-radius: 8px;
            padding: 10px;
            background: #f8fafc;
            overflow: hidden;
          }
          .image-box img {
            max-width: 100%;
            max-height: 580px;
            object-fit: contain;
            display: block;
            border-radius: 4px;
          }
          .doc-footer {
            margin-top: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #cbd5e1;
            padding-top: 16px;
            font-size: 12px;
            text-align: center;
          }
          .sig-line {
            margin-top: 25px;
            font-weight: 900;
            border-top: 1px dotted #64748b;
            padding-top: 4px;
            min-width: 140px;
          }
          .stamp-box {
            width: 80px;
            height: 80px;
            border: 2px dashed #059669;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #047857;
            font-weight: 900;
            font-size: 9px;
            transform: rotate(-10deg);
          }
          @media print {
            body { padding: 0; }
            .print-wrapper { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${contentHtml}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = docFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      handlePrint();
    }
  };

  const copyDocInfo = () => {
    const textToCopy = `المستند: ${docTitle}\nالموظف: ${doc.employeeName || ""}\nالكود: ${doc.employeeCode || ""}\nالتاريخ: ${doc.uploadDate || ""}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
        >
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 px-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">{docTitle}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    {docCategory}
                  </span>
                  {fileUrl && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>ملف حقيقي مرفوع</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                  {doc.employeeName && (
                    <span className="flex items-center gap-1 font-semibold text-slate-200">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span>الموظف: {doc.employeeName}</span>
                      {doc.employeeCode && (
                        <span className="font-mono text-blue-300">({doc.employeeCode})</span>
                      )}
                    </span>
                  )}
                  {doc.uploadDate && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>تاريخ التوثيق: {doc.uploadDate}</span>
                    </span>
                  )}
                  {doc.expiryDate && doc.expiryDate !== "غير محدد" && (
                    <span className="text-amber-300 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                      ينتهي في: {doc.expiryDate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 cursor-pointer border border-blue-400/30 active:scale-95"
                title="طباعة المستند الرسمي"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة المستند</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="تحميل الملف إلى الجهاز"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">تحميل الملف</span>
              </button>

              <button
                type="button"
                onClick={copyDocInfo}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="نسخ بيانات المستند"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {fileUrl && (
                <button
                  type="button"
                  onClick={() => window.open(fileUrl, "_blank")}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="فتح في نافذة كاملة جديدة"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-red-950/50 hover:text-red-300 rounded-xl transition-colors cursor-pointer mr-1"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Image / View Controls (Shown for real images) */}
          {isImage && fileUrl && (
            <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-3">
                <span className="font-bold flex items-center gap-1 text-slate-900 dark:text-white">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  أدوات التحكم بالصورة:
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 3.5))}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 font-bold shadow-sm cursor-pointer"
                  title="تكبير الصورة"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
                  <span>تكبير</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.4))}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 font-bold shadow-sm cursor-pointer"
                  title="تصغير الصورة"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-blue-600" />
                  <span>تصغير</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 font-bold shadow-sm cursor-pointer"
                  title="تدوير الصورة 90 درجة"
                >
                  <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                  <span>تدوير</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="px-2.5 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  إعادة ضبط ({Math.round(zoom * 100)}%)
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 dir-ltr font-bold">
                {docFileName}
              </div>
            </div>
          )}

          {/* Main Document Content Area */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-100/70 dark:bg-slate-950 min-h-[420px] flex items-center justify-center">
            {fileUrl ? (
              isImage ? (
                /* Real Image Display with Zoom & Rotation */
                <div className="w-full flex items-center justify-center p-4 bg-slate-900/10 dark:bg-black/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-auto min-h-[420px] max-h-[68vh]">
                  <div
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    }}
                    className="origin-center max-w-full flex items-center justify-center"
                  >
                    <img
                      src={fileUrl}
                      alt={docTitle}
                      className="max-w-full max-h-[64vh] object-contain rounded-xl shadow-2xl border-2 border-white dark:border-slate-800 bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";
                      }}
                    />
                  </div>
                </div>
              ) : isPdf ? (
                /* PDF Viewer Frame */
                <div className="w-full h-[68vh] rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-white shadow-xl">
                  <iframe
                    src={fileUrl}
                    title={docTitle}
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                /* Embedded Generic Frame */
                <div className="w-full h-[65vh] rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-white shadow-xl">
                  <iframe
                    src={fileUrl}
                    title={docTitle}
                    className="w-full h-full border-0"
                  />
                </div>
              )
            ) : (
              /* Generated Official Scanned Document Digital Voucher (Printable) */
              <div
                ref={printRef}
                className="bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl border-2 border-slate-300 max-w-3xl w-full mx-auto relative overflow-hidden"
              >
                {/* Background Watermark */}
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] pointer-events-none font-black text-9xl text-slate-900 select-none uppercase rotate-12">
                  REMO_PRO
                </div>

                {/* Header Strip */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-md">
                      RP
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">
                        مؤسسة Remo Pro لإدارة الأعمال
                      </h3>
                      <p className="text-xs font-bold text-slate-600">
                        قطاع الموارد البشرية وشؤون الموظفين HR
                      </p>
                    </div>
                  </div>
                  <div className="text-left font-mono text-xs text-slate-600 space-y-1 dir-ltr">
                    <div>
                      <strong>REF:</strong> DOC-
                      {doc.id || Math.floor(100000 + Math.random() * 900000)}
                    </div>
                    <div>
                      <strong>DATE:</strong>{" "}
                      {doc.uploadDate || new Date().toISOString().split("T")[0]}
                    </div>
                    <div>
                      <strong>STATUS:</strong>{" "}
                      <span className="text-emerald-700 font-black">
                        {doc.status || "معتمد رسمياً"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Title Banner */}
                <div className="text-center bg-slate-50 py-4 rounded-xl border border-slate-300 mb-6">
                  <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider mb-1">
                    سجل وثائقي معتمد وممسوح ضوئياً
                  </span>
                  <h1 className="text-2xl font-black text-slate-900">
                    {docTitle}
                  </h1>
                  <span className="inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                    التصنيف الرسمي: {docCategory}
                  </span>
                </div>

                {/* Employee Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5 font-bold">
                      اسم الموظف:
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {doc.employeeName || "الموظف المعتمد"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 font-bold">
                      كود الموظف:
                    </span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {doc.employeeCode || "EMP-101"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 font-bold">
                      الرقم القومي:
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {doc.nationalId || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 font-bold">
                      الوظيفة والقسم:
                    </span>
                    <span className="font-bold text-slate-800">
                      {doc.jobTitle || "إداري"} - {doc.department || "الرئيسي"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 font-bold">
                      صلاحية المستند:
                    </span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {doc.expiryDate && doc.expiryDate !== "غير محدد"
                          ? `ساري حتى ${doc.expiryDate}`
                          : "ساري ومستمر"}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 font-bold">
                      اسم الملف المرجعي:
                    </span>
                    <span className="font-mono text-slate-700 text-[11px] truncate block">
                      {docFileName}
                    </span>
                  </div>
                </div>

                {/* Scanned Badge Box */}
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50/70 my-6 relative flex flex-col items-center justify-center min-h-[220px]">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center mb-3 shadow-md">
                    <ShieldCheck className="w-9 h-9" />
                  </div>
                  <h4 className="font-black text-slate-800 text-base mb-1">
                    نسخة إلكترونية موثقة مطابقة للأصل
                  </h4>
                  <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                    تم توثيق وربط هذا المستند رسمياً ضمن ملف الموظف في منظومة
                    الموارد البشرية Remo Pro، وهي معتمدة للأغراض الإدارية
                    والرسمية.
                  </p>
                  {doc.notes && (
                    <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium max-w-lg">
                      <strong>ملاحظات التوثيق:</strong> {doc.notes}
                    </div>
                  )}
                </div>

                {/* Signatures & Stamps Footer */}
                <div className="pt-6 border-t-2 border-slate-200 flex items-center justify-between text-xs">
                  <div className="text-right">
                    <span className="text-slate-500 block mb-1 font-bold">
                      توقيع مدير الموارد البشرية:
                    </span>
                    <div className="font-black text-slate-800 text-sm font-serif underline decoration-blue-600 decoration-2">
                      إدارة شؤون العاملين
                    </div>
                  </div>

                  {/* QR Code Verification */}
                  <div className="flex items-center gap-2.5 bg-slate-100 p-2.5 px-3.5 rounded-xl border border-slate-300">
                    <QrCode className="w-10 h-10 text-slate-800 shrink-0" />
                    <div className="text-[10px] text-slate-600 font-mono leading-tight">
                      <div>VERIFIED HR DOC</div>
                      <div className="font-bold text-slate-900">
                        {doc.employeeCode || "EMP-101"}
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-slate-500 block mb-1 font-bold">
                      ختم الاعتماد الرسمي:
                    </span>
                    <div className="w-20 h-20 rounded-full border-2 border-emerald-600 text-emerald-800 font-black text-[10px] flex flex-col items-center justify-center rotate-[-12deg] bg-emerald-50/60 shadow-sm leading-tight text-center">
                      <span>Remo Pro</span>
                      <span className="border-y border-emerald-600 w-full my-0.5 py-0.5">
                        معتمد HR
                      </span>
                      <span>OFFICIAL</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 px-6 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              مرجع المستند:{" "}
              <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                {doc.id || "DOC-1001"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة المستند (A4)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
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
export default DocumentPreviewModal;
