import React, { useState, useEffect, useRef } from "react";
import { EmployeeSearchSelect } from "./EmployeeSearchSelect";
import {
  Smartphone,
  Camera,
  MapPin,
  Clock,
  Calendar,
  DollarSign,
  UserCheck,
  UserX,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Key,
  FileText,
  User,
  Building,
  Briefcase,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  Map,
  X,
  Plus,
  Upload,
  Send,
  Bell,
  BellRing,
  Sun,
  Moon,
  ScanFace,
  QrCode,
  WifiOff,
  Radio,
  ShieldCheck,
  Users,
  BarChart3,
  PhoneCall,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Shield,
  XCircle,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import {
  saveOfflineAttendanceRecord,
  getPendingOfflineRecords,
  syncAllPendingOfflineRecords,
  OfflineAttendanceRecord
} from "../utils/offlineAttendanceStorage";
import employee3DPortalImg from "../assets/images/employee_3d_portal_1785709685970.jpg";
import employee3DPortalV2Img from "../assets/images/employee_3d_portal_v2_1785710071472.jpg";

// Reusable 3D REMO PRO Logo Header Component for Mobile App
const Oppo3DMobileLogo: React.FC<{ isLight?: boolean; size?: "sm" | "md" | "lg" }> = ({
  isLight = false,
  size = "md"
}) => {
  const sizeClasses = {
    sm: "text-2xl sm:text-3xl tracking-[0.12em]",
    md: "text-3xl sm:text-4xl tracking-[0.15em]",
    lg: "text-4xl sm:text-5xl tracking-[0.18em]"
  }[size];

  return (
    <div className="relative flex flex-col items-center justify-center my-2 select-none preserve-3d" style={{ transformStyle: "preserve-3d" }}>
      {/* 3D Glowing Backdrop Aura */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: isLight ? [0.25, 0.45, 0.25] : [0.35, 0.65, 0.35]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute w-32 h-32 rounded-full blur-3xl pointer-events-none ${
          isLight ? "bg-emerald-500/30" : "bg-cyan-400/35"
        }`}
        style={{ transform: "translateZ(-20px)" }}
      />

      {/* Main 3D Moving REMO PRO Text Container */}
      <motion.div
        animate={{
          rotateX: [10, -10, 10],
          rotateY: [-14, 14, -14],
          y: [-4, 4, -4],
        }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`relative flex items-center justify-center font-black uppercase preserve-3d py-1 ${sizeClasses}`}
        dir="ltr"
        style={{
          fontFamily: "'Montserrat', 'Arial', sans-serif",
          transformStyle: "preserve-3d",
          color: isLight ? "#0f172a" : "#ffffff",
          textShadow: isLight
            ? "0 1px 0 #cbd5e1, 0 2px 0 #94a3b8, 0 3px 0 #64748b, 0 4px 0 #475569, 0 5px 0 #334155, 0 10px 18px rgba(15,23,42,0.25), 0 0 12px rgba(16,185,129,0.2)"
            : "0 1px 0 #38bdf8, 0 2px 0 #0284c7, 0 3px 0 #0369a1, 0 4px 0 #075985, 0 5px 0 #0c4a6e, 0 0 25px rgba(56,189,248,0.7), 0 12px 25px rgba(0,0,0,0.8)",
        }}
      >
        {"REMO PRO".split("").map((letter, idx) => (
          <motion.span
            key={idx}
            animate={{
              y: [0, -6, 0],
              rotateZ: [0, idx % 2 === 0 ? 2.5 : -2.5, 0],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: idx * 0.12,
            }}
            className="inline-block preserve-3d"
          >
            {letter === " " ? "\u00A0" : letter}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};

const Employee3DPortalGraphic: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className="relative group my-4 flex justify-center perspective-1000 select-none">
      {/* Outer 3D glowing aura */}
      <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition duration-700 animate-pulse" />

      {/* Main 3D Interactive Card with Floating Perspective Motion */}
      <motion.div
        animate={{
          y: [0, -10, 0],
          rotateX: [3, -3, 3],
          rotateY: [-6, 6, -6],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`relative ${
          compact ? "w-full max-w-[320px] h-40" : "w-full max-w-[360px] h-52"
        } rounded-3xl overflow-hidden border-2 border-emerald-400/60 bg-slate-950 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center transform-gpu preserve-3d`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <img
          src={employee3DPortalV2Img}
          alt="3D Employee Portal Interactive Graphic"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
          className="w-full h-full object-cover object-center transform group-hover:scale-110 transition-transform duration-700 filter brightness-110 contrast-110"
        />

        {/* Ambient Gradient & Light Flare Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10" />

        {/* Floating Hologram Badge 1: Top Right */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-md border border-emerald-400/60 text-emerald-300 px-3 py-1 rounded-2xl text-[10px] font-extrabold flex items-center gap-1.5 shadow-xl"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>تطبيق REMO PRO 3D</span>
        </motion.div>

        {/* Floating Hologram Badge 2: Bottom Left */}
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-cyan-400/60 text-cyan-300 px-3 py-1 rounded-2xl text-[10px] font-extrabold flex items-center gap-1.5 shadow-xl"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>تحديد الموقع GPS</span>
        </motion.div>

        {/* Floating Hologram Badge 3: Bottom Right */}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-3 right-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1 rounded-2xl text-[10px] font-extrabold shadow-lg flex items-center gap-1 border border-emerald-300/40"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>بصمة حيوية مشفرة</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

interface EmployeeProfile {
  id: number;
  name: string;
  employee_code: string;
  job_title?: string;
  department_name?: string;
  branch_name?: string;
  basic_salary?: number;
  phone?: string;
  is_admin?: boolean;
  annual_leave_total?: number;
  sick_leave_total?: number;
  casual_leave_total?: number;
  annual_leave_balance?: number;
  sick_leave_balance?: number;
  casual_leave_balance?: number;
  annual_leave_consumed?: number;
  sick_leave_consumed?: number;
  casual_leave_consumed?: number;
}

interface AttendanceItem {
  id: number;
  date: string;
  check_in?: string;
  check_out?: string;
  work_hours?: number;
  delay_minutes?: number;
  penalty?: number;
  status: string;
  check_in_photo?: string;
  check_out_photo?: string;
  check_in_location?: string;
  check_out_location?: string;
  notes?: string;
}

interface PayrollData {
  month: number;
  year: number;
  basic_salary: number;
  meal_allowance: number;
  insurance: number;
  total_bonuses: number;
  total_deductions: number;
  total_advances: number;
  days_attended: number;
  total_hours: number;
  net_salary: number;
  bonuses: any[];
  deductions: any[];
  advances: any[];
}

interface PortalRequestItem {
  id: number;
  employee_id: number;
  request_type: 'leave' | 'advance' | 'memo' | 'complaint';
  title: string;
  amount?: number;
  notes?: string;
  attachment?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_response?: string;
  created_at: string;
}

interface EmployeeNotification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Helper to extract wall clock time from ISO strings or time strings
const getWallClockTime = (timeStr?: string | null) => {
  if (!timeStr) return null;
  const str = String(timeStr).trim();
  if (str.includes("T")) {
    const timePart = str.split("T")[1];
    if (timePart) {
      const parts = timePart.split(":");
      if (parts.length >= 2) {
        return {
          hours: parseInt(parts[0], 10),
          minutes: parseInt(parts[1], 10)
        };
      }
    }
  }
  if (str.includes(" ")) {
    const timePart = str.split(" ")[1];
    if (timePart) {
      const parts = timePart.split(":");
      if (parts.length >= 2) {
        return {
          hours: parseInt(parts[0], 10),
          minutes: parseInt(parts[1], 10)
        };
      }
    }
  }
  const parts = str.split(":");
  if (parts.length >= 2) {
    return {
      hours: parseInt(parts[0], 10),
      minutes: parseInt(parts[1], 10)
    };
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return {
        hours: d.getHours(),
        minutes: d.getMinutes()
      };
    }
  } catch (e) {}
  return null;
};

// Format time string to 12-hour format e.g. "02:03 م"
const formatDisplayTime = (timeStr?: string | null) => {
  if (!timeStr || timeStr === "--:--" || timeStr === "null") return "--:--";
  const wallClock = getWallClockTime(timeStr);
  if (!wallClock) return timeStr;
  const { hours, minutes } = wallClock;
  const period = hours >= 12 ? "م" : "ص";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHours.toString().padStart(2, "0")}:${displayMinutes} ${period}`;
};

// Format date string to clean Arabic date e.g. "الثلاثاء، 07 يوليو 2026"
const formatDisplayDate = (dateStr?: string | null) => {
  if (!dateStr || dateStr === "null") return "----/--/--";
  try {
    const match = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const dayName = d.toLocaleDateString("ar-EG", { weekday: "long" });
        const monthName = d.toLocaleDateString("ar-EG", { month: "long" });
        const formattedDay = day.toString().padStart(2, "0");
        return `${dayName}، ${formattedDay} ${monthName} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("ar-EG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
  } catch (e) {}
  return dateStr;
};

export const EmployeeMobilePortal: React.FC<{ onBackToErp?: () => void }> = ({ onBackToErp }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("employee_mobile_token"));
  const [employee, setEmployee] = useState<EmployeeProfile | null>(() => {
    const saved = localStorage.getItem("employee_mobile_profile");
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("employee_portal_theme") as "dark" | "light") || "light";
  });
  const isLight = theme === "light";

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("employee_portal_theme", nextTheme);
  };

  // Login Form State
  // Note: there is no longer a separate "admin" tab — admins and employees log in
  // via the SAME unified form. The backend auto-detects admin accounts (via the users
  // table or via employee job_title containing keywords like "مدير"/"Admin"/"HR").
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Tab: 'attendance' | 'history' | 'payroll' | 'requests' | 'messages' | 'leaves'
  const [activeTab, setActiveTab] = useState<"attendance" | "history" | "payroll" | "requests" | "messages" | "leaves">("attendance");

  // Admin Control Panel State
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem("employee_portal_admin_mode") === "true";
  });
  const [adminTab, setAdminTab] = useState<"live_attendance" | "employee_reports" | "payroll_summary" | "requests_approvals" | "broadcast">("live_attendance");

  // Admin Live Attendance Stream
  const [adminStartDate, setAdminStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [adminEndDate, setAdminEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [adminLiveRecords, setAdminLiveRecords] = useState<any[]>([]);
  const [adminLiveStats, setAdminLiveStats] = useState<{ total_employees: number; present_count: number; late_count: number; absent_count: number; mobile_checkins: number } | null>(null);
  const [adminAttendanceLoading, setAdminAttendanceLoading] = useState<boolean>(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>("");

  // Admin Manual Attendance Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEmpId, setManualEmpId] = useState<string>("");
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [manualCheckInTime, setManualCheckInTime] = useState<string>("09:00");
  const [manualCheckOutTime, setManualCheckOutTime] = useState<string>("17:00");
  const [manualNotes, setManualNotes] = useState<string>("");
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  // Admin Employee Reports / Directory
  const [adminEmployees, setAdminEmployees] = useState<any[]>([]);
  const [adminEmployeesLoading, setAdminEmployeesLoading] = useState<boolean>(false);
  const [selectedEmployeeReport, setSelectedEmployeeReport] = useState<any | null>(null);

  // Admin Payroll Summary
  const [adminPayrollMonth, setAdminPayrollMonth] = useState<number>(new Date().getMonth() + 1);
  const [adminPayrollYear, setAdminPayrollYear] = useState<number>(new Date().getFullYear());
  const [adminPayrollData, setAdminPayrollData] = useState<any | null>(null);
  const [adminPayrollLoading, setAdminPayrollLoading] = useState<boolean>(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  // Admin Portal Requests Desk
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [adminRequestsLoading, setAdminRequestsLoading] = useState<boolean>(false);
  const [adminRequestFilter, setAdminRequestFilter] = useState<string>("pending");
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);
  const [responseNote, setResponseNote] = useState<string>("");

  // Admin Broadcast Notification
  const [broadcastTitle, setBroadcastTitle] = useState<string>("");
  const [broadcastMessage, setBroadcastMessage] = useState<string>("");
  const [broadcastTarget, setBroadcastTarget] = useState<string>("all");
  const [broadcastSubmitting, setBroadcastSubmitting] = useState<boolean>(false);

  // Camera & Location State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selfieFileInputRef = useRef<HTMLInputElement>(null);
  const selfieNativeCameraInputRef = useRef<HTMLInputElement>(null);

  const handleSelfieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedPhoto(event.target?.result as string);
      setCameraActive(false);
    };
    reader.readAsDataURL(file);
  };

  // Attendance History State
  const [historyMonth, setHistoryMonth] = useState<number>(new Date().getMonth() + 1);
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyRecords, setHistoryRecords] = useState<AttendanceItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<string | null>(null);

  // Payroll State
  const [payrollMonth, setPayrollMonth] = useState<number>(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(new Date().getFullYear());
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Leave / Advance / Memo / Complaint Request State
  const [requestType, setRequestType] = useState<"leave" | "advance" | "memo" | "complaint">("memo");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestAttachment, setRequestAttachment] = useState<string | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // My Requests & Memos List
  const [myRequests, setMyRequests] = useState<PortalRequestItem[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [requestsFilter, setRequestsFilter] = useState<string>("all");

  // Notifications State
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/hr/employee-portal/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markNotificationsAsRead = async () => {
    if (!token || unreadCount === 0) return;
    try {
      await api.put('/api/hr/employee-portal/notifications/read', {});
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/hr/employee-portal/profile');
      if (res.ok) {
        const data = await res.json();
        setEmployee(prev => ({ ...prev, ...data }));
        localStorage.setItem("employee_mobile_profile", JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchNotifications();
      // Poll for notifications and profile update every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications();
        fetchProfile();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchMyRequests = async () => {
    if (!token) return;
    setMyRequestsLoading(true);
    try {
      const res = await api.get('/api/hr/employee-portal/my-requests');
      if (res.ok) {
        const data = await res.json();
        setMyRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch my requests:', err);
    } finally {
      setMyRequestsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("حجم الملف يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setRequestAttachment(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestNotes.trim() && !requestTitle.trim()) {
      alert("يرجى إدخال عنوان أو تفاصيل المذكرة / الشكوى / الطلب");
      return;
    }
    setRequestSubmitting(true);
    try {
      const res = await api.post('/api/hr/employee-portal/submit-request', {
        request_type: requestType,
        title: requestTitle || (requestType === 'leave' ? 'طلب إجازة' : requestType === 'advance' ? 'طلب سلفة' : requestType === 'complaint' ? 'شكوى / مقترح' : 'مذكرة عمل'),
        amount: requestType === 'advance' ? Number(requestAmount || 0) : 0,
        notes: requestNotes,
        attachment: requestAttachment
      });

      if (res.ok) {
        setRequestSubmitted(true);
        setRequestTitle("");
        setRequestAmount("");
        setRequestNotes("");
        setRequestAttachment(null);
        fetchMyRequests();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "فشل إرسال المذكرة/الطلب");
      }
    } catch (error) {
      console.error("Submit request failed:", error);
      alert("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setRequestSubmitting(false);
    }
  };

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check PWA standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  // Fetch Geolocation on load or tab change
  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocation({
        lat: 30.0444,
        lng: 31.2357,
        address: "القاهرة، مصر (موقع الفرع الرئيسي)"
      });
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({
          lat,
          lng,
          address: `الإحداثيات: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
        });
        setLocationLoading(false);
      },
      (err) => {
        console.warn("Geolocation warning:", err.message);
        // Fallback for iframe and local tests
        setLocation({
          lat: 30.0444,
          lng: 31.2357,
          address: "القاهرة، مصر (موقع الفرع المعتمد)"
        });
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (token && activeTab === "attendance") {
      getCurrentLocation();
    }
  }, [token, activeTab]);

  // Load History
  useEffect(() => {
    if (token && activeTab === "history") {
      setHistoryLoading(true);
      fetch(`/api/hr/employee-portal/my-attendance?month=${historyMonth}&year=${historyYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          setHistoryRecords(Array.isArray(data) ? data : []);
          setHistoryLoading(false);
        })
        .catch(() => setHistoryLoading(false));
    }
  }, [token, activeTab, historyMonth, historyYear]);

  // Load Requests & Memos
  useEffect(() => {
    if (token && activeTab === "requests") {
      fetchMyRequests();
    }
  }, [token, activeTab]);

  // Load Payroll
  useEffect(() => {
    if (token && activeTab === "payroll") {
      setPayrollLoading(true);
      fetch(`/api/hr/employee-portal/my-payroll?month=${payrollMonth}&year=${payrollYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) setPayrollData(data);
          setPayrollLoading(false);
        })
        .catch(() => setPayrollLoading(false));
    }
  }, [token, activeTab, payrollMonth, payrollYear]);

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setCapturedPhoto(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("كاميرا المتصفح المباشرة غير مدعومة في هذا الجهاز أو المتصفح. يرجى الضغط على زر 'كاميرا الجوال' لاستخدام كاميرا الهاتف مباشرة.");
        setCameraActive(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera stream restricted or unavailable:", err);
      alert("عذراً، كاميرا المتصفح غير متوفرة أو محجوبة بسبب صلاحيات الأمان في المتصفح. يرجى استخدام زر 'كاميرا الجوال' لالتقاط سيلفي مباشر بكاميرا الهاتف.");
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Capture Photo Snapshot (Compressed for fast upload)
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const maxW = 540;
      const scale = video.videoWidth ? Math.min(1, maxW / video.videoWidth) : 1;
      canvas.width = (video.videoWidth || 640) * scale;
      canvas.height = (video.videoHeight || 480) * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };



  // Submit Mobile Login (unified for both employees and admins)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode || !loginPassword) {
      setLoginError("يرجى إدخال الكود / اسم المستخدم وكلمة المرور");
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      // Single endpoint — backend auto-detects if user is admin (via users table
      // or via employee job_title containing "مدير"/"Admin"/"HR") and returns is_admin: true
      const res = await fetch("/api/hr/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_code: loginCode, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLoginError(data.error || "فشل تسجيل الدخول");
      } else {
        localStorage.setItem("employee_mobile_token", data.token);
        localStorage.setItem("employee_mobile_profile", JSON.stringify(data.employee));
        setToken(data.token);
        setEmployee(data.employee);
        // Backend flag controls admin-mode routing automatically
        if (data.employee?.is_admin) {
          setIsAdminMode(true);
          localStorage.setItem("employee_portal_admin_mode", "true");
        } else {
          setIsAdminMode(false);
          localStorage.removeItem("employee_portal_admin_mode");
        }
        setCapturedPhoto(null); // Ensure no old photo lingers
      }
    } catch (err: any) {
      setLoginError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoginLoading(false);
    }
  };

  // Admin Data Fetchers
  const fetchAdminLiveAttendance = async () => {
    if (!token) return;
    setAdminAttendanceLoading(true);
    try {
      const res = await api.get(`/api/hr/employee-portal/admin/live-attendance?startDate=${adminStartDate}&endDate=${adminEndDate}&search=${encodeURIComponent(adminSearchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setAdminLiveRecords(data.records || []);
        setAdminLiveStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to fetch admin live attendance:", err);
    } finally {
      setAdminAttendanceLoading(false);
    }
  };

  const fetchAdminEmployeeReports = async () => {
    if (!token) return;
    setAdminEmployeesLoading(true);
    try {
      const res = await api.get(`/api/hr/employee-portal/admin/employees-report?search=${encodeURIComponent(adminSearchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setAdminEmployees(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch admin employee reports:", err);
    } finally {
      setAdminEmployeesLoading(false);
    }
  };

  const fetchAdminPayrollSummary = async () => {
    if (!token) return;
    setAdminPayrollLoading(true);
    try {
      const res = await api.get(`/api/hr/employee-portal/admin/payroll-summary?month=${adminPayrollMonth}&year=${adminPayrollYear}`);
      if (res.ok) {
        const data = await res.json();
        setAdminPayrollData(data);
      }
    } catch (err) {
      console.error("Failed to fetch admin payroll summary:", err);
    } finally {
      setAdminPayrollLoading(false);
    }
  };

  const fetchAdminRequests = async () => {
    if (!token) return;
    setAdminRequestsLoading(true);
    try {
      const res = await api.get("/api/hr/portal-requests");
      if (res.ok) {
        const data = await res.json();
        setAdminRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch admin portal requests:", err);
    } finally {
      setAdminRequestsLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId: number, status: "approved" | "rejected") => {
    try {
      const res = await api.put(`/api/hr/portal-requests/${requestId}/respond`, {
        status,
        admin_response: responseNote || (status === "approved" ? "تمت الموافقة والاعتماد من قبل المسؤول ✅" : "عذراً، تم رفض الطلب من قبل المسؤول ❌")
      });
      if (res.ok) {
        alert(status === "approved" ? "🎉 تم اعتماد وتحديث حالة الطلب بالموافقة!" : "تم تسجيل رفض الطلب بنجاح");
        setRespondingRequestId(null);
        setResponseNote("");
        fetchAdminRequests();
      } else {
        alert("فشل تحديث حالة الطلب");
      }
    } catch (err) {
      alert("حدث خطأ أثناء الرد على الطلب");
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("يرجى إدخال عنوان ونص التعميم/التنبيه");
      return;
    }
    setBroadcastSubmitting(true);
    try {
      const res = await api.post("/api/hr/notifications/send", {
        title: broadcastTitle,
        message: broadcastMessage,
        target_type: broadcastTarget
      });
      if (res.ok) {
        const data = await res.json();
        alert(`🎉 ${data.message || "تم إرسال التعميم للموظفين بنجاح"}`);
        setBroadcastTitle("");
        setBroadcastMessage("");
      } else {
        alert("فشل إرسال التعميم/التنبيه");
      }
    } catch (err) {
      alert("حدث خطأ أثناء الاتصال بالخادم لإرسال التعميم");
    } finally {
      setBroadcastSubmitting(false);
    }
  };

  const handleManualAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmpId || !manualDate) {
      alert("يرجى اختيار الموظف والتاريخ");
      return;
    }
    setManualSubmitting(true);
    try {
      const res = await api.post("/api/hr/employee-portal/admin/manual-attendance", {
        employee_id: Number(manualEmpId),
        date: manualDate,
        check_in_time: manualCheckInTime,
        check_out_time: manualCheckOutTime,
        notes: manualNotes
      });
      if (res.ok) {
        alert("🎉 تم تسجيل بصمة الحضور والإنصراف اليدوية للموظف بنجاح!");
        setShowManualModal(false);
        setManualNotes("");
        fetchAdminLiveAttendance();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "فشل تسجيل البصمة اليدوية");
      }
    } catch (err) {
      alert("حدث خطأ أثناء تسجيل البصمة اليدوية");
    } finally {
      setManualSubmitting(false);
    }
  };

  // Effect to load Admin Data
  useEffect(() => {
    if (token && (employee?.is_admin || isAdminMode)) {
      if (adminTab === "live_attendance") fetchAdminLiveAttendance();
      if (adminTab === "employee_reports") fetchAdminEmployeeReports();
      if (adminTab === "payroll_summary") fetchAdminPayrollSummary();
      if (adminTab === "requests_approvals") fetchAdminRequests();
    }
  }, [token, employee, isAdminMode, adminTab, adminStartDate, adminEndDate, adminPayrollMonth, adminPayrollYear]);

  // Offline Attendance Sync State
  const [unsyncedOfflineCount, setUnsyncedOfflineCount] = useState<number>(0);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);

  // Biometrics Enrollment State
  const [enrollingFace, setEnrollingFace] = useState<boolean>(false);
  const [enrolledFaceSuccess, setEnrolledFaceSuccess] = useState<string | null>(null);

  // Dynamic QR Attendance Scanner State
  const [showQrScanModal, setShowQrScanModal] = useState<boolean>(false);
  const [qrScanInput, setQrScanInput] = useState<string>("");
  const [qrScanning, setQrScanning] = useState<boolean>(false);

  // Check pending offline attendance records
  const refreshOfflineQueueCount = async () => {
    try {
      const records = await getPendingOfflineRecords();
      setUnsyncedOfflineCount(records.length);
    } catch (e) {
      console.error("Failed to read offline attendance queue:", e);
    }
  };

  useEffect(() => {
    refreshOfflineQueueCount();
    const handleOnline = () => {
      if (token) handleSyncOfflineRecords();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [token]);

  // Sync offline records to server
  const handleSyncOfflineRecords = async () => {
    if (!token) return;
    setSyncingOffline(true);
    try {
      const res = await syncAllPendingOfflineRecords(token);
      if (res.synced > 0) {
        alert(`🎉 تمت مزامنة ${res.synced} سجل حضور أوفلاين مع الخادم بنجاح!`);
      }
      await refreshOfflineQueueCount();
    } catch (err: any) {
      console.error("Failed to sync offline attendance records:", err);
    } finally {
      setSyncingOffline(false);
    }
  };

  // Enroll Face Biometrics Template
  const handleEnrollFaceBiometrics = async () => {
    if (!capturedPhoto) {
      alert("يرجى التقاط صورة سيلفي حية لوجهك أولاً لتسجيل بصمة الوجه البيومترية!");
      return;
    }
    setEnrollingFace(true);
    try {
      const res = await fetch("/api/hr/biometrics/enroll-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employee?.id,
          photo: capturedPhoto
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("🎉 تم تسجيل بصمة الوجه البيومترية الخاصة بك بنجاح على السيرفر!");
        setEnrolledFaceSuccess("تم تفعيل بصمة الوجه الحية بنجاح ✅");
        const updated = { ...employee, face_template: "registered" };
        setEmployee(updated as EmployeeProfile);
        localStorage.setItem("employee_mobile_profile", JSON.stringify(updated));
        setCapturedPhoto(null);
      } else {
        alert(data.error || "فشل تسجيل بصمة الوجه البيومترية");
      }
    } catch (e: any) {
      alert("حدث خطأ أثناء الاتصال بالخادم لتسجيل البصمة البيومترية");
    } finally {
      setEnrollingFace(false);
    }
  };

  // Attendance via Dynamic Branch QR Code
  const handleQrAttendanceSubmit = async (type: "check_in" | "check_out") => {
    if (!qrScanInput.trim()) {
      alert("يرجى إدخال أو مسح كود QR التفاعلي المعروض في الفرع أولاً!");
      return;
    }
    setQrScanning(true);
    try {
      const res = await fetch("/api/hr/attendance/qr-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          qr_token: qrScanInput.trim(),
          employee_id: employee?.id,
          type,
          latitude: location?.lat || null,
          longitude: location?.lng || null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckinSuccess({
          type,
          message: data.message || "تم تسجيل الحضور عبر كود QR الفرع بنجاح!",
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          location: location?.address,
          penalty: data.record?.penalty || 0,
          delay_minutes: data.record?.delay_minutes || 0
        });
        setQrScanInput("");
        setShowQrScanModal(false);
      } else {
        alert(data.error || "رمز QR انتهت صلاحيته أو غير صالح لهذا الفرع");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء تسجيل الحضور بكود QR");
    } finally {
      setQrScanning(false);
    }
  };

  // Submit Mobile Check-In / Check-Out
  const handleAttendanceSubmit = async (type: "check_in" | "check_out") => {
    if (!capturedPhoto) {
      alert("يرجى التقاط صورة سيلفي أولاً لإثبات الحضور والإنصراف!");
      return;
    }

    setCheckinLoading(true);
    try {
      const now = new Date();
      const client_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const client_time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const res = await fetch("/api/hr/attendance/mobile-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employee?.id,
          type,
          photo: capturedPhoto,
          latitude: location?.lat || null,
          longitude: location?.lng || null,
          address: location?.address || "موقع الهاتف",
          device_info: "تطبيق الهاتف الذكي - بصمة سيلفي حية",
          verification_method: "face_gps",
          client_date,
          client_time
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.message || data.error || "فشل تسجيل البصمة المباشرة");
      } else {
        setCheckinSuccess({
          type,
          message: data.message,
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          photo: capturedPhoto,
          location: location?.address,
          penalty: data.record?.penalty || 0,
          delay_minutes: data.record?.delay_minutes || 0
        });
        setCapturedPhoto(null);
      }
    } catch (err: any) {
      // Offline Mode Fallback
      if (!navigator.onLine || err.message?.includes("Failed to fetch") || err.name === "TypeError") {
        const offlineRecord: OfflineAttendanceRecord = {
          offline_uuid: `off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          employee_id: employee?.id || 0,
          employee_code: employee?.employee_code,
          type,
          photo: capturedPhoto,
          latitude: location?.lat || null,
          longitude: location?.lng || null,
          address: location?.address || "موقع أوفلاين",
          verification_method: "offline_sync",
          created_at: new Date().toISOString(),
          status: "pending"
        };
        await saveOfflineAttendanceRecord(offlineRecord);
        await refreshOfflineQueueCount();

        setCheckinSuccess({
          type,
          message: "تم حفظ بصمة الحضور محلياً بنجاح (أوفلاين) 📱. ستتم المزامنة تلقائياً مع السيرفر فور توفر الإنترنت.",
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          photo: capturedPhoto,
          location: location?.address || "أوفلاين",
          isOffline: true
        });
        setCapturedPhoto(null);
      } else {
        alert("حدث خطأ أثناء الاتصال بالخادم وتسجيل البصمة: " + (err.message || err));
      }
    } finally {
      setCheckinLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("employee_mobile_token");
    localStorage.removeItem("employee_mobile_profile");
    setToken(null);
    setEmployee(null);
  };

  // Install PWA
  const handleInstallPwa = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      });
    }
  };

  // ------------------------------------
  // UNAUTHENTICATED EMPLOYEE LOGIN VIEW
  // ------------------------------------
  if (!token || !employee) {
    return (
      <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 dir-rtl overflow-hidden bg-slate-950 text-slate-100">
        {/* Full-Screen 3D Image Background */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
          <img
            src={employee3DPortalV2Img}
            alt="3D Employee Portal Background"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Hide broken image smoothly if image network error occurs
              (e.target as HTMLElement).style.display = 'none';
            }}
            className="w-full h-full object-cover object-center scale-105 filter brightness-75 contrast-110 saturate-110 blur-[1px] opacity-90 transition-opacity duration-700"
          />
          {/* Subtle Ambient Vignette & Dark Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/40" />
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" />
        </div>

        {/* Floating Glass Card Container */}
        <div className={`relative z-10 w-full max-w-md ${isLight ? "bg-white/90 border-white/60 shadow-2xl text-slate-800" : "bg-slate-900/85 border-slate-700/80 shadow-2xl text-slate-100"} border rounded-3xl p-6 md:p-8 backdrop-blur-xl transition-all duration-300`}>
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`absolute top-4 left-4 p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
              isLight
                ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                : "bg-slate-900/80 border-slate-700 text-amber-400 hover:bg-slate-900"
            }`}
            title={isLight ? "التحويل للوضع الداكن" : "التحويل للوضع الفاتح"}
          >
            {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span className="text-[11px] font-bold">{isLight ? "داكن" : "فاتح"}</span>
          </button>

          {/* Header Branding */}
          <div className="text-center mb-6">
            {/* 3D Animated OPPO Logo Banner */}
            <Oppo3DMobileLogo isLight={isLight} size="md" />

            <h1 className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-white"} tracking-tight mt-1`}>تطبيق الموبايل للموظفين</h1>
            <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"} mt-0.5`}>بوابة الحضور السيلفي والموقع الجغرافي والمرتبات</p>

            {/* 3D Animated Interactive Banner Graphic */}
            <Employee3DPortalGraphic compact={true} />
          </div>

          {/* PWA Install Banner */}
          {deferredPrompt && (
            <button
              onClick={handleInstallPwa}
              className="w-full mb-6 py-2.5 px-4 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              تنزيل وتثبيت التطبيق على الموبايل
            </button>
          )}

          {/* Unified Login Form (admins and employees use the same form) */}
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>تسجيل دخول موحد — للموظفين والمسؤولين. النظام يكتشف صلاحياتك تلقائياً.</span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-500 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className={`block text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"} mb-1.5`}>
                كود الموظف أو اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginCode ?? ""}
                  onChange={(e: any) => setLoginCode(e.target.value)}
                  placeholder="كود الموظف (مثال: 101) أو اسم مستخدم المسؤول (مثال: admin)"
                  className={`w-full ${isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:bg-white placeholder-slate-400" : "bg-slate-900/80 border-slate-700 text-white placeholder-slate-500"} border focus:border-emerald-500 rounded-xl px-4 py-3 text-sm outline-none transition`}
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"} mb-1.5`}>كلمة المرور السرية</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword ?? ""}
                  onChange={(e: any) => setLoginPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور التي تم إنشاؤها بواسطة Admin"
                  className={`w-full ${isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:bg-white placeholder-slate-400" : "bg-slate-900/80 border-slate-700 text-white placeholder-slate-500"} border focus:border-emerald-500 rounded-xl px-4 py-3 text-sm outline-none transition pl-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition disabled:opacity-50"
            >
              {loginLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserCheck className="w-5 h-5" />
                  <span>تسجيل الدخول إلى التطبيق</span>
                </>
              )}
            </button>
          </form>

          {/* Switch Back to Main ERP */}
          {onBackToErp && (
            <div className={`mt-6 pt-4 border-t ${isLight ? "border-slate-200" : "border-slate-700/60"} text-center`}>
              <button
                onClick={onBackToErp}
                className={`text-xs ${isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"} flex items-center justify-center gap-1.5 mx-auto font-medium`}
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                العودة إلى شاشة لوحة تحكم ERP الرئيسية
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------
  // AUTHENTICATED MOBILE PORTAL DASHBOARD
  // ------------------------------------
  return (
    <div className={`min-h-screen ${isLight ? "bg-slate-100 text-slate-900 border-slate-200" : "bg-slate-950 text-slate-100 border-slate-800"} flex flex-col dir-rtl max-w-md mx-auto relative shadow-2xl border-x transition-colors duration-300`}>
      {/* Top Mobile Bar */}
      <header className={`${isLight ? "bg-white/95 border-slate-200 shadow-sm" : "bg-slate-900/90 border-slate-800"} border-b px-4 py-3 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-base shadow-inner">
            {employee.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"} leading-tight`}>{employee.name}</h2>
              <span className="text-[10px] font-black tracking-wider text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded-md shadow-xs">REMO PRO 3D</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              كود: #{employee.employee_code} • {employee.job_title || "موظف"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 relative">
          {/* Admin Mode Switcher Button (if Admin) */}
          {(employee.is_admin || isAdminMode) && employee.employee_code?.toLowerCase() !== 'admin' && (
            <button
              type="button"
              onClick={() => {
                const next = !isAdminMode;
                setIsAdminMode(next);
                localStorage.setItem("employee_portal_admin_mode", String(next));
              }}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                isAdminMode
                  ? "bg-purple-600 text-white border-purple-400 shadow-md animate-pulse"
                  : "bg-slate-800 text-purple-300 border-purple-500/40 hover:bg-slate-700"
              }`}
              title="تبديل بين لوحة الإدارة ووضع الموظف"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAdminMode ? "المدير" : "الإدارة"}</span>
            </button>
          )}

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-all flex items-center gap-1 ${
              isLight
                ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                : "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700"
            }`}
            title={isLight ? "التحويل للوضع الداكن" : "التحويل للوضع الفاتح"}
          >
            {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications && unreadCount > 0) {
                markNotificationsAsRead();
              }
            }}
            className={`p-2 rounded-lg relative ${unreadCount > 0 ? 'text-amber-400 bg-amber-500/10' : isLight ? 'text-slate-600 hover:text-slate-900 bg-slate-100' : 'text-slate-400 hover:text-slate-200 bg-slate-800'}`}
          >
            {unreadCount > 0 ? <BellRing className="w-4 h-4 animate-bounce" /> : <Bell className="w-4 h-4" />}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {onBackToErp && (
            <button
              onClick={onBackToErp}
              title="لوحة التحكم الرئيسية"
              className={`p-2 ${isLight ? 'text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200' : 'text-slate-400 hover:text-slate-200 bg-slate-800'} rounded-lg text-xs font-bold`}
            >
              ERP
            </button>
          )}
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            className="p-2 text-rose-500 hover:text-rose-600 bg-rose-500/10 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-12 left-0 w-80 max-w-[90vw] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-left"
              >
                <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    الإشعارات
                  </h3>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">لا توجد إشعارات جديدة</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-3 rounded-xl border text-xs ${n.read ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-700/50 border-slate-600 text-slate-100'}`}>
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-bold">{n.title}</span>
                          <span className="text-[9px] text-slate-400 whitespace-nowrap shrink-0">
                            {formatDisplayTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Admin Mode Top Indicator Banner */}
      {employee.is_admin && isAdminMode && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-4 py-2 border-b border-purple-500/30 flex items-center justify-between text-xs font-bold text-purple-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>لوحة التحكم الإدارية لمتابعة الموظفين</span>
          </div>
          <button
            onClick={() => {
              setIsAdminMode(false);
              localStorage.setItem("employee_portal_admin_mode", "false");
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-slate-700"
          >
            <User className="w-3 h-3 text-emerald-400" />
            <span>وضع الموظف</span>
          </button>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto space-y-4">
        {isAdminMode ? (
          /* ========================================================================= */
          /*                       ADMIN CONTROL PANEL VIEWS                          */
          /* ========================================================================= */
          <div className="space-y-4">
            {/* TAB 1: LIVE ATTENDANCE STREAM */}
            {adminTab === "live_attendance" && (
              <div className="space-y-4">
                {/* Stats Summary Cards */}
                {adminLiveStats && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                      <span className="block text-[9px] text-slate-400">إجمالي الكادر</span>
                      <span className="text-sm font-extrabold text-white">{adminLiveStats.total_employees}</span>
                    </div>
                    <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/30 rounded-2xl text-center">
                      <span className="block text-[9px] text-emerald-400">حاضرون</span>
                      <span className="text-sm font-extrabold text-emerald-400">{adminLiveStats.present_count}</span>
                    </div>
                    <div className="p-2.5 bg-amber-950/50 border border-amber-500/30 rounded-2xl text-center">
                      <span className="block text-[9px] text-amber-400">تأخير</span>
                      <span className="text-sm font-extrabold text-amber-400">{adminLiveStats.late_count}</span>
                    </div>
                    <div className="p-2.5 bg-rose-950/50 border border-rose-500/30 rounded-2xl text-center">
                      <span className="block text-[9px] text-rose-400">غائبون</span>
                      <span className="text-sm font-extrabold text-rose-400">{adminLiveStats.absent_count}</span>
                    </div>
                  </div>
                )}

                {/* Filter and Date selector */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="flex flex-col flex-1">
                      <label className="text-[10px] text-slate-400 mb-1">من تاريخ</label>
                      <input
                        type="date"
                        value={adminStartDate ?? ""}
                        onChange={(e) => setAdminStartDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none w-full"
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <label className="text-[10px] text-slate-400 mb-1">إلى تاريخ</label>
                      <input
                        type="date"
                        value={adminEndDate ?? ""}
                        onChange={(e) => setAdminEndDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none w-full"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="بحث باسم الموظف أو الكود..."
                        value={adminSearchQuery ?? ""}
                        onChange={(e) => setAdminSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchAdminLiveAttendance()}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl pl-8 pr-3 py-2 outline-none"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                    <button
                      onClick={fetchAdminLiveAttendance}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition flex items-center justify-center text-xs font-bold"
                    >
                      بحث
                    </button>
                  </div>
                </div>

                {/* Manual Attendance Entry Button */}
                <button
                  onClick={() => setShowManualModal(true)}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>تسجيل بصمة حضور / انصراف يدوية لموظف</span>
                </button>

                {/* Live Attendance List */}
                {adminAttendanceLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    <span>جاري تحميل سجل البصمات الحية...</span>
                  </div>
                ) : adminLiveRecords.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
                    لا توجد بصمات مسجلة لهذا التاريخ المحدد.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminLiveRecords.map((rec) => (
                      <div key={rec.id || `${rec.employee_id}-${rec.date}`} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs border border-purple-500/30">
                              {rec.employee_name?.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{rec.employee_name}</h4>
                              <p className="text-[10px] text-slate-400">
                                #{rec.employee_code} • {rec.job_title || "موظف"} • {rec.department_name || "العام"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] text-slate-400 font-mono">
                              {new Date(rec.date).toLocaleDateString('ar-EG')}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              rec.status === 'present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                              rec.status === 'late' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                              'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            }`}>
                              {rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : 'غائب'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-slate-950/70 rounded-xl border border-slate-800/80">
                            <span className="block text-[9px] text-emerald-400 font-bold mb-0.5">🟢 الحضور: {formatDisplayTime(rec.check_in) || 'لم يسجل'}</span>
                            {rec.check_in_photo && (
                              <img src={rec.check_in_photo} alt="Selfie Check-in" className="w-12 h-12 object-cover rounded-lg mt-1 border border-slate-700" />
                            )}
                            {rec.check_in_location && (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(rec.check_in_location)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] text-cyan-400 mt-1 underline"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>موقع GPS</span>
                              </a>
                            )}
                          </div>

                          <div className="p-2 bg-slate-950/70 rounded-xl border border-slate-800/80">
                            <span className="block text-[9px] text-rose-400 font-bold mb-0.5">🔴 الانصراف: {formatDisplayTime(rec.check_out) || 'لم يسجل'}</span>
                            {rec.check_out_photo && (
                              <img src={rec.check_out_photo} alt="Selfie Check-out" className="w-12 h-12 object-cover rounded-lg mt-1 border border-slate-700" />
                            )}
                            {rec.check_out_location && (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(rec.check_out_location)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] text-cyan-400 mt-1 underline"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>موقع GPS</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {rec.delay_minutes > 0 && (
                          <div className="text-[10px] text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg">
                            <AlertCircle className="w-3 h-3" />
                            <span>تأخير: {rec.delay_minutes} دقيقة (خصم: {rec.penalty || 0} ج.م)</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EMPLOYEE REPORTS & DIRECTORY */}
            {adminTab === "employee_reports" && (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="بحث في الكادر بالاسم أو الكود..."
                    value={adminSearchQuery ?? ""}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchAdminEmployeeReports()}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl pl-8 pr-3 py-2.5 outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>

                {adminEmployeesLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    <span>جاري تحميل دليل وتقارير الموظفين...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminEmployees.map((emp) => (
                      <div key={emp.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{emp.name}</h4>
                              <p className="text-[10px] text-slate-400">
                                كود: #{emp.employee_code} • {emp.job_title || "موظف"}
                              </p>
                            </div>
                          </div>
                          {emp.phone && (
                            <a
                              href={`tel:${emp.phone}`}
                              className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30"
                              title="اتصال تلفوني"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-2 border-t border-slate-800">
                          <div className="p-1.5 bg-slate-950/60 rounded-xl">
                            <span className="block text-slate-400">حضور (30)</span>
                            <span className="font-bold text-emerald-400">{emp.attendance_score || 0} يوم</span>
                          </div>
                          <div className="p-1.5 bg-slate-950/60 rounded-xl">
                            <span className="block text-slate-400">الجزاءات</span>
                            <span className="font-bold text-amber-400">{emp.total_penalties || 0} ج.م</span>
                          </div>
                          <div className="p-1.5 bg-slate-950/60 rounded-xl">
                            <span className="block text-slate-400">رصيد الإجازات</span>
                            <span className="font-bold text-cyan-400">{emp.annual_leave_balance ?? 21} يوم</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedEmployeeReport(emp)}
                          className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span>عرض كشف الموظف التفصيلي</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PAYROLL SUMMARY */}
            {adminTab === "payroll_summary" && (
              <div className="space-y-4">
                <div className="flex gap-2 bg-slate-900 p-2 border border-slate-800 rounded-2xl">
                  <select
                    value={adminPayrollMonth ?? ""}
                    onChange={(e) => setAdminPayrollMonth(Number(e.target.value))}
                    className="bg-slate-950 text-white text-xs rounded-xl px-3 py-2 outline-none border border-slate-700 flex-1"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        شهر {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={adminPayrollYear ?? ""}
                    onChange={(e) => setAdminPayrollYear(Number(e.target.value))}
                    className="bg-slate-950 text-white text-xs rounded-xl px-3 py-2 outline-none border border-slate-700"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        عام {y}
                      </option>
                    ))}
                  </select>
                </div>

                {adminPayrollLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    <span>جاري تحميل ملخص كشف الرواتب...</span>
                  </div>
                ) : adminPayrollData ? (
                  <div className="space-y-4">
                    {/* Totals Cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 rounded-2xl">
                        <span className="block text-[10px] text-emerald-400 font-bold">إجمالي المرتبات</span>
                        <span className="text-base font-extrabold text-white">{Number(adminPayrollData.total_net_payroll || 0 || 0).toLocaleString()} ج.م</span>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-purple-950/80 to-slate-900 border border-purple-500/40 rounded-2xl">
                        <span className="block text-[10px] text-purple-300 font-bold">الخصومات والسلف</span>
                        <span className="text-base font-extrabold text-white">{Number(adminPayrollData.total_deductions || 0 || 0).toLocaleString()} ج.م</span>
                      </div>
                    </div>

                    {/* Employee Payroll List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-300">مفردات مرتبات الكادر لشهر {adminPayrollMonth}/{adminPayrollYear}:</h4>
                      {adminPayrollData.employees?.map((emp: any) => (
                        <div key={emp.employee_id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                          <div>
                            <h5 className="font-bold text-white">{emp.employee_name}</h5>
                            <p className="text-[10px] text-slate-400">
                              أساسي: {emp.basic_salary} • خصم: {emp.total_deductions} • سلف: {emp.total_advances}
                            </p>
                          </div>
                          <div className="text-left">
                            <span className="block font-extrabold text-emerald-400 text-sm">{emp.net_salary} ج.م</span>
                            <button
                              onClick={() => setSelectedPayslip(emp)}
                              className="text-[10px] text-purple-400 underline font-bold"
                            >
                              عرض مفصل
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* TAB 4: REQUESTS & APPROVALS */}
            {adminTab === "requests_approvals" && (
              <div className="space-y-4">
                <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold">
                  {["pending", "approved", "rejected", "all"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setAdminRequestFilter(st)}
                      className={`flex-1 py-1.5 rounded-lg transition text-[11px] ${
                        adminRequestFilter === st
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {st === "pending" ? "معلقة" : st === "approved" ? "معتمدة" : st === "rejected" ? "مرفوضة" : "الكل"}
                    </button>
                  ))}
                </div>

                {adminRequestsLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    <span>جاري تحميل طلبات الموظفين...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminRequests
                      .filter((r) => adminRequestFilter === "all" || r.status === adminRequestFilter)
                      .map((req) => (
                        <div key={req.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div>
                              <h4 className="text-xs font-bold text-white">{req.title}</h4>
                              <p className="text-[10px] text-purple-300">
                                الموظف: {req.employee_name || `#${req.employee_id}`} • {req.created_at?.split("T")[0]}
                              </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                              req.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {req.status === 'approved' ? 'معتمد' : req.status === 'rejected' ? 'مرفوض' : 'بانتظار الاعتماد'}
                            </span>
                          </div>

                          {req.notes && <p className="text-xs text-slate-300 bg-slate-950/60 p-2 rounded-xl">{req.notes}</p>}

                          {req.status === "pending" && (
                            <div className="space-y-2 pt-1">
                              <input
                                type="text"
                                placeholder="ملاحظات المسؤول للرد (اختياري)..."
                                value={respondingRequestId === req.id ? responseNote : ""}
                                onChange={(e) => {
                                  setRespondingRequestId(req.id);
                                  setResponseNote(e.target.value);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3 py-1.5 rounded-xl outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleRespondToRequest(req.id, "approved")}
                                  className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>قبول واعتماد</span>
                                </button>
                                <button
                                  onClick={() => handleRespondToRequest(req.id, "rejected")}
                                  className="py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>رفض الطلب</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: BROADCAST NOTIFICATION */}
            {adminTab === "broadcast" && (
              <form onSubmit={handleSendBroadcast} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-purple-400" />
                  إرسال تعميم أو تنبيه جماعي لكادر الموظفين
                </h3>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">عنوان التعميم/التنبيه:</label>
                  <input
                    type="text"
                    value={broadcastTitle ?? ""}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="مثال: تعليمات مواعيد العمل الجديدة"
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">نص التعميم والتفاصيل:</label>
                  <textarea
                    value={broadcastMessage ?? ""}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="أدخل نص التعميم أو التنبيه المراد إرساله إلى تطبيق الموبايل..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-3 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={broadcastSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
                >
                  {broadcastSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>بث التنبيه فوراً لجميع الموظفين</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          /* STANDARD EMPLOYEE PORTAL VIEWS */
          <>
        {/* TAB 1: SELFIE & GEOLOCATION ATTENDANCE CHECK-IN / CHECK-OUT */}
        {activeTab === "attendance" && (
          <div className="space-y-4">
            {/* Offline Attendance Pending Sync Banner */}
            {unsyncedOfflineCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center justify-between gap-2 text-amber-600 dark:text-amber-400 text-xs">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 shrink-0 animate-bounce" />
                  <span className="font-bold">
                    لديك {unsyncedOfflineCount} سجل حضور أوفلاين بانتظار المزامنة
                  </span>
                </div>
                <button
                  onClick={handleSyncOfflineRecords}
                  disabled={syncingOffline}
                  className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition flex items-center gap-1 shadow-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingOffline ? "animate-spin" : ""}`} />
                  <span>مزامنة الآن</span>
                </button>
              </div>
            )}

            {/* 3D Animated Interactive Banner Graphic */}
            <Employee3DPortalGraphic compact={false} />

            {/* Location Status Card */}
            <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border rounded-2xl p-4 space-y-2 transition-colors duration-300`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                  <MapPin className="w-4 h-4" />
                  <span>الموقع الجغرافي الحالي (GPS)</span>
                </div>
                <button
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                  className={`p-1.5 ${isLight ? "text-slate-600 hover:text-slate-900 bg-slate-100" : "text-slate-400 hover:text-white bg-slate-800"} rounded-lg transition`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${locationLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {locationLoading ? (
                <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"} animate-pulse`}>جاري تحديد الموقع الجغرافي للدقة...</p>
              ) : locationError ? (
                <p className="text-xs text-rose-500">{locationError}</p>
              ) : (
                <div className={`text-xs ${isLight ? "text-slate-800 bg-slate-50 border-slate-200" : "text-slate-300 bg-slate-950/60 border-slate-800/80"} p-2.5 rounded-xl border font-mono`}>
                  {location?.address}
                </div>
              )}
            </div>

            {/* Selfie Camera Preview Box */}
            <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border rounded-2xl p-4 text-center space-y-3 transition-colors duration-300`}>
              <div className={`flex items-center justify-center gap-2 text-xs font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                <Camera className="w-4 h-4 text-emerald-500" />
                <span>التقاط صورة بصمة السيلفي المباشرة</span>
              </div>

              {/* Video Stream or Captured Image */}
              <div className={`relative w-full aspect-square max-w-[260px] mx-auto ${isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700"} rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center`}>
                {cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : capturedPhoto ? (
                  <img src={capturedPhoto} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <div className={`p-6 text-center ${isLight ? "text-slate-400" : "text-slate-500"} space-y-2`}>
                    <Camera className="w-12 h-12 mx-auto text-slate-400" />
                    <p className="text-xs">اضغط على أحد الخيارات أدناه لالتقاط صورة السيلفي والتحقق البيومتري</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Camera Actions */}
              <div className="flex flex-col items-center justify-center gap-2 pt-1 w-full">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {!cameraActive && !capturedPhoto && (
                    <>
                      {/* Primary Camera Button: Native Mobile Camera App */}
                      <button
                        onClick={() => selfieNativeCameraInputRef.current?.click()}
                        className="py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition cursor-pointer w-full justify-center text-center"
                        title="فتح كاميرا الهاتف لالتقاط سيلفي الحضور مباشرة"
                      >
                        <Camera className="w-5 h-5 text-white" />
                        <span>فتح الكاميرا والتقاط صورة سيلفي حية 📸</span>
                      </button>

                      {/* Secondary Camera Button: Browser WebRTC Stream */}
                      <button
                        onClick={startCamera}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="تشغيل كاميرا المتصفح المباشرة"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                        <span>كاميرا المتصفح (Webcam)</span>
                      </button>

                      {/* Native Mobile Camera Input */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        ref={selfieNativeCameraInputRef}
                        onChange={handleSelfieFileUpload}
                        className="hidden"
                      />
                    </>
                  )}

                  {cameraActive && (
                    <button
                      onClick={capturePhoto}
                      className="py-2.5 px-5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>التقاط اللقطة الآن</span>
                    </button>
                  )}

                  {capturedPhoto && (
                    <button
                      onClick={() => {
                        setCapturedPhoto(null);
                        setCameraActive(false);
                      }}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة التقاط</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Punch Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleAttendanceSubmit("check_in")}
                disabled={checkinLoading || !capturedPhoto}
                className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/30 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <UserCheck className="w-6 h-6" />
                <span>تسجيل حضور (Check-In)</span>
              </button>

              <button
                onClick={() => handleAttendanceSubmit("check_out")}
                disabled={checkinLoading || !capturedPhoto}
                className="py-3.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-rose-900/30 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <UserX className="w-6 h-6" />
                <span>تسجيل انصراف (Check-Out)</span>
              </button>
            </div>

            {/* Secondary Attendance Options: Biometrics Enrollment & Dynamic QR Scanner */}
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Face Biometrics Enrollment Action */}
                <button
                  onClick={handleEnrollFaceBiometrics}
                  disabled={enrollingFace || !capturedPhoto}
                  className="py-2.5 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ScanFace className="w-4 h-4 text-indigo-500" />
                  <span>
                    {enrollingFace
                      ? "جاري تحليل بصمة الوجه بالذكاء الاصطناعي..."
                      : "📸 تسجيل / تحديث بصمة الوجه البيومترية الحية"}
                  </span>
                </button>

                {/* Dynamic QR Scanner Action */}
                <button
                  onClick={() => setShowQrScanModal(true)}
                  className="py-2.5 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <QrCode className="w-4 h-4 text-emerald-500" />
                  <span>🏁 مسح رمز QR التفاعلي للفرع</span>
                </button>
              </div>

              {enrolledFaceSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl text-xs font-bold text-center">
                  {enrolledFaceSuccess}
                </div>
              )}
            </div>

            {!capturedPhoto && (
              <p className="text-[11px] text-amber-500 text-center font-medium pt-1">
                ⚠️ يرجى استخدام الكاميرا أعلاه لالتقاط صورة سيلفي حية أولاً لتفعيل تسجيل الحضور والإنصراف.
              </p>
            )}
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE LOG & HISTORY */}
        {/* TAB 5: LEAVES */}
        {activeTab === "leaves" && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-4">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 mx-auto shadow-inner">
                <Calendar className="w-8 h-8" />
              </div>
              <h2 className={`text-xl font-black ${isLight ? "text-slate-800" : "text-white"}`}>رصيد الإجازات</h2>
              <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>متابعة الرصيد السنوي والمستهلك والمتبقي</p>
            </div>

            {/* Leave Balances & Consumption Card Widget */}
            <div className={`${isLight ? "bg-white border-slate-200/80 shadow-md backdrop-blur-sm" : "bg-slate-900 border-slate-800/80 shadow-lg"} border rounded-3xl p-5 sm:p-6 space-y-6 transition-all duration-300`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm sm:text-base ${isLight ? "text-slate-800" : "text-slate-100"}`}>
                      رصيد الإجازات المستحق
                    </h3>
                    <p className={`text-[10px] sm:text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      تحديث تلقائي وفوري للرصيد والمخصومات
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${isLight ? "bg-purple-100/70 text-purple-700" : "bg-purple-950/80 text-purple-300 border border-purple-800/50"}`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
              </div>

              {(() => {
                const annTotal = employee?.annual_leave_total || 21;
                const annBal = employee?.annual_leave_balance !== undefined && employee?.annual_leave_balance !== null ? Number(employee.annual_leave_balance) : annTotal;
                const annConsumed = employee?.annual_leave_consumed !== undefined ? Number(employee.annual_leave_consumed) : Math.max(0, annTotal - annBal);

                const casTotal = employee?.casual_leave_total || 6;
                const casBal = employee?.casual_leave_balance !== undefined && employee?.casual_leave_balance !== null ? Number(employee.casual_leave_balance) : casTotal;
                const casConsumed = employee?.casual_leave_consumed !== undefined ? Number(employee.casual_leave_consumed) : Math.max(0, casTotal - casBal);

                const sickTotal = employee?.sick_leave_total || 14;
                const sickBal = employee?.sick_leave_balance !== undefined && employee?.sick_leave_balance !== null ? Number(employee.sick_leave_balance) : sickTotal;
                const sickConsumed = employee?.sick_leave_consumed !== undefined ? Number(employee.sick_leave_consumed) : Math.max(0, sickTotal - sickBal);

                return (
                  <div className="flex flex-col gap-5">
                    {/* Annual */}
                    <div className={`${isLight ? "bg-gradient-to-br from-purple-50/50 via-white to-slate-50/50 border-purple-100 shadow-sm hover:shadow-md hover:border-purple-200" : "bg-gradient-to-br from-purple-950/20 via-slate-900 to-slate-950 border-purple-900/30 hover:border-purple-700/40"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-sm">
                          <span className="text-xl">🏖️</span>
                          <span>الإجازة السنوية</span>
                        </span>
                        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg ${isLight ? "bg-purple-100 text-purple-800" : "bg-purple-900/60 text-purple-200"}`}>
                          {annTotal} يوم الإجمالي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-center font-bold">
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-rose-500/10 text-rose-700 border border-rose-100" : "bg-rose-950/40 text-rose-300 border border-rose-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">تم استهلاكه</div>
                          <div className="text-lg font-black">{annConsumed} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-100" : "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">الرصيد المتبقي</div>
                          <div className="text-lg font-black">{annBal} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((annBal / annTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (annBal / annTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Casual */}
                    <div className={`${isLight ? "bg-gradient-to-br from-amber-50/50 via-white to-slate-50/50 border-amber-100 shadow-sm hover:shadow-md hover:border-amber-200" : "bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border-amber-900/30 hover:border-amber-700/40"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                          <span className="text-xl">⚡</span>
                          <span>الإجازة العارضة</span>
                        </span>
                        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg ${isLight ? "bg-amber-100 text-amber-800" : "bg-amber-900/60 text-amber-200"}`}>
                          {casTotal} أيام الإجمالي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-center font-bold">
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-rose-500/10 text-rose-700 border border-rose-100" : "bg-rose-950/40 text-rose-300 border border-rose-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">تم استهلاكه</div>
                          <div className="text-lg font-black">{casConsumed} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-100" : "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">الرصيد المتبقي</div>
                          <div className="text-lg font-black">{casBal} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((casBal / casTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (casBal / casTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sick */}
                    <div className={`${isLight ? "bg-gradient-to-br from-blue-50/50 via-white to-slate-50/50 border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200" : "bg-gradient-to-br from-blue-950/20 via-slate-900 to-slate-950 border-blue-900/30 hover:border-blue-700/40"} border rounded-2xl p-4 sm:p-5 space-y-4 transition-all`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                          <span className="text-xl">🏥</span>
                          <span>الإجازة المرضية</span>
                        </span>
                        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg ${isLight ? "bg-blue-100 text-blue-800" : "bg-blue-900/60 text-blue-200"}`}>
                          {sickTotal} يوم الإجمالي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-center font-bold">
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-rose-500/10 text-rose-700 border border-rose-100" : "bg-rose-950/40 text-rose-300 border border-rose-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">تم استهلاكه</div>
                          <div className="text-lg font-black">{sickConsumed} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-100" : "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50"}`}>
                          <div className="text-[10px] opacity-80 font-normal">الرصيد المتبقي</div>
                          <div className="text-lg font-black">{sickBal} <span className="text-xs font-normal">يوم</span></div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                          <span>نسبة المتبقي</span>
                          <span>{Math.round((sickBal / sickTotal) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${Math.min(100, Math.max(0, (sickBal / sickTotal) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Request Leave Quick Button */}
            <button
              onClick={() => {
                setActiveTab("requests");
              }}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1"
            >
              <Plus className="w-5 h-5" />
              <span>تقديم طلب إجازة جديد</span>
            </button>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {/* Month & Year Selectors */}
            <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} flex items-center justify-between p-3 rounded-2xl border text-xs transition-colors duration-300`}>
              <span className={`font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>تاريخ السجل:</span>
              <div className="flex items-center gap-2">
                <select
                  value={historyMonth ?? ""}
                  onChange={(e: any) => setHistoryMonth(Number(e.target.value))}
                  className={`${isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-950 border-slate-700 text-white"} border rounded-lg px-2.5 py-1 text-xs outline-none`}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      شهر {i + 1}
                    </option>
                  ))}
                </select>
                <select
                  value={historyYear ?? ""}
                  onChange={(e: any) => setHistoryYear(Number(e.target.value))}
                  className={`${isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-950 border-slate-700 text-white"} border rounded-lg px-2.5 py-1 text-xs outline-none`}
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
            </div>

            {/* KPI Summary Cards for Attendance */}
            {!historyLoading && historyRecords.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>أيام الحضور المسجلة</span>
                  <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {historyRecords.filter(r => r.status === 'present').length} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>يوم</span>
                  </span>
                </div>

                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>إجمالي ساعات العمل</span>
                  <span className="text-lg font-extrabold text-teal-600 dark:text-teal-400">
                    {historyRecords.reduce((acc, r) => acc + Number(r.work_hours || 0), 0).toFixed(1)} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>ساعة</span>
                  </span>
                </div>

                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>إجمالي دقائق التأخير</span>
                  <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    {historyRecords.reduce((acc, r) => acc + Number(r.delay_minutes || 0), 0)} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>دقيقة</span>
                  </span>
                </div>

                <div className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border p-3 rounded-2xl flex flex-col gap-1 transition-colors duration-300`}>
                  <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} font-semibold`}>إجمالي الخصومات والجزاءات</span>
                  <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                    {historyRecords.reduce((acc, r) => acc + Number(r.penalty || 0), 0)} <span className={`text-xs font-normal ${isLight ? "text-slate-600" : "text-slate-300"}`}>ج.م</span>
                  </span>
                </div>
              </div>
            )}

            {historyLoading ? (
              <div className={`p-8 text-center ${isLight ? "text-slate-500" : "text-slate-400"} text-xs animate-pulse`}>جاري تحميل سجل البصمات...</div>
            ) : historyRecords.length === 0 ? (
              <div className={`p-8 text-center ${isLight ? "bg-white text-slate-500 border-slate-200" : "bg-slate-900/50 text-slate-500 border-slate-800"} rounded-2xl border text-xs`}>
                لا توجد بصمات مسجلة لهذا الشهر حتى الآن.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyRecords.map((rec) => (
                  <div key={rec.id} className={`${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"} border rounded-2xl p-3.5 space-y-2 transition-colors duration-300`}>
                    <div className={`flex items-center justify-between border-b ${isLight ? "border-slate-200" : "border-slate-800"} pb-2`}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{formatDisplayDate(rec.date)}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          rec.status === "present" || rec.check_in
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {rec.status === "present" || rec.check_in ? "حاضر" : "غائب"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800/60"} border p-2 rounded-xl flex flex-col justify-between gap-1`}>
                        <div>
                          <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"} block`}>وقت الحضور</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatDisplayTime(rec.check_in)}</span>
                        </div>
                        <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/60">
                          {rec.check_in_photo && (
                            <button
                              onClick={() => setSelectedPhotoModal(rec.check_in_photo!)}
                              className="text-[10px] text-teal-400 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <span>📸 عرض سيلفي الدخول</span>
                            </button>
                          )}
                          {rec.check_in_location && (
                            <span className="text-[9px] text-slate-400 truncate" title={rec.check_in_location}>
                              📍 {rec.check_in_location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-2 rounded-xl flex flex-col justify-between gap-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block">وقت الإنصراف</span>
                          <span className="font-bold text-rose-400">{formatDisplayTime(rec.check_out)}</span>
                        </div>
                        <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/60">
                          {rec.check_out_photo && (
                            <button
                              onClick={() => setSelectedPhotoModal(rec.check_out_photo!)}
                              className="text-[10px] text-teal-400 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <span>📸 عرض سيلفي الخروج</span>
                            </button>
                          )}
                          {rec.check_out_location && (
                            <span className="text-[9px] text-slate-400 truncate" title={rec.check_out_location}>
                              📍 {rec.check_out_location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(rec.delay_minutes || 0) > 0 && (
                      <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl flex items-center justify-between font-medium">
                        <span>تأخير: {rec.delay_minutes} دقيقة</span>
                        <span>خصم: {rec.penalty || 0} ج.م</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY PAYROLL & PAYSLIP */}
        {activeTab === "payroll" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800 text-xs">
              <span className="font-semibold text-slate-300">شهر مفردات المرتب:</span>
              <div className="flex items-center gap-2">
                <select
                  value={payrollMonth ?? ""}
                  onChange={(e: any) => setPayrollMonth(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      شهر {i + 1}
                    </option>
                  ))}
                </select>
                <select
                  value={payrollYear ?? ""}
                  onChange={(e: any) => setPayrollYear(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs outline-none"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
            </div>

            {payrollLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse">جاري احتساب مفردات المرتب...</div>
            ) : !payrollData ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
                لا توجد بيانات مرتب مسجلة لهذا الشهر.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Net Salary Highlight Card */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xl space-y-2">
                  <span className="text-xs text-emerald-100 font-medium">المرتب الصافي المستحق للقبض</span>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {Number(payrollData.net_salary || 0 || 0).toLocaleString("ar-EG")} <span className="text-sm font-normal">ج.م</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-400/30 flex justify-between text-xs text-emerald-100">
                    <span>أيام الحضور: {payrollData.days_attended || 0} يوم</span>
                    <span>ساعات العمل: {payrollData.total_hours || 0} ساعة</span>
                  </div>
                </div>

                {/* Salary Breakdown List */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
                  <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2">تفاصيل مفردات الراتب</h3>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">المرتب الأساسي</span>
                    <span className="font-bold text-slate-100">{Number(payrollData.basic_salary || 0 || 0).toLocaleString()} ج.م</span>
                  </div>

                  {Number(payrollData.meal_allowance || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">بدل الوجبة</span>
                      <span className="font-bold text-emerald-400">+{Number(payrollData.meal_allowance || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {Number(payrollData.total_bonuses || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">إجمالي المكافآت والزيادات</span>
                      <span className="font-bold text-emerald-400">+{Number(payrollData.total_bonuses || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {Number(payrollData.total_deductions || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">الخصومات والجزاءات</span>
                      <span className="font-bold text-rose-400">-{Number(payrollData.total_deductions || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {Number(payrollData.total_advances || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">السلفيات المسحوبة</span>
                      <span className="font-bold text-amber-400">-{Number(payrollData.total_advances || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  )}

                  {Number(payrollData.insurance || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">مستقطع التأمينات</span>
                      <span className="font-bold text-rose-400">-{Number(payrollData.insurance || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HR REQUESTS, MEMOS & COMPLAINTS */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Form Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>رفع مذكرة / شكوى / طلب جديد لإدارة HR</span>
              </h3>

              {requestSubmitted ? (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                  <p className="font-bold text-sm">تم إرسال المذكرة / الطلب بنجاح إلى الإدارة!</p>
                  <p className="text-[11px] text-emerald-200">سيتم مراجعتها من قبل مسئول الموارد البشرية والرد عليها قريباً.</p>
                  <button
                    onClick={() => setRequestSubmitted(false)}
                    className="mt-2 text-[11px] font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                  >
                    رفع مذكرة أو طلب آخر
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">نوع المعاملة</label>
                    <select
                      value={requestType ?? ""}
                      onChange={(e: any) => setRequestType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none font-semibold text-xs"
                    >
                      <option value="memo">📝 مذكرة عمل / إفادة رسمية</option>
                      <option value="complaint">⚠️ شكوى أو مقترح لإدارة HR</option>
                      <option value="leave">🏖️ طلب إجازة (سنوية / عارضة / مرضية)</option>
                      <option value="advance">💰 طلب سلفة مالية من المرتب</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">الموضوع / العنوان</label>
                    <input
                      type="text"
                      value={requestTitle ?? ""}
                      onChange={(e: any) => setRequestTitle(e.target.value)}
                      placeholder={
                        requestType === "memo" ? "مثال: مذكرة بخصوص عطل في الجهاز" :
                        requestType === "complaint" ? "مثال: شكوى من تأخر استلام المهام" :
                        requestType === "leave" ? "مثال: طلب إجازة عارضة يومين" : "طلب سلفة طارئة"
                      }
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none"
                      required
                    />
                  </div>

                  {requestType === "advance" && (
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">المبلغ المطلوب (ج.م)</label>
                      <input
                        type="number"
                        value={requestAmount ?? ""}
                        onChange={(e: any) => setRequestAmount(e.target.value)}
                        placeholder="أدخل قيمة السلفة"
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none font-bold text-emerald-400"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">تفاصيل المذكرة / الشرح والمبررات</label>
                    <textarea
                      value={requestNotes ?? ""}
                      onChange={(e: any) => setRequestNotes(e.target.value)}
                      rows={3}
                      placeholder="اكتب جميع التفاصيل والأسباب ليتمكن قسم HR من دراستها واتخاذ القرار..."
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">إرفاق صورة / مستند كدليل (اختياري)</label>
                    {requestAttachment ? (
                      <div className="relative w-28 h-28 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden group">
                        <img src={requestAttachment} alt="Attachment" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setRequestAttachment(null)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full shadow-md"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer text-slate-400 hover:text-white transition">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px]">التقط صورة أو اختر مستند من الهاتف</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={requestSubmitting}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {requestSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>إرسال المذكرة / الطلب الآن</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* List Section: Previous Requests & Memos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-200">سجل المذكرات والشكاوى والطلبات المرفوعة</h3>
                <button
                  onClick={fetchMyRequests}
                  className="p-1 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800"
                  title="تحديث القائمة"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                <button
                  onClick={() => setRequestsFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "all" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setRequestsFilter("memo")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "memo" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  مذكرات عمل
                </button>
                <button
                  onClick={() => setRequestsFilter("complaint")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "complaint" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  شكاوى ومقترحات
                </button>
                <button
                  onClick={() => setRequestsFilter("leave")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "leave" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  إجازات
                </button>
                <button
                  onClick={() => setRequestsFilter("advance")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    requestsFilter === "advance" ? "bg-emerald-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  سلف
                </button>
              </div>

              {myRequestsLoading ? (
                <div className="p-6 text-center text-slate-400 text-xs animate-pulse">جاري تحميل سجل المذكرات والطلبات...</div>
              ) : myRequests.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl text-xs">
                  لم تقم برفع أي مذكرات أو شكاوى حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myRequests
                    .filter((r) => requestsFilter === "all" || r.request_type === requestsFilter)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-100">{item.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                item.request_type === "memo" ? "bg-cyan-500/20 text-cyan-300" :
                                item.request_type === "complaint" ? "bg-purple-500/20 text-purple-300" :
                                item.request_type === "advance" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                              }`}>
                                {item.request_type === "memo" ? "مذكرة" :
                                 item.request_type === "complaint" ? "شكوى" :
                                 item.request_type === "advance" ? "سلفة" : "إجازة"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {formatDisplayDate(item.created_at)} - {formatDisplayTime(item.created_at)}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            item.status === "approved" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            item.status === "rejected" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                            "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {item.status === "approved" ? "تم الموافقة" :
                             item.status === "rejected" ? "تم الرفض" : "قيد المراجعة"}
                          </span>
                        </div>

                        {item.amount && Number(item.amount) > 0 ? (
                          <div className="text-[11px] font-bold text-amber-400 bg-amber-500/10 p-1.5 rounded-lg">
                            المبلغ المطلوب: {Number(item.amount || 0).toLocaleString()} ج.م
                          </div>
                        ) : null}

                        {item.notes && (
                          <p className="text-slate-300 text-[11px] bg-slate-900 p-2 rounded-lg leading-relaxed whitespace-pre-wrap">
                            {item.notes}
                          </p>
                        )}

                        {item.attachment && (
                          <div>
                            <button
                              onClick={() => setSelectedPhotoModal(item.attachment!)}
                              className="text-[10px] text-teal-400 font-bold flex items-center gap-1 hover:underline"
                            >
                              📸 عرض المرفق / الصورة المسجلة
                            </button>
                          </div>
                        )}

                        {item.admin_response && (
                          <div className="mt-2 p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-emerald-400 block">💬 رد إدارة HR:</span>
                            <p className="text-[11px] text-emerald-200">{item.admin_response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: MESSAGES & NOTIFICATIONS FROM HR */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-400 animate-bounce" />
                  <span>مركز الرسائل والتنبيهات الإدارية ({notifications.length})</span>
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markNotificationsAsRead}
                    className="text-[10px] font-bold text-purple-300 hover:text-purple-200 bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30 transition"
                  >
                    تعليم الكل كمقروء ✓
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl space-y-2">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold">لا توجد رسائل أو إشعارات حالياً</p>
                  <p className="text-[10px] text-slate-500">
                    أي رسالة أو تنبيه يتم إرساله من إدارة الموارد البشرية سيظهر لك هنا فوراً.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-0.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-2xl border text-xs transition-all space-y-1.5 ${
                        n.read
                          ? "bg-slate-950/70 border-slate-800 text-slate-300"
                          : "bg-purple-950/40 border-purple-600/50 text-slate-100 shadow-md shadow-purple-950/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0 animate-ping" />
                          )}
                          <span className="font-black text-slate-100 text-xs">{n.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 font-mono">
                          {formatDisplayDate(n.created_at)} {formatDisplayTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/60 whitespace-pre-wrap">
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}
      </main>

      {/* CHECKIN SUCCESS MODAL / TOAST */}
      <AnimatePresence>
        {checkinSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{checkinSuccess.message}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  تم تسجيل البصمة بالتوقيت: <span className="text-emerald-400 font-bold">{checkinSuccess.time}</span>
                </p>
              </div>

              {checkinSuccess.photo && (
                <img
                  src={checkinSuccess.photo}
                  alt="Proof"
                  className="w-28 h-28 object-cover rounded-2xl mx-auto border-2 border-emerald-500/50 shadow-md"
                />
              )}

              {checkinSuccess.delay_minutes > 0 && (
                <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-xs">
                  تأخير عن الشيفت: {checkinSuccess.delay_minutes} دقيقة (خصم {checkinSuccess.penalty} ج.م)
                </div>
              )}

              <button
                onClick={() => setCheckinSuccess(null)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                تم وموافق
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHOTO PREVIEW MODAL WITH 3D PERSPECTIVE */}
      {selectedPhotoModal && (
        <div
          onClick={() => setSelectedPhotoModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 perspective-1000"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full bg-slate-900 p-3 rounded-3xl border-2 border-cyan-400/60 shadow-[0_25px_60px_rgba(0,0,0,0.9)] transform-gpu transition-all duration-300 preserve-3d"
            style={{
              transform: "rotateX(6deg) rotateY(-5deg) translateZ(30px)",
              transformStyle: "preserve-3d"
            }}
          >
            {/* 3D Glowing Backdrop Aura */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-3xl blur-xl opacity-50 pointer-events-none animate-pulse" />

            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-2xl z-20 border border-rose-300/40"
              title="إغلاق المعاينة 3D"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
              <img src={selectedPhotoModal} alt="3D Selfie Preview" className="w-full rounded-2xl object-contain max-h-[75vh]" />
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC BRANCH QR ATTENDANCE MODAL */}
      {showQrScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrScanModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white mb-1">
              مسح رمز QR الفرع للحضور
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              أدخل كود QR المعروض على شاشة الفرع الآن أو امسحه بكاميرا الهاتف
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={qrScanInput ?? ""}
                onChange={(e) => setQrScanInput(e.target.value)}
                placeholder="أدخل كود QR المعروض على شاشة الفرع..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-center text-sm text-white font-mono placeholder:text-slate-600 focus:border-emerald-500 outline-none"
              />

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleQrAttendanceSubmit("check_in")}
                  disabled={qrScanning || !qrScanInput.trim()}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  تسجيل حضور (QR)
                </button>
                <button
                  onClick={() => handleQrAttendanceSubmit("check_out")}
                  disabled={qrScanning || !qrScanInput.trim()}
                  className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  تسجيل انصراف (QR)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Employee Report Details Modal */}
      {selectedEmployeeReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-sm border border-purple-500/30">
                  {selectedEmployeeReport.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedEmployeeReport.name}</h3>
                  <p className="text-[10px] text-slate-400">#{selectedEmployeeReport.employee_code} • {selectedEmployeeReport.job_title || "موظف"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEmployeeReport(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 block">الفرع والقسم:</span>
                <span className="font-bold text-white">{selectedEmployeeReport.branch_name || "الفرع الرئيسي"} - {selectedEmployeeReport.department_name || "العام"}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-950 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block">المرتب الأساسي:</span>
                  <span className="font-extrabold text-emerald-400 text-sm">{Number(selectedEmployeeReport.basic_salary || 0 || 0).toLocaleString()} ج.م</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block">رصيد الإجازات السنوية:</span>
                  <span className="font-extrabold text-cyan-400 text-sm">{selectedEmployeeReport.annual_leave_balance ?? 21} يوم</span>
                </div>
              </div>

              {selectedEmployeeReport.phone && (
                <a
                  href={`tel:${selectedEmployeeReport.phone}`}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>اتصال مباشر بالموظف ({selectedEmployeeReport.phone})</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Payslip Breakdown Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">مفردات مرتب: {selectedPayslip.employee_name}</h3>
                <p className="text-[10px] text-purple-400">شهر {adminPayrollMonth} / عام {adminPayrollYear}</p>
              </div>
              <button onClick={() => setSelectedPayslip(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-950 rounded-xl">
                <span className="text-slate-400">المرتب الأساسي:</span>
                <span className="font-bold text-white">{selectedPayslip.basic_salary} ج.م</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-xl">
                <span className="text-slate-400">إجمالي المكافآت والحوافز:</span>
                <span className="font-bold text-emerald-400">+{selectedPayslip.total_bonuses || 0} ج.م</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-xl">
                <span className="text-slate-400">إجمالي الخصومات والجزاءات:</span>
                <span className="font-bold text-amber-400">-{selectedPayslip.total_deductions || 0} ج.م</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-xl">
                <span className="text-slate-400">خصم السلف والبدلات:</span>
                <span className="font-bold text-rose-400">-{selectedPayslip.total_advances || 0} ج.م</span>
              </div>
              <div className="flex justify-between p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-sm font-extrabold">
                <span className="text-emerald-300">الصافي المستحق للصرف:</span>
                <span className="text-emerald-400">{selectedPayslip.net_salary} ج.م</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Attendance Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                تسجيل بصمة يدوية لموظف
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAttendanceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">اختر الموظف:</label>
                <EmployeeSearchSelect
                  employees={adminEmployees as any}
                  value={manualEmpId ?? ""}
                  onChange={(value) => setManualEmpId(value)}
                  placeholder="ابحث باسم الموظف أو الكود..."
                  required
                  dark
                  inputClassName="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">التاريخ:</label>
                <input
                  type="date"
                  value={manualDate ?? ""}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">وقت الحضور:</label>
                  <input
                    type="time"
                    value={manualCheckInTime ?? ""}
                    onChange={(e) => setManualCheckInTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-2 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">وقت الانصراف:</label>
                  <input
                    type="time"
                    value={manualCheckOutTime ?? ""}
                    onChange={(e) => setManualCheckOutTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-2 py-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">ملاحظات سبب التسجيل اليدوي:</label>
                <input
                  type="text"
                  placeholder="مثال: عطل في الموبايل / مأمورية خارجية..."
                  value={manualNotes ?? ""}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={manualSubmitting}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition shadow-md"
              >
                {manualSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "اعتماد وتسجيل البصمة اليدوية"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Mobile Navigation Tabs */}
      <nav className={`${isLight ? "bg-white/95 border-slate-200 shadow-lg" : "bg-slate-900/95 border-slate-800"} border-t fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 backdrop-blur-md grid ${isAdminMode ? 'grid-cols-5' : 'grid-cols-6'} p-1 transition-colors duration-300`}>
        {isAdminMode ? (
          <>
            <button
              onClick={() => setAdminTab("live_attendance")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                adminTab === "live_attendance" ? "text-purple-400 bg-purple-500/10 font-black" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock className="w-4 h-4 mb-0.5" />
              <span>البصمات</span>
            </button>

            <button
              onClick={() => setAdminTab("employee_reports")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                adminTab === "employee_reports" ? "text-purple-400 bg-purple-500/10 font-black" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>الموظفين</span>
            </button>

            <button
              onClick={() => setAdminTab("payroll_summary")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                adminTab === "payroll_summary" ? "text-purple-400 bg-purple-500/10 font-black" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <DollarSign className="w-4 h-4 mb-0.5" />
              <span>المرتبات</span>
            </button>

            <button
              onClick={() => setAdminTab("requests_approvals")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                adminTab === "requests_approvals" ? "text-purple-400 bg-purple-500/10 font-black" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4 mb-0.5" />
              <span>الطلبات</span>
            </button>

            <button
              onClick={() => setAdminTab("broadcast")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                adminTab === "broadcast" ? "text-purple-400 bg-purple-500/10 font-black" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Send className="w-4 h-4 mb-0.5" />
              <span>تعميم</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab("attendance")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                activeTab === "attendance"
                  ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-4 h-4 mb-0.5" />
              <span>البصمة</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                activeTab === "history"
                  ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock className="w-4 h-4 mb-0.5" />
              <span>السجل</span>
            </button>

            <button
              onClick={() => setActiveTab("payroll")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                activeTab === "payroll"
                  ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <DollarSign className="w-4 h-4 mb-0.5" />
              <span>المرتب</span>
            </button>

            <button
              onClick={() => setActiveTab("leaves")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                activeTab === "leaves"
                  ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-4 h-4 mb-0.5" />
              <span>إجازاتي</span>
            </button>

            <button
              onClick={() => setActiveTab("requests")}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition ${
                activeTab === "requests"
                  ? isLight ? "text-emerald-700 bg-emerald-50" : "text-emerald-400 bg-emerald-500/10"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Send className="w-4 h-4 mb-0.5" />
              <span>الطلبات</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("messages");
                markNotificationsAsRead();
              }}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[9px] sm:text-[10px] font-bold transition relative ${
                activeTab === "messages"
                  ? isLight ? "text-purple-700 bg-purple-50" : "text-purple-400 bg-purple-500/10"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bell className="w-4 h-4 mb-0.5" />
              <span>الرسائل</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </>
        )}
      </nav>
    </div>
  );
};

export default EmployeeMobilePortal;
