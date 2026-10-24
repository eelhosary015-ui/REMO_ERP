const fs = require('fs');
let content = fs.readFileSync('src/components/AIChatAssistantModal.tsx', 'utf8');

const newLogic = `
      const data = await res.json();
      if (res.ok && data.success) {
        let reply = data.reply;
        let actionTriggered = false;

        // Check for executeAction JSON block
        const jsonMatch = reply.match(/\\\`\\\`\\\`json\\n([\\s\\S]*?)\\\`\\\`\\\`/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.executeAction) {
              // Trigger the event
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("ai_action", { detail: parsed }));
              }, 500);
              
              // Remove the JSON block from the reply so the user doesn't see it
              reply = reply.replace(jsonMatch[0], "").trim();
              if (!reply) {
                reply = "تم تنفيذ الإجراء المطلوب بنجاح يا فندم! هل هناك شيء آخر؟";
              }
              actionTriggered = true;
            }
          } catch (e) {
            console.error("Failed to parse AI action JSON:", e);
          }
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
`;

content = content.replace(/const data = await res\.json\(\);\s*if \(res\.ok && data\.success\) {[\s\S]*?setMessages\(\(prev\) => \[\.\.\.prev, aiMessage\]\);\s*} else {/, newLogic);
fs.writeFileSync('src/components/AIChatAssistantModal.tsx', content);
