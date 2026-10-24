import { Request, Response } from "express";
import { QuotationService } from "../services/quotation.service.js";
import { validateQuotation } from "../validators/quotation.validator.js";

export class QuotationController {
  private service: QuotationService;

  constructor() {
    this.service = new QuotationService();
  }

  getQuotations = async (req: Request, res: Response): Promise<void> => {
    try {
      const quotations = await this.service.getQuotations();
      res.status(200).json({ success: true, data: quotations });
    } catch (err: any) {
      console.error("Controller Error in getQuotations:", err);
      res.status(500).json({ error: err.message || "Failed to fetch quotations" });
    }
  };

  createQuotation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateQuotation(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const quotation = await this.service.createQuotation(value);
      res.status(201).json({ success: true, data: quotation });
    } catch (err: any) {
      console.error("Controller Error in createQuotation:", err);
      res.status(500).json({ error: err.message || "Failed to save quotation" });
    }
  };

  updateQuotation = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid quotation ID" });
        return;
      }

      const { error, value } = validateQuotation(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const quotation = await this.service.updateQuotation(id, value);
      res.status(200).json({ success: true, data: quotation });
    } catch (err: any) {
      console.error("Controller Error in updateQuotation:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to update quotation" });
    }
  };

  deleteQuotation = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid quotation ID" });
        return;
      }
      await this.service.deleteQuotation(id);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Controller Error in deleteQuotation:", err);
      res.status(err.statusCode || 500).json({ error: err.message || "Failed to delete quotation" });
    }
  };
}
