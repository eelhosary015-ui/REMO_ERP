import { Request, Response } from "express";
import { AccountService } from "../services/account.service.js";
import { validateCreateAccount, validateCreateJournalEntry } from "../validators/account.validator.js";

export class AccountController {
  private service: AccountService;

  constructor() {
    this.service = new AccountService();
  }

  getAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
      const accounts = await this.service.getAllAccounts();
      res.status(200).json({ success: true, data: accounts });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch accounts" });
    }
  };

  createAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateAccount(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const account = await this.service.createAccount(value);
      res.status(201).json({ success: true, data: account });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create account" });
    }
  };

  getJournalEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const entries = await this.service.getJournalEntries();
      res.status(200).json({ success: true, data: entries });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch journal entries" });
    }
  };

  createJournalEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateJournalEntry(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }
      const entry = await this.service.createJournalEntry(value);
      res.status(201).json({ success: true, data: entry });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create journal entry" });
    }
  };
}
