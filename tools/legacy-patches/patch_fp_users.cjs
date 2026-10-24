const fs = require('fs');
const path = require('path');

const fpServicePath = path.join(process.cwd(), 'modules/fingerprint/services/fingerprint.service.ts');
let content = fs.readFileSync(fpServicePath, 'utf8');

const newMethod = `
  async getDeviceUsers(id: number): Promise<{ success: boolean, users: any[], error?: string }> {
    const deviceResult = await pool.query("SELECT * FROM fingerprint_devices WHERE id = $1", [id]);
    const device = deviceResult.rows[0];
    if (!device) return { success: false, users: [], error: "الجهاز غير موجود" };

    let zkInstance: any;
    try {
      zkInstance = createBiometricClient({
        ip_address: device.ip_address,
        port: device.port || 4370,
        device_type: device.device_type,
        protocol: device.protocol,
        username: device.username,
        password: device.password,
      }, 10000);
      await zkInstance.connect();
    } catch (connectError: any) {
      return { success: false, users: [], error: \`فشل الاتصال: \${connectError.message}\` };
    }

    try {
      // If it's HikVision, it might not support getUsers directly in our adapter yet
      if (typeof zkInstance.getUsers !== 'function') {
        throw new Error("سحب المستخدمين غير مدعوم في هذا النوع من الأجهزة حالياً");
      }
      const users = await zkInstance.getUsers();
      return { success: true, users };
    } catch (fetchError: any) {
      return { success: false, users: [], error: \`فشل سحب المستخدمين: \${fetchError.message}\` };
    } finally {
      try { await zkInstance.disconnect(); } catch (_) {}
    }
  }
`;

if (!content.includes('getDeviceUsers(')) {
  content = content.replace(/async syncAllActiveDevices/g, newMethod + '\n\n  async syncAllActiveDevices');
  fs.writeFileSync(fpServicePath, content);
  console.log("Added getDeviceUsers to fingerprint.service.ts");
} else {
  console.log("getDeviceUsers already exists");
}
