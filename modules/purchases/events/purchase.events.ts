import { ERPEventBus } from "../../../server-erp-core.js";

export function initPurchaseEvents() {
  const eventBus = ERPEventBus.getInstance();

  eventBus.on("PurchaseCreated", (data: any) => {
    console.log(`[Purchases Event] Recorded new invoice purchase #${data.purchaseId} from supplier #${data.supplierId} totaling ${data.totalAmount} EGP.`);
  });

  // Supplier Events
  eventBus.on("SupplierCreated", (data: any) => {
    console.log(`[Suppliers Event] New supplier "${data.name}" created (#${data.supplierId}) with opening balance ${data.openingBalance} EGP.`);
  });

  eventBus.on("SupplierUpdated", (data: any) => {
    console.log(`[Suppliers Event] Supplier #${data.supplierId} updated. Fields changed: ${data.updatedFields.join(', ')}`);
  });

  eventBus.on("SupplierDeleted", (data: any) => {
    console.log(`[Suppliers Event] Supplier #${data.supplierId} deleted.`);
  });

  eventBus.on("SupplierPaymentRecorded", (data: any) => {
    console.log(`[Suppliers Event] Payment of ${data.amount} EGP recorded for supplier #${data.supplierId}`);
  });

  eventBus.on("SupplierBalanceRecalculated", (data: any) => {
    console.log(`[Suppliers Event] Balance recalculated for supplier #${data.supplierId}: ${data.previousBalance} → ${data.correctedBalance} EGP (diff: ${data.difference})`);
  });
}
