import { SupplierRepository } from "../repositories/supplier.repository.js";
import { CreateSupplierDTO, UpdateSupplierDTO, SupplierPaymentDTO, SupplierTransactionDTO } from "../dto/supplier.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class SupplierService {
  private repository: SupplierRepository;

  constructor() {
    this.repository = new SupplierRepository();
  }

  async getSuppliers(filters?: { search?: string; status?: string; group?: string }): Promise<any[]> {
    const cacheKey = `suppliers:all:${filters?.search || ''}:${filters?.status || ''}:${filters?.group || ''}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const suppliers = await this.repository.getAll(filters);
    ERPCache.set(cacheKey, suppliers, 60); // cache for 1 minute
    return suppliers;
  }

  async getSupplierById(id: number): Promise<any> {
    const cacheKey = `supplier:${id}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const supplier = await this.repository.findById(id);
    if (supplier) {
      ERPCache.set(cacheKey, supplier, 300); // cache for 5 minutes
    }
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDTO): Promise<any> {
    const supplier = await this.repository.create(dto);

    // Record opening balance as initial transaction if > 0
    if (dto.opening_balance && dto.opening_balance > 0) {
      await this.repository.recordTransaction({
        supplier_id: supplier.id,
        type: 'purchase',
        amount: dto.opening_balance,
        notes: 'رصيد افتتاحي',
        reference_id: supplier.id,
        reference_type: 'opening_balance',
        currency: (supplier.currency || 'EGP')
      });
    }

    ERPCache.delete("suppliers:all");

    ERPEventBus.getInstance().emitEvent("SupplierCreated", {
      supplierId: supplier.id,
      name: supplier.name,
      openingBalance: dto.opening_balance || 0,
      timestamp: new Date()
    });

    return supplier;
  }

  async updateSupplier(id: number, dto: UpdateSupplierDTO): Promise<any> {
    const supplier = await this.repository.update(id, dto);
    if (!supplier) return null;

    ERPCache.delete(`supplier:${id}`);
    ERPCache.delete("suppliers:all");

    ERPEventBus.getInstance().emitEvent("SupplierUpdated", {
      supplierId: id,
      updatedFields: Object.keys(dto),
      timestamp: new Date()
    });

    return supplier;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);

    ERPCache.delete(`supplier:${id}`);
    ERPCache.delete("suppliers:all");

    ERPEventBus.getInstance().emitEvent("SupplierDeleted", {
      supplierId: id,
      timestamp: new Date()
    });

    return result;
  }

  async recordPayment(supplierId: number, dto: SupplierPaymentDTO): Promise<any> {
    const supplier = await this.repository.findById(supplierId);
    if (!supplier) throw new Error("Supplier not found");

    const transaction = await this.repository.recordTransaction({
      supplier_id: supplierId,
      type: 'payment',
      amount: dto.amount,
      notes: dto.notes || `دفعة للمورد - ${dto.payment_method || 'نقدي'}`,
      reference_id: dto.safe_id
    });

    ERPCache.delete(`supplier:${supplierId}`);
    ERPCache.delete("suppliers:all");

    const eventBus = ERPEventBus.getInstance();
    eventBus.emitEvent("SupplierPaymentRecorded", {
      supplierId,
      supplierName: supplier.name,
      amount: dto.amount,
      paymentMethod: dto.payment_method,
      safeId: dto.safe_id,
      timestamp: new Date()
    });

    return transaction;
  }

  async recordTransaction(dto: SupplierTransactionDTO): Promise<any> {
    const transaction = await this.repository.recordTransaction(dto);
    ERPCache.delete(`supplier:${dto.supplier_id}`);
    ERPCache.delete("suppliers:all");
    return transaction;
  }

  async getSupplierStatement(supplierId: number, filters?: { fromDate?: string; toDate?: string }): Promise<any[]> {
    return this.repository.getStatement(supplierId, filters);
  }

  async getSupplierPurchases(supplierId: number): Promise<any[]> {
    return this.repository.getPurchases(supplierId);
  }

  async getTopSuppliers(limit?: number): Promise<any[]> {
    const cacheKey = `suppliers:top:${limit || 10}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const suppliers = await this.repository.getTopSuppliers(limit || 10);
    ERPCache.set(cacheKey, suppliers, 300); // cache for 5 minutes
    return suppliers;
  }

  async getTransactions(supplierId: number, filters?: { from?: string; to?: string; type?: string; limit?: number; offset?: number }): Promise<any[]> {
    return this.repository.getTransactions(supplierId, filters);
  }

  async recalculateBalance(supplierId: number): Promise<any> {
    const summary = await this.repository.getBalanceSummary(supplierId);
    if (!summary) throw new Error("Supplier not found");

    const calculated = parseFloat(summary.calculated_balance);
    const current = parseFloat(summary.current_balance);

    if (Math.abs(calculated - current) > 0.01) {
      await this.repository.updateBalance(supplierId, calculated - current);
      ERPCache.delete(`supplier:${supplierId}`);

      ERPEventBus.getInstance().emitEvent("SupplierBalanceRecalculated", {
        supplierId,
        previousBalance: current,
        correctedBalance: calculated,
        difference: calculated - current,
        timestamp: new Date()
      });
    }

    return {
      supplierId,
      previousBalance: current,
      calculatedBalance: calculated,
      isCorrected: Math.abs(calculated - current) > 0.01
    };
  }
}