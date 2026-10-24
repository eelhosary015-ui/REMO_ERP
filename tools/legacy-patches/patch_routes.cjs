const fs = require('fs');
const path = require('path');

const routesPath = path.join(process.cwd(), 'modules/hr/hr_api.routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

const route = `
  router.get("/api/fingerprint-devices/:id/users", authenticateToken, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { FingerprintService } = await import("../fingerprint/services/fingerprint.service.js");
      const service = new FingerprintService();
      const result = await service.getDeviceUsers(Number(id));
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error: any) {
      console.error("Failed to fetch users from device:", error);
      res.status(500).json({ error: error.message || "Failed to fetch users" });
    }
  });
`;

if (!content.includes('/api/fingerprint-devices/:id/users')) {
  content = content.replace(/router\.post\("\/api\/fingerprint-devices\/sync-all"/, route + '\n  router.post("/api/fingerprint-devices/sync-all"');
  fs.writeFileSync(routesPath, content);
  console.log("Added device users route");
}
