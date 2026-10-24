import { Request, Response } from "express";
import { SecurityService } from "../services/security.service.js";
import { validateUpdatePermissions } from "../validators/security.validator.js";

export class SecurityController {
  private service: SecurityService;

  constructor() {
    this.service = new SecurityService();
  }

  getUserPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }
      const perms = await this.service.getUserPermissions(id);
      res.status(200).json({ success: true, data: perms });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch user permissions" });
    }
  };

  updateUserPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateUpdatePermissions(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      // Assuming operator is 1 in basic fallback simulation or pulled from session/payload
      const operatorId = (req as any).user?.id || 1; 
      const success = await this.service.updateUserPermissions(value, operatorId);
      res.status(200).json({ success, message: "Permissions updated successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to edit permissions" });
    }
  };
}
