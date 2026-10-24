import { ERPEventBus } from "../../../server-erp-core.js";
import {
  recordGoodsReceiptCost,
  recordProductionCost,
  recordPurchaseCost,
  recordPurchaseReturnCost,
  recordInventoryAdjustmentCost,
  recordWastageCost,
  recordWarehouseTransferCost
} from "../services/cost.integration.service.js";

export function initCostEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("PurchaseCreated", (data: any) => {
    void recordPurchaseCost(Number(data.purchaseId)).catch((error: any) => {
      console.error(`[Costs Integration] Purchase #${data.purchaseId} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("ProductionOrderExecuted", (data: any) => {
    void recordProductionCost(String(data.orderNumber)).catch((error: any) => {
      console.error(`[Costs Integration] Production ${data.orderNumber} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("GoodsReceiptPosted", (data: any) => {
    void recordGoodsReceiptCost(Number(data.receiptId)).catch((error: any) => {
      console.error(`[Costs Integration] Goods receipt #${data.receiptId} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("PurchaseReturnApproved", (data: any) => {
    void recordPurchaseReturnCost(Number(data.returnId || data.id)).catch((error: any) => {
      console.error(`[Costs Integration] Purchase return #${data.returnId || data.id} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("InventoryAdjustmentApproved", (data: any) => {
    void recordInventoryAdjustmentCost(Number(data.adjustmentId || data.id)).catch((error: any) => {
      console.error(`[Costs Integration] Inventory adjustment #${data.adjustmentId || data.id} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("InventoryWastageApproved", (data: any) => {
    void recordWastageCost(Number(data.wastageId || data.id)).catch((error: any) => {
      console.error(`[Costs Integration] Wastage #${data.wastageId || data.id} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("WarehouseTransferCompleted", (data: any) => {
    void recordWarehouseTransferCost(Number(data.transferId || data.id)).catch((error: any) => {
      console.error(`[Costs Integration] Warehouse transfer #${data.transferId || data.id} could not be recorded:`, error?.message || error);
    });
  });

  eventBus.on("CostRecorded", (data: any) => {
    console.log(`[Costs Event] New operational cost recorded: ${data.category} - ${data.amount} EGP.`);
  });
}
