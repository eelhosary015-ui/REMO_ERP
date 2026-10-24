import { Request, Response } from "express";
import { OrderService } from "../services/order.service.js";
import { validateCreateOrder, validateUpdateOrder } from "../validators/order.validator.js";

export class OrderController {
  private service: OrderService;

  constructor() {
    this.service = new OrderService();
  }

  createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateOrder(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const order = await this.service.placeOrder(value);
      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      console.error("Controller Error in createOrder:", err);
      res.status(500).json({ error: err.message || "Failed to create order" });
    }
  };

  getOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order ID" });
        return;
      }

      const order = await this.service.getOrder(orderId);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      res.status(200).json({ success: true, data: order });
    } catch (err: any) {
      console.error("Controller Error in getOrder:", err);
      res.status(500).json({ error: err.message || "Failed to fetch order" });
    }
  };

  updateOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order ID" });
        return;
      }

      const { error, value } = validateUpdateOrder(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const updated = await this.service.updateOrderStatus(orderId, value);
      if (!updated) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      console.error("Controller Error in updateOrder:", err);
      res.status(500).json({ error: err.message || "Failed to update order" });
    }
  };
}
