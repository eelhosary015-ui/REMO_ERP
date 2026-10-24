import { Request, Response } from "express";
import { ReportService } from "../services/report.service.js";
import { validateFetchReport } from "../validators/report.validator.js";

export class ReportController {
  private service: ReportService;

  constructor() {
    this.service = new ReportService();
  }

  getSalesReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const dates = {
        branch_id: req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined,
        start_date: req.query.start_date as string || new Date().toISOString().substring(0, 10),
        end_date: req.query.end_date as string || new Date().toISOString().substring(0, 10)
      };
      
      const { error, value } = validateFetchReport(dates);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const report = await this.service.getSalesReport(value);
      res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to compile sales report" });
    }
  };

  getProfitabilityReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const dates = {
        branch_id: req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined,
        start_date: req.query.start_date as string || new Date().toISOString().substring(0, 10),
        end_date: req.query.end_date as string || new Date().toISOString().substring(0, 10)
      };

      const { error, value } = validateFetchReport(dates);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const report = await this.service.getProfitability(value);
      res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to compile profitability reports" });
    }
  };
}
