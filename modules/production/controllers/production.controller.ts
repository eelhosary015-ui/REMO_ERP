import { Request, Response } from "express";
import { ProductionService } from "../services/production.service.js";
import { validateCreateProductionRun } from "../validators/production.validator.js";

export class ProductionController {
  private service: ProductionService;

  constructor() {
    this.service = new ProductionService();
  }

  getProductionRuns = async (req: Request, res: Response): Promise<void> => {
    try {
      const runs = await this.service.getProductionRuns();
      res.status(200).json({ success: true, data: runs });
    } catch (err: any) {
      console.error("Controller Error in getProductionRuns:", err);
      res.status(500).json({ error: err.message || "Failed to fetch production runs" });
    }
  };

  createProductionRun = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateProductionRun(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const run = await this.service.recordProductionRun(value);
      res.status(201).json({ success: true, data: run });
    } catch (err: any) {
      console.error("Controller Error in createProductionRun:", err);
      res.status(500).json({ error: err.message || "Failed to record production run" });
    }
  };

  getOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await this.service.getOrders();
      res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      console.error("Controller Error in getOrders:", err);
      res.status(500).json({ error: err.message || "Failed to fetch orders" });
    }
  };

  getSharedProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const products = await this.service.getSharedProducts();
      res.status(200).json({ success: true, data: products, products });
    } catch (err: any) {
      console.error("Controller Error in getSharedProducts:", err);
      res.status(500).json({ error: err.message || "Failed to fetch shared products" });
    }
  };

  saveOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const saved = await this.service.saveOrder(req.body);
      res.status(200).json({ success: true, data: saved });
    } catch (err: any) {
      console.error("Controller Error in saveOrder:", err);
      res.status(500).json({ error: err.message || "Failed to save order" });
    }
  };

  checkAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = (req.query.productId as string) || (req.body?.productId as string);
      const bomId = (req.query.bomId as string) || (req.body?.bomId as string);
      const quantity = parseFloat((req.query.quantity as string) || (req.body?.quantity as string) || "1");
      const rawWarehouseId = parseInt((req.query.rawWarehouseId as string) || (req.body?.rawWarehouseId as string) || "1", 10);

      if (!productId) {
        res.status(400).json({ error: "productId is required" });
        return;
      }

      const result = await this.service.checkAvailability(productId, bomId, quantity, rawWarehouseId);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error("Controller Error in checkAvailability:", err);
      res.status(500).json({ error: err.message || "Failed to check stock availability" });
    }
  };

  executeOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = req.params.id || req.body?.orderId;
      const {
        orderNumber,
        rawWarehouseId,
        finishedWarehouseId,
        allowNegativeStock,
        user,
        notes
      } = req.body;

      if (!rawWarehouseId || !finishedWarehouseId) {
        res.status(400).json({ error: "rawWarehouseId and finishedWarehouseId are required" });
        return;
      }

      const result = await this.service.executeOrder({
        orderId,
        orderNumber,
        productId: req.body?.productId,
        productName: req.body?.productName,
        quantity: req.body?.quantity ? Number(req.body.quantity) : undefined,
        rawWarehouseId: Number(rawWarehouseId),
        finishedWarehouseId: Number(finishedWarehouseId),
        allowNegativeStock: allowNegativeStock === true || String(allowNegativeStock).toLowerCase() === "true",
        user: user || (req as any).user?.username || (req as any).user?.name || "مسؤول الإنتاج",
        notes
      });

      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error("Controller Error in executeOrder:", err);
      res.status(400).json({ error: err.message || "Failed to execute production order" });
    }
  };

  getBOMs = async (req: Request, res: Response): Promise<void> => {
    try {
      const boms = await this.service.getBOMs();
      res.status(200).json({ success: true, data: boms });
    } catch (err: any) {
      console.error("Controller Error in getBOMs:", err);
      res.status(500).json({ error: err.message || "Failed to fetch BOMs" });
    }
  };

  saveBOM = async (req: Request, res: Response): Promise<void> => {
    try {
      const saved = await this.service.saveBOM(req.body);
      res.status(200).json({ success: true, data: saved });
    } catch (err: any) {
      console.error("Controller Error in saveBOM:", err);
      res.status(500).json({ error: err.message || "Failed to save BOM" });
    }
  };

  deleteOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const success = await this.service.deleteOrder(id);
      res.status(200).json({ success });
    } catch (err: any) {
      console.error("Controller Error in deleteOrder:", err);
      res.status(500).json({ error: err.message || "Failed to delete order" });
    }
  };

  clearOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const success = await this.service.clearOrders();
      res.status(200).json({ success });
    } catch (err: any) {
      console.error("Controller Error in clearOrders:", err);
      res.status(500).json({ error: err.message || "Failed to clear orders" });
    }
  };

  deleteBOM = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const success = await this.service.deleteBOM(id);
      res.status(200).json({ success });
    } catch (err: any) {
      console.error("Controller Error in deleteBOM:", err);
      res.status(500).json({ error: err.message || "Failed to delete BOM" });
    }
  };

  clearBOMs = async (req: Request, res: Response): Promise<void> => {
    try {
      const success = await this.service.clearBOMs();
      res.status(200).json({ success });
    } catch (err: any) {
      console.error("Controller Error in clearBOMs:", err);
      res.status(500).json({ error: err.message || "Failed to clear BOMs" });
    }
  };
}
