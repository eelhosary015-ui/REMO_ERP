import { ReportRepository } from "../repositories/report.repository.js";
import { FetchReportDTO } from "../dto/report.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class ReportService {
  private repository: ReportRepository;

  constructor() {
    this.repository = new ReportRepository();
  }

  async getSalesReport(dto: FetchReportDTO): Promise<any[]> {
    const cacheKey = `reports:sales:${dto.branch_id || "all"}:${dto.start_date}:${dto.end_date}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const report = await this.repository.getBranchSalesReport(dto);
    ERPCache.set(cacheKey, report, 300); // 5 mins cache
    return report;
  }

  async getProfitability(dto: FetchReportDTO): Promise<any> {
    const cacheKey = `reports:profit:${dto.branch_id || "all"}:${dto.start_date}:${dto.end_date}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const report = await this.repository.getOperationalProfitability(dto);
    ERPCache.set(cacheKey, report, 300);

    ERPEventBus.getInstance().emitEvent("ReportGenerated", {
      branchId: dto.branch_id,
      startDate: dto.start_date,
      endDate: dto.end_date,
      timestamp: new Date()
    });

    return report;
  }
}
