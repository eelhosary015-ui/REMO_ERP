import fs from "node:fs";

// ISSUE-05: جدول خاطئ
{
  const f = "modules/sales/index.ts";
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  s = s.replace("LEFT JOIN journal_entry_items ji ON je.id = ji.journal_entry_id",
                "LEFT JOIN journal_items ji ON je.id = ji.journal_entry_id");
  if (s !== before) { fs.writeFileSync(f, s, "utf8"); console.log("ISSUE-05 fixed"); }
  else console.log("ISSUE-05: anchor not found");
}

// ISSUE-06: Date.startsWith
{
  const f = "modules/warehouses/warehouses_api.routes.ts";
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  s = s.replace(/\(m\.created_at \|\| ""\)\.startsWith\(/g, 'String(m.created_at instanceof Date ? m.created_at.toISOString() : (m.created_at || "")).startsWith(');
  s = s.replace(/\(t\.date \|\| ""\)\.startsWith\(/g, 'String(t.date instanceof Date ? t.date.toISOString() : (t.date || "")).startsWith(');
  if (s !== before) { fs.writeFileSync(f, s, "utf8"); console.log("ISSUE-06 fixed"); }
  else console.log("ISSUE-06: anchor not found");
}

// ISSUE-07: تعارض المسارات
{
  const f = "modules/purchases/suppliers_api.routes.ts";
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  s = s.replace('router.get("/api/purchases/:id", async (req: Request, res: Response) => {',
                'router.get("/api/purchases/:id(\\\\d+)", async (req: Request, res: Response) => {');
  if (s !== before) { fs.writeFileSync(f, s, "utf8"); console.log("ISSUE-07 fixed"); }
  else console.log("ISSUE-07: anchor not found");
}
