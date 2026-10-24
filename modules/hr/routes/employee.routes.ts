import { Router } from "express";
import { EmployeeController } from "../controllers/employee.controller.js";

const router = Router();
const controller = new EmployeeController();

router.get("/", controller.getEmployees);
router.post("/", controller.createEmployee);
router.post("/attendance", controller.clock);

export default router;
