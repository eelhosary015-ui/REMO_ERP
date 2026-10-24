import { Router } from "express";
import { pool } from "../../server-db.js";
import { authenticateToken } from "../system/system_api.routes.js";
import { getAccountConfig, getOpenPeriod } from "../accounts/services/auto-posting.service.js";
import { generateTreasuryVoucherNumber } from "./services/treasury-voucher.service.js";

const router = Router();

/* ------------------------------------------------------------------ */
/* Schema + helpers                                                    */
/* ------------------------------------------------------------------ */

let schemaReady: Promise<void> | null = null;

async function ensureBankSchema() {
  const statements = [
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS treasury_account_id INTEGER`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_id INTEGER`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS gl_account_id INTEGER`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS available_balance DECIMAL(15,2)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_status VARCHAR(30) DEFAULT 'active'`,
    `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER`,
    `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS treasury_transaction_id INTEGER`,
    `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS category VARCHAR(40)`,
    `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS counterparty TEXT`,
    `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS balance_after DECIMAL(15,2)`,
    `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EGP'`,
    `ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS statement_date DATE`,
    `ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS total_credits DECIMAL(15,2) DEFAULT 0`,
    `ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS total_debits DECIMAL(15,2) DEFAULT 0`,
    `ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'manual'`,
    `ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(30) DEFAULT 'unmatched'`,
    `ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS matched_transaction_id INTEGER`,
    `CREATE INDEX IF NOT EXISTS idx_bank_tx_account_date ON bank_transactions(account_id, transaction_date)`,
    `CREATE INDEX IF NOT EXISTS idx_bank_tx_status ON bank_transactions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_bank_stmt_lines_statement ON bank_statement_lines(statement_id)`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      if (!/already exists|duplicate column/i.test(String(err?.message || ""))) {
        console.warn("[BankModule] schema:", err?.message || err);
      }
    }
  }
}

function ready() {
  if (!schemaReady) schemaReady = ensureBankSchema().catch((e) => console.error("[BankModule] ensure schema failed:", e));
  return schemaReady;
}

router.use(async (_req, _res, next) => {
  await ready();
  next();
});

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

async function getSettings(client: any = pool): Promise<Record<string, any>> {
  const defaults: Record<string, any> = {
    default_currency: "EGP",
    reconciliation_tolerance: "0.01",
    allow_negative_balance: "false",
    require_approval_over: "50000",
    auto_post_to_accounting: "true",
  };
  try {
    const rows = (await client.query("SELECT setting_key, setting_value FROM bank_module_settings")).rows;
    for (const row of rows) defaults[row.setting_key] = row.setting_value;
  } catch (_) {}
  return defaults;
}

async function getDefaultCashTreasuryId(client: any, branchId?: number | null): Promise<number | null> {
  const scoped = await client.query(
    `SELECT id FROM treasury_accounts
      WHERE COALESCE(type,'cash') = 'cash' AND ($1::int IS NULL OR branch_id = $1)
      ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1`,
    [branchId ?? null]
  );
  if (scoped.rows[0]) return Number(scoped.rows[0].id);
  const any = await client.query(
    `SELECT id FROM treasury_accounts WHERE COALESCE(type,'cash') = 'cash' ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1`
  );
  return any.rows[0] ? Number(any.rows[0].id) : null;
}

async function postJournalEntry(
  client: any,
  opts: {
    date: string;
    description: string;
    reference?: string | null;
    source_type: string;
    source_id?: number | null;
    branch_id?: number | null;
    user_id?: number | null;
    lines: Array<{ account_id: number; debit?: number; credit?: number; notes?: string }>;
  }
): Promise<number | null> {
  const lines = (opts.lines || []).filter(
    (line) => line && Number(line.account_id) > 0 && (toNumber(line.debit) > 0 || toNumber(line.credit) > 0)
  );
  if (!lines.length) return null;

  const totalDebit = lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error("القيد المحاسبي غير متوازن (مدين ≠ دائن)");
  }

  const period = await getOpenPeriod(opts.date, client).catch(() => null);
  const entry = await client.query(
    `INSERT INTO journal_entries
       (date, description, reference, source_type, source_id, status, total_debit, total_credit, created_by, branch_id, period_id)
     VALUES ($1,$2,$3,$4,$5,'posted',$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      opts.date,
      opts.description,
      opts.reference || null,
      opts.source_type,
      opts.source_id || null,
      totalDebit,
      totalCredit,
      opts.user_id || null,
      opts.branch_id || null,
      period?.id ?? null,
    ]
  );
  const journalId = Number(entry.rows[0].id);

  for (const line of lines) {
    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);
    await client.query(
      `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES ($1,$2,$3,$4,$5)`,
      [journalId, line.account_id, debit, credit, line.notes || null]
    );
    await client.query(`UPDATE accounts SET balance = balance + $1 - $2 WHERE id = $3`, [
      debit,
      credit,
      line.account_id,
    ]);
  }
  return journalId;
}

async function insertTreasuryMovement(
  client: any,
  opts: {
    account_id: number;
    amount: number; // signed
    transaction_type: string;
    reference_type: string;
    reference_id?: number | null;
    notes: string;
    date: string;
    user_id?: number | null;
    branch_id?: number | null;
    counterparty?: string | null;
    payment_method?: string;
    allow_negative?: boolean;
  }
): Promise<number | null> {
  if (!opts.account_id || Math.abs(opts.amount) < 0.005) return null;

  const account = (
    await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [opts.account_id])
  ).rows[0];
  if (!account) throw new Error("حساب الخزينة المرتبط غير موجود");

  const before = toNumber(account.current_balance);
  const after = before + opts.amount;
  if (after < 0 && !opts.allow_negative) {
    throw new Error(`رصيد الخزينة (${account.name}) غير كافٍ لتنفيذ الحركة`);
  }

  const voucherType = opts.amount >= 0 ? "receipt" : "payment";
  let voucherNumber: string | null = null;
  try {
    voucherNumber = await generateTreasuryVoucherNumber(
      client,
      voucherType,
      new Date(opts.date).getFullYear()
    );
  } catch (_) {}

  const tx = await client.query(
    `INSERT INTO treasury_transactions
       (account_id, amount, transaction_type, reference_type, reference_id, created_by, notes, status,
        voucher_type, voucher_number, balance_before, balance_after, branch_id, date, payment_method, client_type, client_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',$8,$9,$10,$11,$12,$13,$14,'bank',$15)
     RETURNING id`,
    [
      opts.account_id,
      opts.amount,
      opts.transaction_type,
      opts.reference_type,
      opts.reference_id || null,
      opts.user_id || null,
      opts.notes,
      voucherType,
      voucherNumber,
      before,
      after,
      opts.branch_id || account.branch_id || null,
      opts.date,
      opts.payment_method || "bank",
      opts.counterparty || null,
    ]
  );

  await client.query(`UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [
    opts.amount,
    opts.account_id,
  ]);

  return Number(tx.rows[0].id);
}

async function ensureBankGlAccount(client: any, bankAccount: any, config: any): Promise<number> {
  if (bankAccount.gl_account_id) return Number(bankAccount.gl_account_id);

  // Each bank account gets its own GL sub-account under the configured bank parent (112).
  const parentId = Number(config.bank) || null;
  let parent: any = null;
  if (parentId) {
    parent = (await client.query("SELECT * FROM accounts WHERE id = $1", [parentId])).rows[0];
  }
  if (!parent) {
    parent = (
      await client.query(
        `SELECT * FROM accounts WHERE code IN ('112','1120','1101') AND type = 'asset' ORDER BY LENGTH(code) ASC LIMIT 1`
      )
    ).rows[0];
  }
  if (!parent) return 0;

  const code = `${parent.code}${String(bankAccount.id).padStart(3, "0")}`;
  const existing = (await client.query("SELECT id FROM accounts WHERE code = $1", [code])).rows[0];
  if (existing) return Number(existing.id);

  const created = await client.query(
    `INSERT INTO accounts
       (code, name, type, parent_id, balance, name_ar, name_en, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, currency)
     VALUES ($1,$2,'asset',$3,0,$4,$5,'ASSET','DEBIT',COALESCE($6,3)+1,true,true,true,true,$7)
     ON CONFLICT (code) DO NOTHING
     RETURNING id`,
    [
      code,
      bankAccount.name,
      parent.id,
      bankAccount.name,
      bankAccount.name_en || bankAccount.name,
      Number(parent.level) || 2,
      bankAccount.currency || "EGP",
    ]
  );
  if (created.rows[0]) return Number(created.rows[0].id);
  const again = (await client.query("SELECT id FROM accounts WHERE code = $1", [code])).rows[0];
  return again ? Number(again.id) : 0;
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

router.get("/api/banks/accounts", authenticateToken, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ba.*,
             b.name_ar AS bank_master_name,
             ta.name AS treasury_name,
             ta.current_balance AS treasury_balance,
             ga.code AS gl_code,
             ga.name AS gl_name
        FROM bank_accounts ba
        LEFT JOIN banks b ON b.id = ba.bank_id
        LEFT JOIN treasury_accounts ta ON ta.id = ba.treasury_account_id
        LEFT JOIN accounts ga ON ga.id = ba.gl_account_id
       ORDER BY ba.is_active DESC, ba.name ASC`);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/banks/accounts", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "اسم الحساب البنكي مطلوب" });

    const opening = toNumber(body.opening_balance);
    const currency = body.currency || body.currency_code || "EGP";
    const branchId = body.branch_id ? Number(body.branch_id) : null;
    const settings = await getSettings(client);
    const config = await getAccountConfig(client);

    await client.query("BEGIN");

    const created = await client.query(
      `INSERT INTO bank_accounts
         (name, bank_name, account_number, iban, swift_code, currency, account_type, opening_balance, balance,
          available_balance, branch_id, is_active, bank_id, opening_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        name,
        body.bank_name || null,
        body.account_number || null,
        body.iban || null,
        body.swift_code || null,
        currency,
        body.account_type || "current",
        opening,
        branchId,
        body.is_active !== false,
        body.bank_id ? Number(body.bank_id) : null,
        body.opening_date || null,
        body.notes || null,
        (req as any).user?.id || null,
      ]
    );
    let account = created.rows[0];

    // 1) Treasury mirror account (bank type) so the account is visible in الخزينة.
    let treasuryId: number | null = body.treasury_account_id ? Number(body.treasury_account_id) : null;
    if (!treasuryId && body.create_treasury_account !== false) {
      const treasury = await client.query(
        `INSERT INTO treasury_accounts
           (name, type, currency, current_balance, opening_balance, branch_id, status, is_main, bank_name, account_number, iban, swift_code)
         VALUES ($1,'bank',$2,$3,$3,$4,'active',false,$5,$6,$7,$8)
         RETURNING id`,
        [name, currency, opening, branchId, body.bank_name || null, body.account_number || null, body.iban || null, body.swift_code || null]
      );
      treasuryId = Number(treasury.rows[0].id);

      if (opening > 0) {
        await client.query(
          `INSERT INTO treasury_transactions
             (account_id, amount, transaction_type, reference_type, notes, created_by, status, voucher_type,
              balance_before, balance_after, branch_id, date)
           VALUES ($1,$2,'adjustment','opening','رصيد افتتاحي لحساب بنكي',$3,'approved','receipt',0,$2,$4,$5)`,
          [treasuryId, opening, (req as any).user?.id || null, branchId, body.opening_date || todayISO()]
        );
      }
    }

    // 2) GL sub-account per bank account.
    let glId: number | null = body.gl_account_id ? Number(body.gl_account_id) : null;
    if (!glId && body.create_gl_account !== false) {
      glId = await ensureBankGlAccount(client, account, config);
    }

    account = (
      await client.query(
        `UPDATE bank_accounts SET treasury_account_id = $1, gl_account_id = $2, balance = $3, available_balance = $3
          WHERE id = $4 RETURNING *`,
        [treasuryId, glId || null, opening, account.id]
      )
    ).rows[0];

    // 3) Opening balance journal (Dr Bank / Cr Retained earnings).
    if (opening > 0 && settings.auto_post_to_accounting !== "false" && glId && Number(config.retained_earnings) > 0) {
      const date = body.opening_date || todayISO();
      await postJournalEntry(client, {
        date,
        description: `رصيد افتتاحي لحساب بنكي: ${name}`,
        reference: `BNK-OPEN-${account.id}`,
        source_type: "bank_opening",
        source_id: Number(account.id),
        branch_id: branchId,
        user_id: (req as any).user?.id || null,
        lines: [
          { account_id: Number(glId), debit: opening, notes: `رصيد افتتاحي - ${name}` },
          { account_id: Number(config.retained_earnings), credit: opening, notes: `رصيد افتتاحي - ${name}` },
        ],
      });
    }

    await client.query("COMMIT");
    res.status(201).json(account);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put("/api/banks/accounts/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const account = (await client.query("SELECT * FROM bank_accounts WHERE id = $1", [req.params.id])).rows[0];
    if (!account) return res.status(404).json({ error: "الحساب البنكي غير موجود" });

    const hasTransactions = Number(
      (await client.query("SELECT COUNT(*)::int AS c FROM bank_transactions WHERE account_id = $1", [account.id]))
        .rows[0].c
    ) > 0;

    if (hasTransactions) {
      if (body.gl_account_id && Number(body.gl_account_id) !== Number(account.gl_account_id)) {
        return res.status(400).json({ error: "لا يمكن تغيير حساب GL بعد وجود حركات على الحساب البنكي" });
      }
      if (body.treasury_account_id && Number(body.treasury_account_id) !== Number(account.treasury_account_id)) {
        return res.status(400).json({ error: "لا يمكن تغيير خزينة الحساب بعد وجود حركات" });
      }
    }

    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE bank_accounts
          SET name=$1, bank_name=$2, account_number=$3, iban=$4, swift_code=$5, currency=$6, account_type=$7,
              branch_id=$8, is_active=$9, bank_id=$10, notes=$11, gl_account_id=$12, treasury_account_id=$13
        WHERE id=$14
        RETURNING *`,
      [
        String(body.name || account.name).trim(),
        body.bank_name ?? account.bank_name,
        body.account_number ?? account.account_number,
        body.iban ?? account.iban,
        body.swift_code ?? account.swift_code,
        body.currency || account.currency || "EGP",
        body.account_type || account.account_type || "current",
        body.branch_id ? Number(body.branch_id) : account.branch_id,
        body.is_active !== undefined ? !!body.is_active : account.is_active,
        body.bank_id ? Number(body.bank_id) : account.bank_id,
        body.notes ?? account.notes,
        body.gl_account_id ? Number(body.gl_account_id) : account.gl_account_id,
        body.treasury_account_id ? Number(body.treasury_account_id) : account.treasury_account_id,
        account.id,
      ]
    );

    // keep the linked treasury account name in sync
    if (account.treasury_account_id) {
      await client.query(`UPDATE treasury_accounts SET name = $1 WHERE id = $2`, [
        updated.rows[0].name,
        account.treasury_account_id,
      ]);
    }

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------------------------ */
/* Transactions engine                                                 */
/* ------------------------------------------------------------------ */

async function createBankMovement(client: any, opts: {
  accountId: number;
  amount: number;
  direction: "in" | "out";
  operation: string;
  date: string;
  description?: string | null;
  reference?: string | null;
  counterparty?: string | null;
  cashTreasuryId?: number | null;
  counterpartGlId?: number | null;
  branchId?: number | null;
  userId?: number | null;
  affectCash?: boolean;
  sourceType?: string;
}) {
  const amount = Math.abs(toNumber(opts.amount));
  if (!opts.accountId || amount <= 0) throw new Error("الحساب والمبلغ مطلوبان");

  const account = (
    await client.query("SELECT * FROM bank_accounts WHERE id = $1 FOR UPDATE", [opts.accountId])
  ).rows[0];
  if (!account) throw new Error("الحساب البنكي غير موجود");
  if (account.is_active === false) throw new Error("الحساب البنكي موقوف");

  const settings = await getSettings(client);
  const allowNegative = settings.allow_negative_balance === "true";
  const signed = opts.direction === "in" ? amount : -amount;
  const newBalance = toNumber(account.balance) + signed;
  if (newBalance < 0 && !allowNegative) {
    throw new Error("رصيد الحساب البنكي غير كافٍ لتنفيذ الحركة");
  }

  const config = await getAccountConfig(client);
  const bankGlId = Number(account.gl_account_id || config.bank) || 0;
  if (!bankGlId) throw new Error("لم يتم ربط الحساب البنكي بحساب في الحسابات العامة");

  const defaultCounterpart =
    opts.operation === "adjustment"
      ? 0
      : opts.operation === "fee"
        ? Number(config.other_expense)
        : opts.operation === "interest"
          ? Number(config.other_income)
          : opts.operation === "cheque_in"
            ? Number(config.accounts_receivable)
            : opts.operation === "cheque_out"
              ? Number(config.accounts_payable)
              : Number(config.cash);

  const counterpartGlId = Number(opts.counterpartGlId || defaultCounterpart) || 0;
  if (!counterpartGlId) throw new Error("حدد الحساب المقابل في الحسابات العامة لتنفيذ الحركة");
  if (counterpartGlId === bankGlId) throw new Error("حساب الطرف المقابل لا يمكن أن يكون نفس حساب البنك");

  const label =
    opts.operation === "deposit"
      ? "إيداع بنكي"
      : opts.operation === "withdraw"
        ? "سحب بنكي"
        : opts.operation === "fee"
          ? "مصروفات/عمولات بنكية"
          : opts.operation === "interest"
            ? "فوائد/إيرادات بنكية"
            : opts.operation === "cheque_in"
              ? "تحصيل شيك وارد"
              : opts.operation === "cheque_out"
                ? "صرف شيك صادر"
                : "حركة بنكية";

  const description = opts.description || label;
  const reference = opts.reference || `BNK-${Date.now()}`;

  const lines =
    opts.direction === "in"
      ? [
          { account_id: bankGlId, debit: amount, credit: 0, notes: `${label} - ${account.name}` },
          { account_id: counterpartGlId, debit: 0, credit: amount, notes: description },
        ]
      : [
          { account_id: counterpartGlId, debit: amount, credit: 0, notes: description },
          { account_id: bankGlId, debit: 0, credit: amount, notes: `${label} - ${account.name}` },
        ];

  let journalId: number | null = null;
  if (settings.auto_post_to_accounting !== "false") {
    journalId = await postJournalEntry(client, {
      date: opts.date,
      description: `${label}: ${description}`,
      reference,
      source_type: opts.sourceType || "bank_transaction",
      branch_id: opts.branchId ?? account.branch_id ?? null,
      user_id: opts.userId ?? null,
      lines,
    });
  }

  const tx = await client.query(
    `INSERT INTO bank_transactions
       (account_id, transaction_date, description, reference, amount, type, status, source, created_by, branch_id,
        category, counterparty, balance_after, currency, journal_entry_id)
     VALUES ($1,$2,$3,$4,$5,$6,'unmatched','system',$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      account.id,
      opts.date,
      description,
      reference,
      amount,
      opts.direction === "in" ? "credit" : "debit",
      opts.userId ?? null,
      opts.branchId ?? account.branch_id ?? null,
      opts.operation,
      opts.counterparty || null,
      newBalance,
      account.currency || "EGP",
      journalId,
    ]
  );
  const txId = Number(tx.rows[0].id);

  if (journalId) {
    await client.query("UPDATE journal_entries SET source_id = $1 WHERE id = $2", [txId, journalId]);
  }

  let treasuryTxId: number | null = null;

  // The bank-side treasury mirror.
  if (account.treasury_account_id) {
    treasuryTxId = await insertTreasuryMovement(client, {
      account_id: Number(account.treasury_account_id),
      amount: signed,
      transaction_type: opts.direction === "in" ? "cash_in" : "cash_out",
      reference_type: "bank_transaction",
      reference_id: txId,
      notes: `${label}: ${description}`,
      date: opts.date,
      user_id: opts.userId,
      branch_id: opts.branchId ?? account.branch_id ?? null,
      counterparty: opts.counterparty,
      allow_negative: allowNegative,
    });
  }

  // Cash side for deposits / withdrawals.
  if (opts.affectCash) {
    const cashId = opts.cashTreasuryId || (await getDefaultCashTreasuryId(client, opts.branchId ?? account.branch_id));
    if (!cashId) throw new Error("لا توجد خزينة نقدية لتنفيذ الحركة");
    const cashTxId = await insertTreasuryMovement(client, {
      account_id: Number(cashId),
      amount: -signed,
      transaction_type: opts.direction === "in" ? "cash_out" : "cash_in",
      reference_type: "bank_transaction",
      reference_id: txId,
      notes: `${label} - ${account.name}: ${description}`,
      date: opts.date,
      user_id: opts.userId,
      branch_id: opts.branchId ?? account.branch_id ?? null,
      counterparty: opts.counterparty,
      allow_negative: allowNegative,
    });
    if (cashTxId) await client.query("UPDATE bank_transactions SET treasury_transaction_id = $1 WHERE id = $2", [cashTxId, txId]);
  } else if (treasuryTxId) {
    await client.query("UPDATE bank_transactions SET treasury_transaction_id = $1 WHERE id = $2", [treasuryTxId, txId]);
  }

  await client.query(
    `UPDATE bank_accounts
        SET balance = balance + $1,
            available_balance = CASE WHEN available_balance IS NULL THEN balance + $1 ELSE $1 + COALESCE(available_balance, 0) END
      WHERE id = $2`,
    [signed, account.id]
  );

  return {
    transaction: { ...tx.rows[0], journal_entry_id: journalId, treasury_transaction_id: treasuryTxId, balance_after: newBalance },
    journal_entry_id: journalId,
    new_balance: newBalance,
  };
}

router.get("/api/banks/transactions", authenticateToken, async (req, res) => {
  try {
    const { account_id, from_date, to_date, category, type, search } = req.query;
    let sql = `
      SELECT bt.*, ba.name AS account_name, ba.account_number, ba.currency AS account_currency,
             u.username AS created_by_name, je.reference AS journal_reference, je.id AS journal_entry_id
        FROM bank_transactions bt
        LEFT JOIN bank_accounts ba ON ba.id = bt.account_id
        LEFT JOIN users u ON u.id = bt.created_by
        LEFT JOIN journal_entries je ON je.id = bt.journal_entry_id
       WHERE 1=1`;
    const params: any[] = [];
    if (account_id) {
      params.push(account_id);
      sql += ` AND bt.account_id = $${params.length}`;
    }
    if (from_date) {
      params.push(from_date);
      sql += ` AND bt.transaction_date >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      sql += ` AND bt.transaction_date <= $${params.length}`;
    }
    if (category && category !== "all") {
      params.push(category);
      sql += ` AND bt.category = $${params.length}`;
    }
    if (type && type !== "all") {
      params.push(type);
      sql += ` AND bt.type = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (COALESCE(bt.description,'') ILIKE $${params.length} OR COALESCE(bt.reference,'') ILIKE $${params.length} OR COALESCE(bt.counterparty,'') ILIKE $${params.length})`;
    }
    sql += ` ORDER BY bt.transaction_date DESC, bt.id DESC LIMIT 500`;
    const rows = (await pool.query(sql, params)).rows;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/banks/transactions", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const operation = String(body.operation || "").trim() || (String(body.type).toLowerCase() === "debit" ? "withdraw" : "deposit");
    const allowed = ["deposit", "withdraw", "fee", "interest", "adjustment"];
    if (!allowed.includes(operation)) return res.status(400).json({ error: "نوع الحركة غير مدعوم" });

    await client.query("BEGIN");
    const result = await createBankMovement(client, {
      accountId: Number(body.account_id),
      amount: Number(body.amount),
      direction:
        operation === "withdraw" || operation === "fee"
          ? "out"
          : operation === "deposit" || operation === "interest"
            ? "in"
            : String(body.type).toLowerCase() === "debit"
              ? "out"
              : "in",
      operation,
      date: body.transaction_date || todayISO(),
      description: body.description || null,
      reference: body.reference || null,
      counterparty: body.counterparty || null,
      cashTreasuryId: body.cash_account_id ? Number(body.cash_account_id) : null,
      counterpartGlId: body.counterpart_account_id ? Number(body.counterpart_account_id) : null,
      branchId: body.branch_id ? Number(body.branch_id) : null,
      userId: (req as any).user?.id || null,
      affectCash: operation === "deposit" || operation === "withdraw",
    });
    await client.query("COMMIT");
    res.status(201).json(result);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/api/banks/transfers", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const fromId = Number(body.from_account_id);
    const toId = Number(body.to_account_id);
    const amount = Math.abs(toNumber(body.amount));
    if (!fromId || !toId || fromId === toId || amount <= 0) {
      return res.status(400).json({ error: "حدد حسابين مختلفين ومبلغًا صحيحًا" });
    }
    const date = body.transaction_date || todayISO();
    const settings = await getSettings(client);
    const allowNegative = settings.allow_negative_balance === "true";
    const config = await getAccountConfig(client);

    await client.query("BEGIN");
    const from = (await client.query("SELECT * FROM bank_accounts WHERE id = $1 FOR UPDATE", [fromId])).rows[0];
    const to = (await client.query("SELECT * FROM bank_accounts WHERE id = $1 FOR UPDATE", [toId])).rows[0];
    if (!from || !to) throw new Error("أحد الحسابات البنكية غير موجود");
    if (toNumber(from.balance) < amount && !allowNegative) throw new Error("الرصيد غير كافٍ للتحويل");

    const fromGl = Number(from.gl_account_id || config.bank);
    const toGl = Number(to.gl_account_id || config.bank);
    const reference = body.reference || `TRF-BNK-${Date.now()}`;
    const description = body.description || `تحويل من ${from.name} إلى ${to.name}`;

    let journalId: number | null = null;
    if (settings.auto_post_to_accounting !== "false") {
      journalId = await postJournalEntry(client, {
        date,
        description,
        reference,
        source_type: "bank_transfer",
        branch_id: body.branch_id ? Number(body.branch_id) : from.branch_id || null,
        user_id: (req as any).user?.id || null,
        lines: [
          { account_id: toGl, debit: amount, credit: 0, notes: `تحويل وارد - ${to.name}` },
          { account_id: fromGl, debit: 0, credit: amount, notes: `تحويل صادر - ${from.name}` },
        ],
      });
    }

    const outTx = await client.query(
      `INSERT INTO bank_transactions
         (account_id, transaction_date, description, reference, amount, type, status, source, created_by, branch_id,
          category, counterparty, balance_after, currency, journal_entry_id)
       VALUES ($1,$2,$3,$4,$5,'debit','matched','system',$6,$7,'transfer',$8,$9,$10,$11)
       RETURNING id`,
      [
        fromId,
        date,
        description,
        reference,
        amount,
        (req as any).user?.id || null,
        body.branch_id ? Number(body.branch_id) : from.branch_id || null,
        to.name,
        toNumber(from.balance) - amount,
        from.currency || "EGP",
        journalId,
      ]
    );
    const inTx = await client.query(
      `INSERT INTO bank_transactions
         (account_id, transaction_date, description, reference, amount, type, status, source, created_by, branch_id,
          category, counterparty, balance_after, currency, journal_entry_id)
       VALUES ($1,$2,$3,$4,$5,'credit','matched','system',$6,$7,'transfer',$8,$9,$10,$11)
       RETURNING id`,
      [
        toId,
        date,
        description,
        reference,
        amount,
        (req as any).user?.id || null,
        body.branch_id ? Number(body.branch_id) : to.branch_id || null,
        from.name,
        toNumber(to.balance) + amount,
        to.currency || "EGP",
        journalId,
      ]
    );

    await client.query(`UPDATE bank_accounts SET balance = balance - $1, available_balance = COALESCE(available_balance,balance) - $1 WHERE id = $2`, [amount, fromId]);
    await client.query(`UPDATE bank_accounts SET balance = balance + $1, available_balance = COALESCE(available_balance,balance) + $1 WHERE id = $2`, [amount, toId]);

    if (from.treasury_account_id) {
      await insertTreasuryMovement(client, {
        account_id: Number(from.treasury_account_id),
        amount: -amount,
        transaction_type: "transfer",
        reference_type: "bank_transfer",
        reference_id: Number(outTx.rows[0].id),
        notes: description,
        date,
        user_id: (req as any).user?.id || null,
        branch_id: from.branch_id,
        counterparty: to.name,
        allow_negative: allowNegative,
      });
    }
    if (to.treasury_account_id) {
      await insertTreasuryMovement(client, {
        account_id: Number(to.treasury_account_id),
        amount: amount,
        transaction_type: "transfer",
        reference_type: "bank_transfer",
        reference_id: Number(inTx.rows[0].id),
        notes: description,
        date,
        user_id: (req as any).user?.id || null,
        branch_id: to.branch_id,
        counterparty: from.name,
        allow_negative: allowNegative,
      });
    }

    const transferNo = `BT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    await client.query(
      `INSERT INTO bank_transfers
         (transfer_number, from_account_id, to_account_id, transfer_date, amount, currency, status, from_transaction_id, to_transaction_id, reference, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9,$10,$11)`,
      [transferNo, fromId, toId, date, amount, from.currency || "EGP", outTx.rows[0].id, inTx.rows[0].id, reference, description, (req as any).user?.id || null]
    );

    await client.query("COMMIT");
    res.json({ success: true, transfer_number: transferNo, journal_entry_id: journalId, from_transaction: outTx.rows[0], to_transaction: inTx.rows[0] });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------------------------ */
/* Lookups + dashboard                                                 */
/* ------------------------------------------------------------------ */

router.get("/api/banks/lookups", authenticateToken, async (_req, res) => {
  try {
    const [treasury, gl, banks, config, settings] = await Promise.all([
      pool.query(`SELECT id,name,type,current_balance,branch_id FROM treasury_accounts ORDER BY type, is_main DESC NULLS LAST, name`),
      pool.query(`SELECT id,code,name,name_ar,type,account_type,account_nature FROM accounts WHERE COALESCE(allow_posting,true)=true AND COALESCE(status,true)=true ORDER BY code`),
      pool.query(`SELECT id,code,name_ar,name_en FROM banks WHERE is_active IS NOT false ORDER BY name_ar`),
      getAccountConfig().catch(() => ({}) as any),
      getSettings().catch(() => ({}) as any),
    ]);
    res.json({
      treasury_accounts: treasury.rows,
      gl_accounts: gl.rows,
      banks: banks.rows,
      defaults: {
        bank_gl_account_id: Number(config.bank) || null,
        cash_gl_account_id: Number(config.cash) || null,
        other_expense_account_id: Number(config.other_expense) || null,
        other_income_account_id: Number(config.other_income) || null,
        receivables_account_id: Number(config.accounts_receivable) || null,
        payables_account_id: Number(config.accounts_payable) || null,
      },
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/banks/dashboard", authenticateToken, async (_req, res) => {
  try {
    const [accountsAgg, monthFlow, feesAgg, unreconciled, latest, monthly, perBank, glAgg, treasuryAgg, chequesAgg] =
      await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count,
                           COUNT(*) FILTER (WHERE is_active IS NOT false)::int AS active_count,
                           COALESCE(SUM(balance),0) AS total_balance,
                           COALESCE(SUM(COALESCE(available_balance,balance)),0) AS total_available
                      FROM bank_accounts`),
        pool.query(`SELECT
                      COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0) AS inflows,
                      COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END),0) AS outflows
                    FROM bank_transactions
                    WHERE date_trunc('month', transaction_date) = date_trunc('month', CURRENT_DATE)`),
        pool.query(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count
                      FROM bank_transactions
                     WHERE category IN ('fee','interest')
                       AND date_trunc('month', transaction_date) = date_trunc('month', CURRENT_DATE)`),
        pool.query(`SELECT COUNT(*)::int AS count FROM bank_transactions WHERE status <> 'matched'`),
        pool.query(`SELECT bt.id, bt.transaction_date, bt.description, bt.amount, bt.type, bt.category, bt.status,
                           ba.name AS account_name
                      FROM bank_transactions bt LEFT JOIN bank_accounts ba ON ba.id = bt.account_id
                     ORDER BY bt.transaction_date DESC, bt.id DESC LIMIT 8`),
        pool.query(`SELECT TO_CHAR(date_trunc('month', transaction_date), 'YYYY-MM') AS month,
                           COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0) AS inflows,
                           COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END),0) AS outflows
                      FROM bank_transactions
                     WHERE transaction_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
                     GROUP BY 1 ORDER BY 1`),
        pool.query(`SELECT COALESCE(NULLIF(bank_name,''),'بدون بنك') AS bank_name,
                           COUNT(*)::int AS accounts,
                           COALESCE(SUM(balance),0) AS balance
                      FROM bank_accounts GROUP BY 1 ORDER BY balance DESC`),
        pool.query(`SELECT COALESCE(SUM(a.balance),0) AS gl_balance
                      FROM accounts a
                     WHERE a.id IN (SELECT DISTINCT gl_account_id FROM bank_accounts WHERE gl_account_id IS NOT NULL)`),
        pool.query(`SELECT COALESCE(SUM(current_balance),0) AS treasury_balance
                      FROM treasury_accounts WHERE type = 'bank'`),
        pool.query(`SELECT COALESCE(SUM(CASE WHEN check_type='incoming' AND status IN ('pending','registered') THEN amount ELSE 0 END),0) AS incoming_pending,
                           COALESCE(SUM(CASE WHEN check_type='outgoing' AND status IN ('pending','registered') THEN amount ELSE 0 END),0) AS outgoing_pending
                      FROM bank_checks`),
      ]);

    const totalBalance = toNumber(accountsAgg.rows[0]?.total_balance);
    const glBalance = toNumber(glAgg.rows[0]?.gl_balance);
    const treasuryBalance = toNumber(treasuryAgg.rows[0]?.treasury_balance);

    res.json({
      accounts: accountsAgg.rows[0],
      month: monthFlow.rows[0],
      fees: feesAgg.rows[0],
      unreconciled: unreconciled.rows[0],
      latest: latest.rows,
      monthly: monthly.rows,
      per_bank: perBank.rows,
      cheques: chequesAgg.rows[0],
      integration: {
        bank_total: totalBalance,
        gl_total: glBalance,
        treasury_total: treasuryBalance,
        gl_variance: Number((totalBalance - glBalance).toFixed(2)),
        treasury_variance: Number((totalBalance - treasuryBalance).toFixed(2)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Cheques                                                             */
/* ------------------------------------------------------------------ */

router.get("/api/banks/cheques", authenticateToken, async (req, res) => {
  try {
    const { account_id, status, type } = req.query;
    let sql = `SELECT c.*, ba.name AS account_name FROM bank_checks c LEFT JOIN bank_accounts ba ON ba.id=c.account_id WHERE 1=1`;
    const params: any[] = [];
    if (account_id) {
      params.push(account_id);
      sql += ` AND c.account_id = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(status);
      sql += ` AND c.status = $${params.length}`;
    }
    if (type && type !== "all") {
      params.push(type);
      sql += ` AND c.check_type = $${params.length}`;
    }
    sql += ` ORDER BY c.due_date NULLS LAST, c.id DESC`;
    res.json((await pool.query(sql, params)).rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/banks/cheques", authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.account_id || !body.check_number || !toNumber(body.amount)) {
      return res.status(400).json({ error: "الحساب ورقم الشيك والمبلغ مطلوبة" });
    }
    const row = await pool.query(
      `INSERT INTO bank_checks
         (account_id, check_number, check_type, beneficiary, amount, issue_date, due_date, status, reference, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'registered',$8,$9,$10) RETURNING *`,
      [
        Number(body.account_id),
        String(body.check_number),
        body.check_type === "outgoing" ? "outgoing" : "incoming",
        body.beneficiary || null,
        Math.abs(toNumber(body.amount)),
        body.issue_date || todayISO(),
        body.due_date || null,
        body.reference || null,
        body.notes || null,
        (req as any).user?.id || null,
      ]
    );
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/banks/cheques/:id/settle", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const cheque = (await client.query("SELECT * FROM bank_checks WHERE id = $1", [req.params.id])).rows[0];
    if (!cheque) return res.status(404).json({ error: "الشيك غير موجود" });
    if (!["registered", "pending"].includes(cheque.status)) {
      return res.status(400).json({ error: "لا يمكن تحصيل شيك في هذه الحالة" });
    }
    const incoming = cheque.check_type === "incoming";
    await client.query("BEGIN");
    const result = await createBankMovement(client, {
      accountId: Number(cheque.account_id),
      amount: Number(cheque.amount),
      direction: incoming ? "in" : "out",
      operation: incoming ? "cheque_in" : "cheque_out",
      date: req.body?.date || todayISO(),
      description: `${incoming ? "تحصيل شيك وارد" : "صرف شيك صادر"} رقم ${cheque.check_number} - ${cheque.beneficiary || ""}`,
      reference: cheque.reference || `CHQ-${cheque.check_number}`,
      counterparty: cheque.beneficiary || null,
      userId: (req as any).user?.id || null,
      affectCash: false,
      sourceType: "bank_cheque",
    });
    await client.query(`UPDATE bank_checks SET status = $1 WHERE id = $2`, [
      incoming ? "collected" : "paid",
      cheque.id,
    ]);
    await client.query("COMMIT");
    res.json({ success: true, ...result });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/api/banks/cheques/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const row = await pool.query(
      `UPDATE bank_checks SET status = 'cancelled' WHERE id = $1 AND status IN ('registered','pending') RETURNING *`,
      [req.params.id]
    );
    if (!row.rows[0]) return res.status(400).json({ error: "لا يمكن إلغاء هذا الشيك" });
    res.json(row.rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Statements & reconciliation                                         */
/* ------------------------------------------------------------------ */

router.get("/api/banks/statements", authenticateToken, async (req, res) => {
  try {
    const { account_id } = req.query;
    const params: any[] = [];
    let sql = `SELECT bs.*, ba.name AS account_name, ba.account_number,
                      (SELECT COUNT(*)::int FROM bank_statement_lines l WHERE l.statement_id = bs.id) AS lines_count,
                      (SELECT COUNT(*)::int FROM bank_statement_lines l WHERE l.statement_id = bs.id AND l.reconciliation_status = 'matched') AS matched_count
                 FROM bank_statements bs
                 JOIN bank_accounts ba ON ba.id = bs.account_id
                WHERE 1=1`;
    if (account_id) {
      params.push(account_id);
      sql += ` AND bs.account_id = $${params.length}`;
    }
    sql += ` ORDER BY bs.period_to DESC NULLS LAST, bs.id DESC`;
    res.json((await pool.query(sql, params)).rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/banks/statements", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const accountId = Number(body.account_id);
    const periodFrom = body.period_from || body.from_date;
    const periodTo = body.period_to || body.to_date;
    if (!accountId || !periodFrom || !periodTo) {
      return res.status(400).json({ error: "الحساب وفترة الكشف مطلوبان" });
    }
    const lines: any[] = Array.isArray(body.lines) ? body.lines : [];
    const opening = toNumber(body.opening_balance);
    const closing = toNumber(body.closing_balance);
    const credits = lines
      .filter((l) => {
        const direction = String(l.direction || "").toLowerCase();
        return direction ? direction === "credit" : toNumber(l.amount) > 0;
      })
      .reduce((sum, l) => sum + Math.abs(toNumber(l.amount)), 0);
    const debits = lines
      .filter((l) => {
        const direction = String(l.direction || "").toLowerCase();
        return direction ? direction === "debit" : toNumber(l.amount) < 0;
      })
      .reduce((sum, l) => sum + Math.abs(toNumber(l.amount)), 0);

    await client.query("BEGIN");
    const statementNo = body.statement_number || `BS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const statement = await client.query(
      `INSERT INTO bank_statements
         (account_id, statement_number, period_from, period_to, opening_balance, closing_balance,
          total_credits, total_debits, statement_date, source, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'imported',$11,$12)
       RETURNING *`,
      [
        accountId,
        statementNo,
        periodFrom,
        periodTo,
        opening,
        closing,
        credits,
        debits,
        body.statement_date || periodTo,
        body.source || "manual",
        body.notes || null,
        (req as any).user?.id || null,
      ]
    );
    const statementId = Number(statement.rows[0].id);

    let lineNo = 1;
    for (const line of lines) {
      const rawAmount = toNumber(line.amount);
      const direction = String(line.direction || "").toLowerCase() || (rawAmount < 0 ? "debit" : "credit");
      await client.query(
        `INSERT INTO bank_statement_lines
           (statement_id, line_date, value_date, description, reference, amount, direction, running_balance, external_reference, reconciliation_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unmatched')`,
        [
          statementId,
          line.transaction_date || line.date || line.line_date || periodTo,
          line.value_date || null,
          line.description || null,
          line.reference || null,
          Math.abs(rawAmount),
          direction,
          line.running_balance ?? null,
          line.external_reference || line.external_id || null,
        ]
      );
      lineNo++;
    }

    await client.query("COMMIT");
    res.status(201).json({ ...statement.rows[0], lines_count: lineNo - 1 });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get("/api/banks/statements/:id", authenticateToken, async (req, res) => {
  try {
    const statement = (await pool.query("SELECT * FROM bank_statements WHERE id = $1", [req.params.id])).rows[0];
    if (!statement) return res.status(404).json({ error: "الكشف غير موجود" });
    const lines = (
      await pool.query(
        `SELECT l.*, bt.reference AS matched_reference, bt.description AS matched_description
           FROM bank_statement_lines l
           LEFT JOIN bank_transactions bt ON bt.id = l.matched_transaction_id
          WHERE l.statement_id = $1
          ORDER BY l.line_date, l.id`,
        [req.params.id]
      )
    ).rows;
    const account = (await pool.query("SELECT * FROM bank_accounts WHERE id = $1", [statement.account_id])).rows[0];
    const movements = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0) AS net
         FROM bank_transactions WHERE account_id = $1 AND transaction_date <= $2`,
      [statement.account_id, statement.period_to]
    );
    const bookBalance = toNumber(account?.opening_balance) + toNumber(movements.rows[0]?.net);
    const matched = lines.filter((l: any) => l.reconciliation_status === "matched").length;
    res.json({
      statement,
      account,
      lines,
      summary: {
        lines: lines.length,
        matched,
        unmatched: lines.length - matched,
        book_balance: Number(bookBalance.toFixed(2)),
        statement_closing: toNumber(statement.closing_balance),
        difference: Number((toNumber(statement.closing_balance) - bookBalance).toFixed(2)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/banks/statements/:id/auto-match", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const statement = (await client.query("SELECT * FROM bank_statements WHERE id = $1", [req.params.id])).rows[0];
    if (!statement) return res.status(404).json({ error: "الكشف غير موجود" });
    const settings = await getSettings(client);
    const tolerance = Math.max(0.01, toNumber(settings.reconciliation_tolerance, 0.01));

    await client.query("BEGIN");
    const lines = (
      await client.query(
        `SELECT * FROM bank_statement_lines WHERE statement_id = $1 AND COALESCE(reconciliation_status,'unmatched') <> 'matched'`,
        [statement.id]
      )
    ).rows;

    let matched = 0;
    for (const line of lines) {
      const candidate = await client.query(
        `SELECT * FROM bank_transactions
          WHERE account_id = $1
            AND status <> 'matched'
            AND type = $2
            AND ABS(amount - $3) <= $4
            AND ABS(transaction_date - $5::date) <= 7
          ORDER BY ABS(transaction_date - $5::date), id
          LIMIT 1`,
        [statement.account_id, line.direction, toNumber(line.amount), tolerance, line.line_date]
      );
      const tx = candidate.rows[0];
      if (!tx) continue;
      await client.query(
        `UPDATE bank_statement_lines SET reconciliation_status='matched', matched_transaction_id=$1 WHERE id=$2`,
        [tx.id, line.id]
      );
      await client.query(
        `UPDATE bank_transactions SET status='matched', matched_with=$1, matched_at=CURRENT_TIMESTAMP WHERE id=$2`,
        [line.id, tx.id]
      );
      matched++;
    }
    await client.query("COMMIT");
    res.json({ success: true, matched, total: lines.length });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/api/banks/statements/:id/close", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const statement = (await client.query("SELECT * FROM bank_statements WHERE id = $1", [req.params.id])).rows[0];
    if (!statement) return res.status(404).json({ error: "الكشف غير موجود" });
    await client.query("BEGIN");
    await client.query(`UPDATE bank_statements SET status='reconciled' WHERE id=$1`, [statement.id]);
    await client.query(
      `UPDATE bank_accounts SET last_reconciled_at = CURRENT_TIMESTAMP, last_statement_balance = $1 WHERE id = $2`,
      [statement.closing_balance, statement.account_id]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

router.get("/api/banks/reports/balances", authenticateToken, async (req, res) => {
  try {
    const asOf = req.query.as_of || todayISO();
    const rows = (
      await pool.query(
        `SELECT ba.id, ba.name, ba.bank_name, ba.account_number, ba.currency, ba.balance,
                COALESCE(ba.available_balance, ba.balance) AS available_balance,
                ba.opening_balance, ba.is_active, ba.gl_account_id, ba.treasury_account_id,
                ga.code AS gl_code, ga.name AS gl_name,
                COALESCE(ga.balance,0) AS gl_balance,
                COALESCE(ta.current_balance,0) AS treasury_balance,
                ta.name AS treasury_name,
                COALESCE((SELECT SUM(CASE WHEN bt.type='credit' THEN bt.amount ELSE -bt.amount END)
                            FROM bank_transactions bt
                           WHERE bt.account_id = ba.id AND bt.transaction_date <= $1),0) AS movements
           FROM bank_accounts ba
           LEFT JOIN accounts ga ON ga.id = ba.gl_account_id
           LEFT JOIN treasury_accounts ta ON ta.id = ba.treasury_account_id
          ORDER BY ba.is_active DESC, ba.name`,
        [asOf]
      )
    ).rows.map((row: any) => ({
      ...row,
      gl_variance: Number((toNumber(row.balance) - toNumber(row.gl_balance)).toFixed(2)),
      treasury_variance: Number((toNumber(row.balance) - toNumber(row.treasury_balance)).toFixed(2)),
    }));
    res.json({
      as_of: asOf,
      rows,
      totals: {
        balance: rows.reduce((s: number, r: any) => s + toNumber(r.balance), 0),
        gl_balance: rows.reduce((s: number, r: any) => s + toNumber(r.gl_balance), 0),
        treasury_balance: rows.reduce((s: number, r: any) => s + toNumber(r.treasury_balance), 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/banks/reports/statement", authenticateToken, async (req, res) => {
  try {
    const accountId = Number(req.query.account_id);
    const from = req.query.from_date || `${new Date().getFullYear()}-01-01`;
    const to = req.query.to_date || todayISO();
    if (!accountId) return res.status(400).json({ error: "حدد الحساب البنكي" });
    const account = (await pool.query("SELECT * FROM bank_accounts WHERE id = $1", [accountId])).rows[0];
    if (!account) return res.status(404).json({ error: "الحساب غير موجود" });

    const before = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0) AS net
         FROM bank_transactions WHERE account_id = $1 AND transaction_date < $2`,
      [accountId, from]
    );
    const opening = toNumber(account.opening_balance) + toNumber(before.rows[0]?.net);

    const rows = (
      await pool.query(
        `SELECT * FROM bank_transactions
          WHERE account_id = $1 AND transaction_date >= $2 AND transaction_date <= $3
          ORDER BY transaction_date, id`,
        [accountId, from, to]
      )
    ).rows;

    let running = opening;
    const lines = rows.map((row: any) => {
      running += row.type === "credit" ? toNumber(row.amount) : -toNumber(row.amount);
      return { ...row, running_balance: Number(running.toFixed(2)) };
    });
    res.json({
      account,
      from_date: from,
      to_date: to,
      opening_balance: Number(opening.toFixed(2)),
      closing_balance: Number(running.toFixed(2)),
      total_in: rows.filter((r: any) => r.type === "credit").reduce((s: number, r: any) => s + toNumber(r.amount), 0),
      total_out: rows.filter((r: any) => r.type === "debit").reduce((s: number, r: any) => s + toNumber(r.amount), 0),
      lines,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/banks/reports/cashflow", authenticateToken, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const monthly = (
      await pool.query(
        `SELECT EXTRACT(MONTH FROM transaction_date)::int AS month,
                COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0) AS inflows,
                COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END),0) AS outflows
           FROM bank_transactions
          WHERE EXTRACT(YEAR FROM transaction_date) = $1
          GROUP BY 1 ORDER BY 1`,
        [year]
      )
    ).rows;
    const byCategory = (
      await pool.query(
        `SELECT COALESCE(category,'other') AS category,
                COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0) AS inflows,
                COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END),0) AS outflows
           FROM bank_transactions
          WHERE EXTRACT(YEAR FROM transaction_date) = $1
          GROUP BY 1 ORDER BY 2 DESC, 3 DESC`,
        [year]
      )
    ).rows;
    const months = Array.from({ length: 12 }, (_, i) => {
      const row = monthly.find((m: any) => Number(m.month) === i + 1);
      return {
        month: i + 1,
        inflows: toNumber(row?.inflows),
        outflows: toNumber(row?.outflows),
        net: Number((toNumber(row?.inflows) - toNumber(row?.outflows)).toFixed(2)),
      };
    });
    res.json({
      year,
      months,
      by_category: byCategory,
      totals: {
        inflows: months.reduce((s, m) => s + m.inflows, 0),
        outflows: months.reduce((s, m) => s + m.outflows, 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/banks/reports/fees", authenticateToken, async (req, res) => {
  try {
    const from = req.query.from_date || `${new Date().getFullYear()}-01-01`;
    const to = req.query.to_date || todayISO();
    const rows = (
      await pool.query(
        `SELECT bt.*, ba.name AS account_name
           FROM bank_transactions bt LEFT JOIN bank_accounts ba ON ba.id = bt.account_id
          WHERE bt.category IN ('fee','interest') AND bt.transaction_date BETWEEN $1 AND $2
          ORDER BY bt.transaction_date DESC, bt.id DESC`,
        [from, to]
      )
    ).rows;
    res.json({
      from_date: from,
      to_date: to,
      rows,
      totals: {
        fees: rows.filter((r: any) => r.category === "fee").reduce((s: number, r: any) => s + toNumber(r.amount), 0),
        interest: rows.filter((r: any) => r.category === "interest").reduce((s: number, r: any) => s + toNumber(r.amount), 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/banks/reports/reconciliation", authenticateToken, async (req, res) => {
  try {
    const { account_id } = req.query;
    const params: any[] = [];
    let sql = `SELECT bs.*, ba.name AS account_name,
                      (SELECT COUNT(*)::int FROM bank_statement_lines l WHERE l.statement_id = bs.id) AS lines_count,
                      (SELECT COUNT(*)::int FROM bank_statement_lines l WHERE l.statement_id = bs.id AND l.reconciliation_status='matched') AS matched_count,
                      (SELECT COUNT(*)::int FROM bank_statement_lines l WHERE l.statement_id = bs.id AND COALESCE(l.reconciliation_status,'unmatched') <> 'matched') AS unmatched_count
                 FROM bank_statements bs JOIN bank_accounts ba ON ba.id = bs.account_id WHERE 1=1`;
    if (account_id && account_id !== "all") {
      params.push(account_id);
      sql += ` AND bs.account_id = $${params.length}`;
    }
    sql += ` ORDER BY bs.period_to DESC NULLS LAST, bs.id DESC`;
    const rows = (await pool.query(sql, params)).rows;
    res.json({
      rows,
      totals: {
        statements: rows.length,
        reconciled: rows.filter((r: any) => r.status === "reconciled").length,
        unmatched_lines: rows.reduce((s: number, r: any) => s + toNumber(r.unmatched_count), 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/banks/reports/cheques", authenticateToken, async (req, res) => {
  try {
    const rows = (
      await pool.query(
        `SELECT c.*, ba.name AS account_name FROM bank_checks c
           LEFT JOIN bank_accounts ba ON ba.id = c.account_id
          ORDER BY c.due_date NULLS LAST, c.id DESC`
      )
    ).rows;
    const summarize = (type: string) => {
      const scoped = rows.filter((r: any) => r.check_type === type);
      const byStatus = (status: string) =>
        scoped.filter((r: any) => r.status === status).reduce((s: number, r: any) => s + toNumber(r.amount), 0);
      return {
        type,
        count: scoped.length,
        total: scoped.reduce((s: number, r: any) => s + toNumber(r.amount), 0),
        registered: byStatus("registered"),
        collected: byStatus("collected"),
        paid: byStatus("paid"),
        cancelled: byStatus("cancelled"),
      };
    };
    res.json({ rows, incoming: summarize("incoming"), outgoing: summarize("outgoing") });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
