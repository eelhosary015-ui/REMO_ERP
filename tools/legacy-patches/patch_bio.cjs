const fs = require('fs');
const path = require('path');

const bioPath = path.join(process.cwd(), 'modules/fingerprint/services/biometric-client.ts');
let content = fs.readFileSync(bioPath, 'utf8');

// Update interface
content = content.replace(/getAttendances\(\): Promise<BiometricAttendanceRecord\[\]>;/g, "getAttendances(): Promise<BiometricAttendanceRecord[]>;\n  getUsers?(): Promise<any[]>;");

// Update adapter
content = content.replace(/async getAttendances\(\): Promise<BiometricAttendanceRecord\[\]> \{/g, `async getUsers(): Promise<any[]> {
    const raw = await this.client.getUsers();
    return raw || [];
  }

  async getAttendances(): Promise<BiometricAttendanceRecord[]> {`);

fs.writeFileSync(bioPath, content);
console.log("Patched bio client");
