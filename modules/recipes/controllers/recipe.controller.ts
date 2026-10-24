import { Request, Response } from "express";
import { RecipeService } from "../services/recipe.service.js";
import { validateCreateRecipe } from "../validators/recipe.validator.js";

export class RecipeController {
  private service: RecipeService;

  constructor() {
    this.service = new RecipeService();
  }

  getRecipes = async (req: Request, res: Response): Promise<void> => {
    try {
      const recipes = await this.service.getRecipes();
      res.status(200).json({ success: true, data: recipes });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch recipes" });
    }
  };

  createRecipe = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateRecipe(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const items = await this.service.createRecipe(value);
      res.status(201).json({ success: true, data: items });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create recipe record" });
    }
  };
}
