import recipeRoutes from "./routes/recipe.routes.js";
import { initRecipeEvents } from "./events/recipe.events.js";
import { initRecipeJobs } from "./jobs/recipe.jobs.js";

export function bootstrapRecipesModule() {
  console.log("⚡ Bootstrapping Recipes Module...");
  initRecipeEvents();
  initRecipeJobs();
}

export { recipeRoutes };
export * from "./dto/recipe.dto.js";
export * from "./validators/recipe.validator.js";
export * from "./services/recipe.service.js";
export * from "./controllers/recipe.controller.js";
