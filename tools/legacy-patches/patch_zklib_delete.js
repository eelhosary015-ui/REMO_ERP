import fs from 'fs';

let content = fs.readFileSync('modules/hr/hr_api.routes.ts', 'utf-8');

const target1 = `            try {
              if (typeof zkInstance.disableUser === "function") {
                await zkInstance.disableUser(fpCode);
              } else if (typeof zkInstance.deleteUser === "function") {
                await zkInstance.deleteUser(fpCode);
              } else if (typeof zkInstance.setUser === "function") {
                await zkInstance.setUser({
                  uid: parseInt(fpCode, 10) || emp.id,
                  userid: String(fpCode),
                  name: emp.name,
                  role: 0,
                  password: "",
                  enabled: false
                });
              }
            } catch (err) {
              console.error(\`Failed to disable user \${fpCode} on device \${dev.ip_address}\`);
            }`;

const replacement1 = `            try {
              if (typeof zkInstance.executeCmd === "function") {
                const uid = parseInt(fpCode, 10) || emp.id;
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(uid, 0);
                // CMD_DELETE_USER is 18
                await zkInstance.executeCmd(18, buf);
              }
            } catch (err) {
              console.error(\`Failed to delete user \${fpCode} from device \${dev.ip_address}\`);
            }`;

content = content.replace(target1, replacement1);


const target2 = `          if (action === "disable") {
            try {
              if (typeof zkInstance.disableUser === "function") {
                await zkInstance.disableUser(fpCode);
                devResponse = "تم تعطيل الموظف على الجهاز بنجاح (disableUser)";
                devSuccess = true;
              } else if (typeof zkInstance.deleteUser === "function") {
                await zkInstance.deleteUser(fpCode);
                devResponse = "تم حذف/تعطيل الموظف من أجهزة البصمة بنجاح (deleteUser)";
                devSuccess = true;
              } else if (typeof zkInstance.setUser === "function") {
                await zkInstance.setUser({
                  uid: parseInt(fpCode, 10) || emp.id,
                  userid: String(fpCode),
                  name: emp.name,
                  role: 0,
                  password: "",
                  enabled: false
                });
                devResponse = "تم تحديث حالة الموظف إلى معطل (setUser)";
                devSuccess = true;
              } else {
                devResponse = "تم إرسال أمر التعطيل للجهاز بنجاح";
                devSuccess = true;
              }
            } catch (sdkErr: any) {
              errorDetails = sdkErr?.message || String(sdkErr);
              devResponse = "فشل تنفيذ أمر تعطيل البصمة على الجهاز";
              devSuccess = false;
            }
          } else { // enable`;

const replacement2 = `          if (action === "disable") {
            try {
              if (typeof zkInstance.executeCmd === "function") {
                const uid = parseInt(fpCode, 10) || emp.id;
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(uid, 0);
                await zkInstance.executeCmd(18, buf);
                devResponse = "تم حذف بصمة الموظف بنجاح من الجهاز (إيقاف تام)";
                devSuccess = true;
              } else {
                devResponse = "تم إرسال أمر التعطيل للجهاز بنجاح";
                devSuccess = true;
              }
            } catch (sdkErr: any) {
              errorDetails = sdkErr?.message || String(sdkErr);
              devResponse = "فشل تنفيذ أمر تعطيل البصمة على الجهاز";
              devSuccess = false;
            }
          } else { // enable`;

content = content.replace(target2, replacement2);

fs.writeFileSync('modules/hr/hr_api.routes.ts', content);
