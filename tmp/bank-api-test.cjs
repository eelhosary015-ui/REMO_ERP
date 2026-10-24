const BASE = "http://127.0.0.1:3010";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json?.error || JSON.stringify(json)}`);
  return json;
}

const money = (v) => Number(v || 0).toFixed(2);
let failures = 0;
function check(label, actual, expected, tolerance = 0.02) {
  const ok = Math.abs(Number(actual) - Number(expected)) <= tolerance;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}: ${actual} (expected ${expected})`);
}

(async () => {
  const lookups = await call("GET", "/api/banks/lookups");
  console.log("defaults:", JSON.stringify(lookups.defaults));
  const cashId = lookups.treasury_accounts.find((t) => t.type === "cash")?.id;
  console.log("cash treasury:", cashId, "gl accounts:", lookups.gl_accounts.length);

  const acc1 = await call("POST", "/api/banks/accounts", {
    name: "TEST-BANK-ALPHA",
    bank_name: "Ø¨Ù†Ùƒ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±",
    account_number: "100200300",
    opening_balance: 10000,
    branch_id: 1,
  });
  console.log("account1:", acc1.id, "gl:", acc1.gl_account_id, "treasury:", acc1.treasury_account_id, "balance:", acc1.balance);
  if (!acc1.gl_account_id || !acc1.treasury_account_id) {
    throw new Error("account was not linked to GL/treasury");
  }

  const withdraw = await call("POST", "/api/banks/transactions", {
    account_id: acc1.id,
    amount: 3000,
    operation: "withdraw",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "Ø³Ø­Ø¨ Ø§Ø®ØªØ¨Ø§Ø± Ø¥Ù„Ù‰ Ø§Ù„Ø®Ø²ÙŠÙ†Ø©",
    cash_account_id: cashId,
  });
  console.log("withdraw:", JSON.stringify(withdraw.transaction.balance_after), "journal:", withdraw.journal_entry_id);

  const deposit = await call("POST", "/api/banks/transactions", {
    account_id: acc1.id,
    amount: 1000,
    operation: "deposit",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "Ø¥ÙŠØ¯Ø§Ø¹ Ø§Ø®ØªØ¨Ø§Ø± Ù…Ù† Ø§Ù„Ø®Ø²ÙŠÙ†Ø©",
    cash_account_id: cashId,
  });
  console.log("deposit:", deposit.transaction.balance_after);

  await call("POST", "/api/banks/transactions", {
    account_id: acc1.id,
    amount: 100,
    operation: "fee",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "Ø¹Ù…ÙˆÙ„Ø© Ø¨Ù†Ùƒ Ø§Ø®ØªØ¨Ø§Ø±",
  });
  const interest = await call("POST", "/api/banks/transactions", {
    account_id: acc1.id,
    amount: 250,
    operation: "interest",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "ÙÙˆØ§Ø¦Ø¯ Ø¨Ù†Ùƒ Ø§Ø®ØªØ¨Ø§Ø±",
  });
  console.log("after fee+interest balance:", interest.transaction.balance_after);
  check("account1 balance after movements", interest.transaction.balance_after, 8150);

  const acc2 = await call("POST", "/api/banks/accounts", {
    name: "TEST-BANK-BETA",
    bank_name: "Ø¨Ù†Ùƒ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±",
    opening_balance: 5000,
    branch_id: 1,
  });
  const transfer = await call("POST", "/api/banks/transfers", {
    from_account_id: acc1.id,
    to_account_id: acc2.id,
    amount: 1500,
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "ØªØ­ÙˆÙŠÙ„ Ø§Ø®ØªØ¨Ø§Ø± Ø¨ÙŠÙ† Ø§Ù„Ø¨Ù†ÙƒÙŠÙ†",
  });
  console.log("transfer:", transfer.transfer_number, "journal:", transfer.journal_entry_id);

  const accounts = await call("GET", "/api/banks/accounts");
  const a1 = accounts.find((a) => a.id === acc1.id);
  const a2 = accounts.find((a) => a.id === acc2.id);
  check("account1 balance from accounts API", a1.balance, 6650);
  check("account2 balance from accounts API", a2.balance, 6500);
  console.log("a1 treasury:", money(a1.treasury_balance), "a2 treasury:", money(a2.treasury_balance));

  const statement = await call("GET", `/api/banks/reports/statement?account_id=${acc1.id}&from_date=2000-01-01&to_date=2100-01-01`);
  console.log("statement opening/closing:", statement.opening_balance, statement.closing_balance, "lines:", statement.lines.length);
  check("statement closing = account balance", statement.closing_balance, 6650);

  const balances = await call("GET", "/api/banks/reports/balances");
  console.log("balances totals:", JSON.stringify(balances.totals));
  const row1 = balances.rows.find((r) => r.id === acc1.id);
  console.log("gl variance a1:", row1.gl_variance, "treasury variance a1:", row1.treasury_variance);
  check("GL variance a1", row1.gl_variance, 0);
  check("treasury variance a1", row1.treasury_variance, 0);

  const dash = await call("GET", "/api/banks/dashboard");
  console.log("dashboard:", JSON.stringify({ month: dash.month, integration: dash.integration, unreconciled: dash.unreconciled }));
  check("dashboard integration GL variance", dash.integration.gl_variance, 0);
  check("dashboard integration treasury variance", dash.integration.treasury_variance, 0);

  const feeReport = await call("GET", "/api/banks/reports/fees");
  console.log("fees totals:", JSON.stringify(feeReport.totals));
  check("fees total", feeReport.totals.fees, 100);
  check("interest total", feeReport.totals.interest, 250);

  const cashflow = await call("GET", `/api/banks/reports/cashflow?year=${new Date().getFullYear()}`);
  console.log("cashflow totals:", JSON.stringify(cashflow.totals));

  // Statement + reconciliation
  const stmt = await call("POST", "/api/banks/statements", {
    account_id: acc1.id,
    period_from: new Date().toISOString().slice(0, 7) + "-01",
    period_to: new Date().toISOString().slice(0, 10),
    opening_balance: 10000,
    closing_balance: 6650,
    lines: [
      { date: new Date().toISOString().slice(0, 10), description: "Ø¹Ù…ÙˆÙ„Ø© Ø¨Ù†Ùƒ Ø§Ø®ØªØ¨Ø§Ø±", amount: -100, direction: "debit" },
      { date: new Date().toISOString().slice(0, 10), description: "ÙÙˆØ§Ø¦Ø¯ Ø¨Ù†Ùƒ Ø§Ø®ØªØ¨Ø§Ø±", amount: 250, direction: "credit" },
    ],
  });
  const match = await call("POST", `/api/banks/statements/${stmt.id}/auto-match`);
  console.log("auto-match:", JSON.stringify(match));
  const stmtDetails = await call("GET", `/api/banks/statements/${stmt.id}`);
  console.log("statement summary:", JSON.stringify(stmtDetails.summary));

  // Cheque
  const cheque = await call("POST", "/api/banks/cheques", {
    account_id: acc1.id,
    check_number: "CHQ-TEST-1",
    check_type: "incoming",
    beneficiary: "Ø¹Ù…ÙŠÙ„ Ø§Ø®ØªØ¨Ø§Ø±",
    amount: 700,
    issue_date: new Date().toISOString().slice(0, 10),
  });
  const settled = await call("POST", `/api/banks/cheques/${cheque.id}/settle`, {});
  console.log("cheque settled balance:", settled.transaction.balance_after);
  const chequeReport = await call("GET", "/api/banks/reports/cheques");
  console.log("cheques:", JSON.stringify({ incoming: chequeReport.incoming, outgoing: chequeReport.outgoing }));

  const balances2 = await call("GET", "/api/banks/reports/balances");
  const rowA1 = balances2.rows.find((r) => r.id === acc1.id);
  check("GL variance after cheque", rowA1.gl_variance, 0);
  check("final account balance", rowA1.balance, 7350);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

