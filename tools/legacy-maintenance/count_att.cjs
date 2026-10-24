const fs = require('fs');
const db = JSON.parse(fs.readFileSync('backups/offline-db.json', 'utf8'));
console.log("attendance length:", db.attendance ? db.attendance.length : 0);
console.log("employees:", db.employees ? db.employees.map(e => e.name) : []);
