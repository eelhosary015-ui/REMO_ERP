import { Request, Response } from "express";
import { SalesOrderService } from "../services/sales_order.service.js";
import { validateSalesOrder } from "../validators/sales_order.validator.js";

export class SalesOrderController {
  private service: SalesOrderService;

  constructor() {
    this.service = new SalesOrderService();
  }

  getSalesOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await this.service.getSalesOrders();
      res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      console.error("Controller Error in getSalesOrders:", err);
      res.status(500).json({ error: err.message || "Failed to fetch sales orders" });
    }
  };

  createSalesOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateSalesOrder(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const order = await this.service.createSalesOrder(value);
      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      console.error("Controller Error in createSalesOrder:", err);
      res.status(500).json({ error: err.message || "Failed to save sales order" });
    }
  };

  updateSalesOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid sales order ID" });
        return;
      }

      const { error, value } = validateSalesOrder(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const order = await this.service.updateSalesOrder(id, value);
      res.status(200).json({ success: true, data: order });
    } catch (err: any) {
      console.error("Controller Error in updateSalesOrder:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to update sales order" });
    }
  };

  deleteSalesOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid sales order ID" });
        return;
      }
      await this.service.deleteSalesOrder(id);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Controller Error in deleteSalesOrder:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to delete sales order" });
    }
  };

  confirmAndDeliverOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid sales order ID" });
        return;
      }

      const result = await this.service.confirmAndDeliverOrder(id, req.body);
      res.status(200).json(result);
    } catch (err: any) {
      console.error("Controller Error in confirmAndDeliverOrder:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to confirm and deliver sales order" });
    }
  };
}
