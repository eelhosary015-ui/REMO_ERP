import { Request, Response } from "express";
import { DeliveryService } from "../services/delivery.service.js";

export class DeliveryController {
  private service: DeliveryService;

  constructor() {
    this.service = new DeliveryService();
  }

  getDeliveries = async (req: Request, res: Response): Promise<void> => {
    try {
      const deliveries = await this.service.getDeliveries();
      res.json(deliveries);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch deliveries" });
    }
  };

  getDeliveryById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const delivery = await this.service.getDeliveryById(id);
      res.json(delivery);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to fetch delivery note" });
    }
  };

  createDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const delivery = await this.service.createDelivery(req.body);
      res.status(201).json(delivery);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to create delivery note" });
    }
  };

  updateDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const delivery = await this.service.updateDelivery(id, req.body);
      res.json(delivery);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to update delivery note" });
    }
  };

  deleteDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await this.service.deleteDelivery(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to delete delivery note" });
    }
  };

  confirmAndDispatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const postedBy = req.body?.postedBy || req.body?.salesRep || "sales_module";
      const delivery = await this.service.confirmAndDispatchDelivery(id, postedBy);
      res.json({
        success: true,
        data: delivery,
        message: "تم اعتماد إذن التسليم وصرف البضاعة من المخزن وترحيل القيد المحاسبي بنجاح"
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to confirm and dispatch delivery note" });
    }
  };
}
