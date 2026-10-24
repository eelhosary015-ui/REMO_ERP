import { ERPEventBus } from "../../../server-erp-core.js";

export function initSystemEvents() {
  const eventBus = ERPEventBus.getInstance();

  eventBus.on("SettingUpdated", (data: any) => {
    console.log(`[System Event] Setting update event received: ${data.key} = ${data.value}`);
  });
}
