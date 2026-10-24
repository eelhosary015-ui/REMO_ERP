const fs = require('fs');

// 1. UI Patch
let uiFile = 'src/components/FingerprintSettings.tsx';
let uiContent = fs.readFileSync(uiFile, 'utf8');

const uiTarget1 = `  const handleHistoricalSyncSingleDevice = async (id: number) => {
    if (!window.confirm("تحذير: سيتم بدء سحب جميع البصمات من الجهاز منذ بداية تشغيله وتحديث تقارير الحضور للشهور السابقة.\\n\\nهذه العملية ستعمل في الخلفية وقد تستغرق عدة دقائق.\\nهل أنت متأكد من بدء السحب التاريخي؟")) return;
    setSyncingId(id);
    try {
      const res = await api.post(\`/api/fingerprint-devices/\${id}/sync-historical\`, {
        userId: user?.id,
      });
      const data = await res.json();
      if (res.ok) {
        alert(\`✅ \${data.message || "بدأ السحب التاريخي في الخلفية بنجاح"}\`);
        mutate("/api/fingerprint-devices");
      } else {
        alert(\`❌ فشل بدء السحب: \${data.error || "خطأ اتصال"}\`);
      }
    } catch (err) {
      alert("❌ حدث خطأ اتصال أثناء بدء السحب");
    } finally {
      setSyncingId(null);
    }
  };`;

const uiTarget2 = `                    <button
                      onClick={() => handleHistoricalSyncSingleDevice(device.id)}
                      disabled={syncingId === device.id}
                      className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition-colors disabled:opacity-50"
                      title="سحب تاريخي كامل (تحديث الشهور السابقة)"
                    >
                      <Database className={\`w-4 h-4 \${syncingId === device.id ? "animate-pulse" : ""}\`} />
                    </button>`;

uiContent = uiContent.replace(uiTarget1, '');
uiContent = uiContent.replace(uiTarget2, '');

// Also remove Database from imports
uiContent = uiContent.replace('  Trash2,  Database,', '  Trash2,');

fs.writeFileSync(uiFile, uiContent);
console.log("UI Patched.");

// 2. Route Patch
let routeFile = 'modules/hr/hr_api.routes.ts';
let routeContent = fs.readFileSync(routeFile, 'utf8');

const routeTarget = `  router.post("/api/fingerprint-devices/:id/sync-historical", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const { spawn } = await import("child_process");
      const { join } = await import("path");
      
      const jobId = \`sync-historical-\${id}-\${Date.now()}\`;
      
      // Execute the job in the background
      const jobPath = join(process.cwd(), "modules/fingerprint/jobs/sync-historical.ts");
      const child = spawn("npx", ["tsx", jobPath, id.toString()], {
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      child.unref();

      res.json({ 
        message: "تم بدء سحب البصمات التاريخية في الخلفية. قد تستغرق العملية بعض الوقت.",
        jobId,
        status: "processing"
      });
    } catch (error: any) {
      console.error("Failed to start historical sync:", error);
      res.status(500).json({ error: "فشل في بدء عملية السحب الشامل" });
    }
  });`;

routeContent = routeContent.replace(routeTarget, '');
fs.writeFileSync(routeFile, routeContent);
console.log("Route Patched.");

// 3. Service Patch
let srvFile = 'modules/fingerprint/services/fingerprint.service.ts';
let srvContent = fs.readFileSync(srvFile, 'utf8');

const srvTarget = `    // INCREMENTAL SYNC LOGIC: Find last sync time for this device
    const maxTsResult = await pool.query("SELECT MAX(timestamp) as max_ts FROM fingerprint_logs WHERE device_id = $1", [id]);
    const maxTs = maxTsResult.rows[0]?.max_ts ? new Date(maxTsResult.rows[0].max_ts).getTime() : 0;
    
    const rawRecords = logs
      .map((log: any) => ({
        fingerprint_code: String(log.deviceUserId || log.userSn || log.uid || log.userId || log.pin || log.id || "").trim(),
        timestamp: log.recordTime instanceof Date ? log.recordTime.toISOString() : new Date(log.recordTime).toISOString(),
        type: 'check_in'
      }))
      .filter((rec: any) => new Date(rec.timestamp).getTime() > maxTs);`;

// We'll subtract 7 days from maxTs to ensure healing without parsing all 100k logs
const srvReplacement = `    // INCREMENTAL SYNC LOGIC with 7-days overlap for healing
    const maxTsResult = await pool.query("SELECT MAX(timestamp) as max_ts FROM fingerprint_logs WHERE device_id = $1", [id]);
    // Subtract 7 days (7 * 24 * 60 * 60 * 1000 = 604800000 ms) from max_ts to always heal recent days
    const maxTs = maxTsResult.rows[0]?.max_ts ? Math.max(0, new Date(maxTsResult.rows[0].max_ts).getTime() - 604800000) : 0;
    
    const rawRecords = logs
      .map((log: any) => ({
        fingerprint_code: String(log.deviceUserId || log.userSn || log.uid || log.userId || log.pin || log.id || "").trim(),
        timestamp: log.recordTime instanceof Date ? log.recordTime.toISOString() : new Date(log.recordTime).toISOString(),
        type: 'check_in'
      }))
      .filter((rec: any) => new Date(rec.timestamp).getTime() > maxTs);`;

srvContent = srvContent.replace(srvTarget, srvReplacement);
fs.writeFileSync(srvFile, srvContent);
console.log("Service Patched.");

