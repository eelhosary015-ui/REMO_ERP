export interface SalesOrderItemDTO {
  id?: number;
  productId?: number;
  ingredientId?: number;
  itemCode?: string;
  itemName: string;
  name?: string;
  unit?: string;
  qtyRequired: number;
  qty?: number;
  qtyAvailable?: number;
  qtyReserved?: number;
  qtyDelivered?: number;
  price: number;
  unitCost?: number;
  discountPercent?: number;
  vatPercent?: number;
  total: number;
}

export interface CreateSalesOrderDTO {
  id?: number | null;
  orderNo?: string;
  quotationId?: number;
  quotationNo?: string;
  customerId?: number;
  customerName: string;
  date: string;
  deliveryDate?: string;
  salesRep?: string;
  paymentMethod?: string;
  branch?: string;
  branchId?: number;
  warehouse?: string;
  warehouseId?: number;
  currency?: string;
  notes?: string;
  status?: string;
  deliveryStatus?: string;
  invoiceStatus?: string;
  paymentStatus?: string;
  totalQty?: number;
  totalAmount?: number;
  deliveredQty?: number;
  remainingQty?: number;
  items: SalesOrderItemDTO[];
}

export interface UpdateSalesOrderDTO extends Partial<CreateSalesOrderDTO> {}
