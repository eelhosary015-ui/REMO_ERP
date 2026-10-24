import { Request, Response } from "express";
import { SalesPricingService } from "../services/pricing.service.js";

export class SalesPricingController {
  getItemsPricing = async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, category, unit, priceListId, status } = req.query;
      const items = await SalesPricingService.getAllPricingItems({
        search: search as string,
        category: category as string,
        unit: unit as string,
        priceListId: priceListId ? parseInt(priceListId as string) : undefined,
        status: status as any
      });
      res.json({ success: true, data: items });
    } catch (err: any) {
      console.error("Error in getItemsPricing:", err);
      res.status(500).json({ error: err.message || "Failed to fetch sales pricing items" });
    }
  };

  saveItemPrice = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body;
      if (!body.itemCode || !body.itemName) {
        res.status(400).json({ error: "كود الصنف واسمه مطلوبان لتحديد سعر البيع" });
        return;
      }
      if (body.sellingPrice === undefined || isNaN(Number(body.sellingPrice))) {
        res.status(400).json({ error: "يرجى إدخال سعر بيع صالح" });
        return;
      }

      const saved = await SalesPricingService.saveItemPrice(body);
      res.status(200).json({ success: true, data: saved, message: "تم حفظ سعر البيع بنجاح وتسجيله في سجل التغييرات" });
    } catch (err: any) {
      console.error("Error in saveItemPrice:", err);
      res.status(500).json({ error: err.message || "فشل حفظ سعر البيع" });
    }
  };

  toggleStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { isActive, userName } = req.body;
      const updated = await SalesPricingService.togglePriceStatus(id, !!isActive, userName);
      res.json({ success: true, data: updated, message: `تم ${isActive ? 'تفعيل' : 'تعطيل'} سعر البيع بنجاح` });
    } catch (err: any) {
      console.error("Error in toggleStatus:", err);
      res.status(500).json({ error: err.message || "فشل تحديث حالة السعر" });
    }
  };

  getPriceHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemCode, priceListId, limit } = req.query;
      const history = await SalesPricingService.getPriceHistory({
        itemCode: itemCode as string,
        priceListId: priceListId ? parseInt(priceListId as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json({ success: true, data: history });
    } catch (err: any) {
      console.error("Error in getPriceHistory:", err);
      res.status(500).json({ error: err.message || "فشل جلب سجل تغييرات الأسعار" });
    }
  };

  getPriceLists = async (req: Request, res: Response): Promise<void> => {
    try {
      const lists = await SalesPricingService.getPriceLists();
      res.json({ success: true, data: lists });
    } catch (err: any) {
      console.error("Error in getPriceLists:", err);
      res.status(500).json({ error: err.message || "فشل جلب قوائم الأسعار" });
    }
  };

  savePriceList = async (req: Request, res: Response): Promise<void> => {
    try {
      const saved = await SalesPricingService.savePriceList(req.body);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      console.error("Error in savePriceList:", err);
      res.status(500).json({ error: err.message || "فشل حفظ قائمة الأسعار" });
    }
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const settings = await SalesPricingService.getGeneralSettings();
      res.json({ success: true, data: settings });
    } catch (err: any) {
      console.error("Error in getSettings:", err);
      res.status(500).json({ error: err.message || "فشل جلب إعدادات المبيعات" });
    }
  };

  saveSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      await SalesPricingService.saveGeneralSettings(req.body);
      res.json({ success: true, message: "تم حفظ إعدادات المبيعات بنجاح" });
    } catch (err: any) {
      console.error("Error in saveSettings:", err);
      res.status(500).json({ error: err.message || "فشل حفظ إعدادات المبيعات" });
    }
  };
}
