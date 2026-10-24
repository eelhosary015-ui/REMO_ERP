export interface WorkCenter {
  id: string;
  code: string;
  name: string;
  type: 'machine' | 'line' | 'labor';
  capacity: number;
  costPerHour: number;
  efficiency: number;
  location?: string;
  status?: 'active' | 'maintenance' | 'idle';
  supervisor?: string;
  dailyHours?: number;
  shifts?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    workersCount: number;
    activeDays: string[];
    hrShiftId?: string | number;
    assignedEmployees?: {
      id: string | number;
      name: string;
    }[];
  }[];
  laborCost?: number;      // تكلفة العمالة المباشرة في الساعة
  machineCost?: number;    // تكلفة الماكينة/الطاقة في الساعة
  overheadCost?: number;   // التكاليف غير المباشرة/المصروفات الإضافية في الساعة
}

export interface ProductDef {
  id: string;
  code: string;
  name: string;
  category: string;
  type: 'raw' | 'semi_finished' | 'finished' | 'by_product';
  unit: string;
  costMethod: string;
  plmStatus?: 'under_design' | 'development' | 'approved' | 'deprecated'; // PLM Status
  version?: string;
  image?: string; // صورة المنتج
  brand?: string; // العلامة التجارية (اختياري)
  inventoryData?: {
    minQty?: number;
    maxQty?: number;
    currentStock?: number;
    location?: string;
  }; // بيانات المخزون
  manufacturingData?: {
    leadTimeDays?: number; // فترة التوريد/التصنيع بالأيام
    batchSizeRatio?: number; // الحجم القياسي للدفعة
    scrapRate?: number; // نسبة الهدر المتوقعة %
    defaultWorkCenterId?: string; // مركز العمل الافتراضي
  }; // بيانات التصنيع
  sourceType?: 'pos' | 'warehouse' | 'custom';
  sourceId?: string | number;
}

export interface RoutingOp {
  id: string;
  opNumber: number;
  description: string;
  workCenterId: string;
  setupTime: number; // minutes
  runTime: number; // minutes
  isExternal?: boolean; // Subcontracting flag
  subcontractorName?: string; // Subcontractor company name
  subcontractCost?: number; // Cost of external processing
}

export interface BillOfMaterial {
  id: string;
  productId: string;
  name: string;
  version: string;
  scrapPercentage: number;
  items: {
    materialId: string;
    quantity: number;
  }[];
  routings: RoutingOp[];
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  productName?: string;
  quantity: number;
  bomId: string;
  startDate: string;
  endDate: string;
  priority: 'low' | 'normal' | 'high';
  status: 'draft' | 'planned' | 'released' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
  progress: number;
  salesReference?: string;
  workCenterId?: string;
  notes?: string;
  supervisor?: string;
  lotNumber?: string; // Batch/Lot tracking identifier
  materialsIssued?: boolean; // Material Issue flag
  materialsReturned?: boolean; // Material Return flag
  issuedItems?: { materialId: string; quantityNeeded: number; quantityIssued: number; returned?: number }[];
  rawWarehouseId?: number;
  finishedWarehouseId?: number;
  is_executed?: boolean;
  executed_at?: string;
  executed_by?: string;
  totalCost?: number;
  costPerUnit?: number;
  laborCost?: number;
  overheadCost?: number;
  otherCost?: number;
  bomSnapshot?: any;
}

export interface QualityCheck {
  id: string;
  orderId: string;
  type: 'incoming' | 'in_process' | 'final';
  status: 'pending' | 'accepted' | 'rejected' | 'rework';
  notes: string;
}

// 8. Labor Interface
export interface LaborWorker {
  id: string;
  name: string;
  code: string;
  role: string;
  hourlyRate: number;
  otRate: number;
  assignedWorkCenterId: string;
  totalRegularHours: number;
  totalOtHours: number;
}

// 9. Downtime Log Interface
export interface DowntimeLog {
  id: string;
  workCenterId: string;
  reason: 'breakdown' | 'power_cut' | 'no_material' | 'maintenance' | 'other';
  durationMinutes: number;
  date: string;
  description: string;
}

// 11. Engineering Change Notice (ECN) Interface
export interface ECNRecord {
  id: string;
  targetBomId: string;
  changeCode: string;
  title: string;
  requestedBy: string;
  date: string;
  reason: string;
  previousVersion: string;
  newVersion: string;
  status: 'draft' | 'approved' | 'implemented';
}
