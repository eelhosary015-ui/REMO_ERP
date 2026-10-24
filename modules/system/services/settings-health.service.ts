import fs from "fs";
import path from "path";
import { pool } from "../../../server-db.js";

/**
 * Settings Health
 * ────────────────────────────────────────────────────────────────────────────
 * جدول `settings` فيه مفاتيح بتتضاف مع الوقت، ومش كل مفتاح مرتبط بكود فعلي.
 * الخدمة دي بتمسح الكود نفسه (مرة كل 5 دقائق) عشان تعرف:
 *   - أي مفتاح موجود في الداتابيز ومحدش بيقرأه (يتيم)
 *   - أي مفتاح الكود بيقرأه وهو مش موجود في الداتابيز (بيرجع للافتراضي بصمت)
 * وتعرضهم في شاشة "صحة النظام".
 */

const SCAN_DIRS = ["modules", "src"];
const SCAN_FILES = ["server.ts", "server-db-init.ts", "server-erp-core.ts"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "backups", "uploads", "data", "build", ".next", "public"]);
const CACHE_TTL_MS = 5 * 60 * 1000;

const KEY_PATTERNS: RegExp[] = [
  // getSetting('key') / getSetting("key", 'default')
  /getSetting\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g,
  // "/api/settings/<key>" — بس لو المفتاح بينتهي عند نهاية السلسلة أو قبل اقتباس/استعلام
  /\/api\/settings\/([a-zA-Z0-9_]+)(?=['"`?&#)\s]|$)/g,
];

export type CatalogEntry = {
  key: string;
  label: string;
  consumers?: string[];
  dynamic?: boolean;
};

/** مفاتيح مهمة معروفة + وصف عربي + من بيقرأها. */
export const SETTINGS_CATALOG: CatalogEntry[] = [
  { key: "pos_configuration", label: "إعدادات نقطة البيع — وتشمل قوالب الفواتير والرسيبتات المختارة", dynamic: true, consumers: ["POSSettings.tsx", "POS.tsx"] },
  { key: "automatic_receipt_printing", label: "طباعة فاتورة العميل تلقائيًا بعد كل أوردر من نقطة البيع", consumers: ["server.ts"] },
  { key: "receipt_print_method", label: "طريقة الطباعة (متصفح / طابعة الجهاز)" },
  { key: "receipt_template", label: "قالب إيصال العميل المستخدم في الطابعة الحرارية", consumers: ["server.ts"] },
  { key: "receipt_template_internal", label: "قالب الإيصال الداخلي (تذاكر المطبخ)", consumers: ["server.ts"] },
  { key: "receipt_printer_width", label: "عرض سطور فاتورة العميل (عدد الحروف)", consumers: ["server.ts"] },
  { key: "receipt_printer_width_internal", label: "عرض سطور الإيصال الداخلي", consumers: ["server.ts"] },
  { key: "receipt_code_page", label: "ترميز الحروف في فاتورة العميل", consumers: ["server.ts"] },
  { key: "receipt_code_page_internal", label: "ترميز الحروف في الإيصال الداخلي", consumers: ["server.ts"] },
  { key: "receipt_font_size", label: "حجم خط فاتورة العميل", consumers: ["server.ts"] },
  { key: "receipt_font_weight", label: "سماكة خط فاتورة العميل", consumers: ["server.ts"] },
  { key: "receipt_hide_prices_internal", label: "إخفاء الأسعار في الإيصال الداخلي", consumers: ["server.ts"] },
  { key: "receipt_reverse_arabic", label: "عكس ترتيب الحروف العربية في الفاتورة", consumers: ["server.ts"] },
  { key: "receipt_reverse_arabic_internal", label: "عكس ترتيب الحروف العربية في الإيصال الداخلي", consumers: ["server.ts"] },
  { key: "receipt_hotline", label: "الخط الساخن على الريسيت", consumers: ["ReceiptPrintModal.tsx", "OrderEditorModal.tsx"] },
  { key: "receipt_logo", label: "شعار الريسيت" },
  { key: "receipt_slogan", label: "شعار المطعم على الريسيت" },
  { key: "receipt_thank_you", label: "عبارة الشكر على الريسيت" },
  { key: "restaurant_name", label: "اسم المنشأة في الريسيت", consumers: ["server.ts"] },
  { key: "backup_interval", label: "ساعات النسخ الاحتياطي التلقائي", consumers: ["server.ts"] },
];

const CATALOG_KEYS = new Map(SETTINGS_CATALOG.map((entry) => [entry.key, entry]));

let cachedUsage: { scannedAt: number; usage: Map<string, Set<string>> } | null = null;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanSourceFiles(): string[] {
  const root = process.cwd();
  const files: string[] = [];
  for (const dir of SCAN_DIRS) files.push(...collectSourceFiles(path.join(root, dir)));
  for (const file of SCAN_FILES) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) files.push(full);
  }
  return files;
}

/** Which setting keys does the code actually read, and from where? */
export function scanSettingsUsage(force = false): Map<string, Set<string>> {
  const now = Date.now();
  if (!force && cachedUsage && now - cachedUsage.scannedAt < CACHE_TTL_MS) {
    return cachedUsage.usage;
  }

  const usage = new Map<string, Set<string>>();
  for (const file of scanSourceFiles()) {
    // الملف ده نفسه فيه أنماط البحث، فلو اتقرأ هيطّلع مفاتيح وهمية
    if (file.endsWith("settings-health.service.ts")) continue;
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const consumer = path.relative(process.cwd(), file).replace(/\\/g, "/");
    for (const pattern of KEY_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[1];
        // استبعاد المفاتيح الديناميكية/الناقصة مثل `payroll_${x}` → "payroll_"
        if (!key || key.includes("$") || key.endsWith("_")) continue;
        const consumers = usage.get(key) || new Set<string>();
        consumers.add(consumer);
        usage.set(key, consumers);
      }
    }
  }

  cachedUsage = { scannedAt: now, usage };
  return usage;
}

export type SettingsHealthReport = {
  generatedAt: string;
  totals: {
    dbKeys: number;
    codeKeys: number;
    healthy: number;
    unused: number;
    missing: number;
  };
  unusedKeys: { key: string; valuePreview: string; note: string }[];
  missingKeys: { key: string; usedIn: string[]; important: boolean; note: string }[];
  catalog: {
    key: string;
    label: string;
    exists: boolean;
    readByCode: boolean;
    consumers: string[];
  }[];
  warnings: string[];
};

const preview = (value: string | null | undefined) => {
  if (!value) return "";
  const clean = String(value).replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
};

export async function getSettingsHealth(): Promise<SettingsHealthReport> {
  const usage = scanSettingsUsage();
  const rows = await pool.query("SELECT key, value FROM settings ORDER BY key");
  const dbKeys = new Map<string, string | null>(
    (rows.rows as { key: string; value: string | null }[]).map((row) => [row.key, row.value])
  );

  const unusedKeys: SettingsHealthReport["unusedKeys"] = [];
  for (const [key, value] of dbKeys) {
    if (usage.has(key) || CATALOG_KEYS.has(key)) continue;
    unusedKeys.push({
      key,
      valuePreview: preview(value),
      note: "موجود في الداتابيز ومحدش بيقرأه — ممكن يكون إعداد قديم",
    });
  }

  const missingKeys: SettingsHealthReport["missingKeys"] = [];
  for (const [key, consumers] of usage) {
    if (dbKeys.has(key)) continue;
    if (CATALOG_KEYS.get(key)?.dynamic) continue;
    missingKeys.push({
      key,
      usedIn: [...consumers],
      important: CATALOG_KEYS.has(key),
      note: CATALOG_KEYS.has(key)
        ? "إعداد مهم وغير موجود — النظام بيرجع للقيمة الافتراضية بصمت"
        : "الكود بيقرأه وهو غير موجود في الداتابيز (بيستخدم الافتراضي)",
    });
  }

  const warnings: string[] = [];
  if (unusedKeys.length > 0) {
    warnings.push(`${unusedKeys.length} إعداد في الداتابيز غير مستخدم من الكود`);
  }
  const importantMissing = missingKeys.filter((entry) => entry.important);
  if (importantMissing.length > 0) {
    warnings.push(`${importantMissing.length} إعداد مهم موجود في الكود وغير موجود في الداتابيز`);
  }
  if (dbKeys.has("pos_configuration")) {
    try {
      const parsed = JSON.parse(String(dbKeys.get("pos_configuration")));
      const templateId = parsed?.invoiceTemplates?.customerTemplateId;
      if (!templateId) {
        warnings.push("pos_configuration محفوظ بدون اختيار قالب لفاتورة العميل");
      }
    } catch {
      warnings.push("pos_configuration محفوظ بصيغة JSON غير صالحة");
    }
  } else {
    warnings.push("pos_configuration غير موجود — قوالب الفواتير المختارة مش هتشتغل");
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      dbKeys: dbKeys.size,
      codeKeys: usage.size,
      healthy: [...dbKeys.keys()].filter((key) => usage.has(key)).length,
      unused: unusedKeys.length,
      missing: missingKeys.length,
    },
    unusedKeys,
    missingKeys,
    catalog: SETTINGS_CATALOG.map((entry) => ({
      key: entry.key,
      label: entry.label,
      exists: dbKeys.has(entry.key),
      readByCode: usage.has(entry.key),
      consumers: [...(usage.get(entry.key) || new Set(entry.consumers || []))],
    })),
    warnings,
  };
}
