/**
 * Types & Interfaces for Hotel PMS Module
 * // تمت الاضافة: تعريفات TypeScript الصارمة بدون any
 */

export interface HotelProperty {
  id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  manager?: string;
  floors_count: number;
  rooms_count: number;
  currency: string;
  tax_rate: number;
  checkin_time: string;
  checkout_time: string;
  status: "active" | "inactive";
  created_at?: string;
}

export interface RoomType {
  id: number;
  hotel_id: number;
  name: string;
  code?: string;
  capacity: number;
  beds_count: number;
  base_price: number;
  description?: string;
  amenities?: string;
  images?: string;
  status?: string;
  created_at?: string;
}

export interface HotelRoom {
  id: number;
  hotel_id: number;
  room_number: string;
  room_type_id: number;
  room_type_name?: string;
  room_type_code?: string;
  hotel_name?: string;
  floor: number;
  capacity: number;
  price: number;
  status: "available" | "occupied" | "reserved" | "dirty" | "maintenance" | "cleaning";
  occupancy_status?: "vacant" | "occupied" | "reserved";
  housekeeping_status: "clean" | "dirty" | "cleaning" | "inspected";
  maintenance_status: "ok" | "operational" | "out_of_order" | "out_of_service" | "under_maintenance";
  amenities?: string;
  notes?: string;
  created_at?: string;
}

export interface HotelGuest {
  id: number;
  full_name: string;
  nationality: string;
  id_number?: string;
  passport_number?: string;
  dob?: string;
  gender?: "male" | "female";
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  id_photo_front?: string;
  id_photo_back?: string;
  personal_photo?: string;
  passport_photo?: string;
  marriage_cert_photo?: string;
  document_type?: string;
  documents_verified?: boolean;
  vip_level?: string;
  loyalty_points?: number;
  loyalty_tier?: "Silver" | "Gold" | "Platinum" | "VIP";
  corporate_account?: string;
  stays_count?: number;
  total_spent?: number;
  last_visit_date?: string;
  current_room_number?: string;
  created_at?: string;
}

export interface HotelReservation {
  id: number;
  reservation_number: string;
  hotel_id: number;
  hotel_name?: string;
  guest_id: number;
  guest_name?: string;
  guest_phone?: string;
  guest_nationality?: string;
  guest_id_number?: string;
  guest_passport_number?: string;
  guest_id_photo_front?: string;
  guest_passport_photo?: string;
  guest_personal_photo?: string;
  guest_marriage_cert_photo?: string;
  room_id: number;
  room_number?: string;
  room_type_id: number;
  room_type_name?: string;
  check_in_date: string;
  check_out_date: string;
  actual_check_in?: string;
  actual_check_out?: string;
  nights_count: number;
  adults: number;
  children: number;
  room_rate: number;
  discount?: number;
  tax_amount?: number;
  total_amount: number;
  paid_amount: number;
  deposit_amount?: number;
  remaining_amount: number;
  payment_method?: string;
  reservation_source?: string;
  status: "pending" | "confirmed" | "guaranteed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  notes?: string;
  id_photo_front?: string;
  id_photo_back?: string;
  personal_photo?: string;
  passport_photo?: string;
  marriage_cert_photo?: string;
  document_type?: string;
  created_at?: string;
}

export interface FolioCharge {
  id: number;
  folio_id: number;
  type: "room_charge" | "tax" | "payment" | "restaurant" | "room_service" | "minibar" | "laundry" | "transport" | "spa" | "deposit" | "refund" | "other";
  description: string;
  amount: number;
  reference_id?: string;
  created_at?: string;
}

export interface HotelFolio {
  id: number;
  reservation_id: number;
  guest_id: number;
  room_id: number;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  paid_total: number;
  balance: number;
  status: "open" | "settled" | "closed";
  charges?: FolioCharge[];
  created_at?: string;
}

export interface HousekeepingTask {
  id: number;
  hotel_id: number;
  hotel_name?: string;
  room_id: number;
  room_number?: string;
  floor?: number;
  room_type_name?: string;
  cleaning_status: "clean" | "dirty" | "cleaning" | "inspected";
  assigned_staff_name?: string;
  notes?: string;
  last_cleaned_at?: string;
  created_at?: string;
}

export interface MaintenanceTicket {
  id: number;
  hotel_id: number;
  hotel_name?: string;
  room_id: number;
  room_number?: string;
  floor?: number;
  problem: string;
  priority: "low" | "medium" | "high" | "urgent";
  description?: string;
  assigned_technician_name?: string;
  cost: number;
  status: "open" | "in_progress" | "resolved" | "closed";
  resolution_notes?: string;
  completed_at?: string;
  created_at?: string;
}

export interface HotelService {
  id: number;
  hotel_id: number;
  name: string;
  code?: string;
  category: "housekeeping" | "laundry" | "room_service" | "spa" | "transport" | "maintenance" | "minibar" | "other";
  price: number;
  unit: string;
  tax_rate: number;
  estimated_time_minutes: number;
  description?: string;
  icon?: string;
  is_active: boolean;
  created_at?: string;
}

export interface ServiceOrder {
  id: number;
  hotel_id: number;
  service_id?: number;
  service_name: string;
  service_category: string;
  reservation_id?: number;
  guest_id?: number;
  guest_name?: string;
  room_id?: number;
  room_number: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  total_price: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  staff_name?: string;
  notes?: string;
  folio_charge_id?: number;
  created_at?: string;
}

export interface NightAuditRecord {
  id: number;
  hotel_id: number;
  audit_date: string;
  total_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  occupancy_rate: number;
  total_room_revenue: number;
  total_service_revenue: number;
  total_tax: number;
  grand_total_revenue: number;
  audited_by: string;
  audit_notes?: string;
  status: "closed" | "in_progress";
  created_at?: string;
}

export interface DashboardMetrics {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  dirtyRooms: number;
  maintenanceRooms: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  todayArrivals: number;
  todayDepartures: number;
  totalGuests: number;
  dailyRevenue: number;
  overdueInvoicesCount?: number;
  criticalSuppliesCount?: number;
}

export interface InventorySupplyItem {
  id: number;
  name: string;
  code: string;
  category: string;
  total_stock: number;
  unit: string;
  min_stock: number;
  avg_cost: number;
}

export interface RevenueReportData {
  total_revenue: number;
  room_revenue: number;
  extra_charges: number;
  total_tax: number;
  total_paid: number;
  total_remaining: number;
  daily_breakdown?: Array<{
    date: string;
    rooms_revenue: number;
    services_revenue: number;
    taxes: number;
    total: number;
  }>;
}

export interface GuestBalanceRow {
  reservation_id: number;
  reservation_number: string;
  guest_id: number;
  guest_name: string;
  guest_phone: string;
  room_number: string;
  check_in_date: string;
  check_out_date: string;
  folio_id: number;
  grand_total: number;
  paid_total: number;
  balance: number;
  folio_status: string;
}
