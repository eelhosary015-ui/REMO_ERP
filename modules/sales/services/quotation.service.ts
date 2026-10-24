import { QuotationRepository } from "../repositories/quotation.repository.js";
import { CreateQuotationDTO, UpdateQuotationDTO } from "../dto/quotation.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

const LIST_CACHE_KEY = "sales:quotations:all";

export class QuotationService {
  private repository: QuotationRepository;

  constructor() {
    this.repository = new QuotationRepository();
  }

  async getQuotations(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const quotations = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, quotations, 60);
    return quotations;
  }

  async createQuotation(dto: CreateQuotationDTO): Promise<any> {
    const quotation = await this.repository.create(dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesQuotationCreated", {
      quotationId: quotation.id,
      quotationNo: quotation.quotation_no,
      customerName: quotation.customer_name,
      netAmount: quotation.net_amount,
      timestamp: new Date()
    });

    return quotation;
  }

  async updateQuotation(id: number, dto: UpdateQuotationDTO): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Quotation not found");
      err.statusCode = 404;
      throw err;
    }

    const quotation = await this.repository.update(id, dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesQuotationUpdated", {
      quotationId: id,
      status: quotation.status,
      timestamp: new Date()
    });

    return quotation;
  }

  async deleteQuotation(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Quotation not found");
      err.statusCode = 404;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesQuotationDeleted", {
      quotationId: id,
      timestamp: new Date()
    });
  }
}
