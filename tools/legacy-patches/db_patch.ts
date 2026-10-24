import { pool } from "./server-db.js";

async function runPatch() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_ratings (
        id SERIAL PRIMARY KEY,
        branch_id INT NOT NULL,
        table_number INT,
        rating INT NOT NULL,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("customer_ratings table created");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runPatch();
