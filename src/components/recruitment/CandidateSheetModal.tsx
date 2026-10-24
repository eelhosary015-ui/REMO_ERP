import React from "react";
import {
  X,
  Printer,
  FileSpreadsheet,
  FileText,
  Award,
  Sparkles,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  DollarSign,
  Calendar,
  Star,
  CheckCircle2,
  Building2,
  Download,
  AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { Application } from "../RecruitmentSuite";

interface CandidateSheetModalProps {
  candidate: Application;
  onClose: () => void;
  onConvertEmployee?: (candidate: Application) => void;
}

export const CandidateSheetModal: React.FC<CandidateSheetModalProps> = ({
  candidate,
  onClose,
  onConvertEmployee
}) => {
  // Export to Microsoft Word (.doc format with full formatting & RTL)
  const handleExportWordDoc = () => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>شيت بيانات متقدم - ${candidate.candidate_name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; padding: 25px; color: #0f172a; background-color: #ffffff; }
          .sheet-header { text-align: center; border-bottom: 3px double #0284c7; padding-bottom: 15px; margin-bottom: 25px; }
          .sheet-header h1 { color: #0f172a; font-size: 22px; margin: 0 0 5px 0; font-weight: bold; }
          .sheet-header p { color: #64748b; font-size: 13px; margin: 0; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; background-color: #f1f5f9; color: #0284c7; border: 1px solid #cbd5e1; }
          .section-title { background: #f8fafc; color: #0f172a; font-weight: bold; padding: 8px 12px; font-size: 15px; border-right: 4px solid #0284c7; margin-top: 20px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 9px 12px; font-size: 13px; text-align: right; vertical-align: middle; }
          th { background: #f1f5f9; font-weight: bold; width: 22%; color: #334155; }
          .ai-box { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 13px; color: #92400e; }
          .footer { font-size: 11px; text-align: center; color: #94a3b8; margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="sheet-header">
          <h1>استمارة ومفردات بيانات متقدم للعمل (AP Candidate Sheet)</h1>
          <p>Remo Pro HR Management & Recruitment System</p>
        </div>

        <div class="section-title">1. البيانات الشخصية ومعلومات الاتصال</div>
        <table>
          <tr>
            <th>اسم المتقدم بالكامل</th>
            <td><strong>${candidate.candidate_name || "-"}</strong></td>
            <th>رقم الموبايل / الهاتف</th>
            <td><strong dir="ltr">${candidate.phone || "-"}</strong></td>
          </tr>
          <tr>
            <th>البريد الإلكتروني</th>
            <td>${candidate.email || "-"}</td>
            <th>العمر</th>
            <td>${candidate.age ? candidate.age + " سنة" : "-"}</td>
          </tr>
          <tr>
            <th>العنوان والمدينة</th>
            <td>${candidate.address || "-"}</td>
            <th>مستوى اللغة الإنجليزية</th>
            <td>${candidate.english_level || "-"}</td>
          </tr>
        </table>

        <div class="section-title">2. المؤهلات والخبرات والراتب</div>
        <table>
          <tr>
            <th>الوظيفة المتقدم لها</th>
            <td><span class="badge">${candidate.job_title || "-"}</span></td>
            <th>المؤهل التعليمي والشهادة</th>
            <td>${candidate.qualification || "-"}</td>
          </tr>
          <tr>
            <th>الوظيفة الأخيرة / الحالية</th>
            <td>${candidate.last_title || "-"}</td>
            <th>اسم جهة العمل الأخيرة</th>
            <td>${candidate.current_employer || "-"}</td>
          </tr>
          <tr>
            <th>سنوات الخبرة الإجمالية</th>
            <td><strong>${candidate.experience_years || 0} سنوات</strong></td>
            <th>سبب ترك العمل السابق</th>
            <td>${candidate.reason_for_leaving || "-"}</td>
          </tr>
          <tr>
            <th>الراتب الحالي</th>
            <td>${candidate.current_salary ? candidate.current_salary + " " : "-"}</td>
            <th>الراتب المتوقع</th>
            <td><strong>${candidate.expected_salary ? candidate.expected_salary + " " : "-"}</strong></td>
          </tr>
          <tr>
            <th>شرط / تفاصيل الراتب</th>
            <td colspan="3">${candidate.salary_condition || "-"}</td>
          </tr>
          <tr>
            <th>المهارات الفنية والشخصية</th>
            <td colspan="3">${candidate.candidate_skills || "-"}</td>
          </tr>
        </table>

        <div class="section-title">3. تقرير وتوصية الذكاء الاصطناعي (AI Analysis)</div>
        <table>
          <tr>
            <th>نسبة المطابقة مع الوظيفة</th>
            <td><strong>%${candidate.ai_match_score || 0}</strong></td>
            <th>التوصية الفنية</th>
            <td>${candidate.ai_recommendation || "مناسب"}</td>
          </tr>
          <tr>
            <th>ملخص السيرة الذاتية</th>
            <td colspan="3">${candidate.ai_summary || "تم تفكيك وتحليل البيانات بالذكاء الاصطناعي بنجاح."}</td>
          </tr>
          <tr>
            <th>أبرز نقاط القوة</th>
            <td colspan="3">${candidate.ai_strengths || "-"}</td>
          </tr>
          <tr>
            <th>ملاحظات ونقاط التطوير</th>
            <td colspan="3">${candidate.ai_gaps || "-"}</td>
          </tr>
        </table>

        ${candidate.notes ? `
        <div class="section-title">4. ملاحظات وتقييم المقابلة والتواصل</div>
        <div class="ai-box">
          ${candidate.notes}
        </div>
        ` : ""}

        <div class="footer">
          تم استخراج وطباعة هذا المستند رسمياً من نظام التوظيف الإلكتروني بتاريخ ${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(["\ufeff" + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `شيت_بيانات_${candidate.candidate_name.replace(/\s+/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export to Excel sheet
  const handleExportExcel = () => {
    const rowData = [
      {
        "اسم المتقدم": candidate.candidate_name,
        "رقم الموبايل": candidate.phone,
        "البريد الإلكتروني": candidate.email || "-",
        "العمر": candidate.age || "-",
        "الوظيفة المطلوبة": candidate.job_title,
        "القسم": candidate.department_name || "-",
        "المؤهل الدراسي": candidate.qualification || "-",
        "سنوات الخبرة": candidate.experience_years || 0,
        "المسمى الأخير": candidate.last_title || "-",
        "جهة العمل الأخيرة": candidate.current_employer || "-",
        "العنوان": candidate.address || "-",
        "سبب ترك العمل": candidate.reason_for_leaving || "-",
        "الراتب الحالي": candidate.current_salary || 0,
        "الراتب المتوقع": candidate.expected_salary || 0,
        "مستوى الإنجليزية": candidate.english_level || "-",
        "المهارات": candidate.candidate_skills || "-",
        "نسبة التوافق AI": `%${candidate.ai_match_score || 0}`,
        "توصية AI": candidate.ai_recommendation || "-",
        "ملخص التقييم": candidate.ai_summary || "-",
        "حالة الطلب": candidate.status,
        "ملاحظات": candidate.notes || "-"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rowData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "بيانات المتقدم");
    XLSX.writeFile(workbook, `Candidate_${candidate.candidate_name.replace(/\s+/g, "_")}.xlsx`);
  };

  // Trigger Print View
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      {/* Print Hide container */}
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto border border-slate-200 dir-rtl text-right print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none">
        
        {/* Modal Top Bar (Hidden during print) */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base flex items-center gap-2">
                <span>استمارة بيانات المتقدم الاحترافية (AP Candidate Sheet)</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  جاهز للطباعة والتحميل
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                بيانات المتقدم الشاملة مع تحليل الذكاء الاصطناعي وتفاصيل المؤهلات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند</span>
            </button>

            <button
              onClick={handleExportWordDoc}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>تصدير Word (.doc)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE CANDIDATE PROFILE SHEET SHEET BODY */}
        <div className="p-6 md:p-8 space-y-6 text-slate-800 bg-white">
          
          {/* Sheet Header Banner */}
          <div className="border-b-2 border-slate-200 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Remo Pro HR System - AP Candidate Sheet
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                {candidate.candidate_name}
              </h1>
              <p className="text-sm font-bold text-purple-700 mt-0.5">
                الوظيفة المطلوبة: {candidate.job_title} {candidate.department_name ? `(${candidate.department_name})` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-600 block">نسبة مطابقة AI</span>
                <span className="text-xl font-black text-amber-700">% {candidate.ai_match_score || 0}</span>
              </div>

              <div className="text-center px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 block">الحالة الحالية</span>
                <span className="text-xs font-black text-purple-900">
                  {candidate.status === "submitted" && "مقدم حديثاً"}
                  {candidate.status === "reviewing" && "قيد المراجعة"}
                  {candidate.status === "interview" && "مقابلة شخصية"}
                  {candidate.status === "offered" && "عرض عمل"}
                  {candidate.status === "hired" && "مقبول ومُعين"}
                  {candidate.status === "rejected" && "غير مناسب"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Personal & Contact Info */}
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600" />
              <span>1. البيانات الشخصية ومعلومات الاتصال</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">الاسم الكامل:</span>
                <span className="font-extrabold text-slate-900">{candidate.candidate_name}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">رقم الموبايل:</span>
                <span className="font-mono font-extrabold text-slate-900" dir="ltr">
                  {candidate.phone}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">البريد الإلكتروني:</span>
                <span className="font-bold text-slate-800">{candidate.email || "غير مدخل"}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">العمر ومستوى الإنجليزية:</span>
                <span className="font-extrabold text-slate-800">
                  {candidate.age ? `${candidate.age} سنة` : "-"} | {candidate.english_level || "Good"}
                </span>
              </div>

              <div className="col-span-2 md:col-span-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">العنوان والسكن:</span>
                <span className="font-bold text-slate-800">{candidate.address || "غير محدد"}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Education, Qualifications & Experience */}
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              <span>2. المؤهل التعليمي والخبرات العملية والراتب</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 col-span-2">
                <span className="text-slate-400 block text-[10px]">المؤهل والشهادة التعليمية:</span>
                <span className="font-extrabold text-slate-900">{candidate.qualification || "مؤهل عالي"}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">سنوات الخبرة:</span>
                <span className="font-black text-purple-700">{candidate.experience_years || 0} سنوات</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">المسمى الوظيفي الأخير:</span>
                <span className="font-bold text-slate-800">{candidate.last_title || "غير مدخل"}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 col-span-2">
                <span className="text-slate-400 block text-[10px]">جهة العمل الأخيرة / الحالية:</span>
                <span className="font-bold text-slate-800">{candidate.current_employer || "غير مدخل"}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 col-span-2">
                <span className="text-slate-400 block text-[10px]">سبب ترك العمل السابق:</span>
                <span className="font-bold text-slate-800">{candidate.reason_for_leaving || "البحث عن فرصة جديدة"}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">الراتب الحالي:</span>
                <span className="font-bold text-slate-800">{candidate.current_salary ? `${candidate.current_salary}` : "-"}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">الراتب المتوقع:</span>
                <span className="font-black text-emerald-700">{candidate.expected_salary ? `${candidate.expected_salary}` : "-"}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Skills List */}
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              <span>3. المهارات والقدرات الخاصة (Skills)</span>
            </h3>

            {candidate.candidate_skills ? (
              <div className="flex flex-wrap gap-1.5 bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200">
                {candidate.candidate_skills.split(",").map((sk, idx) => (
                  <span
                    key={idx}
                    className="bg-white text-purple-900 border border-purple-300 px-3 py-1 rounded-xl text-xs font-extrabold shadow-sm"
                  >
                    {sk.trim()}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-xs italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                لم يتم إدخال قائمة المهارات بصورة منفصلة.
              </p>
            )}
          </div>

          {/* Section 4: Attached Dossier & Documents */}
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-slate-100 pb-1">
              <FileText className="w-4 h-4 text-purple-600" />
              <span>4. ملفات السيرة الذاتية والمستندات المرفقة (Candidate Dossier & Documents)</span>
            </h3>

            {candidate.cv_file_url ? (
              <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-900">ملف السيرة الذاتية المسجل رسمياً</h4>
                    <p className="text-[10px] text-purple-700 font-bold mt-0.5 dir-ltr truncate max-w-xs">{candidate.cv_file_url}</p>
                  </div>
                </div>
                <a
                  href={candidate.cv_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 print:hidden"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل / فتح الملف</span>
                </a>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>لم يتم إرفاق رابط ملف سيرة ذاتية مباشر، البيانات مفرغة في الشيت الإلكتروني.</span>
              </div>
            )}
          </div>

          {/* Section 5: AI Analysis Box */}
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-3xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 fill-amber-600" />
                <h4 className="font-black text-amber-950">تقرير الفرز بالذكاء الاصطناعي (Gemini AI Evaluation)</h4>
              </div>
              <span className="bg-amber-200/60 text-amber-900 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                توصية: {candidate.ai_recommendation || "مناسب"}
              </span>
            </div>

            <p className="text-slate-700 leading-relaxed font-bold">
              {candidate.ai_summary || "تم تحليل ومطابقة السيرة الذاتية واستخراج كافة الحقول تلقائياً بنجاح."}
            </p>

            {candidate.ai_strengths && (
              <div>
                <span className="font-black text-emerald-800 block mb-1">أبرز نقاط القوة:</span>
                <p className="text-slate-700 bg-white/80 p-2.5 rounded-xl border border-emerald-200 font-bold">
                  {candidate.ai_strengths}
                </p>
              </div>
            )}

            {candidate.ai_gaps && (
              <div>
                <span className="font-black text-amber-800 block mb-1">نقاط الملاحظة والتطوير:</span>
                <p className="text-slate-700 bg-white/80 p-2.5 rounded-xl border border-amber-200 font-bold">
                  {candidate.ai_gaps}
                </p>
              </div>
            )}
          </div>

          {/* Notes / Rating Section */}
          {candidate.notes && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1">
              <span className="font-black text-slate-800 block">ملاحظات التقييم والمقابلة:</span>
              <p className="text-slate-700 font-bold whitespace-pre-line">{candidate.notes}</p>
            </div>
          )}

          {/* Sheet Footer */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 flex justify-between items-center print:pt-8">
            <span>Remo Pro HR System - شيت المتقدمين AP Candidate Sheet</span>
            <span>تاريخ الاستخراج: {new Date().toLocaleDateString("ar-EG")}</span>
          </div>

          {/* Action Footer for UI (Hidden during print) */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between print:hidden">
            {onConvertEmployee && candidate.status !== "hired" && (
              <button
                onClick={() => onConvertEmployee(candidate)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تعيين رسمياً كموظف بالشركة</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs mr-auto"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
