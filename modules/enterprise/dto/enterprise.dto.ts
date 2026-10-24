// ═══════════════════════════════════════════════════════════════
// Enterprise DTOs - Data Transfer Objects
// ═══════════════════════════════════════════════════════════════

// ─── Base Types ───
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface DateRangeQuery {
  date_from?: string;
  date_to?: string;
}

export interface BranchScoped {
  branch_id?: number;
  company_id?: number;
}

// ─── Company DTOs ───
export interface CreateCompanyDTO {
  code: string;
  name_ar: string;
  name_en?: string;
  tax_number?: string;
  commercial_register?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  settings?: Record<string, any>;
}

export interface UpdateCompanyDTO extends Partial<CreateCompanyDTO> {}

// ─── Role DTOs ───
export interface CreateRoleDTO {
  name: string;
  name_ar?: string;
  description?: string;
  is_system?: boolean;
  permissions?: RolePermissionDTO[];
}

export interface UpdateRoleDTO {
  name?: string;
  name_ar?: string;
  description?: string;
}

export interface RolePermissionDTO {
  key: string;
  is_granted?: boolean;
  limits?: Record<string, any>;
}

export interface UpdateRolePermissionsDTO {
  permissions: RolePermissionDTO[];
}

// ─── Batch DTOs ───
export interface CreateBatchDTO {
  ingredient_id: number;
  warehouse_id: number;
  batch_number: string;
  supplier_id?: number;
  quantity: number;
  unit_cost?: number;
  manufacturing_date?: string;
  expiry_date?: string;
  notes?: string;
}

export interface UpdateBatchDTO {
  status?: string;
  remaining_quantity?: number;
  notes?: string;
}

export interface BatchFilterDTO extends PaginationQuery {
  ingredient_id?: number;
  warehouse_id?: number;
  status?: string;
  expiring_within_days?: number;
}

// ─── Reordering Rule DTOs ───
export interface CreateReorderingRuleDTO {
  ingredient_id: number;
  warehouse_id: number;
  min_quantity?: number;
  max_quantity?: number;
  reorder_point: number;
  economic_order_qty?: number;
  lead_time_days?: number;
  safety_stock?: number;
  supplier_id?: number;
}

export interface UpdateReorderingRuleDTO extends Partial<CreateReorderingRuleDTO> {}

// ─── Stock Valuation DTOs ───
export interface StockValuationFilterDTO extends PaginationQuery, DateRangeQuery {
  warehouse_id?: number;
  ingredient_id?: number;
  date?: string;
}

// ─── BOM DTOs ───
export interface BOMItemDTO {
  ingredient_id: number;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  total_cost?: number;
  sort_order?: number;
}

export interface CreateBOMDTO {
  product_id?: number;
  product_name?: string;
  bom_code?: string;
  items?: BOMItemDTO[];
}

// ─── Work Center DTOs ───
export interface CreateWorkCenterDTO {
  code: string;
  name?: string;
  name_ar?: string;
  branch_id?: number;
  warehouse_id?: number;
  cost_per_hour?: number;
  capacity?: number;
}

export interface UpdateWorkCenterDTO extends Partial<CreateWorkCenterDTO> {}

// ─── Manufacturing Order DTOs ───
export interface MOItemDTO {
  ingredient_id: number;
  ingredient_name?: string;
  planned_qty: number;
  unit_cost?: number;
  total_cost?: number;
  consumed_qty?: number;
  warehouse_id?: number;
}

export interface CreateManufacturingOrderDTO {
  bom_id?: number;
  product_id?: number;
  product_name?: string;
  work_center_id?: number;
  quantity_planned: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  planned_start?: string;
  planned_end?: string;
  branch_id?: number;
  items?: MOItemDTO[];
}

export interface UpdateMOStatusDTO {
  status: string;
  quantity_produced?: number;
  quantity_scrapped?: number;
  actual_start?: string;
  actual_end?: string;
}

export interface ManufacturingOrderFilterDTO extends PaginationQuery {
  status?: string;
  work_center_id?: number;
}

// ─── Quality Check DTOs ───
export interface CreateQualityCheckDTO {
  mo_id?: number;
  product_id?: number;
  product_name?: string;
  work_center_id?: number;
  total_checked: number;
  passed: number;
  failed?: number;
  status?: string;
  defects?: string;
  notes?: string;
}

// ─── Scrap DTOs ───
export interface CreateScrapDTO {
  mo_id?: number;
  ingredient_id?: number;
  ingredient_name?: string;
  warehouse_id?: number;
  quantity: number;
  unit_cost?: number;
  reason?: string;
  notes?: string;
}

// ─── Maintenance Asset DTOs ───
export interface CreateAssetDTO {
  asset_code: string;
  name: string;
  name_ar?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  branch_id?: number;
  work_center_id?: number;
  purchase_date?: string;
  purchase_cost?: number;
  current_value?: number;
  depreciation_rate?: number;
  warranty_end?: string;
  status?: string;
  supplier_id?: number;
  specification?: string;
  image_url?: string;
  notes?: string;
}

export interface UpdateAssetDTO extends Partial<CreateAssetDTO> {}

export interface AssetFilterDTO extends PaginationQuery {
  branch_id?: number;
  category?: string;
  status?: string;
}

// ─── Maintenance Request DTOs ───
export interface CreateMaintenanceRequestDTO {
  asset_id: number;
  request_type?: string;
  priority?: string;
  description: string;
  branch_id?: number;
  assigned_to?: number;
  estimated_cost?: number;
}

export interface UpdateMaintenanceRequestDTO {
  status?: string;
  assigned_to?: number;
  scheduled_date?: string;
  actual_cost?: number;
  completed_at?: string;
}

export interface MaintenanceRequestFilterDTO extends PaginationQuery {
  status?: string;
  asset_id?: number;
  branch_id?: number;
}

// ─── Work Order DTOs ───
export interface CreateWorkOrderDTO {
  request_id?: number;
  asset_id: number;
  work_center_id?: number;
  description?: string;
  priority?: string;
  assigned_to?: number;
  planned_start?: string;
  planned_end?: string;
  branch_id?: number;
}

export interface UpdateWorkOrderDTO {
  status?: string;
  labor_hours?: number;
  labor_cost?: number;
  parts_cost?: number;
  other_cost?: number;
  actual_start?: string;
  actual_end?: string;
}

// ─── Preventive Maintenance DTOs ───
export interface CreatePreventiveMaintenanceDTO {
  asset_id: number;
  title: string;
  description?: string;
  frequency_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  frequency_value?: number;
  assigned_to?: number;
  estimated_duration_min?: number;
}

export interface UpdatePreventiveMaintenanceDTO {
  last_performed?: string;
  is_active?: boolean;
  assigned_to?: number;
}

// ─── CRM Lead DTOs ───
export interface CreateLeadDTO {
  name: string;
  phone?: string;
  email?: string;
  company_name?: string;
  source?: string;
  industry?: string;
  notes?: string;
  assigned_to?: number;
  branch_id?: number;
  estimated_value?: number;
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {}
export interface ConvertLeadDTO {
  title?: string;
  pipeline_stage?: string;
  expected_close_date?: string;
  estimated_value?: number;
}

export interface LeadFilterDTO extends PaginationQuery {
  status?: string;
  assigned_to?: number;
}

// ─── CRM Opportunity DTOs ───
export interface UpdateOpportunityDTO {
  [key: string]: any;
}

export interface OpportunityFilterDTO extends PaginationQuery {
  pipeline_stage?: string;
  assigned_to?: number;
}

// ─── CRM Quotation DTOs ───
export interface QuotationItemDTO {
  ingredient_id?: number;
  item_name?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  discount_percent?: number;
  tax_rate?: number;
  total_price: number;
  sort_order?: number;
}

export interface CreateQuotationDTO {
  opportunity_id?: number;
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  branch_id?: number;
  items?: QuotationItemDTO[];
  discount_amount?: number;
  tax_amount?: number;
  notes?: string;
  terms_conditions?: string;
}

// ─── CRM Activity DTOs ───
export interface CreateActivityDTO {
  opportunity_id?: number;
  lead_id?: number;
  activity_type?: string;
  subject?: string;
  description?: string;
  scheduled_date?: string;
  assigned_to?: number;
}

export interface UpdateActivityDTO {
  status?: string;
  completed_date?: string;
}

// ─── Recipe DTOs ───
export interface RecipeIngredientDTO {
  ingredient_id: number;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  total_cost?: number;
  waste_percent?: number;
  sort_order?: number;
}

export interface CreateRecipeDTO {
  product_id?: number;
  name?: string;
  name_ar?: string;
  description?: string;
  instructions?: string;
  prep_time_min?: number;
  cook_time_min?: number;
  total_yield?: number;
  branch_id?: number;
  items?: RecipeIngredientDTO[];
  selling_price?: number;
}

// ─── Waste DTOs ───
export interface CreateWasteDTO {
  branch_id?: number;
  ingredient_id?: number;
  ingredient_name?: string;
  quantity: number;
  unit_cost?: number;
  waste_type?: string;
  reason?: string;
  notes?: string;
}

export interface WasteFilterDTO extends PaginationQuery, DateRangeQuery {
  branch_id?: number;
  waste_type?: string;
}

// ─── Audit Log DTOs ───
export interface AuditLogFilterDTO extends PaginationQuery, DateRangeQuery {
  module?: string;
  user_id?: number;
  table_name?: string;
}

// ─── Dashboard DTOs ───
export interface KPIFilterDTO extends DateRangeQuery {
  branch_id?: number;
}

// ─── Financial Report DTOs ───
export interface FinancialReportFilterDTO extends DateRangeQuery {}