import { Request, Response } from "express";
import { CustomerService } from "../services/customer.service.js";
import { validateCreateCustomer, validateRecordCustomerTransaction } from "../validators/customer.validator.js";

export class CustomerController {
  private service: CustomerService;

  constructor() {
    this.service = new CustomerService();
  }

  getCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
      const customers = await this.service.getCustomers();
      res.status(200).json({ success: true, data: customers });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch customers" });
    }
  };

  createCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateCustomer(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const customer = await this.service.createCustomer(value);
      res.status(201).json({ success: true, data: customer });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save customer profiles" });
    }
  };

  getTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        res.status(400).json({ error: "Invalid customer ID" });
        return;
      }
      const txs = await this.service.getTransactions(customerId);
      res.status(200).json({ success: true, data: txs });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch customer transactions statement" });
    }
  };

  recordTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateRecordCustomerTransaction(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const tx = await this.service.recordTransaction(value);
      res.status(201).json({ success: true, data: tx });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to record customer payment/charge" });
    }
  };
}
