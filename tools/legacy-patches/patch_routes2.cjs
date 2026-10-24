const fs = require('fs');
let content = fs.readFileSync('modules/hr/hr_api.routes.ts', 'utf8');

const route = `
  router.delete("/api/attendance/all", authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });
      await client.query("DELETE FROM attendance");
      res.json({ success: true, message: "تم مسح جميع سجلات الحضور" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
`;

if (!content.includes('/api/attendance/all')) {
  content = content.replace(/router\.get\("\/api\/attendance",/, route + '\n  router.get("/api/attendance",');
  fs.writeFileSync('modules/hr/hr_api.routes.ts', content);
  console.log("Added delete all attendance route");
}
