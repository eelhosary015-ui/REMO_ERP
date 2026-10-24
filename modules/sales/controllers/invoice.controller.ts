import { Request, Response } from "express";
import { InvoiceService } from "../services/invoice.service.js";
import { validateInvoice, validateInvoicePayment } from "../validators/invoice.validator.js";

export class InvoiceController {
  private service: InvoiceService;

  constructor() {
    this.service = new InvoiceService();
  }

  getInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoices = await this.service.getInvoices();
      res.status(200).json({ success: true, data: invoices });
    } catch (err: any) {
      console.error("Controller Error in getInvoices:", err);
      res.status(500).json({ error: err.message || "Failed to fetch invoices" });
    }
  };

  getInvoiceById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid invoice ID" });
        return;
      }
      const invoice = await this.service.getInvoiceById(id);
      res.status(200).json({ success: true, data: invoice });
    } catch (err: any) {
      console.error("Controller Error in getInvoiceById:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to fetch invoice" });
    }
  };

  createInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateInvoice(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const invoice = await this.service.createInvoice(value);
      res.status(201).json({ success: true, data: invoice });
    } catch (err: any) {
      console.error("Controller Error in createInvoice:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to save invoice" });
    }
  };

  postInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid invoice ID" });
        return;
      }

      const postedBy = req.body?.postedBy || req.body?.salesRep || "نظام المبيعات";
      const invoice = await this.service.postInvoice(id, postedBy);
      res.status(200).json({ success: true, data: invoice });
    } catch (err: any) {
      console.error("Controller Error in postInvoice:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to post invoice" });
    }
  };

  cancelInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid invoice ID" });
        return;
      }

      const invoice = await this.service.cancelInvoice(id);
      res.status(200).json({ success: true, data: invoice });
    } catch (err: any) {
      console.error("Controller Error in cancelInvoice:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to cancel invoice" });
    }
  };

  updateInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid invoice ID" });
        return;
      }

      const { error, value } = validateInvoice(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const invoice = await this.service.updateInvoice(id, value);
      res.status(200).json({ success: true, data: invoice });
    } catch (err: any) {
      console.error("Controller Error in updateInvoice:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to update invoice" });
    }
  };

  deleteInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid invoice ID" });
        return;
      }
      await this.service.deleteInvoice(id);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Controller Error in deleteInvoice:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to delete invoice" });
    }
  };

  recordPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid invoice ID" });
        return;
      }

      const { error, value } = validateInvoicePayment(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const updated = await this.service.recordPayment(id, value);
      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      console.error("Controller Error in recordPayment:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to record payment" });
    }
  };
}
