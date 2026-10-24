/**
 * تنسيق القيم التقويمية (أعمدة DATE / timestamp تقويمي) بصيغة YYYY-MM-DD
 * مع الحفاظ على اليوم المحلي للسيرفر.
 *
 * node-postgres يُعيد أعمدة DATE ككائن Date عند منتصف الليل المحلي، لذا فإن
 * toISOString() تطرح فرق المنطقة الزمنية وتُرجع اليوم السابق (مصر UTC+3):
 * فاتورة بتاريخ 2026-10-13 كانت تُقرأ 2026-10-12، وبالتالي يُرحَّل قيد
 * اليومية الخاص بها بتاريخ الأمس.
 */
export function toDateOnly(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : formatLocal(value);
  }

  const text = String(value).trim();
  // تواريخ تقويمية جاهزة لا تحتاج أي تحويل
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return text.split("T")[0] || "";
  return formatLocal(parsed);
}

export default toDateOnly;
