import { afterEach, describe, expect, it, vi } from "vitest";
import { CostController } from "../../modules/costs/controllers/cost.controller.js";
import { costRepository, OperatingCostRecord } from "../../modules/costs/repositories/cost.repository.js";
import { costService } from "../../modules/costs/services/cost.service.js";
import * as autoPostingService from "../../modules/accounts/services/auto-posting.service.js";
import { pool } from "../../server-db.js";
import { uniqueTag, withRollback } from "../helpers/testDb.js";

const validCost: OperatingCostRecord = {
  category: "other",
  amount: 125,
  date: "2026-07-15",
  cost_center_id: 1,
  cost_item_id: 2,
  payment_method: "آجل",
  link_ledger: false
};

function createClient(replay = false) {
  return {
    query: vi.fn(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();
      if (replay && normalizedSql.includes("insert into erp_idempotency_keys")) {
        return { rows: [], rowCount: 0 };
      }
      if (replay && normalizedSql.includes("select status, response_status")) {
        return {
          rows: [{
            status: "completed",
            response_status: 201,
            response_body: { cost: { ...validCost, id: 7001 }, journal_entry: null },
            request_hash: null,
            expires_at: new Date(Date.now() + 60_000)
          }],
          rowCount: 1
        };
      }
      if (normalizedSql.includes("select") && normalizedSql.includes("exists") && normalizedSql.includes("cost_centers")) {
        return { rows: [{ cost_center_exists: true, cost_item_exists: true }], rowCount: 1 };
      }
      if (normalizedSql.includes("from safes where id = $1")) {
        return { rows: [{ id: 9, name: "الخزينة" }], rowCount: 1 };
      }
      if (normalizedSql.includes("from safes where name = $1")) {
        return { rows: [{ id: 9, name: "الخزينة" }], rowCount: 1 };
      }
      if (normalizedSql.includes("from treasury_accounts where id = $1")) {
        return {
          rows: [{ id: 9, name: "الخزينة", type: "cash", currency: "EGP", status: "active", current_balance: 400 }],
          rowCount: 1
        };
      }
      if (normalizedSql.includes("max(substring(voucher_no")) {
        return { rows: [{ next: 1 }], rowCount: 1 };
      }
      if (normalizedSql.includes("select id from operating_costs")) {
        return { rows: [], rowCount: 0 };
      }
      if (normalizedSql.includes("insert into erp_idempotency_keys")) {
        return { rows: [{ id: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn()
  };
}

afterEach(() => vi.restoreAllMocks());

describe("حفظ التكلفة التشغيلية", () => {
  it("يرفض المدخلات غير الصالحة قبل الاتصال بقاعدة البيانات", async () => {
    const connect = vi.spyOn(pool, "connectPostgres");
    await expect(costService.createOperatingCost({ ...validCost, amount: 0 }, {}))
      .rejects.toThrow("مبلغ التكلفة");
    expect(connect).not.toHaveBeenCalled();
  });

  it("يفشل بوضوح عند تعذر PostgreSQL ولا يستخدم قاعدة offline البديلة", async () => {
    vi.spyOn(pool, "connectPostgres").mockRejectedValue(Object.assign(new Error("database unavailable"), { code: "ECONNREFUSED" }));
    await expect(costService.createOperatingCost(validCost, {}))
      .rejects.toThrow("database unavailable");
  });

  it("ينفذ ROLLBACK ولا يعيد نجاحًا إذا فشل INSERT", async () => {
    const client = createClient();
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "insertOperatingCost").mockRejectedValue(new Error("insert failed"));

    await expect(costService.createOperatingCost(validCost, {})).rejects.toThrow("insert failed");
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements).toContain("BEGIN");
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("يحفظ التكلفة النقدية كمسودة دون تسجيل صرف قبل الاعتماد", async () => {
    const client = createClient();
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "insertOperatingCost").mockResolvedValue({
      ...validCost,
      id: 4243,
      voucher_no: "VCH-202607-0002"
    });
    const insertSafeTransaction = vi.spyOn(costRepository, "insertSafeTransaction");
    vi.spyOn(costRepository, "logActivity").mockResolvedValue(undefined);

    const result = await costService.createOperatingCost({
      ...validCost,
      payment_method: "نقدي",
      safe: "الخزينة",
      treasury_account_id: 9
    }, {});
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(result.cost.id).toBe(4243);
    expect(result.journal_entry).toBeNull();
    expect(costRepository.insertOperatingCost).toHaveBeenCalledWith(
      expect.objectContaining({ safe: "الخزينة", safe_id: undefined, treasury_account_id: 9 }),
      client
    );
    expect(insertSafeTransaction).not.toHaveBeenCalled();
    expect(statements).toContain("COMMIT");
    expect(statements).not.toContain("ROLLBACK");
  });

  it("يرحّل القيد ويخصم الخزينة ضمن معاملة الاعتماد نفسها", async () => {
    const client = createClient();
    const cost = {
      ...validCost,
      id: 777,
      amount: 200,
      approval_status: "Pending",
      link_ledger: true,
      payment_method: "نقدي",
      safe: "خزينة اختبار",
      safe_id: 9,
      voucher_no: "VCH-TEST-0001"
    } as OperatingCostRecord;
    vi.spyOn(pool, "query").mockResolvedValue({ rows: [], rowCount: 0 } as any);
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "getOperatingCostById")
      .mockResolvedValueOnce(cost)
      .mockResolvedValueOnce({ ...cost, approval_status: "Approved", journal_entry_id: 901 });
    vi.spyOn(costRepository, "findSafeTransactionForCost").mockResolvedValue(null);
    const insertSafeTransaction = vi.spyOn(costRepository, "insertSafeTransaction").mockResolvedValue({ id: 61 });
    const postCostEntry = vi.spyOn(autoPostingService, "postCostEntry").mockResolvedValue({
      id: 901,
      reference: "CO-202607-00001"
    });
    client.query.mockImplementation(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();
      if (normalizedSql.includes("select id from operating_costs") && normalizedSql.includes("for update")) {
        return { rows: [{ id: cost.id }], rowCount: 1 };
      }
      if (normalizedSql.startsWith("update operating_costs set approval_status")) {
        return { rows: [{ ...cost, approval_status: "Approved" }], rowCount: 1 };
      }
      if (normalizedSql.includes("select id, name, balance from safes where id = $1")) {
        return { rows: [{ id: 9, balance: 400 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const result = await costService.transitionOperatingCost(cost.id!, "Approved", {});
    const statements = client.query.mock.calls.map(([sql]) => sql.toLowerCase());
    expect(result.approval_status).toBe("Approved");
    expect(postCostEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: cost.id, amount: 200, safe_id: 9 }),
      client
    );
    expect(client.query).toHaveBeenCalledWith(
      'SELECT id, name, balance FROM safes WHERE id = $1 FOR UPDATE',
      [9]
    );
    expect(insertSafeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ safe_id: 9, type: "out", amount: 200, reference_id: String(cost.id) }),
      client
    );
    expect(statements.some(sql => sql.includes("update safes set balance = balance -"))).toBe(true);
    expect(statements.indexOf("commit")).toBeGreaterThan(statements.findIndex(sql => sql.includes("update safes set balance = balance -")));
  });

  it("يلغي اعتماد التكلفة وقيودها الجزئية عند فشل الترحيل", async () => {
    const client = createClient();
    const cost = {
      ...validCost,
      id: 778,
      approval_status: "Pending",
      link_ledger: true,
      payment_method: "شبكة"
    } as OperatingCostRecord;
    vi.spyOn(pool, "query").mockResolvedValue({ rows: [], rowCount: 0 } as any);
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "getOperatingCostById").mockResolvedValue(cost);
    vi.spyOn(autoPostingService, "postCostEntry").mockRejectedValue(new Error("journal failed"));
    client.query.mockImplementation(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();
      if (normalizedSql.includes("select id from operating_costs") && normalizedSql.includes("for update")) {
        return { rows: [{ id: cost.id }], rowCount: 1 };
      }
      if (normalizedSql.startsWith("update operating_costs set approval_status")) {
        return { rows: [{ ...cost, approval_status: "Approved" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(costService.transitionOperatingCost(cost.id!, "Approved", {})).rejects.toThrow("journal failed");
    const statements = client.query.mock.calls.map(([sql]) => sql.toLowerCase());
    expect(statements).toContain("rollback");
    expect(statements).not.toContain("commit");
  });

  it("يتراجع عن اعتماد التكلفة إذا فشل إنشاء حركة الصرف", async () => {
    const client = createClient();
    const cost = {
      ...validCost,
      id: 779,
      approval_status: "Pending",
      link_ledger: false,
      payment_method: "نقدي",
      safe: "خزينة اختبار",
      safe_id: 9
    } as OperatingCostRecord;
    vi.spyOn(pool, "query").mockResolvedValue({ rows: [], rowCount: 0 } as any);
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "getOperatingCostById").mockResolvedValue(cost);
    vi.spyOn(costRepository, "findSafeTransactionForCost").mockResolvedValue(null);
    vi.spyOn(costRepository, "insertSafeTransaction").mockRejectedValue(new Error("treasury movement failed"));
    client.query.mockImplementation(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();
      if (normalizedSql.includes("select id from operating_costs") && normalizedSql.includes("for update")) {
        return { rows: [{ id: cost.id }], rowCount: 1 };
      }
      if (normalizedSql.includes("select id, name, balance from safes where id = $1")) {
        return { rows: [{ id: 9, balance: 500 }], rowCount: 1 };
      }
      if (normalizedSql.startsWith("update operating_costs set approval_status")) {
        return { rows: [{ ...cost, approval_status: "Approved" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(costService.transitionOperatingCost(cost.id!, "Approved", {}))
      .rejects.toThrow("treasury movement failed");
    const statements = client.query.mock.calls.map(([sql]) => sql.toLowerCase());
    expect(statements).toContain("rollback");
    expect(statements).not.toContain("commit");
  });

  it("يتراجع عن القيد والاعتماد إذا لم يكف رصيد الخزينة المختارة", async () => {
    const client = createClient();
    const cost = {
      ...validCost,
      id: 781,
      amount: 200,
      approval_status: "Pending",
      link_ledger: true,
      payment_method: "نقدي",
      safe: "خزينة اختبار",
      safe_id: 9
    } as OperatingCostRecord;
    vi.spyOn(pool, "query").mockResolvedValue({ rows: [], rowCount: 0 } as any);
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "getOperatingCostById").mockResolvedValue(cost);
    vi.spyOn(costRepository, "findSafeTransactionForCost").mockResolvedValue(null);
    const insertSafeTransaction = vi.spyOn(costRepository, "insertSafeTransaction");
    const postCostEntry = vi.spyOn(autoPostingService, "postCostEntry").mockResolvedValue({ id: 903 });
    client.query.mockImplementation(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();
      if (normalizedSql.includes("select id from operating_costs") && normalizedSql.includes("for update")) {
        return { rows: [{ id: cost.id }], rowCount: 1 };
      }
      if (normalizedSql.includes("select id, name, balance from safes where id = $1")) {
        return { rows: [{ id: 9, name: "خزينة اختبار", balance: 0 }], rowCount: 1 };
      }
      if (normalizedSql.startsWith("update operating_costs set approval_status")) {
        return { rows: [{ ...cost, approval_status: "Approved" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(costService.transitionOperatingCost(cost.id!, "Approved", {}))
      .rejects.toThrow('رصيد خزينة "خزينة اختبار" غير كافٍ');
    const statements = client.query.mock.calls.map(([sql]) => sql.toLowerCase());
    expect(postCostEntry).toHaveBeenCalledOnce();
    expect(insertSafeTransaction).not.toHaveBeenCalled();
    expect(statements).toContain("rollback");
    expect(statements).not.toContain("commit");
  });

  it("لا ينشئ حركة خزينة فورية للتكلفة الآجلة", async () => {
    const client = createClient();
    const cost = {
      ...validCost,
      id: 780,
      approval_status: "Pending",
      link_ledger: true,
      payment_method: "آجل"
    } as OperatingCostRecord;
    vi.spyOn(pool, "query").mockResolvedValue({ rows: [], rowCount: 0 } as any);
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "getOperatingCostById")
      .mockResolvedValueOnce(cost)
      .mockResolvedValueOnce({ ...cost, approval_status: "Approved", journal_entry_id: 902 });
    vi.spyOn(autoPostingService, "postCostEntry").mockResolvedValue({
      id: 902,
      reference: "CO-202607-00002"
    });
    const insertSafeTransaction = vi.spyOn(costRepository, "insertSafeTransaction");
    client.query.mockImplementation(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();
      if (normalizedSql.includes("select id from operating_costs") && normalizedSql.includes("for update")) {
        return { rows: [{ id: cost.id }], rowCount: 1 };
      }
      if (normalizedSql.startsWith("update operating_costs set approval_status")) {
        return { rows: [{ ...cost, approval_status: "Approved" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const result = await costService.transitionOperatingCost(cost.id!, "Approved", {});
    const statements = client.query.mock.calls.map(([sql]) => sql.toLowerCase());
    expect(result.approval_status).toBe("Approved");
    expect(insertSafeTransaction).not.toHaveBeenCalled();
    expect(statements.some(sql => sql.includes("update safes set balance = balance -"))).toBe(false);
    expect(statements.some(sql => sql.includes("select id, balance from safes"))).toBe(false);
  });

  it("لا يعيد نجاح الخدمة إلا بعد استلام معرف سجل وتنفيذ COMMIT", async () => {
    const client = createClient();
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "insertOperatingCost").mockResolvedValue({
      ...validCost,
      id: 4242,
      voucher_no: "VCH-202607-0001"
    });
    vi.spyOn(costRepository, "logActivity").mockResolvedValue(undefined);

    const result = await costService.createOperatingCost(validCost, {}, "save-once-key");
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(result.cost.id).toBe(4242);
    expect(statements).toContain("COMMIT");
    expect(statements.indexOf("UPDATE erp_idempotency_keys")).toBeLessThan(statements.indexOf("COMMIT"));
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("يعيد نتيجة المفتاح السابق دون إنشاء سجل مكرر عند إعادة الطلب", async () => {
    const client = createClient(true);
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    const insert = vi.spyOn(costRepository, "insertOperatingCost");

    const result = await costService.createOperatingCost(validCost, {}, "save-once-key");
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(result.replayed).toBe(true);
    expect(result.cost.id).toBe(7001);
    expect(statements).not.toContain("BEGIN");
    expect(insert).not.toHaveBeenCalled();
  });

  it("لا يرسل HTTP نجاحًا إذا لم يرجع الخادم سجلًا محفوظًا", async () => {
    vi.spyOn(costService, "createOperatingCost").mockResolvedValue({ cost: {} as OperatingCostRecord });
    const response: any = {
      statusCode: 200,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; }
    };

    await new CostController().createCost({ headers: {}, body: {} } as any, response);
    expect(response.statusCode).toBe(500);
    expect(response.body.success).toBe(false);
  });

  it("ينفذ INSERT الفعلي في PostgreSQL ويسترجع الصف داخل معاملة الاختبار", async () => {
    await withRollback(async client => {
      const tag = uniqueTag("COST");
      const center = await client.query(
        "INSERT INTO cost_centers (code, name) VALUES ($1, $2) RETURNING id",
        [`${tag}-CC`, `${tag} center`]
      );
      const item = await client.query(
        "INSERT INTO cost_items (code, name) VALUES ($1, $2) RETURNING id",
        [`${tag}-CI`, `${tag} item`]
      );
      const nextVoucher = await client.query(`
        SELECT COALESCE(MAX(substring(voucher_no from char_length($1) + 1)::bigint), 0) + 1 AS next
        FROM operating_costs
        WHERE voucher_no LIKE $1 || '%'
          AND substring(voucher_no from char_length($1) + 1) ~ '^[0-9]+$'
      `, [`${tag}-`]);
      const inserted = await costRepository.insertOperatingCost({
        ...validCost,
        voucher_no: `${tag}-${String(nextVoucher.rows[0].next).padStart(4, "0")}`,
        cost_center_id: Number(center.rows[0].id),
        cost_item_id: Number(item.rows[0].id)
      }, client);
      const persisted = await client.query(
        "SELECT id, amount, cost_center_id, cost_item_id FROM operating_costs WHERE id = $1",
        [inserted.id]
      );
      const listed = await costRepository.findAll({ search: tag }, client);
      const dashboard = await costService.getOperatingCostDashboard({
        from: validCost.date,
        to: validCost.date,
        costCenterId: Number(center.rows[0].id)
      }, client);

      expect(persisted.rows).toHaveLength(1);
      expect(Number(persisted.rows[0].amount)).toBe(validCost.amount);
      expect(Number(persisted.rows[0].cost_center_id)).toBe(Number(center.rows[0].id));
      expect(Number(persisted.rows[0].cost_item_id)).toBe(Number(item.rows[0].id));
      expect(listed).toHaveLength(1);
      expect(Number(listed[0].amount)).toBe(validCost.amount);
      expect(Number(dashboard.summary.total_count)).toBe(1);
      expect(Number(dashboard.summary.total_amount)).toBe(validCost.amount);
    });
  });

  it("ينشئ قيداً متزناً وحركة خزينة فعلية مرة واحدة داخل PostgreSQL", async () => {
    await withRollback(async client => {
      await client.query(`
        ALTER TABLE operating_costs
        ADD COLUMN IF NOT EXISTS treasury_account_id INTEGER REFERENCES treasury_accounts(id)
      `);
      const tag = uniqueTag("COSTGL");
      const codeTag = tag.replace(/[^A-Za-z0-9]/g, "").slice(-12);
      const expenseAccount = await client.query(
        `INSERT INTO accounts (code, name, name_ar, type, account_type, account_nature, allow_posting, is_leaf, balance)
         VALUES ($1, $2, $3, 'expense', 'EXPENSE', 'DEBIT', true, true, 0) RETURNING id`,
        [`${codeTag}-E`, `${tag} expense`, `${tag} expense`]
      );
      const cashAccount = await client.query(
        `INSERT INTO accounts (code, name, name_ar, type, account_type, account_nature, allow_posting, is_leaf, balance)
         VALUES ($1, $2, $3, 'asset', 'ASSET', 'DEBIT', true, true, 0) RETURNING id`,
        [`${codeTag}-C`, `${tag} cash`, `${tag} cash`]
      );
      await client.query(
        `INSERT INTO account_config (key, account_id, updated_at)
         VALUES ('cash', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW()`,
        [cashAccount.rows[0].id]
      );
      const center = await client.query(
        "INSERT INTO cost_centers (code, name) VALUES ($1, $2) RETURNING id",
        [`${codeTag}-CC`, `${tag} center`]
      );
      const item = await client.query(
        `INSERT INTO cost_items (code, name, accounting_account_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [`${codeTag}-CI`, `${tag} utilities`, expenseAccount.rows[0].id]
      );
      const treasuryName = `${tag} treasury`;
      const treasury = await client.query(
        `INSERT INTO treasury_accounts (name, type, currency, current_balance, opening_balance, status)
         VALUES ($1, 'cash', 'EGP', 500, 500, 'active') RETURNING id`,
        [treasuryName]
      );
      const insertedCost = await costRepository.insertOperatingCost({
        ...validCost,
        voucher_no: `${tag}-VCH`,
        category: "utilities",
        amount: 200,
        total: 200,
        approval_status: "Pending",
        payment_method: "نقدي",
        safe: treasuryName,
        treasury_account_id: Number(treasury.rows[0].id),
        link_ledger: true,
        cost_center_id: Number(center.rows[0].id),
        cost_item_id: Number(item.rows[0].id)
      }, client);

      const approvedCost = { ...insertedCost, approval_status: "Approved", link_ledger: true };
      const firstEntry = await (costService as any).postApprovedCostInTransaction(approvedCost, {}, client);
      const secondEntry = await (costService as any).postApprovedCostInTransaction(approvedCost, {}, client);
      const lines = await client.query(
        "SELECT account_id, debit, credit, cost_center_id FROM journal_items WHERE journal_entry_id = $1 ORDER BY id",
        [firstEntry.journalEntry.id]
      );
      const persistedTreasury = await client.query(
        "SELECT current_balance FROM treasury_accounts WHERE id = $1",
        [treasury.rows[0].id]
      );
      const accountBalances = await client.query(
        "SELECT id, balance FROM accounts WHERE id = ANY($1::int[])",
        [[expenseAccount.rows[0].id, cashAccount.rows[0].id]]
      );
      const treasuryMovements = await client.query(
        `SELECT id, amount, transaction_type, voucher_number
           FROM treasury_transactions
          WHERE account_id = $1 AND reference_type = 'cost' AND reference_id = $2`,
        [treasury.rows[0].id, insertedCost.id]
      );
      const entries = await client.query(
        "SELECT id FROM journal_entries WHERE source_type = 'cost' AND source_id = $1",
        [insertedCost.id]
      );

      expect(secondEntry.journalEntry.id).toBe(firstEntry.journalEntry.id);
      expect(secondEntry.safeTransaction.id).toBe(firstEntry.safeTransaction.id);
      expect(entries.rows).toHaveLength(1);
      expect(lines.rows).toHaveLength(2);
      expect(lines.rows.some(line => Number(line.account_id) === Number(expenseAccount.rows[0].id) && Number(line.debit) === 200)).toBe(true);
      expect(lines.rows.some(line => Number(line.account_id) === Number(cashAccount.rows[0].id) && Number(line.credit) === 200)).toBe(true);
      expect(lines.rows.every(line => Number(line.cost_center_id) === Number(center.rows[0].id))).toBe(true);
      expect(lines.rows.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(lines.rows.reduce((sum, line) => sum + Number(line.credit), 0));
      expect(Number(accountBalances.rows.find(row => Number(row.id) === Number(expenseAccount.rows[0].id)).balance)).toBe(200);
      expect(Number(accountBalances.rows.find(row => Number(row.id) === Number(cashAccount.rows[0].id)).balance)).toBe(-200);
      expect(Number(persistedTreasury.rows[0].current_balance)).toBe(300);
      expect(treasuryMovements.rows).toHaveLength(1);
      expect(Number(treasuryMovements.rows[0].amount)).toBe(-200);
      expect(treasuryMovements.rows[0].transaction_type).toBe("cash_out");
      expect(treasuryMovements.rows[0].voucher_number).toMatch(/^PAY-/);
    });
  });

  it("لا ينفذ طلب إنشاء التكلفة حالة اعتماد أو ترحيل يرسلها العميل", async () => {
    const client = createClient();
    vi.spyOn(pool, "connectPostgres").mockResolvedValue(client as any);
    vi.spyOn(costRepository, "insertOperatingCost").mockImplementation(async cost => ({
      ...cost,
      id: 991,
      voucher_no: "VCH-202607-0099"
    } as OperatingCostRecord));
    vi.spyOn(costRepository, "logActivity").mockResolvedValue(undefined);
    const postCostEntry = vi.spyOn(autoPostingService, "postCostEntry");

    const result = await costService.createOperatingCost({
      ...validCost,
      approval_status: "Approved",
      payment_method: "نقدي",
      safe: "خزينة اختبار",
      treasury_account_id: 9,
      link_ledger: true
    }, {});

    expect(result.cost.approval_status).toBe("Draft");
    expect(result.journal_entry).toBeNull();
    expect(postCostEntry).not.toHaveBeenCalled();
  });

  it("يحمّل القائمة من PostgreSQL الحقيقي بدل قاعدة offline الاحتياطية", async () => {
    vi.spyOn(pool, "queryPostgres").mockResolvedValue({ rows: [{ id: 8901 }], rowCount: 1 });
    const offlineQuery = vi.spyOn(pool, "query");

    const costs = await costRepository.findAll();

    expect(costs).toEqual([{ id: 8901 }]);
    expect(pool.queryPostgres).toHaveBeenCalledOnce();
    expect(offlineQuery).not.toHaveBeenCalled();
  });
});
