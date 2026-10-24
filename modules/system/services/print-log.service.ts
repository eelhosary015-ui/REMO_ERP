import { pool } from "../../../server-db.js";

/**
 * Print Log + Retry
 * ────────────────────────────────────────────────────────────────────────────
 * كل محاولة طباعة (فاتورة عميل / تذكرة مطبخ / اختبار) بتتسجل في جدول print_jobs
 * مع بايتاتها، فـ:
 *   • تقدر تشوف مين طبع إيه وفشل إمتى.
 *   • اللي فشل بيتحاول تاني تلقائيًا (worker كل دقيقة).
 *   • تقدر تعيد طباعة أي سطر يدوي من شاشة الطابعات.
 *
 * ملاحظة: الجدول كان موجود بمخطط أقدم (attempts/error)، فالتعريف هنا idempotent
 * ويضيف الأعمدة الناقصة بدون ما يمس أي بيانات موجودة.
 */

export type PrintJobKind = "receipt" | "kitchen" | "test";
export type PrintJobStatus = "sent" | "pending" | "failed";

export type PrintJob = {
  id: number;
  order_id: number | null;
  branch_id: number | null;
  printer_id: number | null;
  printer_name: string;
  connection_type: string | null;
  printer_snapshot?: Record<string, unknown> | null;
  kind: PrintJobKind;
  status: PrintJobStatus;
  attempts: number;
  byte_size: number | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  updated_at: string | null;
};

export type RawPrinterSender = (
  printer: Record<string, unknown>,
  data: Buffer,
  meta: { kind?: PrintJobKind; jobId?: number; attempt?: number }
) => Promise<{ ok: boolean; via: string; message?: string }>;

let tableReady: Promise<void> | null = null;

const ENSURED_COLUMNS: { name: string; ddl: string }[] = [
  { name: "printer_id", ddl: "INTEGER" },
  { name: "printer_name", ddl: "TEXT" },
  { name: "connection_type", ddl: "TEXT" },
  { name: "printer_snapshot", ddl: "JSONB" },
  { name: "kind", ddl: `TEXT NOT NULL DEFAULT 'receipt'` },
  { name: "status", ddl: `TEXT NOT NULL DEFAULT 'pending'` },
  { name: "attempts", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { name: "byte_size", ddl: "INTEGER" },
  { name: "error", ddl: "TEXT" },
  { name: "payload", ddl: "BYTEA" },
  { name: "sent_at", ddl: "TIMESTAMP" },
  { name: "updated_at", ddl: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
];

export function ensurePrintJobsTable(): Promise<void> {
  if (tableReady) return tableReady;

  const run = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        branch_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    for (const column of ENSURED_COLUMNS) {
      await pool.query(`ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS "${column.name}" ${column.ddl}`);
    }
    // Older schemas created order_id as NOT NULL, which rejects kitchen/test prints
    // (they have no order). Relaxing it is idempotent and keeps existing rows intact.
    await pool.query(`ALTER TABLE print_jobs ALTER COLUMN order_id DROP NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id)`);
  };

  tableReady = run()
    .then(() => undefined)
    .catch((error: any) => {
      console.error("[PrintLog] failed to ensure print_jobs table:", error?.message || error);
      tableReady = null;
    }) as Promise<void>;

  return tableReady;
}

export async function recordPrintJob(input: {
  orderId?: number | null;
  branchId?: number | null;
  printerId?: number | null;
  printerName: string;
  connectionType?: string | null;
  printerSnapshot?: Record<string, unknown> | null;
  kind: PrintJobKind;
  status: PrintJobStatus;
  attempts?: number;
  byteSize?: number | null;
  error?: string | null;
  payload?: Buffer | null;
}): Promise<number | null> {
  await ensurePrintJobsTable();
  try {
    const result = await pool.query(
      `INSERT INTO print_jobs
         (order_id, branch_id, printer_id, printer_name, connection_type, printer_snapshot,
          kind, status, attempts, byte_size, error, payload, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, CASE WHEN $8 = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END)
       RETURNING id`,
      [
        input.orderId ?? null,
        input.branchId ?? null,
        input.printerId ?? null,
        input.printerName,
        input.connectionType ?? null,
        input.printerSnapshot ? JSON.stringify(input.printerSnapshot) : null,
        input.kind,
        input.status,
        input.attempts ?? 1,
        input.byteSize ?? null,
        input.error ?? null,
        input.payload ?? null,
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch (error: any) {
    console.error("[PrintLog] failed to record print job:", error?.message || error);
    return null;
  }
}

export async function updatePrintJob(
  id: number,
  patch: { status?: PrintJobStatus; attempts?: number; error?: string | null }
): Promise<void> {
  await ensurePrintJobsTable();
  try {
    await pool.query(
      `UPDATE print_jobs
          SET status = COALESCE($2, status),
              attempts = COALESCE($3, attempts),
              error = $4,
              sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [id, patch.status ?? null, patch.attempts ?? null, patch.error ?? null]
    );
  } catch (error: any) {
    console.error(`[PrintLog] failed to update print job #${id}:`, error?.message || error);
  }
}

const SELECT_COLUMNS = `id, order_id, branch_id, printer_id, printer_name, connection_type,
                         kind, status, attempts, byte_size, error, created_at, sent_at, updated_at`;

/** Failed jobs from the last `maxAgeMinutes` that still have a payload to resend. */
export async function getRetryablePrintJobs(maxAgeMinutes = 60, limit = 10) {
  await ensurePrintJobsTable();
  const result = await pool.query(
    `SELECT *, printer_snapshot, payload FROM print_jobs
      WHERE status IN ('pending','failed')
        AND payload IS NOT NULL
        AND created_at > CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
      ORDER BY created_at ASC
      LIMIT $2`,
    [String(maxAgeMinutes), limit]
  );
  return result.rows as (PrintJob & { payload: Buffer; printer_snapshot: Record<string, unknown> | null })[];
}

export async function getPrintJobs(options: { limit?: number; status?: string; orderId?: number } = {}) {
  await ensurePrintJobsTable();
  const limit = Math.min(Number(options.limit) || 100, 500);
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }
  if (options.orderId) {
    params.push(options.orderId);
    conditions.push(`order_id = $${params.length}`);
  }
  params.push(limit);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM print_jobs ${where} ORDER BY id DESC LIMIT $${params.length}`,
    params
  );
  return result.rows as PrintJob[];
}

export async function getPrintJobsSummary() {
  await ensurePrintJobsTable();
  const result = await pool.query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM print_jobs
     WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`
  );
  return result.rows[0] || { total: 0, sent: 0, pending: 0, failed: 0 };
}

/** Re-sends failed prints (max 3 attempts) using the printer binding stored with the job. */
export async function retryFailedPrintJobs(
  send: RawPrinterSender,
  maxAttempts = 3
): Promise<{ checked: number; resent: number; stillFailing: number }> {
  const jobs = await getRetryablePrintJobs(60, 10);
  let resent = 0;
  let stillFailing = 0;

  for (const job of jobs) {
    const attempt = Number(job.attempts || 0) + 1;
    if (attempt > maxAttempts) {
      await updatePrintJob(job.id, { status: "failed", attempts: job.attempts, error: `تجاوز ${maxAttempts} محاولات` });
      continue;
    }

    const snapshot = (job.printer_snapshot || {}) as Record<string, unknown>;
    const printer = {
      id: job.printer_id ?? undefined,
      name: job.printer_name,
      connection_type: job.connection_type || snapshot.connection_type || null,
      system_printer_name: snapshot.system_printer_name ?? null,
      ip_address: snapshot.ip_address ?? null,
      port: snapshot.port ?? 9100,
    };

    const result = await send(printer, job.payload, { kind: job.kind, jobId: job.id, attempt });
    // نحدّث الحالة هنا كمان (حتى لو فشل التحديث جوه الـ sender)
    await updatePrintJob(job.id, {
      status: result.ok ? "sent" : "failed",
      attempts: attempt,
      error: result.ok ? null : result.message || "فشلت إعادة الطباعة",
    });

    if (result.ok) resent++;
    else stillFailing++;
  }

  return { checked: jobs.length, resent, stillFailing };
}
