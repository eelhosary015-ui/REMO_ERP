import fs from "node:fs";
import crypto from "node:crypto";
const p = ".env";
let s = fs.readFileSync(p, "utf8");
if (!fs.existsSync(".env.bak-2026-10-21-security")) fs.copyFileSync(p, ".env.bak-2026-10-21-security");
const setIfMissing = (key, val) => {
  const re = new RegExp("^" + key + "=.*$", "m");
  if (re.test(s)) { s = s.replace(re, key + "=" + val); return "updated"; }
  s += (s.endsWith("\n") ? "" : "\n") + key + "=" + val + "\n";
  return "added";
};
const r1 = setIfMissing("JWT_SECRET", crypto.randomBytes(48).toString("hex"));
const r2 = setIfMissing("SECURITY_ENCRYPTION_KEY", crypto.randomBytes(48).toString("hex"));
fs.writeFileSync(p, s, "utf8");
console.log("JWT_SECRET:", r1, "| SECURITY_ENCRYPTION_KEY:", r2);
