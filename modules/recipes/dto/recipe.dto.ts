export interface RecipeItemDTO {
  ingredient_id: number;
  quantity: number;
  unit?: string;
  notes?: string;
}

export interface CreateRecipeDTO {
  product_id: number;
  name: string;
  items: RecipeItemDTO[];
}
