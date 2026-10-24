import { Router, Request, Response } from "express";
import { ComplaintService } from "../services/complaint.service.js";
import { validateCreateComplaint, validateResolveComplaint } from "../validators/complaint.validator.js";

export class ComplaintController {
  private service: ComplaintService;

  constructor() {
    this.service = new ComplaintService();
  }

  getComplaints = async (req: Request, res: Response): Promise<void> => {
    try {
      const complaints = await this.service.getComplaints();
      res.status(200).json({ success: true, data: complaints });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch complaints" });
    }
  };

  createComplaint = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateComplaint(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const complaint = await this.service.createComplaint(value);
      res.status(201).json({ success: true, data: complaint });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create complaint" });
    }
  };

  resolveComplaint = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid complaint ID" });
        return;
      }
      const { error, value } = validateResolveComplaint(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const complaint = await this.service.resolveComplaint(id, value);
      if (!complaint) {
        res.status(404).json({ error: "Complaint not found or already resolved" });
        return;
      }
      res.status(200).json({ success: true, data: complaint });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to resolve complaint" });
    }
  };
}

const router = Router();
const controller = new ComplaintController();

router.get("/", controller.getComplaints);
router.post("/", controller.createComplaint);
router.put("/:id/resolve", controller.resolveComplaint);

export default router;

