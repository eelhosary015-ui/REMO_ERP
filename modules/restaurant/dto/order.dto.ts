export interface CreateOrderDTO {
  branch_id: number;
  user_id?: number;
  table_number?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_phone_2?: string;
  customer_address?: string;
  notes?: string;
  order_type: "dine_in" | "takeaway" | "delivery";
  total: number;
  delivery_fee?: number;
  area_id?: string;
  payment_method?: "cash" | "visa" | "wallet" | "instapay";
  items: Array<{
    product_id: number;
    size_name?: string;
    quantity: number;
    price: number;
    notes?: string;
  }>;
}

export interface UpdateOrderDTO {
  status?: "pending" | "processing" | "completed" | "cancelled";
  is_paid?: number;
  notes?: string;
}
