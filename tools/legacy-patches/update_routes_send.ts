import fs from 'fs';

let content = fs.readFileSync('modules/hr/hr_api.routes.ts', 'utf-8');

const replacement = `
    // Check Config for Automated Sending
    let isAutomated = false;
    let automatedSendError = null;
    try {
      const resConfig = await pool.query("SELECT value FROM system_settings WHERE key = 'hr_whatsapp_config'");
      if (resConfig.rows.length > 0 && resConfig.rows[0].value) {
        const config = JSON.parse(resConfig.rows[0].value);
        if (config.provider && config.provider !== "direct_link") {
          isAutomated = true;
          // Trigger actual Baileys sending for all valid recipients
          const status = getWhatsAppStatus();
          if (status.status === 'connected') {
             for (const recipient of recipients) {
               if (recipient.is_valid_phone) {
                 try {
                   await sendWhatsAppMessage(recipient.clean_phone, recipient.personalized_message);
                   // delay a bit to prevent rate limiting
                   await new Promise(r => setTimeout(r, 1500));
                 } catch(sendErr) {
                   console.error("Failed to send to", recipient.clean_phone, sendErr);
                 }
               }
             }
          } else {
             automatedSendError = "بوابة الواتساب غير متصلة. يرجى مسح الباركود للاتصال.";
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (automatedSendError) {
      return res.status(400).json({ error: automatedSendError });
    }

    res.json({
`;

content = content.replace(`    // Check Config for Automated Sending
    let isAutomated = false;
    try {
      const resConfig = await pool.query("SELECT value FROM system_settings WHERE key = 'hr_whatsapp_config'");
      if (resConfig.rows.length > 0 && resConfig.rows[0].value) {
        const config = JSON.parse(resConfig.rows[0].value);
        if (config.provider && config.provider !== "direct_link") {
          isAutomated = true;
        }
      }
    } catch (e) {}

    res.json({`, replacement);

fs.writeFileSync('modules/hr/hr_api.routes.ts', content);
