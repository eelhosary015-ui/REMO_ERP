import { ERPEventBus } from "../../../server-erp-core.js";

export function initRecipeEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("RecipeCreated", (data: any) => {
    console.log(`[Recipes Event] Recipe Bill of Materials registered: product ID #${data.productId} - Name: ${data.name}`);
  });
}
