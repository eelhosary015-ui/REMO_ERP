const fs = require('fs');

if (fs.existsSync('local_db.json')) {
  const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));
  console.log("local_db.json keys:", Object.keys(db));
  console.log("devices:", db.fingerprint_devices);
  console.log("employees count:", (db.employees || []).length);
  if (db.employees && db.employees.length > 0) {
    console.log("First 5 employees:", db.employees.slice(0, 5).map(e => ({
      id: e.id,
      name: e.name,
      employee_code: e.employee_code,
      fingerprint_code: e.fingerprint_code,
      fingerprint_status: e.fingerprint_status
    })));
  }
  console.log("fingerprint_logs count:", (db.fingerprint_logs || []).length);
  console.log("attendance count:", (db.attendance || []).length);
  if (db.attendance && db.attendance.length > 0) {
    console.log("First 5 attendance:", db.attendance.slice(0, 5));
  }
} else {
  console.log("local_db.json does not exist");
}
