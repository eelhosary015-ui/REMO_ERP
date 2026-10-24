// Helper utilities for Financial Transfers

export const formatCurrency = (amount: number | string | undefined | null, currency: string = "ج.م"): string => {
  const num = typeof amount === "number" ? amount : parseFloat(amount || "0");
  if (isNaN(num)) return `0.00 ${currency}`;
  return `${num.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

export const formatDate = (dateVal: any, includeTime: boolean = false): string => {
  if (!dateVal) return "---";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "---";
  return includeTime
    ? d.toLocaleString("ar-EG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : d.toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
};

// Arabic Tafqeet (Numbers to Arabic Words)
export const tafqeetArabic = (num: number, currencyName: string = "جنيه مصري", subCurrency: string = "قرش"): string => {
  if (isNaN(num) || num === 0) return "صفر";
  
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  function convertGroup(n: number): string {
    let res = "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const o = rem % 10;

    if (h > 0) {
      res += hundreds[h];
      if (rem > 0) res += " و";
    }

    if (rem >= 10 && rem < 20) {
      res += teens[rem - 10];
    } else {
      if (o > 0) {
        res += ones[o];
        if (t > 0) res += " و";
      }
      if (t > 0) {
        res += tens[t];
      }
    }
    return res.trim();
  }

  let parts: string[] = [];
  const millions = Math.floor(integerPart / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remaining = integerPart % 1000;

  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (remaining > 0) {
    parts.push(convertGroup(remaining));
  }

  let text = parts.join(" و ") + ` ${currencyName}`;

  if (decimalPart > 0) {
    text += ` و ${convertGroup(decimalPart)} ${subCurrency}`;
  }

  return `فقط ${text} لا غير`;
};

export const getStatusConfig = (status: string) => {
  switch (status) {
    case "draft":
      return {
        label: "مسودة",
        color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700",
        badgeDot: "bg-slate-400"
      };
    case "pending_approval":
      return {
        label: "قيد الاعتماد",
        color: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        badgeDot: "bg-amber-500"
      };
    case "approved":
      return {
        label: "معتمد (جاهز للتنفيذ)",
        color: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
        badgeDot: "bg-blue-500"
      };
    case "executed":
    case "in_transit":
      return {
        label: "قيد النقل والتنفيذ",
        color: "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
        badgeDot: "bg-indigo-500"
      };
    case "pending_receipt":
      return {
        label: "في انتظار الاستلام",
        color: "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
        badgeDot: "bg-purple-500"
      };
    case "received":
    case "completed":
    case "posted":
      return {
        label: "مكتمل ومرحل",
        color: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        badgeDot: "bg-emerald-500"
      };
    case "rejected":
      return {
        label: "مرفوض",
        color: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
        badgeDot: "bg-rose-500"
      };
    case "cancelled":
      return {
        label: "ملغي",
        color: "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700",
        badgeDot: "bg-zinc-400"
      };
    case "reversed":
      return {
        label: "معكوس",
        color: "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700",
        badgeDot: "bg-amber-600"
      };
    default:
      return {
        label: status,
        color: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
        badgeDot: "bg-gray-400"
      };
  }
};

export const getTransferTypeLabel = (type: string) => {
  switch (type) {
    case "safe_to_safe":
      return "خزينة ← خزينة";
    case "safe_to_bank":
      return "خزينة ← بنك (إيداع)";
    case "bank_to_safe":
      return "بنك ← خزينة (سحب)";
    case "bank_to_bank":
      return "بنك ← بنك (تحويل بنكي)";
    case "branch_transfer":
      return "تحويل بين الفروع";
    case "cost_center_transfer":
      return "تحويل بين مراكز التكلفة";
    default:
      return type;
  }
};
