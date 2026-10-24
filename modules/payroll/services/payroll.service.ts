import { PayrollRepository } from "../repositories/payroll.repository.js";
import { CreateAdvanceDTO, CalculatePayrollDTO } from "../dto/payroll.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class PayrollService {
  private repository: PayrollRepository;

  constructor() {
    this.repository = new PayrollRepository();
  }

  async getAdvances(): Promise<any[]> {
    const cached = ERPCache.get("payroll:advances:all");
    if (cached) return cached;

    const advances = await this.repository.getAdvances();
    ERPCache.set("payroll:advances:all", advances, 60);
    return advances;
  }

  async createAdvance(dto: CreateAdvanceDTO): Promise<any> {
    const advance = await this.repository.createAdvance(dto);
    ERPCache.delete("payroll:advances:all");

    ERPEventBus.getInstance().emitEvent("EmployeeAdvanceCreated", {
      employeeId: dto.employee_id,
      amount: dto.amount,
      timestamp: new Date()
    });

    return advance;
  }

  async getPayrollForMonth(month: string): Promise<any[]> {
    const cacheKey = `payroll:records:${month}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const records = await this.repository.getPayrollForMonth(month);
    ERPCache.set(cacheKey, records, 30);
    return records;
  }

  async calculatePayroll(dto: CalculatePayrollDTO): Promise<void> {
    await this.repository.generatePayrollForMonth(dto.month);
    ERPCache.delete(`payroll:records:${dto.month}`);

    ERPEventBus.getInstance().emitEvent("PayrollCalculated", {
      month: dto.month,
      timestamp: new Date()
    });
  }
}
