export interface CreatePurchaseItemDTO {
  ingredient_id?: number | null;
  product_id?: number | null;
  item_code?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
  discount_rate?: number;
  discount_amount?: number;
  expiry_date?: string | null;
  batch_number?: string | null;
}

export interface CreatePurchaseDTO {
  supplier_id: number;
  warehouse_id: number;
  invoice_number?: string;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  discount_amount?: number;
  shipping_amount?: number;
  total_amount: number;
  paid_amount?: number;
  due_date?: string;
  currency?: string;
  notes?: string;
  purchase_order_id?: number;
  order_id?: number;
  purchase_request_id?: number;
  quotation_id?: number;
  receipt_id?: number;
  idempotency_key?: string;
  branch_id?: number;
  cost_center_id?: number;
  payment_method?: string;
  treasury_account_id?: number;
  created_by?: number | string;
  items: CreatePurchaseItemDTO[];
}
