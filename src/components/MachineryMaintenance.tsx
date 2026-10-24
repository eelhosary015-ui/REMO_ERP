import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cog,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Calendar,
  Thermometer,
  ShieldAlert,
  Sliders,
  DollarSign,
  User,
  Power,
  Package,
  Activity,
  ChevronLeft,
  Settings,
  Info,
  Layers,
  Sparkles,
  Zap,
  RotateCcw,
} from "lucide-react";
import { databaseStorage } from "../utils/databaseStorage";

interface SparePart {
  id: string;
  name: string;
  code: string;
  stock: number;
  cost: number;
}

interface RepairLog {
  id: string;
  date: string;
  technician: string;
  issue: string;
  actionTaken: string;
  sparePartsUsed: {
    partId: string;
    name: string;
    quantity: number;
    cost: number;
  }[];
  totalCost: number;
}

interface BreakdownLog {
  id: string;
  date: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "critical";
  status: "reported" | "in_progress" | "resolved";
  reporter: string;
}

interface Machine {
  id: string;
  name: string;
  code: string;
  line: string;
  status: "running" | "on_hold" | "maintenance" | "broken" | "emergency";
  totalHours: number;
  hoursSinceMaintenance: number;
  maintenanceInterval: number; // in hours
  temperature: number; // dynamic temperature
  maxSafeTemp: number; // maximum safe temp
  spareParts: SparePart[];
  repairHistory: RepairLog[];
  breakdowns: BreakdownLog[];
  installationDate: string;
}

const DEFAULT_MACHINES: Machine[] = [
  {
    id: "m_01",
    name: "فرن الإنتاج الحراري الدوار الإيطالي",
    code: "ROT-OVN-01",
    line: "خط المخبوزات والمعجنات الرئيسي",
    status: "running",
    totalHours: 480,
    hoursSinceMaintenance: 180,
    maintenanceInterval: 200,
    temperature: 78,
    maxSafeTemp: 85,
    installationDate: "2025-01-10",
    spareParts: [
      {
        id: "sp_1_1",
        name: "سير ناقل تروس ميكانيكي حراري",
        code: "SP-ROT-BELT",
        stock: 4,
        cost: 750,
      },
      {
        id: "sp_1_2",
        name: "شمعة تسخين من السيراميك المقسى",
        code: "SP-ROT-HEAT",
        stock: 2,
        cost: 1200,
      },
      {
        id: "sp_1_3",
        name: "قفل أمان بوابة الفرن الهيدروليكي",
        code: "SP-ROT-LOCK",
        stock: 1,
        cost: 450,
      },
    ],
    breakdowns: [
      {
        id: "bd_1_1",
        date: "2026-04-12T10:30:00Z",
        title: "تذبذب في درجة الحرارة",
        description:
          "انخفاض مفاجئ ومستمر في الحرارة بمقدار 10 درجات مئوية أثناء التشغيل الكامل",
        severity: "medium",
        status: "resolved",
        reporter: "سلامة حسن",
      },
    ],
    repairHistory: [
      {
        id: "rp_1_1",
        date: "2026-04-12T14:00:00Z",
        technician: "المهندس فاروق كمال",
        issue:
          "تذبذب في درجات الحرارة لعدم كفاءة التوصيلات لشمعة التسخين القديمة",
        actionTaken:
          "تنظيف الموصلات الكهربائية واستبدال صمام التوزيع وإعادة المعايرة الحرارية بالليزر",
        sparePartsUsed: [
          {
            partId: "sp_1_3",
            name: "قفل أمان بوابة الفرن الهيدروليكي",
            quantity: 1,
            cost: 450,
          },
        ],
        totalCost: 1100,
      },
    ],
  },
  {
    id: "m_02",
    name: "خلاط التجهيز والمستحلبات الرئيسي",
    code: "MIX-EMUL-02",
    line: "خط تحضير الصلصات والمستحلبات",
    status: "running",
    totalHours: 320,
    hoursSinceMaintenance: 98,
    maintenanceInterval: 100,
    temperature: 84, // Temperature is high (>80) -> Alert!
    maxSafeTemp: 80,
    installationDate: "2025-03-15",
    spareParts: [
      {
        id: "sp_2_1",
        name: "شفرة خلط فولاذية مزدوجة الحواف",
        code: "SP-BLADE-316",
        stock: 2,
        cost: 1350,
      },
      {
        id: "sp_2_2",
        name: "مستشعر حرارة رقمي مغناطيسي ليزري",
        code: "SP-THERMO-DIGI",
        stock: 3,
        cost: 350,
      },
      {
        id: "sp_2_3",
        name: "قشاط محرك مطاطي مسنن ومقاوم للزيت",
        code: "SP-BELT-MIX",
        stock: 5,
        cost: 250,
      },
    ],
    breakdowns: [
      {
        id: "bd_2_1",
        date: "2026-05-20T08:15:00Z",
        title: "اهتزاز وجلبة زائدة في المحرك المعلق",
        description:
          "سماع صوت احتكاك معدني عند التشغيل على السرعة القصوى (المرحلة الثالثة)",
        severity: "medium",
        status: "reported",
        reporter: "مصطفى عيسى",
      },
    ],
    repairHistory: [],
  },
  {
    id: "m_03",
    name: "ماكينة التعبئة والوزن الأوتوماتيكية بالليزر",
    code: "FIL-WGH-03",
    line: "خط التعبئة والتغليف الرئيسي",
    status: "maintenance",
    totalHours: 950,
    hoursSinceMaintenance: 10,
    maintenanceInterval: 300,
    temperature: 38,
    maxSafeTemp: 70,
    installationDate: "2024-09-01",
    spareParts: [
      {
        id: "sp_3_1",
        name: "طقم فوهات ضخ الفولاذ المقاوم للصدأ",
        code: "SP-NOZ-SS",
        stock: 6,
        cost: 450,
      },
      {
        id: "sp_3_2",
        name: "حقل وزن مستشعر ضوئي فوتوني دقيق",
        code: "SP-WGH-OPTI",
        stock: 1,
        cost: 2400,
      },
      {
        id: "sp_3_3",
        name: "حلقة منع تسرب مطاطية فلوتوسينية",
        code: "SP-RING-O",
        stock: 12,
        cost: 80,
      },
    ],
    breakdowns: [
      {
        id: "bd_3_1",
        date: "2025-11-05T13:45:00Z",
        title: "عدم انتظام وزن عبوات التوزيع",
        description:
          "قراءة حساس الوزن تعطي فروقات تصل إلى 5% بالزيادة عن الحد المسموح",
        severity: "medium",
        status: "resolved",
        reporter: "خميس أبو السعد",
      },
    ],
    repairHistory: [
      {
        id: "rp_3_1",
        date: "2025-11-06T10:00:00Z",
        technician: "م. أشرف الجيار",
        issue:
          "اتساخ عدسة الحساس البصري للوزن مع تآكل قليل في الحلقة الهيدروليكية",
        actionTaken:
          "تنظيف وصيانة الحساس الليزري واستبدال 3 حلقات O-Ring وتجربة وضبط المعايرة الصفرية",
        sparePartsUsed: [
          {
            partId: "sp_3_3",
            name: "حلقة منع تسرب مطاطية فلوتوسينية",
            quantity: 3,
            cost: 240,
          },
        ],
        totalCost: 740,
      },
    ],
  },
  {
    id: "m_04",
    name: "جهاز الختم والتغليف الحراري المستمر",
    code: "SHR-WR-04",
    line: "خط التغليف والتعبئة الفرعي",
    status: "emergency", // Sudden stop alert!
    totalHours: 640,
    hoursSinceMaintenance: 312, // Needs maintenance (>300) -> Alert!
    maintenanceInterval: 300,
    temperature: 92, // Heat too high (+ over maintenance limit) -> Multiple alerts!
    maxSafeTemp: 90,
    installationDate: "2024-11-20",
    spareParts: [
      {
        id: "sp_4_1",
        name: "مقاومة تبريد شريط اللحام النحاسي",
        code: "SP-SEAL-HEAT",
        stock: 3,
        cost: 900,
      },
      {
        id: "sp_4_2",
        name: "شفرة قطع حافة حرارية كربيد مقسى",
        code: "SP-CUT-BLADE",
        stock: 2,
        cost: 1100,
      },
      {
        id: "sp_4_3",
        name: "محمل كروي جاف لمروحة التبريد",
        code: "SP-COOL-BEAR",
        stock: 0,
        cost: 350,
      },
    ],
    breakdowns: [
      {
        id: "bd_4_1",
        date: "2026-05-22T09:00:00Z",
        title: "انفجار مصهر مروحة التبريد وموتور السحب",
        description:
          "ماس كهربائي في مبرّد هواء الحزام أدى لتوقف مفاجئ وصعود عمود دخان خفيف مع حرارة مفرطة",
        severity: "critical",
        status: "reported",
        reporter: "سليمان غانم",
      },
    ],
    repairHistory: [],
  },
];

interface LoggedProductionOrder {
  id: string;
  batchNumber: string;
  quantity: number;
  status: "new" | "running" | "on_hold" | "completed" | "cancelled";
  productionLine: string;
  progress: number;
}

interface MachineryMaintenanceProps {
  productionOrders?: LoggedProductionOrder[];
}

export function MachineryMaintenance({
  productionOrders = [],
}: MachineryMaintenanceProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const stateSelectedMachine = selectedMachine;
  const [activeSubTab, setActiveSubTab] = useState<
    "info" | "maintenance" | "breakdowns" | "spare_parts" | "repairs"
  >("info");
  const [showAddNewMachineModal, setShowAddNewMachineModal] = useState(false);

  // Custom interactive overview filters & Central Global Workshop Page
  const [filterStatus, setFilterStatus] = useState<
    "all" | "running" | "overdue" | "emergency"
  >("all");
  const [showGlobalWorkshop, setShowGlobalWorkshop] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalFilterMachineId, setGlobalFilterMachineId] = useState("all");

  // Form State for reporting breakdown
  const [breakdownTitle, setBreakdownTitle] = useState("");
  const [breakdownDesc, setBreakdownDesc] = useState("");
  const [breakdownSeverity, setBreakdownSeverity] = useState<
    "low" | "medium" | "critical"
  >("low");
  const [breakdownReporter, setBreakdownReporter] = useState("");

  // Form State for spare parts
  const [newPartName, setNewPartName] = useState("");
  const [newPartCode, setNewPartCode] = useState("");
  const [newPartStock, setNewPartStock] = useState<number>(0);
  const [newPartCost, setNewPartCost] = useState<number>(0);

  // Form State for manual repair log
  const [repairTechnician, setRepairTechnician] = useState("");
  const [repairIssue, setRepairIssue] = useState("");
  const [repairAction, setRepairAction] = useState("");
  const [repairSelectPartId, setRepairSelectPartId] = useState("");
  const [repairSelectPartQty, setRepairSelectPartQty] = useState<number>(1);
  const [repairSelectedPartsList, setRepairSelectedPartsList] = useState<
    { partId: string; name: string; quantity: number; cost: number }[]
  >([]);
  const [repairLaborCost, setRepairLaborCost] = useState<number>(0);

  // Form State for adding new machine
  const [newMacName, setNewMacName] = useState("");
  const [newMacCode, setNewMacCode] = useState("");
  const [newMacLine, setNewMacLine] = useState("");
  const [newMacInterval, setNewMacInterval] = useState<number>(200);
  const [newMacMaxTemp, setNewMacMaxTemp] = useState<number>(80);
  const [newMacStatus, setNewMacStatus] =
    useState<Machine["status"]>("running");

  const [isMachinesLoading, setIsMachinesLoading] = useState(true);

  // Load and save to LocalStorage/Database
  useEffect(() => {
    const load = async () => {
      const saved = await databaseStorage.getItem<Machine[]>("remo_pro_machines", DEFAULT_MACHINES);
      setMachines(saved);
      setIsMachinesLoading(false);
    };
    load();
  }, []);

  const saveToStorage = async (updatedMachines: Machine[]) => {
    setMachines(updatedMachines);
    await databaseStorage.setItem("remo_pro_machines", updatedMachines);
  };

  // Helper function to match line names safely
  const isLineMatching = (macLine: string, orderLine: string) => {
    if (!macLine || !orderLine) return false;
    const cleanM = macLine.trim().replace(/\s+/g, " ");
    const cleanO = orderLine.trim().replace(/\s+/g, " ");
    return (
      cleanM === cleanO || cleanM.includes(cleanO) || cleanO.includes(cleanM)
    );
  };

  // Generate sequential next custom machine code starting with EQP
  const getNextMachineCode = () => {
    let maxIdx = 4;
    machines.forEach((mac) => {
      const match = mac.code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdx) {
          maxIdx = num;
        }
      }
    });
    const nextNum = maxIdx + 1;
    return `EQP-${String(nextNum).padStart(2, "0")}`;
  };

  // Auto generate machine code on load of add machine modal
  useEffect(() => {
    if (showAddNewMachineModal && !newMacCode) {
      setNewMacCode(getNextMachineCode());
    }
  }, [showAddNewMachineModal, machines, newMacCode]);

  // Compute live active, hours connected state of each machine in real-time
  const computedMachines = machines.map((mac) => {
    // Check if the production line of the machine currently has active running orders
    const activeOrdersOnLine = productionOrders.filter(
      (order) =>
        order.status === "running" &&
        isLineMatching(mac.line, order.productionLine),
    );
    const isLineRunning = activeOrdersOnLine.length > 0;

    // Calculate production run hours from orders on this line
    let extraHours = 0;
    productionOrders.forEach((order) => {
      if (isLineMatching(mac.line, order.productionLine)) {
        if (order.status === "completed") {
          // Completed order adds ~1 hour for every 10 items, min 2 hours
          extraHours += Math.max(2, Math.round(order.quantity * 0.15));
        } else if (order.status === "running") {
          // Running order adds hours according to percentage of progress
          const estimatedTotal = Math.max(2, Math.round(order.quantity * 0.15));
          extraHours += Math.round((order.progress / 100) * estimatedTotal);
        }
      }
    });

    const displayTotalHours = mac.totalHours + extraHours;
    const displayHoursSinceMaintenance = mac.hoursSinceMaintenance + extraHours;

    // Resolve live status:
    // If machine is healthy (normal 'running' or 'on_hold' idle state),
    // it automatically follows the production line run status!
    // But if there is an active emergency, broken, or maintenance state, keep it.
    let resolvedStatus = mac.status;
    if (mac.status === "running" || mac.status === "on_hold") {
      resolvedStatus = isLineRunning ? "running" : "on_hold";
    }

    return {
      ...mac,
      status: resolvedStatus,
      totalHours: displayTotalHours,
      hoursSinceMaintenance: displayHoursSinceMaintenance,
      originalStatus: mac.status,
      isLineRunning,
      activeOrdersOnLine,
      extraHours,
    };
  });

  // Filter computed machines list based on selected KPI status filter
  const filteredMachines = computedMachines.filter((mac) => {
    if (filterStatus === "running") return mac.status === "running";
    if (filterStatus === "overdue")
      return mac.hoursSinceMaintenance >= mac.maintenanceInterval;
    if (filterStatus === "emergency")
      return mac.status === "emergency" || mac.status === "broken";
    return true;
  });

  // Helper calculation values mapped over computedMachines
  const totalMachines = computedMachines.length;
  const runningMachines = computedMachines.filter(
    (m) => m.status === "running",
  ).length;
  const maintenanceOverdue = computedMachines.filter(
    (m) => m.hoursSinceMaintenance >= m.maintenanceInterval,
  );
  const emergencyStops = computedMachines.filter(
    (m) => m.status === "emergency" || m.status === "broken",
  );
  const highTempMachines = computedMachines.filter(
    (m) => m.temperature >= m.maxSafeTemp,
  );

  // Sum total spent on maintenance/repairs
  const totalRepairCost = computedMachines.reduce((sum, mac) => {
    const macRepairsSum = mac.repairHistory.reduce(
      (s, r) => s + r.totalCost,
      0,
    );
    return sum + macRepairsSum;
  }, 0);

  // Actions
  const handleAddHours = (macId: string, hours: number) => {
    const updated = machines.map((mac) => {
      if (mac.id === macId) {
        const nextHours = mac.totalHours + hours;
        const nextSince = mac.hoursSinceMaintenance + hours;
        return {
          ...mac,
          totalHours: nextHours,
          hoursSinceMaintenance: nextSince,
          // if heat rises high as simulator
          temperature: Math.min(100, mac.temperature + Math.floor(hours / 2)),
        };
      }
      return mac;
    });
    saveToStorage(updated);
    if (selectedMachine && selectedMachine.id === macId) {
      setSelectedMachine(updated.find((x) => x.id === macId) || null);
    }
  };

  const handleCoolDown = (macId: string) => {
    const updated = machines.map((mac) => {
      if (mac.id === macId) {
        return { ...mac, temperature: Math.max(35, mac.maxSafeTemp - 15) };
      }
      return mac;
    });
    saveToStorage(updated);
    if (selectedMachine && selectedMachine.id === macId) {
      setSelectedMachine(updated.find((x) => x.id === macId) || null);
    }
  };

  const handleToggleEmergencyStop = (macId: string) => {
    const updated = machines.map((mac) => {
      if (mac.id === macId) {
        const nextStatus: Machine["status"] = mac.status === "emergency" ? "running" : "emergency";
        return {
          ...mac,
          status: nextStatus,
          // if stopped cold, cool down temperature right away
          temperature:
            nextStatus === "emergency" ? Math.min(95, mac.temperature + 5) : 40,
        };
      }
      return mac;
    });
    saveToStorage(updated);
    if (selectedMachine && selectedMachine.id === macId) {
      setSelectedMachine(updated.find((x) => x.id === macId) || null);
    }
  };

  const handlePerformMaintenance = (macId: string) => {
    const updated = machines.map((mac) => {
      if (mac.id === macId) {
        const nextHistory: RepairLog = {
          id: `rp_maint_${Date.now()}`,
          date: new Date().toISOString(),
          technician: "فني الصيانة الداخلي",
          issue: "دورة الصيانة والتشغيل الدورية الوقائية",
          actionTaken:
            "إصلاح دوري وقائي كامل، تغيير زيوت التشقيف، معايرة المستشعرات، ومطابقة عداد الساعات المنجز والمتبقي.",
          sparePartsUsed: [],
          totalCost: 0,
        };
        return {
          ...mac,
          status: "running" as const,
          hoursSinceMaintenance: 0,
          temperature: 42,
          repairHistory: [nextHistory, ...mac.repairHistory],
        };
      }
      return mac;
    });
    saveToStorage(updated);
    if (selectedMachine && selectedMachine.id === macId) {
      setSelectedMachine(updated.find((x) => x.id === macId) || null);
    }
  };

  const handleAddNewMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacName || !newMacCode) return;

    const newMachine: Machine = {
      id: `m_custom_${Date.now()}`,
      name: newMacName,
      code: newMacCode,
      line: newMacLine || "خط إنتاج عام",
      status: newMacStatus,
      totalHours: 0,
      hoursSinceMaintenance: 0,
      maintenanceInterval: newMacInterval,
      temperature: 36,
      maxSafeTemp: newMacMaxTemp,
      installationDate: new Date().toISOString().split("T")[0],
      spareParts: [],
      repairHistory: [],
      breakdowns: [],
    };

    const next = [...machines, newMachine];
    saveToStorage(next);
    setShowAddNewMachineModal(false);
    // resetting form
    setNewMacName("");
    setNewMacCode("");
    setNewMacLine("");
    setNewMacInterval(200);
    setNewMacMaxTemp(80);
    setNewMacStatus("running");
  };

  const handleDeleteMachine = (macId: string) => {
    if (
      window.confirm("هل أنت متأكد من حذف هذه الماكينة بالكامل من السجلات؟")
    ) {
      const next = machines.filter((m) => m.id !== macId);
      saveToStorage(next);
      setSelectedMachine(null);
    }
  };

  // Submit breakdown log
  const handleReportBreakdown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine || !breakdownTitle) return;

    const newLog: BreakdownLog = {
      id: `bd_custom_${Date.now()}`,
      date: new Date().toISOString(),
      title: breakdownTitle,
      description: breakdownDesc,
      severity: breakdownSeverity,
      status: "reported",
      reporter: breakdownReporter || "مدير التشغيل الفني",
    };

    const updated = machines.map((mac) => {
      if (mac.id === selectedMachine.id) {
        // If critical breakdown reported, status changes to emergency/broken automatically!
        const nextStatus =
          breakdownSeverity === "critical"
            ? "emergency"
            : breakdownSeverity === "medium"
              ? "broken"
              : mac.status;
        return {
          ...mac,
          status: nextStatus as Machine["status"],
          breakdowns: [newLog, ...mac.breakdowns],
        };
      }
      return mac;
    });

    saveToStorage(updated);
    setSelectedMachine(
      updated.find((x) => x.id === selectedMachine.id) || null,
    );
    // clear form
    setBreakdownTitle("");
    setBreakdownDesc("");
    setBreakdownSeverity("low");
    setBreakdownReporter("");
  };

  const handleUpdateBreakdownStatus = (
    bdId: string,
    nextStatus: BreakdownLog["status"],
  ) => {
    if (!selectedMachine) return;

    const updated = machines.map((mac) => {
      if (mac.id === selectedMachine.id) {
        const updatedBreakdowns = mac.breakdowns.map((bd) => {
          if (bd.id === bdId) {
            return { ...bd, status: nextStatus };
          }
          return bd;
        });

        // Determine machine status from breakdown. If all are resolved, return to running.
        const hasUnresolvedCritical = updatedBreakdowns.some(
          (bd) => bd.severity === "critical" && bd.status !== "resolved",
        );
        const hasUnresolvedMedium = updatedBreakdowns.some(
          (bd) => bd.severity === "medium" && bd.status !== "resolved",
        );

        let machineStatus = mac.status;
        if (!hasUnresolvedCritical && !hasUnresolvedMedium) {
          machineStatus = "running";
        } else if (hasUnresolvedCritical) {
          machineStatus = "emergency";
        } else if (hasUnresolvedMedium) {
          machineStatus = "broken";
        }

        return {
          ...mac,
          status: machineStatus,
          breakdowns: updatedBreakdowns,
        };
      }
      return mac;
    });

    saveToStorage(updated);
    setSelectedMachine(
      updated.find((x) => x.id === selectedMachine.id) || null,
    );
  };

  // Add spare part
  const handleAddSparePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine || !newPartName || !newPartCode) return;

    const newPart: SparePart = {
      id: `sp_custom_${Date.now()}`,
      name: newPartName,
      code: newPartCode,
      stock: Number(newPartStock) || 0,
      cost: Number(newPartCost) || 0,
    };

    const updated = machines.map((mac) => {
      if (mac.id === selectedMachine.id) {
        return {
          ...mac,
          spareParts: [...mac.spareParts, newPart],
        };
      }
      return mac;
    });

    saveToStorage(updated);
    setSelectedMachine(
      updated.find((x) => x.id === selectedMachine.id) || null,
    );
    // reset form
    setNewPartName("");
    setNewPartCode("");
    setNewPartStock(0);
    setNewPartCost(0);
  };

  // Parts consumption inside repair log
  const handleAddToRepairParts = () => {
    if (!selectedMachine || !repairSelectPartId) return;
    const part = selectedMachine.spareParts.find(
      (p) => p.id === repairSelectPartId,
    );
    if (!part) return;

    if (part.stock < repairSelectPartQty) {
      alert(
        `الكمية المطلوبة (${repairSelectPartQty}) غير متوفرة في المخزن! الرصيد المتاح: ${part.stock}`,
      );
      return;
    }

    // Check if food already in list
    const existing = repairSelectedPartsList.find(
      (i) => i.partId === repairSelectPartId,
    );
    if (existing) {
      setRepairSelectedPartsList(
        repairSelectedPartsList.map((i) => {
          if (i.partId === repairSelectPartId) {
            return { ...i, quantity: i.quantity + repairSelectPartQty };
          }
          return i;
        }),
      );
    } else {
      setRepairSelectedPartsList([
        ...repairSelectedPartsList,
        {
          partId: repairSelectPartId,
          name: part.name,
          quantity: repairSelectPartQty,
          cost: part.cost,
        },
      ]);
    }
  };

  const handlePostRepairLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine || !repairTechnician || !repairIssue || !repairAction)
      return;

    const partsCost = repairSelectedPartsList.reduce(
      (sum, p) => sum + p.cost * p.quantity,
      0,
    );
    const totalRepairCostValue = partsCost + Number(repairLaborCost);

    const newRepair: RepairLog = {
      id: `rp_custom_${Date.now()}`,
      date: new Date().toISOString(),
      technician: repairTechnician,
      issue: repairIssue,
      actionTaken: repairAction,
      sparePartsUsed: repairSelectedPartsList,
      totalCost: totalRepairCostValue,
    };

    const updated = machines.map((mac) => {
      if (mac.id === selectedMachine.id) {
        // Decrease stock levels of consumed parts
        const nextSpareParts = mac.spareParts.map((sp) => {
          const consumed = repairSelectedPartsList.find(
            (cp) => cp.partId === sp.id,
          );
          if (consumed) {
            return { ...sp, stock: Math.max(0, sp.stock - consumed.quantity) };
          }
          return sp;
        });

        // Automatically resolve any reported/in-progress breakdowns matching the issue keywords!
        const nextBreakdowns = mac.breakdowns.map((bd) => {
          if (bd.status !== "resolved") {
            return { ...bd, status: "resolved" as const };
          }
          return bd;
        });

        return {
          ...mac,
          status: "running" as const, // machine returned to running after repair!
          spareParts: nextSpareParts,
          breakdowns: nextBreakdowns,
          repairHistory: [newRepair, ...mac.repairHistory],
        };
      }
      return mac;
    });

    saveToStorage(updated);
    setSelectedMachine(
      updated.find((x) => x.id === selectedMachine.id) || null,
    );

    // reset Form
    setRepairTechnician("");
    setRepairIssue("");
    setRepairAction("");
    setRepairSelectPartId("");
    setRepairSelectPartQty(1);
    setRepairSelectedPartsList([]);
    setRepairLaborCost(0);
    alert(
      "تم تدوين تقرير الإصلاح الفني وتحديث أرصدة قطع الغيار المستهلكة بنجاح!",
    );
  };

  return (
    <div className="space-y-6">
      {!showGlobalWorkshop && (
        <>
          {/* Overview Cards Panel JSON metrics dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* KPI 1 */}
            <div
              onClick={() => {
                setFilterStatus("all");
                setShowGlobalWorkshop(false);
              }}
              className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md cursor-pointer select-none group ${
                filterStatus === "all" && !showGlobalWorkshop
                  ? "bg-slate-50 border-slate-400 ring-2 ring-slate-500/20 translate-y-[-2px]"
                  : "bg-white border-slate-200/70 hover:border-slate-350"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">
                  إجمالي الماكينات
                </span>
                <span className="text-2xl font-black text-slate-800 block">
                  {totalMachines}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold block group-hover:text-amber-500 transition-colors">
                  تصفية الكل
                </span>
              </div>
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105 ${
                  filterStatus === "all" && !showGlobalWorkshop
                    ? "bg-amber-100 text-amber-600 border-amber-200"
                    : "bg-slate-50 text-slate-500 border-slate-100"
                }`}
              >
                <Cog
                  className={`w-5 h-5 ${filterStatus === "all" && !showGlobalWorkshop ? "animate-spin" : ""}`}
                />
              </div>
            </div>

            {/* KPI 2 */}
            <div
              onClick={() => {
                setFilterStatus("running");
                setShowGlobalWorkshop(false);
              }}
              className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md cursor-pointer select-none group ${
                filterStatus === "running" && !showGlobalWorkshop
                  ? "bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-500/20 translate-y-[-2px]"
                  : "bg-white border-slate-200/70 hover:border-emerald-300"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">
                  قيد التشغيل الفعلي
                </span>
                <span className="text-2xl font-black text-emerald-600 block">
                  {runningMachines}
                </span>
                <span className="text-[9px] text-emerald-500 font-semibold block">
                  فلترة النشطة
                </span>
              </div>
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105 ${
                  filterStatus === "running" && !showGlobalWorkshop
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                }`}
              >
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
            </div>

            {/* KPI 3 */}
            <div
              onClick={() => {
                setFilterStatus("overdue");
                setShowGlobalWorkshop(false);
              }}
              className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md cursor-pointer select-none group ${
                filterStatus === "overdue" && !showGlobalWorkshop
                  ? "bg-amber-50/50 border-amber-400 ring-2 ring-amber-500/20 translate-y-[-2px]"
                  : "bg-white border-slate-200/70 hover:border-amber-300"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">
                  تعدى حد العداد
                </span>
                <span className="text-2xl font-black text-amber-600 block">
                  {maintenanceOverdue.length}
                </span>
                <span className="text-[9px] text-amber-500 font-semibold block">
                  فلترة المستحقة
                </span>
              </div>
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105 ${
                  filterStatus === "overdue" && !showGlobalWorkshop
                    ? "bg-amber-500 text-white border-amber-400"
                    : "bg-amber-50 text-amber-600 border-amber-100/50"
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4 */}
            <div
              onClick={() => {
                setFilterStatus("emergency");
                setShowGlobalWorkshop(false);
              }}
              className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md cursor-pointer select-none group ${
                filterStatus === "emergency" && !showGlobalWorkshop
                  ? "bg-rose-50/50 border-rose-450 ring-2 ring-rose-500/20 translate-y-[-2px]"
                  : "bg-white border-slate-200/70 hover:border-rose-300"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">
                  أعطال وطوارئ نشطة
                </span>
                <span className="text-2xl font-black text-rose-600 block">
                  {emergencyStops.length}
                </span>
                <span className="text-[9px] text-rose-500 font-semibold block">
                  فلترة الطوارئ
                </span>
              </div>
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105 ${
                  filterStatus === "emergency" && !showGlobalWorkshop
                    ? "bg-rose-600 text-white border-rose-500"
                    : "bg-rose-50 text-rose-600 border-rose-100/50"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 5 */}
            <div
              onClick={() => {
                setShowGlobalWorkshop(true);
                setSelectedMachine(null);
              }}
              className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md col-span-2 lg:col-span-1 cursor-pointer select-none group ${
                showGlobalWorkshop
                  ? "bg-indigo-50/65 border-indigo-400 ring-2 ring-indigo-500/20 translate-y-[-2px]"
                  : "bg-white border-slate-200/70 hover:border-indigo-300"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block group-hover:text-indigo-600">
                  مصاريف وصيانة الورشة
                </span>
                <span className="text-xl font-black text-indigo-700 block">
                  {Number(totalRepairCost || 0).toLocaleString()} ج.م
                </span>
                <span className="text-[9px] text-indigo-400 font-semibold block transition-colors group-hover:text-indigo-650">
                  انقر للفتح والتحليل الفني ←
                </span>
              </div>
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110 ${
                  showGlobalWorkshop
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "bg-indigo-50 text-indigo-600 border-indigo-100/50"
                }`}
              >
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Critical System Warnings Box */}
          {(maintenanceOverdue.length > 0 ||
            highTempMachines.length > 0 ||
            emergencyStops.length > 0) && (
            <div className="bg-gradient-to-br from-rose-50/80 to-amber-50/50 border-r-4 border-rose-500 rounded-[24px] p-5 shadow-sm space-y-3 font-sans">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 animate-bounce" />
                <h4 className="text-sm font-black text-slate-800">
                  تنبيهات حرجة من مستشعرات الآلات وخطوط الإنتاج
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 !mt-3 text-xs font-bold leading-relaxed">
                {emergencyStops.map((mac) => (
                  <div
                    key={`stop-${mac.id}`}
                    className="bg-white/80 border border-rose-100 p-3 rounded-xl flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-rose-600 rounded-full animate-ping"></div>
                      <span className="text-rose-700">
                        ⛔ توقف طوارئ: {mac.name} ({mac.code})
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMachine(mac);
                        setActiveSubTab("breakdowns");
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] whitespace-nowrap"
                    >
                      فحص البلاغات
                    </button>
                  </div>
                ))}
                {highTempMachines.map((mac) => (
                  <div
                    key={`temp-${mac.id}`}
                    className="bg-white/80 border border-amber-100 p-3 rounded-xl flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4.5 h-4.5 text-amber-600 animate-pulse animate-bounce" />
                      <span className="text-amber-700">
                        🔥 ارتفاع حرارة: {mac.name} ({mac.temperature}°م)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMachine(mac);
                        setActiveSubTab("info");
                      }}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] whitespace-nowrap"
                    >
                      تبريد فوري
                    </button>
                  </div>
                ))}
                {maintenanceOverdue.map((mac) => (
                  <div
                    key={`maint-${mac.id}`}
                    className="bg-white/80 border border-amber-100 p-3 rounded-xl flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4.5 h-4.5 text-slate-500 animate-spin whitespace-nowrap" />
                      <span className="text-amber-800">
                        ⚠️ مستحقة: عداد {mac.name} ({mac.hoursSinceMaintenance}/
                        {mac.maintenanceInterval}س)
                      </span>
                    </div>
                    <button
                      onClick={() => handlePerformMaintenance(mac.id)}
                      className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-[10px] whitespace-nowrap"
                    >
                      تأكيد صيانة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main header spanning 100% of the screen */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                منظومة الماكينات والمعدات المستقلة
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تتبع ساعات العمل المباشرة، وقراءة درجات الحرارة وصلاحية الأجزاء،
                ومستويات المواد وصيانة الهلاك في المصنع.
              </p>
            </div>
            <button
              onClick={() => setShowAddNewMachineModal(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-white text-xs font-black rounded-2xl flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 text-white" />
              إضافة ماكينة تشغيل جديدة
            </button>
          </div>
        </>
      )}

      {/* Main Grid: Left is list & cards of machines, Right/Detailed Section is detailed config */}
      {showGlobalWorkshop ? (
        <div
          className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6 animate-fadeIn text-right"
          dir="rtl"
        >
          {/* Centralized Global Workshop and Expenses Dashboard */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/40">
                <DollarSign className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">
                  الورشة المركزية والتحليل المالي للصيانة
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  المراجعة التفصيلية لكافة حركات خصم قطع الغيار ومصاريف الصيانة
                  والتشكيل المالي لمختلف الأصول والآلات.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGlobalWorkshop(false)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-1.5 transition shadow-sm"
            >
              العودة لشجرة الماكينات
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-Overview inside Global Workshop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
            <div className="bg-indigo-50/40 border border-indigo-100/40 p-5 rounded-3xl flex flex-col justify-between">
              <span className="text-[10px] text-indigo-500 font-bold block">
                إجمالي مصاريف الصيانة والتشغيل
              </span>
              <span className="text-2xl font-black text-indigo-700 block mt-2">
                {Number(totalRepairCost || 0).toLocaleString()} ج.م
              </span>
              <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                تراكمي جميع الماكينات وخطوط الإنتاج
              </span>
            </div>

            <div className="bg-emerald-50/40 border border-emerald-100/40 p-5 rounded-3xl flex flex-col justify-between">
              <span className="text-[10px] text-emerald-600 font-bold block">
                مجموع تدوينات وتقارير الإصلاح
              </span>
              <span className="text-2xl font-black text-emerald-700 block mt-2">
                {computedMachines.reduce(
                  (sum, m) => sum + m.repairHistory.length,
                  0,
                )}{" "}
                تقرير
              </span>
              <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                جرد إلكتروني مؤرشف بالكامل
              </span>
            </div>

            <div className="bg-amber-50/40 border border-amber-100/40 p-5 rounded-3xl flex flex-col justify-between">
              <span className="text-[10px] text-amber-600 font-bold block">
                بلاغات بانتظار تأكيد الإصلاح
              </span>
              <span className="text-2xl font-black text-amber-700 block mt-2">
                {computedMachines.reduce(
                  (sum, m) =>
                    sum +
                    m.breakdowns.filter((b) => b.status !== "resolved").length,
                  0,
                )}{" "}
                بلاغات نشطة
              </span>
              <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                قيد إجراءات التشخيص والعمل الفوري
              </span>
            </div>
          </div>

          {/* Core Repair Ledger and Filters */}
          <div className="space-y-4 border-t border-slate-100 pt-5 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150/50">
              <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                دفتر حركات ومصاريف الإصلاح المتكامل برمجياً
              </h4>

              {/* Filtering Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto w-full md:w-auto">
                <div className="relative flex-1 md:w-60">
                  <input
                    type="text"
                    value={globalSearchTerm ?? ""}
                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                    placeholder="ابحث بالفني، العطل أو الإجراء..."
                    className="w-full pl-3 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl outline-none bg-white font-semibold focus:border-indigo-400 transition"
                  />
                  {/* Search Icon */}
                  <span className="absolute right-2.5 top-2 hover:text-slate-650 text-slate-400 text-xs">
                    🔍
                  </span>
                </div>

                <select
                  value={globalFilterMachineId ?? ""}
                  onChange={(e) => setGlobalFilterMachineId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs text-slate-705 bg-white border border-slate-200 rounded-xl outline-none font-bold"
                >
                  <option value="all">كل الماكينات والمعدات</option>
                  {computedMachines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Repairs Ledger Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              {(() => {
                // Collect repairs with machine contexts
                const allRepairs: Array<
                  RepairLog & {
                    machineName: string;
                    machineCode: string;
                    machineId: string;
                  }
                > = [];
                computedMachines.forEach((m) => {
                  m.repairHistory.forEach((r) => {
                    allRepairs.push({
                      ...r,
                      machineName: m.name,
                      machineCode: m.code,
                      machineId: m.id,
                    });
                  });
                });

                // Sort newest first
                const sortedRepairs = allRepairs.sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                );

                // Filter
                const filteredRepairs = sortedRepairs.filter((r) => {
                  const matchMachine =
                    globalFilterMachineId === "all" ||
                    r.machineId === globalFilterMachineId;
                  const searchLower = globalSearchTerm.toLowerCase();
                  const matchSearch =
                    !globalSearchTerm ||
                    r.technician.toLowerCase().includes(searchLower) ||
                    r.issue.toLowerCase().includes(searchLower) ||
                    r.actionTaken.toLowerCase().includes(searchLower) ||
                    r.machineName.toLowerCase().includes(searchLower);
                  return matchMachine && matchSearch;
                });

                if (filteredRepairs.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 font-bold bg-slate-50/50">
                      لا توجد سجلات إصلاح مطابقة لخيارات البحث المحددة.
                    </div>
                  );
                }

                return (
                  <table className="w-full text-right text-xs leading-normal border-collapse font-sans">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold text-[10px]">
                        <th className="p-3">التاريخ واليوم</th>
                        <th className="p-3">اسم الماكينة والأصل</th>
                        <th className="p-3">مهندس/فني الصيانة القائم</th>
                        <th className="p-3">العيب والخلل المكتشف</th>
                        <th className="p-3">
                          الإجراء المعالج والخطوات المنفذة
                        </th>
                        <th className="p-3 text-left">التكلفة الإجمالية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRepairs.map((r, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50/60 font-bold transition-colors"
                        >
                          <td className="p-3 text-slate-400 text-[10px] font-mono whitespace-nowrap">
                            {new Date((r.date) || 0).toLocaleString("ar-EG", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="text-slate-800 block text-xs">
                              {r.machineName}
                            </span>
                            <span className="text-slate-400 text-[10px] font-semibold">
                              {r.machineCode}
                            </span>
                          </td>
                          <td className="p-3 text-slate-650 font-bold">
                            <span className="inline-flex items-center gap-1 mt-1 bg-slate-100 px-2 py-0.5 rounded-lg text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              {r.technician}
                            </span>
                          </td>
                          <td
                            className="p-3 text-slate-550 max-w-xs truncate font-sans"
                            title={r.issue}
                          >
                            {r.issue}
                          </td>
                          <td
                            className="p-3 text-slate-500 max-w-xs truncate font-sans"
                            title={r.actionTaken}
                          >
                            {r.actionTaken}
                          </td>
                          <td className="p-3 text-left text-indigo-600 text-xs font-black whitespace-nowrap">
                            {Number(r.totalCost || 0).toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* Spare Parts Warning Status section */}
          <div className="border-t border-slate-100 pt-5 space-y-3 font-sans">
            <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 text-rose-600">
              <Package className="w-4 h-4" />
              تنبيه مستويات مخزون قطع الغيار ومعدلات الهلاك في المستودعات
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(() => {
                const lowStockParts: Array<{
                  partName: string;
                  partCode: string;
                  stock: number;
                  macName: string;
                }> = [];
                computedMachines.forEach((m) => {
                  m.spareParts.forEach((p) => {
                    if (p.stock <= 1) {
                      lowStockParts.push({
                        partName: p.name,
                        partCode: p.code,
                        stock: p.stock,
                        macName: m.name,
                      });
                    }
                  });
                });

                if (lowStockParts.length === 0) {
                  return (
                    <div className="col-span-full py-4 text-center text-teal-600 font-bold bg-teal-50 px-4 rounded-2xl border border-teal-100 text-xs">
                      ✓ جميع أرصدة قطع الغيار آمنة وتكفي احتياجات الصيانة
                      الفورية!
                    </div>
                  );
                }

                return lowStockParts.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-rose-50/30 border border-rose-100 p-4 rounded-2xl space-y-2 relative overflow-hidden text-right"
                    dir="rtl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-mono font-bold">
                          {item.partCode}
                        </span>
                        <h5 className="font-black text-rose-800 text-xs mt-0.5">
                          {item.partName}
                        </h5>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${item.stock === 0 ? "bg-rose-150 text-rose-700 animate-pulse" : "bg-amber-100 text-amber-700"}`}
                      >
                        {item.stock === 0 ? "منعدم الرصيد!" : "رصيد حرج"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-550 font-semibold leading-normal">
                      تابع لماكينة:{" "}
                      <span className="text-slate-700 font-bold">
                        {item.macName}
                      </span>
                    </p>

                    <div className="w-full bg-slate-200/50 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${item.stock === 0 ? 0 : 25}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-rose-600 font-bold block">
                      الرصيد المتاح حالياً: {item.stock} وحدة فقط
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={
            selectedMachine
              ? "grid grid-cols-1 xl:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {/* Machinery Grid Cards (2 columns width on XL when selectedMachine is active) */}
          <div
            className={
              selectedMachine ? "xl:col-span-2 space-y-4" : "space-y-4"
            }
          >
            <div
              className={
                selectedMachine
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                  : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              }
            >
              {filteredMachines.map((mac) => {
                const overdueRatio =
                  (mac.hoursSinceMaintenance / mac.maintenanceInterval) * 100;
                const hasAlert =
                  mac.hoursSinceMaintenance >= mac.maintenanceInterval ||
                  mac.temperature >= mac.maxSafeTemp ||
                  mac.status === "emergency";

                return (
                  <div
                    key={mac.id}
                    className={`bg-white rounded-3xl border transition-all duration-300 p-5 space-y-4 flex flex-col justify-between relative overflow-hidden group ${
                      selectedMachine?.id === mac.id
                        ? "ring-2 ring-amber-500 border-amber-305 shadow-md translate-x-1.5"
                        : "border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md"
                    }`}
                  >
                    {/* Status Badges */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block tracking-wider font-mono">
                          {mac.code}
                        </span>
                        <h4 className="font-bold text-sm text-slate-800 group-hover:text-amber-600 transition-colors mt-0.5">
                          {mac.name}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {mac.status === "running" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                            دوران نشط
                          </span>
                        )}
                        {mac.status === "maintenance" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-bold">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                            تحت الصيانة
                          </span>
                        )}
                        {mac.status === "broken" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold">
                            ⚠️ معطلة فنياً
                          </span>
                        )}
                        {mac.status === "emergency" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold animate-pulse">
                            ⛔ إيقاف طوارئ مفاجئ
                          </span>
                        )}
                        {mac.status === "on_hold" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                            خارج التشغيل
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line info */}
                    <div className="bg-slate-50 p-2.5 text-[11px] font-bold text-slate-500 rounded-xl flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        <span>الخط الإداري: {mac.line}</span>
                      </div>
                      {mac.isLineRunning ? (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded font-extrabold animate-pulse">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          <span>
                            الخط ينتج حالياً ⚡ أوردر:{" "}
                            {mac.activeOrdersOnLine
                              .map((o) => o.batchNumber)
                              .join(", ")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100/50 px-2 py-1 rounded">
                          <span>الخط متوقف حالياً (تلقائي)</span>
                        </div>
                      )}
                    </div>

                    {/* Metrics details */}
                    <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed border-t border-b border-dashed border-slate-100 py-3 font-semibold">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold">
                          إجمالي ساعات العمل
                        </span>
                        <span className="text-slate-800 text-sm font-extrabold flex items-center gap-1 leading-none pt-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{mac.totalHours} ساعة</span>
                          {mac.extraHours > 0 && (
                            <span
                              className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1 py-0.5 rounded font-black animate-pulse"
                              title="ساعات مضافة آلياً من حركة الإنتاج الحالية"
                            >
                              + {mac.extraHours}س
                            </span>
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold">
                          درجة الحرارة الحالية
                        </span>
                        <span
                          className={`text-sm font-extrabold flex items-center gap-1 ${mac.temperature >= mac.maxSafeTemp ? "text-rose-600" : "text-slate-700"}`}
                        >
                          <Thermometer
                            className={`w-3.5 h-3.5 ${mac.temperature >= mac.maxSafeTemp ? "text-rose-500 animate-pulse" : "text-slate-400"}`}
                          />
                          {mac.temperature}°م
                        </span>
                      </div>
                    </div>

                    {/* Maintenance Interval Gauge */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-400">
                          استهلاك الزيوت وصلاحية الأجزاء (العداد الحالي)
                        </span>
                        <span
                          className={`${overdueRatio >= 100 ? "text-rose-600 font-extrabold animate-pulse" : "text-slate-650"}`}
                        >
                          {mac.hoursSinceMaintenance} /{" "}
                          {mac.maintenanceInterval} ساعة
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            overdueRatio >= 100
                              ? "bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse"
                              : overdueRatio >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, overdueRatio)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Actions for manual simulation of hours & status controls */}
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100/50">
                      <div className="flex items-center gap-1">
                        {/* Interactive work simulator */}
                        <button
                          title="محاكاة تشغيل وإضافة 10 ساعات عمل للعداد"
                          onClick={() => handleAddHours(mac.id, 10)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>تشغيل +10س</span>
                        </button>

                        {/* Hot Temperature cooldown */}
                        {mac.temperature >= mac.maxSafeTemp && (
                          <button
                            title="تفعيل تبريد مروحي إجباري للحرارة"
                            onClick={() => handleCoolDown(mac.id)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                            <span>تبريد وتهوية</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Emergency Switch */}
                        <button
                          title={
                            mac.status === "emergency"
                              ? "إعادة سحب التوقف وبدء التشغيل"
                              : "إقفال طوارئ مفاجئ"
                          }
                          onClick={() => handleToggleEmergencyStop(mac.id)}
                          className={`p-2 rounded-lg text-xs font-black transition ${
                            mac.status === "emergency"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        {/* Select details */}
                        <button
                          onClick={() => {
                            setSelectedMachine(mac);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-0.5"
                        >
                          <span>ورشة الصيانة والتفاصيل</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diagnostic Workshop / Machine detailed workspace Panel */}
          {selectedMachine && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col relative self-start animate-fadeIn">
              {(() => {
                const selectedMachineObj = stateSelectedMachine
                  ? computedMachines.find(
                      (m) => m.id === stateSelectedMachine.id,
                    ) || stateSelectedMachine
                  : null;
                if (!selectedMachineObj) {
                  return null;
                }
                const selectedMachineObjTyped =
                  selectedMachineObj as Machine & {
                    isLineRunning: boolean;
                    activeOrdersOnLine: LoggedProductionOrder[];
                    extraHours: number;
                  };
                const selectedMachine = selectedMachineObjTyped;
                return (
                  <>
                    {/* Header Info */}
                    <div className="relative border-b border-slate-100 pb-5 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono block font-bold">
                            {selectedMachine.code}
                          </span>
                          <h3 className="font-extrabold text-slate-800 text-base">
                            {selectedMachine.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedMachine(null)}
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 text-xs font-bold"
                        >
                          إغلاق
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">
                        تم التركيب والتشغيل الفعلي في:{" "}
                        {selectedMachine.installationDate}
                      </p>

                      {/* Sub Tab Navigation inside panel */}
                      <div className="flex border-b border-slate-100 gap-1 overflow-x-auto pt-4 !mb-[-20px]">
                        <button
                          onClick={() => setActiveSubTab("info")}
                          className={`pb-2.5 px-2 text-xs font-black border-b-2 whitespace-nowrap transition-all ${activeSubTab === "info" ? "border-amber-500 text-amber-500" : "border-transparent text-slate-400 hover:text-slate-700"}`}
                        >
                          العداد والتحكم
                        </button>
                        <button
                          onClick={() => setActiveSubTab("maintenance")}
                          className={`pb-2.5 px-2 text-xs font-black border-b-2 whitespace-nowrap transition-all ${activeSubTab === "maintenance" ? "border-amber-500 text-amber-500" : "border-transparent text-slate-400 hover:text-slate-700"}`}
                        >
                          الصيانة الدورية
                        </button>
                        <button
                          onClick={() => setActiveSubTab("breakdowns")}
                          className={`pb-2.5 px-2 text-xs font-black border-b-2 whitespace-nowrap transition-all ${activeSubTab === "breakdowns" ? "border-amber-500 text-amber-500" : "border-transparent text-slate-400 hover:text-slate-500"}`}
                        >
                          بلاغ أعطال (
                          {
                            selectedMachine.breakdowns.filter(
                              (b) => b.status !== "resolved",
                            ).length
                          }
                          )
                        </button>
                        <button
                          onClick={() => setActiveSubTab("spare_parts")}
                          className={`pb-2.5 px-2 text-xs font-black border-b-2 whitespace-nowrap transition-all ${activeSubTab === "spare_parts" ? "border-amber-500 text-amber-500" : "border-transparent text-slate-400 hover:text-slate-500"}`}
                        >
                          قطع الغيار
                        </button>
                        <button
                          onClick={() => setActiveSubTab("repairs")}
                          className={`pb-2.5 px-2 text-xs font-black border-b-2 whitespace-nowrap transition-all ${activeSubTab === "repairs" ? "border-amber-500 text-amber-500" : "border-transparent text-slate-400 hover:text-slate-500"}`}
                        >
                          سجل الإصلاح ({selectedMachine.repairHistory.length})
                        </button>
                      </div>
                    </div>

                    {/* workshop subpanels content */}
                    <div className="space-y-4 pt-1 flex-1 overflow-y-auto max-h-[500px]">
                      {/* SUBPANEL 1: CONTROL & STATISTICS */}
                      {activeSubTab === "info" && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1 border-b border-slate-50 pb-2">
                            <Sliders className="w-4 h-4 text-amber-500" />
                            محاكاة أداء وقراءات المستشعرات المباشرة
                          </h4>

                          {/* Work hours slider/input simulator */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                            <label className="text-xs font-bold text-slate-600 block">
                              إضافة ساعات تشغيل إضافية للعداد:
                            </label>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleAddHours(selectedMachine.id, 5)
                                }
                                className="flex-1 py-1 px-2 border border-slate-200 hover:bg-slate-200/50 rounded-lg text-xs font-bold text-slate-700 bg-white"
                              >
                                +5 ساعة
                              </button>
                              <button
                                onClick={() =>
                                  handleAddHours(selectedMachine.id, 24)
                                }
                                className="flex-1 py-1 px-2 border border-slate-200 hover:bg-slate-200/50 rounded-lg text-xs font-bold text-slate-700 bg-white"
                              >
                                +24 ساعة (يوم)
                              </button>
                              <button
                                onClick={() =>
                                  handleAddHours(selectedMachine.id, 100)
                                }
                                className="flex-1 py-1 px-2 border border-slate-200 hover:bg-slate-200/50 rounded-lg text-xs font-bold text-slate-700 bg-white"
                              >
                                +100 ساعة
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-normal leading-normal">
                              * محاكاة ساعات التشغيل تؤدي مباشرةً لارتفاع مستوى
                              الاستخدام من دورة الزيوت وتلقي تنبيه الصيانة
                              الدورية بعد انقضاء المدة.
                            </span>
                          </div>

                          {/* Simulated Temp Controls */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-105 space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-650">
                              <span>زيادة درجة الحرارة للمحاكاة:</span>
                              <span
                                className={
                                  selectedMachine.temperature >=
                                  selectedMachine.maxSafeTemp
                                    ? "text-rose-600 font-extrabold animate-pulse"
                                    : ""
                                }
                              >
                                {selectedMachine.temperature}°م / الأقصى{" "}
                                {selectedMachine.maxSafeTemp}°م
                              </span>
                            </div>
                            <input
                              type="range"
                              min="30"
                              max="110"
                              value={selectedMachine.temperature ?? ""}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updated = machines.map((mac) => {
                                  if (mac.id === selectedMachine.id) {
                                    return { ...mac, temperature: val };
                                  }
                                  return mac;
                                });
                                saveToStorage(updated);
                                setSelectedMachine(
                                  updated.find(
                                    (x) => x.id === selectedMachine.id,
                                  ) || null,
                                );
                              }}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                              <span>حرارة تبريد جافة (30°م)</span>
                              <span>ارتفاع فوق الحد (110°م)</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleCoolDown(selectedMachine.id)
                                }
                                className="w-full py-1.5 bg-sky-50 text-sky-600 text-xs font-bold rounded-lg border border-sky-100 hover:bg-sky-100 transition flex items-center justify-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                                تنزيل الحرارة فورياً (تشغيل المراوح)
                              </button>
                            </div>
                          </div>

                          {/* Delete Machine Button */}
                          <div className="border-t border-slate-100 pt-3 text-left">
                            <button
                              onClick={() =>
                                handleDeleteMachine(selectedMachine.id)
                              }
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                              حذف هذه الماكينة بالكامل من السجلات
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SUBPANEL 2: PERIODIC MAINTENANCE */}
                      {activeSubTab === "maintenance" && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1 border-b border-slate-50 pb-2">
                            <Wrench className="w-4 h-4 text-emerald-500" />
                            إدارة جدول الصيانة الدورية المعتمدة
                          </h4>

                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 text-xs leading-relaxed font-bold">
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                معدل الصيانة الدورية الحالي:
                              </span>
                              <span className="text-slate-700">
                                كل {selectedMachine.maintenanceInterval} ساعة
                                عمل
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                الساعات من آخر صيانة:
                              </span>
                              <span className="text-slate-700">
                                {selectedMachine.hoursSinceMaintenance} ساعة
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200/50 pt-2 text-slate-800">
                              <span>الساعات المتبقية للفحص القادم:</span>
                              <span
                                className={
                                  selectedMachine.maintenanceInterval <=
                                  selectedMachine.hoursSinceMaintenance
                                    ? "text-rose-600 font-extrabold animate-pulse"
                                    : "text-emerald-600"
                                }
                              >
                                {Math.max(
                                  0,
                                  selectedMachine.maintenanceInterval -
                                    selectedMachine.hoursSinceMaintenance,
                                )}{" "}
                                ساعة
                              </span>
                            </div>
                          </div>

                          {/* Set Interval Form */}
                          <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-3">
                            <label className="text-[11px] font-bold text-slate-500 block">
                              تعديل حد الساعات للصيانة الدورية (ساعة):
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={selectedMachine.maintenanceInterval ?? ""}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 100;
                                  const updated = machines.map((mac) => {
                                    if (mac.id === selectedMachine.id) {
                                      return {
                                        ...mac,
                                        maintenanceInterval: val,
                                      };
                                    }
                                    return mac;
                                  });
                                  saveToStorage(updated);
                                  setSelectedMachine(
                                    updated.find(
                                      (x) => x.id === selectedMachine.id,
                                    ) || null,
                                  );
                                }}
                                className="w-full px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  alert("تم تعديل معدل دوران جدول الصيانة")
                                }
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs font-bold"
                              >
                                تعديل
                              </button>
                            </div>
                          </div>

                          {/* Reset Hours Since Maintenance Action button */}
                          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 space-y-3">
                            <p className="text-xs font-bold leading-normal">
                              عند قيام فريق الصيانة بإجراء الأعمال الوقائية
                              المعتمدة، يرجى تصفير المؤشر لتحديث العداد بانتظام.
                            </p>
                            <button
                              onClick={() =>
                                handlePerformMaintenance(selectedMachine.id)
                              }
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 transition flex items-center justify-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              صفّر العداد (تسجيل دورة صيانة ناجحة)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SUBPANEL 3: REPORT BREAKDOWNS */}
                      {activeSubTab === "breakdowns" && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1 border-b border-slate-50 pb-2">
                            <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
                            سجل البلاغات والأعطال وحالات الطوارئ
                          </h4>

                          {/* Active reported list */}
                          <div className="space-y-2">
                            {(selectedMachine?.breakdowns || []).map((bd) => (
                              <div
                                key={bd.id}
                                className={`p-3 rounded-xl border text-xs leading-relaxed space-y-2 font-bold ${
                                  bd.status === "resolved"
                                    ? "bg-slate-50 border-slate-200/50 opacity-60"
                                    : bd.severity === "critical"
                                      ? "bg-rose-50 border-rose-100 text-slate-800"
                                      : "bg-amber-50 border-amber-100 text-slate-850"
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-mono text-[9px] text-slate-400 block">
                                      {new Date((bd.date) || 0).toLocaleString(
                                        "ar-EG",
                                        { dateStyle: "short" },
                                      )}
                                    </span>
                                    <span className="text-slate-800 text-xs font-black block mt-0.5">
                                      {bd.title}
                                    </span>
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                      bd.severity === "critical"
                                        ? "bg-rose-100 text-rose-700"
                                        : bd.severity === "medium"
                                          ? "bg-amber-150 text-amber-800"
                                          : "bg-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {bd.severity === "critical"
                                      ? "حرج جداً"
                                      : bd.severity === "medium"
                                        ? "متوسط"
                                        : "طفيف"}
                                  </span>
                                </div>

                                <p className="text-slate-500 text-[11px] font-semibold leading-normal">
                                  {bd.description}
                                </p>

                                <div className="text-[10px] text-slate-400 font-normal">
                                  المبلغ: {bd.reporter}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/20">
                                  <span className="text-[10px] text-slate-550">
                                    الحالة:{" "}
                                    {bd.status === "reported"
                                      ? "تم التبليغ"
                                      : bd.status === "in_progress"
                                        ? "قيد العمل"
                                        : "تم حل العطل"}
                                  </span>

                                  {bd.status !== "resolved" && (
                                    <div className="flex gap-1.5">
                                      {bd.status === "reported" && (
                                        <button
                                          onClick={() =>
                                            handleUpdateBreakdownStatus(
                                              bd.id,
                                              "in_progress",
                                            )
                                          }
                                          className="px-2 py-1 bg-amber-500 text-white rounded text-[9px]"
                                        >
                                          بدء التشخيص والإصلاح
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleUpdateBreakdownStatus(
                                            bd.id,
                                            "resolved",
                                          )
                                        }
                                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[9px]"
                                      >
                                        تم الإصلاح وتأكيد الجودة
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}

                            {selectedMachine.breakdowns.length === 0 && (
                              <p className="text-center py-6 text-xs text-slate-450">
                                لا توجد بلاغات أعطال مسجلة لهذه الآلة.
                              </p>
                            )}
                          </div>

                          {/* Report New Breakdown Form */}
                          <form
                            onSubmit={handleReportBreakdown}
                            className="bg-slate-50 p-4 border border-slate-150 rounded-2xl space-y-3.5 text-xs font-bold text-slate-650"
                          >
                            <h5 className="text-slate-800 text-xs font-black">
                              تقديم بلاغ عطل مفاجئ / طوارئ:
                            </h5>

                            <div className="flex flex-col gap-1">
                              <span>عنوان العطل أو الخلل الملحوظ: *</span>
                              <input
                                type="text"
                                required
                                value={breakdownTitle ?? ""}
                                onChange={(e) =>
                                  setBreakdownTitle(e.target.value)
                                }
                                placeholder="مثال: تسريب مياه تبريد، تآكل التروس"
                                className="px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold outline-none text-slate-700 focus:ring-1 focus:ring-amber-500"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span>تفاصيل التشخيص والظواهر:</span>
                              <textarea
                                value={breakdownDesc ?? ""}
                                onChange={(e) =>
                                  setBreakdownDesc(e.target.value)
                                }
                                placeholder="وصف الأعراض، الدخان، الاهتزاز، إلخ..."
                                rows={2}
                                className="px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold outline-none text-slate-700 focus:ring-1 focus:ring-amber-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <span>شدة خطورة العطل:</span>
                                <select
                                  value={breakdownSeverity ?? ""}
                                  onChange={(e) =>
                                    setBreakdownSeverity(e.target.value as any)
                                  }
                                  className="px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold outline-none text-slate-700"
                                >
                                  <option value="low">طفيف (Low)</option>
                                  <option value="medium">متوسط (Medium)</option>
                                  <option value="critical">
                                    حرج - إيقاف قسري (Critical)
                                  </option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span>مقدم البلاغ / المشرف:</span>
                                <input
                                  type="text"
                                  value={breakdownReporter ?? ""}
                                  onChange={(e) =>
                                    setBreakdownReporter(e.target.value)
                                  }
                                  placeholder="اسم الفني أو المراقب"
                                  className="px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold outline-none text-slate-700"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-500/10"
                            >
                              تسجيل البلاغ وتعديل حالة الماكينة تلقائياً
                            </button>
                          </form>
                        </div>
                      )}

                      {/* SUBPANEL 4: SPARE PARTS STORAGE */}
                      {activeSubTab === "spare_parts" && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1 border-b border-slate-50 pb-2">
                            <Package className="w-4.5 h-4.5 text-teal-600" />
                            مخزن قطع الغيار وملحقات الصيانة الخاصة بالآلة
                          </h4>

                          {/* Spare Parts Grid */}
                          <div className="space-y-2">
                            {(selectedMachine?.spareParts || []).map((part) => (
                              <div
                                key={part.id}
                                className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs font-bold font-sans"
                              >
                                <div>
                                  <span className="text-[9px] text-slate-400 font-mono font-bold block">
                                    {part.code}
                                  </span>
                                  <span className="text-slate-800 text-xs font-black block mt-0.5">
                                    {part.name}
                                  </span>
                                </div>

                                <div className="text-right shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black ${part.stock === 0 ? "bg-rose-150 text-rose-800 animate-pulse" : "bg-slate-100 text-slate-700"}`}
                                  >
                                    الرصيد: {part.stock} وحدة
                                  </span>
                                  <span className="text-indigo-600 block text-[10px] mt-1 font-extrabold">
                                    {Number(part.cost || 0).toLocaleString()} ج.م / وحدة
                                  </span>
                                </div>
                              </div>
                            ))}

                            {selectedMachine.spareParts.length === 0 && (
                              <p className="text-center py-6 text-xs text-slate-450">
                                لا توجد قطع غيار مسجلة لهذه الماكينة.
                              </p>
                            )}
                          </div>

                          {/* Add Spare Part form */}
                          <form
                            onSubmit={handleAddSparePart}
                            className="bg-slate-50 p-4 border border-slate-205 rounded-2xl space-y-3 text-xs font-bold text-slate-650"
                          >
                            <h5 className="text-slate-800 text-xs font-black">
                              تعريف وإضافة قطعة غيار جديدة للمخزون:
                            </h5>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <span>اسم القطعة: *</span>
                                <input
                                  type="text"
                                  required
                                  placeholder="مثال: حساس ضغط هيدروليكي"
                                  value={newPartName ?? ""}
                                  onChange={(e) =>
                                    setNewPartName(e.target.value)
                                  }
                                  className="px-3 py-1.5 bg-white border border-slate-250 rounded-xl font-bold outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span>الكود التسلسلي (OEM/SKU): *</span>
                                <input
                                  type="text"
                                  required
                                  placeholder="مثال: SP-HYD-77"
                                  value={newPartCode ?? ""}
                                  onChange={(e) =>
                                    setNewPartCode(e.target.value)
                                  }
                                  className="px-3 py-1.5 bg-white border border-slate-250 rounded-xl font-bold outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <span>كمية التوريد البدئية:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={newPartStock ?? ""}
                                  onChange={(e) =>
                                    setNewPartStock(Number(e.target.value) || 0)
                                  }
                                  className="px-3 py-1.5 bg-white border border-slate-250 rounded-xl font-bold outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span>تكلفة شراء الصنف (ج.م):</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={newPartCost ?? ""}
                                  onChange={(e) =>
                                    setNewPartCost(Number(e.target.value) || 0)
                                  }
                                  className="px-3 py-1.5 bg-white border border-slate-250 rounded-xl font-bold outline-none"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-black shadow-md shadow-slate-900/10"
                            >
                              تسجيل وتغذية الرصيد لقطع الغيار
                            </button>
                          </form>
                        </div>
                      )}

                      {/* SUBPANEL 5: REPAIR LOGS & PARTS CONSUMPTION FORM */}
                      {activeSubTab === "repairs" && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1 border-b border-slate-50 pb-2">
                            <Wrench className="w-4 h-4 text-amber-500" />
                            سجلات الصيانة وتقارير العمل السابقة
                          </h4>

                          {/* Historical repairs logs stack */}
                          <div className="space-y-2">
                            {(selectedMachine?.repairHistory || []).map((log) => (
                              <div
                                key={log.id}
                                className="p-3 bg-white rounded-xl border border-slate-205/80 text-xs leading-relaxed space-y-2.5 font-bold shadow-xs"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold block">
                                      {new Date((log.date) || 0).toLocaleString(
                                        "ar-EG",
                                      )}
                                    </span>
                                    <span className="text-slate-700 text-xs font-black block mt-0.5">
                                      القائم بالإصلاح: {log.technician}
                                    </span>
                                  </div>
                                  <span className="text-amber-600 font-extrabold text-sm">
                                    {Number(log.totalCost || 0).toLocaleString()} ج.م
                                  </span>
                                </div>

                                <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-550 leading-relaxed font-semibold">
                                  <span className="text-slate-800 font-bold block">
                                    العيب والخلل المكتشف:
                                  </span>
                                  <p>{log.issue}</p>
                                  <span className="text-slate-850 font-bold block mt-1.5 border-t border-slate-200/40 pt-1">
                                    الإجراء الميكانيكي أو الكهربائي:
                                  </span>
                                  <p>{log.actionTaken}</p>
                                </div>

                                {log.sparePartsUsed &&
                                  log.sparePartsUsed.length > 0 && (
                                    <div className="text-[10px] text-slate-400 block border-t border-slate-100 pt-1.5 font-bold">
                                      أجزاء مستهلكة:{" "}
                                      {log.sparePartsUsed
                                        .map(
                                          (p) =>
                                            `${p.name} (عدد ${p.quantity})`,
                                        )
                                        .join("، ")}
                                    </div>
                                  )}
                              </div>
                            ))}

                            {selectedMachine.repairHistory.length === 0 && (
                              <p className="text-center py-6 text-xs text-slate-450">
                                لا توجد حركات صيانة سابقة مدونة.
                              </p>
                            )}
                          </div>

                          {/* Post Custom Repair log manual entry */}
                          <form
                            onSubmit={handlePostRepairLog}
                            className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3.5 text-xs font-bold text-slate-650"
                          >
                            <h5 className="text-slate-800 text-xs font-black">
                              تدوين سجل تقرير إصلاح فني جديد:
                            </h5>

                            <div className="flex flex-col gap-1">
                              <span>
                                اسم مهندس/فني الصيانة القائم بالعمل: *
                              </span>
                              <input
                                type="text"
                                required
                                value={repairTechnician ?? ""}
                                onChange={(e) =>
                                  setRepairTechnician(e.target.value)
                                }
                                placeholder="مثال: المهندس عمرو الحسيني"
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span>العطل أو وصف العيب والخلل: *</span>
                              <input
                                type="text"
                                required
                                value={repairIssue ?? ""}
                                onChange={(e) => setRepairIssue(e.target.value)}
                                placeholder="مثال: تلف محامل التوريد، تآكل حساس الوزن"
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span>خطوات وإجراءات المعالجة والإصلاح: *</span>
                              <textarea
                                required
                                value={repairAction ?? ""}
                                onChange={(e) =>
                                  setRepairAction(e.target.value)
                                }
                                placeholder="مثال: فك صندوق المحرك، تغيير الزيوت الهيدروليكية، تجربة الدوران..."
                                rows={2}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none"
                              />
                            </div>

                            {/* Spare parts consumption logic */}
                            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                              <span className="text-[11px] font-black text-slate-700 block">
                                سحب قطع غيار من مستودع الماكينة:
                              </span>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                  <select
                                    value={repairSelectPartId ?? ""}
                                    onChange={(e) =>
                                      setRepairSelectPartId(e.target.value)
                                    }
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                  >
                                    <option value="">
                                      -- اختر صنف قطعة غيار --
                                    </option>
                                    {(selectedMachine?.spareParts || []).map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} (رصيد: {p.stock})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    min="1"
                                    value={repairSelectPartQty ?? ""}
                                    onChange={(e) =>
                                      setRepairSelectPartQty(
                                        Number(e.target.value) || 1,
                                      )
                                    }
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleAddToRepairParts}
                                className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100 text-center"
                              >
                                + ربط وسحب صنف قطعة الغيار
                              </button>

                              {/* selected consuming parts list */}
                              {repairSelectedPartsList.length > 0 && (
                                <div className="text-[10px] text-slate-500 font-bold block space-y-1 border-t border-slate-100 pt-2">
                                  <span className="text-slate-800">
                                    الأصناف المحددة للخصم:
                                  </span>
                                  {repairSelectedPartsList.map((pi, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded"
                                    >
                                      <span>
                                        {pi.name} (x{pi.quantity})
                                      </span>
                                      <span>
                                        {(
                                          pi.cost * pi.quantity
                                        ).toLocaleString()}{" "}
                                        ج.م
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-1">
                              <span>
                                تكلفة العمالة / المصاريف الخارجية الأخرى (ج.م):
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={repairLaborCost ?? ""}
                                onChange={(e) =>
                                  setRepairLaborCost(
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/10"
                            >
                              تسجيل وتأكيد حركة الإصلاح والخصم المخازني
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD NEW MACHINE FORM */}
      {showAddNewMachineModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden text-right"
          >
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-md flex items-center gap-2">
                <Cog className="text-amber-500 w-5.5 h-5.5 animate-spin" />
                تسجيل وتعريف ماكينة تصنيع جديدة لشجرة الأصول
              </h3>
              <button
                onClick={() => setShowAddNewMachineModal(false)}
                className="p-1 px-3 text-slate-405 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

            <form
              onSubmit={handleAddNewMachine}
              className="p-6 space-y-4 text-xs font-bold text-slate-600"
            >
              <div className="flex flex-col gap-1.5">
                <span>اسم الماكينة / المعدة الفني: *</span>
                <input
                  type="text"
                  required
                  placeholder="مثال: فرن حراري دوار، سير فرز آلي"
                  value={newMacName ?? ""}
                  onChange={(e) => setNewMacName(e.target.value)}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-750 focus:bg-white focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span>الكود التسلسلي التعريفي للماكينة: *</span>
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-extrabold">
                    توليد تلقائي فوري
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="سيقوم النظام بالتوليد..."
                    value={newMacCode ?? ""}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none font-bold text-slate-500 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setNewMacCode(getNextMachineCode())}
                    className="px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center shrink-0"
                    title="إعادة توليد الكود التعريفي"
                  >
                    توليد
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span>خط الإنتاج أو التوزيع المستهدف: *</span>
                <select
                  required
                  value={newMacLine ?? ""}
                  onChange={(e) => setNewMacLine(e.target.value)}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-750 focus:bg-white focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">
                    -- اختر خط الإنتاج لتتبعه الماكينة آلياً --
                  </option>
                  <option value="خط المعجنات والخبز">خط المعجنات والخبز</option>
                  <option value="الخط الرئيسي للتعبئة">
                    الخط الرئيسي للتعبئة
                  </option>
                  <option value="خط تحضير الصلصات والبيتزا">
                    خط تحضير الصلصات والبيتزا
                  </option>
                  <option value="خط المخبوزات والمعجنات الرئيسي">
                    خط المخبوزات والمعجنات الرئيسي
                  </option>
                  <option value="خط تحضير الصلصات والمستحلبات">
                    خط تحضير الصلصات والمستحلبات
                  </option>
                  <option value="خط التعبئة والتغليف الرئيسي">
                    خط التعبئة والتغليف الرئيسي
                  </option>
                  <option value="خط التغليف والتعبئة الفرعي">
                    خط التغليف والتعبئة الفرعي
                  </option>
                  <option value="custom">-- كتابة خط إنتاج آخر مخصص --</option>
                </select>
              </div>

              {/* If "custom" selected, show manual entry for line */}
              {newMacLine === "custom" && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <span>اسم خط الإنتاج المخصص: *</span>
                  <input
                    type="text"
                    required
                    placeholder="أدخل اسم خط الإنتاج لتطابق الكود"
                    value={newMacLine === "custom" ? "" : newMacLine ?? ""}
                    onChange={(e) => setNewMacLine(e.target.value)}
                    className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-750 focus:bg-white focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span>دورة الصيانة بالساعات: *</span>
                  <input
                    type="number"
                    min="10"
                    required
                    value={newMacInterval ?? ""}
                    onChange={(e) =>
                      setNewMacInterval(Number(e.target.value) || 200)
                    }
                    className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-750 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span>الحد الأقصى للحرارة الآمنة (°م): *</span>
                  <input
                    type="number"
                    min="30"
                    required
                    value={newMacMaxTemp ?? ""}
                    onChange={(e) =>
                      setNewMacMaxTemp(Number(e.target.value) || 80)
                    }
                    className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-750 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span>حالة الماكينة البدئية عند التسجيل:</span>
                <select
                  value={newMacStatus ?? ""}
                  onChange={(e) => setNewMacStatus(e.target.value as any)}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-750 focus:bg-white"
                >
                  <option value="running">في الخدمة والدوران (Active)</option>
                  <option value="on_hold">تحت الانتظار (Idle)</option>
                  <option value="maintenance">
                    تحت صيانة مسبقة (Maintenance)
                  </option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/10 transition"
              >
                تحديث أصول العمل وتسجيل الماكينة بنجاح
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
