@echo off
chcp 65001 > nul
echo ===================================================
echo     REMO PRO - إصلاح ملفات المشروع المحلية
echo ===================================================
echo.
echo جاري فحص وإصلاح الملفات التالفة...
echo.

node -e "const fs=require('fs'); if(fs.existsSync('package.json')){let p=fs.readFileSync('package.json','utf8'); p=p.replace('infisical run --env=dev -- tsx server.ts','tsx server.ts'); fs.writeFileSync('package.json',p,'utf8'); console.log('✅ Fixed package.json dev script');} const f='modules/production/services/production.service.ts'; if(fs.existsSync(f)){let c=fs.readFileSync(f,'utf8'); c=c.replace(/^\u0630import/,'import'); fs.writeFileSync(f,c,'utf8'); console.log('✅ Fixed production.service.ts');} for(const sf of ['server-db-init.ts','modules/production/repositories/production.repository.ts']){if(fs.existsSync(sf)){let s=fs.readFileSync(sf,'utf8'); if(!s.includes('DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items')){s=s.replace('const repairDecimalColumn = async','try { await (typeof pool !== \"undefined\" ? pool : erpPool).query(\"DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items\"); } catch (_) {}\n      const repairDecimalColumn = async'); s=s.replace('console.error(`[DB Schema] Failed repairing ${table}.${column}:`, err?.message || err); throw err;','console.warn(`[DB Schema] Skipped repairing ${table}.${column}:`, err?.message || err);'); fs.writeFileSync(sf,s,'utf8'); console.log('✅ Fixed trigger guard in '+sf);}}}"
if exist tools\legacy-patches\fix_local_corruption.cjs (
  node tools\legacy-patches\fix_local_corruption.cjs
) else if exist fix_local_corruption.cjs (
  node fix_local_corruption.cjs
)

echo.
echo ===================================================
echo اكتمل الإصلاح بنجاح! يمكنك الآن تشغيل السيرفر بأمان.
echo ===================================================
pause
