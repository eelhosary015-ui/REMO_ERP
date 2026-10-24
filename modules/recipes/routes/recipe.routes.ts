import { Router } from "express";
import { RecipeController } from "../controllers/recipe.controller.js";

const router = Router();
const controller = new RecipeController();

router.get("/", controller.getRecipes);
router.post("/", controller.createRecipe);

export default router;
