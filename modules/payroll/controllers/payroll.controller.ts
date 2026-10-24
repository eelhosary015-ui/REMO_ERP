import { Request, Response } from "express";
import { PayrollService } from "../services/payroll.service.js";
import { validateCreateAdvance, validateCalculatePayroll } from "../validators/payroll.validator.js";

export class PayrollController {
  private service: PayrollService;

  constructor() {
    this.service = new PayrollService();
  }

  getAdvances = async (req: Request, res: Response): Promise<void> => {
    try {
      const advances = await this.service.getAdvances();
      res.status(200).json({ success: true, data: advances });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch advances" });
    }
  };

  createAdvance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateAdvance(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const advance = await this.service.createAdvance(value);
      res.status(201).json({ success: true, data: advance });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to issue advance" });
    }
  };

  getPayroll = async (req: Request, res: Response): Promise<void> => {
    try {
      const month = req.query.month as string || new Date().toISOString().substring(0, 7);
      const records = await this.service.getPayrollForMonth(month);
      res.status(200).json({ success: true, month, data: records });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve monthly payroll" });
    }
  };

  calculatePayroll = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCalculatePayroll(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      await this.service.calculatePayroll(value);
      res.status(200).json({ success: true, message: "Payroll processed successfully for " + value.month });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to calculate payroll" });
    }
  };
}
