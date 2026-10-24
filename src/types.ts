export interface NavItem {
  id: string;
  label: string;
  icon: any;
  color: string;
  features?: { id: string; label: string; icon?: any }[];
  settings?: { id: string; label: string; icon?: any }[];
  reports?: { id: string; label: string; icon?: any }[];
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  cost: number;
  supplier?: string;
  min_stock?: number;
  current_stock?: number;
  item_group?: string;
  item_code?: string;
  is_fixed_asset?: number;
  asset_category?: string;
  description?: string;
  is_zero_rated?: number;
  is_exempt?: number;
  brand?: string;
  shelf_life_in_days?: number;
  end_of_life?: string;
  default_material_request_type?: string;
  valuation_method?: string;
  warranty_period?: number;
  weight_per_unit?: number;
  allow_negative_stock?: number;
  barcode?: string;
  has_variants?: number;
  parent_item_id?: number;
  deferred_expense?: number;
  deferred_expense_months?: number;
  deferred_revenue?: number;
  deferred_revenue_months?: number;
  default_income_account?: string;
  default_expense_account?: string;
  customer?: string;
  min_order_qty?: number;
  lead_time_days?: number;
  safety_stock?: number;
  max_discount?: number;
  grant_commission?: number;
  allow_sales?: number;
  allow_purchase?: number;
  tax_template?: string;
  inspection_required_before_purchase?: number;
  inspection_required_before_delivery?: number;
  is_manufactured?: number;
  is_subcontracted?: number;
  variant_colors?: string;
  allow_alternative_item?: number;
  alternative_items?: any[] | string;
}

export interface ProductIngredient {
  ingredient_id: number;
  product_id?: number;
  quantity: number;
  ingredient_name?: string;
  unit?: string;
  unit_cost?: number;
  notes?: string;
}

export interface ProductSize {
  id?: number;
  product_id?: number;
  name: string;
  price: number;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  price: number;
  image: string;
  ingredient_id?: number;
  master_item_id?: number;
  ingredients?: ProductIngredient[];
  sizes?: ProductSize[];
  code?: string;
  barcode?: string;
  serial_number?: string;
  expiry_date?: string;
  stock?: number;
  unit?: string;
  brand?: string;
  is_favorite?: boolean;
  is_active?: boolean;
  show_in_pos?: boolean;
  warehouse_id?: number;
  properties?: any;
  cost?: number;
  min_stock?: number;
  max_stock?: number;
  tax_rate?: number;
  business_profile?: 'restaurant' | 'clothing' | 'supermarket' | 'general';
  item_type?: 'sale' | 'manufactured' | 'raw_material' | 'service' | 'bundle';
  allow_discount?: boolean;
  track_inventory?: boolean;
  preparation_time?: number;
  kitchen_station?: string;
  size_label?: string;
  color?: string;
  material?: string;
  supplier?: string;
  shelf_life_days?: number;
  display_order?: number;
}

export interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
  printer_id?: number | null;
  is_active?: boolean;
  show_in_pos?: boolean;
  color?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize?: ProductSize;
  originalPrice?: number;
  selectedWarehouseId?: string;
  commissionEmployeeId?: string | number;
  notes?: string;
}

export interface Branch {
  id: number;
  name: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
  tables_count: number;
}

export interface DeliveryArea {
  id: string;
  branch_id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export interface TableSession {
  table_number: number;
  order_id: number;
  total: number;
}

export interface POSMode {
  type: 'direct' | 'table' | 'call_center';
  tableNumber?: number;
  orderId?: number;
}

export interface Employee {
  id: number;
  name: string;
  department_id: number;
  job_title: string;
  branch_id: number;
  is_department_head?: boolean;
  is_supervisor?: boolean;
  role_level?: 'head' | 'supervisor' | 'regular';
  salary_type: 'monthly' | 'daily';
  basic_salary: number;
  work_days: number;
  has_insurance: boolean;
  insurance_amount?: number;
  has_meal_allowance: boolean;
  meal_allowance_amount?: number;
  exempt_from_penalties?: boolean;
  fingerprint_code: string;
  fingerprint_status?: string;
  national_id: string;
  phone: string;
  address: string;
  qualification: string;
  department_name?: string;
  branch_name?: string;
  shifts?: number[];
  status?: string;
  code?: string;
  position?: string;
  first_name?: string;
  second_name?: string;
  third_name?: string;
  fourth_name?: string;
  avatar?: string;
  shift_id?: number;
  shift_name?: string;
  employee_code?: string;
  email?: string;
  gender?: string;
  app_password?: string;
  birth_date?: string;
  hire_date?: string;
  /** تاريخ استلام العمل الفعلي — بداية حساب المرتب */
  actual_start_date?: string;
  contract_type?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  probation_end_date?: string;
  bank_name?: string;
  bank_account?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  manager_id?: number;
  employee_grade?: string;
  annual_leave_balance?: number;
  sick_leave_balance?: number;
  casual_leave_balance?: number;
  last_evaluation_score?: number;
  last_evaluation_date?: string;
  termination_date?: string;
  termination_reason?: string;
}

export interface HRDepartment {
  id: number;
  name: string;
  employee_count?: number;
}

export interface HRShift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  grace_period: number;
}

export interface HRPenalty {
  id: number;
  name: string;
  amount: number;
  /**
   * Calculation type:
   *  - amount:            fixed EGP value (amount = ج.م)
   *  - days:              amount × dayRate  (amount = number of work days)
   *  - hours:             amount × hourlyRate (amount = number of work hours)
   *  - per_minute:        amount × delay_minutes (amount = ج.م per minute of delay)
   *  - per_minute_ratio:  amount × ceil(delay_minutes / ratio_minutes)
   *                       (amount = ج.م per `ratio_minutes` minutes of delay)
   *                       ratio_minutes is stored in threshold_minutes for this type
   *  - shift_ratio:       AUTO-calculated from salary + shift hours. No amount needed.
   *                       The admin only picks the ratio (every 1 minute, or every 2 minutes).
   *                       Per-minute value = basic_salary / work_days / shift_total_hours / 60
   *                       threshold_minutes = how many minutes of delay = 1 unit of deduction
   */
  type: 'amount' | 'days' | 'hours' | 'per_minute' | 'per_minute_ratio' | 'shift_ratio';
  /**
   * Penalty / deduction category. Extended 2026-08-24 to include all
   * استقطاع / خصم / سلفة / تأمين categories — the award-penalty modal
   * and the لائحة الجزاءات editor dropdown now both expose these
   * values, and the deductions sheet renders each with a distinct color.
   */
  category?: 'delay' | 'absence' | 'early_leave' | 'missing_punch' | 'manual' | 'penalty' | 'deduction' | 'discount' | 'advance' | 'insurance' | 'vacation_deduction' | 'uniform' | 'hr';
  threshold_minutes?: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  fingerprint_code: string;
  date: string;
  shift_name: string;
  check_in: string | null;
  check_out: string | null;
  work_hours: number;
  overtime: number;
  delay_minutes: number;
  penalty: number;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_photo?: string | null;
  check_out_photo?: string | null;
  check_in_location?: string | null;
  check_out_location?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
  device_info?: string | null;
  notes?: string | null;
}

export interface TreasuryAccount {
  id: number;
  name: string;
  type: 'cash' | 'bank' | 'petty_cash' | 'intermediate';
  currency: string;
  current_balance: number;
  opening_balance: number;
  min_balance_limit: number;
  max_balance_limit: number;
  responsible_user_id?: number;
  responsible_user_name?: string;
  is_main: boolean;
  parent_id?: number;
  branch_id?: number;
  branch_name?: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface TreasuryTransaction {
  id: number;
  account_id: number;
  amount: number;
  transaction_type: 'cash_in' | 'cash_out' | 'transfer' | 'adjustment';
  reference_type?: string;
  reference_id?: number;
  created_by: number;
  created_at: string;
  notes?: string;
  cost_center_id?: number;
  cost_center_name?: string;
  attachment_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled';
  approved_by?: number;
  approved_at?: string;
  voucher_number?: string;
  voucher_type?: 'receipt' | 'payment';
  tax_amount: number;
  discount_amount: number;
  payment_method: 'cash' | 'bank' | 'check' | 'electronic';
  client_type?: string;
  client_name?: string;
  invoice_id?: number;
  sales_invoice_number?: string;
  purchase_invoice_number?: string;
  balance_before: number;
  balance_after: number;
  user_name?: string;
  account_name?: string;
}

export type TreasuryClosingStatus = 
  | 'Matched'
  | 'Deficit - Pending Review'
  | 'Surplus - Pending Review'
  | 'Settled'
  | 'Reopened';

export interface CashDenominationBreakdown {
  [key: string]: number; // e.g. "200": 10, "100": 5, "50": 2, "20": 0, "10": 0, "5": 0, "1": 0, "0.5": 0
}

export interface TreasuryClosing {
  id: number;
  treasury_id: number;
  treasury_name?: string;
  treasury_code?: string;
  treasury_currency?: string;
  branch_id?: number;
  branch_name?: string;
  closing_date: string;
  opening_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  book_balance: number;
  actual_balance: number;
  variance: number;
  responsible_user: string;
  responsible_user_id?: number;
  status: TreasuryClosingStatus;
  notes?: string;
  denominations: CashDenominationBreakdown;
  journal_entry_id?: number;
  journal_entry_number?: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface TreasuryCurrentStatus {
  treasury_id: number;
  treasury_name: string;
  treasury_code: string;
  branch_id?: number;
  branch_name?: string;
  currency: string;
  opening_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  book_balance: number;
  last_closing_date?: string;
  last_closing_status?: string;
}

export interface TreasuryDailyClosing {
  id: number;
  account_id: number;
  opening_balance: number;
  receipts: number;
  payments: number;
  transfers_in: number;
  transfers_out: number;
  expected_balance: number;
  actual_balance: number;
  difference: number;
  status: 'closed' | 'reopened';
  notes?: string;
  created_by: number;
  created_at: string;
  approved_by?: number;
  approved_at?: string;
  account_name?: string;
  creator_name?: string;
  approver_name?: string;
}

export interface TreasuryCustodyType {
  id: number;
  code: string;
  name_ar: string;
  name_en?: string;
  category: 'cash' | 'asset' | 'equipment' | 'inventory' | 'vehicle' | 'temporary' | 'permanent';
  requires_asset: boolean;
  requires_inventory: boolean;
  requires_treasury: boolean;
  max_limit: number;
  default_duration_days: number;
  description?: string;
  is_active: boolean;
  active_custodies_count?: number;
  total_active_amount?: number;
}

export interface TreasuryCustodyExpense {
  id: number;
  custody_id: number;
  expense_number?: string;
  expense_date: string;
  description: string;
  category: string;
  amount: number;
  tax_amount?: number;
  account_id?: number;
  cost_center_id?: number;
  cost_center_name?: string;
  supplier_name?: string;
  invoice_number?: string;
  payment_method?: string;
  receipt_attachment_url?: string;
  notes?: string;
  created_by?: number;
  creator_name?: string;
  created_at?: string;
}

export interface TreasuryCustodyItem {
  id: number;
  custody_id: number;
  item_type: 'equipment' | 'asset' | 'tool' | 'inventory' | 'vehicle' | 'other';
  asset_id?: number;
  linked_asset_name?: string;
  linked_asset_code?: string;
  item_name: string;
  item_code?: string;
  serial_number?: string;
  barcode?: string;
  quantity: number;
  unit_cost?: number;
  total_value?: number;
  condition_on_issue: string;
  condition_on_return?: string;
  status: 'assigned' | 'returned' | 'damaged' | 'lost';
  notes?: string;
  issued_at?: string;
  returned_at?: string;
}

export interface TreasuryCustodySettlement {
  id: number;
  settlement_number: string;
  custody_id: number;
  settlement_date: string;
  total_expenses: number;
  returned_to_treasury: number;
  additional_paid_to_employee: number;
  settlement_type: 'full' | 'partial' | 'replenish';
  treasury_account_id?: number;
  treasury_account_name?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'posted';
  notes?: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  journal_entry_id?: number;
  created_by?: number;
  created_at?: string;
}

export interface TreasuryCustodyApproval {
  id: number;
  custody_id: number;
  approval_level: number;
  approver_id: number;
  approver_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  decision?: string;
  comments?: string;
  decided_at?: string;
}

export interface TreasuryCustodyAttachment {
  id: number;
  custody_id: number;
  title: string;
  file_url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: number;
  uploader_name?: string;
  created_at?: string;
}

export interface TreasuryCustody {
  id: number;
  custody_number?: string;
  custody_type_id?: number;
  custody_type?: string;
  custody_type_name?: string;
  custody_type_code?: string;
  custody_category?: string;
  employee_id: number;
  employee_name?: string;
  employee_code?: string;
  employee_phone?: string;
  employee_department?: string;
  account_id: number;
  account_name?: string;
  account_balance?: number;
  branch_id?: number;
  branch_name?: string;
  cost_center_id?: number;
  cost_center_name?: string;
  project_name?: string;
  amount: number;
  issued_amount?: number;
  spent_amount?: number;
  remaining_amount?: number;
  returned_amount?: number;
  additional_due_amount?: number;
  cleared_amount?: number;
  currency?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'issued' | 'active' | 'pending_settlement' | 'partially_settled' | 'closed' | 'rejected' | 'canceled' | 'pending' | 'paid' | 'cleared';
  request_date?: string;
  due_date?: string;
  duration_days?: number;
  is_overdue?: boolean;
  overdue_days?: number;
  purpose?: string;
  notes?: string;
  clearance_notes?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  issued_by?: number;
  issued_by_name?: string;
  issued_at?: string;
  received_at?: string;
  closed_by?: number;
  closed_at?: string;
  cleared_at?: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  
  // Child lists
  expenses?: TreasuryCustodyExpense[];
  items?: TreasuryCustodyItem[];
  settlements?: TreasuryCustodySettlement[];
  approvals?: TreasuryCustodyApproval[];
  attachments?: TreasuryCustodyAttachment[];
  auditLogs?: any[];
}

export interface TreasuryAuditLog {
  id: number;
  transaction_id?: number;
  account_id?: number;
  action_type: string;
  old_values?: any;
  new_values?: any;
  user_id: number;
  user_name?: string;
  account_name?: string;
  created_at: string;
  ip_address?: string;
}

export interface TreasurySetting {
  key: string;
  value: string;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════
// Enterprise Financial Transfer Management Interfaces
// ═══════════════════════════════════════════════════════════════
export type TreasuryTransferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executed"
  | "in_transit"
  | "pending_receipt"
  | "received"
  | "posted"
  | "completed"
  | "rejected"
  | "cancelled"
  | "reversed";

export type TransferCategoryType =
  | "safe_to_safe"
  | "safe_to_bank"
  | "bank_to_safe"
  | "bank_to_bank"
  | "branch_transfer"
  | "cost_center_transfer"
  | "custom";

export interface TreasuryTransferType {
  id: number;
  code: string;
  name_ar: string;
  name_en?: string;
  source_type: "safe" | "bank" | "any";
  destination_type: "safe" | "bank" | "any";
  requires_receipt_confirmation: boolean;
  requires_approval: boolean;
  max_limit?: number;
  is_active: boolean;
  description?: string;
}

export interface TreasuryTransferAttachment {
  id: number;
  transfer_id: number;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  document_type: "bank_receipt" | "transfer_voucher" | "approval_doc" | "other";
  notes?: string;
  created_by?: number;
  created_at: string;
}

export interface TreasuryTransferAuditLog {
  id: number;
  transfer_id: number;
  action_type: string;
  action?: string;
  old_values?: any;
  new_values?: any;
  user_id: number;
  user_name?: string;
  performed_by_name?: string;
  ip_address?: string;
  notes?: string;
  created_at: string;
}

export interface TreasuryTransfer {
  id: number;
  transfer_number: string;
  transfer_type_id?: number;
  transfer_type: TransferCategoryType | string;
  transfer_type_name?: string;
  
  // Source Details
  source_account_id: number;
  source_account_name?: string;
  source_account_type?: "cash" | "bank" | "petty_cash";
  source_account_code?: string;
  source_branch_id?: number;
  source_branch_name?: string;
  source_cost_center_id?: number;
  source_cost_center_name?: string;
  source_balance_before?: number;
  source_balance_after?: number;

  // Destination Details
  destination_account_id: number;
  destination_account_name?: string;
  destination_account_type?: "cash" | "bank" | "petty_cash";
  destination_account_code?: string;
  destination_branch_id?: number;
  destination_branch_name?: string;
  destination_cost_center_id?: number;
  destination_cost_center_name?: string;
  destination_balance_before?: number;
  destination_balance_after?: number;

  // Dates & Financial amounts
  transfer_date: string;
  value_date?: string;
  source_currency: string;
  destination_currency: string;
  amount: number;
  exchange_rate: number;
  destination_amount: number;
  exchange_difference: number;
  
  // Fees & Commissions
  transfer_fee: number;
  fee_currency: string;
  fee_account_id?: number;
  fee_account_name?: string;
  fee_borne_by: "source" | "destination" | "company";

  // Classifications & Descriptions
  purpose?: string;
  category?: string;
  statement?: string;
  notes?: string;
  status: TreasuryTransferStatus;

  // Users & Workflow Trackers
  sender_user_id?: number;
  sender_user_name?: string;
  receiver_user_id?: number;
  receiver_user_name?: string;
  submitted_by?: number;
  submitted_by_name?: string;
  submitted_at?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  approval_notes?: string;
  executed_by?: number;
  executed_by_name?: string;
  executed_at?: string;
  received_by?: number;
  received_by_name?: string;
  received_at?: string;
  receipt_notes?: string;
  rejected_by?: number;
  rejected_by_name?: string;
  rejected_at?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  
  // Reversal Trackers
  reversed_at?: string;
  reversed_by?: number;
  reversed_by_name?: string;
  reversal_transfer_id?: number;
  reversal_transfer_number?: string;
  reversal_reason?: string;

  // Accounting & GL Integration
  journal_entry_id?: number;
  journal_entry_number?: string;
  source_transaction_id?: number;
  destination_transaction_id?: number;

  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;

  // Embedded Children
  attachments?: TreasuryTransferAttachment[];
  audit_logs?: TreasuryTransferAuditLog[];
}

export interface TreasuryTransferKPI {
  today_count: number;
  today_amount: number;
  draft_count: number;
  pending_approval_count: number;
  approved_count: number;
  executed_in_transit_count: number;
  pending_receipt_count: number;
  completed_posted_count: number;
  cancelled_count: number;
  reversed_count: number;
  total_transfers_count: number;
  total_transferred_amount: number;
  total_fees_amount: number;
}

// ═══════════════════════════════════════════════════════════════
// ERP GL — General Ledger & Professional Accounting Types
// ═══════════════════════════════════════════════════════════════

export interface GLAccount {
  id: number;
  code: string;
  name: string;
  name_ar: string;
  name_en?: string;
  parent_id?: number | null;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  account_type?: string;
  account_nature?: 'debit' | 'credit';
  level: number;
  is_leaf: boolean;
  allow_posting: boolean;
  status: boolean;
  balance: number;
  children?: GLAccount[];
}

export interface JournalEntry {
  id: number;
  date: string;
  description?: string;
  reference?: string;
  status: 'draft' | 'posted' | 'approved' | 'canceled';
  source_type?: 'manual' | 'sales' | 'purchase' | 'payroll' | 'treasury' | 'cost' | 'closing' | 'adjustment';
  source_id?: number;
  total_debit: number;
  total_credit: number;
  period_id?: number;
  period_name?: string;
  created_by?: number;
  created_by_name?: string;
  branch_id?: number;
  approved_by?: number;
  approved_at?: string;
  created_at: string;
  items?: JournalItem[];
}

export interface JournalItem {
  id: number;
  journal_entry_id: number;
  account_id: number;
  account_name?: string;
  account_code?: string;
  debit: number;
  credit: number;
  notes?: string;
  cost_center_id?: number;
  cost_center_name?: string;
}

export interface FiscalYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  created_by?: number;
  created_at: string;
  closed_at?: string;
  periods?: FinancialPeriod[];
}

export interface FinancialPeriod {
  id: number;
  fiscal_year_id?: number;
  month: number;
  year: number;
  status: 'open' | 'closed';
  start_date?: string;
  end_date?: string;
  closed_at?: string;
  closed_by?: number;
}

export interface CostCenter {
  id: number;
  name: string;
  code: string;
  notes?: string;
}

export interface GLAuditLog {
  id: number;
  table_name: string;
  record_id: number;
  action: 'create' | 'update' | 'delete' | 'approve' | 'close' | 'reopen';
  old_values?: any;
  new_values?: any;
  user_id: number;
  user_name?: string;
  ip_address?: string;
  created_at: string;
}

export interface Budget {
  id: number;
  name: string;
  fiscal_year_id: number;
  account_id: number;
  account_name?: string;
  account_code?: string;
  cost_center_id?: number;
  branch_id?: number;
  monthly_amount: number;
  annual_amount: number;
  actual_amount: number;
  variance: number;
  variance_percent: number;
  notes?: string;
  status: 'active' | 'frozen' | 'closed';
  created_by?: number;
  created_at: string;
}

export interface AccountConfig {
  key: string;
  account_id?: number;
  account_name?: string;
  account_code?: string;
  description?: string;
}

export interface SubLedgerEntry {
  id: number;
  journal_item_id: number;
  partner_type: 'customer' | 'supplier' | 'employee';
  partner_id: number;
  partner_name?: string;
  due_date?: string;
  amount: number;
  remaining_amount: number;
  status: 'open' | 'partial' | 'settled';
  created_at: string;
}

export interface DocumentSequence {
  document_type: string;
  prefix: string;
  current_number: number;
  padding: number;
  next_number: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Organization {
  id: number;
  org_code: string;
  org_name_ar: string;
  org_name_en?: string;
  logo?: string;
  address?: string;
  tax_number?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AutoPostingConfig {
  source_type: 'sales' | 'purchase' | 'payroll' | 'treasury' | 'cost' | 'adjustment';
  enabled: boolean;
  auto_post: boolean;
  account_mappings: Record<string, string>;
}
