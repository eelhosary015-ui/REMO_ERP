import { PurchaseRepository } from "../repositories/purchase.repository.js";
import { CreatePurchaseDTO } from "../dto/purchase.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class PurchaseService {
  private repository: PurchaseRepository;

  constructor() {
    this.repository = new PurchaseRepository();
  }

  async getPurchases(): Promise<any[]> {
    const cacheKey = "purchases:all";
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const purchases = await this.repository.getAll();
    ERPCache.set(cacheKey, purchases, 60); // cache for 1 minute
    return purchases;
  }

  async getPurchaseDetails(id: number): Promise<any> {
    const cacheKey = `purchase:${id}`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const purchase = await this.repository.findById(id);
    if (purchase) {
      ERPCache.set(cacheKey, purchase, 300); // cache for 5 minutes
    }
    return purchase;
  }

  async createPurchase(dto: CreatePurchaseDTO): Promise<any> {
    const purchase = await this.repository.create(dto);
    const idempotentReplay = Boolean(purchase?.__idempotentReplay);
    if (purchase && Object.prototype.hasOwnProperty.call(purchase, "__idempotentReplay")) {
      delete purchase.__idempotentReplay;
    }
    ERPCache.delete("purchases:all");
    // A retry of an already-committed save must not emit business events twice.
    if (idempotentReplay) return purchase;

    ERPEventBus.getInstance().emitEvent("PurchaseCreated", {
      purchaseId: purchase.id,
      supplierId: purchase.supplier_id,
      supplierName: purchase.supplier_name,
      subtotal: purchase.subtotal,
      taxAmount: purchase.tax_amount,
      totalAmount: purchase.total_amount,
      warehouseId: purchase.warehouse_id,
      purchaseOrderId: purchase.purchase_order_id || null,
      receiptId: purchase.receipt_id || null,
      branchId: purchase.branch_id || null,
      costCenterId: purchase.cost_center_id || null,
      paidAmount: purchase.paid_amount || 0,
      paymentMethod: purchase.payment_method || null,
      timestamp: new Date()
    });

    if (Number(purchase.paid_amount || 0) > 0) {
      try {
        const { erpPool } = await import("../../../server-erp-core.js");
        const pay = await erpPool.query(`SELECT id FROM supplier_transactions WHERE supplier_id=$1 AND type='payment' AND reference_id=$2 AND reference_type='purchase_payment' ORDER BY id DESC LIMIT 1`, [purchase.supplier_id, purchase.id]);
        ERPEventBus.getInstance().emitEvent("SupplierPaymentRecorded", {
          supplierId: purchase.supplier_id,
          supplierName: purchase.supplier_name,
          amount: Number(purchase.paid_amount),
          paymentMethod: purchase.payment_method || 'cash',
          transactionId: pay.rows[0]?.id || null,
          safeId: purchase.treasury_account_id || null,
          branchId: purchase.branch_id || null,
          timestamp: new Date()
        });
      } catch (e) {
        console.warn('[Purchases] Supplier payment event could not be emitted:', e);
      }
    }

    return purchase;
  }
}
