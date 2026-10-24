const fs = require("fs");
const jwt = require("jsonwebtoken");
const t = fs.readFileSync(".env", "utf8");
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const token = jwt.sign({ id: 1, username: "elsayed", role: "admin" }, process.env.JWT_SECRET, { expiresIn: "30m" });
(async () => {
  for (const path of ["/api/banks/lookups", "/api/banks/dashboard", "/api/banks/reports/balances", "/api/banks/accounts", "/api/banks/transactions"]) {
    const res = await fetch("http://127.0.0.1:3000" + path, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => null);
    const summary = Array.isArray(body)
      ? `rows=${body.length}`
      : body
        ? Object.keys(body).slice(0, 6).join(",")
        : "null";
    console.log(`${path} -> ${res.status} ${summary}`);
    if (path.includes("lookups")) {
      console.log("  treasury:", body?.treasury_accounts?.length, "gl:", body?.gl_accounts?.length, "defaults:", JSON.stringify(body?.defaults));
    }
    if (path.includes("balances")) {
      console.log("  totals:", JSON.stringify(body?.totals));
    }
  }
})();
