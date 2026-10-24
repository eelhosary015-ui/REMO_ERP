import { ERPEventBus } from "../../../server-erp-core.js";

export function initSecurityEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("SecurityPermissionsUpdated2", (data: any) => {
    console.log(`[Security Event] Security boundaries adjusted! Target user ID: ${data.targetUserId} by operator ID: ${data.operatorId}`);
  });
}
