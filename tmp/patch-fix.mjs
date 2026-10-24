import fs from "node:fs";
const p = "tmp/fix-october.mjs";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  "if (APPLY) await c.query(`UPDATE journal_entries SET status='posted', period_id=COALESCE(period_id,$2) WHERE id=32`, [null, PERIOD]);",
  "if (APPLY) await c.query(`UPDATE journal_entries SET status='posted', period_id=COALESCE(period_id,$1) WHERE id=32`, [PERIOD]);");
s = s.replace(
  "if (APPLY) await c.query(`UPDATE journal_entries SET status='posted', period_id=COALESCE(period_id,$2) WHERE id=5`, [null, PERIOD]);",
  "if (APPLY) await c.query(`UPDATE journal_entries SET status='posted', period_id=COALESCE(period_id,$1) WHERE id=5`, [PERIOD]);");
fs.writeFileSync(p, s, "utf8");
console.log("patched");
