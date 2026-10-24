import { RecipeRepository } from "../repositories/recipe.repository.js";
import { CreateRecipeDTO } from "../dto/recipe.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class RecipeService {
  private repository: RecipeRepository;

  constructor() {
    this.repository = new RecipeRepository();
  }

  async getRecipes(): Promise<any[]> {
    const cached = ERPCache.get("recipes:all");
    if (cached) return cached;

    const recipes = await this.repository.getAll();
    ERPCache.set("recipes:all", recipes, 120);
    return recipes;
  }

  async createRecipe(dto: CreateRecipeDTO): Promise<any[]> {
    const items = await this.repository.create(dto);
    ERPCache.delete("recipes:all");

    ERPEventBus.getInstance().emitEvent("RecipeCreated", {
      productId: dto.product_id,
      name: dto.name,
      timestamp: new Date()
    });

    return items;
  }
}
