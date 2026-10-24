import { Request, Response } from "express";
import { FingerprintService, SyncResult } from "../services/fingerprint.service.js";
import { validateRegisterDevice } from "../validators/fingerprint.validator.js";

export class FingerprintController {
  private service: FingerprintService;

  constructor() {
    this.service = new FingerprintService();
  }

  getDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const devices = await this.service.getDevices();
      res.status(200).json(devices);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch fingerprint devices" });
    }
  };

  registerDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateRegisterDevice(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const device = await this.service.registerDevice(value);
      res.status(201).json(device);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to register fingerprint device" });
    }
  };

  syncDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid device ID" });
        return;
      }
      const result: SyncResult = await this.service.syncDeviceLogs(id);
      if (!result.success) {
        res.status(503).json({ error: result.error, ...result });
        return;
      }
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to sync device log data" });
    }
  };
}
