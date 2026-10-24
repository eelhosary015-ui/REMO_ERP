import { pool } from "./server-db.js";
async function main() {
  const atts = await pool.query("SELECT * FROM attendance WHERE employee_id = 5 ORDER BY date DESC LIMIT 10");
  console.log("Att for Emp 5:", atts.rows);
  await pool.end();
}
main();
