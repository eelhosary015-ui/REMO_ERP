import { CreateRecipeDTO } from "../dto/recipe.dto.js";

export function validateCreateRecipe(data: any): { error?: string; value?: CreateRecipeDTO } {
  if (!data.product_id || typeof data.product_id !== "number") {
    return { error: "Product ID is required and must be a number" };
  }
  if (!data.name || typeof data.name !== "string") {
    return { error: "Recipe name is required" };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Recipe must contain at least one raw material input item" };
  }
  for (const item of data.items) {
    if (!item.ingredient_id || typeof item.ingredient_id !== "number") {
      return { error: "Each raw input must have a valid ingredient_id" };
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return { error: "Each raw input must have a positive quantitative amount" };
    }
  }
  return { value: data as CreateRecipeDTO };
}
