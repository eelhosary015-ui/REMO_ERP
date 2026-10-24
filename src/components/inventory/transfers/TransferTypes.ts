export type TransferStatus = 
  | "draft"
  | "requested"
  | "pending"
  | "approved"
  | "rejected"
  | "picking"
  | "dispatched"
  | "in_transit"
  | "receiving"
  | "qc_inspection"
  | "received_partially"
  | "received"
  | "completed"
  | "cancelled";

export type TransferType = 
  | "standard"
  | "urgent"
  | "replenishment"
  | "inter_branch"
  | "department_issue"
  | "return_to_hub"
  | "damaged_transfer";

export type TransferPriority = "low" | "normal" | "high" | "urgent";

export interface TransferItem {
  ingredient_id: number;
  name: string;
  code: string;
  unit: string;
  barcode?: string;
  quantity?: number;
  price?: number;
  requested_qty: number;
  approved_qty?: number;
  dispatched_qty?: number;
  received_qty?: number;
  damaged_qty?: number;
  variance_qty?: number;
  unit_cost?: number;
  batch_number?: string;
  expiry_date?: string | null;
  serial_number?: string;
  source_location_code?: string;
  target_location_code?: string;
  qc_item_status?: string;
  notes?: string;
  source_available_qty?: number;
  source_total_qty?: number;
  destination_current_qty?: number;
  destination_in_transit_qty?: number;
}

export interface StatusHistoryEntry {
  status: TransferStatus;
  action: string;
  user: string;
  timestamp: string;
  notes?: string;
}

export interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  transfer_no?: string;
  date: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  from_warehouse_name?: string;
  from_warehouse_code?: string;
  to_warehouse_name?: string;
  to_warehouse_code?: string;
  from_manager?: string;
  to_manager?: string;
  type: TransferType;
  priority: TransferPriority;
  department?: string;
  purpose?: string;
  status: TransferStatus;
  user: string;
  notes?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_no?: string;
  waybill_no?: string;
  shipping_cost?: number;
  dispatched_at?: string;
  dispatched_by?: string;
  received_at?: string;
  received_by?: string;
  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejected_reason?: string;
  qc_status?: string;
  qc_notes?: string;
  items: TransferItem[] | string;
  status_history?: StatusHistoryEntry[] | string;
  items_count?: number;
  total_qty?: number;
  total_value?: number;
  created_at?: string;
  updated_at?: string;
  related_transactions?: any[];
}

export interface TransferStats {
  total: number;
  pending_count: number;
  approved_count: number;
  in_transit_count: number;
  receiving_count: number;
  completed_count: number;
  cancelled_count: number;
}
