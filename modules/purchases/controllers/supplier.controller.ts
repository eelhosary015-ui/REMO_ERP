import { Request, Response } from "express";
import { SupplierService } from "../services/supplier.service.js";
import { validateCreateSupplier, validateUpdateSupplier, validateSupplierPayment } from "../validators/supplier.validator.js";

export class SupplierController {
  private service: SupplierService;

  constructor() {
    this.service = new SupplierService();
  }

  getSuppliers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, status, group } = req.query;
      const suppliers = await this.service.getSuppliers({
        search: search as string,
        status: status as string,
        group: group as string
      });
      res.status(200).json({ success: true, data: suppliers });
    } catch (err: any) {
      console.error("Controller Error in getSuppliers:", err);
      res.status(500).json({ error: err.message || "Failed to fetch suppliers" });
    }
  };

  getSupplierById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }
      const supplier = await this.service.getSupplierById(id);
      if (!supplier) {
        res.status(404).json({ error: "Supplier not found" });
        return;
      }
      res.status(200).json({ success: true, data: supplier });
    } catch (err: any) {
      console.error("Controller Error in getSupplierById:", err);
      res.status(500).json({ error: err.message || "Failed to fetch supplier" });
    }
  };

  createSupplier = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateSupplier(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const supplier = await this.service.createSupplier(value);
      res.status(201).json({ success: true, data: supplier });
    } catch (err: any) {
      console.error("Controller Error in createSupplier:", err);
      res.status(500).json({ error: err.message || "Failed to create supplier" });
    }
  };

  updateSupplier = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }

      const { error, value } = validateUpdateSupplier(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const supplier = await this.service.updateSupplier(id, value);
      if (!supplier) {
        res.status(404).json({ error: "Supplier not found" });
        return;
      }
      res.status(200).json({ success: true, data: supplier });
    } catch (err: any) {
      console.error("Controller Error in updateSupplier:", err);
      res.status(500).json({ error: err.message || "Failed to update supplier" });
    }
  };

  deleteSupplier = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }

      try {
        const result = await this.service.deleteSupplier(id);
        if (!result) {
          res.status(404).json({ error: "Supplier not found" });
          return;
        }
        res.status(200).json({ success: true });
      } catch (err: any) {
        if (err.message && err.message.includes("عمليات شراء")) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }
    } catch (err: any) {
      console.error("Controller Error in deleteSupplier:", err);
      res.status(500).json({ error: err.message || "Failed to delete supplier" });
    }
  };

  recordPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.id);
      if (isNaN(supplierId)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }

      const { error, value } = validateSupplierPayment(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const transaction = await this.service.recordPayment(supplierId, value);
      res.status(201).json({ success: true, data: transaction });
    } catch (err: any) {
      console.error("Controller Error in recordPayment:", err);
      res.status(500).json({ error: err.message || "Failed to record payment" });
    }
  };

  getTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.id);
      if (isNaN(supplierId)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }

      const { from, to, type, limit, offset } = req.query;
      const transactions = await this.service.getTransactions(supplierId, {
        from: from as string,
        to: to as string,
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      res.status(200).json({ success: true, data: transactions });
    } catch (err: any) {
      console.error("Controller Error in getTransactions:", err);
      res.status(500).json({ error: err.message || "Failed to fetch transactions" });
    }
  };

  getStatement = async (req: Request, res: Response): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.id);
      if (isNaN(supplierId)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }

      const { from, to } = req.query;
      const statement = await this.service.getSupplierStatement(supplierId, {
        fromDate: from as string,
        toDate: to as string
      });
      res.status(200).json({ success: true, data: statement });
    } catch (err: any) {
      console.error("Controller Error in getStatement:", err);
      res.status(500).json({ error: err.message || "Failed to fetch statement" });
    }
  };

  getSupplierPurchases = async (req: Request, res: Response): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.id);
      if (isNaN(supplierId)) {
        res.status(400).json({ error: "Invalid supplier ID" });
        return;
      }

      const purchases = await this.service.getSupplierPurchases(supplierId);
      res.status(200).json({ success: true, data: purchases });
    } catch (err: any) {
      console.error("Controller Error in getSupplierPurchases:", err);
      res.status(500).json({ error: err.message || "Failed to fetch supplier purchases" });
    }
  };

  getTopSuppliers = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const suppliers = await this.service.getTopSuppliers(limit);
      res.status(200).json({ success: true, data: suppliers });
    } catch (err: any) {
      console.error("Controller Error in getTopSuppliers:", err);
      res.status(500).json({ error: err.message || "Failed to fetch top suppliers" });
    }
  };
}