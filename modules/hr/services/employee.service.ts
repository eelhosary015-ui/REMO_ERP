import { EmployeeRepository } from "../repositories/employee.repository.js";
import { CreateEmployeeDTO, ClockInOutDTO } from "../dto/employee.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class EmployeeService {
  private repository: EmployeeRepository;

  constructor() {
    this.repository = new EmployeeRepository();
  }

  async getEmployees(): Promise<any[]> {
    const cacheKey = "hr:employees:all";
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const employees = await this.repository.getAll();
    ERPCache.set(cacheKey, employees, 300); // 5 mins cache
    return employees;
  }

  async registerEmployee(dto: CreateEmployeeDTO): Promise<any> {
    const employee = await this.repository.create(dto);
    ERPCache.delete("hr:employees:all");

    ERPEventBus.getInstance().emitEvent("EmployeeOnboarded", {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      timestamp: new Date()
    });

    return employee;
  }

  async clockAction(dto: ClockInOutDTO): Promise<any> {
    const attendance = await this.repository.clockInOut(dto);
    
    ERPEventBus.getInstance().emitEvent("EmployeeClocked", {
      employeeId: dto.employee_id,
      type: dto.type,
      timestamp: new Date()
    });

    return attendance;
  }
}
