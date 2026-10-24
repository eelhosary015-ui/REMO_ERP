export interface MaterialItem {
  ingredient_id: number;
  name: string;
  code: string;
  unit: string;
  required_qty: number;
  waste_pct: number;
  waste_qty?: number;
  actual_qty?: number;
  unit_cost: number;
  cost_source: 'last_purchase' | 'avg_purchase' | 'weighted_avg' | 'standard_cost' | 'manual' | 'contract_price' | 'supplier_price';
  total_cost?: number;
  item_waste_cost?: number;
  supplier_name?: string;
  last_purchase_price?: number;
  last_purchase_date?: string;
  avg_purchase_price?: number;
  min_purchase_price?: number;
  max_purchase_price?: number;
  alternatives?: { name: string; cost: number; supplier: string }[];
}

export interface LaborStage {
  stage: string;
  workers: number;
  hours: number;
  hourly_rate: number;
  cost?: number;
}

export interface MachineItem {
  name: string;
  hours: number;
  hourly_rate: number;
  power_kwh?: number;
  cost?: number;
}

export interface OverheadItem {
  name: string;
  method: 'percentage' | 'per_unit' | 'per_batch' | 'per_hour' | 'fixed' | 'abc';
  rate: number;
  cost?: number;
}

export interface PackagingItem {
  name: string;
  code?: string;
  qty: number;
  unit: string;
  unit_cost: number;
  cost?: number;
}

export interface LogisticsItem {
  name: string;
  method: string;
  amount: number;
}

export interface CostingTotals {
  total_material_cost: number;
  total_waste_cost: number;
  total_labor_cost: number;
  total_machine_cost: number;
  total_overhead_cost: number;
  total_packaging_cost: number;
  total_logistics_cost: number;
  extra_cost: number;
  total_batch_cost: number;
  unit_cost: number;
  selling_price: number;
  recommended_selling_price: number;
  target_margin_pct: number;
  profit_per_unit: number;
  total_gross_profit: number;
  actual_margin_pct: number;
  markup_pct: number;
  break_even_units: number;
  breakdown_percentages: {
    materials_pct: number;
    labor_pct: number;
    machines_pct: number;
    overhead_pct: number;
    packaging_pct: number;
    logistics_pct: number;
    waste_pct: number;
  };
}

export interface ProductCostSheet {
  batch_size: number;
  uom: string;
  materials: MaterialItem[];
  labor: LaborStage[];
  machines: MachineItem[];
  overheads: OverheadItem[];
  packaging: PackagingItem[];
  logistics: LogisticsItem[];
  extra_cost?: number;
  totals: CostingTotals;
}

export interface ProductCatalogItem {
  id: number;
  name: string;
  item_code: string;
  barcode: string;
  category_id: number;
  category_name: string;
  unit: string;
  image?: string;
  selling_price: number;
  unit_cost: number;
  total_batch_cost: number;
  batch_size: number;
  profit: number;
  margin_pct: number;
  target_margin_pct: number;
  recommended_price: number;
  status: string;
  status_code: 'approved' | 'warning' | 'draft';
  versions_count: number;
  last_updated: string;
}

export interface CostVersion {
  id: number;
  version: string;
  version_name: string;
  status: 'draft' | 'calculated' | 'pending_approval' | 'approved' | 'archived';
  status_label: string;
  unit_cost: number;
  selling_price: number;
  margin_pct: number;
  effective_date: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export interface VarianceItem {
  category: string;
  standard: number;
  actual: number;
  reason: string;
}

export interface VarianceAnalysis {
  standard_unit_cost: number;
  actual_unit_cost: number;
  variance_amount: number;
  variance_pct: number;
  variance_type: string;
  breakdown: VarianceItem[];
}

export interface AuditLogItem {
  id: number;
  action: string;
  user: string;
  date: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
}
