import { Router } from "express";
import { pool } from "../server-db.js";
import { authenticateToken } from "./system/system_api.routes.js";

const router = Router();

router.get("/api/realestate/properties", authenticateToken, async (_req:any,res:any)=>{
  try { const r=await pool.query(`SELECT * FROM real_estate_properties ORDER BY id DESC`); res.json(r.rows); }
  catch(e){ console.error(e); res.status(500).json({error:"تعذر تحميل العقارات"}); }
});
router.post("/api/realestate/properties", authenticateToken, async (req:any,res:any)=>{
  try { const p=req.body||{}; const r=await pool.query(`INSERT INTO real_estate_properties (name,property_type,address,branch_id,owner_name,status,monthly_rent,purchase_value,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[p.name,p.property_type||'building',p.address||'',p.branch_id||null,p.owner_name||'',p.status||'active',Number(p.monthly_rent||0),Number(p.purchase_value||0),p.notes||'']); res.json(r.rows[0]); }
  catch(e){ console.error(e); res.status(500).json({error:"تعذر إضافة العقار"}); }
});
router.put("/api/realestate/properties/:id", authenticateToken, async (req:any,res:any)=>{
  try { const p=req.body||{}; const r=await pool.query(`UPDATE real_estate_properties SET name=$1,property_type=$2,address=$3,branch_id=$4,owner_name=$5,status=$6,monthly_rent=$7,purchase_value=$8,notes=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,[p.name,p.property_type||'building',p.address||'',p.branch_id||null,p.owner_name||'',p.status||'active',Number(p.monthly_rent||0),Number(p.purchase_value||0),p.notes||'',req.params.id]); if(!r.rows[0]) return res.status(404).json({error:'العقار غير موجود'}); res.json(r.rows[0]); }
  catch(e){ console.error(e); res.status(500).json({error:"تعذر تعديل العقار"}); }
});
router.delete("/api/realestate/properties/:id", authenticateToken, async (req:any,res:any)=>{
  try { await pool.query(`DELETE FROM real_estate_properties WHERE id=$1`,[req.params.id]); res.json({ok:true}); }
  catch(e){ console.error(e); res.status(500).json({error:"تعذر حذف العقار"}); }
});
router.get("/api/realestate/settings", authenticateToken, async (_req:any,res:any)=>{
  try { const r=await pool.query(`SELECT key,value FROM real_estate_settings ORDER BY key`); const out:any={}; r.rows.forEach((x:any)=>out[x.key]=x.value); res.json(out); }
  catch(e){ res.status(500).json({error:"تعذر تحميل الإعدادات"}); }
});
router.put("/api/realestate/settings", authenticateToken, async (req:any,res:any)=>{
  try { for(const [key,value] of Object.entries(req.body||{})){ await pool.query(`INSERT INTO real_estate_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[key,String(value)]); } res.json({ok:true}); }
  catch(e){ res.status(500).json({error:"تعذر حفظ الإعدادات"}); }
});
router.get("/api/realestate/reports", authenticateToken, async (_req:any,res:any)=>{
  try { const [s,v,r]=await Promise.all([
    pool.query(`SELECT COUNT(*)::int count, COALESCE(SUM(purchase_value),0)::float purchase_value, COALESCE(SUM(monthly_rent),0)::float monthly_rent FROM real_estate_properties WHERE status='active'`),
    pool.query(`SELECT status,COUNT(*)::int count FROM real_estate_properties GROUP BY status ORDER BY status`),
    pool.query(`SELECT property_type,COUNT(*)::int count,COALESCE(SUM(purchase_value),0)::float value FROM real_estate_properties GROUP BY property_type ORDER BY property_type`)
  ]); res.json({summary:s.rows[0],by_status:v.rows,by_type:r.rows}); }
  catch(e){ res.status(500).json({error:"تعذر تحميل تقارير العقارات"}); }
});

export default router;
