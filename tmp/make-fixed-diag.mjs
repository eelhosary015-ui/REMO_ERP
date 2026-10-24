import fs from "node:fs";
let s = fs.readFileSync("tmp/diag-tb-ranges.mjs","utf8");
s = s.replace(/COALESCE\(\(SELECT SUM\(CASE WHEN a\.account_nature='CREDIT' THEN ji_open\.credit-ji_open\.debit ELSE ji_open\.debit-ji_open\.credit END\)/,
"COALESCE((SELECT SUM(CASE WHEN UPPER(COALESCE(a.account_nature,''))='CREDIT' OR LOWER(COALESCE(a.type,'')) IN ('liability','equity','revenue') THEN ji_open.credit-ji_open.debit ELSE ji_open.debit-ji_open.credit END)");
s = s.split("je_open.status <> 'canceled'").join("je_open.status = 'posted'");
s = s.split("je_period.status <> 'canceled'").join("je_period.status = 'posted'");
fs.writeFileSync("tmp/diag-tb-ranges-fixed.mjs", s, "utf8");
console.log("ok");
