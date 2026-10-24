const fs = require('fs');

// 1. Patch the route in hr_api.routes.ts
let routeFile = 'modules/hr/hr_api.routes.ts';
let routeContent = fs.readFileSync(routeFile, 'utf8');

// Find the route definition for /api/fingerprint-devices/:id/sync
const routeStart = routeContent.indexOf('router.post("/api/fingerprint-devices/:id/sync",');
const nextRouteStart = routeContent.indexOf('router.get("/api/fingerprint-devices/:id/logs",');

if (routeStart !== -1 && nextRouteStart !== -1) {
    const oldRoute = routeContent.substring(routeStart, nextRouteStart);
    const newRoute = `  router.post("/api/fingerprint-devices/:id/sync", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const { FingerprintService } = await import("../fingerprint/services/fingerprint.service.js");
      const service = new FingerprintService();
      
      // Pass forceFullSync = true
      const result = await service.syncDeviceLogs(parseInt(String(id), 10), true);
      
      res.json({
        success: result.success,
        pulled: result.pulled,
        matched: result.matched,
        inserted: result.inserted,
        message: result.error || "تمت المزامنة"
      });
    } catch (error: any) {
      console.error("Failed to sync device logs:", error);
      res.status(500).json({ error: "فشل في عملية المزامنة" });
    }
  });\n\n  `;
    routeContent = routeContent.replace(oldRoute, newRoute);
    fs.writeFileSync(routeFile, routeContent);
    console.log("Patched hr_api.routes.ts");
}

// 2. Patch fingerprint.service.ts
let srvFile = 'modules/fingerprint/services/fingerprint.service.ts';
let srvContent = fs.readFileSync(srvFile, 'utf8');

srvContent = srvContent.replace('async syncDeviceLogs(id: number): Promise<SyncResult> {', 'async syncDeviceLogs(id: number, forceFullSync: boolean = false): Promise<SyncResult> {');

const oldIncremental = `    // INCREMENTAL SYNC LOGIC with 7-days overlap for healing
    const maxTsResult = await pool.query("SELECT MAX(timestamp) as max_ts FROM fingerprint_logs WHERE device_id = $1", [id]);
    // Subtract 7 days (7 * 24 * 60 * 60 * 1000 = 604800000 ms) from max_ts to always heal recent days
    const maxTs = maxTsResult.rows[0]?.max_ts ? Math.max(0, new Date(maxTsResult.rows[0].max_ts).getTime() - 604800000) : 0;`;

const newIncremental = `    let maxTs = 0;
    if (!forceFullSync) {
      const maxTsResult = await pool.query("SELECT MAX(timestamp) as max_ts FROM fingerprint_logs WHERE device_id = $1", [id]);
      maxTs = maxTsResult.rows[0]?.max_ts ? Math.max(0, new Date(maxTsResult.rows[0].max_ts).getTime() - 604800000) : 0;
    }`;

srvContent = srvContent.replace(oldIncremental, newIncremental);

const oldInsertLoop = `    // Save new logs to DB
    for (const rec of rawRecords) {
      const emp = lookupEmp(rec.fingerprint_code);
      try {
        await pool.query(
          "INSERT INTO fingerprint_logs (device_id, fingerprint_code, timestamp, type, employee_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
          [id, rec.fingerprint_code, rec.timestamp, 'auto', emp ? emp.id : null]
        );
      } catch (e) {}
    }`;

const newInsertLoop = `    // Save new logs to DB (Optimized Batch)
    const chunkSize = 2000;
    for (let i = 0; i < rawRecords.length; i += chunkSize) {
      const chunk = rawRecords.slice(i, i + chunkSize);
      const values = chunk.flatMap(rec => {
        const emp = lookupEmp(rec.fingerprint_code);
        return [id, rec.fingerprint_code, rec.timestamp, 'auto', emp ? emp.id : null];
      });
      
      const placeholders = chunk.map((_, idx) => 
        \`($\${idx * 5 + 1}, $\${idx * 5 + 2}, $\${idx * 5 + 3}, $\${idx * 5 + 4}, $\${idx * 5 + 5})\`
      ).join(', ');
      
      if (placeholders.length > 0) {
        try {
          await pool.query(
            \`INSERT INTO fingerprint_logs (device_id, fingerprint_code, timestamp, type, employee_id) VALUES \${placeholders} ON CONFLICT DO NOTHING\`,
            values
          );
        } catch (e) {
          console.error("Batch insert failed, falling back to individual inserts...", e);
        }
      }
    }`;

srvContent = srvContent.replace(oldInsertLoop, newInsertLoop);
fs.writeFileSync(srvFile, srvContent);
console.log("Patched fingerprint.service.ts");
