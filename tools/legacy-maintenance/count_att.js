const fs = require('fs');
const db = JSON.parse(fs.readFileSync('backups/offline-db.json', 'utf8'));
console.log(db.attendance ? db.attendance.length : 0);
