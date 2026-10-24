import { Request, Response } from "express";
import { SystemService } from "../services/system.service.js";
import { validateUpdateSetting } from "../validators/system.validator.js";

export class SystemController {
  private service: SystemService;

  constructor() {
    this.service = new SystemService();
  }

  getHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.service.getHealthStatus();
      res.status(200).json({ success: true, data: status });
    } catch (err: any) {
      console.error("Controller Error in getHealth:", err);
      res.status(500).json({ error: err.message || "Failed to fetch health status" });
    }
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const settings = await this.service.getSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (err: any) {
      console.error("Controller Error in getSettings:", err);
      res.status(500).json({ error: err.message || "Failed to fetch settings" });
    }
  };

  updateSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateUpdateSetting(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const setting = await this.service.saveSetting(value);
      res.status(200).json({ success: true, data: setting });
    } catch (err: any) {
      console.error("Controller Error in updateSetting:", err);
      res.status(500).json({ error: err.message || "Failed to save setting" });
    }
  };
}
