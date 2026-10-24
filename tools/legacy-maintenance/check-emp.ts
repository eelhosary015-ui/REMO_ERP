import { pool } from "./server-db.js";

async function main() {
  const empId = 4;
  const resAtt = await pool.query(`SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC LIMIT 10`, [empId]);
  console.log("Attendance:", resAtt.rows);
  await pool.end();
}
main();
