/**
 * Cost Management Domain Models
 * Phase 3: Centralized Cost Layer for ERP
 */

export type CostCategory =
  | 'electricity'
  | 'rent'
  | 'transportation'
  | 'maintenance'
  | 'internet'
  | 'administrative'
  | 'bank_charges'
  | 'freight'
  | 'customs'
  | 'labor'
  | 'packaging'
  | 'overhead'
  | 'waste'
  | 'other';

export type CostSourceType =
  | 'purchase'
  | 'purchase_order'
  | 'purchase_request'
  | 'goods_receipt'
  | 'production_order'
  | 'sales_invoice'
  | 'manual';

export type CostApprovalStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Allocated';

export interface OperatingCostDomain {
  id?: number;
  voucher_no?: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  branch?: string;
  branch_id?: number;
  department?: string;
  cost_center_id?: number;
  cost_item_id?: number;
  payment_method?: string;
  safe?: string;
  safe_id?: number;
  treasury_account_id?: number;
  status?: string;
  created_by?: string;
  link_ledger?: boolean;
  journal_entry_id?: number;
  source_type?: string;
  source_id?: number;
  accounting_account?: string | number;
  project?: string;
  product?: string;
  supplier?: string;
  employee?: string;
  customer?: string;
  tax?: number;
  total?: number;
  currency?: string;
  approval_status?: CostApprovalStatus;
  customer_id?: number;
  employee_id?: number;
  supplier_id?: number;
  product_id?: number;
  warehouse_id?: number;
  purchase_id?: number;
  purchase_order_id?: number;
  purchase_request_id?: number;
  purchase_receipt_id?: number;
  purchase_quotation_id?: number;
  due_date?: string;
  financial_period?: string;
  company_id?: number;
  exchange_rate?: number;
  discount?: number;
  cost_type?: string;
  cost_behavior?: 'fixed' | 'variable' | string;
  direct_indirect?: 'direct' | 'indirect' | string;
  allocation_method?: string;
  allocation_status?: 'allocated' | 'unallocated' | string;
  source?: string;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  allocated_by?: string;
  allocated_at?: string;
  closed_by?: string;
  closed_at?: string;
  reversal_user?: string;
  reversal_reason?: string;
}

export interface CostCenterDomain {
  id: number;
  code?: string;
  name: string;
  branch_id?: number;
  parent_id?: number;
  manager?: string;
  budget?: number;
  status: string;
  type?: string;
  description?: string;
}

export interface CostItemDomain {
  id: number;
  code?: string;
  name: string;
  category: string;
  parent_id?: number;
  accounting_account_id?: number;
  default_center_id?: number;
  default_allocation_method?: string;
  budget_cap?: number;
  alert_threshold?: number;
  status: string;
  is_hr_linked?: boolean;
  is_warehouse_linked?: boolean;
  is_procurement_linked?: boolean;
  description?: string;
}

export interface ProductCostBreakdown {
  productId: string | number;
  productName?: string;
  costSource: 'weighted_avg' | 'last_purchase' | 'standard';
  rawMaterialCost: number;
  directLaborCost: number;
  packagingCost: number;
  manufacturingOverhead: number;
  wasteCost: number;
  wastePercent: number;
  grandTotalCost: number;
  yieldPortions: number;
  costPerPortion: number;
  sellingPrice: number;
  grossProfit: number;
  profitMarginPct: number;
  calculatedAt: string;
}

export interface LandedCostAllocationItem {
  itemId: number;
  quantity: number;
  baseAmount: number;
  allocatedFreight: number;
  allocatedCustoms: number;
  allocatedInsurance: number;
  allocatedOther: number;
  totalLandedCost: number;
  finalUnitCost: number;
}
