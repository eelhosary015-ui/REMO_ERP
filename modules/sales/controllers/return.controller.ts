import { Request, Response } from "express";
import { ReturnService } from "../services/return.service.js";
import { validateReturn } from "../validators/return.validator.js";

export class ReturnController {
  private service: ReturnService;

  constructor() {
    this.service = new ReturnService();
  }

  getEligibleInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : (req as any).branchScope?.branch_id;
      const includeInvoiceId = req.query.includeInvoiceId ? String(req.query.includeInvoiceId) : undefined;
      const invoices = await this.service.getEligibleInvoices({ branchId, includeInvoiceId });
      res.status(200).json({ success: true, data: invoices });
    } catch (err: any) {
      console.error("Controller Error in getEligibleInvoices:", err);
      res.status(500).json({ error: err.message || "Failed to fetch eligible invoices" });
    }
  };

  getInvoiceReturnDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const invId = req.params.id;
      if (!invId) {
        res.status(400).json({ error: "Invoice ID is required" });
        return;
      }
      const details = await this.service.getInvoiceReturnDetails(invId);
      res.status(200).json({ success: true, data: details });
    } catch (err: any) {
      console.error("Controller Error in getInvoiceReturnDetails:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to fetch invoice return details" });
    }
  };

  getReturnById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid return ID" });
        return;
      }
      const returnDoc = await this.service.getReturnById(id);
      res.status(200).json({ success: true, data: returnDoc });
    } catch (err: any) {
      console.error("Controller Error in getReturnById:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to fetch return" });
    }
  };

  getReturns = async (req: Request, res: Response): Promise<void> => {
    try {
      const returns = await this.service.getReturns();
      res.status(200).json({ success: true, data: returns });
    } catch (err: any) {
      console.error("Controller Error in getReturns:", err);
      res.status(500).json({ error: err.message || "Failed to fetch returns" });
    }
  };

  createReturn = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateReturn(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const returnDoc = await this.service.createReturn(value);
      res.status(201).json({ success: true, data: returnDoc });
    } catch (err: any) {
      console.error("Controller Error in createReturn:", err);
      res.status(500).json({ error: err.message || "Failed to save return" });
    }
  };

  updateReturn = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid return ID" });
        return;
      }

      const { error, value } = validateReturn(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const returnDoc = await this.service.updateReturn(id, value);
      res.status(200).json({ success: true, data: returnDoc });
    } catch (err: any) {
      console.error("Controller Error in updateReturn:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to update return" });
    }
  };

  deleteReturn = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid return ID" });
        return;
      }
      await this.service.deleteReturn(id);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Controller Error in deleteReturn:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to delete return" });
    }
  };
}
