const fs = require('fs');
let c = fs.readFileSync('modules/hr/hr_api.routes.ts', 'utf8');

c = c.replace(/INSERT INTO fingerprint_devices \(name, ip_address, port, branch_id, device_type, protocol, username, password\)\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8\)/, 
  "INSERT INTO fingerprint_devices (name, ip_address, port, branch_id, device_type, protocol, username, password, timezone_shift) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0))");
c = c.replace(/\[name, ip_address, port, branch_id, device_type, protocol, username, password\]/, 
  "[name, ip_address, port, branch_id, device_type, protocol, username, password, req.body.timezone_shift || 0]");

c = c.replace(/UPDATE fingerprint_devices SET name = \$1, ip_address = \$2, port = \$3, branch_id = \$4, is_active = \$5, device_type = \$6, protocol = \$7, username = \$8, password = \$9 WHERE id = \$10/, 
  "UPDATE fingerprint_devices SET name = $1, ip_address = $2, port = $3, branch_id = $4, is_active = $5, device_type = $6, protocol = $7, username = $8, password = $9, timezone_shift = COALESCE($11, 0) WHERE id = $10");
c = c.replace(/\[name, ip_address, port, branch_id, is_active, device_type, protocol, username, password, id\]/, 
  "[name, ip_address, port, branch_id, is_active, device_type, protocol, username, password, id, req.body.timezone_shift || 0]");

fs.writeFileSync('modules/hr/hr_api.routes.ts', c);
