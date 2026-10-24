import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Fingerprint,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Globe,
  MapPin,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Search,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  Sparkles,
  Calculator,
  RotateCcw,
  Sliders,
  Check,
  User,
  Info,
  X,
  Camera
} from "lucide-react";
import useSWR, { mutate } from "swr";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

const fetcher = (url: string) => api.get(url).then((res) => res.json());

interface Device {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  is_active: number;
  branch_id: number | null;
  last_sync: string | null;
  device_type?: 'zkteco' | 'hikvision';
  protocol?: 'tcp' | 'http' | 'https';
  username?: string | null;
  password?: string | null;
}

interface Employee {
  id: number;
  name: string;
  fingerprint_code: string | null;
  department_id: number | null;
  branch_id: number | null;
  status: string;
  shifts?: number[];
}

interface Branch {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

interface AttendanceLog {
  id: string; // Composite key (id-in, id-out, id-raw) or temp key
  dbId: number | null; // Null for temp rows
  employee_id: number;
  employee_name: string;
  fingerprint_code: string;
  department_id: number | null;
  department_name: string;
  branch_id: number | null;
  branch_name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: "حضور" | "انصراف" | "" | string;
  requestor: string;
  temperature: string;
  isNew?: boolean;
  photo?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  punch_time?: string | null;
}

interface SearchableEmployeeSelectProps {
  value: number;
  onChange: (val: number) => void;
  employees: Employee[] | undefined;
}

function SearchableEmployeeSelect({ value, onChange, employees }: SearchableEmployeeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = employees?.find((e) => e.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase().trim();
    return employees.filter(
      (e) =>
        String(e.name || "").toLowerCase().includes(term) ||
        (e.fingerprint_code && String(e.fingerprint_code).toLowerCase().includes(term)) ||
        e.id.toString().includes(term)
    );
  }, [employees, searchTerm]);

  return (
    <div ref={dropdownRef} className="relative w-full text-right" dir="rtl">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm("");
        }}
        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#2b5c8f]/20 focus:border-[#2b5c8f] text-right flex items-center justify-between gap-1.5 text-xs font-semibold hover:border-slate-400 transition-colors"
      >
        <span className="truncate">
          {selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.fingerprint_code || selectedEmployee.id})` : "اختر الموظف (ابحث بالاسم أو الكود)..."}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-hidden p-2 flex flex-col gap-1.5">
          <div className="relative">
            <Search className="absolute right-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchTerm ?? ""}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم أو كود البصمة..."
              className="w-full pr-7 pl-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]/20 focus:border-[#2b5c8f] text-right"
            />
          </div>
          <div className="overflow-y-auto max-h-48 flex flex-col gap-1 pr-0.5">
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">لا توجد نتائج مطابقة</div>
            ) : (
              filteredEmployees.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onChange(e.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-right px-2.5 py-2 text-xs rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    value === e.id ? "bg-[#2b5c8f]/10 text-[#2b5c8f] font-bold" : "text-slate-700"
                  }`}
                >
                  <span className="truncate font-semibold">{e.name}</span>
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    كود: {e.fingerprint_code || e.id}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const safeGetTimeStr = (val: any): string | null => {
  if (!val) return null;
  try {
    const str = String(val).trim();
    // If already HH:MM format
    if (/^\d{2}:\d{2}$/.test(str)) return str;
    // If HH:MM:SS format
    if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str.substring(0, 5);
    
    // Match HH:MM out of YYYY-MM-DD HH:MM:SS or ISO string
    const match = str.match(/(?:T|\s)(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }

    // Try Date parser
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours().toString().padStart(2, "0");
      const minutes = d.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    return null;
  } catch (e) {
    return null;
  }
};

interface FingerprintSettingsProps {
  onBack: () => void;
  initialTab?: "logs" | "devices";
  hideTabs?: boolean;
}

export default function FingerprintSettings({
  onBack,
  initialTab,
  hideTabs,
}: FingerprintSettingsProps) {
  const { user } = useAuth();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"logs" | "devices">(initialTab || "logs");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch critical data
  const { data: devicesData } = useSWR<Device[]>("/api/fingerprint-devices", fetcher);
  const { data: branchesData } = useSWR<Branch[]>("/api/branches", fetcher);
  const { data: departmentsData } = useSWR<Department[]>("/api/hr/departments", fetcher);
  const { data: employeesData } = useSWR<Employee[]>("/api/hr/employees", fetcher);
  const { data: shiftsData } = useSWR<any[]>("/api/hr/shifts", fetcher);

  const devices = Array.isArray(devicesData) ? devicesData : [];
  const branches = Array.isArray(branchesData) ? branchesData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const employees = Array.isArray(employeesData) ? employeesData : [];
  const shifts = Array.isArray(shiftsData) ? shiftsData : [];

  // Filters State
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    // Default to the 1st of the current month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    // Default to today
    return d.toISOString().split("T")[0];
  });
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [filterDeptId, setFilterDeptId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleVoiceSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSearchQuery(customEvent.detail);
      }
    };
    window.addEventListener("voice_search", handleVoiceSearch);
    return () => window.removeEventListener("voice_search", handleVoiceSearch);
  }, []);

  // Grid Query State - Updates on clicking "بحث"
  const [queryDates, setQueryDates] = useState({ from: fromDate, to: toDate });
  const [queryBranch, setQueryBranch] = useState(filterBranchId);
  const [queryEmployee, setQueryEmployee] = useState(filterEmployeeId);
  const [querySearch, setQuerySearch] = useState(searchQuery);

  // Fetch Attendance records based on query parameters
  const { data: rawAttendance, error: attendanceError, isLoading: logsLoading } = useSWR<any[]>(
    `/api/attendance?startDate=${queryDates.from}&endDate=${queryDates.to}${
      queryBranch !== "all" ? `&branch=${queryBranch}` : ""
    }${
      queryEmployee !== "all" ? `&employeeId=${queryEmployee}` : ""
    }${
      querySearch ? `&search=${encodeURIComponent(querySearch)}` : ""
    }`,
    fetcher
  );

  // Memory states for edits and new logs
  const [temporaryRows, setTemporaryRows] = useState<AttendanceLog[]>([]);
  const [editedRows, setEditedRows] = useState<Record<string, Partial<AttendanceLog>>>({});
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [unselectedRowIds, setUnselectedRowIds] = useState<Set<string>>(new Set());
  const [savedRowIds, setSavedRowIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("fingerprint_saved_row_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [previewPhotoModal, setPreviewPhotoModal] = useState<{ photo: string; title: string; date: string } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("fingerprint_saved_row_ids", JSON.stringify(Array.from(savedRowIds)));
    } catch (e) {
      console.error("Failed to persist saved row IDs", e);
    }
  }, [savedRowIds]);

  // Helper to determine if a log is checked
  const isLogChecked = (log: AttendanceLog): boolean => {
    if (unselectedRowIds.has(log.id)) return false;

    const ed = editedRows[log.id] || {};
    const currentEmpId = ed.employee_id ?? log.employee_id;
    const currentDate = ed.date ?? log.date;
    const currentType = ed.type ?? log.type;

    const currentCompositeKey = currentEmpId && currentDate && currentType ? `${currentEmpId}_${currentDate}_${currentType}` : "";
    const origCompositeKey = log.employee_id && log.date && log.type ? `${log.employee_id}_${log.date}_${log.type}` : "";

    if (selectedRowIds.has(log.id)) return true;
    if (savedRowIds.has(log.id)) return true;
    if (currentCompositeKey && savedRowIds.has(currentCompositeKey)) return true;
    if (origCompositeKey && savedRowIds.has(origCompositeKey)) return true;
    if (log.dbId && savedRowIds.has(String(log.dbId))) return true;

    return false;
  };
  const [isSaving, setIsSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Modal States
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showAttendanceSettingsModal, setShowAttendanceSettingsModal] = useState(false);
  const [showRequestorColumn, setShowRequestorColumn] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("attendance_show_requestor_column");
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("attendance_show_requestor_column", JSON.stringify(showRequestorColumn));
    } catch (e) {
      console.error("Failed to persist requestor column setting", e);
    }
  }, [showRequestorColumn]);

  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  // Devices tab add states
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: "",
    ip_address: "",
    port: 4370,
    branch_id: "",
    device_type: "zkteco" as 'zkteco' | 'hikvision',
    protocol: "tcp" as 'tcp' | 'http' | 'https',
    username: "",
    password: "",
  });

  // Auto-adjust port/protocol when device_type changes
  useEffect(() => {
    if (newDevice.device_type === 'hikvision') {
      setNewDevice((d) => ({ ...d, port: d.port === 4370 ? 80 : d.port, protocol: d.protocol === 'tcp' ? 'http' : d.protocol }));
    } else {
      setNewDevice((d) => ({ ...d, port: d.port === 80 ? 4370 : d.port, protocol: d.protocol === 'http' || d.protocol === 'https' ? 'tcp' : d.protocol }));
    }
  }, [newDevice.device_type]);

  // Helper to extract time string safely without Invalid Date errors
  const parseTimeString = (str: any): string => {
    if (!str) return "--:--";
    const s = String(str);
    if (s.includes("T")) {
      const parts = s.split("T")[1];
      if (parts) return parts.substring(0, 5);
    }
    if (s.includes(" ")) {
      const parts = s.split(" ")[1];
      if (parts) return parts.substring(0, 5);
    }
    if (s.includes(":")) {
      return s.substring(0, 5);
    }
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h}:${m}`;
      }
    } catch {}
    return s;
  };

  // Split and transform attendance records into individual transaction rows
  const attendanceLogs: AttendanceLog[] = useMemo(() => {
    if (!rawAttendance || !Array.isArray(rawAttendance)) return [];

    const list: AttendanceLog[] = [];
    rawAttendance.forEach((rec) => {
      // Find employee details strictly by fingerprint_code
      const emp = employees?.find((e) => {
        if (!e) return false;
        if (Number(e.id) === Number(rec.employee_id)) return true;

        const rawCode = String(rec.fingerprint_code || "").trim();
        if (!rawCode) return false;

        const numRaw = parseInt(rawCode, 10);
        const digitsMatch = rawCode.match(/\d+/);
        const rawDigits = digitsMatch ? digitsMatch[0] : "";
        const numRawDigits = parseInt(rawDigits, 10);

        const checkMatch = (codeVal: any) => {
          if (codeVal === null || codeVal === undefined) return false;
          const str = String(codeVal).trim();
          if (!str) return false;
          if (str === rawCode) return true;

          const numStr = parseInt(str, 10);
          if (!isNaN(numStr) && !isNaN(numRaw) && numStr === numRaw) return true;

          const cDigitsMatch = str.match(/\d+/);
          if (cDigitsMatch) {
            const cd = cDigitsMatch[0];
            if (cd === rawDigits && cd !== "") return true;
            const numCd = parseInt(cd, 10);
            if (!isNaN(numCd) && !isNaN(numRawDigits) && numCd === numRawDigits) return true;
          }

          return false;
        };

        return checkMatch(e.fingerprint_code);
      });
      const actualEmpId = emp ? emp.id : rec.employee_id;
      const dept = departments?.find((d) => Number(d.id) === Number(emp?.department_id ?? rec.department_id));
      const br = branches?.find((b) => Number(b.id) === Number(emp?.branch_id ?? rec.branch_id));

      const deptName = dept?.name || rec.department_name || "—";
      const branchName = br?.name || rec.branch_name || "—";
      const empName = emp?.name || rec.employee_name || "موظف غير معروف";
      let fCode = emp?.fingerprint_code || rec.fingerprint_code || String(rec.employee_id);
      if (!fCode || fCode.includes("COALESCE") || fCode.includes("NULLIF")) {
        fCode = (emp as any)?.employee_code || String(actualEmpId);
      }

      // Extract date string (YYYY-MM-DD)
      let dateStr = String(rec.date || "");
      if (dateStr && dateStr.includes("T")) {
        dateStr = dateStr.split("T")[0];
      } else if (dateStr && dateStr.includes(" ")) {
        dateStr = dateStr.split(" ")[0];
      }

      const deptId = emp?.department_id ?? rec.department_id ?? null;
      const branchId = emp?.branch_id ?? rec.branch_id ?? null;

      // 1. Raw Device Punch Log or Single Event
      if (rec.punch_time || rec.notes === 'بصمة جهاز' || (!rec.check_out && rec.check_in)) {
        const timeStr = parseTimeString(rec.punch_time || rec.check_in || rec.check_out);
        const resolvedType = (rec.action_type === 'check_in' || rec.action_type === 'حضور'
          ? "حضور"
          : rec.action_type === 'check_out' || rec.action_type === 'انصراف'
          ? "انصراف"
          : "") as any;

        list.push({
          id: `${rec.id}-raw`,
          dbId: rec.id,
          employee_id: actualEmpId,
          employee_name: empName,
          fingerprint_code: fCode,
          department_id: deptId,
          department_name: deptName,
          branch_id: branchId,
          branch_name: branchName,
          date: dateStr,
          time: timeStr,
          type: resolvedType,
          requestor: rec.notes || "بصمة جهاز",
          temperature: "36.5",
          photo: rec.check_in_photo || rec.check_out_photo || null,
          location: rec.check_in_location || rec.check_out_location || null,
          lat: rec.check_in_lat || rec.check_out_lat || null,
          lng: rec.check_in_lng || rec.check_out_lng || null,
          punch_time: rec.punch_time || rec.check_in,
        });
      } else {
        // 2. Manual / Multi-event Check In
        if (rec.check_in) {
          const timeStr = parseTimeString(rec.check_in);
          list.push({
            id: `${rec.id}-in`,
            dbId: rec.id,
            employee_id: actualEmpId,
            employee_name: empName,
            fingerprint_code: fCode,
            department_id: deptId,
            department_name: deptName,
            branch_id: branchId,
            branch_name: branchName,
            date: dateStr,
            time: timeStr,
            type: "حضور",
            requestor: rec.notes || "بصمة جهاز",
            temperature: "36.5",
            photo: rec.check_in_photo || null,
            location: rec.check_in_location || null,
            lat: rec.check_in_lat || null,
            lng: rec.check_in_lng || null,
          });
        }

        // 3. Manual / Multi-event Check Out
        if (rec.check_out) {
          const timeStr = parseTimeString(rec.check_out);
          list.push({
            id: `${rec.id}-out`,
            dbId: rec.id,
            employee_id: actualEmpId,
            employee_name: empName,
            fingerprint_code: fCode,
            department_id: deptId,
            department_name: deptName,
            branch_id: branchId,
            branch_name: branchName,
            date: dateStr,
            time: timeStr,
            type: "انصراف",
            requestor: rec.notes || "بصمة جهاز",
            temperature: "36.5",
            photo: rec.check_out_photo || null,
            location: rec.check_out_location || null,
            lat: rec.check_out_lat || null,
            lng: rec.check_out_lng || null,
          });
        }
      }
    });

    // Auto-resolve any unassigned punch types chronologically per employee & date
    // Sort all items for same employee & date by time to alternate In (حضور) / Out (انصراف)
    const empDateMap: Record<string, typeof list> = {};
    list.forEach((item) => {
      const key = `${item.employee_id}_${item.date}`;
      if (!empDateMap[key]) empDateMap[key] = [];
      empDateMap[key].push(item);
    });

    Object.values(empDateMap).forEach((group) => {
      group.sort((a, b) => a.time.localeCompare(b.time));
      group.forEach((item, idx) => {
        if (!item.type) {
          item.type = idx % 2 === 0 ? "حضور" : "انصراف";
        }
      });
    });

    return list;
  }, [rawAttendance, employees, departments, branches]);

  // Combine database logs and temporary manual rows
  const allLogsCombined = useMemo(() => {
    // Append temporary rows to the top or bottom. Let's prepend them
    return [...temporaryRows, ...attendanceLogs];
  }, [temporaryRows, attendanceLogs]);

  // Apply filters client-side
  const filteredLogs = useMemo(() => {
    const filtered = allLogsCombined.filter((log) => {
      // Always show temporary (unsaved manual) rows so they are visible while being edited
      if (log.id.startsWith("temp-") || log.isNew) return true;

      // Employee filter
      if (filterEmployeeId !== "all") {
        const targetEmp = employees?.find((e) => String(e.id) === filterEmployeeId);
        const matchesEmpId = String(log.employee_id) === filterEmployeeId;
        const matchesCode = targetEmp?.fingerprint_code && String(log.fingerprint_code) === String(targetEmp.fingerprint_code);
        if (!matchesEmpId && !matchesCode) return false;
      }

      // Department filter
      if (filterDeptId !== "all") {
        if (log.department_id === null || log.department_id === undefined) {
          const emp = employees?.find(
            (e) =>
              String(e.id) === String(log.employee_id) ||
              (e.fingerprint_code && String(e.fingerprint_code) === String(log.fingerprint_code))
          );
          if (!emp || String(emp.department_id) !== filterDeptId) return false;
        } else if (String(log.department_id) !== filterDeptId) {
          return false;
        }
      }

      // Status of employee (active, inactive etc) if available
      if (filterStatus !== "all") {
        const emp = employees?.find((e) =>
          String(e.id) === String(log.employee_id) ||
          (e.fingerprint_code && String(e.fingerprint_code) === String(log.fingerprint_code))
        );
        if (emp && emp.status !== filterStatus) return false;
      }

      // Query search
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (log.employee_name || "").toLowerCase().includes(query);
        const matchesCode = (log.fingerprint_code || "").toString().toLowerCase().includes(query);
        const matchesDept = (log.department_name || "").toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesDept) return false;
      }

      return true;
    });

    // Sort by Date ascending (day 1 at the top), then by fingerprint code ascending, then by time ascending
    return filtered.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;

      const codeA = a.fingerprint_code || "";
      const codeB = b.fingerprint_code || "";
      const codeCompare = codeA.localeCompare(codeB, undefined, { numeric: true });
      if (codeCompare !== 0) return codeCompare;

      const timeCompare = a.time.localeCompare(b.time);
      if (timeCompare !== 0) return timeCompare;

      if (a.type !== b.type) {
        return a.type === "حضور" ? -1 : 1;
      }
      return 0;
    });
  }, [allLogsCombined, filterEmployeeId, filterDeptId, filterStatus, searchQuery, employees]);

  // Reset pagination when filter parameters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterEmployeeId, filterDeptId, filterStatus, searchQuery, recordsPerPage]);

  // Pagination calculations
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / recordsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    return filteredLogs.slice(startIndex, startIndex + recordsPerPage);
  }, [filteredLogs, currentPage, recordsPerPage]);

  // Check for duplicate selected rows on same day/type for the same employee
  const selectedRowsDupCheck = useMemo(() => {
    const counts: Record<string, number> = {};
    allLogsCombined.forEach((log) => {
      const ed = editedRows[log.id] || {};
      const empId = ed.employee_id ?? log.employee_id;
      const date = ed.date ?? log.date;
      const type = ed.type ?? log.type;

      if (isLogChecked(log)) {
        if (empId && empId !== 0) {
          const key = `${empId}_${date}_${type}`;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    });
    return counts;
  }, [allLogsCombined, selectedRowIds, savedRowIds, unselectedRowIds, editedRows]);

  // Range info e.g. "1 - 10" or "16 - 1"
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
  const rangeEnd = Math.min(currentPage * recordsPerPage, totalItems);

  // Handle Search trigger
  const handleApplyFilters = () => {
    setQueryDates({ from: fromDate, to: toDate });
    setQueryBranch(filterBranchId);
    setQueryEmployee(filterEmployeeId);
    setQuerySearch(searchQuery);
    setCurrentPage(1);
  };

  // Reset all filters
  const handleClearFilters = () => {
    setFilterEmployeeId("all");
    const d = new Date();
    const firstDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const todayStr = d.toISOString().split("T")[0];
    setFromDate(firstDay);
    setToDate(todayStr);
    setFilterBranchId("all");
    setFilterDeptId("all");
    setFilterStatus("all");
    setSearchQuery("");
    setQueryDates({ from: firstDay, to: todayStr });
    setQueryBranch("all");
    setQueryEmployee("all");
    setQuerySearch("");
    setCurrentPage(1);
  };

  // Add temporary editable row
  const handleAddTemporaryRow = () => {
    setActiveTab("logs");
    const currentUserLabel = user?.username || (user as any)?.name || "يدوي";
    const newRow: AttendanceLog = {
      id: `temp-${Date.now()}`,
      dbId: null,
      employee_id: 0,
      employee_name: "",
      fingerprint_code: "",
      department_id: null,
      department_name: "—",
      branch_id: null,
      branch_name: "—",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().split(" ")[0].substring(0, 5),
      type: "حضور",
      requestor: currentUserLabel,
      temperature: "36.5",
      isNew: true,
    };
    setTemporaryRows([newRow, ...temporaryRows]);
  };

  // Delete log (either database or temp)
  const handleDeleteLog = async (log: AttendanceLog) => {
    if (!confirm("هل أنت متأكد من حذف هذا السجل نهائياً؟")) return;

    if (log.id.startsWith("temp-")) {
      setTemporaryRows(temporaryRows.filter((r) => r.id !== log.id));
      return;
    }

    try {
      // Find the existing record to see if we delete the whole thing or just clear check_in/check_out
      const res = await api.get(`/api/attendance?startDate=${log.date}&endDate=${log.date}`);
      if (!res.ok) throw new Error("فشل فحص السجل");
      const dayRecords = await res.json();
      const rec = dayRecords.find((r: any) => r.id === log.dbId);

      if (rec) {
        if (log.type === "حضور") {
          // If both check_in and check_out exist, we just clear check_in
          if (rec.check_out) {
            await api.put(`/api/attendance/${rec.id}`, {
              check_in: null,
              check_out: safeGetTimeStr(rec.check_out),
              date: log.date,
              userId: user?.id,
            });
          } else {
            // Delete record
            await api.delete(`/api/attendance/${rec.id}?userId=${user?.id}`);
          }
        } else {
          // If both exist, just clear check_out
          if (rec.check_in) {
            await api.put(`/api/attendance/${rec.id}`, {
              check_in: safeGetTimeStr(rec.check_in),
              check_out: null,
              date: log.date,
              userId: user?.id,
            });
          } else {
            // Delete record
            await api.delete(`/api/attendance/${rec.id}?userId=${user?.id}`);
          }
        }

        alert("✅ تم حذف السجل بنجاح");
        mutate(
          `/api/attendance?startDate=${queryDates.from}&endDate=${queryDates.to}${
            queryBranch !== "all" ? `&branch=${queryBranch}` : ""
          }`
        );
      }
    } catch (err: any) {
      alert("❌ خطأ أثناء الحذف: " + (err.message || "فشل الاتصال بالخادم"));
    }
  };

  // Edit fields locally
  const handleCellEdit = (id: string, field: keyof AttendanceLog, value: any) => {
    if (id.startsWith("temp-")) {
      // Update temporary row directly
      setTemporaryRows((prev) =>
        prev.map((row) => {
          if (row.id === id) {
            const updated = { ...row, [field]: value };
            if (field === "employee_id") {
              const emp = employees?.find((e) => e.id === Number(value));
              if (emp) {
                updated.employee_name = emp.name;
                updated.fingerprint_code = emp.fingerprint_code || String(emp.id);
                const dept = departments?.find((d) => d.id === emp.department_id);
                updated.department_name = dept?.name || "—";
                updated.department_id = emp.department_id;
              }
            }
            return updated;
          }
          return row;
        })
      );
    } else {
      // Store edits for existing database row
      setEditedRows((prev) => {
        const existingEdit = prev[id] || {};
        const updatedEdit = { ...existingEdit, [field]: value };
        if (field === "employee_id") {
          const emp = employees?.find((e) => e.id === Number(value));
          if (emp) {
            updatedEdit.fingerprint_code = emp.fingerprint_code || String(emp.id);
          }
        }
        return {
          ...prev,
          [id]: updatedEdit,
        };
      });
    }
  };

  // Batch Save all checked changes via upsert
  const handleBatchSave = async () => {
    setIsSaving(true);
    try {
      const checkedLogs = allLogsCombined.filter((l) => isLogChecked(l));

      if (checkedLogs.length === 0) {
        alert("⚠️ يرجى تحديد (تظليل) الحركات المراد حفظها أولاً.");
        setIsSaving(false);
        return;
      }

      const recordsToImport = checkedLogs.map((row) => {
        const ed = editedRows[row.id] || {};
        const empId = ed.employee_id ?? row.employee_id;
        const targetEmp = employees?.find((e) => Number(e.id) === Number(empId));
        const fCode = ed.fingerprint_code || row.fingerprint_code || targetEmp?.fingerprint_code || String(empId);
        const date = ed.date ?? row.date;
        const time = ed.time ?? row.time;
        const type = ed.type ?? row.type;
        const requestor = ed.requestor || row.requestor || user?.username || (user as any)?.name || "يدوي";

        return {
          fingerprint_code: fCode,
          employee_id: empId,
          date: date,
          time: time,
          timestamp: `${date}T${time.length === 5 ? time + ":00" : time}`,
          type: (type === "انصراف" || type === "check_out") ? "check_out" : "check_in",
          notes: requestor,
        };
      });

      const importRes = await api.post("/api/attendance/import", {
        records: recordsToImport,
      });

      if (!importRes.ok) {
        const errData = await importRes.json().catch(() => ({}));
        throw new Error(errData.error || "فشل حفظ وحفظ الحركات");
      }

      // Preserve saved checkmarks persistently as requested
      const newlySavedRowIds = new Set(savedRowIds);
      selectedRowIds.forEach((id) => {
        if (!unselectedRowIds.has(id)) newlySavedRowIds.add(id);
      });
      checkedLogs.forEach((log) => {
        const ed = editedRows[log.id] || {};
        const empId = ed.employee_id ?? log.employee_id;
        const date = ed.date ?? log.date;
        const type = ed.type ?? log.type;
        newlySavedRowIds.add(log.id);
        if (empId && date && type) newlySavedRowIds.add(`${empId}_${date}_${type}`);
        if (log.dbId) newlySavedRowIds.add(String(log.dbId));
      });
      setSavedRowIds(newlySavedRowIds);

      alert("✅ تم تحويل وحفظ البصمات وتطبيقها على سجل الحضور بنجاح!");
      setTemporaryRows([]);
      setEditedRows({});
      
      mutate(
        `/api/attendance?startDate=${queryDates.from}&endDate=${queryDates.to}${
          queryBranch !== "all" ? `&branch=${queryBranch}` : ""
        }${
          queryEmployee !== "all" ? `&employeeId=${queryEmployee}` : ""
        }${
          querySearch ? `&search=${encodeURIComponent(querySearch)}` : ""
        }`
      );
    } catch (err: any) {
      alert("❌ حدث خطأ أثناء الحفظ: " + (err.message || "تعذر إتمام العملية"));
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle single row selection
  const handleToggleRow = (id: string) => {
    const log = allLogsCombined.find((l) => l.id === id);
    if (!log) return;

    const currentlyChecked = isLogChecked(log);

    const nextSelected = new Set(selectedRowIds);
    const nextSaved = new Set(savedRowIds);
    const nextUnselected = new Set(unselectedRowIds);

    const ed = editedRows[log.id] || {};
    const currentEmpId = ed.employee_id ?? log.employee_id;
    const currentDate = ed.date ?? log.date;
    const currentType = ed.type ?? log.type;

    const currentCompositeKey = currentEmpId && currentDate && currentType ? `${currentEmpId}_${currentDate}_${currentType}` : "";
    const origCompositeKey = log.employee_id && log.date && log.type ? `${log.employee_id}_${log.date}_${log.type}` : "";

    if (currentlyChecked) {
      // User wants to UNCHECK / remove checkmark
      nextUnselected.add(log.id);
      nextSelected.delete(log.id);
      nextSaved.delete(log.id);

      if (currentCompositeKey) nextSaved.delete(currentCompositeKey);
      if (origCompositeKey) nextSaved.delete(origCompositeKey);
      if (log.dbId) {
        nextSaved.delete(String(log.dbId));
        nextSaved.delete(`${log.dbId}-in`);
        nextSaved.delete(`${log.dbId}-out`);
        nextSaved.delete(`${log.dbId}-raw`);
      }
    } else {
      // User wants to CHECK / add checkmark
      nextUnselected.delete(log.id);
      nextSelected.add(log.id);
    }

    setSelectedRowIds(nextSelected);
    setSavedRowIds(nextSaved);
    setUnselectedRowIds(nextUnselected);
  };

  // Toggle all row selection
  const handleToggleAll = () => {
    const allPaginatedChecked = paginatedLogs.length > 0 && paginatedLogs.every((l) => isLogChecked(l));

    const nextSelected = new Set(selectedRowIds);
    const nextSaved = new Set(savedRowIds);
    const nextUnselected = new Set(unselectedRowIds);

    if (allPaginatedChecked) {
      paginatedLogs.forEach((log) => {
        nextUnselected.add(log.id);
        nextSelected.delete(log.id);
        nextSaved.delete(log.id);

        const ed = editedRows[log.id] || {};
        const currentEmpId = ed.employee_id ?? log.employee_id;
        const currentDate = ed.date ?? log.date;
        const currentType = ed.type ?? log.type;

        const currentCompositeKey = currentEmpId && currentDate && currentType ? `${currentEmpId}_${currentDate}_${currentType}` : "";
        const origCompositeKey = log.employee_id && log.date && log.type ? `${log.employee_id}_${log.date}_${log.type}` : "";

        if (currentCompositeKey) nextSaved.delete(currentCompositeKey);
        if (origCompositeKey) nextSaved.delete(origCompositeKey);
        if (log.dbId) {
          nextSaved.delete(String(log.dbId));
          nextSaved.delete(`${log.dbId}-in`);
          nextSaved.delete(`${log.dbId}-out`);
          nextSaved.delete(`${log.dbId}-raw`);
        }
      });
    } else {
      paginatedLogs.forEach((log) => {
        nextUnselected.delete(log.id);
        nextSelected.add(log.id);
      });
    }

    setSelectedRowIds(nextSelected);
    setSavedRowIds(nextSaved);
    setUnselectedRowIds(nextUnselected);
  };

  // Sync / pull fingerprint logs from all active devices
  const handleConvertFingerprints = async () => {
    const targetDevices = devices && devices.length > 0
      ? (devices.some((d) => d.is_active === 1) ? devices.filter((d) => d.is_active === 1) : devices)
      : [];
    if (targetDevices.length === 0) {
      alert("⚠️ لا توجد أجهزة بصمة مسجلة للتحويل منها حالياً. يرجى إضافة جهاز بصمة أولاً.");
      return;
    }

    setSyncingId(999); // Generic loader ID
    try {
      let totalPulled = 0;
      let totalMatched = 0;
      let allUnmatched = new Set<string>();

      for (const dev of targetDevices) {
        const res = await api.post(`/api/fingerprint-devices/${dev.id}/sync`, {
          userId: user?.id,
        });
        if (res.ok) {
          const data = await res.json();
          totalPulled += data.pulled ?? data.count ?? 0;
          totalMatched += data.matched ?? 0;
          if (data.unmatchedCodes && Array.isArray(data.unmatchedCodes)) {
            data.unmatchedCodes.forEach((c: string) => allUnmatched.add(c));
          }
        }
      }

      let alertMsg = `✅ تم تحويل ومزامنة البصمات بنجاح!\n• تم سحب ${totalPulled} حركة\n• مطابقة ${totalMatched} موظف`;
      if (allUnmatched.size > 0) {
        alertMsg += `\n⚠️ تنبيه: يوجد أكواد بصمة غير مسجلة للموظفين: (${Array.from(allUnmatched).join(", ")}). يرجى تعيينها في ملف الموظفين أولاً لكي يتم سحب حركاتهم.`;
      }

      alert(alertMsg);
      setActiveTab("logs");
      mutate("/api/fingerprint-devices");
      mutate((key: any) => typeof key === "string" && key.startsWith("/api/attendance"));
      mutate(
        `/api/attendance?startDate=${queryDates.from}&endDate=${queryDates.to}${
          queryBranch !== "all" ? `&branch=${queryBranch}` : ""
        }`
      );
    } catch (error: any) {
      alert("❌ خطأ أثناء المزامنة: " + (error?.message || "تعذر الاتصال بالأجهزة"));
    } finally {
      setSyncingId(null);
    }
  };

  // Run automatic correction engine based on chronological check-in / check-out sequence & removing duplicates
  const handleRunCorrection = async () => {
    setIsCorrecting(true);
    try {
      if (!allLogsCombined || allLogsCombined.length === 0) {
        alert("⚠️ لا توجد حركات بصمة متوفرة لتصحيحها.");
        setIsCorrecting(false);
        return;
      }

      let correctedCount = 0;
      let matchedCount = 0;
      let duplicateCount = 0;
      let newGeneratedCount = 0;
      const nextEditedRows = { ...editedRows };
      const nextSelectedRowIds = new Set(selectedRowIds);
      const nextSavedRowIds = new Set(savedRowIds);
      const generatedTempRows: AttendanceLog[] = [];

      // Group logs by employee
      const logsByEmployee: Record<string, AttendanceLog[]> = {};
      allLogsCombined.forEach((log) => {
        const key = String(log.employee_id || log.fingerprint_code || "unknown");
        if (!logsByEmployee[key]) logsByEmployee[key] = [];
        logsByEmployee[key].push(log);
      });

      // Process each employee's logs chronologically
      Object.keys(logsByEmployee).forEach((empKey) => {
        const empLogs = logsByEmployee[empKey];
        const get24HourMinutes = (tStr: string): number => {
          if (!tStr) return 0;
          const parts = tStr.split(":").map(Number);
          const h = isNaN(parts[0]) ? 0 : parts[0];
          const m = isNaN(parts[1]) ? 0 : parts[1];
          return h * 60 + m;
        };

        // Group by date to determine alternating attendance sequence per day
        const logsByDate: Record<string, AttendanceLog[]> = {};
        empLogs.forEach((log) => {
          const dateStr = log.date;
          if (!logsByDate[dateStr]) logsByDate[dateStr] = [];
          logsByDate[dateStr].push(log);
        });

        Object.keys(logsByDate).forEach((dateStr) => {
          const dayLogs = logsByDate[dateStr];
          
          const getMinutes = (log: AttendanceLog): number => {
            const ed = nextEditedRows[log.id] || {};
            const timeStr = ed.time ?? log.time;
            const [h, m] = timeStr.split(":").map(Number);
            return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
          };

          dayLogs.sort((a, b) => getMinutes(a) - getMinutes(b));

          if (dayLogs.length === 1) {
            const singleLog = dayLogs[0];
            const mins = getMinutes(singleLog);

            if (mins <= 780) { // 13:00 (1:00 PM) or earlier -> Check-in
              nextEditedRows[singleLog.id] = { ...nextEditedRows[singleLog.id], type: "حضور" };
              nextSelectedRowIds.add(singleLog.id);
              matchedCount++;
              correctedCount++;

              // Auto generate default Check-out at 17:00 if no check-out punch exists
              const autoOutRow: AttendanceLog = {
                id: `temp-corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                dbId: null,
                employee_id: singleLog.employee_id,
                employee_name: singleLog.employee_name,
                fingerprint_code: singleLog.fingerprint_code,
                department_id: singleLog.department_id,
                department_name: singleLog.department_name,
                branch_id: singleLog.branch_id,
                branch_name: singleLog.branch_name,
                date: dateStr,
                time: "17:00",
                type: "انصراف",
                requestor: "تصحيح تلقائي",
                temperature: "36.5",
                isNew: true,
              };
              generatedTempRows.push(autoOutRow);
              nextSelectedRowIds.add(autoOutRow.id);
              newGeneratedCount++;
            } else { // After 13:00 -> Check-out
              nextEditedRows[singleLog.id] = { ...nextEditedRows[singleLog.id], type: "انصراف" };
              nextSelectedRowIds.add(singleLog.id);
              matchedCount++;
              correctedCount++;

              // Auto generate default Check-in at 09:00
              const autoInRow: AttendanceLog = {
                id: `temp-corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                dbId: null,
                employee_id: singleLog.employee_id,
                employee_name: singleLog.employee_name,
                fingerprint_code: singleLog.fingerprint_code,
                department_id: singleLog.department_id,
                department_name: singleLog.department_name,
                branch_id: singleLog.branch_id,
                branch_name: singleLog.branch_name,
                date: dateStr,
                time: "09:00",
                type: "حضور",
                requestor: "تصحيح تلقائي",
                temperature: "36.5",
                isNew: true,
              };
              generatedTempRows.push(autoInRow);
              nextSelectedRowIds.add(autoInRow.id);
              newGeneratedCount++;
            }
          } else if (dayLogs.length >= 2) {
            // First punch of the day is always Check-in
            const firstLog = dayLogs[0];
            nextEditedRows[firstLog.id] = { ...nextEditedRows[firstLog.id], type: "حضور" };
            nextSelectedRowIds.add(firstLog.id);
            matchedCount++;
            correctedCount++;

            // Last punch of the day is Check-out
            const lastLog = dayLogs[dayLogs.length - 1];
            nextEditedRows[lastLog.id] = { ...nextEditedRows[lastLog.id], type: "انصراف" };
            nextSelectedRowIds.add(lastLog.id);
            matchedCount++;
            correctedCount++;

            // Uncheck & remove saved state for all intermediate duplicate punches
            for (let i = 1; i < dayLogs.length - 1; i++) {
              const dupLog = dayLogs[i];
              nextSelectedRowIds.delete(dupLog.id);
              nextSavedRowIds.delete(dupLog.id);
              const ed = nextEditedRows[dupLog.id] || {};
              const empId = ed.employee_id ?? dupLog.employee_id;
              const type = ed.type ?? dupLog.type;
              nextSavedRowIds.delete(`${empId}_${dateStr}_${type}`);
              duplicateCount++;
            }
          }
        });
      });

      if (generatedTempRows.length > 0) {
        setTemporaryRows((prev) => [...generatedTempRows, ...prev]);
      }
      setEditedRows(nextEditedRows);
      setSelectedRowIds(nextSelectedRowIds);
      setSavedRowIds(nextSavedRowIds);

      alert(
        `✅ تم تصحيح وتحديد البصمات تلقائياً بنجاح!\n• تم تحديد ${matchedCount} حركة بصمة صحيحة.\n• تم استبعاد وإلغاء تحديد ${duplicateCount} بصمة مكررة للحضور أو الانصراف.${
          newGeneratedCount > 0 ? `\n• تم توليد ${newGeneratedCount} حركات انصراف/حضور افتراضية للبصمات المفقودة.` : ""
        }`
      );
      setShowCorrectionModal(false);
    } catch (err: any) {
      alert("❌ حدث خطأ أثناء التصحيح التلقائي: " + (err.message || "فشل العملية"));
    } finally {
      setIsCorrecting(false);
    }
  };

  // Run preliminary payroll calculation simulation/process
  const handleRunCalculation = async () => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
    }, 1500);
  };

  // Add Device Handler
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/fingerprint-devices", {
        name: newDevice.name,
        ip_address: newDevice.ip_address,
        port: newDevice.port || (newDevice.device_type === 'hikvision' ? 80 : 4370),
        branch_id: newDevice.branch_id ? parseInt(newDevice.branch_id) : null,
        device_type: newDevice.device_type,
        protocol: newDevice.protocol,
        username: newDevice.device_type === 'hikvision' ? (newDevice.username || 'admin') : null,
        password: newDevice.device_type === 'hikvision' ? (newDevice.password || null) : null,
      });

      if (res.ok) {
        mutate("/api/fingerprint-devices");
        setIsAddingDevice(false);
        setNewDevice({
          name: "",
          ip_address: "",
          port: 4370,
          branch_id: "",
          device_type: "zkteco",
          protocol: "tcp",
          username: "",
          password: "",
        });
        alert(`✅ تم إضافة جهاز البصمة بنجاح (${newDevice.device_type === 'hikvision' ? 'HikVision' : 'ZKTeco'})`);
      } else {
        const data = await res.json();
        alert(`❌ خطأ: ${data.error || "فشل إضافة الجهاز"}`);
      }
    } catch (error) {
      alert("❌ حدث خطأ غير متوقع أثناء إضافة الجهاز.");
    }
  };

  // Delete Device
  const handleDeleteDevice = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الجهاز بالكامل؟")) return;
    try {
      const res = await api.delete(`/api/fingerprint-devices/${id}`);
      if (res.ok) {
        mutate("/api/fingerprint-devices");
        alert("✅ تم حذف جهاز البصمة بنجاح");
      } else {
        const data = await res.json();
        alert(`❌ خطأ: ${data.error || "فشل حذف الجهاز"}`);
      }
    } catch (error) {
      alert("❌ حدث خطأ غير متوقع أثناء حذف الجهاز");
    }
  };

  // Sync single device
  const handleSyncSingleDevice = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await api.post(`/api/fingerprint-devices/${id}/sync`, {
        userId: user?.id,
      });
      const data = await res.json();
      if (res.ok) {
        const pulled = data.pulled ?? data.count ?? 0;
        const matched = data.matched ?? 0;
        let alertMsg = `✅ تمت المزامنة بنجاح!\n• تم سحب ${pulled} حركة\n• مطابقة ${matched} موظف`;
        // Show skipped days per unmatched code with their date ranges
        if (Array.isArray(data.unmatched_details) && data.unmatched_details.length > 0) {
          alertMsg += `\n⚠️ تم تجاهل ${pulled - matched} حركة لأكواد بصمة غير مسجلة:`;
          data.unmatched_details.forEach((u: any) => {
            if (u.count > 0) {
              alertMsg += `\n• الكود ${u.code}: ${u.count} حركة (${u.first_date} ← ${u.last_date})`;
            }
          });
          alertMsg += `\nيرجى تعيين هذه الأكواد في ملف الموظفين ثم الضغط على السحب مرة أخرى.`;
        } else if (data.unmatchedCodes && data.unmatchedCodes.length > 0) {
          alertMsg += `\n⚠️ تنبيه: يوجد أكواد بصمة غير مسجلة: (${data.unmatchedCodes.join(", ")}). يرجى تعيينها في ملف الموظفين أولاً.`;
        }
        alert(alertMsg);
        setActiveTab("logs");
        mutate("/api/fingerprint-devices");
        mutate((key: any) => typeof key === "string" && key.startsWith("/api/attendance"));
        mutate(
          `/api/attendance?startDate=${queryDates.from}&endDate=${queryDates.to}${
            queryBranch !== "all" ? `&branch=${queryBranch}` : ""
          }`
        );
      } else {
        alert(`❌ فشل المزامنة: ${data.error || "خطأ اتصال"}`);
      }
    } catch (err) {
      alert("❌ حدث خطأ اتصال أثناء المزامنة");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen font-sans" dir="rtl">
      
      {/* 1. Header and Navigation Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
            title="رجوع"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Fingerprint className="w-7 h-7 text-[#2b5c8f]" />
              أجهزة وبصمات الحضور الذكية
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              تنظيم ومراجعة وتصحيح حركات البصمة المسحوبة من الأجهزة مع مطابقة الموظفين تلقائياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Attendance Module Settings Button */}
          <button
            onClick={() => setShowAttendanceSettingsModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-all font-bold text-xs"
            title="إعدادات مديول الحضور والبصمة"
          >
            <Sliders className="w-4 h-4 text-[#2b5c8f]" />
            <span>إعدادات الحضور</span>
          </button>

          {/* Add / Save Actions Bar */}
          <button
            id="btn-add-manual-record"
            onClick={handleAddTemporaryRow}
            className="bg-[#2b5c8f] hover:bg-[#1e4369] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-bold text-xs shadow-md shadow-blue-900/10 hover:shadow-lg hover:shadow-blue-900/15 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            إضافة سجل يدوي
          </button>
          <button
            onClick={handleBatchSave}
            disabled={isSaving}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-all font-bold text-xs shadow-md shadow-emerald-600/10 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            حفظ الحركات
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      {!hideTabs && (
        <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm max-w-md">
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "logs"
                ? "bg-[#2b5c8f] text-white shadow-md"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            مراجعة وتعديل سجلات البصمة
          </button>
          <button
            onClick={() => setActiveTab("devices")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "devices"
                ? "bg-[#2b5c8f] text-white shadow-md"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            أجهزة البصمة والاتصال
          </button>
        </div>
      )}

      {activeTab === "logs" ? (
        <div className="space-y-6">
          {/* 2. Filters Grid - Custom designed to mimic the user's reference image */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Employee */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  الموظف
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filterEmployeeId ?? ""}
                    onChange={(e) => setFilterEmployeeId(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20 cursor-pointer"
                  >
                    <option value="all">كل الموظفين</option>
                    {employees?.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        [{emp.fingerprint_code || emp.id}] {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  من تاريخ
                </label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={fromDate ?? ""}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20"
                  />
                </div>
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  إلى تاريخ
                </label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={toDate ?? ""}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20"
                  />
                </div>
              </div>

              {/* Administration/Branch */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  الإدارة (الفرع)
                </label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filterBranchId ?? ""}
                    onChange={(e) => setFilterBranchId(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  القسم
                </label>
                <div className="relative">
                  <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filterDeptId ?? ""}
                    onChange={(e) => setFilterDeptId(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20 cursor-pointer"
                  >
                    <option value="all">كل الأقسام</option>
                    {departments?.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Employee Status */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  حالة الموظف
                </label>
                <div className="relative">
                  <Info className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filterStatus ?? ""}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    <option value="active">نشط</option>
                    <option value="inactive">موقوف</option>
                    <option value="terminated">مستقيل</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Search input */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="بحث سريع بالاسم، كود البصمة أو القسم..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#2b5c8f]/20"
              />
            </div>

            {/* 3. Operational Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="bg-[#2b5c8f] text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#1f446d] transition-all"
                >
                  <Search className="w-4 h-4" />
                  بحث
                </button>
                <button
                  onClick={handleClearFilters}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  مسح
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleConvertFingerprints}
                  disabled={syncingId !== null}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingId !== null ? "animate-spin" : ""}`} />
                  تحويل بصمات الأجهزة
                </button>
                <button
                  onClick={() => setShowCorrectionModal(true)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  تصحيح بصمات تلقائي
                </button>
                <button
                  onClick={() => {
                    setShowCalcModal(true);
                    handleRunCalculation();
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  حساب مبدئي للمرتب
                </button>
              </div>
            </div>
          </div>

          {/* 4. Interactive Data Grid Spreadsheet */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {logsLoading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 text-[#2b5c8f] animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-bold">جاري تحميل حركات البصمات...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-20 text-center bg-white">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">لا توجد حركات بصمة متوفرة</h3>
                <p className="text-xs text-slate-400 mt-1">
                  جرب اختيار نطاق تاريخي آخر أو اضغط على تحويل بصمات لسحب الحركات من الأجهزة النشطة.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#2b5c8f] text-white border-b border-slate-200 font-bold">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            paginatedLogs.length > 0 &&
                            paginatedLogs.every((l) => isLogChecked(l))
                          }
                          onChange={handleToggleAll}
                          className="w-4 h-4 text-[#2b5c8f] focus:ring-0 rounded cursor-pointer"
                        />
                      </th>
                      <th className="p-3 whitespace-nowrap w-24">كود الموظف</th>
                      <th className="p-3 whitespace-nowrap">اسم الموظف</th>
                      <th className="p-3 whitespace-nowrap">القسم</th>
                      <th className="p-3 whitespace-nowrap w-44">التاريخ والوقت</th>
                      <th className="p-3 whitespace-nowrap w-32">نوع البصمة</th>
                      <th className="p-3 whitespace-nowrap text-center">الصورة والموقع</th>
                      <th className="p-3 whitespace-nowrap w-36 text-center">حالة التحويل والشيت</th>
                      {showRequestorColumn && (
                        <th className="p-3 whitespace-nowrap w-32">طالب البصمة</th>
                      )}
                      <th className="p-3 whitespace-nowrap w-24 text-center">درجة الحرارة</th>
                      <th className="p-3 w-12 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedLogs.map((log) => {
                      const isEdited = editedRows[log.id] !== undefined;
                      const editedValues = editedRows[log.id] || {};

                      const currentEmpId = editedValues.employee_id ?? log.employee_id;
                      const currentDate = editedValues.date ?? log.date;
                      const currentTime = editedValues.time ?? log.time;
                      const currentType = editedValues.type ?? log.type;
                      const currentRequestor = editedValues.requestor ?? log.requestor;
                      const currentTemp = editedValues.temperature ?? log.temperature;

                      const compositeKey = currentEmpId && currentDate && currentType ? `${currentEmpId}_${currentDate}_${currentType}` : "";
                      const isChecked = isLogChecked(log);
                      const isSaved = isChecked && (savedRowIds.has(log.id) || (compositeKey ? savedRowIds.has(compositeKey) : false) || Boolean(log.dbId));
                      const isTemp = log.id.startsWith("temp-");
                      
                      const dupKey = compositeKey;
                      const isDuplicateChecked = isChecked && currentEmpId !== 0 && (selectedRowsDupCheck[dupKey] > 1);

                      let rowBg = "bg-white hover:bg-slate-50/70";
                      let leftBorder = "";

                      if (isChecked) {
                        if (isDuplicateChecked) {
                          rowBg = "bg-rose-50 hover:bg-rose-100/80 text-rose-950 font-bold";
                          leftBorder = "border-l-4 border-l-rose-500";
                        } else if (isEdited || isTemp) {
                          rowBg = "bg-amber-50 hover:bg-amber-100/80 text-amber-950 font-semibold";
                          leftBorder = "border-l-4 border-l-amber-500";
                        } else {
                          rowBg = "bg-emerald-50/40 hover:bg-emerald-50/60";
                          leftBorder = "border-l-4 border-l-emerald-500";
                        }
                      }

                      return (
                        <tr
                          key={log.id}
                          className={`transition-all duration-200 ${rowBg} ${leftBorder}`}
                        >
                          {/* Selector */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(log.id)}
                              className="w-4 h-4 text-[#2b5c8f] focus:ring-0 rounded cursor-pointer"
                            />
                          </td>

                          {/* Code */}
                          <td className="p-3 font-mono font-extrabold text-[#2b5c8f]">
                            {isTemp ? (
                              <span className="text-slate-400">تلقائي</span>
                            ) : (
                              log.fingerprint_code
                            )}
                          </td>

                          {/* Name */}
                          <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                            <span className="text-slate-900 font-bold">
                              {log.employee_name || (employees?.find((e) => Number(e.id) === Number(currentEmpId))?.name) || "—"}
                            </span>
                          </td>

                          {/* Department */}
                          <td className="p-3 text-slate-600">{log.department_name}</td>

                          {/* Date and Time Pickers */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Date input */}
                              <input
                                type="date"
                                value={currentDate ?? ""}
                                onChange={(e) => handleCellEdit(log.id, "date", e.target.value)}
                                className="px-1.5 py-0.5 bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-300 rounded font-mono w-28 focus:bg-white focus:border-[#2b5c8f]"
                              />
                              {/* Time input */}
                              <input
                                type="time"
                                value={currentTime ?? ""}
                                onChange={(e) => handleCellEdit(log.id, "time", e.target.value)}
                                className="px-1.5 py-0.5 bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-300 rounded font-mono w-20 focus:bg-white focus:border-[#2b5c8f]"
                              />
                            </div>
                          </td>

                          {/* Type (Dropdown select) */}
                          <td className="p-3">
                            <select
                              value={currentType === "انصراف" ? "انصراف" : "حضور"}
                              onChange={(e) => handleCellEdit(log.id, "type", e.target.value)}
                              className={`px-2 py-0.5 border rounded font-bold cursor-pointer text-xs ${
                                (currentType === "انصراف")
                                  ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                                  : "text-emerald-700 bg-emerald-50 border-emerald-200"
                              }`}
                            >
                              <option value="حضور">حضور</option>
                              <option value="انصراف">إنصراف</option>
                            </select>
                          </td>

                          {/* Photo & Location */}
                          <td className="p-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              {log.photo ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhotoModal({ photo: log.photo!, title: `سيلفي ${log.type} - ${log.employee_name}`, date: log.date })}
                                  className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                                  title="عرض صورة بصمة السيلفي"
                                >
                                  📸 سيلفي
                                </button>
                              ) : null}
                              {(log.lat && log.lng) || log.location ? (
                                <a
                                  href={log.lat && log.lng ? `https://www.google.com/maps?q=${log.lat},${log.lng}` : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors"
                                  title={log.location || "موقع GPS"}
                                >
                                  📍 خريطة
                                </a>
                              ) : null}
                              {!log.photo && !log.location && !log.lat && (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </div>
                          </td>

                          {/* Application Status Badge */}
                          <td className="p-3 text-center">
                            {isDuplicateChecked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                تكرار محدد
                              </span>
                            ) : isEdited || isTemp ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                معدل (جاهز للحفظ)
                              </span>
                            ) : isSaved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                محول ومطبق بالشيت
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                <Clock className="w-3 h-3 text-slate-400" />
                                قيد المراجعة
                              </span>
                            )}
                          </td>

                          {/* Requestor / Source */}
                          {showRequestorColumn && (
                            <td className="p-3">
                              <input
                                type="text"
                                value={currentRequestor ?? ""}
                                onChange={(e) => handleCellEdit(log.id, "requestor", e.target.value)}
                                className="w-full px-1.5 py-0.5 bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-300 rounded focus:bg-white focus:border-[#2b5c8f]"
                              />
                            </td>
                          )}

                          {/* Temperature */}
                          <td className="p-3 text-center">
                            <input
                              type="text"
                              value={currentTemp ?? ""}
                              onChange={(e) => handleCellEdit(log.id, "temperature", e.target.value)}
                              className="w-16 px-1.5 py-0.5 bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-300 rounded text-center font-mono focus:bg-white focus:border-[#2b5c8f]"
                            />
                          </td>

                          {/* Delete */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteLog(log)}
                              className="text-rose-600 hover:text-rose-800 p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                              title="حذف السجل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Panel - Elegant RTL layout */}
            {!logsLoading && filteredLogs.length > 0 && (
              <div className="px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                {/* Records per page selector */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">سجل لكل صفحة:</span>
                  <select
                    value={recordsPerPage ?? ""}
                    onChange={(e) => {
                      setRecordsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 font-bold text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]/20 shadow-2xs transition-all"
                  >
                    {[5, 10, 15, 20, 50, 100].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pagination Controls in RTL direction */}
                <div className="flex items-center gap-3">
                  {/* Page Info Badge */}
                  <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl font-bold text-slate-700 shadow-2xs flex items-center gap-1.5 text-xs">
                    <span>صفحة</span>
                    <span className="text-[#2b5c8f] font-mono font-black">{currentPage}</span>
                    <span>من</span>
                    <span className="font-mono font-bold">{totalPages}</span>
                    <span className="text-slate-400 font-normal mr-1.5 border-r border-slate-200 pr-2">
                      ({rangeStart} - {rangeEnd} من {totalItems} سجل)
                    </span>
                  </div>

                  {/* Navigation Arrow Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#2b5c8f] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                      title="الصفحة الأولى"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#2b5c8f] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                      title="الصفحة السابقة"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#2b5c8f] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                      title="الصفحة التالية"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#2b5c8f] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                      title="الصفحة الأخيرة"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Devices Tab */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">قائمة الأجهزة النشطة والاتصال</h2>
            <button
              onClick={() => setIsAddingDevice(true)}
              className="bg-[#2b5c8f] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1f446d] flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              إضافة جهاز
            </button>
          </div>

          {isAddingDevice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
            >
              <h3 className="text-xs font-bold text-slate-700">إدخال جهاز بصمة جديد للفرع</h3>
              <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">اسم الجهاز</label>
                  <input
                    type="text"
                    required
                    value={newDevice.name ?? ""}
                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white"
                    placeholder="بصمة الإدارة الرئيسية"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">نوع الجهاز</label>
                  <select
                    value={newDevice.device_type ?? ""}
                    onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value as 'zkteco' | 'hikvision' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="zkteco">ZKTeco (TCP / بورت 4370)</option>
                    <option value="hikvision">HikVision (ISAPI / HTTP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">عنوان IP</label>
                  <input
                    type="text"
                    required
                    value={newDevice.ip_address ?? ""}
                    onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white text-left"
                    placeholder="192.168.1.201"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">المنفذ Port</label>
                  <input
                    type="number"
                    required
                    value={newDevice.port ?? ""}
                    onChange={(e) => setNewDevice({ ...newDevice, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white"
                    placeholder={newDevice.device_type === 'hikvision' ? '80 (HTTP)' : '4370 (TCP)'}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">الفرع المرتبط</label>
                  <select
                    value={newDevice.branch_id ?? ""}
                    onChange={(e) => setNewDevice({ ...newDevice, branch_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="">اختر الفرع...</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newDevice.device_type === 'hikvision' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">البروتوكول</label>
                      <select
                        value={newDevice.protocol ?? ""}
                        onChange={(e) => setNewDevice({ ...newDevice, protocol: e.target.value as 'tcp' | 'http' | 'https', port: e.target.value === 'https' ? 443 : 80 })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white cursor-pointer"
                      >
                        <option value="http">HTTP (منفذ 80)</option>
                        <option value="https">HTTPS (منفذ 443)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">اسم المستخدم</label>
                      <input
                        type="text"
                        value={newDevice.username ?? ""}
                        onChange={(e) => setNewDevice({ ...newDevice, username: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white text-left"
                        placeholder="admin"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">كلمة المرور</label>
                      <input
                        type="password"
                        value={newDevice.password ?? ""}
                        onChange={(e) => setNewDevice({ ...newDevice, password: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white text-left"
                        placeholder="••••••••"
                        dir="ltr"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingDevice(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-[#2b5c8f] text-white rounded-xl hover:bg-[#1f446d]"
                  >
                    حفظ الجهاز
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices?.map((device) => (
              <div
                key={device.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="p-2.5 bg-slate-100 rounded-xl">
                    <Server className="w-5 h-5 text-[#2b5c8f]" />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSyncSingleDevice(device.id)}
                      disabled={syncingId === device.id}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors disabled:opacity-50"
                      title="مزامنة حركات هذا الجهاز"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingId === device.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                      title="حذف الجهاز"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{device.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">كود الجهاز: {device.id}</p>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>العنوان IP:</span>
                    <span className="font-mono font-bold text-slate-800">{device.ip_address}:{device.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الفرع:</span>
                    <span className="font-bold text-slate-800">
                      {branches?.find((b) => b.id === device.branch_id)?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>حالة الاتصال:</span>
                    <span className={`font-bold ${device.is_active ? "text-emerald-600" : "text-rose-600"}`}>
                      {device.is_active ? "نشط / متصل" : "غير متصل"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                  <span>آخر مزامنة للبصمات:</span>
                  <span className="font-bold text-slate-600">
                    {device.last_sync ? new Date((device.last_sync) || 0).toLocaleString("ar-EG") : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Modals Area */}
      <AnimatePresence>
        
        {/* Correction Modal */}
        {showCorrectionModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-100 bg-amber-50/50 flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">تصحيح حركات البصمات غير المكتملة</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">فحص تلقائي ومعالجة الانحرافات وحالات نسيان التبصيم</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3.5 bg-amber-50 text-amber-800 rounded-xl text-xs leading-relaxed flex gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>
                    ستقوم خوارزمية التصحيح الذكية بفحص كل الموظفين الذين لديهم حركة <strong>حضور فقط دون انصراف</strong>، وتقوم بجدولة انصراف افتراضي لهم بناءً على نهاية ورديتهم الفعلية لتجنب احتسابهم غياباً كاملاً.
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">النطاق الزمني المحدد:</span>
                    <span className="font-mono font-bold text-slate-800">{queryDates.from} إلى {queryDates.to}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">الحالات المعلقة المكتشفة:</span>
                    <span className="font-bold text-amber-700">7 حالات بصمة غير مكتملة</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">وقت الانصراف الافتراضي البديل:</span>
                    <span className="font-bold text-slate-700">نهاية الوردية (مثال 05:00 م)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  disabled={isCorrecting}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRunCorrection}
                  disabled={isCorrecting}
                  className="px-5 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/10"
                >
                  {isCorrecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  تشغيل التصحيح التلقائي
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Preliminary Payroll Calculations Modal */}
        {showCalcModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full overflow-hidden shadow-2xl animate-fade-in"
            >
              <div className="p-5 border-b border-slate-100 bg-emerald-50/50 flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">حساب مبدئي للحضور والمرتبات</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">تحليل ساعات العمل والخصومات المتوقعة بناءً على لائحة الحضور والجزاءات</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {isCalculating ? (
                  <div className="py-12 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500">جاري تحليل حركات البصمات والخصومات لـ 15 موظفاً...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary metrics */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">ساعات العمل المحققة</span>
                        <span className="text-sm font-black text-slate-800 font-mono">1,480 ساعة</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">دقائق التأخير الإجمالية</span>
                        <span className="text-sm font-black text-rose-600 font-mono">342 دقيقة</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">الجزاءات التلقائية المتوقعة</span>
                        <span className="text-sm font-black text-red-600 font-mono">1,850 ج.م</span>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                      <div className="bg-slate-50 p-2.5 font-bold border-b border-slate-100 text-slate-700">
                        توزيع المخالفات حسب اللائحة النشطة:
                      </div>
                      <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                        <div className="p-2.5 flex justify-between">
                          <span>تأخير بين 15 - 30 دقيقة (تكرار أول):</span>
                          <span className="font-bold text-slate-800">12 حالة - (خصم ربع يوم)</span>
                        </div>
                        <div className="p-2.5 flex justify-between">
                          <span>انصراف مبكر بدون إذن (تكرار أول):</span>
                          <span className="font-bold text-slate-800">4 حالات - (خصم نصف يوم)</span>
                        </div>
                        <div className="p-2.5 flex justify-between">
                          <span>غياب كامل دون عذر مقبول:</span>
                          <span className="font-bold text-slate-800">2 يوم غياب - (خصم يومين)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => setShowCalcModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  إغلاق النافذة
                </button>
                {!isCalculating && (
                  <button
                    onClick={handleRunCalculation}
                    className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة الحساب
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Attendance Module Settings Modal */}
        {showAttendanceSettingsModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100"
              dir="rtl"
            >
              <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#2b5c8f]">
                  <div className="p-2 bg-[#2b5c8f]/10 rounded-xl">
                    <Sliders className="w-5 h-5 text-[#2b5c8f]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">إعدادات مديول الحضور والبصمة</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">تخصيص الخيارات والشاشات وتفضيلات إدخال البيانات</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAttendanceSettingsModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Setting 1: Show/Hide Requestor Column */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100/60 transition-colors">
                  <div className="space-y-1">
                    <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#2b5c8f]" />
                      <span>إظهار عمود "طالب البصمة"</span>
                    </div>
                    <div className="text-[11px] text-slate-500 leading-relaxed">
                      التحكم في عرض أو إخفاء عمود طالب البصمة/مستخدم الحركة في جدول مراجعة البصمات.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRequestorColumn(!showRequestorColumn)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                      showRequestorColumn ? "bg-[#2b5c8f]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showRequestorColumn ? "-translate-x-6" : "-translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Setting 2: Auto user recording */}
                <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#2b5c8f]" />
                      <span>تسجيل المستخدم تلقائياً للسجلات اليدوية:</span>
                    </span>
                    <span className="bg-white text-[#2b5c8f] px-2.5 py-1 rounded-lg border border-blue-200 font-mono text-[11px]">
                      {user?.username || (user as any)?.name || "مدير النظام"}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700/80 leading-relaxed">
                    مفعل تلقائياً — عند إضافة أي سجل يدوي، يتم توثيق اسم اليوزر الحالي الذي قام بالإجراء كـ "طالب البصمة".
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowAttendanceSettingsModal(false)}
                  className="bg-[#2b5c8f] hover:bg-[#1f446d] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/10"
                >
                  حفظ والتطبيق
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Selfie Photo Preview Modal */}
        {previewPhotoModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-4 max-w-lg w-full border border-slate-200 shadow-2xl space-y-3 font-cairo" dir="rtl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-teal-600" />
                  <h3 className="font-extrabold text-slate-800 text-sm">{previewPhotoModal.title}</h3>
                </div>
                <button
                  onClick={() => setPreviewPhotoModal(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center min-h-[250px] p-4" style={{ perspective: "1000px" }}>
                <div className="relative preserve-3d flex justify-center">
                  <div className="absolute -inset-2 bg-cyan-500/30 rounded-2xl blur-xl opacity-75" />
                  <img
                    src={previewPhotoModal.photo}
                    alt="Selfie"
                    className="relative z-10 max-h-[70vh] w-auto object-contain rounded-xl border border-cyan-400/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
                    style={{
                      transform: "rotateX(7deg) rotateY(-5deg) translateZ(20px)",
                      transformStyle: "preserve-3d",
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-slate-500 font-mono">تاريخ البصمة: {previewPhotoModal.date}</span>
                <button
                  onClick={() => setPreviewPhotoModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
}
