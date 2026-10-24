export interface CreateProductionRunDTO {
  product_id: number;
  warehouse_id: number;
  finished_warehouse_id?: number;
  quantity: number;
  notes?: string;
}

export interface ProductionRunResponseDTO {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  status: string;
  notes?: string;
  created_at: Date;
}

export interface ExecuteProductionOrderDTO {
  orderId?: string | number;
  orderNumber?: string;
  productId?: string | number;
  productName?: string;
  quantity?: number;
  rawWarehouseId: number;
  finishedWarehouseId: number;
  allowNegativeStock?: boolean;
  user?: string;
  notes?: string;
  laborCost?: number;
  overheadCost?: number;
  otherCost?: number;
}

export interface CheckAvailabilityItemResult {
  ingredientId: number;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  recipeUnit?: string;
  baseUnit?: string;
  quantityPerUnit: number;
  totalRequiredQty: number;
  totalRequiredBaseQty?: number;
  currentStock: number;
  remainingStock: number;
  unitCost: number;
  baseUnitCost?: number;
  totalCost: number;
  isAvailable: boolean;
  shortage: number;
  conversionFactor?: number;
  conversionEquation?: string;
  rawWarehouseId: number;
  rawWarehouseName: string;
}

export interface CheckAvailabilityResponse {
  canProduce: boolean;
  productId: string | number;
  productName: string;
  quantity: number;
  rawWarehouseId: number;
  rawWarehouseName: string;
  totalMaterialCost: number;
  costPerUnit: number;
  items: CheckAvailabilityItemResult[];
  missingCount: number;
}

