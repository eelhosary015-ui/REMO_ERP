export interface CreateWarehouseDTO {
  name: string;
  location?: string;
  is_main?: boolean;
}

export interface AdjustStockDTO {
  warehouse_id: number;
  ingredient_id: number;
  quantity: number;
  type: "addition" | "deduction";
  notes?: string;
}
