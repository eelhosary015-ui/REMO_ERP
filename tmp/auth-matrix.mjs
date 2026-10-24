/**
 * Auth/JWT acceptance matrix for the REMO PRO fix verification.
 * Runs against the TEST server (port 3100) connected to erp_system2_test.
 * Prints PASS/FAIL per case; never prints tokens or secrets.
 */
import { config as loadEnv } from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pg from "pg";

loadEnv({ quiet: true });

const BASE = process.env.PROBE_BASE || "http://localhost:3100";
const ADMIN_USER = "admin";
const ADMIN_PASS = process.env.PROBE_ADMIN_PASS || "TestAdmin#12345";
const LIMITED_USER = "auth_probe_limited";
const LIMITED_PASS = "Probe#12345";

const results = [];
function record(id, description, pass, detail) {
  results.push({ id, description, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${description} :: ${detail}`);
}

async function call(path, { method = "GET", token, tokenValue, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (tokenValue !== undefined) headers.Authorization = tokenValue;
  else if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 120) };
  }
  return { status: res.status, json };
}

async function ensureLimitedUser() {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${process.env.PROBE_DB || "erp_system2_test"}`;
  if (!/_test$/.test(url.pathname)) throw new Error("probe DB must end with _test");
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const hash = bcrypt.hashSync(LIMITED_PASS, 10);
    await client.query(
      `INSERT INTO users (username, password, role, permissions, status)
       VALUES ($1, $2, 'user', $3, 'active')
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, role = 'user', permissions = EXCLUDED.permissions`,
      [LIMITED_USER, hash, JSON.stringify({ sales: true })],
    );
  } finally {
    await client.end();
  }
}

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET missing for signing probe tokens");

  // ── public routes
  let r = await call("/api/health");
  record("A1", "public /api/health without token", r.status === 200 && r.json.status === "ok", `status=${r.status}`);

  r = await call("/api/settings/system_name");
  record("A2", "public branding setting without token", r.status === 200, `status=${r.status}`);

  // ── unauthenticated protected route
  r = await call("/api/auth/me");
  record("B1", "protected route without token → 401 AUTH_REQUIRED", r.status === 401 && r.json.error === "AUTH_REQUIRED", `status=${r.status} error=${r.json.error}`);

  r = await call("/api/auth/me", { tokenValue: "Bearer null" });
  record("B2", "`Bearer null` → clean 401 (no jwt malformed)", r.status === 401 && r.json.error === "AUTH_REQUIRED", `status=${r.status} error=${r.json.error}`);

  r = await call("/api/auth/me", { tokenValue: "Bearer undefined" });
  record("B3", "`Bearer undefined` → clean 401", r.status === 401 && r.json.error === "AUTH_REQUIRED", `status=${r.status} error=${r.json.error}`);

  r = await call("/api/auth/me", { tokenValue: "Bearer " });
  record("B4", "empty bearer value → clean 401", r.status === 401 && r.json.error === "AUTH_REQUIRED", `status=${r.status} error=${r.json.error}`);

  r = await call("/api/auth/me", { tokenValue: "Bearer preview-bypass-token" });
  record("B5", "legacy bypass token rejected while DEV_AUTH_BYPASS is off", r.status === 401 && r.json.error === "TOKEN_INVALID", `status=${r.status} error=${r.json.error}`);

  r = await call("/api/auth/me", { tokenValue: "Bearer abc.def.ghi" });
  record("B6", "well-shaped but invalid token → 401 TOKEN_INVALID", r.status === 401 && r.json.error === "TOKEN_INVALID", `status=${r.status} error=${r.json.error}`);

  // ── login
  r = await call("/api/login", { method: "POST", body: { username: ADMIN_USER, password: "definitely-wrong" } });
  record("C1", "wrong password rejected", r.status === 401, `status=${r.status} error=${r.json.error}`);

  r = await call("/api/login", { method: "POST", body: { username: ADMIN_USER, password: ADMIN_PASS } });
  const adminToken = r.json?.token;
  record("C2", "admin login succeeds and returns a token", r.status === 200 && typeof adminToken === "string" && adminToken.split(".").length === 3, `status=${r.status} tokenSegments=${adminToken ? adminToken.split(".").length : 0}`);
  record("C3", "no JWT error raised during successful login", r.status === 200, `status=${r.status}`);

  r = await call("/api/auth/me", { token: adminToken });
  record("D1", "valid admin token → /api/auth/me 200 with role", r.status === 200 && r.json?.user?.role === "admin", `status=${r.status} role=${r.json?.user?.role}`);

  // ── expired / tampered tokens
  const expired = jwt.sign({ id: 2, username: ADMIN_USER, role: "admin" }, secret, { expiresIn: -60 });
  r = await call("/api/auth/me", { token: expired });
  record("E1", "expired token → 401 TOKEN_EXPIRED", r.status === 401 && r.json.error === "TOKEN_EXPIRED", `status=${r.status} error=${r.json.error}`);

  const tampered = adminToken.slice(0, -2) + (adminToken.endsWith("aa") ? "bb" : "aa");
  r = await call("/api/auth/me", { token: tampered });
  record("E2", "tampered signature → 401 TOKEN_INVALID", r.status === 401 && r.json.error === "TOKEN_INVALID", `status=${r.status} error=${r.json.error}`);

  const forged = jwt.sign({ id: 2, username: ADMIN_USER, role: "admin" }, "x".repeat(48), { expiresIn: "1h" });
  r = await call("/api/auth/me", { token: forged });
  record("E3", "token signed with a different secret → 401", r.status === 401, `status=${r.status} error=${r.json.error}`);

  // ── admin authorized business routes (no silent 401/403 regressions)
  for (const [id, path, label] of [
    ["F1", "/api/users", "users directory"],
    ["F2", "/api/v2/sales/invoices", "sales invoices"],
    ["F3", "/api/purchases", "purchases"],
    ["F4", "/api/warehouses", "warehouses"],
    ["F5", "/api/accounts", "chart of accounts"],
    ["F6", "/api/hr/employees", "HR employees"],
  ]) {
    r = await call(path, { token: adminToken });
    record(id, `admin can read ${label}`, r.status === 200, `status=${r.status}`);
  }

  // ── permission enforcement with a limited (non-admin) user
  await ensureLimitedUser();
  r = await call("/api/login", { method: "POST", body: { username: LIMITED_USER, password: LIMITED_PASS } });
  const limitedToken = r.json?.token;
  record("G1", "limited user login succeeds", r.status === 200 && !!limitedToken, `status=${r.status}`);

  r = await call("/api/auth/me", { token: limitedToken });
  record("G2", "limited user keeps its own role (not elevated)", r.status === 200 && r.json?.user?.role === "user", `status=${r.status} role=${r.json?.user?.role}`);

  r = await call("/api/users", { token: limitedToken });
  record("G3", "limited user denied /api/users (403 PERMISSION_DENIED)", r.status === 403 && r.json.error === "PERMISSION_DENIED", `status=${r.status} error=${r.json.error}`);

  r = await call("/api/v2/sales/invoices", { token: limitedToken });
  record("G4", "limited user with sales permission can read sales invoices", r.status === 200, `status=${r.status}`);

  const failed = results.filter((x) => !x.pass);
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} PASS, ${failed.length} FAIL`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.id).join(", "));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("MATRIX ERROR:", error.message);
  process.exitCode = 2;
});
