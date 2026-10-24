import { Request, Response } from "express";
import { SalesProductService } from "../services/sales_product.service.js";

export class SalesProductController {
  private service: SalesProductService;

  constructor() {
    this.service = new SalesProductService();
  }

  getProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = req.query.search as string;
      const category = req.query.category as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const hasMasterItem = req.query.hasMasterItem !== undefined ? req.query.hasMasterItem === "true" : undefined;
      const hasPrice = req.query.hasPrice !== undefined ? req.query.hasPrice === "true" : undefined;
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId as string, 10) : undefined;
      const productType = req.query.productType as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const offset = limit ? (page - 1) * limit : undefined;

      const result = await this.service.getProducts({
        search,
        category,
        isActive,
        hasMasterItem,
        hasPrice,
        warehouseId,
        productType,
        limit,
        offset,
      });

      res.json(result);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };

  getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await this.service.getProductById(id);
      res.json(product);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };

  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.service.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };

  createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const created = await this.service.createProduct(req.body, user);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  };

  updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = (req as any).user;
      const updated = await this.service.updateProduct(id, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  };

  toggleStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = (req as any).user;
      const toggled = await this.service.toggleProductStatus(id, user);
      res.json(toggled);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };

  deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = (req as any).user;
      await this.service.deleteProduct(id, user);
      res.status(204).send();
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };

  getMovement = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const movement = await this.service.getProductMovement(id);
      res.json(movement);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };

  getMasterItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = req.query.search as string;
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId as string, 10) : undefined;
      const items = await this.service.getMasterInventoryItems(search, warehouseId);
      res.json(items);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  };
}
