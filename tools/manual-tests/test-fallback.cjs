const fs = require('fs');

// Read server-db.ts to check dbState structure
const content = fs.readFileSync('server-db.ts', 'utf8');

// Let's test the regex against the actual SQL queries
const batchLogsSql = `INSERT INTO fingerprint_logs (device_id, fingerprint_code, timestamp, type, employee_id) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`;
const normalizedBatch = batchLogsSql.replace(/\s+/g, " ").trim();
const matchBatch = normalizedBatch.match(/insert\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
console.log("Match batch logs:", matchBatch ? "Matched!" : "FAILED!");

const attSql = `INSERT INTO attendance (employee_id, date, check_in, check_out, work_hours, status)
            VALUES (
              $1, $2::date,
              $3::timestamp,
              $4::timestamp,
              CASE
                WHEN $3::timestamp IS NOT NULL AND $4::timestamp IS NOT NULL THEN
                  EXTRACT(EPOCH FROM (
                    ($4::timestamp - $3::timestamp) +
                    (CASE WHEN $4::timestamp < $3::timestamp THEN interval '24 hours' ELSE interval '0 hours' END)
                  )) / 3600.0
                ELSE 0
              END,
              'present'
            )
            ON CONFLICT(employee_id, date) DO UPDATE SET
              check_in = LEAST(EXCLUDED.check_in, attendance.check_in)`;
const normalizedAtt = attSql.replace(/\s+/g, " ").trim();
const matchAtt = normalizedAtt.match(/insert\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
console.log("Match attendance insert:", matchAtt ? "Matched! (Group 3: " + matchAtt[3] + ")" : "FAILED!");
