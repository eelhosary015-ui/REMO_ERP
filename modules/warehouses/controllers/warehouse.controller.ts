import { Request, Response } from "express";
import { WarehouseService } from "../services/warehouse.service.js";
import { validateCreateWarehouse, validateAdjustStock } from "../validators/warehouse.validator.js";

export class WarehouseController {
  private service: WarehouseService;

  constructor() {
    this.service = new WarehouseService();
  }

  getWarehouses = async (req: Request, res: Response): Promise<void> => {
    try {
      const warehouses = await this.service.getWarehouses();
      res.status(200).json({ success: true, data: warehouses });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch warehouses" });
    }
  };

  createWarehouse = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateWarehouse(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const warehouse = await this.service.createWarehouse(value);
      res.status(201).json({ success: true, data: warehouse });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create warehouse" });
    }
  };

  getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const warehouseId = parseInt(req.params.id);
      if (isNaN(warehouseId)) {
        res.status(400).json({ error: "Invalid warehouse ID" });
        return;
      }
      const inventory = await this.service.getInventory(warehouseId);
      res.status(200).json({ success: true, data: inventory });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch inventory items" });
    }
  };

  adjustStock = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateAdjustStock(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      await this.service.adjustStock(value);
      res.status(200).json({ success: true, message: "Inventory adjusted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to adjust stock balance" });
    }
  };
}
