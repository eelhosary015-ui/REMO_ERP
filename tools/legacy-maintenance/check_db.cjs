
const pg = require('pg');
const { Pool } = pg;
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function checkDb() {
  console.log("Testing connection to:", process.env.DATABASE_URL);
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("[SUCCESS] Database connected at:", res.rows[0].now);
    
    const userRes = await pool.query("SELECT username FROM users WHERE role = 'admin' LIMIT 1");
    if (userRes.rows.length > 0) {
      console.log("[SUCCESS] Found admin user:", userRes.rows[0].username);
    } else {
      console.log("[WARNING] No users found in database. Tables might be empty.");
    }
  } catch (err) {
    console.error("\n" + "!".repeat(50));
    console.error(" [ERROR] Connection Failed!");
    console.error(" Code:", err.code);
    console.error(" Message:", err.message);
    if (err.code === 'ECONNREFUSED') {
       console.error("\n [HINT] PostgreSQL server is not running on localhost:5432");
       console.error(" [تنبيه] خادم قاعدة البيانات لا يعمل على جهازك الحالي.");
    }
    console.error("!".repeat(50) + "\n");
  } finally {
    await pool.end();
  }
}

checkDb();
