export interface InvoiceItemDTO {
  itemId?: number;
  itemType?: "product" | "inventory_item" | string;
  ingredientId?: number; // links to warehouse stock item, optional (enables real stock deduction)
  productId?: number;
  barcode?: string;
  code?: string;
  name: string;
  unit?: string;
  qty: number;
  price: number;
  unitCost?: number;
  totalCost?: number;
  discountPercent?: number;
  vatPercent?: number;
  total: number;
}

export interface CreateInvoiceDTO {
  invoiceNo?: string;
  orderId?: number; // optional link back to the sales order this invoice was generated from
  orderNo?: string;
  deliveryNoteId?: number;
  deliveryNoteNo?: string;
  quotationId?: number;
  customerId?: number; // optional link to the customers module for AR/balance tracking
  customerName: string;
  date: string;
  dueDate?: string;
  salesRep?: string;
  branch?: string;
  branchId?: number;
  warehouseId?: number; // optional, enables real stock deduction
  warehouse?: string;
  currency?: string;
  paymentMethod?: string; // "نقدي" | "آجل" | "شبكة" | ...
  notes?: string;
  status?: string; // "مسودة" | "معتمدة" | "مدفوعة" | "ملغاة"
  isPosted?: boolean;
  /** Set only when a linked delivery has already recorded and costed the stock issue. */
  stockAlreadyDeducted?: boolean;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  netAmount?: number;
  totalCost?: number; // Total COGS cost calculated from inventory/costing engine
  paidAmount?: number;
  safeId?: number;
  items: InvoiceItemDTO[];
}

export interface UpdateInvoiceDTO extends CreateInvoiceDTO {}

export interface RecordInvoicePaymentDTO {
  amount: number;
  method?: string;
  notes?: string;
  safeId?: number;
}
