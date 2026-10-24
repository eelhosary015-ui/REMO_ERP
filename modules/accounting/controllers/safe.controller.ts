import { Request, Response } from "express";
import { SafeService } from "../services/safe.service.js";
import { validateCreateSafe, validateAdjustBalance } from "../validators/safe.validator.js";

export class SafeController {
  private service: SafeService;

  constructor() {
    this.service = new SafeService();
  }

  getSafes = async (req: Request, res: Response): Promise<void> => {
    try {
      const safes = await this.service.getSafes();
      res.status(200).json({ success: true, data: safes });
    } catch (err: any) {
      console.error("Controller Error in getSafes:", err);
      res.status(500).json({ error: err.message || "Failed to fetch safes" });
    }
  };

  createSafe = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateSafe(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const safe = await this.service.createSafe(value);
      res.status(201).json({ success: true, data: safe });
    } catch (err: any) {
      console.error("Controller Error in createSafe:", err);
      res.status(500).json({ error: err.message || "Failed to create safe" });
    }
  };

  adjustBalance = async (req: Request, res: Response): Promise<void> => {
    try {
      const safeId = parseInt(req.params.id);
      if (isNaN(safeId)) {
        res.status(400).json({ error: "Invalid safe ID" });
        return;
      }

      const { error, value } = validateAdjustBalance(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const transaction = await this.service.adjustSafeBalance(safeId, value);
      res.status(200).json({ success: true, data: transaction });
    } catch (err: any) {
      console.error("Controller Error in adjustBalance:", err);
      res.status(500).json({ error: err.message || "Failed to adjust safe balance" });
    }
  };
}
