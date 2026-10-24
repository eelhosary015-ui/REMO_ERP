import { Router } from "express";
import { AccountController } from "../controllers/account.controller.js";

const router = Router();
const controller = new AccountController();

router.get("/", controller.getAccounts);
router.post("/", controller.createAccount);
router.get("/journal", controller.getJournalEntries);
router.post("/journal", controller.createJournalEntry);

export default router;
