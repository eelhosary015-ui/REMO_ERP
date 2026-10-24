import { Request, Response } from "express";
import { PurchaseService } from "../services/purchase.service.js";
import { validateCreatePurchase } from "../validators/purchase.validator.js";

export class PurchaseController {
  private service: PurchaseService;

  constructor() {
    this.service = new PurchaseService();
  }

  getPurchases = async (req: Request, res: Response): Promise<void> => {
    try {
      const purchases = await this.service.getPurchases();
      res.status(200).json({ success: true, data: purchases });
    } catch (err: any) {
      console.error("Controller Error in getPurchases:", err);
      res.status(500).json({ error: err.message || "Failed to fetch purchases" });
    }
  };

  getPurchaseDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid purchase ID" });
        return;
      }
      const purchase = await this.service.getPurchaseDetails(id);
      if (!purchase) {
        res.status(404).json({ error: "Purchase not found" });
        return;
      }
      res.status(200).json({ success: true, data: purchase });
    } catch (err: any) {
      console.error("Controller Error in getPurchaseDetails:", err);
      res.status(500).json({ error: err.message || "Failed to fetch purchase details" });
    }
  };

  createPurchase = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreatePurchase(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const purchase = await this.service.createPurchase(value);
      res.status(201).json({ success: true, data: purchase });
    } catch (err: any) {
      console.error("Controller Error in createPurchase:", err);
      res.status(500).json({ error: err.message || "Failed to record purchase" });
    }
  };
}
