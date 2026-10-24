import { Request, Response } from "express";
import { KitchenService } from "../services/kitchen.service.js";
import { validateUpdateKitchenItemStatus } from "../validators/kitchen.validator.js";

export class KitchenController {
  private service: KitchenService;

  constructor() {
    this.service = new KitchenService();
  }

  getActiveOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await this.service.getActiveOrders();
      res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch kitchen orders" });
    }
  };

  updateItemStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateUpdateKitchenItemStatus(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const item = await this.service.updateItemStatus(value);
      res.status(200).json({ success: true, data: item });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update item status" });
    }
  };
}
