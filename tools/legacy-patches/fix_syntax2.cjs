const fs = require('fs');
let c = fs.readFileSync('src/components/Attendance.tsx', 'utf8');

c = c.replace(/\{\(user\?\.role === "admin" \|\|\n\s*user\?\.permissions\?\.\\["attendance\.import"\\] !== false\) && \(\n\s*\{user\?\.role === "admin" && \(/, '{user?.role === "admin" && (');

// Alternatively, just string replace exactly
const badStr = `          {(user?.role === "admin" ||
            user?.permissions?.["attendance.import"] !== false) && (
                      {user?.role === "admin" && (`
c = c.replace(badStr, '          {user?.role === "admin" && (');

fs.writeFileSync('src/components/Attendance.tsx', c);
