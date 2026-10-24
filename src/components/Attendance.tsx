import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  Download,
  Upload,
  Printer,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Fingerprint,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  X,
  FileText,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  Layers,
  UserCheck,
  UserX,
  Clock3,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { Branch, Employee, AttendanceRecord } from "../types";
import { api } from "../utils/api";
import { PrintableReport } from "./PrintableReport";
import { io as socketIoClient, Socket } from "socket.io-client";
import { resolveUrl } from "../utils/api";
import FingerprintSettings from "./FingerprintSettings";
import { MultiEmployeeSearchFilter } from "./MultiEmployeeSearchFilter";

const getPunchDate = (timeStr: string | null, fallbackDate?: string | null) => {
  if (!timeStr) return "";
  try {
    if (timeStr.includes("T")) {
      return timeStr.split("T")[0];
    }
    if (timeStr.includes(" ")) {
      return timeStr.split(" ")[0];
    }
    const match = timeStr.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) {
      return match[0];
    }
  } catch (e) {}
  return fallbackDate || "";
};

interface AttendanceProps {
  onBack: () => void;
  subView?: string;
}

export const Attendance: React.FC<AttendanceProps> = ({ onBack, subView }) => {
  if (subView === "attendance_report") {
    return <AttendanceReportView onBack={onBack} />;
  }

  const { user } = useAuth();
  const [showFingerprintSettings, setShowFingerprintSettings] = useState(false);

  if (showFingerprintSettings) {
    return <FingerprintSettings onBack={() => setShowFingerprintSettings(false)} />;
  }
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualData, setManualData] = useState({
    fingerprint_code: "",
    timestamp: "",
    type: "check_in" as "check_in" | "check_out",
  });

  const RECORDS_PER_PAGE_OPTIONS = [10, 20, 30, 50, 100, 200];
  const [recordsPerPage, setRecordsPerPage] = useState(50);
  const RECORDS_PER_PAGE = recordsPerPage;
  const [currentPage, setCurrentPage] = useState(1);

  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null,
  );

  // === Real-time attendance notifications (socket.io) ===
  const [realtimeEvents, setRealtimeEvents] = useState<Array<{
    id: string;
    employee_name?: string;
    employee_id: number;
    type: 'check_in' | 'check_out';
    time: string;
    device_name?: string;
  }>>([]);
  const socketRef = useRef<Socket | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{ photo: string; title: string; date?: string } | null>(null);
  const [editData, setEditData] = useState({
    date: "",
    check_in: "",
    check_out: "",
  });
  const [penaltyPolicies, setPenaltyPolicies] = useState<any[]>([]);

  // Refs for measuring sticky element heights dynamically
  const headerRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  // Default values approximate the rendered heights (header ~101px, filters ~95px)
  const [stickyOffsets, setStickyOffsets] = useState({
    filtersTop: 101,
    theadTop: 196,
  });

  useEffect(() => {
    const measure = () => {
      const headerEl = headerRef.current;
      const filtersEl = filtersRef.current;
      const headerH = headerEl?.getBoundingClientRect().height ?? 101;
      // Only include filters height if it has been laid out
      const filtersH = filtersEl?.getBoundingClientRect().height ?? 95;
      setStickyOffsets({
        filtersTop: Math.round(headerH),
        theadTop: Math.round(headerH + filtersH),
      });
    };
    measure();
    // Re-measure on resize and after a small delay (covers font load / wrap changes)
    window.addEventListener("resize", measure);
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 500);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    fetchData();
    fetchPenaltyPolicies();
  }, [selectedYear, selectedMonth, selectedBranch]);

  const selectedYearRef = useRef(selectedYear);
  const selectedMonthRef = useRef(selectedMonth);
  const selectedBranchRef = useRef(selectedBranch);

  useEffect(() => {
    selectedYearRef.current = selectedYear;
  }, [selectedYear]);

  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
  }, [selectedBranch]);

  // === Real-time Socket.IO listener for live attendance updates ===
  // When an employee punches their fingerprint on the device, the server's auto-sync
  // (every 30s) pulls the new log, inserts it, and emits 'attendance:realtime' — we
  // receive it here and instantly refresh the table + show a toast notification.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const baseUrl = resolveUrl("/");
      const socket = socketIoClient(baseUrl, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[Realtime] Connected to attendance stream");
      });

      socket.on("attendance:realtime", (payload: any) => {
        const events: any[] = payload?.events || [];
        if (!Array.isArray(events) || events.length === 0) return;

        console.log(`[Realtime] Received ${events.length} attendance event(s)`, payload);

        // Build notification list (capped at 5 to avoid flooding)
        const notifications = events.slice(0, 5).map((e, i) => ({
          id: `${Date.now()}-${i}`,
          employee_name: e.employee_name || `موظف #${e.employee_id}`,
          employee_id: e.employee_id,
          type: e.is_check_in ? 'check_in' as const : 'check_out' as const,
          time: e.punch_time ? new Date(e.punch_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('ar-EG'),
          device_name: e.device_name,
        }));
        setRealtimeEvents(prev => [...notifications, ...prev].slice(0, 10));

        // Auto-refresh attendance table (silent, no loading spinner)
        fetchData();
      });

      socket.on("disconnect", () => {
        console.log("[Realtime] Disconnected from attendance stream");
      });

      socket.on("connect_error", (err: any) => {
        console.warn("[Realtime] Socket connection error:", err.message);
      });

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    } catch (err) {
      console.warn("[Realtime] Failed to initialize socket.io listener:", err);
    }
  }, []);

  // Auto-dismiss realtime notifications after 8 seconds
  useEffect(() => {
    if (realtimeEvents.length === 0) return;
    const timer = setTimeout(() => {
      setRealtimeEvents(prev => prev.slice(0, prev.length - 1));
    }, 8000);
    return () => clearTimeout(timer);
  }, [realtimeEvents]);

  const fetchPenaltyPolicies = async () => {
    try {
      const res = await api.get("/api/hr/penalties");
      if (res.ok) {
        setPenaltyPolicies(await res.json());
      } else {
        console.error(
          `Failed to fetch penalty policies: ${res.status} ${res.statusText}`,
        );
      }
    } catch (error) {
      console.error("Failed to fetch penalty policies", error);
    }
  };

  const handleApplyPenalty = async (penaltyId: number) => {
    if (!selectedRecord) return;
    try {
      const res = await api.post("/api/attendance/penalty", {
        attendance_id: selectedRecord.id,
        penalty_id: penaltyId,
        userId: user?.id,
      });
      if (res.ok) {
        setShowPenaltyModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "فشل تطبيق الجزاء");
      }
    } catch (error) {
      console.error("Failed to apply penalty");
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (id < 0) return; // Mock data
    if (
      !window.confirm(
        "هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.",
      )
    )
      return;

    try {
      const res = await api.delete(`/api/attendance/${id}?userId=${user?.id}`);
      if (res.ok) {
        setImportStatus({ type: "success", message: "تم حذف السجل بنجاح" });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "فشل حذف السجل");
      }
    } catch (error) {
      console.error("Failed to delete record");
    }
  };

  const handleEditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || selectedRecord.id < 0) return;

    setUpdating(true);
    try {
      const res = await api.put(`/api/attendance/${selectedRecord.id}`, {
        ...editData,
        check_in: editData.check_in || null,
        check_out: editData.check_out || null,
        userId: user?.id,
      });
      if (res.ok) {
        setShowEditModal(false);
        setImportStatus({ type: "success", message: "تم تحديث السجل بنجاح" });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "فشل تحديث السجل");
      }
    } catch (error) {
      console.error("Failed to update record");
      alert("حدث خطأ أثناء تحديث البيانات");
    } finally {
      setUpdating(false);
    }
  };

  const getWallClockTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    if (timeStr.includes("T")) {
      const parts = timeStr.split("T")[1];
      if (parts) {
        const timeParts = parts.split(":");
        if (timeParts.length >= 2) {
          return {
            hours: parseInt(timeParts[0], 10),
            minutes: parseInt(timeParts[1], 10)
          };
        }
      }
    }
    if (timeStr.includes(" ")) {
      const parts = timeStr.split(" ")[1];
      if (parts) {
        const timeParts = parts.split(":");
        if (timeParts.length >= 2) {
          return {
            hours: parseInt(timeParts[0], 10),
            minutes: parseInt(timeParts[1], 10)
          };
        }
      }
    }
    const timeParts = timeStr.split(":");
    if (timeParts.length >= 2) {
      return {
        hours: parseInt(timeParts[0], 10),
        minutes: parseInt(timeParts[1], 10)
      };
    }
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return {
          hours: date.getUTCHours(),
          minutes: date.getUTCMinutes()
        };
      }
    } catch (e) {}
    return null;
  };

  // 24-hour display format (HH:mm) — no AM/PM suffix
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "--:--";
    const wallClock = getWallClockTime(timeStr);
    if (!wallClock) return timeStr;
    const { hours, minutes } = wallClock;
    const displayHours = hours.toString().padStart(2, "0");
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      if (dateStr.includes("T")) {
        return dateStr.split("T")[0];
      }
      if (dateStr.includes(" ")) {
        return dateStr.split(" ")[0];
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toISOString().split("T")[0];
    } catch (e) {
      return dateStr;
    }
  };

  const formatTimeForInput = (timeStr: string | null) => {
    if (!timeStr) return "";
    const wallClock = getWallClockTime(timeStr);
    if (!wallClock) return "";
    const hours = wallClock.hours.toString().padStart(2, "0");
    const minutes = wallClock.minutes.toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const consolidateDailyRecords = (rawRecords: any[]) => {
    if (!Array.isArray(rawRecords)) return [];
    const map = new Map<string, any>();

    for (const item of rawRecords) {
      if (!item) continue;
      const empId = item.employee_id || item.fingerprint_code || item.employee_name;
      const dateStr = String(item.date || "").split("T")[0].split(" ")[0];
      const key = `${empId}_${dateStr}`;

      let fpCode = (item.fingerprint_code || "").toString().trim();
      if (!fpCode || fpCode.includes("COALESCE") || fpCode.includes("NULLIF")) {
        fpCode = item.employee_code || String(item.employee_id || "");
      }

      if (!map.has(key)) {
        map.set(key, {
          ...item,
          date: dateStr,
          fingerprint_code: fpCode,
        });
      } else {
        const existing = map.get(key);
        const allPunches = [
          existing.check_in, existing.check_out, existing.punch_time,
          item.check_in, item.check_out, item.punch_time
        ].filter(Boolean);

        if (allPunches.length > 0) {
          allPunches.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          const earliest = allPunches[0];
          const latest = allPunches[allPunches.length - 1];

          existing.check_in = earliest;
          if (new Date(latest).getTime() > new Date(earliest).getTime()) {
            existing.check_out = latest;
            const diffMs = new Date(latest).getTime() - new Date(earliest).getTime();
            existing.work_hours = Math.round((diffMs / 3600000) * 100) / 100;
          }
        }
        if (!existing.fingerprint_code || existing.fingerprint_code.includes("COALESCE")) {
          existing.fingerprint_code = fpCode;
        }
      }
    }

    return Array.from(map.values());
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recordsRes, branchesRes, deptsRes] = await Promise.all([
        api.get(
          `/api/attendance?year=${selectedYear}&month=${selectedMonth}&branch=${selectedBranch}`,
        ),
        api.get("/api/branches"),
        api.get("/api/hr/departments"),
      ]);

      if (recordsRes.ok) {
        const data = await recordsRes.json();
        const rawList = Array.isArray(data) ? data : [];
        const consolidated = consolidateDailyRecords(rawList);
        setRecords(consolidated);
      } else {
        console.error(
          `Failed to fetch attendance data: ${recordsRes.status} ${recordsRes.statusText}`,
        );
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(Array.isArray(data) ? data : []);
      } else {
        console.error(
          `Failed to fetch branches: ${branchesRes.status} ${branchesRes.statusText}`,
        );
      }
      if (deptsRes.ok) {
        const data = await deptsRes.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch attendance data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDevices = async () => {
    setLoading(true);
    try {
      const devicesRes = await api.get("/api/fingerprint-devices");
      if (!devicesRes.ok) throw new Error("Failed to fetch devices");
      const data = await devicesRes.json();
      const devices = Array.isArray(data) ? data : [];

      let totalCount = 0;
      let successCount = 0;
      let failCount = 0;

      for (const device of devices) {
        if (device.is_active) {
          try {
            const syncRes = await api.post(
              `/api/fingerprint-devices/${device.id}/sync`,
              { userId: user?.id },
            );
            if (syncRes.ok) {
              const data = await syncRes.json();
              totalCount += data.count;
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        setImportStatus({
          type: "success",
          message: `تمت المزامنة بنجاح! تم سحب ${totalCount} سجل من ${successCount} جهاز. ${failCount > 0 ? `فشل ${failCount} جهاز.` : ""}`,
        });
        fetchData();
      } else if (failCount > 0) {
        setImportStatus({
          type: "error",
          message: "فشل سحب البيانات من جميع الأجهزة النشطة",
        });
      } else {
        setImportStatus({
          type: "error",
          message: "لا توجد أجهزة نشطة للمزامنة",
        });
      }
    } catch (error) {
      console.error("Sync failed:", error);
      setImportStatus({
        type: "error",
        message: "فشل سحب البيانات من الأجهزة",
      });
    } finally {
      setLoading(false);
    }
  };

  // Build a map of employee_id/fingerprint_code → department_id and weekly_off_days from the employees data
  const [employeeDeptMap, setEmployeeDeptMap] = useState<Record<string | number, number>>({});
  const [employeeOffDaysMap, setEmployeeOffDaysMap] = useState<Record<number, string[]>>({});
  useEffect(() => {
    api.get("/api/hr/employees").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const deptMap: Record<string | number, number> = {};
        const offMap: Record<number, string[]> = {};
        if (Array.isArray(data)) {
          data.forEach((emp: any) => {
            if (emp.department_id) {
              if (emp.id) deptMap[emp.id] = emp.department_id;
              if (emp.fingerprint_code) deptMap[emp.fingerprint_code] = emp.department_id;
            }
            if (emp.id) {
              try {
                const raw = emp.weekly_off_days;
                if (raw) {
                  offMap[emp.id] = typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                }
              } catch {}
            }
          });
        }
        setEmployeeDeptMap(deptMap);
        setEmployeeOffDaysMap(offMap);
      }
    }).catch(() => {});
  }, []);

  const filteredRecords = records.filter((record) => {
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const searchTerms = searchQuery
        .split(/[,+\n]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (searchTerms.length > 0) {
        matchesSearch = searchTerms.some((term) => {
          return (
            (record.employee_name || "").toLowerCase().includes(term) ||
            (record.fingerprint_code || "").toString().toLowerCase().includes(term)
          );
        });
      }
    }

    const empDept = employeeDeptMap[record.employee_id] ?? (record.fingerprint_code ? employeeDeptMap[record.fingerprint_code] : undefined) ?? (record as any).department_id;
    const matchesDepartment =
      selectedDepartment === "all" ||
      (empDept !== undefined && empDept !== null && empDept.toString() === selectedDepartment);

    return matchesSearch && matchesDepartment;
  });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PER_PAGE));
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  );

  // Reset to page 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, selectedDepartment, selectedYear, selectedMonth, recordsPerPage]);

  const convertArabicToEnglishNumbers = (str: string) => {
    return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Get data as array of arrays first to find the header row
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rows || rows.length < 2) {
          throw new Error("الملف فارغ أو لا يحتوي على بيانات كافية");
        }

        // Find the header row (the one that contains "كود" or "بصمه")
        let headerIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const rowStr = JSON.stringify(rows[i]);
          if (
            rowStr.includes("كود") ||
            rowStr.includes("بصمه") ||
            rowStr.includes("التاريخ")
          ) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          throw new Error(
            "لم يتم العثور على أعمدة البيانات المطلوبة (كود البصمة، التاريخ)",
          );
        }

        const headers = rows[headerIndex];
        const dataRows = rows.slice(headerIndex + 1);

        const processedData = dataRows
          .map((row) => {
            const rowObj: any = {};
            headers.forEach((h, idx) => {
              if (h) rowObj[h.toString().trim()] = row[idx];
            });

            // Normalize keys to find values
            const findValue = (possibleKeys: string[]) => {
              for (const key of Object.keys(rowObj)) {
                const normalizedKey = key
                  .replace(/\s+/g, "")
                  .replace(/[ةه]/g, "ه");
                for (const pKey of possibleKeys) {
                  const normalizedPKey = pKey
                    .replace(/\s+/g, "")
                    .replace(/[ةه]/g, "ه");
                  if (
                    normalizedKey.includes(normalizedPKey) ||
                    normalizedPKey.includes(normalizedKey)
                  ) {
                    return rowObj[key];
                  }
                }
              }
              return null;
            };

            const code = findValue([
              "كودالبصمه",
              "كودالبصمة",
              "الكود",
              "FingerprintCode",
              "Code",
            ]);
            let dateTimeStr = findValue([
              "التاريخ",
              "الوقت",
              "Date",
              "Time",
              "DateTime",
            ]);
            const type = findValue([
              "نوعالحركه",
              "نوعالحركة",
              "الحركه",
              "الحركة",
              "Type",
              "Status",
            ]);

            if (!code || !dateTimeStr) return null;

            // Handle Excel serial dates (numbers)
            if (typeof dateTimeStr === "number") {
              const date = XLSX.SSF.parse_date_code(dateTimeStr);
              dateTimeStr = `${date.m}/${date.d}/${date.y} ${date.H}:${date.M}`;
            }

            // Convert Arabic numbers to English if present
            const cleanCode = convertArabicToEnglishNumbers(
              code.toString().trim(),
            );
            const cleanDateTime = convertArabicToEnglishNumbers(
              dateTimeStr.toString().trim(),
            );

            return {
              fingerprint_code: cleanCode,
              timestamp: cleanDateTime,
              type:
                type?.toString().includes("حضور") ||
                type?.toString().toLowerCase().includes("in")
                  ? "check_in"
                  : "check_out",
            };
          })
          .filter(Boolean);

        if (processedData.length === 0) {
          throw new Error(
            "لم يتم العثور على بيانات صالحة في الملف. تأكد من وجود أعمدة (كود البصمة) و (التاريخ)",
          );
        }

        const response = await api.post("/api/attendance/import", {
          records: processedData,
          userId: user?.id,
        });

        if (response.ok) {
          setImportStatus({
            type: "success",
            message: `تم استيراد ${processedData.length} حركة بنجاح`,
          });
          fetchData();
        } else {
          const err = await response.json();
          throw new Error(err.error || "فشل استيراد البيانات");
        }
      } catch (error: any) {
        setImportStatus({
          type: "error",
          message: error.message || "حدث خطأ أثناء معالجة الملف",
        });
      } finally {
        setImporting(false);
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post("/api/attendance/import", {
        records: [manualData],
        userId: user?.id,
      });

      if (response.ok) {
        setImportStatus({ type: "success", message: "تم إضافة البصمة بنجاح" });
        setShowManualAdd(false);
        setManualData({
          fingerprint_code: "",
          timestamp: "",
          type: "check_in",
        });
        fetchData();
      } else {
        const err = await response.json();
        throw new Error(err.error || "فشل إضافة البصمة");
      }
    } catch (error: any) {
      setImportStatus({
        type: "error",
        message: error.message || "حدث خطأ أثناء الإضافة",
      });
    }
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredRecords.map((r) => ({
        "كود الموظف": r.fingerprint_code,
        الموظف: r.employee_name,
        التاريخ: r.date,
        الوردية: r.shift_name,
        الحضور: r.check_in || "-",
        الانصراف: r.check_out || "-",
        "ساعات العمل": Number(r.work_hours).toFixed(2),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `سجلات_البصمة_${selectedYear}_${selectedMonth}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatOvertime = (hours: number) => {
    if (!hours || hours <= 0) return "-";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0 && m > 0) return `${h}س ${m}د`;
    if (h > 0) return `${h}س`;
    return `${m}د`;
  };

  return (
    <div
      // === Container fixes for proper sticky positioning ===
      // - Use min-h-0 instead of min-h-screen so the container fills its flex parent
      //   without forcing viewport height (which breaks sticky inside scrollable parents).
      // - h-full + flex-col ensures the table area takes remaining vertical space and
      //   its sticky thead is positioned correctly below the header + filters bar.
      className="min-h-0 h-full flex flex-col bg-slate-50 text-slate-900"
      dir="rtl"
    >
      {/* Header - Sticky (z-50: above everything) */}
      <div ref={headerRef} className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
              <Fingerprint className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                سجلات البصمة الذكية
              </h1>
              <p className="text-sm text-slate-500">
                مراقبة الحضور، التأخيرات، والوقت الإضافي آلياً
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {(user?.role === "admin" ||
            user?.permissions?.["attendance.manual_add"] !== false) && (
            <button
              onClick={() => setShowManualAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة يدوي</span>
            </button>
          )}
          {(user?.role === "admin" ||
            user?.permissions?.["attendance.import"] !== false) && (
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-bold border border-slate-200 cursor-pointer">
              <Upload
                className={`w-4 h-4 ${importing ? "animate-spin" : ""}`}
              />
              <span>{importing ? "جاري الاستيراد..." : "استيراد"}</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
          )}
          {(user?.role === "admin" ||
            user?.permissions?.["attendance.excel"] !== false) && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-600/20"
            >
              <Download className="w-4 h-4" />
              <span>إكسيل</span>
            </button>
          )}
          {(user?.role === "admin" ||
            user?.permissions?.["attendance.print"] !== false) && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-emerald-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          )}
          {(user?.role === "admin" ||
            user?.permissions?.["attendance.import"] !== false) && (
            <button
              onClick={handleSyncDevices}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              title="سحب البيانات من أجهزة البصمة"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>سحب من الأجهزة</span>
            </button>
          )}

          <button
            onClick={fetchData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <AnimatePresence>
        {importStatus && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`px-6 py-3 flex items-center justify-between ${
              importStatus.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{importStatus.message}</span>
            </div>
            <button
              onClick={() => setImportStatus(null)}
              className="text-xs underline"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={filtersRef}
        // Filters bar: sticky right below the header (z-40, below header which is z-50)
        className="p-6 bg-white border-b border-slate-200 flex flex-wrap items-center gap-4 print:hidden sticky z-40 shadow-sm"
        style={{ top: `${stickyOffsets.filtersTop}px` }}
      >
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث متعدد بأسماء الموظفين أو الأكواد (تفصل بينها فاصلة ,)..."
            value={searchQuery ?? ""}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-rose-500 transition-colors text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranch ?? ""}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent focus:outline-none text-sm font-bold text-slate-700"
            >
              <option value="all">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedDepartment ?? ""}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-transparent focus:outline-none text-sm font-bold text-slate-700"
              title="تصفية بالقسم"
            >
              <option value="all">كل الأقسام</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="text-rose-600 font-bold text-lg">
              {filteredRecords.length}
            </div>
            <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
              عدد البصمات
            </div>
            <div className="text-rose-300 font-bold text-xl">#</div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent focus:outline-none text-sm font-bold text-slate-700"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  سنة {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent focus:outline-none text-sm font-bold text-slate-700"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  شهر {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 p-6 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-auto max-h-[calc(100vh-260px)] min-h-[420px] relative">
            <table className="w-full text-right border-collapse min-w-[1400px] sticky-cols">
              <thead className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 shadow-xs">
                <tr className="bg-slate-50">
                  {/* Sticky-right column: كود الموظف (pinned right: 0) */}
                  <th
                    className="sticky-col p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-tr-3xl sticky top-0 border-l border-slate-200/80"
                    style={{ minWidth: '120px', width: '120px', right: '0px', zIndex: 40 }}
                  >
                    كود الموظف
                  </th>
                  {/* Sticky-right column: بيانات الموظف (pinned right: 120px with divider shadow) */}
                  <th
                    className="sticky-col p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 border-l border-slate-200 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.08)]"
                    style={{ minWidth: '220px', width: '220px', right: '120px', zIndex: 40 }}
                  >
                    بيانات الموظف
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    التاريخ
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    اليوم
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    الحالة
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    الوردية
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center bg-slate-50">
                    الحضور
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center bg-slate-50">
                    الانصراف
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center bg-slate-50">
                    ساعات العمل
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center bg-slate-50">
                    التأخير
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center bg-slate-50">
                    الوقت الإضافي
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center bg-slate-50">
                    الجزاء المالي
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center print:hidden bg-slate-50 rounded-tl-3xl">
                    إدارة
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    {/* Sticky-right cell: كود الموظف */}
                    <td
                      className="sticky-col p-4 text-center bg-white sticky border-l border-slate-100 group-hover:bg-slate-50"
                      style={{ minWidth: '120px', width: '120px', right: '0px', zIndex: 20 }}
                    >
                      <span className="font-mono font-bold text-indigo-600 text-sm">
                        {record.fingerprint_code || "—"}
                      </span>
                    </td>
                    {/* Sticky-right cell: بيانات الموظف */}
                    <td
                      className="sticky-col p-4 bg-white sticky border-l border-slate-100 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.08)] group-hover:bg-slate-50"
                      style={{ minWidth: '220px', width: '220px', right: '120px', zIndex: 20 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold print:hidden">
                          {(record.employee_name || "م").charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {record.employee_name || "موظف مجهول"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">
                      {formatDate(record.date)}
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">
                      {(() => {
                        const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
                        try {
                          const d = new Date(record.date);
                          return days[d.getDay()] || "—";
                        } catch { return "—"; }
                      })()}
                    </td>
                    <td className="p-4 text-center">
                      {(() => {
                        // Check if this record's date is on the employee's weekly off-day
                        const offDays = employeeOffDaysMap[record.employee_id] || [];
                        const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                        let isOffDay = false;
                        try {
                          const d = new Date(record.date);
                          isOffDay = offDays.includes(DAY_NAMES[d.getDay()]);
                        } catch {}

                        if (isOffDay) {
                          return (
                            <span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              حضور إجازة
                            </span>
                          );
                        }
                        return (
                          <span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                            عادي
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                          record.shift_name === "بصمة مجهولة"
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : "bg-purple-50 text-purple-600 border border-purple-100"
                        }`}
                      >
                        {record.shift_name}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center justify-center gap-0.5">
                        <div className="inline-flex items-center justify-center px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 font-mono text-xs font-bold print:border-none print:bg-transparent">
                          {formatTime(record.check_in)}
                        </div>
                        {record.check_in && (
                          <span className="text-[10px] text-slate-400 font-medium font-mono">
                            {getPunchDate(record.check_in, record.date)}
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          {record.check_in_photo && (
                            <button
                              onClick={() => setPreviewPhotoModal({ photo: record.check_in_photo!, title: `سيلفي حضور - ${record.employee_name}`, date: record.date })}
                              className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded text-[10px] font-bold flex items-center gap-1"
                              title="عرض صورة بصمة السيلفي"
                            >
                              📸 سيلفي
                            </button>
                          )}
                          {(record.check_in_lat && record.check_in_lng) || record.check_in_location ? (
                            <a
                              href={record.check_in_lat && record.check_in_lng ? `https://www.google.com/maps?q=${record.check_in_lat},${record.check_in_lng}` : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[10px] font-bold flex items-center gap-0.5"
                              title={record.check_in_location || "موقع GPS"}
                            >
                              📍 خريطة
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center justify-center gap-0.5">
                        <div className="inline-flex items-center justify-center px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 font-mono text-xs font-bold print:border-none print:bg-transparent">
                          {formatTime(record.check_out)}
                        </div>
                        {record.check_out && (
                          <span className="text-[10px] text-slate-400 font-medium font-mono">
                            {getPunchDate(record.check_out, record.date)}
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          {record.check_out_photo && (
                            <button
                              onClick={() => setPreviewPhotoModal({ photo: record.check_out_photo!, title: `سيلفي انصراف - ${record.employee_name}`, date: record.date })}
                              className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded text-[10px] font-bold flex items-center gap-1"
                              title="عرض صورة بصمة السيلفي"
                            >
                              📸 سيلفي
                            </button>
                          )}
                          {(record.check_out_lat && record.check_out_lng) || record.check_out_location ? (
                            <a
                              href={record.check_out_lat && record.check_out_lng ? `https://www.google.com/maps?q=${record.check_out_lat},${record.check_out_lng}` : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[10px] font-bold flex items-center gap-0.5"
                              title={record.check_out_location || "موقع GPS"}
                            >
                              📍 خريطة
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center justify-center px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-mono text-xs font-bold print:border-none print:bg-transparent">
                        {Number(record.work_hours).toFixed(1)}س
                      </div>
                    </td>
                    <td className="p-4 text-center text-sm font-bold text-rose-600">
                      {record.delay_minutes > 0
                        ? `${record.delay_minutes}د`
                        : "-"}
                    </td>
                    <td className="p-4 text-center text-sm font-bold text-emerald-600">
                      {formatOvertime(record.overtime)}
                    </td>
                    <td className="p-4 text-center text-sm font-bold text-red-600">
                      {record.penalty > 0
                        ? `${Math.round(record.penalty)} ج.م`
                        : "-"}
                    </td>
                    <td className="p-4 print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedRecord(record);
                            setShowPenaltyModal(true);
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors bg-red-50/30"
                          title="إضافة جزاء"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRecord(record);
                            setEditData({
                              date: formatDate(record.date),
                              check_in: formatTimeForInput(record.check_in),
                              check_out: formatTimeForInput(record.check_out),
                            });
                            setShowEditModal(true);
                          }}
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-colors bg-blue-50/30"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-2 hover:bg-rose-50 rounded-lg text-rose-400 hover:text-rose-600 transition-colors bg-rose-50/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRecords.length === 0 && (
              <div className="p-20 text-center text-slate-400">
                <Fingerprint className="w-20 h-20 mx-auto mb-4 opacity-10" />
                <p className="text-lg font-bold">
                  لا توجد سجلات بصمة لهذا الشهر
                </p>
                <p className="text-sm">
                  جرب تغيير الفلاتر أو البحث عن موظف آخر
                </p>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredRecords.length > 0 && (
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="font-bold">عرض</span>
                  <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs">
                    {(currentPage - 1) * RECORDS_PER_PAGE + 1}
                  </span>
                  <span>إلى</span>
                  <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs">
                    {Math.min(currentPage * RECORDS_PER_PAGE, filteredRecords.length)}
                  </span>
                  <span>من</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                    {filteredRecords.length}
                  </span>
                  <span>سجل</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* First Page */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="الصفحة الأولى"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                  {/* Previous Page */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Page Numbers */}
                  {(() => {
                    const pages: number[] = [];
                    let startP = Math.max(1, currentPage - 2);
                    let endP = Math.min(totalPages, currentPage + 2);
                    if (currentPage <= 3) endP = Math.min(totalPages, 5);
                    if (currentPage >= totalPages - 2) startP = Math.max(1, totalPages - 4);
                    for (let i = startP; i <= endP; i++) pages.push(i);
                    return pages.map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                          page === currentPage
                            ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                            : "border border-slate-200 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        {page}
                      </button>
                    ));
                  })()}

                  {/* Next Page */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {/* Last Page */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="الصفحة الأخيرة"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-sm text-slate-500 font-bold">
                    صفحة {currentPage} من {totalPages}
                  </div>

                  {/* Page size selector - lets the user pick how many records to show per page */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-slate-500 font-bold">سجلات لكل صفحة</span>
                    <select
                      value={recordsPerPage ?? ""}
                      onChange={(e) => setRecordsPerPage(parseInt(e.target.value))}
                      className="bg-transparent focus:outline-none text-sm font-bold text-slate-700 cursor-pointer"
                      title="عدد السجلات المعروضة في كل صفحة"
                    >
                      {RECORDS_PER_PAGE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {previewPhotoModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-emerald-400">{previewPhotoModal.title}</h3>
                {previewPhotoModal.date && <p className="text-[11px] text-slate-400">{previewPhotoModal.date}</p>}
              </div>
              <button
                onClick={() => setPreviewPhotoModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-full bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-black/60 rounded-b-2xl" style={{ perspective: "1200px" }}>
              <div className="relative group preserve-3d max-w-full flex justify-center">
                {/* 3D Glow Effect */}
                <div className="absolute -inset-2 bg-gradient-to-tr from-cyan-500/40 via-blue-500/30 to-indigo-500/40 rounded-3xl blur-2xl opacity-80" />
                <img
                  src={previewPhotoModal.photo}
                  alt="Selfie"
                  className="relative z-10 w-full max-h-[68vh] object-contain rounded-2xl border-2 border-cyan-400/50 shadow-[0_25px_60px_-10px_rgba(0,0,0,0.9),0_0_35px_rgba(34,211,238,0.4)] transition-transform duration-500 hover:scale-[1.03]"
                  style={{
                    transform: "rotateX(8deg) rotateY(-6deg) translateZ(30px)",
                    transformStyle: "preserve-3d",
                  }}
                />
              </div>
            </div>
            <div className="p-3 bg-slate-950 text-center text-xs text-slate-400">
              بصمة سيلفي حية مسجلة عبر تطبيق الهاتف الذكي
            </div>
          </div>
        </div>
      )}

      {showManualAdd && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                إضافة بصمة يدوية
              </h2>
              <button
                onClick={() => setShowManualAdd(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <AlertCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  كود البصمة
                </label>
                <input
                  type="text"
                  required
                  value={manualData.fingerprint_code ?? ""}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      fingerprint_code: e.target.value,
                    })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="أدخل كود البصمة الخاص بالموظف"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  التاريخ والوقت
                </label>
                <input
                  type="datetime-local"
                  required
                  value={manualData.timestamp ?? ""}
                  onChange={(e) =>
                    setManualData({ ...manualData, timestamp: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  نوع الحركة
                </label>
                <select
                  required
                  value={manualData.type ?? ""}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      type: e.target.value as "check_in" | "check_out",
                    })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="check_in">حضور (Check In)</option>
                  <option value="check_out">انصراف (Check Out)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualAdd(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    !manualData.fingerprint_code || !manualData.timestamp
                  }
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  حفظ البصمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    تعديل سجل البصمة
                  </h2>
                  <p className="text-xs text-slate-500">
                    للموظف: {selectedRecord?.employee_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleEditRecord} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    required
                    value={editData.date ?? ""}
                    onChange={(e) =>
                      setEditData({ ...editData, date: e.target.value })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      وقت الحضور
                    </label>
                    <input
                      type="time"
                      value={editData.check_in ?? ""}
                      onChange={(e) =>
                        setEditData({ ...editData, check_in: e.target.value })
                      }
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      وقت الانصراف
                    </label>
                    <input
                      type="time"
                      value={editData.check_out ?? ""}
                      onChange={(e) =>
                        setEditData({ ...editData, check_out: e.target.value })
                      }
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updating && <RefreshCw className="w-4 h-4 animate-spin" />}
                    تحديث البيانات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Penalty Modal */}
      <AnimatePresence>
        {showPenaltyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPenaltyModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    تطبيق جزاء مالي
                  </h2>
                  <p className="text-xs text-slate-500">
                    للموظف: {selectedRecord?.employee_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowPenaltyModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {penaltyPolicies.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    لا توجد بنود في لائحة الجزاءات حالياً. يرجى إضافتها من شاشة
                    الموارد البشرية.
                  </div>
                ) : (
                  penaltyPolicies.map((policy) => (
                    <button
                      key={policy.id}
                      onClick={() => handleApplyPenalty(policy.id)}
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-red-50 hover:border-red-200 transition-all text-right group"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {policy.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {policy.type === "amount"
                                ? "خصم مالي مباشر"
                                : policy.type === "days"
                                  ? "خصم أيام عمل"
                                  : "خصم ساعات عمل"}
                              {" • "}
                              {policy.category === "delay"
                                ? "تأخير"
                                : policy.category === "absence"
                                  ? "غياب"
                                  : policy.category === "early_leave"
                                    ? "انصراف مبكر"
                                    : policy.category === "missing_punch"
                                      ? "نسيان بصمة"
                                      : "يدوي / عام"}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-lg font-bold text-red-600">
                            {policy.amount}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            {policy.type === "amount"
                              ? "ج.م"
                              : policy.type === "days"
                                ? "يوم"
                                : "ساعة"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="p-6 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setShowPenaltyModal(false)}
                  className="px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AttendanceReportView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Default to current month
  const now = new Date();
  const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDayStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState<string>(firstDayStr);
  const [endDate, setEndDate] = useState<string>(lastDayStr);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Report tab
  type ReportTab = "detailed" | "monthly_summary" | "delays" | "missing_punches" | "absences" | "overtime";
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("detailed");

  // Filter options
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(["all"]);

  // Fetch branches, departments and employees
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [bRes, dRes, eRes] = await Promise.all([
          api.get("/api/branches"),
          api.get("/api/hr/departments"),
          api.get("/api/hr/employees"),
        ]);
        if (bRes.ok) {
          const bData = await bRes.json();
          setBranches(Array.isArray(bData) ? bData : []);
        }
        if (dRes.ok) {
          const dData = await dRes.json();
          setDepartments(Array.isArray(dData) ? dData : []);
        }
        if (eRes.ok) {
          const eData = await eRes.json();
          setEmployeesList(Array.isArray(eData) ? eData : []);
        }
      } catch (err) {
        console.error("Failed to load metadata for reports", err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (selectedBranch !== "all") params.append("branch", selectedBranch);

        const res = await api.get(`/api/attendance?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          setData(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.error("Failed to fetch attendance report data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReportData();
  }, [startDate, endDate, selectedBranch]);

  // Quick preset dates
  const handleQuickPreset = (type: "today" | "week" | "month" | "last_month") => {
    const today = new Date();
    if (type === "today") {
      const d = today.toISOString().split("T")[0];
      setStartDate(d);
      setEndDate(d);
    } else if (type === "week") {
      const day = today.getDay();
      const diffToSat = (day + 1) % 7;
      const sat = new Date(today);
      sat.setDate(today.getDate() - diffToSat);
      setStartDate(sat.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    } else if (type === "month") {
      setStartDate(firstDayStr);
      setEndDate(lastDayStr);
    } else if (type === "last_month") {
      const prevMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0];
      const prevMonthLast = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
      setStartDate(prevMonthFirst);
      setEndDate(prevMonthLast);
    }
  };

  const isAllEmpsSelected = selectedEmpIds.length === 0 || selectedEmpIds.includes("all");
  const parsedSearchTerms = searchQuery
    ? searchQuery.split(/[,+\n;|\t]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const matchesMultiEmpFilter = (empName?: string, fingerprintCode?: any, empId?: any, deptName?: string) => {
    if (!isAllEmpsSelected) {
      const idStr = String(empId || "");
      if (!selectedEmpIds.includes(idStr)) return false;
    }

    if (parsedSearchTerms.length > 0) {
      const name = (empName || "").toLowerCase();
      const code = String(fingerprintCode || "").toLowerCase();
      const id = String(empId || "").toLowerCase();
      const dept = (deptName || "").toLowerCase();

      const matched = parsedSearchTerms.some(
        (t) => name.includes(t) || code.includes(t) || id.includes(t) || dept.includes(t)
      );
      if (!matched) return false;
    }

    return true;
  };

  // Filter records locally and sort by employee name and date sequentially
  const filteredRecords = data
    .filter((record) => {
      if (!matchesMultiEmpFilter(record.employee_name, record.fingerprint_code, record.employee_id, record.department_name)) {
        return false;
      }

      if (selectedDepartment !== "all") {
        if (String((record as any).department_id) !== String(selectedDepartment) && record.department_name !== selectedDepartment) {
          return false;
        }
      }

      if (selectedStatus !== "all") {
        if (selectedStatus === "incomplete") {
          if (record.check_in && record.check_out) return false;
        } else if (record.status !== selectedStatus) {
          return false;
        }
      }

      if (activeReportTab === "delays") {
        return (record.delay_minutes && record.delay_minutes > 0) || record.status === "late";
      }
      if (activeReportTab === "missing_punches") {
        return !record.check_in || !record.check_out;
      }
      if (activeReportTab === "absences") {
        return record.status === "absent";
      }
      if (activeReportTab === "overtime") {
        return record.overtime && record.overtime > 0;
      }

      return true;
    })
    .sort((a, b) => {
      const nameComp = (a.employee_name || "").localeCompare(b.employee_name || "", "ar");
      if (nameComp !== 0) return nameComp;
      return (a.date || "").localeCompare(b.date || "");
    });

  // Calculate Monthly Summaries per employee
  const monthlySummaries = React.useMemo(() => {
    const map = new Map<string, any>();
    data.forEach((rec) => {
      if (selectedDepartment !== "all" && String(rec.department_id) !== String(selectedDepartment) && rec.department_name !== selectedDepartment) {
        return;
      }
      if (!matchesMultiEmpFilter(rec.employee_name, rec.fingerprint_code, rec.employee_id, rec.department_name)) {
        return;
      }

      const key = rec.employee_id || rec.fingerprint_code || rec.employee_name;
      if (!map.has(key)) {
        map.set(key, {
          employee_id: rec.employee_id,
          employee_name: rec.employee_name,
          fingerprint_code: rec.fingerprint_code,
          branch_name: rec.branch_name || "-",
          department_name: rec.department_name || "-",
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          totalDelayMinutes: 0,
          totalWorkHours: 0,
          totalOvertime: 0,
          totalPenalty: 0,
          missingPunches: 0,
        });
      }
      const item = map.get(key);
      item.totalDays += 1;
      if (rec.status === "present" || rec.check_in) item.presentDays += 1;
      if (rec.status === "absent") item.absentDays += 1;
      if (rec.delay_minutes && rec.delay_minutes > 0) {
        item.lateDays += 1;
        item.totalDelayMinutes += Number(rec.delay_minutes);
      }
      if (rec.work_hours) item.totalWorkHours += Number(rec.work_hours);
      if (rec.overtime) item.totalOvertime += Number(rec.overtime);
      if (rec.penalty) item.totalPenalty += Number(rec.penalty);
      if (!rec.check_in || !rec.check_out) item.missingPunches += 1;
    });

    return Array.from(map.values());
  }, [data, selectedDepartment, searchQuery, selectedEmpIds]);

  // Overall KPI statistics
  const stats = React.useMemo(() => {
    const totalRecords = data.length;
    const presentCount = data.filter((r) => r.status === "present" || r.check_in).length;
    const absentCount = data.filter((r) => r.status === "absent").length;
    const lateCount = data.filter((r) => (r.delay_minutes && r.delay_minutes > 0) || r.status === "late").length;
    const missingCount = data.filter((r) => !r.check_in || !r.check_out).length;
    const totalWorkHours = data.reduce((acc, r) => acc + (Number(r.work_hours) || 0), 0);
    const totalDelayMinutes = data.reduce((acc, r) => acc + (Number(r.delay_minutes) || 0), 0);
    const totalOvertime = data.reduce((acc, r) => acc + (Number(r.overtime) || 0), 0);
    const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    return {
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      missingCount,
      totalWorkHours: totalWorkHours.toFixed(1),
      totalDelayMinutes,
      totalOvertime: totalOvertime.toFixed(1),
      attendanceRate,
    };
  }, [data]);

  // Format Time Helper
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "--:--";
    let hours = 0;
    let minutes = 0;
    if (timeStr.includes("T")) {
      const parts = timeStr.split("T")[1]?.split(":");
      if (parts && parts.length >= 2) {
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
      }
    } else if (timeStr.includes(" ")) {
      const parts = timeStr.split(" ")[1]?.split(":");
      if (parts && parts.length >= 2) {
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
      }
    } else if (timeStr.includes(":")) {
      const parts = timeStr.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    }
    // 24-hour display format (HH:mm) — no AM/PM suffix
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = () => {
    if (activeReportTab === "monthly_summary") {
      if (monthlySummaries.length === 0) return;
      const exportRows = monthlySummaries.map((item) => ({
        "اسم الموظف": item.employee_name,
        "كود البصمة": item.fingerprint_code,
        الفرع: item.branch_name,
        القسم: item.department_name,
        "إجمالي الأيام": item.totalDays,
        "أيام الحضور": item.presentDays,
        "أيام الغياب": item.absentDays,
        "أيام التأخير": item.lateDays,
        "مجموع دقائق التأخير": item.totalDelayMinutes,
        "إجمالي ساعات العمل": item.totalWorkHours.toFixed(1),
        "ساعات الإضافي": item.totalOvertime.toFixed(1),
        "إجمالي الجزاءات": item.totalPenalty,
        "بصمات ناقصة": item.missingPunches,
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly_Attendance_Summary");
      XLSX.writeFile(wb, `Monthly_Attendance_Summary_${startDate}_to_${endDate}.xlsx`);
    } else {
      if (filteredRecords.length === 0) return;
      const exportRows = filteredRecords.map((r) => ({
        "اسم الموظف": r.employee_name,
        "كود البصمة": r.fingerprint_code,
        الفرع: r.branch_name || "-",
        القسم: r.department_name || "-",
        التاريخ: r.date,
        الوردية: r.shift_name,
        "وقت الدخول": formatTime(r.check_in),
        "وقت الخروج": formatTime(r.check_out),
        "ساعات العمل": r.work_hours || 0,
        "دقائق التأخير": r.delay_minutes || 0,
        "ساعات الإضافي": r.overtime || 0,
        الجزاء: r.penalty || 0,
        الحالة:
          r.status === "present"
            ? "حاضر"
            : r.status === "absent"
            ? "غائب"
            : r.status === "late"
            ? "متأخر"
            : r.status,
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Attendance_${activeReportTab}`);
      XLSX.writeFile(wb, `Attendance_Report_${activeReportTab}_${startDate}_to_${endDate}.xlsx`);
    }
  };

  const getTabTitle = () => {
    switch (activeReportTab) {
      case "detailed":
        return "سجل الحضور والانصراف التفصيلي";
      case "monthly_summary":
        return "ملخص كشف الحضور والغياب الشهري للموظفين";
      case "delays":
        return "تقرير التأخيرات والانصراف المبكر";
      case "missing_punches":
        return "تقرير البصمات الناقصة والأحادية (بدون خروج أو دخول)";
      case "absences":
        return "تقرير الغياب والانقطاع عن العمل";
      case "overtime":
        return "تقرير ساعات العمل الإضافية";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/80 p-4 md:p-6 space-y-6 overflow-y-auto" dir="rtl">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-white rounded-xl shadow-2xs border border-slate-200/80 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
            title="رجوع"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-[#2b5c8f]" />
              <span>تقارير الحضور والانصراف الشاملة</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              استخراج وتحليل تقارير البصمة، التأخيرات، والغياب وساعات العمل الإضافية
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-xl border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-2xs text-xs font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة التقرير</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2b5c8f] hover:bg-[#20446a] text-white rounded-xl transition-all shadow-2xs text-xs font-bold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">إجمالي السجلات</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg font-mono font-black text-slate-900">{stats.totalRecords}</p>
          <span className="text-[10px] font-bold text-slate-400">سجل محمل</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold">نسبة الحضور</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-mono font-black text-emerald-700">{stats.attendanceRate}%</p>
          <span className="text-[10px] font-bold text-emerald-600">{stats.presentCount} حالة حضور</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold">حالات التأخير</span>
            <Clock3 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-mono font-black text-amber-800">{stats.lateCount}</p>
          <span className="text-[10px] font-bold text-amber-600">({stats.totalDelayMinutes} دقيقة تأخير)</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold">حالات الغياب</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg font-mono font-black text-rose-800">{stats.absentCount}</p>
          <span className="text-[10px] font-bold text-rose-600">بدون عذر</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-orange-100 bg-orange-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-orange-700">
            <span className="text-xs font-bold">بصمات ناقصة</span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-lg font-mono font-black text-orange-800">{stats.missingCount}</p>
          <span className="text-[10px] font-bold text-orange-600">بدون دخول/خروج</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-bold">ساعات الإضافي</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg font-mono font-black text-indigo-800">{stats.totalOvertime}</p>
          <span className="text-[10px] font-bold text-indigo-600">ساعة عمل زائدة</span>
        </div>
      </div>

      {/* 3. Navigation Report Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto print:hidden text-xs font-bold">
        <button
          onClick={() => setActiveReportTab("detailed")}
          className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeReportTab === "detailed"
              ? "bg-[#2b5c8f] text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>السجل التفصيلي اليومي</span>
        </button>

        <button
          onClick={() => setActiveReportTab("monthly_summary")}
          className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeReportTab === "monthly_summary"
              ? "bg-[#2b5c8f] text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ملخص الحضور الشهري</span>
        </button>

        <button
          onClick={() => setActiveReportTab("delays")}
          className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeReportTab === "delays"
              ? "bg-[#2b5c8f] text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock3 className="w-4 h-4 text-amber-400" />
          <span>التأخيرات والانصراف المبكر</span>
        </button>

        <button
          onClick={() => setActiveReportTab("missing_punches")}
          className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeReportTab === "missing_punches"
              ? "bg-[#2b5c8f] text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span>البصمات الناقصةالأحادية</span>
        </button>

        <button
          onClick={() => setActiveReportTab("absences")}
          className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeReportTab === "absences"
              ? "bg-[#2b5c8f] text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <UserX className="w-4 h-4 text-rose-400" />
          <span>تقرير الغياب والانقطاع</span>
        </button>

        <button
          onClick={() => setActiveReportTab("overtime")}
          className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeReportTab === "overtime"
              ? "bg-[#2b5c8f] text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>ساعات الإضافي</span>
        </button>
      </div>

      {/* 4. Filter Panel */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 print:hidden">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">البحث واختيار الموظفين (يدعم اختيار أكثر من موظف والبحث بالاسم/الكود)</label>
          <MultiEmployeeSearchFilter
            employees={employeesList}
            selectedEmployeeIds={selectedEmpIds}
            onSelectionChange={setSelectedEmpIds}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            placeholder="بحث متعدد بأسماء الموظفين أو كود البصمة (تفصل بينها فاصلة)..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-bold pt-2">
          {/* Date From */}
          <div className="space-y-1">
            <label className="text-slate-600">من تاريخ</label>
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]/20 transition-all"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-slate-600">إلى تاريخ</label>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]/20 transition-all"
            />
          </div>

          {/* Branch */}
          <div className="space-y-1">
            <label className="text-slate-600">الفرع</label>
            <select
              value={selectedBranch ?? ""}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]/20 transition-all cursor-pointer"
            >
              <option value="all">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="text-slate-600">القسم</label>
            <select
              value={selectedDepartment ?? ""}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]/20 transition-all cursor-pointer"
            >
              <option value="all">كل الأقسام</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id || d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick presets row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-500">
            <span>تحديد سريع للفترة:</span>
            <button
              onClick={() => handleQuickPreset("today")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              اليوم
            </button>
            <button
              onClick={() => handleQuickPreset("week")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              هذا الأسبوع
            </button>
            <button
              onClick={() => handleQuickPreset("month")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => handleQuickPreset("last_month")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              الشهر السابق
            </button>
          </div>

          {/* Additional Status Filter */}
          <div className="flex items-center gap-2 font-bold">
            <span className="text-slate-500">حالة الحضور:</span>
            <select
              value={selectedStatus ?? ""}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1 font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">جميع الحالات</option>
              <option value="present">حاضر فقط</option>
              <option value="late">متأخر فقط</option>
              <option value="absent">غائب فقط</option>
              <option value="incomplete">بصمة ناقصة (بدون خروج)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Main Report View Section */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200/80 shadow-2xs font-bold">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#2b5c8f] mb-3" />
          <span>جاري معالجة واستخراج تقارير الحضور...</span>
        </div>
      ) : activeReportTab === "monthly_summary" ? (
        /* Monthly Employee Summary View */
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs print:hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2b5c8f]" />
              <span>ملخص كشف الحضور والغياب الشهري للموظفين ({monthlySummaries.length} موظف)</span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">كود البصمة</th>
                  <th className="p-3">الفرع</th>
                  <th className="p-3">القسم</th>
                  <th className="p-3 text-center bg-blue-50/60 text-blue-900">أيام العمل</th>
                  <th className="p-3 text-center bg-emerald-50/60 text-emerald-900">أيام الحضور</th>
                  <th className="p-3 text-center bg-rose-50/60 text-rose-900">أيام الغياب</th>
                  <th className="p-3 text-center bg-amber-50/60 text-amber-900">أيام التأخير</th>
                  <th className="p-3 text-center bg-amber-50/60 text-amber-900">دقائق التأخير</th>
                  <th className="p-3 text-center bg-indigo-50/60 text-indigo-900">ساعات العمل</th>
                  <th className="p-3 text-center bg-indigo-50/60 text-indigo-900">الإضافي</th>
                  <th className="p-3 text-center bg-orange-50/60 text-orange-900">بصمات ناقصة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {monthlySummaries.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-black text-slate-900">{item.employee_name}</td>
                    <td className="p-3 font-mono">{item.fingerprint_code || "-"}</td>
                    <td className="p-3">{item.branch_name}</td>
                    <td className="p-3">{item.department_name}</td>
                    <td className="p-3 text-center font-mono font-bold bg-blue-50/30">{item.totalDays}</td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30">{item.presentDays}</td>
                    <td className="p-3 text-center font-mono font-bold text-rose-700 bg-rose-50/30">{item.absentDays}</td>
                    <td className="p-3 text-center font-mono font-bold text-amber-700 bg-amber-50/30">{item.lateDays}</td>
                    <td className="p-3 text-center font-mono text-amber-800 bg-amber-50/30">{item.totalDelayMinutes} د</td>
                    <td className="p-3 text-center font-mono font-black text-indigo-800 bg-indigo-50/30">{item.totalWorkHours.toFixed(1)} س</td>
                    <td className="p-3 text-center font-mono text-indigo-700 bg-indigo-50/30">{item.totalOvertime.toFixed(1)} س</td>
                    <td className="p-3 text-center font-mono text-orange-700 bg-orange-50/30">{item.missingPunches}</td>
                  </tr>
                ))}
                {monthlySummaries.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-10 text-center text-slate-400">
                      لا توجد سجلات تطابق البحث أو الفلاتر المحددة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed / Delays / Missing / Absence / Overtime Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs print:hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2b5c8f]" />
              <span>{getTabTitle()} ({filteredRecords.length} سجل)</span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">كود البصمة</th>
                  <th className="p-3">الفرع والقسم</th>
                  <th className="p-3">الوردية</th>
                  <th className="p-3 text-center">وقت الدخول</th>
                  <th className="p-3 text-center">وقت الخروج</th>
                  <th className="p-3 text-center">ساعات العمل</th>
                  <th className="p-3 text-center">التأخير</th>
                  <th className="p-3 text-center">الإضافي</th>
                  <th className="p-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredRecords.map((r, idx) => {
                  const isLate = (r.delay_minutes && r.delay_minutes > 0) || r.status === "late";
                  const isAbsent = r.status === "absent";
                  const isMissing = !r.check_in || !r.check_out;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{r.date}</td>
                      <td className="p-3 font-black text-slate-900">{r.employee_name}</td>
                      <td className="p-3 font-mono">{r.fingerprint_code || "-"}</td>
                      <td className="p-3">
                        <div className="text-[11px] text-slate-800">{r.branch_name || "-"}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{r.department_name || "-"}</div>
                      </td>
                      <td className="p-3 text-slate-600">{r.shift_name || "-"}</td>
                      <td className="p-3 text-center font-mono text-slate-800">
                        {r.check_in ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200/80 text-xs font-bold">
                              {formatTime(r.check_in)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {getPunchDate(r.check_in, r.date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-rose-500 font-normal">--:-- (مفقودة)</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-800">
                        {r.check_out ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-200/80 text-xs font-bold">
                              {formatTime(r.check_out)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {getPunchDate(r.check_out, r.date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-rose-500 font-normal">--:-- (مفقودة)</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-black text-slate-900">
                        {r.work_hours ? `${r.work_hours} س` : "0 س"}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {r.delay_minutes && r.delay_minutes > 0 ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold">
                            {r.delay_minutes} دقيقة
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {r.overtime && r.overtime > 0 ? (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold">
                            +{r.overtime} س
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isAbsent ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                            غائب
                          </span>
                        ) : isMissing ? (
                          <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full font-bold text-[10px]">
                            بصمة ناقصة
                          </span>
                        ) : isLate ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                            متأخر
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                            حاضر
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-10 text-center text-slate-400">
                      لا توجد سجلات تطابق البحث أو الفلاتر المحددة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Printable Report Document */}
      <PrintableReport
        title={getTabTitle()}
        subtitle={`الفترة: من ${startDate || "البداية"} إلى ${endDate || "النهاية"} | عدد السجلات: ${
          activeReportTab === "monthly_summary" ? monthlySummaries.length : filteredRecords.length
        }`}
      >
        {activeReportTab === "monthly_summary" ? (
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الموظف</th>
                <th>كود البصمة</th>
                <th>الفرع</th>
                <th>القسم</th>
                <th>أيام العمل</th>
                <th>الحضور</th>
                <th>الغياب</th>
                <th>أيام التأخير</th>
                <th>دقائق التأخير</th>
                <th>ساعات العمل</th>
                <th>الإضافي</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummaries.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.employee_name}</td>
                  <td>{item.fingerprint_code || "-"}</td>
                  <td>{item.branch_name}</td>
                  <td>{item.department_name}</td>
                  <td>{item.totalDays}</td>
                  <td>{item.presentDays}</td>
                  <td>{item.absentDays}</td>
                  <td>{item.lateDays}</td>
                  <td>{item.totalDelayMinutes} د</td>
                  <td>{item.totalWorkHours.toFixed(1)} س</td>
                  <td>{item.totalOvertime.toFixed(1)} س</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ</th>
                <th>اسم الموظف</th>
                <th>كود البصمة</th>
                <th>الفرع/القسم</th>
                <th>وقت الدخول</th>
                <th>وقت الخروج</th>
                <th>ساعات العمل</th>
                <th>التأخير</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{r.date}</td>
                  <td>{r.employee_name}</td>
                  <td>{r.fingerprint_code || "-"}</td>
                  <td>{r.branch_name || "-"} - {r.department_name || "-"}</td>
                  <td>
                    {r.check_in ? (
                      <div className="flex flex-col items-center">
                        <span>{formatTime(r.check_in)}</span>
                        <span className="text-[9px] text-slate-500">{getPunchDate(r.check_in, r.date)}</span>
                      </div>
                    ) : "مفقودة"}
                  </td>
                  <td>
                    {r.check_out ? (
                      <div className="flex flex-col items-center">
                        <span>{formatTime(r.check_out)}</span>
                        <span className="text-[9px] text-slate-500">{getPunchDate(r.check_out, r.date)}</span>
                      </div>
                    ) : "مفقودة"}
                  </td>
                  <td>{r.work_hours || 0} س</td>
                  <td>{r.delay_minutes || 0} د</td>
                  <td>
                    {r.status === "present"
                      ? "حاضر"
                      : r.status === "absent"
                      ? "غائب"
                      : r.status === "late"
                      ? "متأخر"
                      : r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintableReport>
    </div>
  );
};
