import "dotenv/config";
import { pool } from "../server-db.js";
import { PayrollRunService } from "../modules/payroll/services/payroll-run.service.js";

const svc: any = new PayrollRunService();

async function run(label: string, mutate: (c: any) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await mutate(client);
    const resolved = await svc.resolvePayrollAccounts(client);
    const rows = await client.query(
      "SELECT id, code, COALESCE(name_ar, name) AS name FROM accounts WHERE id = ANY($1::int[])",
      [[resolved.expenseAccountId, resolved.payableAccountId]],
    );
    const byId: Record<number, string> = {};
    for (const r of rows.rows) byId[r.id] = `${r.code} ${r.name}`;
    console.log(label, {
      expense: byId[resolved.expenseAccountId],
      payable: byId[resolved.payableAccountId],
    });
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

await run("baseline", async () => {});
await run("payroll_expense=11 (COGS)", async (c) => {
  await c.query("UPDATE account_config SET account_id = 11 WHERE key = 'payroll_expense'");
});
await run("salaries_payable=14 (expense)", async (c) => {
  await c.query("UPDATE account_config SET account_id = 14 WHERE key = 'salaries_payable'");
});

await pool.end();
