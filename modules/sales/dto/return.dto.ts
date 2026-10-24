export interface ReturnItemDTO {
  id?: number;
  invoiceItemId?: number;
  productId?: number;
  ingredientId?: number;
  itemCode: string;
  itemName: string;
  unit?: string;
  qtyInvoiced: number;
  qtyReturned: number;
  qtyPreviouslyReturned?: number;
  remainingQty?: number;
  discount?: number;
  taxRate?: number;
  price: number;
  total: number;
  unitCost?: number;
  totalCost?: number;
}

export interface CreateReturnDTO {
  returnNo?: string;
  invoiceId?: string;
  invoiceNo?: string;
  orderId?: number | null;
  orderNo?: string | null;
  customerId?: number;
  customerName: string;
  date: string;
  reason?: string;
  returnType?: string;
  refundMethod?: string;
  salesRep?: string;
  warehouse?: string;
  warehouseId?: number;
  branchId?: number;
  notes?: string;
  status?: string;
  itemsTotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  expenses?: number;
  grandTotal?: number;
  totalCost?: number;
  journalEntryId?: number;
  items: ReturnItemDTO[];
}

export interface UpdateReturnDTO extends CreateReturnDTO {}

