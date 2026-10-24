import { pool } from "./server-db.js";

async function main() {
  const empId = 238; // Employee ID from the image (سعيد محمد جودة - 238)
  
  const res = await pool.query(`
    SELECT * FROM fingerprint_logs 
    WHERE employee_id = $1 
    ORDER BY timestamp DESC
    LIMIT 20
  `, [empId]);
  
  console.log("Fingerprint logs:", res.rows);
  
  const res2 = await pool.query(`
    SELECT COUNT(*) FROM fingerprint_logs 
    WHERE timestamp >= '2026-07-01' AND timestamp < '2026-09-01'
  `);
  
  console.log("Total logs in July and August:", res2.rows[0]);
  
  await pool.end();
}
main();
