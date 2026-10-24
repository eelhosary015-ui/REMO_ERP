import { Request, Response } from "express";
import { EmployeeService } from "../services/employee.service.js";
import { validateCreateEmployee, validateClockInOut } from "../validators/employee.validator.js";

export class EmployeeController {
  private service: EmployeeService;

  constructor() {
    this.service = new EmployeeService();
  }

  getEmployees = async (req: Request, res: Response): Promise<void> => {
    try {
      const employees = await this.service.getEmployees();
      res.status(200).json({ success: true, data: employees });
    } catch (err: any) {
      console.error("Controller Error in getEmployees:", err);
      res.status(500).json({ error: err.message || "Failed to fetch employees" });
    }
  };

  createEmployee = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateEmployee(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const employee = await this.service.registerEmployee(value);
      res.status(201).json({ success: true, data: employee });
    } catch (err: any) {
      console.error("Controller Error in createEmployee:", err);
      res.status(500).json({ error: err.message || "Failed to register employee" });
    }
  };

  clock = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateClockInOut(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const attendance = await this.service.clockAction(value);
      res.status(200).json({ success: true, data: attendance });
    } catch (err: any) {
      console.error("Controller Error in clock:", err);
      res.status(500).json({ error: err.message || "Clocking request failed" });
    }
  };
}
