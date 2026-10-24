/**
 * التواريخ المحاسبية (تاريخ القيد، تاريخ الفاتورة...) قيم تقويمية بلا وقت.
 * تُخزَّن في قاعدة البيانات كمنتصف ليل محلي، وعندما تُرسل عبر JSON كسلسلة
 * ISO/UTC فإن اليوم يتراجع يومًا في المناطق الزمنية الموجبة (مثل مصر UTC+3)،
 * فيظهر قيد اليوم بتاريخ الأمس في شيت القيود اليومية.
 *
 * هذا المُساعد يُعيد اليوم الصحيح اعتمادًا على مكوّنات التاريخ المحلية،
 * ويعمل مع الحالات الثلاث: "YYYY-MM-DD" أو ISO كامل أو قيمة غير صالحة.
 */
export const toDateOnly = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";

  // التواريخ التقويمية الجاهزة (مثل ما يرجع من قاعدة البيانات أو من <input type="date">)
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    // قيمة غير قابلة للتحليل: لا نخترع تاريخًا، نكتفي بالجزء التقويمي إن وُجد
    return text.split("T")[0] || "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

export default toDateOnly;
