const fs = require('fs');

let routeFile = 'modules/hr/hr_api.routes.ts';
let routeContent = fs.readFileSync(routeFile, 'utf8');

const routeStart = routeContent.indexOf('  router.post("/api/fingerprint-devices/:id/sync",');
const nextRouteStart = routeContent.indexOf('  // === Real-time Poll Endpoint (lightweight, fast) ===');

if (routeStart !== -1 && nextRouteStart !== -1) {
    const oldRoute = routeContent.substring(routeStart, nextRouteStart);
    const newRoute = "  router.post(\"/api/fingerprint-devices/:id/sync\", authenticateToken, async (req, res) => {\n" +
"    const { id } = req.params;\n" +
"    try {\n" +
"      const { FingerprintService } = await import(\"../fingerprint/services/fingerprint.service.js\");\n" +
"      const service = new FingerprintService();\n" +
"      \n" +
"      const result = await service.syncDeviceLogs(parseInt(String(id), 10), true);\n" +
"      \n" +
"      res.json({\n" +
"        success: result.success,\n" +
"        pulled: result.pulled,\n" +
"        matched: result.matched,\n" +
"        inserted: result.inserted,\n" +
"        message: result.error || \"تم السحب\"\n" +
"      });\n" +
"    } catch (error: any) {\n" +
"      console.error(\"Failed to sync device logs:\", error);\n" +
"      res.status(500).json({ error: \"فشل في عملية المزامنة\" });\n" +
"    }\n" +
"  });\n\n";

    routeContent = routeContent.replace(oldRoute, newRoute);
    fs.writeFileSync(routeFile, routeContent);
    console.log("Patched hr_api.routes.ts");
} else {
    console.log("Could not find route boundaries", {routeStart, nextRouteStart});
}
