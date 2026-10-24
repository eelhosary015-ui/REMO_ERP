import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Building2,
  Calendar,
  Users,
  User,
  Receipt,
  PlusCircle,
  Box,
  Layers,
  CheckCircle2,
  Clock,
  Wrench,
  Sparkles,
  DollarSign,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  AlertTriangle,
  Hotel,
  Key,
  LogOut,
  BedDouble,
  ShoppingCart,
  FileText,
  CreditCard,
  Phone,
  Mail,
  UserCheck,
  Check,
  Settings,
  ShieldCheck,
  Warehouse,
  CalendarDays,
  Trash2,
  Package,
  PackagePlus,
  ArrowUpRight,
  Edit3,
  Grid,
  List,
  SlidersHorizontal,
  AlertCircle,
  Download,
  FileSpreadsheet,
  UserPlus,
  History,
  CalendarPlus,
  Eye,
  ExternalLink,
  MapPin,
  Globe,
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  ArrowRightLeft,
  Shirt,
  Utensils,
  Car,
  Heart,
  Coffee,
  Bed,
  CheckCircle,
  Tag,
  Flame,
  Zap,
  ConciergeBell,
  BarChart3,
  PieChart,
  Wallet,
  Banknote,
  Award,
  Activity,
  CheckSquare,
  FileCheck
} from "lucide-react";
import { HotelReportsTab } from "./hotel/HotelReportsTab";

interface HotelManagementProps {
  currentTab?: string;
  userPermissions?: any;
  onBack?: () => void;
}

export const HotelManagement: React.FC<HotelManagementProps> = ({ currentTab = "dashboard", userPermissions, onBack }) => {
  const [activeTab, setActiveTab] = useState<string>(currentTab || "dashboard");
  const [settingsTab, setSettingsTab] = useState<string>("policies");
  const [loading, setLoading] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<any>({
    totalRooms: 20,
    availableRooms: 12,
    occupiedRooms: 5,
    reservedRooms: 1,
    dirtyRooms: 1,
    maintenanceRooms: 1,
    todayCheckins: 2,
    todayCheckouts: 1,
    todayRevenue: 13600,
    occupancyRate: 25,
    adr: 2720,
    revpar: 680
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [housekeeping, setHousekeeping] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);

  // Modals & UI States
  const [showResModal, setShowResModal] = useState<boolean>(false);
  const [showRoomModal, setShowRoomModal] = useState<boolean>(false);
  const [showGuestModal, setShowGuestModal] = useState<boolean>(false);
  const [showChargeModal, setShowChargeModal] = useState<boolean>(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<boolean>(false);
  const [showFolioModal, setShowFolioModal] = useState<boolean>(false);
  const [showPropertyModal, setShowPropertyModal] = useState<boolean>(false);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState<boolean>(false);
  const [showFloorModal, setShowFloorModal] = useState<boolean>(false);
  const [showSupplyModal, setShowSupplyModal] = useState<boolean>(false);
  const [showStockAdjustModal, setShowStockAdjustModal] = useState<boolean>(false);
  const [activeFolio, setActiveFolio] = useState<any>(null);

  // Document Preview & Camera states
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>("");
  const [cameraActiveTarget, setCameraActiveTarget] = useState<string | null>(null);

  // Guest Documents Archive State
  const [showGuestDocsModal, setShowGuestDocsModal] = useState<boolean>(false);
  const [currentDocsGuest, setCurrentDocsGuest] = useState<any | null>(null);
  const [guestDocsList, setGuestDocsList] = useState<any[]>([]);
  const [loadingGuestDocs, setLoadingGuestDocs] = useState<boolean>(false);
  const [newGuestDocForm, setNewGuestDocForm] = useState<any>({
    document_type: "national_id_front",
    title: "بطاقة الرقم القومي (الوجه الأمامي)",
    document_number: "",
    expiry_date: "",
    file_url: "",
    notes: ""
  });

  // Hotel Reports State
  const [reportSubTab, setReportSubTab] = useState<string>("kpis");
  const [policeReportList, setPoliceReportList] = useState<any[]>([]);
  const [revenueReportData, setRevenueReportData] = useState<any>(null);
  const [guestBalancesList, setGuestBalancesList] = useState<any[]>([]);
  const [nightAuditsList, setNightAuditsList] = useState<any[]>([]);
  const [reportHotelFilter, setReportHotelFilter] = useState<string>("hotel_supplies");
  const [showResolveMaintenanceModal, setShowResolveMaintenanceModal] = useState<boolean>(false);
  const [resolveMaintenanceForm, setResolveMaintenanceForm] = useState<{id: number | null, notes: string}>({ id: null, notes: "" });
  const [reportDateFilter, setReportDateFilter] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reportEndDateFilter, setReportEndDateFilter] = useState<string>(new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0]);
  const [reportPoliceSearch, setReportPoliceSearch] = useState<string>("");
  const [reportGeneralSearch, setReportGeneralSearch] = useState<string>("");
  const [reportChannelFilter, setReportChannelFilter] = useState<string>("hotel_supplies");
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("hotel_supplies");
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Occupied Room Details Modal State
  const [showOccupiedModal, setShowOccupiedModal] = useState<boolean>(false);
  const [occupiedRoomDetails, setOccupiedRoomDetails] = useState<any>(null);
  const [loadingOccupiedDetails, setLoadingOccupiedDetails] = useState<boolean>(false);
  const [quickPaymentAmount, setQuickPaymentAmount] = useState<number>(0);
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<string>("cash");

  // Services Catalog & Orders States
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [serviceOrdersList, setServiceOrdersList] = useState<any[]>([]);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>("hotel_supplies");
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>("hotel_supplies");
  const [selectedRoomForService, setSelectedRoomForService] = useState<string>("");
  const [showAddServiceModal, setShowAddServiceModal] = useState<boolean>(false);
  const [showOrderServiceModal, setShowOrderServiceModal] = useState<boolean>(false);
  const [selectedServiceToOrder, setSelectedServiceToOrder] = useState<any | null>(null);
  const [serviceOrderForm, setServiceOrderForm] = useState<any>({
    service_id: "",
    service_name: "",
    service_category: "housekeeping",
    room_number: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 14,
    staff_name: "طاقم الخدمة الفندقية",
    notes: "",
    charge_to_folio: true
  });
  const [serviceCatalogForm, setServiceCatalogForm] = useState<any>({
    id: undefined,
    hotel_id: 1,
    name: "",
    code: "",
    category: "housekeeping",
    price: 150,
    unit: "مرة",
    tax_rate: 14,
    estimated_time_minutes: 30,
    description: "",
    icon: "Sparkles",
    is_active: true
  });
  const [housekeepingTabMode, setHousekeepingTabMode] = useState<"services" | "orders_log" | "cleaning_schedule" | "maintenance_log">("services");

  // Room Move / Transfer State
  const [showRoomMoveModal, setShowRoomMoveModal] = useState<boolean>(false);
  const [targetMoveRoomId, setTargetMoveRoomId] = useState<string>("");

  // Reservations Filter & Search State
  const [resSearchQuery, setResSearchQuery] = useState<string>("");
  const [resStatusFilter, setResStatusFilter] = useState<string>("hotel_supplies");

  // Guest Management & Visits Directory State
  const [selectedGuestProfile, setSelectedGuestProfile] = useState<any>(null);
  const [showGuestProfileModal, setShowGuestProfileModal] = useState<boolean>(false);
  const [loadingGuestProfile, setLoadingGuestProfile] = useState<boolean>(false);
  const [showGuestEditModal, setShowGuestEditModal] = useState<boolean>(false);
  const [guestSearchQuery, setGuestSearchQuery] = useState<string>("");
  const [guestNationalityFilter, setGuestNationalityFilter] = useState<string>("hotel_supplies");
  const [guestVisitFilter, setGuestVisitFilter] = useState<string>("hotel_supplies");
  const [guestPage, setGuestPage] = useState<number>(1);
  const [guestPageSize, setGuestPageSize] = useState<number>(15);

  const [guestEditForm, setGuestEditForm] = useState<any>({
    id: undefined,
    full_name: "",
    nationality: "مصري",
    id_number: "",
    passport_number: "",
    dob: "",
    gender: "male",
    phone: "",
    email: "",
    address: "",
    notes: "",
    document_type: "national_id",
    id_photo_front: "",
    id_photo_back: "",
    personal_photo: "",
    passport_photo: "",
    marriage_cert_photo: ""
  });

  // Central Inventory Integration State
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>("hotel_supplies");
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>("hotel_supplies");
  const [inventoryViewMode, setInventoryViewMode] = useState<"grid" | "table">("grid");
  const [selectedItemForStock, setSelectedItemForStock] = useState<any>(null);

  // Form states
  const [floors, setFloors] = useState<number[]>([1, 2, 3, 4]);
  const [newFloorNumber, setNewFloorNumber] = useState<number>(5);

  const [supplyForm, setSupplyForm] = useState({
    name: "",
    code: "",
    category: "بياضات ومفروشات",
    unit: "طقم",
    min_stock: 10,
    max_stock: 100,
    avg_cost: 0,
    last_purchase_price: 0,
    barcode: "",
    warehouse_id: ""
  });

  const [stockAdjustForm, setStockAdjustForm] = useState({
    quantity: 10,
    type: "in",
    notes: "تسوية / توريد بياضات ومستلزمات فندقية للمخزن",
    warehouse_id: ""
  });

  const [propertyForm, setPropertyForm] = useState({
    name: "", code: "", manager: "", phone: "", floors_count: 5, rooms_count: 50, tax_rate: 14, checkin_time: "14:00", checkout_time: "12:00"
  });

  const [roomTypeForm, setRoomTypeForm] = useState({
    name: "", code: "", description: "", base_price: 1000, capacity: 2, beds_count: 1, amenities: ""
  });

  const [roomForm, setRoomForm] = useState({
    room_number: "", floor: 1, room_type_id: "", property_id: 1, price: 1000, status: "available", features: ""
  });

  const [resForm, setResForm] = useState({
    guest_name: "",
    guest_phone: "",
    guest_email: "",
    guest_nationality: "مصري",
    guest_id_number: "",
    guest_passport_number: "",
    guest_gender: "male",
    guest_address: "",
    document_type: "national_id",
    id_photo_front: "",
    id_photo_back: "",
    personal_photo: "",
    passport_photo: "",
    marriage_cert_photo: "",
    room_type_id: "",
    room_id: "",
    check_in_date: new Date().toISOString().split("T")[0],
    check_out_date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    nights_count: 2,
    adults: 2,
    children: 0,
    room_rate: 1800,
    paid_amount: 0,
    deposit_amount: 0,
    payment_method: "cash",
    notes: ""
  });

  // Client-side image processor for document scanning and resizing
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        alert("يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP)");
        return reject("Not an image");
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const startCamera = async (targetField: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      setCameraActiveTarget(targetField);
    } catch (err: any) {
      alert("تعذر فتح الكاميرا: " + (err.message || "يرجى التأكد من توصيل الكاميرا ومنح الصلاحية للمتصفح"));
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActiveTarget(null);
  };

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, cameraActiveTarget]);

  const captureCameraPhoto = () => {
    if (!videoRef.current || !cameraActiveTarget) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

      if (cameraActiveTarget.startsWith("res_")) {
        const fieldName = cameraActiveTarget.replace("res_", "");
        setResForm((prev: any) => ({ ...prev, [fieldName]: dataUrl }));
      } else if (cameraActiveTarget.startsWith("guest_")) {
        const fieldName = cameraActiveTarget.replace("guest_", "");
        setGuestEditForm((prev: any) => ({ ...prev, [fieldName]: dataUrl }));
      } else if (cameraActiveTarget === "new_guest_doc_file") {
        setNewGuestDocForm((prev: any) => ({ ...prev, file_url: dataUrl }));
      }
    }
    stopCamera();
  };

  const [chargeForm, setChargeForm] = useState({
    room_number: "102",
    description: "خدمة غرف - وجبة عشاء فاخرة",
    amount: 450
  });

  const [maintForm, setMaintForm] = useState({
    room_id: "",
    problem: "",
    priority: "medium",
    description: "",
    cost: 0
  });

  // Sync tab from props if changed
  useEffect(() => {
    if (currentTab) setActiveTab(currentTab);
  }, [currentTab]);

  // Fetch central inventory and warehouse data
  const fetchInventoryData = async () => {
    try {
      const [ingRes, whRes] = await Promise.all([
        api.get("/api/ingredients").then(r => r.json()).catch(() => []),
        api.get("/api/warehouses").then(r => r.json()).catch(() => [])
      ]);

      let items = Array.isArray(ingRes) ? ingRes : (ingRes?.data || []);
      let whs = Array.isArray(whRes) ? whRes : (whRes?.data || []);

      // Seed hotel supplies if central inventory has no items yet
      if (!items || items.length === 0) {
        const defaultHotelSupplies = [
          { name: "مناشف قطنية فاخرة (Bath Towels)", code: "TWL-101", category: "بياضات ومفروشات", unit: "طقم", min_stock: 30, last_purchase_price: 250, avg_cost: 250, total_stock: 150 },
          { name: "أطقم ملاءات فندقية ملكية (King Bed Linens)", code: "LIN-102", category: "بياضات ومفروشات", unit: "طقم", min_stock: 20, last_purchase_price: 450, avg_cost: 450, total_stock: 85 },
          { name: "مجموعات الشامبو والصابون الفاخرة", code: "KIT-201", category: "مستلزمات نظافة ورعاية", unit: "عبوة", min_stock: 100, last_purchase_price: 15, avg_cost: 15, total_stock: 420 },
          { name: "نعال غرف فندقية (Hotel Slippers)", code: "SLP-202", category: "مستلزمات نزلاء", unit: "زوج", min_stock: 50, last_purchase_price: 30, avg_cost: 30, total_stock: 300 },
          { name: "مستلزمات ميني بار - مشروبات وسناكس", code: "MBR-301", category: "ميني بار ومشروبات", unit: "قطعة", min_stock: 50, last_purchase_price: 25, avg_cost: 25, total_stock: 230 },
          { name: "أرواب حمام فندقية مطرزة (Bathrobes)", code: "ROB-103", category: "بياضات ومفروشات", unit: "رداء", min_stock: 15, last_purchase_price: 600, avg_cost: 600, total_stock: 45 }
        ];

        for (const sup of defaultHotelSupplies) {
          try {
            await api.post("/api/ingredients", sup);
          } catch (e) {
            console.error("Error seeding supply:", e);
          }
        }
        const ingRes2 = await api.get("/api/ingredients").then(r => r.json()).catch(() => []);
        items = Array.isArray(ingRes2) ? ingRes2 : [];
      }

      setInventoryItems(items);
      setWarehouses(whs);
    } catch (e) {
      console.error("Error fetching inventory data:", e);
    }
  };

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      let [mRes, pRes, rtRes, rRes, resRes, gRes, hkRes, mntRes, srvRes, ordRes] = await Promise.all([
        api.get("/api/v2/hotel/dashboard").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/properties").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/room-types").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/rooms").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/reservations").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/guests").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/housekeeping").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/maintenance").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/services").then(r => r.json()).catch(() => null),
        api.get("/api/v2/hotel/service-orders").then(r => r.json()).catch(() => null)
      ]);

      // If database is empty or not seeded yet, seed demo data automatically
      if (!pRes?.data || pRes.data.length === 0 || !rRes?.data || rRes.data.length === 0) {
        console.log("Hotel database empty, auto seeding demo data...");
        await api.post("/api/v2/hotel/seed-data", {});
        const [mRes2, pRes2, rtRes2, rRes2, resRes2, gRes2, hkRes2, mntRes2, srvRes2, ordRes2] = await Promise.all([
          api.get("/api/v2/hotel/dashboard").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/properties").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/room-types").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/rooms").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/reservations").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/guests").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/housekeeping").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/maintenance").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/services").then(r => r.json()).catch(() => null),
          api.get("/api/v2/hotel/service-orders").then(r => r.json()).catch(() => null)
        ]);
        mRes = mRes2; pRes = pRes2; rtRes = rtRes2; rRes = rRes2;
        resRes = resRes2; gRes = gRes2; hkRes = hkRes2; mntRes = mntRes2;
        srvRes = srvRes2; ordRes = ordRes2;
      }

      if (mRes?.data) setMetrics(mRes.data);
      if (pRes?.data) setProperties(pRes.data);
      if (rtRes?.data) setRoomTypes(rtRes.data);
      if (rRes?.data) setRooms(rRes.data);
      if (resRes?.data) setReservations(resRes.data);
      if (gRes?.data) setGuests(gRes.data);
      if (hkRes?.data) setHousekeeping(hkRes.data);
      if (mntRes?.data) setMaintenance(mntRes.data);
      if (srvRes?.data) setServicesList(srvRes.data);
      if (ordRes?.data) setServiceOrdersList(ordRes.data);

      await fetchInventoryData();
    } catch (e) {
      console.error("Error loading hotel data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceCatalogForm.name?.trim()) {
      alert("يرجى إدخال اسم الخدمة");
      return;
    }
    try {
      const payload = {
        ...serviceCatalogForm,
        hotel_id: properties[0]?.id || 1,
        price: Number(serviceCatalogForm.price) || 0,
        tax_rate: Number(serviceCatalogForm.tax_rate) || 0,
        estimated_time_minutes: Number(serviceCatalogForm.estimated_time_minutes) || 30
      };

      if (serviceCatalogForm.id) {
        const res = await api.put(`/api/v2/hotel/services/${serviceCatalogForm.id}`, payload);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert("خطأ: " + (json.error || "فشل تعديل الخدمة"));
          return;
        }
        alert("✨ تم تحديث بيانات الخدمة بنجاح!");
      } else {
        const res = await api.post("/api/v2/hotel/services", payload);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert("خطأ: " + (json.error || "فشل إنشاء الخدمة"));
          return;
        }
        alert("✨ تم إضافة وتأسيس الخدمة الفندقية بنجاح!");
      }
      setShowAddServiceModal(false);
      setServiceCatalogForm({
        id: undefined,
        hotel_id: properties[0]?.id || 1,
        name: "",
        code: "",
        category: "housekeeping",
        price: 150,
        unit: "مرة",
        tax_rate: 14,
        estimated_time_minutes: 30,
        description: "",
        icon: "Sparkles",
        is_active: true
      });
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخدمة من دليل الخدمات؟")) return;
    try {
      const res = await api.delete(`/api/v2/hotel/services/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل حذف الخدمة"));
        return;
      }
      alert("تم حذف الخدمة بنجاح");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleOpenOrderServiceModal = (service?: any, preselectedRoom?: string) => {
    if (service) {
      setSelectedServiceToOrder(service);
      setServiceOrderForm({
        service_id: service.id,
        service_name: service.name,
        service_category: service.category,
        room_number: preselectedRoom || selectedRoomForService || (rooms.find(r => r.status === 'occupied')?.room_number || "102"),
        quantity: 1,
        unit_price: Number(service.price) || 0,
        tax_rate: Number(service.tax_rate !== undefined ? service.tax_rate : 14),
        staff_name: "طاقم الخدمة الفندقية",
        notes: "",
        charge_to_folio: true
      });
    } else {
      setSelectedServiceToOrder(null);
      setServiceOrderForm({
        service_id: servicesList[0]?.id || "",
        service_name: servicesList[0]?.name || "خدمة فندقية",
        service_category: servicesList[0]?.category || "housekeeping",
        room_number: preselectedRoom || selectedRoomForService || (rooms.find(r => r.status === 'occupied')?.room_number || "102"),
        quantity: 1,
        unit_price: Number(servicesList[0]?.price) || 150,
        tax_rate: 14,
        staff_name: "طاقم الخدمة الفندقية",
        notes: "",
        charge_to_folio: true
      });
    }
    setShowOrderServiceModal(true);
  };

  const handleExecuteServiceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceOrderForm.room_number) {
      alert("يرجى اختيار رقم الغرفة");
      return;
    }
    try {
      const res = await api.post("/api/v2/hotel/service-orders", {
        ...serviceOrderForm,
        hotel_id: properties[0]?.id || 1,
        quantity: Number(serviceOrderForm.quantity) || 1,
        unit_price: Number(serviceOrderForm.unit_price) || 0,
        tax_rate: Number(serviceOrderForm.tax_rate) || 0
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل تسجيل الخدمة للغرفة"));
        return;
      }
      alert(`✨ ${json.message || 'تم تسجيل الخدمة وتحميلها على فاتورة النزيل بنجاح!'}`);
      setShowOrderServiceModal(false);
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await api.put(`/api/v2/hotel/service-orders/${orderId}/status`, { status });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleSeedDemoData = async () => {
    if (!confirm("هل تريد إضافة بيانات تجريبية متكاملة لمديول الفنادق (فنادق، غرف، أجنحة، نزلاء، حجوزات، وفواتير)؟")) return;
    setLoading(true);
    try {
      const res = await api.post("/api/v2/hotel/seed-data", {});
      if (res.ok) {
        alert("✨ تم إضافة وتحديث البيانات التجريبية لمديول الفنادق بنجاح!");
        await fetchData();
      } else {
        const err = await res.json();
        alert("خطأ: " + (err.error || "فشل إضافة البيانات التجريبية"));
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء إضافة البيانات التجريبية: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Inventory & Supplies Integration
  const handleCreateSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/ingredients", {
        name: supplyForm.name,
        code: supplyForm.code || `HTL-SUP-${Date.now().toString().slice(-4)}`,
        category: supplyForm.category || "عام",
        unit: supplyForm.unit || "قطعة",
        min_stock: Number(supplyForm.min_stock) || 0,
        max_stock: Number(supplyForm.max_stock) || 100,
        last_purchase_price: Number(supplyForm.last_purchase_price) || 0,
        avg_cost: Number(supplyForm.avg_cost) || 0,
        barcode: supplyForm.barcode || ""
      });
      const json = await res.json();
      if (json.success || json.id) {
        alert("تمت إضافة صنف المستلزمات الفندقية بنجاح للمخازن المركزية!");
        setShowSupplyModal(false);
        setSupplyForm({
          name: "",
          code: "",
          category: "بياضات ومفروشات",
          unit: "طقم",
          min_stock: 10,
          max_stock: 100,
          avg_cost: 0,
          last_purchase_price: 0,
          barcode: "",
          warehouse_id: ""
        });
        fetchInventoryData();
      } else {
        alert("خطأ: " + (json.error || "فشل إضافة الصنف"));
      }
    } catch (err: any) {
      alert("خطأ في الاتصال: " + err.message);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForStock) return;
    try {
      const qty = Number(stockAdjustForm.quantity);
      const res = await api.post("/api/inventory-transactions", {
        type: stockAdjustForm.type === "in" ? "receive" : "issue",
        reason: "adjustment",
        notes: stockAdjustForm.notes || "تعديل رصيد مستلزمات الفندق بالمخزن",
        warehouse_id: stockAdjustForm.warehouse_id || (warehouses[0]?.id || 1),
        status: "approved",
        items: [
          {
            ingredient_id: selectedItemForStock.id,
            quantity: Math.abs(qty),
            price: selectedItemForStock.avg_cost || selectedItemForStock.last_purchase_price || 0
          }
        ]
      }).catch(() => null);

      alert("تم تسجيل حركة وتعديل رصيد صنف المستلزمات بنجاح!");
      setShowStockAdjustModal(false);
      setSelectedItemForStock(null);
      fetchInventoryData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleDeleteSupply = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف نهائياً من مخازن المنظومة المركزية؟")) return;
    try {
      const res = await api.delete(`/api/ingredients/${id}`);
      const json = await res.json();
      if (json.success || res.ok) {
        alert("تم حذف الصنف من المخازن بنجاح");
        fetchInventoryData();
      } else {
        alert("خطأ: " + (json.error || "فشل الحذف"));
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v2/hotel/properties", propertyForm);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل إضافة العقار"));
        return;
      }
      alert("تم إضافة العقار/الفندق بنجاح!");
      setShowPropertyModal(false);
      setPropertyForm({ name: "", code: "", manager: "", phone: "", floors_count: 5, rooms_count: 50, tax_rate: 14, checkin_time: "14:00", checkout_time: "12:00" });
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleDeleteProperty = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف هذا العقار بكل ما يرتبط به؟")) return;
    try {
      const res = await api.delete(`/api/v2/hotel/properties/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل حذف العقار"));
        return;
      }
      alert("تم حذف العقار بنجاح");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleCreateRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const hotel_id = properties.length > 0 ? properties[0].id : 1;
      const res = await api.post("/api/v2/hotel/room-types", { ...roomTypeForm, hotel_id });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل إضافة تصنيف الغرفة"));
        return;
      }
      alert("تم إضافة تصنيف الغرفة بنجاح!");
      setShowRoomTypeModal(false);
      setRoomTypeForm({ name: "", code: "", description: "", base_price: 1000, capacity: 2, beds_count: 1, amenities: "" });
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleDeleteRoomType = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف هذا التصنيف؟")) return;
    try {
      const res = await api.delete(`/api/v2/hotel/room-types/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل حذف تصنيف الغرفة"));
        return;
      }
      alert("تم حذف التصنيف بنجاح");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const hotel_id = roomForm.property_id || (properties.length > 0 ? properties[0].id : 1);
      const room_type_id = roomForm.room_type_id || (roomTypes.length > 0 ? roomTypes[0].id : null);
      const res = await api.post("/api/v2/hotel/rooms", { ...roomForm, hotel_id, room_type_id });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل إضافة الغرفة"));
        return;
      }
      alert("تم إضافة الغرفة بنجاح وتوليدها في المنظومة!");
      setShowRoomModal(false);
      setRoomForm({ room_number: "", floor: 1, room_type_id: "", property_id: properties[0]?.id || 1, price: 1000, status: "available", features: "" });
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف هذه الغرفة؟")) return;
    try {
      const res = await api.delete(`/api/v2/hotel/rooms/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل حذف الغرفة"));
        return;
      }
      alert("تم حذف الغرفة بنجاح");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleOpenOccupiedRoom = async (room: any) => {
    if (!room) return;
    if (room.status !== "occupied" && room.status !== "reserved") {
      setResForm({
        ...resForm,
        room_id: room.id.toString(),
        room_rate: room.price
      });
      setShowResModal(true);
      return;
    }

    setLoadingOccupiedDetails(true);
    setShowOccupiedModal(true);
    setOccupiedRoomDetails(null);
    setQuickPaymentAmount(0);

    try {
      const res = await api.get(`/api/v2/hotel/rooms/${room.id}/occupied-details`);
      const json = await res.json();
      if (json.success && json.data) {
        setOccupiedRoomDetails(json.data);
      } else {
        const activeRes = reservations.find(r => r.room_id === room.id && (r.status === 'checked_in' || r.status === 'confirmed'));
        if (activeRes) {
          const folioRes = await api.get(`/api/v2/hotel/folios/${activeRes.id}`).then(r => r.json()).catch(() => null);
          setOccupiedRoomDetails({
            room,
            reservation: activeRes,
            guest: {
              full_name: activeRes.guest_name,
              phone: activeRes.guest_phone,
              email: activeRes.guest_email || 'غير مدخل',
              nationality: activeRes.guest_nationality || 'مصري',
              id_number: activeRes.guest_id_number || 'غير مدخل',
              passport_number: activeRes.guest_passport_number || 'غير مدخل',
              gender: activeRes.guest_gender || 'male',
              address: activeRes.guest_address || 'غير مدخل'
            },
            folio: folioRes?.data || null
          });
        } else {
          setOccupiedRoomDetails({ room, reservation: null, guest: null, folio: null });
        }
      }
    } catch (err) {
      console.error("Error loading occupied room details:", err);
    } finally {
      setLoadingOccupiedDetails(false);
    }
  };

  const handleAddQuickPayment = async () => {
    if (!occupiedRoomDetails?.folio?.id) {
      alert("لا يوجد حساب (Folio) مفتوح لهذه الغرفة");
      return;
    }
    if (!quickPaymentAmount || quickPaymentAmount <= 0) {
      alert("يرجى إدخال مبلغ دفع صحيح");
      return;
    }

    try {
      const res = await api.post("/api/v2/hotel/folios/charge", {
        folio_id: occupiedRoomDetails.folio.id,
        type: "payment",
        description: `سداد دفعة / عربون إضافي (${quickPaymentMethod === 'cash' ? 'نقداً' : quickPaymentMethod === 'card' ? 'بطاقة ائتمان' : 'تحويل بنكي'})`,
        amount: -quickPaymentAmount
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل تسجيل الدفعة"));
        return;
      }
      alert(`تم تسجيل دفعة بقيمة ${quickPaymentAmount} ج.م بنجاح!`);
      setQuickPaymentAmount(0);
      handleOpenOccupiedRoom(occupiedRoomDetails.room);
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.guest_name?.trim()) {
      alert("يرجى إدخال اسم النزيل");
      return;
    }
    const hasDoc = !!(resForm.id_photo_front || resForm.passport_photo || resForm.personal_photo || resForm.marriage_cert_photo);
    if (!hasDoc) {
      alert("⚠️ متطلب إلزامي وأمني: يرجى سحب أو إرفاق صورة إثبات الهوية (بطاقة الرقم القومي أو جواز السفر أو الصورة الشخصية أو قسيمة الزواج) لإتمام الحجز وتسجيل النزيل.");
      return;
    }
    try {
      const res = await api.post("/api/v2/hotel/reservations", resForm);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل إنشاء الحجز"));
        return;
      }
      alert("تم إنشاء الحجز بنجاح برقم: " + json.data.reservation_number);
      setShowResModal(false);
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleCheckIn = async (resId: number, roomId?: number) => {
    try {
      const res = await api.post(`/api/v2/hotel/reservations/${resId}/checkin`, { room_id: roomId });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ في التسكين: " + (json.error || "تعذر التسكين"));
        return;
      }
      alert("تم تسكين النزيل بنجاح وتسليم الغرفة!");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleCheckOut = async (resId: number) => {
    const extra = prompt("أدخل قيمة المبلغ المسدد عند المغادرة (أو 0 للتسوية الحالية):", "0");
    if (extra === null) return;

    try {
      const res = await api.post(`/api/v2/hotel/reservations/${resId}/checkout`, { extra_payment: parseFloat(extra) || 0, payment_method: "cash" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ في تسجيل المغادرة: " + (json.error || "تعذر المغادرة"));
        return;
      }
      alert("تم تسجيل المغادرة وتحويل الغرفة لقسم التنظيف بنجاح!");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleChargeRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v2/hotel/charge-to-room", chargeForm);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ في التحميل: " + (json.error || "تعذر التحميل"));
        return;
      }
      alert("تم تحميل المبلغ على حساب الغرفة بنجاح!");
      setShowChargeModal(false);
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleUpdateHousekeeping = async (id: number, status: string) => {
    try {
      const res = await api.put(`/api/v2/hotel/housekeeping/${id}`, { status, staff_name: "فريق النظافة ب" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v2/hotel/maintenance", maintForm);
      if (res.ok) {
        alert("تم إرسال بلاغ الصيانة وحظر الغرفة مؤقتاً!");
        setShowMaintenanceModal(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveMaintenanceForm.id) return;
    try {
      const res = await api.put(`/api/v2/hotel/maintenance/${resolveMaintenanceForm.id}`, { 
        status: "resolved",
        resolution_notes: resolveMaintenanceForm.notes 
      });
      if (res.ok) {
        alert("تم إغلاق البلاغ وإعادة الغرفة للتشغيل!");
        setShowResolveMaintenanceModal(false);
        setResolveMaintenanceForm({ id: null, notes: "" });
        fetchData();
      } else {
        const err = await res.json();
        alert("خطأ: " + (err.error || "فشل إغلاق البلاغ"));
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const handleResolveMaintenance = (id: number) => {
    setResolveMaintenanceForm({ id, notes: "" });
    setShowResolveMaintenanceModal(true);
  };

  const handleViewFolio = async (reservationId: number) => {
    try {
      const res = await api.get(`/api/v2/hotel/folios/${reservationId}`);
      const json = await res.json();
      if (json.data) {
        setActiveFolio(json.data);
        setShowFolioModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveRoom = async () => {
    if (!occupiedRoomDetails?.reservation?.id || !targetMoveRoomId) {
      alert("يرجى تحديد الغرفة البديلة لنقل النزيل");
      return;
    }
    const targetRoom = rooms.find(r => r.id === parseInt(targetMoveRoomId));
    if (!targetRoom) return;

    try {
      const res = await api.post(`/api/v2/hotel/reservations/${occupiedRoomDetails.reservation.id}/move-room`, {
        new_room_id: targetRoom.id
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "تعذر نقل الغرفة"));
        return;
      }
      alert(`✨ تم نقل النزيل بنجاح إلى غرفة ${targetRoom.room_number}، وتم تحويل الغرفة السابقة (${occupiedRoomDetails.room.room_number}) لقسم النظافة والتعقيم!`);
      setShowRoomMoveModal(false);
      setShowOccupiedModal(false);
      fetchData();
    } catch (err: any) {
      alert("خطأ أثناء نقل الغرفة: " + err.message);
    }
  };

  const handleQuickCleanRoom = async (roomId: number) => {
    try {
      await api.patch(`/api/v2/hotel/rooms/${roomId}/status`, { status: "available" });
      const hkTask = housekeeping.find(h => h.room_id === roomId && h.cleaning_status !== 'clean');
      if (hkTask) {
        await api.put(`/api/v2/hotel/housekeeping/${hkTask.id}`, { status: "clean", staff_name: "مشرف النظافة" }).catch(() => {});
      }
      alert("✨ تم تحديث حالة الغرفة بنجاح إلى (متاحة ونظيفة وجاهزة للتسكين)!");
      fetchData();
    } catch (e: any) {
      alert("خطأ: " + e.message);
    }
  };

  const handleQuickHousekeepingRequest = async (room: any) => {
    try {
      await api.post("/api/v2/hotel/housekeeping", {
        hotel_id: room.hotel_id || 1,
        room_id: room.id,
        cleaning_status: "dirty",
        priority: "high",
        notes: `طلب نظافة وتغيير بياضات مستعجل لغرفة ${room.room_number}`
      }).catch(async () => {
        await api.patch(`/api/v2/hotel/rooms/${room.id}/status`, { status: "cleaning" });
      });
      alert(`✨ تم إرسال طلب تنظيف فوري لغرفة ${room.room_number} إلى قسم النظافة!`);
      fetchData();
    } catch (e: any) {
      alert("خطأ: " + e.message);
    }
  };

  const handleQuickOrderPreset = async (roomNumber: string, itemTitle: string, price: number) => {
    try {
      const res = await api.post("/api/v2/hotel/charge-to-room", {
        room_number: roomNumber,
        description: `خدمة غرف - ${itemTitle}`,
        amount: price
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "تعذر تحميل الخدمة"));
        return;
      }
      alert(`✨ تم تحميل (${itemTitle} - ${price} ج.م) بنجاح على فاتورة غرفة ${roomNumber}!`);
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  // GUEST MANAGEMENT & VISITS HISTORY HANDLERS
  const handleViewGuestProfile = async (guest: any) => {
    setLoadingGuestProfile(true);
    setShowGuestProfileModal(true);
    setSelectedGuestProfile(null);
    try {
      const res = await api.get(`/api/v2/hotel/guests/${guest.id}/profile`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedGuestProfile(json.data);
      } else {
        const guestReservations = reservations.filter(
          (r) => r.guest_id === guest.id || (r.guest_name && r.guest_name.trim() === guest.full_name?.trim())
        );
        const totalSpent = guestReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        setSelectedGuestProfile({
          ...guest,
          reservations: guestReservations,
          stays_count: guestReservations.length,
          total_spent: totalSpent
        });
      }
    } catch (e) {
      console.error("Error loading guest profile:", e);
      const guestReservations = reservations.filter(
        (r) => r.guest_id === guest.id || (r.guest_name && r.guest_name.trim() === guest.full_name?.trim())
      );
      setSelectedGuestProfile({
        ...guest,
        reservations: guestReservations,
        stays_count: guestReservations.length,
        total_spent: guestReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
      });
    } finally {
      setLoadingGuestProfile(false);
    }
  };

  const handleOpenGuestEdit = (guest?: any) => {
    if (guest) {
      setGuestEditForm({
        id: guest.id,
        full_name: guest.full_name || "",
        nationality: guest.nationality || "مصري",
        id_number: guest.id_number || "",
        passport_number: guest.passport_number || "",
        dob: guest.dob ? guest.dob.split("T")[0] : "",
        gender: guest.gender || "male",
        phone: guest.phone || "",
        email: guest.email || "",
        address: guest.address || "",
        notes: guest.notes || "",
        document_type: guest.document_type || "national_id",
        id_photo_front: guest.id_photo_front || "",
        id_photo_back: guest.id_photo_back || "",
        personal_photo: guest.personal_photo || "",
        passport_photo: guest.passport_photo || "",
        marriage_cert_photo: guest.marriage_cert_photo || ""
      });
    } else {
      setGuestEditForm({
        id: undefined,
        full_name: "",
        nationality: "مصري",
        id_number: "",
        passport_number: "",
        dob: "",
        gender: "male",
        phone: "",
        email: "",
        address: "",
        notes: "",
        document_type: "national_id",
        id_photo_front: "",
        id_photo_back: "",
        personal_photo: "",
        passport_photo: "",
        marriage_cert_photo: ""
      });
    }
    setShowGuestEditModal(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEditForm.full_name?.trim()) {
      alert("يرجى إدخال اسم النزيل بالكامل");
      return;
    }
    const hasDoc = !!(guestEditForm.id_photo_front || guestEditForm.passport_photo || guestEditForm.personal_photo || guestEditForm.marriage_cert_photo);
    if (!hasDoc) {
      alert("⚠️ متطلب إلزامي وأمني: يرجى سحب أو إرفاق صورة إثبات الهوية (بطاقة الرقم القومي أو جواز السفر أو الصورة الشخصية أو قسيمة الزواج) لإتمام التسجيل.");
      return;
    }
    try {
      if (guestEditForm.id) {
        const res = await api.put(`/api/v2/hotel/guests/${guestEditForm.id}`, guestEditForm);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert("خطأ: " + (json.error || "فشل تعديل بيانات النزيل"));
          return;
        }
        alert("تم تحديث بيانات النزيل ووثائق الهوية بنجاح!");
      } else {
        const res = await api.post("/api/v2/hotel/guests", guestEditForm);
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert("خطأ: " + (json.error || "فشل تسجيل النزيل"));
          return;
        }
        alert("تم تسجيل النزيل الجديد وحفظ وثائق الهوية بنجاح!");
      }
      setShowGuestEditModal(false);
      fetchData();
    } catch (err: any) {
      alert("خطأ الاتصال بالسيرفر: " + err.message);
    }
  };

  const handleDeleteGuest = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا النزيل من سجل الضيوف؟")) return;
    try {
      const res = await api.delete(`/api/v2/hotel/guests/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل حذف النزيل"));
        return;
      }
      alert("تم حذف النزيل بنجاح");
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleExportGuestsExcel = () => {
    if (!guests || guests.length === 0) {
      alert("لا توجد بيانات نزلاء لتصديرها");
      return;
    }

    const headers = [
      "المعرف (ID)",
      "اسم النزيل بالكامل",
      "رقم الهاتف / الواتساب",
      "الجنسية",
      "رقم الهوية الوطنية",
      "رقم جواز السفر",
      "البريد الإلكتروني",
      "النوع",
      "العنوان والمدينة",
      "عدد الزيارات السابقة",
      "إجمالي المبالغ المنصرفة (ج.م)",
      "تاريخ آخر زيارة",
      "الغرفة الحالية",
      "ملاحظات وتفضيلات النزيل"
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredGuests.map((g) => [
      escapeCsv(g.id),
      escapeCsv(g.full_name),
      escapeCsv(g.phone || "-"),
      escapeCsv(g.nationality || "مصري"),
      escapeCsv(g.id_number || "-"),
      escapeCsv(g.passport_number || "-"),
      escapeCsv(g.email || "-"),
      escapeCsv(g.gender === "female" ? "أنثى" : "ذكر"),
      escapeCsv(g.address || "-"),
      escapeCsv(g.stays_count || 0),
      escapeCsv(g.total_spent || 0),
      escapeCsv(g.last_visit_date ? g.last_visit_date.toString().split("T")[0] : "-"),
      escapeCsv(g.current_room_number ? `غرفة ${g.current_room_number}` : "-"),
      escapeCsv(g.notes || "-")
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `سجل_بيانات_النزلاء_فندق_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Guest Documents Archive Handlers
  const fetchGuestDocuments = async (guestId: number) => {
    setLoadingGuestDocs(true);
    try {
      const res = await api.get(`/api/v2/hotel/guests/${guestId}/documents`);
      const json = await res.json();
      if (json.data) {
        setGuestDocsList(json.data);
      }
    } catch (err) {
      console.error("Error fetching guest documents:", err);
    } finally {
      setLoadingGuestDocs(false);
    }
  };

  const handleOpenGuestDocs = (guest: any) => {
    setCurrentDocsGuest(guest);
    setNewGuestDocForm({
      document_type: "national_id_front",
      title: "بطاقة الرقم القومي (الوجه الأمامي)",
      document_number: guest.id_number || "",
      expiry_date: "",
      file_url: "",
      notes: ""
    });
    setShowGuestDocsModal(true);
    fetchGuestDocuments(guest.id);
  };

  const handleUploadGuestDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDocsGuest) return;
    if (!newGuestDocForm.file_url) {
      alert("يرجى التقاط صورة المستند أو اختيار ملف أولاً");
      return;
    }

    try {
      const res = await api.post("/api/v2/hotel/guests/documents", {
        guest_id: currentDocsGuest.id,
        document_type: newGuestDocForm.document_type,
        title: newGuestDocForm.title,
        file_url: newGuestDocForm.file_url,
        document_number: newGuestDocForm.document_number,
        expiry_date: newGuestDocForm.expiry_date || null,
        notes: newGuestDocForm.notes
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ: " + (json.error || "فشل حفظ المستند"));
        return;
      }
      alert("تم حفظ وأرشفة المستند بنجاح في قاعدة البيانات!");
      setNewGuestDocForm({
        document_type: "national_id_front",
        title: "مستند إضافي",
        document_number: "",
        expiry_date: "",
        file_url: "",
        notes: ""
      });
      fetchGuestDocuments(currentDocsGuest.id);
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleDeleteGuestDoc = async (docId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستند نهائياً؟")) return;
    try {
      const res = await api.delete(`/api/v2/hotel/guests/documents/${docId}`);
      if (res.ok) {
        alert("تم حذف المستند بنجاح");
        if (currentDocsGuest) fetchGuestDocuments(currentDocsGuest.id);
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  // Hotel Reports Fetch & Handlers
  const fetchReportsData = async () => {
    setReportsLoading(true);
    try {
      const hotelParam = reportHotelFilter !== "all" ? `?hotel_id=${reportHotelFilter}` : "";
      const [policeRes, revRes, balRes, naRes] = await Promise.all([
        api.get(`/api/v2/hotel/reports/police-registry${hotelParam}`).then(r => r.json()).catch(() => ({ data: [] })),
        api.get(`/api/v2/hotel/reports/revenue${hotelParam}`).then(r => r.json()).catch(() => ({ data: null })),
        api.get(`/api/v2/hotel/reports/guest-balances${hotelParam}`).then(r => r.json()).catch(() => ({ data: [] })),
        api.get(`/api/v2/hotel/night-audits${hotelParam}`).then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      if (policeRes.data) setPoliceReportList(policeRes.data);
      if (revRes.data) setRevenueReportData(revRes.data);
      if (balRes.data) setGuestBalancesList(balRes.data);
      if (naRes.data) setNightAuditsList(naRes.data);
    } catch (err) {
      console.error("Error fetching reports data:", err);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "hotel_reports") {
      fetchReportsData();
    }
  }, [activeTab, reportHotelFilter]);

  const handleRunNightAudit = async () => {
    const confirmRun = confirm(
      "هل تريد بدء تشغيل إجراءات التدقيق الليلي والترحيل اليومي (Night Audit)؟\nسيقوم النظام بحساب إيرادات الغرف المشغولة، مبيعات الخدمات والضرائب، وإقفال اليوم المالي وترحيل النتائج للتقارير وسجل الإقفالات."
    );
    if (!confirmRun) return;

    setIsAuditing(true);
    try {
      const hotelId = reportHotelFilter !== "all" ? parseInt(reportHotelFilter) : (properties[0]?.id || 1);
      const res = await api.post("/api/v2/hotel/night-audits/run", {
        hotelId,
        auditDate: reportDateFilter,
        auditedBy: "المراجع الليلي - قسم الاستقبال والمالية",
        notes: `إقفال وتدقيق حسابات وتسكين يوم ${reportDateFilter}`
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert("خطأ في التدقيق الليلي: " + (json.error || "فشلت العملية"));
        return;
      }
      alert(`✨ تم إتمام التدقيق الليلي والإقفال اليومي بنجاح!\nإجمالي الإيرادات المسجلة اليوم: ${json.data?.grand_total_revenue || 0} ج.م\nنسبة الإشغال: ${json.data?.occupancy_rate || 0}%`);
      fetchReportsData();
      fetchData();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleExportPoliceCsv = () => {
    if (!policeReportList || policeReportList.length === 0) {
      alert("لا توجد بيانات نزلاء لتصدير كشف شرطة السياحة");
      return;
    }

    const headers = [
      "رقم الحجز",
      "اسم النزيل بالكامل",
      "الجنسية",
      "رقم الهوية الوطنية",
      "رقم جواز السفر",
      "النوع",
      "رقم الهاتف",
      "العنوان بالكامل",
      "رقم الغرفة",
      "نوع الغرفة",
      "الفندق / العقار",
      "تاريخ الوصول",
      "تاريخ المغادرة",
      "حالة التسكين",
      "حالة توثيق المستندات"
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = policeReportList.map((r) => [
      escapeCsv(r.reservation_number || r.reservation_id),
      escapeCsv(r.guest_name),
      escapeCsv(r.nationality || "مصري"),
      escapeCsv(r.id_number || "-"),
      escapeCsv(r.passport_number || "-"),
      escapeCsv(r.gender === "female" ? "أنثى" : "ذكر"),
      escapeCsv(r.phone || "-"),
      escapeCsv(r.address || "-"),
      escapeCsv(r.room_number ? `غرفة ${r.room_number}` : "-"),
      escapeCsv(r.room_type_name || "-"),
      escapeCsv(r.hotel_name || "الفندق الرئيسي"),
      escapeCsv(r.actual_check_in ? r.actual_check_in.toString().split("T")[0] : (r.check_in_date ? r.check_in_date.toString().split("T")[0] : "-")),
      escapeCsv(r.actual_check_out ? r.actual_check_out.toString().split("T")[0] : (r.check_out_date ? r.check_out_date.toString().split("T")[0] : "-")),
      escapeCsv(r.reservation_status === "checked_in" ? "مقيم حالياً" : r.reservation_status === "checked_out" ? "غادر" : "مؤكد"),
      escapeCsv(r.documents_verified !== false ? "موثق ومطابق" : "تحت المراجعة")
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `كشف_نزلاء_شرطة_السياحة_والأمن_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBalancesCsv = () => {
    if (!guestBalancesList || guestBalancesList.length === 0) {
      alert("لا توجد بيانات فواتير لتصديرها");
      return;
    }

    const headers = [
      "رقم الفاتورة",
      "رقم الحجز",
      "اسم النزيل",
      "الهاتف",
      "الجنسية",
      "الغرفة",
      "الفندق",
      "إجمالي الفاتورة (ج.م)",
      "المسدد (ج.م)",
      "المتبقي المطلوب (ج.م)",
      "حالة الفاتورة"
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = guestBalancesList.map((f) => [
      escapeCsv(f.folio_id),
      escapeCsv(f.reservation_number || f.reservation_id),
      escapeCsv(f.guest_name),
      escapeCsv(f.guest_phone || "-"),
      escapeCsv(f.guest_nationality || "مصري"),
      escapeCsv(f.room_number ? `غرفة ${f.room_number}` : "-"),
      escapeCsv(f.hotel_name || "الفندق الرئيسي"),
      escapeCsv(f.grand_total || 0),
      escapeCsv(f.paid_total || 0),
      escapeCsv(f.balance || 0),
      escapeCsv(f.folio_status === "closed" ? "مغلقة ومسددة" : "مفتوحة ومستحقة")
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_مديونيات_وارصدة_النزلاء_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReservationsCsv = () => {
    if (!reservations || reservations.length === 0) {
      alert("لا توجد بيانات حجوزات لتصديرها");
      return;
    }
    const headers = [
      "رقم الحجز",
      "اسم النزيل",
      "الهاتف",
      "رقم الغرفة",
      "نوع الغرفة",
      "تاريخ الوصول",
      "تاريخ المغادرة",
      "عدد الليالي",
      "سعر الليلة",
      "الإجمالي",
      "المسدد",
      "المتبقي",
      "قناة الحجز",
      "حالة الحجز"
    ];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = reservations.map((r) => [
      escapeCsv(r.reservation_number || r.id),
      escapeCsv(r.guest_name),
      escapeCsv(r.guest_phone || "-"),
      escapeCsv(r.room_number ? `غرفة ${r.room_number}` : "-"),
      escapeCsv(r.room_type_name || "-"),
      escapeCsv(r.check_in_date ? r.check_in_date.toString().split("T")[0] : "-"),
      escapeCsv(r.check_out_date ? r.check_out_date.toString().split("T")[0] : "-"),
      escapeCsv(r.nights_count || 1),
      escapeCsv(r.room_rate || 0),
      escapeCsv(r.total_amount || 0),
      escapeCsv(r.paid_amount || 0),
      escapeCsv(r.remaining_amount || 0),
      escapeCsv(r.channel || "حجز مباشر (Direct)"),
      escapeCsv(r.status === "checked_in" ? "مقيم حالياً" : r.status === "checked_out" ? "غادر" : r.status === "cancelled" ? "ملغي" : "مؤكد")
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_حركة_الحجوزات_والقنوات_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHousekeepingCsv = () => {
    const headers = ["رقم الغرفة", "نوع الغرفة", "حالة النظافة", "الأولوية", "المسؤول عن التنظيف", "آخر تنظيف", "ملاحظات"];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = housekeeping.map((h) => [
      escapeCsv(h.room_number ? `غرفة ${h.room_number}` : "-"),
      escapeCsv(h.room_type_name || "-"),
      escapeCsv(h.cleaning_status === "clean" ? "نظيفة وجاهزة" : h.cleaning_status === "cleaning" ? "جاري التنظيف" : "غير نظيفة"),
      escapeCsv(h.priority || "عادية"),
      escapeCsv(h.assigned_staff_name || "فريق النظافة"),
      escapeCsv(h.last_cleaned_at ? h.last_cleaned_at.toString().replace("T", " ").substring(0, 16) : "-"),
      escapeCsv(h.notes || "-")
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_النظافة_وتجهيز_الغرف_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMaintenanceCsv = () => {
    const headers = ["رقم الغرفة", "المشكلة / العطل", "الأولوية", "الحالة", "الفني المسؤول", "التكلفة (ج.م)", "تاريخ البلاغ", "التفاصيل"];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = maintenance.map((m) => [
      escapeCsv(m.room_number ? `غرفة ${m.room_number}` : "-"),
      escapeCsv(m.problem),
      escapeCsv(m.priority || "متوسطة"),
      escapeCsv(m.status === "resolved" ? "تم الإصلاح" : m.status === "in_progress" ? "جاري الإصلاح" : "مفتوح"),
      escapeCsv(m.assigned_technician_name || "فني الصيانة"),
      escapeCsv(m.cost || 0),
      escapeCsv(m.created_at ? m.created_at.toString().split("T")[0] : "-"),
      escapeCsv(m.description || "-")
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_أعطال_وصيانة_المرافق_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportGuestsLoyaltyCsv = () => {
    const headers = ["اسم النزيل", "الجنسية", "الرقم القومي / الجواز", "الهاتف", "البريد الإلكتروني", "عدد الإقامات", "إجمالي الإنفاق (ج.م)", "تصنيف النزيل"];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = guests.map((g) => [
      escapeCsv(g.full_name),
      escapeCsv(g.nationality || "مصري"),
      escapeCsv(g.id_number || g.passport_number || "-"),
      escapeCsv(g.phone || "-"),
      escapeCsv(g.email || "-"),
      escapeCsv(g.stays_count || 1),
      escapeCsv(g.total_spent || 0),
      escapeCsv((g.stays_count > 3 || (g.total_spent || 0) > 10000) ? "عميل VIP مميز" : "نزيل منتظم")
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_تحليلات_النزلاء_والولاء_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportInventoryCsv = () => {
    const headers = ["كود الصنف", "اسم الصنف / المستلزم", "التصنيف", "الرصيد المتوفر", "الوحدة", "حد الأمان", "متوسط التكلفة (ج.م)", "إجمالي القيمة المقدرة (ج.م)", "حالة المخزون"];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = inventoryItems.map((item) => {
      const stock = Number(item.total_stock || item.quantity || 0);
      const cost = Number(item.avg_cost || item.last_purchase_price || 0);
      const min = Number(item.min_stock || 0);
      return [
        escapeCsv(item.code || "-"),
        escapeCsv(item.name),
        escapeCsv(item.category || "بياضات ومفروشات"),
        escapeCsv(stock),
        escapeCsv(item.unit || "قطعة"),
        escapeCsv(min),
        escapeCsv(cost),
        escapeCsv(stock * cost),
        escapeCsv(stock <= min ? "نقص حرج (إعادة طلب)" : "متوفر بكمية كافية")
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_مخزون_المستلزمات_والبياضات_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCashierCsv = () => {
    const headers = ["رقم الحجز", "النزيل", "الغرفة", "المبلغ المحصل (ج.م)", "طريقة الدفع", "تاريخ العملية", "الحالة"];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = reservations.filter(r => (r.paid_amount || 0) > 0).map((r) => [
      escapeCsv(r.reservation_number || r.id),
      escapeCsv(r.guest_name),
      escapeCsv(r.room_number ? `غرفة ${r.room_number}` : "-"),
      escapeCsv(r.paid_amount || 0),
      escapeCsv(r.payment_method === "credit_card" ? "بطاقة ائتمان (Credit Card)" : r.payment_method === "bank_transfer" ? "تحويل بنكي" : "نقدية (Cash)"),
      escapeCsv(r.created_at ? r.created_at.toString().split("T")[0] : new Date().toISOString().split("T")[0]),
      escapeCsv("تم التحصيل والتسجيل")
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_مقبوضات_الاستقبال_والكاشير_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & Paginated Guests calculation
  const uniqueNationalities = Array.from(new Set(guests.map((g) => g.nationality).filter(Boolean)));

  const filteredGuests = guests.filter((g) => {
    const q = guestSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (g.full_name && g.full_name.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q)) ||
      (g.id_number && g.id_number.toLowerCase().includes(q)) ||
      (g.passport_number && g.passport_number.toLowerCase().includes(q)) ||
      (g.email && g.email.toLowerCase().includes(q)) ||
      (g.nationality && g.nationality.toLowerCase().includes(q)) ||
      (g.notes && g.notes.toLowerCase().includes(q));

    const matchesNat = guestNationalityFilter === "all" || g.nationality === guestNationalityFilter;

    const isCurrentInHouse =
      g.current_room_number ||
      reservations.some((r) => (r.guest_id === g.id || r.guest_name === g.full_name) && r.status === "checked_in");

    const matchesVisit =
      guestVisitFilter === "all" ||
      (guestVisitFilter === "active_now" && isCurrentInHouse) ||
      (guestVisitFilter === "repeat_vip" && (g.stays_count || 0) > 1) ||
      (guestVisitFilter === "single_stay" && (g.stays_count || 0) <= 1);

    return matchesSearch && matchesNat && matchesVisit;
  });

  const totalGuestPages = Math.max(1, Math.ceil(filteredGuests.length / guestPageSize));
  const currentGuestPage = Math.min(guestPage, totalGuestPages);
  const paginatedGuests = filteredGuests.slice(
    (currentGuestPage - 1) * guestPageSize,
    currentGuestPage * guestPageSize
  );

  // Helper status badge colors
  const getRoomStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold">متاحة (Clean)</span>;
      case "occupied":
        return <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full text-xs font-semibold">مشغولة (Occupied)</span>;
      case "reserved":
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-semibold">محيوزة (Reserved)</span>;
      case "dirty":
      case "cleaning":
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">تحت التنظيف</span>;
      case "maintenance":
        return <span className="bg-slate-200 text-slate-800 px-2.5 py-1 rounded-full text-xs font-semibold">تحت الصيانة</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-xs">{status}</span>;
    }
  };

  const hasPerm = (perm: string) => {
    if (!userPermissions) return true; // Default to true if not provided or in dev mode
    if (userPermissions.all === true || userPermissions.system_admin === true) return true;
    return userPermissions[`hotel.${perm}`] === true;
  };

  const AVAILABLE_TABS = [
    { id: "dashboard", label: "لوحة التحكم", icon: TrendingUp, perm: "dashboard" },
    { id: "front_desk", label: "مكتب الاستقبال", icon: Key, perm: "front_desk" },
    { id: "reservations", label: "الحجوزات الفندقية", icon: CalendarDays, perm: "reservations" },
    { id: "guests", label: "سجل النزلاء", icon: Users, perm: "guests" },
    { id: "housekeeping", label: "النظافة والخدمات", icon: RefreshCw, perm: "housekeeping" },
    { id: "room_service", label: "خدمة الغرف والتحميل", icon: ShoppingCart, perm: "room_service" },
    { id: "maintenance", label: "صيانة الغرف", icon: Wrench, perm: "maintenance" },
    { id: "billing", label: "الفواتير والمدفوعات", icon: DollarSign, perm: "billing" },
    { id: "inventory", label: "مخزون المستلزمات", icon: Warehouse, perm: "inventory" },
    { id: "hotel_settings", label: "الإعدادات والتأسيس", icon: Settings, perm: "settings" },
    { id: "hotel_reports", label: "تقارير الفندق", icon: FileText, perm: "reports" },
    { id: "ai_insights", label: "الذكاء الاصطناعي", icon: Sparkles, perm: "ai_insights" }
  ].filter(t => hasPerm(t.perm));

  useEffect(() => {
    if (AVAILABLE_TABS.length > 0 && !AVAILABLE_TABS.find(t => t.id === activeTab)) {
      setActiveTab(AVAILABLE_TABS[0].id);
    }
  }, [userPermissions, activeTab]);

  return (
    <div className="p-4 md:p-6 space-y-6 dir-rtl text-right bg-slate-50 min-h-screen">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">نظام إدارة الفنادق والمنتجعات (Hotel PMS)</h1>
            <p className="text-sm text-slate-500">إدارة الغرف، الاستقبال، الحجوزات، خدمة الغرف، والمالية المتكاملة مع REMO PRO ERP</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition border border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
              العودة للوحة الرئيسية
            </button>
          )}
          <button
            onClick={() => setShowResModal(true)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition text-xs"
          >
            <Plus className="w-4 h-4" />
            حجز جديد
          </button>
          <button
            onClick={() => setShowChargeModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition text-xs"
          >
            <ShoppingCart className="w-4 h-4" />
            تحميل POS على غرفة
          </button>
          <button
            onClick={handleSeedDemoData}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition text-xs border border-amber-400/30"
            title="توليد وتغذية النظام ببيانات تجريبية شاملة"
          >
            <Sparkles className="w-4 h-4 text-yellow-200" />
            <span>بيانات تجريبية</span>
          </button>
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
        {AVAILABLE_TABS.filter(t => t.id !== 'hotel_reports').map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                isActive
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs text-slate-500 font-medium">إجمالي الغرف</span>
              <p className="text-2xl font-black text-slate-900">{metrics.totalRooms}</p>
              <span className="text-xs text-teal-600 font-semibold">100% السعة القائمة</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-sm space-y-1">
              <span className="text-xs text-emerald-700 font-medium">غرف متاحة للتسكين</span>
              <p className="text-2xl font-black text-emerald-700">{metrics.availableRooms}</p>
              <span className="text-xs text-emerald-600 font-semibold">جاهزة فوراً</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm space-y-1">
              <span className="text-xs text-rose-700 font-medium">الغرف المشغولة حالياً</span>
              <p className="text-2xl font-black text-rose-700">{metrics.occupiedRooms}</p>
              <span className="text-xs text-rose-600 font-semibold">نسبة إشغال {metrics.occupancyRate}%</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-sm space-y-1">
              <span className="text-xs text-blue-700 font-medium">حجوزات المؤكدة</span>
              <p className="text-2xl font-black text-blue-700">{metrics.reservedRooms}</p>
              <span className="text-xs text-blue-600 font-semibold">تسكين متبقي اليوم</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm space-y-1">
              <span className="text-xs text-amber-700 font-medium">تحت التنظيف والصيانة</span>
              <p className="text-2xl font-black text-amber-700">{metrics.dirtyRooms + metrics.maintenanceRooms}</p>
              <span className="text-xs text-amber-600 font-semibold">تجهيز سريع</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 shadow-sm space-y-1">
              <span className="text-xs text-indigo-700 font-medium">إيرادات اليوم</span>
              <p className="text-xl font-black text-indigo-800">{Number(metrics.todayRevenue || 0).toLocaleString()} ج.م</p>
              <span className="text-xs text-indigo-600 font-semibold">ADR: {metrics.adr} | RevPAR: {metrics.revpar}</span>
            </div>
          </div>

          {/* Quick FrontDesk Room Rack Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-teal-600" />
                حالة الغرف الحالية (Real-Time Room Rack)
              </h2>
              <button onClick={() => setActiveTab("front_desk")} className="text-xs font-bold text-teal-600 hover:underline">
                عرض المخطط التفاعلي الكامل &larr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {rooms.map((room) => {
                let statusBg = "bg-emerald-50 border-emerald-300 text-emerald-900";
                if (room.status === "occupied") statusBg = "bg-rose-50 border-rose-300 text-rose-900";
                if (room.status === "reserved") statusBg = "bg-blue-50 border-blue-300 text-blue-900";
                if (room.status === "dirty" || room.status === "cleaning") statusBg = "bg-amber-50 border-amber-300 text-amber-900";
                if (room.status === "maintenance") statusBg = "bg-slate-100 border-slate-300 text-slate-800";

                return (
                  <div
                    key={room.id}
                    onClick={() => handleOpenOccupiedRoom(room)}
                    className={`p-3 rounded-xl border ${statusBg} flex flex-col justify-between h-24 shadow-xs cursor-pointer hover:shadow-md transition`}
                    title={room.status === "occupied" ? "أنقر لعرض بيانات النزيل والفاتورة" : "أنقر للتفاصيل"}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">غرفة {room.room_number}</span>
                      <span className="text-[10px] opacity-75 font-mono">ط {room.floor}</span>
                    </div>
                    <div className="text-xs font-medium truncate">
                      {room.room_type_name || "قياسي"}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>{room.price} ج.م</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-black/10">
                        {room.status === "occupied" ? "مشغولة" : room.status === "reserved" ? "محجوزة" : room.status === "available" ? "متاحة" : room.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Arrivals & Departures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Arrivals */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600" />
                وصل اليوم (Check-ins Today)
              </h3>
              <div className="space-y-2">
                {reservations.filter(r => r.status === "confirmed").map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-sm">
                    <div>
                      <p className="font-bold text-slate-900">{r.guest_name}</p>
                      <p className="text-xs text-slate-500">غرفة {r.room_number || "غير محددة"} | {r.nights_count} ليالي</p>
                    </div>
                    <button
                      onClick={() => handleCheckIn(r.id, r.room_id)}
                      className="bg-teal-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-teal-700 transition"
                    >
                      تسكين الآن
                    </button>
                  </div>
                ))}
                {reservations.filter(r => r.status === "confirmed").length === 0 && (
                  <p className="text-xs text-slate-400 py-2">لا توجد تسكينات معلقة اليوم.</p>
                )}
              </div>
            </div>

            {/* Departures */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-600" />
                مغادرة اليوم (Check-outs Today)
              </h3>
              <div className="space-y-2">
                {reservations.filter(r => r.status === "checked_in").map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-sm">
                    <div>
                      <p className="font-bold text-slate-900">{r.guest_name}</p>
                      <p className="text-xs text-slate-500">غرفة {r.room_number} | المتبقي: {r.remaining_amount} ج.م</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewFolio(r.id)}
                        className="bg-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg font-medium hover:bg-slate-300"
                      >
                        الفاتورة
                      </button>
                      <button
                        onClick={() => handleCheckOut(r.id)}
                        className="bg-rose-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-rose-700"
                      >
                        مغادرة وتسوية
                      </button>
                    </div>
                  </div>
                ))}
                {reservations.filter(r => r.status === "checked_in").length === 0 && (
                  <p className="text-xs text-slate-400 py-2">لا يوجد مقيمون بانتظار المغادرة اليوم.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FRONT DESK & RACK */}
      {activeTab === "front_desk" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">مخطط الغرف الشامل (Front Desk Room Rack)</h2>
              <p className="text-xs text-slate-500">نظرة عامة على حالة الأدوار والغرف للتسكين السريع والمتابعة</p>
            </div>
            <div className="flex gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> متاحة (Available)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> مشغولة (Occupied)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> محجوزة (Reserved)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> نظافة (Dirty)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500 inline-block"></span> صيانة (Maintenance)</span>
            </div>
          </div>

          {Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b).map((floorNum) => {
            const floorRooms = rooms.filter(r => r.floor === floorNum);
            if (floorRooms.length === 0) return null;

            return (
              <div key={floorNum} className="space-y-3">
                <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1">الدور {floorNum}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {floorRooms.map((room) => {
                    let cardBg = "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-950";
                    if (room.status === "occupied") cardBg = "border-rose-300 bg-rose-50/50 hover:bg-rose-100/50 text-rose-950";
                    if (room.status === "reserved") cardBg = "border-blue-300 bg-blue-50/50 hover:bg-blue-100/50 text-blue-950";
                    if (room.status === "dirty" || room.status === "cleaning") cardBg = "border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 text-amber-950";
                    if (room.status === "maintenance") cardBg = "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-900";

                    const activeRes = reservations.find(r => r.room_id === room.id && (r.status === 'checked_in' || r.status === 'confirmed'));

                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (room.status === "occupied" || room.status === "reserved") {
                            handleOpenOccupiedRoom(room);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border-2 transition shadow-xs flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-md ${cardBg}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-lg flex items-center gap-1.5">
                            <Key className="w-4 h-4 opacity-70" />
                            غرفة {room.room_number}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            room.status === 'occupied' ? 'bg-rose-200/80 text-rose-900' :
                            room.status === 'reserved' ? 'bg-blue-200/80 text-blue-900' :
                            room.status === 'dirty' || room.status === 'cleaning' ? 'bg-amber-200/80 text-amber-900' :
                            room.status === 'maintenance' ? 'bg-slate-200 text-slate-900' :
                            'bg-emerald-200/80 text-emerald-900'
                          }`}>
                            {room.status === 'occupied' ? 'مشغولة' :
                             room.status === 'reserved' ? 'محجوزة' :
                             room.status === 'dirty' || room.status === 'cleaning' ? 'تحت النظافة' :
                             room.status === 'maintenance' ? 'صيانة' : 'متاحة'}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-xs font-bold truncate">{room.room_type_name || "قياسي"}</p>
                          {activeRes ? (
                            <p className="text-[11px] font-extrabold text-slate-800 truncate flex items-center gap-1">
                              <User className="w-3 h-3 text-teal-600 inline" />
                              {activeRes.guest_name || "نزيل مسجل"}
                            </p>
                          ) : (
                            <p className="text-[10px] opacity-75">{room.price} ج.م / ليلة</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-black/10">
                          {room.status === "available" && hasPerm("create_reservation") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResForm({ ...resForm, room_id: room.id.toString(), room_rate: room.price });
                                setShowResModal(true);
                              }}
                              className="w-full bg-emerald-700 text-white text-[11px] py-1 rounded-lg font-bold hover:bg-emerald-800 transition text-center shadow-xs"
                            >
                              + حجز وتسكين
                            </button>
                          )}

                          {room.status === "reserved" && (
                            <div className="flex items-center gap-1 w-full">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeRes) handleCheckIn(activeRes.id, room.id);
                                }}
                                className="flex-1 bg-blue-700 text-white text-[10px] py-1 rounded-lg font-bold hover:bg-blue-800 transition text-center"
                              >
                                ⚡ تسكين
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenOccupiedRoom(room);
                                }}
                                className="bg-white/80 text-blue-900 border border-blue-300 text-[10px] px-2 py-1 rounded-lg font-bold hover:bg-white"
                              >
                                تفاصيل
                              </button>
                            </div>
                          )}

                          {room.status === "occupied" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOccupiedRoom(room);
                              }}
                              className="w-full bg-rose-700 text-white text-[11px] py-1 rounded-lg font-bold hover:bg-rose-800 transition text-center shadow-xs flex items-center justify-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              النزيل والفاتورة
                            </button>
                          )}

                          {(room.status === "dirty" || room.status === "cleaning") && (
                            <div className="flex items-center gap-1 w-full">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickCleanRoom(room.id);
                                }}
                                className="flex-1 bg-amber-600 text-white text-[10px] py-1 rounded-lg font-bold hover:bg-amber-700 transition text-center shadow-xs"
                              >
                                ✓ تم التنظيف
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab("housekeeping");
                                }}
                                className="bg-white/80 text-amber-900 border border-amber-300 text-[10px] px-2 py-1 rounded-lg font-bold hover:bg-white"
                              >
                                النظافة
                              </button>
                            </div>
                          )}

                          {room.status === "maintenance" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const maint = maintenance.find(m => m.room_id === room.id && m.status !== 'resolved');
                                if (maint) {
                                  handleResolveMaintenance(maint.id);
                                } else {
                                  handleQuickCleanRoom(room.id);
                                }
                              }}
                              className="w-full bg-slate-700 text-white text-[10px] py-1 rounded-lg font-bold hover:bg-slate-800 transition text-center"
                            >
                              ✓ إنهاء الصيانة
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 6: RESERVATIONS */}
      {activeTab === "reservations" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                سجل ودليل الحجوزات الفندقية (Reservations Master)
              </h2>
              <p className="text-xs text-slate-500">إدارة جميع الحجوزات وتتبع التسكين والمغادرة والربط المباشر بالفواتير والمستندات</p>
            </div>
            {hasPerm("create_reservation") && (
              <button
                onClick={() => setShowResModal(true)}
                className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs"
              >
                + إضافة حجز جديد
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث برقم الحجز، اسم النزيل، رقم الهاتف، أو رقم الغرفة..."
                value={resSearchQuery ?? ""}
                onChange={(e) => setResSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: "all", label: "الكل" },
                { id: "confirmed", label: "تسكين معلق" },
                { id: "checked_in", label: "مقيم حالياً" },
                { id: "checked_out", label: "تم المغادرة" }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setResStatusFilter(f.id)}
                  className={`text-xs px-3 py-2 rounded-xl font-bold whitespace-nowrap transition ${
                    resStatusFilter === f.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم الحجز</th>
                  <th className="p-3">اسم النزيل</th>
                  <th className="p-3">الغرفة</th>
                  <th className="p-3">تاريخ الوصول</th>
                  <th className="p-3">تاريخ المغادرة</th>
                  <th className="p-3 text-center">الليالي</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">المسدد</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">إجراءات وروابط سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations
                  .filter((r) => {
                    if (resStatusFilter !== "all" && r.status !== resStatusFilter) return false;
                    if (!resSearchQuery.trim()) return true;
                    const q = resSearchQuery.toLowerCase();
                    return (
                      r.reservation_number?.toLowerCase().includes(q) ||
                      r.guest_name?.toLowerCase().includes(q) ||
                      r.guest_phone?.includes(q) ||
                      r.room_number?.toString().includes(q)
                    );
                  })
                  .map((resItem) => {
                    const guestObj = guests.find(g => g.id === resItem.guest_id || g.full_name === resItem.guest_name);
                    return (
                      <tr key={resItem.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-teal-700">{resItem.reservation_number}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{resItem.guest_name}</div>
                          {resItem.guest_phone && <div className="text-[11px] text-slate-400 font-mono">{resItem.guest_phone}</div>}
                        </td>
                        <td className="p-3 font-bold">
                          {resItem.room_number ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab("front_desk")}
                              className="text-teal-700 hover:underline flex items-center gap-1 font-bold"
                              title="معاينة في مكتب الاستقبال"
                            >
                              <Key className="w-3.5 h-3.5" />
                              غرفة {resItem.room_number}
                            </button>
                          ) : (
                            <span className="text-slate-400">غير مسكنة</span>
                          )}
                        </td>
                        <td className="p-3 text-xs">{resItem.check_in_date?.toString().split("T")[0]}</td>
                        <td className="p-3 text-xs">{resItem.check_out_date?.toString().split("T")[0]}</td>
                        <td className="p-3 text-center font-bold text-xs">{resItem.nights_count}</td>
                        <td className="p-3 font-bold text-xs">{resItem.total_amount} ج.م</td>
                        <td className="p-3 text-emerald-700 font-bold text-xs">{resItem.paid_amount} ج.م</td>
                        <td className="p-3 text-rose-700 font-bold text-xs">{resItem.remaining_amount} ج.م</td>
                        <td className="p-3">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${
                            resItem.status === 'checked_in' ? 'bg-rose-100 text-rose-800' :
                            resItem.status === 'checked_out' ? 'bg-slate-100 text-slate-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {resItem.status === 'checked_in' ? '🔴 مقيم حالياً' :
                             resItem.status === 'checked_out' ? '⚪ غادر' : '🔵 تسكين معلق'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                              onClick={() => handleViewFolio(resItem.id)}
                              className="text-[11px] bg-slate-100 text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200 font-bold"
                              title="كشف حساب الفاتورة"
                            >
                              🧾 الفاتورة
                            </button>

                            {guestObj && (
                              <>
                                <button
                                  onClick={() => handleViewGuestProfile(guestObj)}
                                  className="text-[11px] bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 font-bold"
                                  title="الملف الشامل وسجل الزيارات"
                                >
                                  👤 النزيل
                                </button>
                                <button
                                  onClick={() => handleOpenGuestDocs(guestObj)}
                                  className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-100 font-bold"
                                  title="أرشيف الوثائق والمستندات"
                                >
                                  📑 وثائق
                                </button>
                              </>
                            )}

                            {resItem.status === 'confirmed' && hasPerm("check_in") && (
                              <button
                                onClick={() => handleCheckIn(resItem.id, resItem.room_id)}
                                className="text-[11px] bg-teal-600 text-white px-2.5 py-1 rounded-lg hover:bg-teal-700 font-bold shadow-xs"
                              >
                                ⚡ تسكين
                              </button>
                            )}

                            {resItem.status === 'checked_in' && (
                              <>
                                {hasPerm("add_payment") && (
                                  <button
                                    onClick={() => {
                                      setChargeForm({
                                        room_number: resItem.room_number?.toString() || "",
                                        description: "خدمة غرف ومطعم",
                                        amount: 100
                                      });
                                      setShowChargeModal(true);
                                    }}
                                    className="text-[11px] bg-amber-50 text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-100 font-bold"
                                    title="تحميل خدمة على الغرفة"
                                  >
                                    🍽️ خدمة
                                  </button>
                                )}
                                {hasPerm("check_out") && (
                                  <button
                                    onClick={() => handleCheckOut(resItem.id)}
                                    className="text-[11px] bg-rose-600 text-white px-2.5 py-1 rounded-lg hover:bg-rose-700 font-bold shadow-xs"
                                  >
                                    🚪 مغادرة
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: GUESTS SPREADSHEET & VISITS HISTORY */}
      {activeTab === "guests" && (
        <div className="space-y-4">
          {/* Top Header & Summary Stats */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                  سجل وقاعدة بيانات النزلاء والضيوف (Guests Directory)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  شيت إلكتروني متقدم بأسلوب جدول إكسل لعرض آلاف النزلاء، البحث الفوري، سجل الزيارات السابقة، والطباعة
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleOpenGuestEdit()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <UserPlus className="w-4 h-4" />
                  إضافة نزيل جديد
                </button>

                <button
                  onClick={handleExportGuestsExcel}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  title="تصدير شيت إكسل يدعم اللغة العربية UTF-8"
                >
                  <Download className="w-4 h-4" />
                  تنزيل إكسل (CSV)
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200"
                >
                  <Printer className="w-4 h-4" />
                  طباعة السجل
                </button>

                <button
                  onClick={fetchData}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200"
                  title="تحديث البيانات"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metric KPI Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">إجمالي النزلاء</span>
                  <span className="font-extrabold text-base text-slate-900">{guests.length} نزيل</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Hotel className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-emerald-800 block">مقيمون حالياً في الغرف</span>
                  <span className="font-extrabold text-base text-emerald-900">
                    {guests.filter((g) => g.current_room_number || reservations.some((r) => (r.guest_id === g.id || r.guest_name === g.full_name) && r.status === 'checked_in')).length} نزيل
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-blue-800 block">إجمالي الحجوزات والزيارات</span>
                  <span className="font-extrabold text-base text-blue-900">
                    {guests.reduce((sum, g) => sum + (g.stays_count || 0), 0) || reservations.length} زيارة
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-amber-800 block">عوائد النزلاء المسددة</span>
                  <span className="font-extrabold text-base text-amber-900">
                    {guests.reduce((sum, g) => sum + (g.total_spent || 0), 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 pt-2 border-t border-slate-100">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={guestSearchQuery ?? ""}
                  onChange={(e) => setGuestSearchQuery(e.target.value)}
                  placeholder="بحث سريع باسم النزيل، رقم الهاتف، رقم الهوية أو الباسبور..."
                  className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500 transition"
                />
                {guestSearchQuery && (
                  <button
                    onClick={() => setGuestSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Nationality filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">الجنسية:</span>
                <select
                  value={guestNationalityFilter ?? ""}
                  onChange={(e) => setGuestNationalityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-2 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">جميع الجنسيات</option>
                  {uniqueNationalities.map((nat) => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>

              {/* Visit Type filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">حالة الإقامة:</span>
                <select
                  value={guestVisitFilter ?? ""}
                  onChange={(e) => setGuestVisitFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-2 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">الكل (جميع النزلاء)</option>
                  <option value="active_now">🟢 نزلاء مقيمون حالياً بالداخل</option>
                  <option value="repeat_vip">⭐ عملاء متكررون (VIP)</option>
                  <option value="single_stay">زيارة واحدة</option>
                </select>
              </div>

              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">الصفوف:</span>
                <select
                  value={guestPageSize ?? ""}
                  onChange={(e) => setGuestPageSize(parseInt(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2 py-2 focus:bg-white focus:outline-hidden"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Excel Spreadsheet High-Density Table */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-extrabold border-b-2 border-slate-300 select-none text-[11px]">
                    <th className="p-3 border-l border-slate-200 text-center w-12 bg-slate-200/50">#</th>
                    <th className="p-3 border-l border-slate-200 min-w-[200px]">اسم النزيل بالكامل</th>
                    <th className="p-3 border-l border-slate-200 min-w-[140px]">الهاتف / الواتساب</th>
                    <th className="p-3 border-l border-slate-200 min-w-[90px]">الجنسية</th>
                    <th className="p-3 border-l border-slate-200 min-w-[130px]">الهوية / جواز السفر</th>
                    <th className="p-3 border-l border-slate-200 min-w-[160px]">البريد الإلكتروني</th>
                    <th className="p-3 border-l border-slate-200 min-w-[120px] text-center">الإقامة الحالية</th>
                    <th className="p-3 border-l border-slate-200 min-w-[90px] text-center">عدد الزيارات</th>
                    <th className="p-3 border-l border-slate-200 min-w-[110px] text-left">إجمالي المنصرف</th>
                    <th className="p-3 border-l border-slate-200 min-w-[100px]">آخر زيارة</th>
                    <th className="p-3 text-center min-w-[180px] bg-slate-200/30">الإجراءات والسجل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {paginatedGuests.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-500 space-y-2">
                        <Users className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-bold text-sm text-slate-700">لا توجد نتائج مطابقة لخيارات البحث</p>
                        <p className="text-xs text-slate-400">جرب كتابة اسم مختلف أو تغيير الفلاتر المحددة</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedGuests.map((g, idx) => {
                      const isCurrentInHouse =
                        g.current_room_number ||
                        reservations.some(
                          (r) => (r.guest_id === g.id || r.guest_name === g.full_name) && r.status === "checked_in"
                        );
                      const currentRes = reservations.find(
                        (r) => (r.guest_id === g.id || r.guest_name === g.full_name) && r.status === "checked_in"
                      );
                      const currentRoom = g.current_room_number || currentRes?.room_number;
                      const isVip = (g.stays_count || 0) >= 2;

                      return (
                        <tr
                          key={g.id}
                          className="hover:bg-teal-50/40 transition-colors group cursor-pointer"
                          onClick={() => handleViewGuestProfile(g)}
                        >
                          {/* Row Index */}
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-400 bg-slate-50/40 group-hover:bg-teal-100/30 font-bold">
                            {(currentGuestPage - 1) * guestPageSize + idx + 1}
                          </td>

                          {/* Guest Name & Avatar */}
                          <td className="p-2.5 border-l border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-extrabold flex items-center justify-center text-xs shrink-0">
                                {g.full_name ? g.full_name.charAt(0) : "U"}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 group-hover:text-teal-700 block">
                                  {g.full_name}
                                </span>
                                {isVip && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                    ⭐ نزيل دائم VIP
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="p-2.5 border-l border-slate-200">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono font-bold text-slate-800 dir-ltr text-right">
                                {g.phone || "---"}
                              </span>
                            </div>
                          </td>

                          {/* Nationality */}
                          <td className="p-2.5 border-l border-slate-200">
                            <span className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-bold inline-block border border-slate-200">
                              {g.nationality || "مصري"}
                            </span>
                          </td>

                          {/* National ID / Passport */}
                          <td className="p-2.5 border-l border-slate-200 font-mono font-bold text-slate-800">
                            {g.id_number || g.passport_number || "---"}
                          </td>

                          {/* Email */}
                          <td className="p-2.5 border-l border-slate-200 text-slate-600">
                            {g.email || "---"}
                          </td>

                          {/* Current Room */}
                          <td className="p-2.5 border-l border-slate-200 text-center">
                            {isCurrentInHouse ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                غرفة {currentRoom}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </td>

                          {/* Stays Count */}
                          <td className="p-2.5 border-l border-slate-200 text-center">
                            <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md text-xs font-mono">
                              {g.stays_count || (reservations.filter(r => r.guest_id === g.id || r.guest_name === g.full_name).length) || 1}
                            </span>
                          </td>

                          {/* Total Spent */}
                          <td className="p-2.5 border-l border-slate-200 text-left font-mono font-bold text-teal-800">
                            {Number(g.total_spent !== undefined ? g.total_spent : 0 || 0).toLocaleString()} ج.م
                          </td>

                          {/* Last Visit */}
                          <td className="p-2.5 border-l border-slate-200 font-mono text-[11px] text-slate-600">
                            {g.last_visit_date ? g.last_visit_date.toString().split("T")[0] : "حديث"}
                          </td>

                          {/* Actions */}
                          <td
                            className="p-2 text-center space-x-1 space-x-reverse"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleViewGuestProfile(g)}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                              title="عرض تفاصيل النزيل وسجل الزيارات السابقة والفواتير"
                            >
                              <span className="flex items-center gap-1">
                                <History className="w-3.5 h-3.5" />
                                سجل الزيارات
                              </span>
                            </button>

                            <button
                              onClick={() => handleOpenGuestDocs(g)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition shadow-2xs"
                              title="أرشيف وثائق ومستندات الهوية للنزيل"
                            >
                              <span className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" />
                                الوثائق
                              </span>
                            </button>

                            {hasPerm("create_reservation") && (
                              <button
                                onClick={() => {
                                  setResForm({
                                    ...resForm,
                                    guest_name: g.full_name || "",
                                    guest_phone: g.phone || "",
                                    guest_email: g.email || "",
                                    guest_nationality: g.nationality || "مصري",
                                    guest_id_number: g.id_number || "",
                                    guest_passport_number: g.passport_number || "",
                                    guest_gender: g.gender || "male",
                                    guest_address: g.address || ""
                                  });
                                  setShowResModal(true);
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition"
                                title="حجز غرفة جديدة لهذا النزيل"
                              >
                                حجز جديد
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenGuestEdit(g)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="تعديل بيانات النزيل"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteGuest(g.id)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                              title="حذف النزيل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="p-3 bg-slate-100/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 font-bold">
                عرض النزلاء من{" "}
                <span className="font-mono text-teal-800">
                  {filteredGuests.length === 0 ? 0 : (currentGuestPage - 1) * guestPageSize + 1}
                </span>{" "}
                إلى{" "}
                <span className="font-mono text-teal-800">
                  {Math.min(currentGuestPage * guestPageSize, filteredGuests.length)}
                </span>{" "}
                من إجمالي{" "}
                <span className="font-mono font-extrabold text-slate-900">{filteredGuests.length}</span> نزيل
              </div>

              {/* Page buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setGuestPage(1)}
                  disabled={currentGuestPage <= 1}
                  className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  title="الصفحة الأولى"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setGuestPage((p) => Math.max(1, p - 1))}
                  disabled={currentGuestPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </button>

                {/* Numbered Page indicators */}
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: Math.min(5, totalGuestPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalGuestPages > 5) {
                      if (currentGuestPage > 3) {
                        pageNum = currentGuestPage - 2 + i;
                        if (pageNum > totalGuestPages) {
                          pageNum = totalGuestPages - (4 - i);
                        }
                      }
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setGuestPage(pageNum)}
                        className={`w-8 h-8 rounded-lg font-mono font-bold text-xs transition ${
                          currentGuestPage === pageNum
                            ? "bg-teal-600 text-white shadow-xs"
                            : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setGuestPage((p) => Math.min(totalGuestPages, p + 1))}
                  disabled={currentGuestPage >= totalGuestPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1"
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setGuestPage(totalGuestPages)}
                  disabled={currentGuestPage >= totalGuestPages}
                  className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  title="الصفحة الأخيرة"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: HOUSEKEEPING & SERVICES */}
      {activeTab === "housekeeping" && (
        <div className="space-y-6">
          {/* Header & Sub-tab Controls */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      إدارة النظافة والخدمات الفندقية (Housekeeping & Guest Services)
                    </h2>
                    <p className="text-xs text-slate-500">
                      طلب وتنفيذ الخدمات للنزلاء في الغرف، متابعة جدول النظافة الفورية، وتسميع الرسوم على فاتورة النزيل آلياً
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleOpenOrderServiceModal()}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  + تسجيل خدمة على نزيل (إضافة للفاتورة)
                </button>
                <button
                  onClick={() => {
                    setActiveTab("hotel_settings");
                    setSettingsTab("services");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200"
                  title="الانتقال لقائمة تسعير وتأسيس الخدمات"
                >
                  <Settings className="w-4 h-4" />
                  إعدادات وقائمة الخدمات
                </button>
              </div>
            </div>

            {/* Sub-tabs Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { id: "services", label: "كتالوج الخدمات المتاحة للطلب", icon: Sparkles, count: servicesList.length },
                { id: "orders_log", label: "سجل طلبات خدمات النزلاء", icon: Receipt, count: serviceOrdersList.length },
                { id: "cleaning_schedule", label: "جدول نظافة وتجهيز الغرف", icon: RefreshCw, count: housekeeping.length },
                { id: "maintenance_log", label: "أعطال وبلاغات الصيانة", icon: Wrench, count: maintenance.length },
              ].map((subTab) => {
                const Icon = subTab.icon;
                const isActive = housekeepingTabMode === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    onClick={() => setHousekeepingTabMode(subTab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition whitespace-nowrap ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-teal-400" : "text-slate-500"}`} />
                    <span>{subTab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {subTab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SUB-VIEW 1: SERVICES CATALOG WITH 1-CLICK ORDER TO GUEST */}
          {housekeepingTabMode === "services" && (
            <div className="space-y-6">
              {/* Filter bar and select room quick order */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-1 items-center gap-2">
                  <span className="font-bold text-slate-700 whitespace-nowrap">الغرفة المستهدفة:</span>
                  <select
                    value={selectedRoomForService ?? ""}
                    onChange={(e) => setSelectedRoomForService(e.target.value)}
                    className="p-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- اختر الغرفة المشغولة لتحميل الخدمة --</option>
                    {rooms.filter(r => r.status === "occupied").map(r => {
                      const res = reservations.find(res => res.room_id === r.id && res.status === "checked_in");
                      return (
                        <option key={r.id} value={r.room_number}>
                          غرفة {r.room_number} ({res?.guest_name || "نزيل مقيم"})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto">
                  {["all", "housekeeping", "laundry", "food_beverage", "minibar", "transport", "wellness"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setServiceCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition text-[11px] whitespace-nowrap ${
                        serviceCategoryFilter === cat ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat === "all" ? "الكل" : cat === "housekeeping" ? "نظافة" : cat === "laundry" ? "غسيل" : cat === "food_beverage" ? "مأكولات" : cat === "minibar" ? "ميني بار" : cat === "transport" ? "نقل" : "سبا"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Catalog Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {servicesList
                  .filter((s) => serviceCategoryFilter === "all" || s.category === serviceCategoryFilter)
                  .map((service) => (
                    <div
                      key={service.id}
                      className="p-5 bg-white border border-slate-200 hover:border-teal-400 rounded-3xl shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                            {service.category === "laundry" && <Shirt className="w-6 h-6" />}
                            {service.category === "food_beverage" && <Utensils className="w-6 h-6" />}
                            {service.category === "minibar" && <Coffee className="w-6 h-6" />}
                            {service.category === "transport" && <Car className="w-6 h-6" />}
                            {service.category === "wellness" && <Heart className="w-6 h-6" />}
                            {service.category === "extra_bed" && <Bed className="w-6 h-6" />}
                            {service.category === "housekeeping" && <Sparkles className="w-6 h-6" />}
                            {!["laundry", "food_beverage", "minibar", "transport", "wellness", "extra_bed", "housekeeping"].includes(service.category) && <ConciergeBell className="w-6 h-6" />}
                          </div>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {service.category === "housekeeping" ? "نظافة وتجهيز" : service.category === "laundry" ? "مغسلة" : service.category === "food_beverage" ? "مطعم" : service.category === "minibar" ? "ميني بار" : service.category}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-black text-slate-900 text-base">{service.name}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                            {service.description || "خدمة فندقية متاحة للطلب الفوري للغرفة وتحميل المبلغ على الفاتورة."}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">التسعير</span>
                            <span className="text-lg font-black text-teal-700">
                              {service.price} ج.م <span className="text-[10px] text-slate-500 font-normal">/ {service.unit || "مرة"}</span>
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            ⏱️ {service.estimated_time_minutes || 30} دقيقة
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenOrderServiceModal(service, selectedRoomForService)}
                          className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة الخدمة لغرفة النزيل</span>
                        </button>
                      </div>
                    </div>
                  ))}

                {servicesList.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
                    <ConciergeBell className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-slate-600 font-bold text-sm">لم يتم إضافة خدمات فندقية في الدليل بعد</p>
                    <button
                      onClick={() => {
                        setActiveTab("hotel_settings");
                        setSettingsTab("services");
                      }}
                      className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700"
                    >
                      الانتقال للإعدادات وإضافة أول خدمة
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: GUEST SERVICE ORDERS LOG & BILLING FULFILLMENT */}
          {housekeepingTabMode === "orders_log" && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">سجل طلبات خدمات النزلاء ومتابعة الفواتير</h3>
                  <p className="text-xs text-slate-500">متابعة تنفيذ الخدمات ومطابقتها مع فواتير النزلاء (Folio Charges)</p>
                </div>
                <button
                  onClick={() => handleOpenOrderServiceModal()}
                  className="bg-teal-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + طلب خدمة جديد
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">رقم الطلب</th>
                      <th className="p-3">الغرفة</th>
                      <th className="p-3">النزيل</th>
                      <th className="p-3">الخدمة</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">إجمالي السعر</th>
                      <th className="p-3">حالة التنفيذ</th>
                      <th className="p-3">تسميع الفاتورة</th>
                      <th className="p-3">التوقيت</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {serviceOrdersList.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-teal-700">#{order.id}</td>
                        <td className="p-3 font-bold text-slate-900">غرفة {order.room_number}</td>
                        <td className="p-3 text-slate-700 font-semibold">{order.guest_name || "نزيل الغرفة"}</td>
                        <td className="p-3 font-bold text-slate-800">{order.service_name}</td>
                        <td className="p-3 font-semibold">{order.quantity}</td>
                        <td className="p-3 font-black text-emerald-700">{order.total_price} ج.م</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                            order.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "cancelled"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {order.status === "completed" ? "✔️ مكتمل" : order.status === "in_progress" ? "⏳ جاري التنفيذ" : order.status === "cancelled" ? "❌ ملغي" : "🟡 قيد الانتظار"}
                          </span>
                        </td>
                        <td className="p-3">
                          {order.folio_charge_id ? (
                            <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-teal-600" />
                              مسمع على الفاتورة #{order.folio_charge_id}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">بدون تحميل</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 text-[10px] font-mono">
                          {new Date(order.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {order.status !== "completed" && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, "completed")}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition"
                              >
                                إتمام
                              </button>
                            )}
                            {order.status === "pending" && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, "in_progress")}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] transition"
                              >
                                بدء
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {serviceOrdersList.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400 text-xs">
                          لا توجد طلبات خدمات مسجلة حتى الآن.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: CLEANING SCHEDULE */}
          {housekeepingTabMode === "cleaning_schedule" && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-teal-600" />
                  جدول تنظيف وتجهيز الغرف الفندقية
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {housekeeping.map((hk) => (
                  <div key={hk.id} className="p-4 border border-slate-200 rounded-2xl flex items-center justify-between bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">غرفة {hk.room_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{hk.notes || "تنظيف وتجهيز شامل للنزيل الجديد"}</p>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded mt-1 inline-block font-semibold">
                        الحالة: {hk.cleaning_status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUpdateHousekeeping(hk.id, "clean")}
                      className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold hover:bg-emerald-700 shadow-xs"
                    >
                      تأكيد النظافة
                    </button>
                  </div>
                ))}
                {housekeeping.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                    جميع الغرف نظيفة وجاهزة حالياً! لا توجد مهام تنظيف متأخرة.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-VIEW 4: MAINTENANCE LOG */}
          {housekeepingTabMode === "maintenance_log" && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-600" />
                  بلاغات وأعطال الصيانة
                </h3>
                <button
                  onClick={() => setShowMaintenanceModal(true)}
                  className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold hover:bg-amber-700"
                >
                  + بلاغ صيانة جديد
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {maintenance.map((m) => (
                  <div key={m.id} className="p-4 border border-slate-200 rounded-2xl flex items-center justify-between bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">غرفة {m.room_number} - {m.problem}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded mt-1 inline-block font-bold">
                        الأولوية: {m.priority}
                      </span>
                    </div>
                    {m.status !== "resolved" && (
                      <button
                        onClick={() => handleResolveMaintenance(m.id)}
                        className="bg-teal-600 text-white text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-teal-700"
                      >
                        إصلاح وإعادة للخدمة
                      </button>
                    )}
                  </div>
                ))}
                {maintenance.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                    لا توجد بلاغات صيانة مفتوحة حالياً.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: AI INSIGHTS */}
      {activeTab === "ai_insights" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="p-3 bg-gradient-to-r from-teal-600 to-indigo-600 text-white rounded-2xl shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">الذكاء الاصطناعي والتسعير الديناميكي (AI Smart Hotel Pricing)</h2>
              <p className="text-xs text-slate-500">تحليلات وتوقعات نسبة الإشغال وتوصيات ضبط الأسعار لتحقيق أقصى ربحية (RevPAR Optimization)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 border border-indigo-200 bg-indigo-50/40 rounded-2xl space-y-2">
              <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                توقعات الإشغال لعطلة نهاية الأسبوع
              </h3>
              <p className="text-3xl font-black text-indigo-950">88%</p>
              <p className="text-xs text-indigo-700">يتوقع ارتفاع الطلب على الغرف المزدوجة والأجنحة الملكية بنسبة +35% خلال 48 ساعة القادمة.</p>
            </div>

            <div className="p-5 border border-teal-200 bg-teal-50/40 rounded-2xl space-y-2">
              <h3 className="font-bold text-teal-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-600" />
                توصية رفع أسعار الغرف (Smart Rate Suggestion)
              </h3>
              <p className="text-3xl font-black text-teal-950">+15%</p>
              <p className="text-xs text-teal-700">توصية زيادة سعر الغرفة المزدوجة من 1800 ج.م إلى 2100 ج.م لاستغلال موسم الذروة الوشيك.</p>
            </div>

            <div className="p-5 border border-emerald-200 bg-emerald-50/40 rounded-2xl space-y-2">
              <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                تحليل ولاء VIP النزلاء
              </h3>
              <p className="text-3xl font-black text-emerald-950">4.9 / 5.0</p>
              <p className="text-xs text-emerald-700">نسبة رضا النزلاء عن سرعة خدمة الغرف والتسليم الفوري عند الوصول.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: ROOM SERVICE & POS CHARGES */}
      {activeTab === "room_service" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-indigo-600" />
                خدمة الغرف والتحميل المباشر (Room Service & POS Folio Charges)
              </h2>
              <p className="text-xs text-slate-500">تحميل وجبات المطعم، المشروبات، والمغسلة مباشرة على حساب وفاتورة غرفة النزيل</p>
            </div>
            <button
              onClick={() => setShowChargeModal(true)}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              تحميل فاتورة مخصصة على غرفة
            </button>
          </div>

          {/* Quick Presets for Occupied Rooms */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              الغرف المشغولة حالياً والتحميل الفوري السريع (1-Click Room Charge):
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.filter(r => r.status === "occupied").map(room => {
                const activeRes = reservations.find(r => r.room_id === room.id && r.status === "checked_in");
                return (
                  <div key={room.id} className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-xs">
                          {room.room_number}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{activeRes?.guest_name || "نزيل مقيم"}</span>
                          <span className="text-[10px] text-slate-500">{room.room_type_name || "غرفة فندقية"}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleOpenOccupiedRoom(room);
                        }}
                        className="text-[11px] text-indigo-700 hover:underline font-bold"
                      >
                        معاينة الفاتورة ↗
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickOrderPreset(room.room_number, "وجبة إفطار صباحي لشخصين", 180)}
                        className="p-1.5 bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold transition flex items-center justify-between"
                      >
                        <span>🍳 إفطار (180 ج)</span>
                        <span>+</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickOrderPreset(room.room_number, "وجبة غداء رئيسية فاخرة", 350)}
                        className="p-1.5 bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold transition flex items-center justify-between"
                      >
                        <span>🍗 غداء (350 ج)</span>
                        <span>+</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickOrderPreset(room.room_number, "خدمة غسيل وكي ملابس (مغسلة)", 90)}
                        className="p-1.5 bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold transition flex items-center justify-between"
                      >
                        <span>👔 مغسلة (90 ج)</span>
                        <span>+</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickOrderPreset(room.room_number, "مشروبات وميني بار", 60)}
                        className="p-1.5 bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold transition flex items-center justify-between"
                      >
                        <span>☕ ميني بار (60 ج)</span>
                        <span>+</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenOrderServiceModal(undefined, room.room_number)}
                        className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[11px] font-bold transition text-center shadow-xs flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>من دليل الخدمات</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChargeForm({
                            room_number: room.room_number,
                            description: "",
                            amount: 0
                          });
                          setShowChargeModal(true);
                        }}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition text-center shadow-xs"
                      >
                        + طلب يدوي
                      </button>
                    </div>
                  </div>
                );
              })}

              {rooms.filter(r => r.status === "occupied").length === 0 && (
                <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  لا توجد غرف مشغولة بنزلاء حالياً لتحميل خدمات الغرف عليها.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: ROOM MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-6 h-6 text-amber-600" />
                إدارة بلاغات وأعطال الصيانة (Maintenance Sheet)
              </h2>
              <p className="text-xs text-slate-500">سجل بلاغات الصيانة، متابعة الإصلاح، وإغلاق البلاغات للغرف</p>
            </div>
            <button
              onClick={() => setShowMaintenanceModal(true)}
              className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-700 transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              بلاغ صيانة جديد
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-bold">رقم البلاغ</th>
                  <th className="p-3 font-bold">التاريخ</th>
                  <th className="p-3 font-bold">رقم الغرفة</th>
                  <th className="p-3 font-bold">الأولوية</th>
                  <th className="p-3 font-bold">المشكلة / العطل</th>
                  <th className="p-3 font-bold">تفاصيل البلاغ</th>
                  <th className="p-3 font-bold">ملاحظات الفني (الحل)</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {maintenance.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      لا توجد بلاغات صيانة حالياً.
                    </td>
                  </tr>
                ) : (
                  maintenance.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-500">#{m.id}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {new Date((m.created_at) || 0).toLocaleString("ar-EG")}
                      </td>
                      <td className="p-3 font-bold text-slate-900">غرفة {m.room_number || "-"}</td>
                      <td className="p-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                          m.priority === "عالية" ? "bg-rose-100 text-rose-800" : 
                          m.priority === "متوسطة" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"
                        }`}>
                          {m.priority || "عالية"}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{m.problem}</td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate" title={m.description}>{m.description || "-"}</td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate" title={m.resolution_notes}>{m.resolution_notes || "-"}</td>
                      <td className="p-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                          m.status === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {m.status === "resolved" ? "تم الإصلاح" : "مفتوح"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {m.status !== "resolved" && (
                          <button
                            onClick={() => handleResolveMaintenance(m.id)}
                            className="bg-teal-600 text-white text-[11px] px-3 py-1.5 rounded-lg font-bold hover:bg-teal-700 transition whitespace-nowrap"
                          >
                            إغلاق البلاغ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 12: BILLING & FOLIOS */}
      {activeTab === "billing" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                الفواتير والمدفوعات والمستحقات الفندقية (Billing & Folios)
              </h2>
              <p className="text-xs text-slate-500">استعراض كشوف حسابات النزلاء، المقبوضات، والمبالغ المتبقية</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم الحجز</th>
                  <th className="p-3">النزيل</th>
                  <th className="p-3">الغرفة</th>
                  <th className="p-3">إجمالي الإقامة</th>
                  <th className="p-3">المسدد</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-teal-700">{r.reservation_number}</td>
                    <td className="p-3 font-semibold text-slate-900">{r.guest_name}</td>
                    <td className="p-3 font-bold">غرفة {r.room_number || "---"}</td>
                    <td className="p-3 font-bold">{r.total_amount} ج.م</td>
                    <td className="p-3 text-emerald-700 font-bold">{r.paid_amount} ج.م</td>
                    <td className="p-3 text-rose-700 font-bold">{r.remaining_amount} ج.م</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleViewFolio(r.id)}
                        className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-slate-900 transition"
                      >
                        عرض الفاتورة الشاملة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 13: HOTEL INVENTORY & WAREHOUSE CONNECTION */}
      {activeTab === "inventory" && (() => {
        // Filter logic
        const filteredInventory = inventoryItems.filter((item) => {
          const matchSearch =
            !inventorySearchQuery ||
            item.name?.toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
            item.code?.toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
            item.barcode?.toLowerCase().includes(inventorySearchQuery.toLowerCase());

          const matchCat =
            inventoryCategoryFilter === "all" ||
            item.category === inventoryCategoryFilter ||
            (inventoryCategoryFilter === "hotel_supplies" &&
              ["بياضات ومفروشات", "مستلزمات نظافة ورعاية", "ميني بار ومشروبات", "مستلزمات نزلاء", "بياضات"].includes(item.category));

          return matchSearch && matchCat;
        });

        const totalItemsCount = filteredInventory.length;
        const totalStockQuantity = filteredInventory.reduce((acc, curr) => acc + (Number(curr.total_stock || curr.quantity || 0)), 0);
        const lowStockAlertsCount = filteredInventory.filter((item) => Number(item.total_stock || item.quantity || 0) <= Number(item.min_stock || 0)).length;
        const totalEstimatedValue = filteredInventory.reduce((acc, curr) => acc + (Number(curr.total_stock || curr.quantity || 0) * Number(curr.avg_cost || curr.last_purchase_price || 0)), 0);

        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Warehouse className="w-6 h-6 text-teal-600" />
                  <h2 className="text-xl font-bold text-slate-900">
                    مخزون المستلزمات والبياضات الفندقية (Hotel Supplies Inventory)
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    مربوط بالكامل مع إدارة المخازن المركزية
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  مراقبة فورية لأرصدة البياضات، أطقم النظافة، مستلزمات الميني بار، وأثاث الغرف بالفندق ومخازن المنظومة
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchInventoryData}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  title="تحديث البيانات"
                >
                  <RefreshCw className="w-4 h-4" />
                  تحديث
                </button>
                <button
                  onClick={() => setShowSupplyModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  <PackagePlus className="w-4 h-4" />
                  إضافة صنف مستلزمات جديد
                </button>
              </div>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">إجمالي الأصناف المسجلة</span>
                  <Package className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{totalItemsCount} <span className="text-xs font-normal text-slate-500">صنف</span></div>
                <p className="text-[11px] text-teal-700 font-semibold">موزعة بمخازن الفندق والمخزن الرئيسي</p>
              </div>

              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">إجمالي كمية الرصيد بالمخزن</span>
                  <Box className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{Number(totalStockQuantity || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">وحدة</span></div>
                <p className="text-[11px] text-slate-500">رصيد حي متوفر بالمنتج</p>
              </div>

              <div className={`p-4 border rounded-2xl space-y-1 ${lowStockAlertsCount > 0 ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">تنبيهات الأصناف تحت حد الطلب</span>
                  <AlertTriangle className={`w-5 h-5 ${lowStockAlertsCount > 0 ? "text-rose-600" : "text-slate-400"}`} />
                </div>
                <div className={`text-2xl font-black ${lowStockAlertsCount > 0 ? "text-rose-700" : "text-slate-900"}`}>
                  {lowStockAlertsCount} <span className="text-xs font-normal text-slate-500">صنف</span>
                </div>
                <p className="text-[11px] text-slate-500">{lowStockAlertsCount > 0 ? "تحتاج لإصدار أمر شراء عاجل" : "جميع الكميات ممتازة"}</p>
              </div>

              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">القيمة التقديرية للمخزون</span>
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-800">{Number(totalEstimatedValue || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م</span></div>
                <p className="text-[11px] text-emerald-700 font-semibold">استناداً لمتوسط التكلفة للوحدة</p>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inventorySearchQuery ?? ""}
                    onChange={(e) => setInventorySearchQuery(e.target.value)}
                    placeholder="بحث باسم صنف المستلزمات، الكود، أو الباركوود..."
                    className="w-full pr-9 pl-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <select
                  value={inventoryCategoryFilter ?? ""}
                  onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                  className="p-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-700"
                >
                  <option value="all">جميع التصنيفات</option>
                  <option value="hotel_supplies">مستلزمات فندقية فقط</option>
                  <option value="بياضات ومفروشات">بياضات ومفروشات</option>
                  <option value="مستلزمات نظافة ورعاية">مستلزمات نظافة ورعاية</option>
                  <option value="ميني بار ومشروبات">ميني بار ومشروبات</option>
                  <option value="مستلزمات نزلاء">مستلزمات نزلاء</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setInventoryViewMode("grid")}
                    className={`p-1.5 rounded-lg transition ${inventoryViewMode === "grid" ? "bg-teal-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
                    title="عرض كروت"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setInventoryViewMode("table")}
                    className={`p-1.5 rounded-lg transition ${inventoryViewMode === "table" ? "bg-teal-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
                    title="عرض جدول"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Data View: Grid or Table */}
            {inventoryViewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map((item) => {
                  const qty = Number(item.total_stock || item.quantity || 0);
                  const min = Number(item.min_stock || 0);
                  const isLow = qty <= min;
                  const unitCost = Number(item.avg_cost || item.last_purchase_price || 0);
                  const totalVal = qty * unitCost;

                  return (
                    <div
                      key={item.id}
                      className={`p-5 border rounded-2xl space-y-3 transition duration-200 bg-white shadow-xs relative hover:shadow-md ${
                        isLow ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                          {item.category || "عام"}
                        </span>
                        <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.code || `ID-${item.id}`}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                        <p className="text-xs text-slate-500">وحدة القياس: <span className="font-bold text-slate-800">{item.unit || "قطعة"}</span></p>
                      </div>

                      {/* Stock Bar Meter */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-semibold">الرصيد المتاح بالمخزن:</span>
                          <span className={`text-base font-black ${isLow ? "text-rose-600" : "text-slate-900"}`}>
                            {qty} {item.unit || "قطعة"}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-300 ${isLow ? "bg-rose-500" : "bg-teal-500"}`}
                            style={{ width: `${Math.min(100, Math.max(10, (qty / (min * 3 || 100)) * 100))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>حد الطلب: {min}</span>
                          <span>سعر الوحدة: {unitCost} ج.م</span>
                        </div>
                      </div>

                      {isLow && (
                        <div className="flex items-center gap-1.5 p-2 bg-rose-50 text-rose-800 text-xs rounded-xl font-bold border border-rose-200">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>تنبيه: الرصيد عند حد الطلب - يلزم التوريد</span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-slate-500">القيمة الإجمالية: </span>
                          <span className="font-bold text-emerald-700">{Number(totalVal || 0).toLocaleString()} ج.م</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedItemForStock(item);
                              setShowStockAdjustModal(true);
                            }}
                            className="px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                            title="توريد / تعديل كمية"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            تعديل رصيد
                          </button>
                          <button
                            onClick={() => handleDeleteSupply(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredInventory.length === 0 && (
                  <div className="col-span-3 p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <Package className="w-10 h-10 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">لا توجد أصناف مستلزمات مطابقة للبحث حالياً</p>
                    <p className="text-xs text-slate-500">يمكنك إضافة صنف مستلزمات جديد للمخازن المركزية مباشرة</p>
                    <button
                      onClick={() => setShowSupplyModal(true)}
                      className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-teal-700 transition"
                    >
                      + إضافة صنف جديد للمخزن
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">الكود</th>
                      <th className="p-3">اسم صنف المستلزمات</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">الوحدة</th>
                      <th className="p-3">الرصيد بالمخزن</th>
                      <th className="p-3">حد الطلب</th>
                      <th className="p-3">سعر الوحدة</th>
                      <th className="p-3">القيمة الإجمالية</th>
                      <th className="p-3">حالة الرصيد</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventory.map((item) => {
                      const qty = Number(item.total_stock || item.quantity || 0);
                      const min = Number(item.min_stock || 0);
                      const isLow = qty <= min;
                      const unitCost = Number(item.avg_cost || item.last_purchase_price || 0);
                      const totalVal = qty * unitCost;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-bold text-slate-600">{item.code || `ID-${item.id}`}</td>
                          <td className="p-3 font-bold text-slate-900">{item.name}</td>
                          <td className="p-3">
                            <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                              {item.category || "عام"}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-700">{item.unit || "قطعة"}</td>
                          <td className="p-3 font-black text-slate-900 text-sm">{qty}</td>
                          <td className="p-3 font-mono text-slate-500">{min}</td>
                          <td className="p-3 font-semibold text-slate-800">{unitCost} ج.م</td>
                          <td className="p-3 font-bold text-emerald-700">{Number(totalVal || 0).toLocaleString()} ج.م</td>
                          <td className="p-3">
                            {isLow ? (
                              <span className="bg-rose-100 text-rose-800 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                منخفض (تحت حد الطلب)
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                رصيد كافي
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedItemForStock(item);
                                setShowStockAdjustModal(true);
                              }}
                              className="px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-bold border border-teal-200 transition text-xs"
                            >
                              تعديل رصيد
                            </button>
                            <button
                              onClick={() => handleDeleteSupply(item.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500 text-xs">
                          لا توجد أصناف مستلزمات مطابقة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 14: HOTEL SETTINGS */}
      {activeTab === "hotel_settings" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-slate-700" />
              الإعدادات والتأسيس (Hotel Settings)
            </h2>
            <p className="text-xs text-slate-500">إدارة العقارات، أنواع الغرف، الغرف، والأدوار والسياسات العامة</p>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: "policies", label: "السياسات والضرائب", icon: Settings },
              { id: "services", label: "دليل وتسعير الخدمات", icon: Sparkles },
              { id: "properties", label: "الفنادق والعقارات", icon: Building2 },
              { id: "room_types", label: "أنواع وتصنيفات الغرف", icon: Layers },
              { id: "rooms", label: "إدارة الغرف", icon: BedDouble },
            ].map(t => {
              const Icon = t.icon;
              const isActive = settingsTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSettingsTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-200 ${
                    isActive ? "bg-slate-800 text-white shadow-md" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {settingsTab === "policies" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-5 border border-slate-200 rounded-2xl space-y-4 bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm">مواعيد الدخول والخروج الرسمية</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">موعد التسكين (Check-in)</label>
                    <input type="time" defaultValue="14:00" className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">موعد المغادرة (Check-out)</label>
                    <input type="time" defaultValue="12:00" className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold" />
                  </div>
                </div>
              </div>

              <div className="p-5 border border-slate-200 rounded-2xl space-y-4 bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm">الضرائب ورسوم الخدمة</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ضريبة القيمة المضافة (%)</label>
                    <input type="number" defaultValue="14" className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">رسوم الخدمة الفندقية (%)</label>
                    <input type="number" defaultValue="12" className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold" />
                  </div>
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2 p-5 border border-slate-200 rounded-2xl space-y-4 bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>إدارة الأدوار والطوابق الفندقية (Floors Management)</span>
                  <button
                    onClick={() => {
                      setNewFloorNumber(floors.length > 0 ? Math.max(...floors) + 1 : 1);
                      setShowFloorModal(true);
                    }}
                    className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    إضافة طابق جديد
                  </button>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {floors.map(floor => (
                    <div key={floor} className="bg-white p-3 border border-slate-200 rounded-xl flex items-center justify-between shadow-sm">
                      <span className="font-bold text-slate-800">الدور {floor}</span>
                      <button 
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف الدور ${floor}؟`)) {
                            setFloors(floors.filter(f => f !== floor));
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600" 
                        title="تعديل أو حذف"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 flex justify-end pt-2">
                <button
                  onClick={() => alert("تم حفظ إعدادات الفندق والسياسات بنجاح!")}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md text-xs transition"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </div>
          )}

          {settingsTab === "services" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                    دليل الخدمات الفندقية وقائمة التسعير (Hotel Services Catalog)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تأسيس وتخصيص أسعار خدمات النظافة، الغسيل، الأطعمة والمشروبات، النقل والميني بار، مع احتساب الضرائب وتسميعها مباشرة بفاتورة النزيل.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setServiceCatalogForm({
                      id: undefined,
                      hotel_id: properties[0]?.id || 1,
                      name: "",
                      code: `SRV-${(servicesList.length + 1).toString().padStart(3, "0")}`,
                      category: "housekeeping",
                      price: 150,
                      unit: "مرة",
                      tax_rate: 14,
                      estimated_time_minutes: 30,
                      description: "",
                      icon: "Sparkles",
                      is_active: true
                    });
                    setShowAddServiceModal(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  + إضافة خدمة جديدة
                </button>
              </div>

              {/* Service Categories Quick Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "all", label: "جميع الخدمات (" + servicesList.length + ")" },
                  { id: "housekeeping", label: "نظافة وتجهيز" },
                  { id: "laundry", label: "مغسلة وكي" },
                  { id: "food_beverage", label: "مأكولات ومشروبات" },
                  { id: "minibar", label: "ميني بار" },
                  { id: "transport", label: "نقل ومواصلات" },
                  { id: "wellness", label: "سبا وعناية" },
                  { id: "extra_bed", label: "أسرة ومفروشات" },
                  { id: "other", label: "خدمات أخرى" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setServiceCategoryFilter(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                      serviceCategoryFilter === cat.id
                        ? "bg-teal-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Services Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {servicesList
                  .filter((s) => serviceCategoryFilter === "all" || s.category === serviceCategoryFilter)
                  .map((srv) => (
                    <div
                      key={srv.id}
                      className="p-5 border border-slate-200 rounded-2xl bg-white hover:border-teal-300 hover:shadow-md transition space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                            {srv.category === "laundry" && <Shirt className="w-5 h-5" />}
                            {srv.category === "food_beverage" && <Utensils className="w-5 h-5" />}
                            {srv.category === "minibar" && <Coffee className="w-5 h-5" />}
                            {srv.category === "transport" && <Car className="w-5 h-5" />}
                            {srv.category === "wellness" && <Heart className="w-5 h-5" />}
                            {srv.category === "extra_bed" && <Bed className="w-5 h-5" />}
                            {srv.category === "housekeeping" && <Sparkles className="w-5 h-5" />}
                            {!["laundry", "food_beverage", "minibar", "transport", "wellness", "extra_bed", "housekeeping"].includes(srv.category) && <ConciergeBell className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm">{srv.name}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">{srv.code || `SRV-${srv.id}`}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setServiceCatalogForm({
                                id: srv.id,
                                hotel_id: srv.hotel_id || 1,
                                name: srv.name,
                                code: srv.code || "",
                                category: srv.category || "housekeeping",
                                price: srv.price,
                                unit: srv.unit || "مرة",
                                tax_rate: srv.tax_rate !== undefined ? srv.tax_rate : 14,
                                estimated_time_minutes: srv.estimated_time_minutes || 30,
                                description: srv.description || "",
                                icon: srv.icon || "Sparkles",
                                is_active: srv.is_active !== false
                              });
                              setShowAddServiceModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="تعديل الخدمة"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteService(srv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="حذف الخدمة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                        {srv.description || "خدمة فندقية متميزة لنزلاء الفندق مع إمكانية التحميل الفوري على الفاتورة."}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-400 block font-medium">سعر الخدمة</span>
                          <span className="text-lg font-black text-teal-700">
                            {srv.price} ج.م <span className="text-[10px] font-medium text-slate-500">/ {srv.unit || "مرة"}</span>
                          </span>
                        </div>
                        <div className="text-left text-xs">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px] inline-block">
                            ضريبة: {srv.tax_rate || 14}%
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            ⏱️ {srv.estimated_time_minutes || 30} دقيقة
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                {servicesList.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-3xl space-y-3">
                    <ConciergeBell className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-600">لم يتم إضافة خدمات فندقية بعد في هذا الفندق</p>
                    <p className="text-xs text-slate-400">ابدأ بإضافة أول خدمة فندقية (مثل تنظيف، غسيل، وجبات، ميني بار) لتسمع في الغرف وفواتير النزلاء.</p>
                    <button
                      onClick={() => {
                        setServiceCatalogForm({
                          id: undefined,
                          hotel_id: properties[0]?.id || 1,
                          name: "",
                          code: "SRV-001",
                          category: "housekeeping",
                          price: 150,
                          unit: "مرة",
                          tax_rate: 14,
                          estimated_time_minutes: 30,
                          description: "",
                          icon: "Sparkles",
                          is_active: true
                        });
                        setShowAddServiceModal(true);
                      }}
                      className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition"
                    >
                      + إنشاء خدمة جديدة الآن
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {settingsTab === "properties" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">العقارات والفنادق الحالية</h3>
                <button
                  onClick={() => setShowPropertyModal(true)}
                  className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة عقار جديد
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.map((p) => (
                  <div key={p.id} className="p-5 border border-slate-200 rounded-2xl space-y-3 bg-slate-50 relative group">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-slate-900">{p.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-1 rounded-full font-bold">{p.code}</span>
                        <button
                          onClick={() => handleDeleteProperty(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="حذف العقار"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <p>المدير المسؤول: <span className="font-semibold text-slate-800">{p.manager || "غير محدد"}</span></p>
                      <p>الهاتف: <span className="font-semibold text-slate-800">{p.phone || "غير محدد"}</span></p>
                      <p>عدد الأدوار: <span className="font-semibold text-slate-800">{p.floors_count}</span></p>
                      <p>سعة الغرف: <span className="font-semibold text-slate-800">{p.rooms_count} غرفة</span></p>
                      <p>ضريبة الخدمة: <span className="font-semibold text-slate-800">{p.tax_rate}%</span></p>
                      <p>مواعيد الدخول/الخروج: <span className="font-semibold text-slate-800">{p.checkin_time} / {p.checkout_time}</span></p>
                    </div>
                  </div>
                ))}
                {properties.length === 0 && (
                  <div className="col-span-2 p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                    لا يوجد عقارات معرفة حالياً. اضغط على "إضافة عقار جديد" لإنشاء الفندق الأول.
                  </div>
                )}
              </div>
            </div>
          )}

          {settingsTab === "room_types" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">أنواع وتصنيفات الغرف</h3>
                <button
                  onClick={() => setShowRoomTypeModal(true)}
                  className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة تصنيف جديد
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {roomTypes.map((rt) => (
                  <div key={rt.id} className="p-5 border border-slate-200 rounded-2xl space-y-3 bg-slate-50 shadow-xs relative group">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-teal-800">{rt.name}</h3>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200">{rt.code}</span>
                        <button
                          onClick={() => handleDeleteRoomType(rt.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="حذف التصنيف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{rt.description || "لا يوجد وصف محدد"}</p>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>السعة: <span className="font-bold">{rt.capacity} أفراد</span> | الأسرة: <span className="font-bold">{rt.beds_count} سرير</span></p>
                      <p className="text-lg font-black text-teal-700">{rt.base_price} ج.م <span className="text-xs font-normal text-slate-500">/ ليلة</span></p>
                    </div>
                    {rt.amenities && (
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {rt.amenities.split(',').map((am: string, idx: number) => (
                          <span key={idx} className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{am.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {roomTypes.length === 0 && (
                  <div className="col-span-3 p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                    لا يوجد تصنيفات للغرف حالياً. اضغط على "إضافة تصنيف جديد".
                  </div>
                )}
              </div>
            </div>
          )}

          {settingsTab === "rooms" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">إدارة ودليل غرف الفندق</h3>
                <button
                  onClick={() => setShowRoomModal(true)}
                  className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة غرفة جديدة
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-t-xl">
                    <tr>
                      <th className="p-3">رقم الغرفة</th>
                      <th className="p-3">الدور</th>
                      <th className="p-3">نوع الغرفة</th>
                      <th className="p-3">العقار / الفندق</th>
                      <th className="p-3">السعر / ليلة</th>
                      <th className="p-3">الحالة التشغيلية</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-x border-b border-slate-200">
                    {rooms.map((rm) => (
                      <tr key={rm.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">غرفة {rm.room_number}</td>
                        <td className="p-3">الدور {rm.floor}</td>
                        <td className="p-3 font-medium text-teal-800">{rm.room_type_name || "قياسي"}</td>
                        <td className="p-3 text-slate-600 text-xs">{rm.hotel_name || "الفندق الرئيسي"}</td>
                        <td className="p-3 font-bold">{rm.price} ج.م</td>
                        <td className="p-3">{getRoomStatusBadge(rm.status)}</td>
                        <td className="p-3 text-center flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDeleteRoom(rm.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition"
                            title="حذف الغرفة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rooms.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                          لا يوجد غرف معرفة حالياً. اضغط على "إضافة غرفة جديدة".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 15: ADVANCED HOTEL REPORTS, POLICE REGISTRY & NIGHT AUDIT */}
      {activeTab === "hotel_reports" && (
        <HotelReportsTab
          properties={properties}
          selectedProperty={properties.find((p) => String(p.id) === String(reportHotelFilter)) || properties[0] || null}
          onSelectProperty={(p) => setReportHotelFilter(String(p.id))}
          reportSubTab={reportSubTab}
          setReportSubTab={setReportSubTab}
        />
      )}

      {/* MODAL: NEW PROPERTY */}
      {showPropertyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">إضافة عقار / فندق جديد</h3>
              <button onClick={() => setShowPropertyModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم العقار *</label>
                  <input type="text" required value={propertyForm.name ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="مثال: فندق الزمردة" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود العقار</label>
                  <input type="text" value={propertyForm.code ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, code: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="EMD-01" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مدير العقار</label>
                  <input type="text" value={propertyForm.manager ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, manager: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="اسم المدير" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input type="text" value={propertyForm.phone ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, phone: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="الهاتف" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عدد الأدوار</label>
                  <input type="number" required value={propertyForm.floors_count ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, floors_count: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعة الغرف</label>
                  <input type="number" required value={propertyForm.rooms_count ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, rooms_count: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ضريبة الخدمة (%)</label>
                  <input type="number" value={propertyForm.tax_rate ?? ""} onChange={(e) => setPropertyForm({ ...propertyForm, tax_rate: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-200 gap-2">
                <button type="button" onClick={() => setShowPropertyModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition">حفظ العقار</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW ROOM TYPE */}
      {showRoomTypeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">إضافة تصنيف غرفة جديد</h3>
              <button onClick={() => setShowRoomTypeModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateRoomType} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم التصنيف *</label>
                  <input type="text" required value={roomTypeForm.name ?? ""} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="جناح ملكي" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رمز التصنيف</label>
                  <input type="text" value={roomTypeForm.code ?? ""} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, code: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="KNG" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">السعر الأساسي (ج.م)</label>
                  <input type="number" required value={roomTypeForm.base_price ?? ""} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, base_price: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-teal-800" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">السعة (أفراد)</label>
                  <input type="number" required value={roomTypeForm.capacity ?? ""} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, capacity: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عدد الأسرة</label>
                  <input type="number" required value={roomTypeForm.beds_count ?? ""} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, beds_count: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">المميزات (مفصولة بفاصلة)</label>
                <input type="text" value={roomTypeForm.amenities ?? ""} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, amenities: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="تكييف، واي فاي، شاشة ذكية..." />
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-200 gap-2">
                <button type="button" onClick={() => setShowRoomTypeModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition">حفظ التصنيف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW FLOOR */}
      {showFloorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">إضافة طابق جديد</h3>
              <button onClick={() => setShowFloorModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (!floors.includes(newFloorNumber)) {
                setFloors([...floors, newFloorNumber].sort((a, b) => a - b));
              }
              setShowFloorModal(false); 
            }} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الطابق *</label>
                <input type="number" required value={newFloorNumber ?? ""} onChange={(e) => setNewFloorNumber(parseInt(e.target.value) || 1)} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-lg text-center" />
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-200 gap-2">
                <button type="button" onClick={() => setShowFloorModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition">إضافة الطابق</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW ROOM */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">إضافة غرفة جديدة</h3>
              <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم/كود الغرفة *</label>
                  <input type="text" required value={roomForm.room_number ?? ""} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl" placeholder="101" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الدور (الطابق)</label>
                  <input type="number" required value={roomForm.floor ?? ""} onChange={(e) => setRoomForm({ ...roomForm, floor: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تصنيف الغرفة *</label>
                  <select required value={roomForm.room_type_id ?? ""} onChange={(e) => setRoomForm({ ...roomForm, room_type_id: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl">
                    <option value="">-- اختر التصنيف --</option>
                    {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                    {roomTypes.length === 0 && <option value="1">قياسي (افتراضي)</option>}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">العقار التابع *</label>
                  <select required value={roomForm.property_id ?? ""} onChange={(e) => setRoomForm({ ...roomForm, property_id: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl">
                    <option value="">-- اختر العقار --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    {properties.length === 0 && <option value="1">العقار الرئيسي (افتراضي)</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حالة الغرفة الافتراضية</label>
                  <select value={roomForm.status ?? ""} onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold">
                    <option value="available">متاحة وجاهزة</option>
                    <option value="dirty">تحتاج تنظيف</option>
                    <option value="maintenance">صيانة</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر الغرفة المخصص (اختياري)</label>
                  <input type="number" value={roomForm.price ?? ""} onChange={(e) => setRoomForm({ ...roomForm, price: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-xl font-bold" />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-200 gap-2">
                <button type="button" onClick={() => setShowRoomModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition">حفظ الغرفة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW RESERVATION WITH DEPOSIT & GUEST DATA */}
      {showResModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">إنشاء حجز فندقي وتقاضي العربون (New Reservation & Deposit)</h3>
                <p className="text-xs text-slate-500">تسجيل بيانات النزيل التفصيلية وتحصيل العربون لتأكيد الحجز</p>
              </div>
              <button onClick={() => setShowResModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-4 text-xs">
              {/* Guest Profile Details */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-teal-800 text-xs block border-b border-slate-200 pb-1">👤 بيانات النزيل الكاملة (Guest Profile Details)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">اسم النزيل الثلاثي / الكامل *</label>
                    <input
                      type="text"
                      required
                      value={resForm.guest_name ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_name: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                      placeholder="أدخل اسم النزيل الكامل"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">رقم الهاتف / الواتساب *</label>
                    <input
                      type="text"
                      required
                      value={resForm.guest_phone ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_phone: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                      placeholder="+20 100 000 0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الجنسية</label>
                    <select
                      value={resForm.guest_nationality ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_nationality: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    >
                      <option value="مصري">مصري (Egyptian)</option>
                      <option value="سعودي">سعودي (Saudi)</option>
                      <option value="إماراتي">إماراتي (Emirati)</option>
                      <option value="كويتي">كويتي (Kuwaiti)</option>
                      <option value="قطري">قطري (Qatari)</option>
                      <option value="عماني">عماني (Omani)</option>
                      <option value="أردني">أردني (Jordanian)</option>
                      <option value="ألماني">ألماني (German)</option>
                      <option value="إنجليزي">إنجليزي (British)</option>
                      <option value="أمريكي">أمريكي (American)</option>
                      <option value="جنسية أخرى">جنسية أخرى</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">رقم الهوية الوطنية / الباسبور *</label>
                    <input
                      type="text"
                      required
                      value={resForm.guest_id_number ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_id_number: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold"
                      placeholder="أدخل رقم الرقم القومي أو الباسبور"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">النوع / الجنس</label>
                    <select
                      value={resForm.guest_gender ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_gender: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    >
                      <option value="male">ذكر (Male)</option>
                      <option value="female">أنثى (Female)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={resForm.guest_email ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_email: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl"
                      placeholder="guest@example.com"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">العنوان والمدينة</label>
                    <input
                      type="text"
                      value={resForm.guest_address ?? ""}
                      onChange={(e) => setResForm({ ...resForm, guest_address: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl"
                      placeholder="القاهرة، مصر"
                    />
                  </div>
                </div>
              </div>

              {/* Mandatory Identity Documents Upload & Capture */}
              <div className="bg-indigo-50/40 p-4 rounded-2xl border-2 border-indigo-200 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-700" />
                    <div>
                      <h4 className="font-extrabold text-xs text-indigo-950">
                        وثائق الهوية الرسمية والصورة الشخصية (إلزامي أمنياً)
                      </h4>
                      <p className="text-[11px] text-indigo-700">
                        يجب التقاط أو سحب صور بطاقة الرقم القومي أو جواز السفر أو الصورة الشخصية أو قسيمة الزواج
                      </p>
                    </div>
                  </div>
                  { (resForm.id_photo_front || resForm.passport_photo || resForm.personal_photo || resForm.marriage_cert_photo) ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم إرفاق الوثائق
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-300 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      مطلوب رفع وثيقة واحدة على الأقل
                    </span>
                  )}
                </div>

                {/* Document Type Selector */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">نوع الوثيقة الأساسية:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResForm({ ...resForm, document_type: "national_id" })}
                      className={`px-3 py-1 rounded-xl font-bold transition border ${
                        resForm.document_type === "national_id"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      بطاقة الرقم القومي
                    </button>
                    <button
                      type="button"
                      onClick={() => setResForm({ ...resForm, document_type: "passport" })}
                      className={`px-3 py-1 rounded-xl font-bold transition border ${
                        resForm.document_type === "passport"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      جواز السفر
                    </button>
                    <button
                      type="button"
                      onClick={() => setResForm({ ...resForm, document_type: "other" })}
                      className={`px-3 py-1 rounded-xl font-bold transition border ${
                        resForm.document_type === "other"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      وثيقة أخرى / هوية إقامة
                    </button>
                  </div>
                </div>

                {/* Upload Slots Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Slot 1: National ID Front / Passport */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-800">
                        {resForm.document_type === "passport" ? "جواز السفر (الصفحة الأولى)" : "البطاقة (الوجه الأمامي) *"}
                      </span>
                      {resForm.id_photo_front || resForm.passport_photo ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] text-rose-500 font-bold">مطلوب</span>
                      )}
                    </div>

                    {(resForm.document_type === "passport" ? resForm.passport_photo : resForm.id_photo_front) ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                        <img
                          src={resForm.document_type === "passport" ? resForm.passport_photo : resForm.id_photo_front}
                          alt="Document"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(resForm.document_type === "passport" ? resForm.passport_photo : resForm.id_photo_front);
                              setPreviewDocTitle(resForm.document_type === "passport" ? "جواز السفر" : "بطاقة الرقم القومي - الوجه الأمامي");
                            }}
                            className="p-1.5 bg-white text-slate-900 rounded-lg hover:bg-slate-100"
                            title="عرض وتكبير"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (resForm.document_type === "passport") {
                                setResForm({ ...resForm, passport_photo: "" });
                              } else {
                                setResForm({ ...resForm, id_photo_front: "" });
                              }
                            }}
                            className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[11px]">
                          <Upload className="w-3.5 h-3.5 text-teal-600" />
                          رفع ملف / صورة
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const base64 = await processImageFile(file);
                                if (resForm.document_type === "passport") {
                                  setResForm({ ...resForm, passport_photo: base64 });
                                } else {
                                  setResForm({ ...resForm, id_photo_front: base64 });
                                }
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => startCamera(resForm.document_type === "passport" ? "res_passport_photo" : "res_id_photo_front")}
                          className="flex items-center justify-center gap-1.5 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[11px]"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          التقاط بالكاميرا
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slot 2: National ID Back */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-800">البطاقة (الظهر)</span>
                      {resForm.id_photo_back && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>

                    {resForm.id_photo_back ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                        <img
                          src={resForm.id_photo_back}
                          alt="ID Back"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(resForm.id_photo_back);
                              setPreviewDocTitle("بطاقة الرقم القومي - الظهر");
                            }}
                            className="p-1.5 bg-white text-slate-900 rounded-lg hover:bg-slate-100"
                            title="عرض وتكبير"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResForm({ ...resForm, id_photo_back: "" })}
                            className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[11px]">
                          <Upload className="w-3.5 h-3.5 text-teal-600" />
                          رفع ظهر البطاقة
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const base64 = await processImageFile(file);
                                setResForm({ ...resForm, id_photo_back: base64 });
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => startCamera("res_id_photo_back")}
                          className="flex items-center justify-center gap-1.5 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[11px]"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          التقاط بالكاميرا
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slot 3: Personal Guest Photo */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-800">الصورة الشخصية للنزيل</span>
                      {resForm.personal_photo && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>

                    {resForm.personal_photo ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                        <img
                          src={resForm.personal_photo}
                          alt="Personal Photo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(resForm.personal_photo);
                              setPreviewDocTitle("الصورة الشخصية للنزيل");
                            }}
                            className="p-1.5 bg-white text-slate-900 rounded-lg hover:bg-slate-100"
                            title="عرض وتكبير"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResForm({ ...resForm, personal_photo: "" })}
                            className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[11px]">
                          <Upload className="w-3.5 h-3.5 text-teal-600" />
                          رفع صورة شخصية
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const base64 = await processImageFile(file);
                                setResForm({ ...resForm, personal_photo: base64 });
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => startCamera("res_personal_photo")}
                          className="flex items-center justify-center gap-1.5 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[11px]"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          التقاط صورة وجه النزيل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slot 4: Marriage Certificate */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-800">قسيمة الزواج (للعائلات)</span>
                      {resForm.marriage_cert_photo && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>

                    {resForm.marriage_cert_photo ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                        <img
                          src={resForm.marriage_cert_photo}
                          alt="Marriage Certificate"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(resForm.marriage_cert_photo);
                              setPreviewDocTitle("قسيمة الزواج الرسمية");
                            }}
                            className="p-1.5 bg-white text-slate-900 rounded-lg hover:bg-slate-100"
                            title="عرض وتكبير"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResForm({ ...resForm, marriage_cert_photo: "" })}
                            className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[11px]">
                          <Upload className="w-3.5 h-3.5 text-teal-600" />
                          رفع قسيمة الزواج
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const base64 = await processImageFile(file);
                                setResForm({ ...resForm, marriage_cert_photo: base64 });
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => startCamera("res_marriage_cert_photo")}
                          className="flex items-center justify-center gap-1.5 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[11px]"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          التقاط بالكاميرا
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Stay & Room details */}
              <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-200 space-y-3">
                <span className="font-bold text-teal-900 text-xs block border-b border-teal-200 pb-1">🛏️ تفاصيل الإقامة والغرفة (Stay & Room Selection)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاريخ الوصول</label>
                    <input
                      type="date"
                      value={resForm.check_in_date ?? ""}
                      onChange={(e) => setResForm({ ...resForm, check_in_date: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاريخ المغادرة</label>
                    <input
                      type="date"
                      value={resForm.check_out_date ?? ""}
                      onChange={(e) => setResForm({ ...resForm, check_out_date: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">عدد الأفراد (بالغين)</label>
                    <input
                      type="number"
                      min="1"
                      value={resForm.adults ?? ""}
                      onChange={(e) => setResForm({ ...resForm, adults: parseInt(e.target.value) || 1 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">أطفال</label>
                    <input
                      type="number"
                      min="0"
                      value={resForm.children ?? ""}
                      onChange={(e) => setResForm({ ...resForm, children: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">اختر الغرفة *</label>
                    <select
                      value={resForm.room_id ?? ""}
                      onChange={(e) => {
                        const selRoom = rooms.find(r => r.id.toString() === e.target.value);
                        setResForm({
                          ...resForm,
                          room_id: e.target.value,
                          room_rate: selRoom ? selRoom.price : resForm.room_rate
                        });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-teal-800"
                    >
                      <option value="">-- اختيار الغرفة المتاحة --</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>غرفة {r.room_number} ({r.room_type_name} - {r.price} ج.م/ليلة) - {r.status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">السعر اليومي للغرفة (ج.م)</label>
                    <input
                      type="number"
                      value={resForm.room_rate ?? ""}
                      onChange={(e) => setResForm({ ...resForm, room_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Deposit Payment Section */}
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-300 space-y-3">
                <span className="font-extrabold text-amber-950 text-xs block border-b border-amber-200 pb-1">💳 تحصيل العربون / الديبوزت لتأكيد الحجز (Deposit & Booking Guarantee)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-amber-900 mb-1">مبلغ العربون / الديبوزت لتأكيد الحجز (ج.م) *</label>
                    <input
                      type="number"
                      value={resForm.deposit_amount || resForm.paid_amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setResForm({ ...resForm, deposit_amount: val, paid_amount: val });
                      }}
                      className="w-full p-2.5 bg-white border border-amber-400 rounded-xl font-black text-emerald-700 text-sm"
                      placeholder="مثال: 500 ج.م"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-amber-900 mb-1">طريقة سداد العربون</label>
                    <select
                      value={resForm.payment_method ?? ""}
                      onChange={(e) => setResForm({ ...resForm, payment_method: e.target.value })}
                      className="w-full p-2.5 bg-white border border-amber-400 rounded-xl font-bold text-slate-800"
                    >
                      <option value="cash">نقداً (كاش / Cash)</option>
                      <option value="card">بطاقة ائتمان (فيزا/ماستر)</option>
                      <option value="bank_transfer">تحويل بنكي / فودافون كاش</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 font-medium">
                  💡 <strong>تأكيد الحجز الفوري:</strong> عند تسجيل مبلغ العربون المسدد وتقاضيه من النزيل، سيتم تسجيل الدفعة فوراً في فاتورة الحساب وخصم المبلغ من الإجمالي.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  تأكيد وتسجيل الحجز بالعربون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OCCUPIED ROOM & GUEST FOLIO DETAILS */}
      {showOccupiedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 text-right shadow-2xl border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-100 text-rose-700 font-black text-xl">
                  {occupiedRoomDetails?.room?.room_number || "---"}
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-2">
                    تفاصيل الغرفة {occupiedRoomDetails?.room?.room_number}
                    <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold">
                      {occupiedRoomDetails?.room?.status === "occupied" ? "🔴 مشغولة (Occupied)" : "🔵 محجوزة (Reserved)"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {occupiedRoomDetails?.room?.room_type_name || "غرفة فندقية"} | الدور {occupiedRoomDetails?.room?.floor} | {occupiedRoomDetails?.room?.price} ج.م / ليلة
                  </p>
                </div>
              </div>
              <button onClick={() => setShowOccupiedModal(false)} className="text-slate-400 hover:text-slate-600 font-extrabold text-lg">✕</button>
            </div>

            {loadingOccupiedDetails ? (
              <div className="py-12 text-center space-y-3">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
                <p className="text-sm text-slate-500 font-bold">جاري تحميل بيانات النزيل والفاتورة...</p>
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Section 1: Guest Personal Information */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <User className="w-4 h-4 text-teal-600" />
                    بيانات النزيل المقيم حالياً (Guest Profile)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-slate-400 block text-[11px]">اسم النزيل الكامل</span>
                      <span className="font-bold text-slate-900 text-sm">{occupiedRoomDetails?.guest?.full_name || occupiedRoomDetails?.reservation?.guest_name || "نزيل بدون اسم"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">رقم الهاتف / الواتساب</span>
                      <span className="font-bold text-slate-800 dir-ltr text-right block">{occupiedRoomDetails?.guest?.phone || occupiedRoomDetails?.reservation?.guest_phone || "غير مدخل"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">الجنسية</span>
                      <span className="font-bold text-slate-800">{occupiedRoomDetails?.guest?.nationality || occupiedRoomDetails?.reservation?.guest_nationality || "مصري"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">رقم الهوية / الباسبور</span>
                      <span className="font-bold text-slate-800 font-mono">{occupiedRoomDetails?.guest?.id_number || occupiedRoomDetails?.guest?.passport_number || occupiedRoomDetails?.reservation?.guest_id_number || "غير مدخل"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">البريد الإلكتروني</span>
                      <span className="font-medium text-slate-700">{occupiedRoomDetails?.guest?.email || occupiedRoomDetails?.reservation?.guest_email || "غير مدخل"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">الجنس</span>
                      <span className="font-medium text-slate-800">{occupiedRoomDetails?.guest?.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">العنوان والمدينة</span>
                      <span className="font-medium text-slate-800">{occupiedRoomDetails?.guest?.address || "غير مدخل"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">عدد المقيمين في الغرفة</span>
                      <span className="font-bold text-teal-800">
                        {occupiedRoomDetails?.reservation?.adults || 1} بالغين | {occupiedRoomDetails?.reservation?.children || 0} أطفال
                      </span>
                    </div>

                    {/* Guest Uploaded Documents Subsection */}
                    <div className="col-span-full pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-teal-600" />
                          وثائق الهوية والمستندات الرسمية المسحوبة للنزيل:
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                          ✓ موثقة ومحفوظة في النظام
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* ID Front or Passport */}
                        {(occupiedRoomDetails?.guest?.id_photo_front || occupiedRoomDetails?.reservation?.id_photo_front || occupiedRoomDetails?.guest?.passport_photo || occupiedRoomDetails?.reservation?.passport_photo) ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-1 text-center">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">
                              {occupiedRoomDetails?.guest?.passport_photo || occupiedRoomDetails?.reservation?.passport_photo ? "جواز السفر" : "البطاقة (الوجه الأمامي)"}
                            </span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={occupiedRoomDetails?.guest?.id_photo_front || occupiedRoomDetails?.reservation?.id_photo_front || occupiedRoomDetails?.guest?.passport_photo || occupiedRoomDetails?.reservation?.passport_photo}
                                alt="ID Front / Passport"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(occupiedRoomDetails?.guest?.id_photo_front || occupiedRoomDetails?.reservation?.id_photo_front || occupiedRoomDetails?.guest?.passport_photo || occupiedRoomDetails?.reservation?.passport_photo);
                                  setPreviewDocTitle("صورة إثبات الهوية / جواز السفر");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100/70 p-3 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center text-[10px] text-slate-400">
                            <FileText className="w-4 h-4 text-slate-300 mb-1" />
                            لا توجد صورة للوجه الأمامي
                          </div>
                        )}

                        {/* ID Back */}
                        {(occupiedRoomDetails?.guest?.id_photo_back || occupiedRoomDetails?.reservation?.id_photo_back) ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-1 text-center">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">البطاقة (الظهر)</span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={occupiedRoomDetails?.guest?.id_photo_back || occupiedRoomDetails?.reservation?.id_photo_back}
                                alt="ID Back"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(occupiedRoomDetails?.guest?.id_photo_back || occupiedRoomDetails?.reservation?.id_photo_back);
                                  setPreviewDocTitle("بطاقة الرقم القومي - الظهر");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100/70 p-3 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center text-[10px] text-slate-400">
                            <FileText className="w-4 h-4 text-slate-300 mb-1" />
                            لا توجد صورة لظهر البطاقة
                          </div>
                        )}

                        {/* Personal Photo */}
                        {(occupiedRoomDetails?.guest?.personal_photo || occupiedRoomDetails?.reservation?.personal_photo) ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-1 text-center">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">الصورة الشخصية للنزيل</span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={occupiedRoomDetails?.guest?.personal_photo || occupiedRoomDetails?.reservation?.personal_photo}
                                alt="Personal Photo"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(occupiedRoomDetails?.guest?.personal_photo || occupiedRoomDetails?.reservation?.personal_photo);
                                  setPreviewDocTitle("الصورة الشخصية للنزيل");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100/70 p-3 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center text-[10px] text-slate-400">
                            <User className="w-4 h-4 text-slate-300 mb-1" />
                            لا توجد صورة شخصية
                          </div>
                        )}

                        {/* Marriage Cert */}
                        {(occupiedRoomDetails?.guest?.marriage_cert_photo || occupiedRoomDetails?.reservation?.marriage_cert_photo) ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-1 text-center">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">قسيمة الزواج</span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={occupiedRoomDetails?.guest?.marriage_cert_photo || occupiedRoomDetails?.reservation?.marriage_cert_photo}
                                alt="Marriage Certificate"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(occupiedRoomDetails?.guest?.marriage_cert_photo || occupiedRoomDetails?.reservation?.marriage_cert_photo);
                                  setPreviewDocTitle("قسيمة الزواج الرسمية");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100/70 p-3 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center text-[10px] text-slate-400">
                            <FileText className="w-4 h-4 text-slate-300 mb-1" />
                            قسيمة الزواج غير مرفقة
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Stay Dates & Timings */}
                <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-200 space-y-3">
                  <h4 className="font-bold text-sm text-teal-950 flex items-center gap-2 border-b border-teal-200/60 pb-2">
                    <Clock className="w-4 h-4 text-teal-700" />
                    تفاصيل الإقامة ومواعيد الوصول والمغادرة
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-teal-700 block text-[11px]">وقت وتاريخ التسكين الفعلي (Check-In)</span>
                      <span className="font-extrabold text-teal-950 text-xs">
                        {occupiedRoomDetails?.reservation?.actual_check_in
                          ? new Date((occupiedRoomDetails.reservation.actual_check_in) || 0).toLocaleString('ar-EG')
                          : occupiedRoomDetails?.reservation?.check_in_date || "2026-08-15 (02:00 م)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-teal-700 block text-[11px]">وقت وتاريخ المغادرة المتوقع (Check-Out)</span>
                      <span className="font-extrabold text-teal-950 text-xs">
                        {occupiedRoomDetails?.reservation?.actual_check_out
                          ? new Date((occupiedRoomDetails.reservation.actual_check_out) || 0).toLocaleString('ar-EG')
                          : occupiedRoomDetails?.reservation?.check_out_date ? `${occupiedRoomDetails.reservation.check_out_date} (12:00 ظ)` : "غير محدد"}
                      </span>
                    </div>
                    <div>
                      <span className="text-teal-700 block text-[11px]">عدد الليالي المحجوزة</span>
                      <span className="font-bold text-teal-900">{occupiedRoomDetails?.reservation?.nights_count || 1} ليالي</span>
                    </div>
                    <div>
                      <span className="text-teal-700 block text-[11px]">رقم الحجز الفندقي</span>
                      <span className="font-extrabold text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-teal-300">
                        {occupiedRoomDetails?.reservation?.reservation_number || "RES-LOCAL"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Itemized Guest Folio / Bill */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-teal-600" />
                      فاتورة حساب النزيل التفصيلية حتى الآن (Guest Folio Statement)
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      حالة الحساب: {occupiedRoomDetails?.folio?.status === 'settled' ? 'مسدد بالكامل' : 'مفتوح (جارِ الإقامة)'}
                    </span>
                  </div>

                  {/* Financial Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">إجمالي الإقامة والخدمات</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {occupiedRoomDetails?.folio?.grand_total || occupiedRoomDetails?.reservation?.total_amount || 0} ج.م
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-emerald-700 block text-[10px]">إجمالي المسدد والعربون (Deposit Paid)</span>
                      <span className="font-extrabold text-emerald-800 text-sm">
                        {occupiedRoomDetails?.folio?.paid_total || occupiedRoomDetails?.reservation?.paid_amount || 0} ج.م
                      </span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 col-span-2">
                      <span className="text-rose-700 block text-[10px]">المتبقي المطلوب سداده حتى الآن (Balance Due)</span>
                      <span className="font-black text-rose-700 text-base">
                        {(occupiedRoomDetails?.folio?.balance !== undefined
                          ? occupiedRoomDetails.folio.balance
                          : (occupiedRoomDetails?.reservation?.remaining_amount || 0))} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Folio Charges Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">النوع</th>
                          <th className="p-2.5">تفاصيل البند / الخدمة</th>
                          <th className="p-2.5">التاريخ والوقت</th>
                          <th className="p-2.5">المبلغ (ج.م)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {occupiedRoomDetails?.folio?.charges && occupiedRoomDetails.folio.charges.length > 0 ? (
                          occupiedRoomDetails.folio.charges.map((charge: any, idx: number) => {
                            const isPay = charge.type === "payment" || parseFloat(charge.amount) < 0;
                            return (
                              <tr key={idx} className={isPay ? "bg-emerald-50/60 font-semibold" : ""}>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPay ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-800'}`}>
                                    {isPay ? 'دفع / عربون' : charge.type === 'room_charge' ? 'رسوم إقامة' : charge.type === 'tax' ? 'ضريبة' : 'خدمات'}
                                  </span>
                                </td>
                                <td className="p-2.5 font-medium text-slate-900">{charge.description}</td>
                                <td className="p-2.5 text-slate-500 font-mono">
                                  {charge.created_at ? new Date((charge.created_at) || 0).toLocaleString('ar-EG') : '---'}
                                </td>
                                <td className={`p-2.5 font-bold ${isPay ? 'text-emerald-700' : 'text-slate-900'}`}>
                                  {Math.abs(parseFloat(charge.amount))} ج.م {isPay ? '(مسدد)' : ''}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">لا توجد تفاصيل بنود فاتورة مسجلة حتى الآن.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Quick Inline Payment / Deposit Handler */}
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                    <span className="font-bold text-amber-900 text-xs block">💵 تحصيل دفعة سداد أو عربون إضافي لحساب الغرفة</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        placeholder="المبلغ (ج.م)"
                        value={quickPaymentAmount || ""}
                        onChange={(e) => setQuickPaymentAmount(parseFloat(e.target.value) || 0)}
                        className="p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold w-32"
                      />
                      <select
                        value={quickPaymentMethod ?? ""}
                        onChange={(e) => setQuickPaymentMethod(e.target.value)}
                        className="p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold"
                      >
                        <option value="cash">نقداً (كاش)</option>
                        <option value="card">بطاقة ائتمان (فيزا/ماستر)</option>
                        <option value="bank_transfer">تحويل بنكي</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddQuickPayment}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs"
                      >
                        تسجيل الدفعة الآن
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 4: Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setChargeForm({
                          ...chargeForm,
                          room_number: occupiedRoomDetails?.room?.room_number || ""
                        });
                        setShowChargeModal(true);
                      }}
                      className="px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                    >
                      <PlusCircle className="w-4 h-4" />
                      إضافة خدمة / مطعم
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetMoveRoomId("");
                        setShowRoomMoveModal(true);
                      }}
                      className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      نقل لغرفة أخرى
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickHousekeepingRequest(occupiedRoomDetails?.room)}
                      className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                    >
                      <Sparkles className="w-4 h-4" />
                      طلب تنظيف فوري
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMaintForm({
                          ...maintForm,
                          room_id: occupiedRoomDetails?.room?.id?.toString() || ""
                        });
                        setShowMaintenanceModal(true);
                      }}
                      className="px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                    >
                      <Wrench className="w-4 h-4" />
                      إبلاغ صيانة
                    </button>

                    {occupiedRoomDetails?.guest && (
                      <button
                        type="button"
                        onClick={() => {
                          const guestObj = guests.find(g => g.id === occupiedRoomDetails.guest.id || g.full_name === occupiedRoomDetails.guest.full_name) || occupiedRoomDetails.guest;
                          handleViewGuestProfile(guestObj);
                        }}
                        className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                      >
                        <User className="w-4 h-4" />
                        الملف الشامل للنزيل
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة الفاتورة
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {occupiedRoomDetails?.reservation && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`هل ترغب في إجراء تسجيل المغادرة وتسوية حساب الغرفة ${occupiedRoomDetails.room.room_number}؟`)) {
                            handleCheckOut(occupiedRoomDetails.reservation.id);
                            setShowOccupiedModal(false);
                          }
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 transition text-xs"
                      >
                        <LogOut className="w-4 h-4" />
                        تسجيل المغادرة وإنهاء الإقامة
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowOccupiedModal(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ROOM MOVE / SHIFT ROOM */}
      {showRoomMoveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">نقل النزيل إلى غرفة بديلة</h3>
                  <p className="text-xs text-slate-500">الغرفة الحالية: {occupiedRoomDetails?.room?.room_number}</p>
                </div>
              </div>
              <button onClick={() => setShowRoomMoveModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[11px]">اسم النزيل</span>
                <span className="font-bold text-slate-900 text-sm">{occupiedRoomDetails?.guest?.full_name || occupiedRoomDetails?.reservation?.guest_name}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الغرفة البديلة المتاحة *</label>
                <select
                  value={targetMoveRoomId ?? ""}
                  onChange={(e) => setTargetMoveRoomId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                >
                  <option value="">-- اختر من الغرف المتاحة والنظيفة --</option>
                  {rooms
                    .filter(r => r.status === "available" && r.id !== occupiedRoomDetails?.room?.id)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        غرفة {r.room_number} - {r.room_type_name || "قياسي"} (الدور {r.floor}) - {r.price} ج.م/ليلة
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ℹ️ <strong>ملاحظة نظام:</strong> عند تأكيد النقل، سيتم ربط الحجز والفاتورة بالغرفة الجديدة تلقائياً، وتحويل الغرفة الحالية ({occupiedRoomDetails?.room?.room_number}) لقسم النظافة والتعقيم لإعادة تجهيزها.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRoomMoveModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleMoveRoom}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-xs"
              >
                تأكيد نقل الغرفة الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHARGE TO ROOM (POS) */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">تحميل خدمات المطعم/POS على حساب الغرفة</h3>
              <button onClick={() => setShowChargeModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleChargeRoom} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الغرفة *</label>
                <input
                  type="text"
                  required
                  value={chargeForm.room_number ?? ""}
                  onChange={(e) => setChargeForm({ ...chargeForm, room_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-lg font-bold text-teal-800"
                  placeholder="مثال: 102"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف الخدمة / الوجبة</label>
                <input
                  type="text"
                  required
                  value={chargeForm.description ?? ""}
                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ الإجمالي (ج.م) *</label>
                <input
                  type="number"
                  required
                  value={chargeForm.amount ?? ""}
                  onChange={(e) => setChargeForm({ ...chargeForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-lg font-bold text-rose-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md"
                >
                  تحميل على حساب الغرفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MAINTENANCE */}
      {showResolveMaintenanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">إغلاق بلاغ الصيانة وإعادة الغرفة للتشغيل</h3>
              <button onClick={() => setShowResolveMaintenanceModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleResolveMaintenanceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الإجراءات التي قام بها فني الصيانة (الحل)</label>
                <textarea
                  required
                  placeholder="مثال: تم تغيير اللمبات، تم إصلاح تسريب المياه وتجربة التشغيل بنجاح..."
                  value={resolveMaintenanceForm.notes ?? ""}
                  onChange={(e) => setResolveMaintenanceForm({ ...resolveMaintenanceForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold min-h-[100px] resize-y bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500"
                ></textarea>
                <p className="text-[10px] text-slate-500 mt-1">يجب كتابة الإجراءات لحفظها في تقرير سجل الصيانة الفندقية.</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowResolveMaintenanceModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  إغلاق البلاغ (Resolved)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">إرسال بلاغ صيانة وعطل للغرفة</h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateMaintenance} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الغرفة *</label>
                <select
                  required
                  value={maintForm.room_id ?? ""}
                  onChange={(e) => setMaintForm({ ...maintForm, room_id: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="">-- اختيار الغرفة --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>غرفة {r.room_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان العطل / المشكلة *</label>
                <input
                  type="text"
                  required
                  value={maintForm.problem ?? ""}
                  onChange={(e) => setMaintForm({ ...maintForm, problem: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                  placeholder="مثال: عطل في التكييف وتسريب مياه"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">درجة الأولوية</label>
                <select
                  value={maintForm.priority ?? ""}
                  onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="high">عالية جداً (طارئة)</option>
                  <option value="medium">متوسطة</option>
                  <option value="low">منخفضة</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md"
                >
                  تأكيد وحظر الغرفة للصيانة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FOLIO & BILLING */}
      {showFolioModal && activeFolio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">فاتورة حساب النزيل (Guest Folio)</h3>
                <p className="text-xs text-slate-500">كشف حساب تفصيلي للإقامة والخدمات المحملة</p>
              </div>
              <button onClick={() => setShowFolioModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>إجمالي المبلغ: <span className="font-bold text-slate-900">{activeFolio.grand_total} ج.م</span></div>
                <div>المسدد: <span className="font-bold text-emerald-700">{activeFolio.paid_total} ج.م</span></div>
                <div>المتبقي: <span className="font-bold text-rose-700">{activeFolio.balance} ج.م</span></div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">النوع</th>
                      <th className="p-2.5">البيان / الخدمة</th>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5 text-left">المبلغ (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeFolio.charges?.map((ch: any) => (
                      <tr key={ch.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold">{ch.type}</td>
                        <td className="p-2.5">{ch.description}</td>
                        <td className="p-2.5 text-slate-400">{ch.created_at?.toString().split("T")[0]}</td>
                        <td className={`p-2.5 text-left font-bold ${ch.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {ch.amount} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
              >
                <Printer className="w-4 h-4" />
                طباعة الفاتورة
              </button>
              <button
                onClick={() => setShowFolioModal(false)}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW SUPPLY ITEM TO CENTRAL INVENTORY */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-lg text-slate-900">إضافة صنف مستلزمات للمخازن المركزية</h3>
              </div>
              <button onClick={() => setShowSupplyModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateSupply} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">اسم الصنف / المستلزم الفندقي *</label>
                  <input
                    type="text"
                    required
                    value={supplyForm.name ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    placeholder="مثال: أطقم ملاءات سرير قطن 100%، شامبو فاخر 50مل..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف الفندقي *</label>
                  <select
                    value={supplyForm.category ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, category: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="بياضات ومفروشات">بياضات ومفروشات (Linens)</option>
                    <option value="مستلزمات نظافة ورعاية">مستلزمات نظافة ورعاية (Amenities)</option>
                    <option value="ميني بار ومشروبات">ميني بار ومشروبات (Mini Bar)</option>
                    <option value="مستلزمات نزلاء">مستلزمات نزلاء (Guest Supplies)</option>
                    <option value="أثاث وأجهزة غرف">أثاث وأجهزة غرف (Furniture/Appliances)</option>
                    <option value="أدوات صيانة وديكور">أدوات صيانة وديكور (Maintenance/Decor)</option>
                    <option value="مستلزمات عامة">مستلزمات عامة</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">وحدة القياس *</label>
                  <select
                    value={supplyForm.unit ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="طقم">طقم (Set)</option>
                    <option value="قطعة">قطعة (Piece)</option>
                    <option value="عبوة">عبوة (Pack)</option>
                    <option value="زوج">زوج (Pair)</option>
                    <option value="رداء">رداء (Gown)</option>
                    <option value="كرتونة">كرتونة (Box)</option>
                    <option value="كيلو">كيلو (Kg)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكود / SKU</label>
                  <input
                    type="text"
                    value={supplyForm.code ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, code: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                    placeholder="تلقائي إن ترك فارغاً"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الباركوود (Barcode)</label>
                  <input
                    type="text"
                    value={supplyForm.barcode ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, barcode: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                    placeholder="رقم الباركوود إن وجد"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">حد الطلب الأدنى (Min Stock) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={supplyForm.min_stock ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, min_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر الشراء / متوسط التكلفة (ج.م) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={supplyForm.avg_cost ?? ""}
                    onChange={(e) => setSupplyForm({ ...supplyForm, avg_cost: parseFloat(e.target.value) || 0, last_purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-teal-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSupplyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  حفظ الصنف بالمخازن المركزية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK STOCK ADJUSTMENT / SUPPLY ENTRY */}
      {showStockAdjustModal && selectedItemForStock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">تسجيل حركة مخزنية / تعديل كمية</h3>
                <p className="text-xs text-slate-500">{selectedItemForStock.name}</p>
              </div>
              <button onClick={() => setShowStockAdjustModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">الرصيد الحالي بالمخزن:</span>
                <span className="text-lg font-black text-slate-900">
                  {selectedItemForStock.total_stock || selectedItemForStock.quantity || 0} {selectedItemForStock.unit || "قطعة"}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الحركة *</label>
                <select
                  value={stockAdjustForm.type ?? ""}
                  onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, type: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="in">توريد / إضافة كمية واردة للمخزن (+)</option>
                  <option value="out">صرف / استهلاك للغرف (-)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stockAdjustForm.quantity ?? ""}
                  onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, quantity: parseFloat(e.target.value) || 1 })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-black text-lg text-teal-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المخزن المستهدف *</label>
                <select
                  value={stockAdjustForm.warehouse_id ?? ""}
                  onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, warehouse_id: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="">-- المخزن الرئيسي --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات الحركة</label>
                <input
                  type="text"
                  value={stockAdjustForm.notes ?? ""}
                  onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                  placeholder="سبب الحركة، الفاتورة، أو قسم الغرف المستلم..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowStockAdjustModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  تأكيد الحركة وتحديث المخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GUEST PROFILE & VISITS HISTORY */}
      {showGuestProfileModal && selectedGuestProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-5 text-right shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black text-xl shadow-inner">
                  {selectedGuestProfile.full_name ? selectedGuestProfile.full_name.charAt(0) : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-xl text-slate-900">
                      {selectedGuestProfile.full_name}
                    </h3>
                    <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full font-bold">
                      {selectedGuestProfile.nationality || "مصري"}
                    </span>
                    {(selectedGuestProfile.stays_count || selectedGuestProfile.reservations?.length || 0) >= 2 && (
                      <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                        ⭐ عميل مميز VIP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ملف النزيل الشامل • سجل الإقامات والزيارات السابقة • الفواتير والمدفوعات
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة الكشف
                </button>
                <button
                  onClick={() => {
                    handleOpenGuestEdit(selectedGuestProfile);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition border border-blue-200"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => setShowGuestProfileModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              {loadingGuestProfile ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                  <p className="font-bold text-xs">جاري تحميل سجل الزيارات والبيانات المالية...</p>
                </div>
              ) : (
                <>
                  {/* KPI Quick Overview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block font-medium">عدد الزيارات والإقامات</span>
                      <span className="text-lg font-black text-slate-900">
                        {selectedGuestProfile.stays_count || selectedGuestProfile.reservations?.length || 0} زيارات
                      </span>
                    </div>
                    <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-200">
                      <span className="text-[11px] text-teal-800 block font-medium">إجمالي المبالغ المنصرفة</span>
                      <span className="text-lg font-black text-teal-900">
                        {(parseFloat(selectedGuestProfile.total_spent) || (selectedGuestProfile.reservations?.reduce((s: number, r: any) => s + (parseFloat(r.total_amount) || 0), 0)) || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200">
                      <span className="text-[11px] text-blue-800 block font-medium">متوسط الحجز لكل زيارة</span>
                      <span className="text-lg font-black text-blue-900">
                        {Math.round(
                          ((parseFloat(selectedGuestProfile.total_spent) || (selectedGuestProfile.reservations?.reduce((s: number, r: any) => s + (parseFloat(r.total_amount) || 0), 0)) || 0) /
                          Math.max(1, (selectedGuestProfile.stays_count || selectedGuestProfile.reservations?.length || 1)))
                        ).toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block font-medium">حالة النزيل الآن</span>
                      <span className="text-sm font-extrabold text-emerald-900 flex items-center gap-1 mt-1">
                        {selectedGuestProfile.current_room_number || selectedGuestProfile.reservations?.some((r: any) => r.status === 'checked_in') ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                            مقيم حالياً (غرفة {selectedGuestProfile.current_room_number || selectedGuestProfile.reservations?.find((r: any) => r.status === 'checked_in')?.room_number})
                          </>
                        ) : (
                          "غير مقيم حالياً"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Personal & Identification Details Card */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-2 border-b border-slate-200/80 pb-2">
                      <User className="w-4 h-4 text-teal-600" />
                      البيانات الشخصية ووثائق الهوية
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم الهاتف:</span>
                        <span className="font-mono font-bold text-slate-900 dir-ltr text-right block">
                          {selectedGuestProfile.phone || "غير مسجل"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">البريد الإلكتروني:</span>
                        <span className="font-bold text-slate-900 truncate block">
                          {selectedGuestProfile.email || "غير مسجل"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم البطاقة القومية:</span>
                        <span className="font-mono font-bold text-slate-900 block">
                          {selectedGuestProfile.id_number || "---"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم جواز السفر:</span>
                        <span className="font-mono font-bold text-slate-900 block">
                          {selectedGuestProfile.passport_number || "---"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">النوع / الجنس:</span>
                        <span className="font-bold text-slate-900 block">
                          {selectedGuestProfile.gender === "female" ? "أنثى" : "ذكر"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">تاريخ الميلاد:</span>
                        <span className="font-mono text-slate-900 block">
                          {selectedGuestProfile.dob ? selectedGuestProfile.dob.toString().split("T")[0] : "---"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">العنوان / المدينة:</span>
                        <span className="font-bold text-slate-900 block truncate">
                          {selectedGuestProfile.address || "غير محدد"}
                        </span>
                      </div>
                    </div>

                    {/* Documents & IDs Row in Profile Modal */}
                    <div className="pt-3 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700 block mb-2">وثائق الهوية المسحوبة والمحفوظة:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {(selectedGuestProfile.id_photo_front || selectedGuestProfile.passport_photo) ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 text-center space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">
                              {selectedGuestProfile.passport_photo ? "جواز السفر" : "البطاقة (الوجه الأمامي)"}
                            </span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={selectedGuestProfile.id_photo_front || selectedGuestProfile.passport_photo}
                                alt="ID Front / Passport"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(selectedGuestProfile.id_photo_front || selectedGuestProfile.passport_photo);
                                  setPreviewDocTitle(selectedGuestProfile.passport_photo ? "جواز السفر" : "بطاقة الرقم القومي - الوجه الأمامي");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100 p-2.5 rounded-xl border border-dashed border-slate-300 text-center text-[10px] text-slate-400">
                            لا توجد صورة للوجه الأمامي
                          </div>
                        )}

                        {selectedGuestProfile.id_photo_back ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 text-center space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">البطاقة (الظهر)</span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={selectedGuestProfile.id_photo_back}
                                alt="ID Back"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(selectedGuestProfile.id_photo_back);
                                  setPreviewDocTitle("بطاقة الرقم القومي - الظهر");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100 p-2.5 rounded-xl border border-dashed border-slate-300 text-center text-[10px] text-slate-400">
                            لا توجد صورة لظهر البطاقة
                          </div>
                        )}

                        {selectedGuestProfile.personal_photo ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 text-center space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">الصورة الشخصية</span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={selectedGuestProfile.personal_photo}
                                alt="Personal Photo"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(selectedGuestProfile.personal_photo);
                                  setPreviewDocTitle("الصورة الشخصية للنزيل");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100 p-2.5 rounded-xl border border-dashed border-slate-300 text-center text-[10px] text-slate-400">
                            لا توجد صورة شخصية
                          </div>
                        )}

                        {selectedGuestProfile.marriage_cert_photo ? (
                          <div className="bg-white p-2 rounded-xl border border-slate-200 text-center space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold block truncate">قسيمة الزواج</span>
                            <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                              <img
                                src={selectedGuestProfile.marriage_cert_photo}
                                alt="Marriage Cert"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(selectedGuestProfile.marriage_cert_photo);
                                  setPreviewDocTitle("قسيمة الزواج الرسمية");
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                              >
                                <Eye className="w-4 h-4" />
                                تكبير
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100 p-2.5 rounded-xl border border-dashed border-slate-300 text-center text-[10px] text-slate-400">
                            قسيمة الزواج غير مرفقة
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedGuestProfile.notes && (
                      <div className="pt-2 border-t border-slate-200 text-xs">
                        <span className="text-slate-500 font-bold block mb-1">ملاحظات وتفضيلات النزيل:</span>
                        <p className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs">
                          {selectedGuestProfile.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Previous Visits & Stays Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <History className="w-4 h-4 text-emerald-600" />
                        سجل الإقامات والزيارات السابقة (Stays & Reservation History)
                      </h4>
                      <button
                        onClick={() => {
                          setShowGuestProfileModal(false);
                          setResForm({
                            ...resForm,
                            guest_name: selectedGuestProfile.full_name || "",
                            guest_phone: selectedGuestProfile.phone || "",
                            guest_email: selectedGuestProfile.email || "",
                            guest_nationality: selectedGuestProfile.nationality || "مصري",
                            guest_id_number: selectedGuestProfile.id_number || "",
                            guest_passport_number: selectedGuestProfile.passport_number || "",
                            guest_gender: selectedGuestProfile.gender || "male",
                            guest_address: selectedGuestProfile.address || ""
                          });
                          setShowResModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        إنشاء حجز جديد لهذا النزيل
                      </button>
                    </div>

                    {(!selectedGuestProfile.reservations || selectedGuestProfile.reservations.length === 0) ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-bold text-xs text-slate-600">لا توجد زيارات سابقة مسجلة في النظام لهذا النزيل</p>
                        <p className="text-[11px] text-slate-400">يمكنك الضغط على زر "إنشاء حجز جديد" لتسجيل أول إقامة للنزيل</p>
                      </div>
                    ) : (
                      <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300 text-[11px]">
                              <th className="p-2.5 border-l border-slate-200">رقم الحجز</th>
                              <th className="p-2.5 border-l border-slate-200">الغرفة والنوع</th>
                              <th className="p-2.5 border-l border-slate-200">تاريخ وتوقيت الوصول</th>
                              <th className="p-2.5 border-l border-slate-200">تاريخ وتوقيت المغادرة</th>
                              <th className="p-2.5 border-l border-slate-200 text-center">الليالي</th>
                              <th className="p-2.5 border-l border-slate-200 text-left">إجمالي الفاتورة</th>
                              <th className="p-2.5 border-l border-slate-200 text-left">المسدد والعربون</th>
                              <th className="p-2.5 border-l border-slate-200 text-left">المتبقي</th>
                              <th className="p-2.5 border-l border-slate-200 text-center">الحالة</th>
                              <th className="p-2.5 text-center">الفاتورة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedGuestProfile.reservations.map((resItem: any) => (
                              <tr key={resItem.id} className="hover:bg-slate-50/80 font-medium">
                                <td className="p-2.5 border-l border-slate-200 font-mono font-bold text-teal-800">
                                  {resItem.reservation_number || `#${resItem.id}`}
                                </td>
                                <td className="p-2.5 border-l border-slate-200">
                                  <span className="font-bold text-slate-900 block">
                                    غرفة {resItem.room_number || "غير محددة"}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {resItem.room_type_name || "غرفة فندقية"}
                                  </span>
                                </td>
                                <td className="p-2.5 border-l border-slate-200 font-mono text-slate-700">
                                  <div>{resItem.check_in_date?.toString().split("T")[0]}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {resItem.actual_check_in_time ? new Date(resItem.actual_check_in_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : (resItem.check_in_time || "14:00")}
                                  </div>
                                </td>
                                <td className="p-2.5 border-l border-slate-200 font-mono text-slate-700">
                                  <div>{resItem.check_out_date?.toString().split("T")[0]}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {resItem.actual_check_out_time ? new Date(resItem.actual_check_out_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : (resItem.check_out_time || "12:00")}
                                  </div>
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-center font-bold font-mono">
                                  {resItem.nights_count || 1}
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-left font-mono font-bold text-slate-900">
                                  {parseFloat(resItem.total_amount || 0 || 0).toLocaleString()} ج.م
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-left font-mono font-bold text-emerald-700">
                                  {parseFloat(resItem.paid_amount || 0 || 0).toLocaleString()} ج.م
                                  {resItem.deposit_amount > 0 && (
                                    <span className="block text-[10px] text-teal-600 font-semibold">
                                      عربون: {resItem.deposit_amount}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-left font-mono font-bold">
                                  {parseFloat(resItem.remaining_amount || 0) > 0 ? (
                                    <span className="text-rose-600">
                                      {parseFloat(resItem.remaining_amount || 0).toLocaleString()} ج.م
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600">0 ج.م (خالص)</span>
                                  )}
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-center">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      resItem.status === "checked_in"
                                        ? "bg-rose-100 text-rose-800"
                                        : resItem.status === "checked_out"
                                        ? "bg-slate-100 text-slate-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {resItem.status === "checked_in"
                                      ? "مقيم حالياً"
                                      : resItem.status === "checked_out"
                                      ? "مغادر"
                                      : "مؤكد"}
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => handleViewFolio(resItem.id)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold border border-slate-300 transition"
                                  >
                                    الفاتورة
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 shrink-0">
              <span className="text-xs text-slate-400 font-mono">
                معرف النزيل: #{selectedGuestProfile.id}
              </span>
              <button
                onClick={() => setShowGuestProfileModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT GUEST PROFILE */}
      {showGuestEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-lg text-slate-900">
                  {guestEditForm.id ? "تعديل بيانات النزيل" : "تسجيل نزيل جديد في سجل الضيوف"}
                </h3>
              </div>
              <button
                onClick={() => setShowGuestEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGuest} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">اسم النزيل بالكامل *</label>
                  <input
                    type="text"
                    required
                    value={guestEditForm.full_name ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, full_name: e.target.value })}
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف / الواتساب</label>
                  <input
                    type="text"
                    value={guestEditForm.phone ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, phone: e.target.value })}
                    placeholder="01012345678"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Nationality */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الجنسية</label>
                  <input
                    type="text"
                    value={guestEditForm.nationality ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, nationality: e.target.value })}
                    placeholder="مصري، سعودي، كويتي، إماراتي..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* National ID */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهوية الوطنية / الرقم القومي</label>
                  <input
                    type="text"
                    value={guestEditForm.id_number ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, id_number: e.target.value })}
                    placeholder="14 رقم للرقم القومي"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Passport */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم جواز السفر</label>
                  <input
                    type="text"
                    value={guestEditForm.passport_number ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, passport_number: e.target.value })}
                    placeholder="A12345678"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={guestEditForm.email ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, email: e.target.value })}
                    placeholder="guest@example.com"
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">النوع / الجنس</label>
                  <select
                    value={guestEditForm.gender ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, gender: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:border-teal-500 focus:outline-hidden"
                  >
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الميلاد</label>
                  <input
                    type="date"
                    value={guestEditForm.dob ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, dob: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">العنوان والمدينة</label>
                  <input
                    type="text"
                    value={guestEditForm.address ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, address: e.target.value })}
                    placeholder="المدينة، المحافظة، الحي..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات وتفضيلات النزيل</label>
                  <textarea
                    rows={2}
                    value={guestEditForm.notes ?? ""}
                    onChange={(e) => setGuestEditForm({ ...guestEditForm, notes: e.target.value })}
                    placeholder="مثل: يفضل غرف هادئة، دور علوي، طلبات خاصة..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Identity Documents Slots in Guest Edit Form */}
                <div className="sm:col-span-2 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-200/80 pb-1.5">
                    <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-700" />
                      وثائق الهوية الرسمية (إلزامي حفظ صورة للنزيل أمنياً)
                    </span>
                    {(guestEditForm.id_photo_front || guestEditForm.passport_photo || guestEditForm.personal_photo || guestEditForm.marriage_cert_photo) && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ مرفقة
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Front ID / Passport */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block truncate">البطاقة (أمام) / جواز</span>
                      {guestEditForm.id_photo_front ? (
                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                          <img src={guestEditForm.id_photo_front} alt="ID Front" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDocUrl(guestEditForm.id_photo_front);
                                setPreviewDocTitle("بطاقة الرقم القومي - الوجه الأمامي");
                              }}
                              className="p-1 bg-white text-slate-900 rounded"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setGuestEditForm({ ...guestEditForm, id_photo_front: "" })}
                              className="p-1 bg-rose-600 text-white rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[10px] text-center">
                            رفع ملف
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const b = await processImageFile(f);
                                  setGuestEditForm({ ...guestEditForm, id_photo_front: b });
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => startCamera("guest_id_photo_front")}
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[10px]"
                          >
                            كاميرا
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Back ID */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block truncate">البطاقة (الظهر)</span>
                      {guestEditForm.id_photo_back ? (
                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                          <img src={guestEditForm.id_photo_back} alt="ID Back" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDocUrl(guestEditForm.id_photo_back);
                                setPreviewDocTitle("بطاقة الرقم القومي - الظهر");
                              }}
                              className="p-1 bg-white text-slate-900 rounded"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setGuestEditForm({ ...guestEditForm, id_photo_back: "" })}
                              className="p-1 bg-rose-600 text-white rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[10px] text-center">
                            رفع ملف
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const b = await processImageFile(f);
                                  setGuestEditForm({ ...guestEditForm, id_photo_back: b });
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => startCamera("guest_id_photo_back")}
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[10px]"
                          >
                            كاميرا
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Personal Photo */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block truncate">الصورة الشخصية</span>
                      {guestEditForm.personal_photo ? (
                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                          <img src={guestEditForm.personal_photo} alt="Face" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDocUrl(guestEditForm.personal_photo);
                                setPreviewDocTitle("الصورة الشخصية للنزيل");
                              }}
                              className="p-1 bg-white text-slate-900 rounded"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setGuestEditForm({ ...guestEditForm, personal_photo: "" })}
                              className="p-1 bg-rose-600 text-white rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[10px] text-center">
                            رفع ملف
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const b = await processImageFile(f);
                                  setGuestEditForm({ ...guestEditForm, personal_photo: b });
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => startCamera("guest_personal_photo")}
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[10px]"
                          >
                            كاميرا
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Marriage Cert */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block truncate">قسيمة الزواج</span>
                      {guestEditForm.marriage_cert_photo ? (
                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 flex items-center justify-center">
                          <img src={guestEditForm.marriage_cert_photo} alt="Cert" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDocUrl(guestEditForm.marriage_cert_photo);
                                setPreviewDocTitle("قسيمة الزواج الرسمية");
                              }}
                              className="p-1 bg-white text-slate-900 rounded"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setGuestEditForm({ ...guestEditForm, marriage_cert_photo: "" })}
                              className="p-1 bg-rose-600 text-white rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-dashed border-slate-300 cursor-pointer font-bold transition text-[10px] text-center">
                            رفع ملف
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const b = await processImageFile(f);
                                  setGuestEditForm({ ...guestEditForm, marriage_cert_photo: b });
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => startCamera("guest_marriage_cert_photo")}
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 font-bold transition text-[10px]"
                          >
                            كاميرا
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowGuestEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  {guestEditForm.id ? "حفظ التعديلات" : "تسجيل النزيل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GUEST DOCUMENTS ARCHIVE & ATTACHMENTS */}
      {showGuestDocsModal && currentDocsGuest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 space-y-5 text-right shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-lg shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900">
                    أرشيف وثائق ومستندات النزيل: {currentDocsGuest.full_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {currentDocsGuest.id_number ? `الرقم القومي: ${currentDocsGuest.id_number}` : currentDocsGuest.passport_number ? `جواز السفر: ${currentDocsGuest.passport_number}` : "إدارة وأرشفة الوثائق الرسمية"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowGuestDocsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              {/* Upload New Document Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-teal-600" />
                  إضافة وإرفاق وثيقة رسمية جديدة
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع الوثيقة *</label>
                    <select
                      value={newGuestDocForm.document_type ?? ""}
                      onChange={(e) => setNewGuestDocForm({ ...newGuestDocForm, document_type: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="national_id_front">بطاقة رقم قومي (أمام)</option>
                      <option value="national_id_back">بطاقة رقم قومي (خلف)</option>
                      <option value="passport">جواز السفر</option>
                      <option value="visa">تأشيرة دخول / إقامة</option>
                      <option value="marriage_cert">قسيمة زواج رسمية</option>
                      <option value="company_letter">خطاب تفويض شركة</option>
                      <option value="driving_license">رخصة قيادة</option>
                      <option value="other">مستند / وثيقة أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">عنوان / وصف الوثيقة</label>
                    <input
                      type="text"
                      value={newGuestDocForm.title ?? ""}
                      onChange={(e) => setNewGuestDocForm({ ...newGuestDocForm, title: e.target.value })}
                      placeholder="مثال: جواز سفر ساري، عقد زواج..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم الوثيقة (اختياري)</label>
                    <input
                      type="text"
                      value={newGuestDocForm.document_number ?? ""}
                      onChange={(e) => setNewGuestDocForm({ ...newGuestDocForm, document_number: e.target.value })}
                      placeholder="الرقم المسجل على الوثيقة"
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Upload or Camera preview */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer shadow-2xs transition">
                    <Upload className="w-4 h-4 text-teal-600" />
                    <span>رفع ملف صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewGuestDocForm((prev: any) => ({ ...prev, file_url: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => startCamera('guest_doc_modal')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 shadow-2xs transition"
                  >
                    <Camera className="w-4 h-4 text-indigo-600" />
                    التقاط بالكاميرا الحية
                  </button>

                  {newGuestDocForm.file_url && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تم تجهيز الصورة</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewDocUrl(newGuestDocForm.file_url);
                          setPreviewDocTitle("معاينة الوثيقة المجهزة للرفع");
                        }}
                        className="text-emerald-700 underline text-[11px]"
                      >
                        معاينة
                      </button>
                    </div>
                  )}

                  <div className="mr-auto">
                    <button
                      type="button"
                      onClick={handleUploadGuestDoc}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                    >
                      حفظ وأرشفة الوثيقة
                    </button>
                  </div>
                </div>
              </div>

              {/* Stored Documents List */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    الوثائق الموثقة والمؤرشفة للنزيل ({guestDocsList.length})
                  </span>
                  {loadingGuestDocs && <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />}
                </h4>

                {guestDocsList.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    لا توجد وثائق مؤرشفة لهذا النزيل حالياً. يمكنك رفع وثائق الهوية أو التقاطها عبر الكاميرا.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {guestDocsList.map((doc) => (
                      <div key={doc.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 relative group hover:border-teal-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-900 truncate">
                            {doc.title || doc.doc_type}
                          </span>
                          <button
                            onClick={() => handleDeleteGuestDoc(doc.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                            title="حذف الوثيقة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {doc.file_url ? (
                          <div className="relative rounded-xl overflow-hidden aspect-4/3 bg-slate-200 border border-slate-300">
                            <img src={doc.file_url} alt={doc.title} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDocUrl(doc.file_url);
                                setPreviewDocTitle(doc.title || "وثيقة النزيل");
                              }}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition"
                            >
                              <Eye className="w-4 h-4" />
                              تكبير
                            </button>
                          </div>
                        ) : (
                          <div className="aspect-4/3 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                            لا توجد صورة
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono pt-1">
                          <span>{doc.doc_number ? `#${doc.doc_number}` : ""}</span>
                          <span>{doc.created_at ? doc.created_at.toString().split("T")[0] : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIVE CAMERA SNAPSHOT CAPTURE */}
      {cameraActiveTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-700 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-base text-white">التقاط وثيقة الهوية / الصورة عبر الكاميرا</h3>
              </div>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-8 inset-y-6 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[11px] bg-black/50 text-white/80 px-3 py-1 rounded-full backdrop-blur-xs font-bold">
                  ضع الوثيقة أو وجه النزيل داخل الإطار
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={captureCameraPhoto}
                className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 shadow-lg transition active:scale-95"
              >
                <Camera className="w-4 h-4" />
                التقاط الصورة الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SERVICE IN CATALOG (SETTINGS) */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {serviceCatalogForm.id ? "تعديل بيانات وتسعير الخدمة الفندقية" : "إنشاء وتأسيس خدمة فندقية جديدة"}
                </h3>
              </div>
              <button
                onClick={() => setShowAddServiceModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">اسم الخدمة الفندقية *</label>
                  <input
                    type="text"
                    required
                    value={serviceCatalogForm.name ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-teal-500"
                    placeholder="مثال: تنظيف وتغيير مفارش VIP، غسيل بدلة كاملة، إفطار كونتيننتال..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود الخدمة</label>
                  <input
                    type="text"
                    value={serviceCatalogForm.code ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, code: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-700 font-bold"
                    placeholder="SRV-001"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تصنيف الخدمة *</label>
                  <select
                    value={serviceCatalogForm.category ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, category: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="housekeeping">نظافة وتجهيز غرف (Housekeeping)</option>
                    <option value="laundry">مغسلة وكي ملابس (Laundry)</option>
                    <option value="food_beverage">مأكولات ومشروبات (Room Dining)</option>
                    <option value="minibar">ميني بار وثلاجة (Minibar)</option>
                    <option value="transport">ليموزين وتوصيل (Transport)</option>
                    <option value="wellness">سبا ومساج وعناية (Wellness / Spa)</option>
                    <option value="extra_bed">سرير إضافي ومفروشات (Extra Bed/Linens)</option>
                    <option value="other">خدمات عامة متنوعة (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر الخدمة (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={serviceCatalogForm.price ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-black text-teal-700 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">وحدة القياس / الحساب</label>
                  <input
                    type="text"
                    value={serviceCatalogForm.unit ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, unit: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    placeholder="مرة / قطعة / ليلة / وجبة"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نسبة الضريبة (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={serviceCatalogForm.tax_rate ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    placeholder="14"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الوقت المتوقع للتنفيذ (بالدقائق)</label>
                  <input
                    type="number"
                    min="0"
                    value={serviceCatalogForm.estimated_time_minutes ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, estimated_time_minutes: parseInt(e.target.value) || 30 })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    placeholder="30"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">وصف وتفاصيل الخدمة</label>
                  <textarea
                    rows={2}
                    value={serviceCatalogForm.description ?? ""}
                    onChange={(e) => setServiceCatalogForm({ ...serviceCatalogForm, description: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                    placeholder="تفاصيل إضافية أو شروط تقديم الخدمة للنزلاء..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  {serviceCatalogForm.id ? "حفظ التعديلات" : "حفظ وإنشاء الخدمة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ORDER SERVICE FOR GUEST ROOM & CHARGE TO FOLIO */}
      {showOrderServiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 text-right shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    طلب خدمة لنزيل وإضافتها للفاتورة
                  </h3>
                  <p className="text-[11px] text-slate-500">تحميل الرسوم فوراً على كشف حساب الفاتورة (Guest Folio)</p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderServiceModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteServiceOrder} className="space-y-4 text-xs">
              <div className="space-y-3">
                {/* Select Room */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الغرفة المشغولة / النزيل *</label>
                  <select
                    required
                    value={serviceOrderForm.room_number ?? ""}
                    onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, room_number: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- اختر الغرفة والنزيل --</option>
                    {rooms.filter(r => r.status === "occupied").map((rm) => {
                      const res = reservations.find(r => r.room_id === rm.id && r.status === "checked_in");
                      return (
                        <option key={rm.id} value={rm.room_number}>
                          غرفة {rm.room_number} ({res?.guest_name || "نزيل مقيم"})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Select Service */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخدمة المطلوبة من الدليل *</label>
                  <select
                    required
                    value={serviceOrderForm.service_id ?? ""}
                    onChange={(e) => {
                      const sid = parseInt(e.target.value);
                      const srv = servicesList.find(s => s.id === sid);
                      if (srv) {
                        setServiceOrderForm({
                          ...serviceOrderForm,
                          service_id: srv.id,
                          unit_price: srv.price,
                        });
                      }
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value={0}>-- اختر من قائمة الخدمات المعرفة --</option>
                    {servicesList.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({srv.price} ج.م / {srv.unit || "مرة"}) - {srv.category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity and Unit Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الكمية / التكرار *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={serviceOrderForm.quantity ?? ""}
                      onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">سعر الوحدة (ج.م) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={serviceOrderForm.unit_price ?? ""}
                      onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                </div>

                {/* Calculation Summary Preview */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <span className="font-bold text-slate-600">المبلغ الإجمالي المحمل على الفاتورة:</span>
                  <span className="text-base font-black text-teal-700">
                    {(serviceOrderForm.quantity * serviceOrderForm.unit_price).toFixed(2)} ج.م
                  </span>
                </div>

                {/* Notes / Special Instructions */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات / تعليمات التنفيذ</label>
                  <textarea
                    rows={2}
                    value={serviceOrderForm.notes ?? ""}
                    onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, notes: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                    placeholder="مثال: تسليم عند الساعة 6 مساءً، بدون سكر، كوي عاجل..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowOrderServiceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  تأكيد الطلب وإضافته للفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT LIGHTBOX FULL PREVIEW */}
      {previewDocUrl && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setPreviewDocUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-700 flex flex-col space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-sm">{previewDocTitle || "معاينة الوثيقة الرسمية"}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDocUrl}
                  download="document.jpg"
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  تحميل
                </a>
                <button
                  onClick={() => setPreviewDocUrl(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[75vh] flex items-center justify-center rounded-xl bg-black/40">
              <img
                src={previewDocUrl}
                alt="Document Preview"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
