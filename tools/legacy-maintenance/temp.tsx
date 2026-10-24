import React, { useState, useEffect, useRef } from "react";
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
  ShieldCheck
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

const Employee3DPortalGraphic: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className="relative group my-4 flex justify-center perspective-1000 select-none">
      {/* Outer 3D glowing aura */}
      <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition duration-700 animate-pulse" />

      {/* Main 3D Interactive Card with Floating Perspective Motion */}
      <motion.div
        animate={{
          y: [0, -10, 0],
          rotateX: [2, -2, 2],
          rotateY: [-5, 5, -5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`relative ${
          compact ? "w-full max-w-[320px] h-40" : "w-full max-w-[360px] h-52"
        } rounded-3xl overflow-hidden border-2 border-emerald-400/50 bg-slate-950 shadow-2xl flex items-center justify-center transform-gpu`}
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
          <span>الطرفية الذكية 3D</span>
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
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Tab: 'attendance' | 'history' | 'payroll' | 'requests' | 'messages' | 'leaves'
  const [activeTab, setActiveTab] = useState<"attendance" | "history" | "payroll" | "requests" | "messages" | "leaves">("attendance");

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



  // Submit Mobile Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode || !loginPassword) {
      setLoginError("يرجى إدخال كود الموظف وكلمة المرور");
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
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
        setCapturedPhoto(null); // Ensure no old photo lingers
      }
    } catch (err: any) {
      setLoginError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoginLoading(false);
    }
  };

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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 mb-2 shadow-inner">
              <Smartphone className="w-7 h-7" />
            </div>
            <h1 className={`text-2xl font-bold ${isLight ? "text-slate-900" : "text-white"} tracking-tight`}>تطبيق الموبايل للموظفين</h1>
            <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"} mt-1`}>بوابة الحضور السيلفي والموقع الجغرافي والمرتبات</p>

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

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-500 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className={`block text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"} mb-1.5`}>كود الموظف (الكود/البصمة)</label>
              <div className="relative">
                <input
                  type="text"
                  value={loginCode}
                  onChange={(e: any) => setLoginCode(e.target.value)}
                  placeholder="أدخل كود الموظف الخاص بك (مثال: 101)"
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
                  value={loginPassword}
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
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-base">
            {employee.name.charAt(0)}
          </div>
          <div>
            <h2 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"} leading-tight`}>{employee.name}</h2>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              كود: #{employee.employee_code} • {employee.job_title || "موظف"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 relative">
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

      {/* Main Content Body */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto space-y-4">
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
