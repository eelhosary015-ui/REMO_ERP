import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, ShieldCheck, Settings, Cpu, X, Edit, Trash2, 
  Wrench, PlayCircle, Layers, CheckCircle, MapPin, User, Clock, 
  AlertTriangle, Check, RefreshCw, Activity, Zap, Calendar, ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { WorkCenter, BillOfMaterial } from './types';
import { api } from '../../utils/api';
import { Employee, HRShift } from '../../types';

interface MaintenanceTask {
  id: string;
  workCenterId: string;
  workCenterName: string;
  type: 'preventive' | 'corrective' | 'breakdown';
  description: string;
  scheduledDate: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const DEFAULT_CENTERS: WorkCenter[] = [];

export function WorkCentersManagement() {
  const [centers, setCenters] = useState<WorkCenter[]>(() => {
    const saved = localStorage.getItem('remo_production_workcenters');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(c => c && c.id && !['MC-101', 'LN-001', 'LB-050'].includes(c.code));
        }
      } catch (e) { console.error('Failed to parse from local storage'); }
    }
    return [];
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'maintenance' | 'idle'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<WorkCenter | null>(null);

  // Form State for Adding / Editing Model
  const [isEditMode, setIsEditMode] = useState(false);
  const [newCenter, setNewCenter] = useState<Partial<WorkCenter>>({
    code: '', 
    name: '', 
    type: 'machine', 
    capacity: 50, 
    costPerHour: 100, 
    efficiency: 90,
    location: '',
    status: 'active',
    supervisor: '',
    dailyHours: 8,
    laborCost: 50,
    machineCost: 35,
    overheadCost: 15,
    shifts: []
  });

  // Temporary states for new shift builder inside form
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('16:00');
  const [shiftWorkers, setShiftWorkers] = useState(5);
  const [shiftDays, setShiftDays] = useState<string[]>(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
  const [linkedHrShiftId, setLinkedHrShiftId] = useState<string | number>('');
  const [assignedEmpIds, setAssignedEmpIds] = useState<(string | number)[]>([]);

  // Cross-Referencing Stats for Selected Center (Fully Connected!)
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [associatedBoms, setAssociatedBoms] = useState<BillOfMaterial[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTask[]>([]);

  // HR Data linkage
  const [hrEmployees, setHrEmployees] = useState<Employee[]>([]);
  const [hrShifts, setHrShifts] = useState<HRShift[]>([]);

  // Fetch HR data
  useEffect(() => {
    const fetchHR = async () => {
      try {
        const [empRes, shiftRes] = await Promise.all([
          api.get('/api/hr/employees'),
          api.get('/api/hr/shifts')
        ]);
        if (empRes.ok) {
          const emps = await empRes.json();
          setHrEmployees(Array.isArray(emps) ? emps : []);
        }
        if (shiftRes.ok) {
          const sfts = await shiftRes.json();
          setHrShifts(Array.isArray(sfts) ? sfts : []);
        }
      } catch (err) {
        console.error('Failed to fetch HR data for work centers', err);
      }
    };
    fetchHR();
  }, []);

  // Open Manage Center Modal
  const handleManageCenter = (center: WorkCenter) => {
    setSelectedCenter(center);
    
    // Read ShopFloor Job Cards
    const savedJobs = localStorage.getItem('remo_production_shopfloor');
    let matchingJobs: any[] = [];
    if (savedJobs) {
      try {
        const parsed = JSON.parse(savedJobs);
        matchingJobs = parsed.filter((job: any) => job.workCenter === center.name || job.workCenter === center.code || job.workCenterId === center.id);
      } catch (e) {}
    }
    setActiveJobs(matchingJobs);

    // Read BOMs to find which recipes reference this Work Center
    const savedBoms = localStorage.getItem('remo_production_boms');
    let matchingBoms: BillOfMaterial[] = [];
    if (savedBoms) {
      try {
        const parsed: BillOfMaterial[] = JSON.parse(savedBoms);
        matchingBoms = parsed.filter(bom => 
          bom.routings && bom.routings.some(r => r.workCenterId === center.code || r.workCenterId === center.id)
        );
      } catch (e) {}
    }
    setAssociatedBoms(matchingBoms);

    // Read Maintenance Tickets
    const savedMaint = localStorage.getItem('remo_production_maintenance');
    let matchingMaint: MaintenanceTask[] = [];
    if (savedMaint) {
      try {
        const parsed: MaintenanceTask[] = JSON.parse(savedMaint);
        matchingMaint = parsed.filter(t => t.workCenterName === center.name || t.workCenterId === center.code || t.workCenterId === center.id);
      } catch (e) {}
    }
    setMaintenanceTickets(matchingMaint);

    setIsManageModalOpen(true);
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'machine': return 'ماكينة / تجهيز معدات آلي';
      case 'line': return 'خط تجميع / تتابع مستمر';
      case 'labor': return 'محطة عمالة وفنيين يدوية';
      default: return type;
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = status || 'active';
    switch (s) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            نشط وتشغيلي (Active)
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            تحت الصيانة الطارئة
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            جاهز / خامل (Idle)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {s}
          </span>
        );
    }
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setNewCenter({
      code: `MC-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      type: 'machine',
      capacity: 50,
      costPerHour: 200,
      laborCost: 100,
      machineCost: 70,
      overheadCost: 30,
      efficiency: 95,
      location: 'صالة التصنيع الرئيسية',
      status: 'active',
      supervisor: 'م. فادي القاضي',
      dailyHours: 8,
      shifts: []
    });
    setShiftName('');
    setShiftStart('08:00');
    setShiftEnd('16:00');
    setShiftWorkers(5);
    setShiftDays(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (center: WorkCenter, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setSelectedCenter(center);
    setNewCenter({ 
      ...center,
      laborCost: center.laborCost || 0,
      machineCost: center.machineCost || 0,
      overheadCost: center.overheadCost || 0,
      shifts: center.shifts || []
    });
    setShiftName('');
    setShiftStart('08:00');
    setShiftEnd('16:00');
    setShiftWorkers(5);
    setShiftDays(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
    setIsModalOpen(true);
  };

  const handleAddShift = () => {
    if (!shiftName.trim()) {
      alert('الرجاء كتابة اسم للوردية قبل إضافتها للتقويم!');
      return;
    }
    const added: any = {
      id: `sh-${Date.now()}`,
      name: shiftName,
      startTime: shiftStart,
      endTime: shiftEnd,
      workersCount: shiftWorkers,
      activeDays: [...shiftDays],
      hrShiftId: linkedHrShiftId || undefined,
      assignedEmployees: hrEmployees
        .filter(e => assignedEmpIds.includes(e.id))
        .map(e => ({ id: e.id, name: e.name }))
    };
    setNewCenter(prev => ({
      ...prev,
      shifts: [...(prev.shifts || []), added]
    }));
    setShiftName('');
    setLinkedHrShiftId('');
    setAssignedEmpIds([]);
  };

  const handleRemoveShift = (id: string) => {
    setNewCenter(prev => ({
      ...prev,
      shifts: (prev.shifts || []).filter(s => s.id !== id)
    }));
  };

  const toggleShiftDay = (day: string) => {
    if (shiftDays.includes(day)) {
      setShiftDays(prev => prev.filter(d => d !== day));
    } else {
      setShiftDays(prev => [...prev, day]);
    }
  };

  const handleAddCenterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenter.code || !newCenter.name) return;

    let updatedList: WorkCenter[] = [];
    const derivedCostPerHour = (newCenter.laborCost || 0) + (newCenter.machineCost || 0) + (newCenter.overheadCost || 0);

    const targetData: WorkCenter = {
      ...(newCenter as WorkCenter),
      costPerHour: derivedCostPerHour > 0 ? derivedCostPerHour : (newCenter.costPerHour || 100),
      laborCost: newCenter.laborCost || 0,
      machineCost: newCenter.machineCost || 0,
      overheadCost: newCenter.overheadCost || 0,
      shifts: newCenter.shifts || []
    };

    if (isEditMode && selectedCenter) {
      updatedList = centers.map(c => c.id === selectedCenter.id ? { ...c, ...targetData } as WorkCenter : c);
    } else {
      const added: WorkCenter = {
        ...targetData,
        id: Date.now().toString(),
      };
      updatedList = [...centers, added];
    }

    setCenters(updatedList);
    localStorage.setItem('remo_production_workcenters', JSON.stringify(updatedList));

    setIsModalOpen(false);
    // If we edited a center and the manage modal is open, refresh it
    if (isEditMode && selectedCenter) {
      const matched = updatedList.find(c => c.id === selectedCenter.id);
      if (matched) setSelectedCenter(matched);
    }
  };

  const handleQuickStatusChange = (id: string, nextStatus: 'active' | 'maintenance' | 'idle', e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = centers.map(c => c.id === id ? { ...c, status: nextStatus } : c);
    setCenters(updated);
    localStorage.setItem('remo_production_workcenters', JSON.stringify(updated));
    if (selectedCenter && selectedCenter.id === id) {
      setSelectedCenter({ ...selectedCenter, status: nextStatus });
    }
  };

  const handleDeleteCenter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من حذف مركز العمل هذا بالكامل؟ قد يؤثر ذلك على كشوفات التوجيه الجارية.')) {
      const updated = centers.filter(c => c.id !== id);
      setCenters(updated);
      localStorage.setItem('remo_production_workcenters', JSON.stringify(updated));
      setIsManageModalOpen(false);
    }
  };

  const filteredCenters = centers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.code.toLowerCase().includes(search.toLowerCase()) ||
                          (c.location && c.location.toLowerCase().includes(search.toLowerCase())) ||
                          (c.supervisor && c.supervisor.toLowerCase().includes(search.toLowerCase()));
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && (c.status || 'active') === statusFilter;
  });

  return (
    <div className="p-6 md:p-12 w-full max-w-[1800px] mx-auto space-y-10 animate-fadeIn" id="work_centers_section">
      {/* Search and Filters Hub - Redesigned for Pro look */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-8 rounded-[2.5rem] shadow-sm flex flex-col lg:flex-row justify-between items-center gap-8 translate-y-0 hover:-translate-y-1 transition-all duration-500">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-600/20 rotate-3 group hover:rotate-0 transition-transform duration-500">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">مراكز العمل والتوجيه (Work Centers)</h1>
            <p className="text-slate-500 font-medium mt-1.5 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              إدارة الماكينات، خطوط التجميع، وتقويم الورديات الميداني النشط
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
            <input 
              type="text" 
              placeholder="البحث برمز المركز، الاسم، الموقع، أو اسم مهندس الإشراف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all font-bold text-slate-700 text-sm"
            />
          </div>
          
          <button 
            onClick={handleOpenAdd}
            className="px-8 py-4 bg-rose-600 hover:bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-rose-600/30 active:scale-95 transition-all text-sm group cursor-pointer"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            إضافة مركز تشغيل / ماكينة جديدة
          </button>
        </div>
      </div>

      {/* Filter Tabs with enhanced visual hierarchy */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/50">
          {[
            { id: 'all', label: 'الكل', count: centers.length, icon: Layers },
            { id: 'active', label: 'نشط وتام التشغيل', count: centers.filter(c => (c.status || 'active') === 'active').length, icon: Zap },
            { id: 'idle', label: 'جاهز / خامل', count: centers.filter(c => (c.status || 'active') === 'idle').length, icon: Clock },
            { id: 'maintenance', label: 'تحت الصيانة', count: centers.filter(c => (c.status || 'active') === 'maintenance').length, icon: Wrench },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
                statusFilter === tab.id 
                  ? 'bg-white text-slate-900 shadow-md translate-y-0 border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${statusFilter === tab.id ? 'text-rose-600' : ''}`} />
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        
        <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
          <span>تصنيف حسب الحالة الميدانية النشطة</span>
          <div className="w-8 h-[1px] bg-slate-200" />
        </div>
      </div>

      {/* Main Table Content - Redesigned for Maximum Clarity and Impact */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm shadow-slate-200/20 translate-y-0 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-700">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/50 text-slate-400 font-black border-b border-slate-100 uppercase tracking-widest text-[10px]">
              <tr>
                <th className="p-6">مركز العمل والتعريف التقني</th>
                <th className="p-6">المنظومة والموقع الميداني</th>
                <th className="p-6">القيادة الفنية</th>
                <th className="p-6 text-center">الخلايا/ساعة</th>
                <th className="p-6 text-center">إهلاك التشغيل / س</th>
                <th className="p-6 text-center">كفاءة الأداء</th>
                <th className="p-6 text-center">الحالة</th>
                <th className="p-6 text-center">تقويم الورديات</th>
                <th className="p-6 text-center">الأدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCenters.map((center, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  key={center.id} 
                  className="hover:bg-slate-50/50 transition-colors group cursor-default"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:shadow-md ${
                        (center.status || 'active') === 'active' ? 'bg-emerald-50 text-emerald-600' :
                        (center.status || 'active') === 'maintenance' ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-amber-50 text-amber-600'
                      }`}>
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-base leading-tight">{center.name}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-black text-rose-600 font-mono tracking-tighter bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 uppercase">{center.code}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-[10px] font-bold text-slate-400">ID: {center.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="font-extrabold text-slate-800 text-xs tracking-tight">{getTypeLabel(center.type)}</p>
                      <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-600 transition-colors">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">{center.location || 'غير محدد'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3 font-bold text-slate-700">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-white shadow-sm overflow-hidden">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-sm tracking-tight">{center.supervisor || 'غير معين'}</span>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-mono font-black text-slate-900 text-lg">{center.capacity}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Unit / Hr</span>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-col items-center group/cost">
                      <span className="font-black text-rose-600 font-mono text-base">{Number(center.costPerHour || 0 || 0).toLocaleString()} <small className="text-[10px] ml-0.5">ج.م</small></span>
                      <div className="flex gap-2 text-[9px] text-slate-400 font-black mt-1.5 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span title="عمالة" className="hover:text-rose-500 transition-colors">👷{center.laborCost || 0}</span>
                        <span title="ماكينة" className="hover:text-rose-500 transition-colors">🔌{center.machineCost || 0}</span>
                        <span title="عامة" className="hover:text-rose-500 transition-colors">🏢{center.overheadCost || 0}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2 border border-white shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${center.efficiency}%` }}
                          className={`h-full rounded-full ${center.efficiency > 90 ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-400 shadow-sm shadow-amber-400/50'}`} 
                        />
                      </div>
                      <span className="font-black text-emerald-600 font-mono text-sm">{center.efficiency}%</span>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    {getStatusBadge(center.status)}
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 shadow-sm">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="font-black text-xs">{center.shifts?.length || 0}</span>
                       </div>
                       {center.shifts && center.shifts.length > 0 && (
                        <div className="flex -space-x-1.5 overflow-hidden hover:space-x-0.5 transition-all duration-300 rtl:space-x-reverse">
                          {center.shifts.slice(0, 3).map((s, idx) => (
                            <div key={idx} className="w-5 h-5 rounded-full bg-white flex items-center justify-center p-0.5 border border-indigo-100 shadow-sm" title={s.name}>
                               <div className={`w-full h-full rounded-full ${idx === 0 ? 'bg-indigo-500' : idx === 1 ? 'bg-indigo-400' : 'bg-indigo-300'}`} />
                            </div>
                          ))}
                          {center.shifts.length > 3 && (
                            <div className="w-5 h-5 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-black text-slate-500 shadow-sm">
                              +{center.shifts.length - 3}
                            </div>
                          )}
                        </div>
                       )}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleManageCenter(center)}
                        className="p-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-800"
                        title="إدارة شاملة والربط الميداني"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => handleOpenEdit(center, e)}
                        className="p-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-800"
                        title="تعديل المركز"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteCenter(center.id, e)}
                        className="p-3 text-slate-400 hover:text-white hover:bg-rose-600 rounded-2xl transition-all shadow-sm border border-transparent hover:border-rose-500"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredCenters.length === 0 && (
          <div className="py-24 px-6 text-center text-slate-500 font-bold bg-slate-50/20 border-t border-slate-100">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <AlertTriangle className="w-20 h-20 mx-auto text-slate-200 mb-4 shadow-sm" />
              <h3 className="text-xl font-black text-slate-400">لا توجد نتائج بحث مطابقة للمرشحات الحالية</h3>
              <p className="text-slate-300 font-medium mt-2">جرب تعديل كلمات البحث أو تغيير حالة الفلتر لمشاهدة مراكز العمل المسجلة</p>
            </motion.div>
          </div>
        )}
      </div>


      {/* ADD / EDIT WORK CENTER MODAL (IMPROVED & EXPANDED) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] w-full max-w-5xl overflow-hidden shadow-2xl relative z-10 flex flex-col border border-white/20 my-4"
          >
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-rose-600/20">
                  <Cpu className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {isEditMode ? 'تحديث وتطوير مركز العمل' : 'سجل وإضافة مركز عمل / ماكينة جديدة بالورش صالة ١'}
                  </h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">تحديد القدرات الإنتاجية، خرائط التكاليف، وتقويم الورديات الميداني</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all duration-300"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            <form onSubmit={handleAddCenterSubmit} className="flex-1 overflow-y-auto p-10 space-y-12">
              {/* Profile & Location Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-6 bg-rose-600 rounded-full" />
                  <h3 className="font-bold text-slate-800 text-lg">الهوية والتموضع الميداني للمركز</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-2 mr-1 uppercase tracking-wider">رمز التعريف الفني (كود مسجل)</label>
                    <div className="relative">
                      <input 
                        required
                        type="text" 
                        placeholder="MC-380 مثلاً"
                        value={newCenter.code}
                        onChange={e => setNewCenter({...newCenter, code: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-black text-rose-600 font-mono shadow-sm transition-all"
                        dir="ltr"
                      />
                      <button 
                        type="button"
                        onClick={() => setNewCenter({...newCenter, code: `MC-${Math.floor(Math.random() * 900) + 100}`})}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        title="توليد كود تلقائياً"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-2 mr-1 text-slate-800">الوضع التشغيلي الأولي للمركز</label>
                    <select 
                      value={newCenter.status || 'active'}
                      onChange={e => setNewCenter({...newCenter, status: e.target.value as WorkCenter['status']})}
                      className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-800 bg-white shadow-sm transition-all"
                    >
                      <option value="active">نشط وتشغيلي وتام الكفاءة (Active)</option>
                      <option value="idle">خامل ومستعد للتنفيذ (Idle)</option>
                      <option value="maintenance">تحت الصيانة المجدولة/الطارئة (Maintenance)</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">اسم مركز العمل الفعلي / الماكينة</label>
                    <input 
                      required
                      type="text" 
                      placeholder="مثال: ذراع اللحام الآلي ت-٥، مقص الليزر المتطور عالي السرعة"
                      value={newCenter.name}
                      onChange={e => setNewCenter({...newCenter, name: e.target.value})}
                      className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-extrabold text-slate-800 shadow-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">التصنيف الهيكلي والوظيفة</label>
                    <select 
                      value={newCenter.type}
                      onChange={e => setNewCenter({...newCenter, type: e.target.value as WorkCenter['type']})}
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-800 shadow-sm transition-all"
                    >
                      <option value="machine">ماكينة كبيرة وإدخال أوتوماتيكي</option>
                      <option value="line">خط إنتاج تجميع متسلسل ومستمر</option>
                      <option value="labor">محطة عمالة يدوية دقيقة / مهندسون</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">الموقع الميداني / صالة العمليات</label>
                    <input 
                      type="text" 
                      placeholder="الجناح الرئيسي، قطب أ"
                      value={newCenter.location}
                      onChange={e => setNewCenter({...newCenter, location: e.target.value})}
                      className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">المشرف الميداني المباشر</label>
                    <input 
                      type="text" 
                      placeholder="م. ممدوح عبدالكريم"
                      value={newCenter.supervisor}
                      onChange={e => setNewCenter({...newCenter, supervisor: e.target.value})}
                      className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Performance & Metrics Sector */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    <h3 className="font-bold text-slate-800 text-lg">مؤشرات الأداء المستهدفة</h3>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 mr-1">الإنتاجية القصوى (وحدة/ساعة)</label>
                      <input 
                        type="number" required min="1"
                        value={newCenter.capacity || 0}
                        onChange={e => setNewCenter({...newCenter, capacity: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-black text-lg text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 mr-1">ساعات الجاهزية المتاحة/يوم</label>
                      <input 
                        type="number" required min="1" max="24"
                        value={newCenter.dailyHours || 8}
                        onChange={e => setNewCenter({...newCenter, dailyHours: parseInt(e.target.value) || 8})}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-black text-lg text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 mr-1">كفاءة الأداء الميداني المستهدفة (%)</label>
                      <div className="relative">
                        <input 
                          type="number" required min="1" max="100"
                          value={newCenter.efficiency || 90}
                          onChange={e => setNewCenter({...newCenter, efficiency: parseInt(e.target.value) || 0})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-black text-lg text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cost Breakdown Redesign */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-rose-600 rounded-full" />
                    <h3 className="font-bold text-slate-800 text-lg">هيكل وهياكل تكاليف التشغيل (Direct Cost)</h3>
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border-2 border-rose-100 shadow-sm shadow-rose-100/50 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide">أجر العمالة المباشرة/س</label>
                        <input 
                          type="number" min="0" step="0.01"
                          value={newCenter.laborCost || 0}
                          onChange={e => setNewCenter({...newCenter, laborCost: parseFloat(e.target.value) || 0})}
                          className="w-full px-4 py-3.5 bg-rose-50/30 border border-slate-200 rounded-2xl font-mono text-center text-base font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide">استهلاك الماكينة/طاقة</label>
                        <input 
                          type="number" min="0" step="0.01"
                          value={newCenter.machineCost || 0}
                          onChange={e => setNewCenter({...newCenter, machineCost: parseFloat(e.target.value) || 0})}
                          className="w-full px-4 py-3.5 bg-rose-50/30 border border-slate-200 rounded-2xl font-mono text-center text-base font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide">أعباء غير مباشرة/إداري</label>
                        <input 
                          type="number" min="0" step="0.01"
                          value={newCenter.overheadCost || 0}
                          onChange={e => setNewCenter({...newCenter, overheadCost: parseFloat(e.target.value) || 0})}
                          className="w-full px-4 py-3.5 bg-rose-50/30 border border-slate-200 rounded-2xl font-mono text-center text-base font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="bg-rose-600 p-8 rounded-3xl text-white shadow-2xl shadow-rose-600/30 flex flex-col items-center justify-center relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                      
                      <span className="text-xs font-bold text-rose-100/80 mb-2 uppercase tracking-[0.2em] relative z-10">إجمالي التكلفة التشغيلية المحتسبة للساعة</span>
                      <div className="flex items-baseline gap-3 relative z-10">
                        <span className="text-5xl font-black font-mono">
                          {((newCenter.laborCost || 0) + (newCenter.machineCost || 0) + (newCenter.overheadCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xl font-bold opacity-80">ج.م / ساعة</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Shift Planner Sector */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                       جدولة وتخطيط ورديات المركز
                      <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-1 rounded-full uppercase ml-2">Active Planner</span>
                    </h3>
                  </div>
                  <div className="px-4 py-1.5 bg-slate-100 rounded-full text-xs font-bold text-slate-500">
                    {newCenter.shifts?.length || 0} ورديات مسجلة
                  </div>
                </div>

                <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-200">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Shift Creation form column */}
                    <div className="xl:col-span-5 space-y-6">
                       <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                          <h4 className="text-xs font-black text-slate-400 mb-2 mr-1 uppercase">إعداد وردية جديدة</h4>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-1">ارتباط بوردية الموارد البشرية</label>
                              <select
                                value={linkedHrShiftId}
                                onChange={e => {
                                  const val = e.target.value;
                                  setLinkedHrShiftId(val);
                                  const matched = hrShifts.find(s => s.id.toString() === val);
                                  if (matched) {
                                    setShiftName(matched.name);
                                    setShiftStart(matched.start_time);
                                    setShiftEnd(matched.end_time);
                                  }
                                }}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">-- بلا ربط تلقائي --</option>
                                {hrShifts.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-1">اسم الوردية</label>
                                <input 
                                  required
                                  type="text" 
                                  placeholder="مثل: الوردية الأولى - صالة أ"
                                  value={shiftName}
                                  onChange={e => setShiftName(e.target.value)}
                                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-1">البدء</label>
                                <input type="time" value={shiftStart ?? ""} onChange={e => setShiftStart(e.target.value)} className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-center" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-1">الانتهاء</label>
                                <input type="time" value={shiftEnd ?? ""} onChange={e => setShiftEnd(e.target.value)} className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-center" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-1">موظفو الوردية المخصصون</label>
                              <div className="border border-slate-100 rounded-xl p-3 max-h-36 overflow-y-auto bg-slate-50/50">
                                <div className="space-y-1">
                                  {hrEmployees.map(emp => (
                                    <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
                                      <input 
                                        type="checkbox"
                                        checked={assignedEmpIds.includes(emp.id)}
                                        onChange={e => {
                                          if (e.target.checked) setAssignedEmpIds([...assignedEmpIds, emp.id]);
                                          else setAssignedEmpIds(assignedEmpIds.filter(id => id !== emp.id));
                                        }}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <div>
                                        <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{emp.name}</p>
                                        <p className="text-[9px] text-slate-400">{emp.job_title}</p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddShift}
                              className="w-full py-4 bg-indigo-600 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
                            >
                              إضافة الوردية للمخطط الميداني
                              <ArrowRight className="w-4 h-4 mr-1 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                       </div>
                    </div>

                    {/* Shifts result column */}
                    <div className="xl:col-span-7 space-y-4">
                      {newCenter.shifts && newCenter.shifts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {newCenter.shifts.map((s) => (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={s.id} 
                              className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all group"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                  <Clock className="w-5 h-5" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveShift(s.id)}
                                  className="p-1 px-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-[10px] font-bold border border-transparent hover:border-rose-100"
                                >
                                  حذف
                                </button>
                              </div>
                              <h4 className="font-black text-slate-900 text-sm mb-1">{s.name}</h4>
                              <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold text-xs">
                                <span>{s.startTime}</span>
                                <span className="text-slate-300">→</span>
                                <span>{s.endTime}</span>
                              </div>
                              
                              {s.assignedEmployees && s.assignedEmployees.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-50">
                                   <div className="flex flex-wrap gap-1.5">
                                      {s.assignedEmployees.map(emp => (
                                        <span key={emp.id} className="px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-600 rounded-lg border border-slate-100">
                                          {emp.name}
                                        </span>
                                      ))}
                                   </div>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] border border-dashed border-slate-300 opacity-60">
                           <Calendar className="w-16 h-16 text-slate-200 mb-4" />
                           <p className="text-slate-400 font-bold text-sm">مخطط الورديات فارغ حالياً لهذا المركز</p>
                           <p className="text-slate-300 text-xs mt-1">ابدأ بإعداد الورديات من القائمة الجانبية</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Footer / Actions */}
              <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="w-full sm:w-auto px-10 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black transition-all text-sm uppercase tracking-wide cursor-pointer"
                >
                  تجاهل وإغلاق
                </button>
                <button 
                  type="submit" 
                  className="w-full sm:w-auto px-12 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-2xl shadow-rose-600/30 transition-all text-base flex items-center justify-center gap-3 cursor-pointer group"
                >
                   {isEditMode ? 'حفظ وتحديث التغييرات الميدانية' : 'تسجيل وإلحاق مركز عمل جديد بالداتابيز'}
                   <Check className="w-5 h-5 group-hover:scale-125 transition-transform" />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MANAGE / CONNECTIVITY POPUP (Fully Integrated View) */}
      {isManageModalOpen && selectedCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 border">
            <div className="p-6 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{selectedCenter.name}</h2>
                  <p className="text-xs text-slate-500">تم تفعيله بالمرجع الميداني | كود: <span className="font-mono font-bold text-rose-600">{selectedCenter.code}</span></p>
                </div>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="bg-white p-2 rounded-xl text-slate-400 border hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Floor Attributes Summary banner */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-right">
                  <span className="block text-[11px] text-slate-500 font-bold mb-1">تكلفة دقيقة العمل</span>
                  <span className="text-xs font-extrabold text-slate-800 font-mono">{(selectedCenter.costPerHour / 60).toFixed(2)} ج.م/دقيقة</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-right">
                  <span className="block text-[11px] text-slate-500 font-bold mb-1">الموقع والمكانه</span>
                  <span className="text-xs font-extrabold text-rose-600">{selectedCenter.location || 'صالة التصنيع الرئيسية'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-right">
                  <span className="block text-[11px] text-slate-500 font-bold mb-1">المشرف الفني</span>
                  <span className="text-xs font-extrabold text-blue-600">{selectedCenter.supervisor || 'غير معين'}</span>
                </div>
              </div>

              {/* Status Switcher Panel */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">تغيير حالة توفر المركز للعمليات فورا:</span>
                  <span className="text-[10px] text-slate-400 mt-1">تعديل الحالة يؤثر على كفاءة جدولة بطاقات تشغيل أرض المصنع</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => handleQuickStatusChange(selectedCenter.id, 'active', e)}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${selectedCenter.status === 'active' || !selectedCenter.status ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'}`}
                  >
                    نشط كليا
                  </button>
                  <button 
                    onClick={(e) => handleQuickStatusChange(selectedCenter.id, 'idle', e)}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${selectedCenter.status === 'idle' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-700 border-slate-200'}`}
                  >
                    جاهز / خامل
                  </button>
                  <button 
                    onClick={(e) => handleQuickStatusChange(selectedCenter.id, 'maintenance', e)}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${selectedCenter.status === 'maintenance' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200'}`}
                  >
                    صيانة
                  </button>
                </div>
              </div>

              {/* Shift Calendar & Costs details in Manage Modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Costs Detail */}
                <div className="p-4 bg-rose-50/10 border border-rose-100 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1">
                     💰 تفصيل تكاليف التشغيل الاجمالية
                  </h4>
                  <div className="space-y-1.5 text-xs animate-fadeIn">
                    <div className="flex justify-between border-b border-rose-100/40 pb-1">
                      <span className="text-slate-500 font-medium">أجر العمالة المباشرة/ساعة:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedCenter.laborCost || 0} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-rose-100/40 pb-1">
                      <span className="text-slate-500 font-medium font-sans">استهلاك وإمداد الماكينات/ساعة:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedCenter.machineCost || 0} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-rose-100/40 pb-1">
                      <span className="text-slate-500 font-medium">منصرف عام وإداري إضافي/ساعة:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedCenter.overheadCost || 0} ج.م</span>
                    </div>
                    <div className="flex justify-between pt-1 text-sm font-black text-rose-600 border-t border-rose-200">
                      <span>إجمالي رسوم التكلفة/ساعة:</span>
                      <span className="font-mono">{selectedCenter.costPerHour} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Shifts Detail */}
                <div className="p-4 bg-indigo-50/10 border border-slate-150 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-indigo-850 flex items-center gap-1">
                     📆 تقاويم الورديات الميدانية المسجلة
                  </h4>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto">
                    {selectedCenter.shifts && selectedCenter.shifts.length > 0 ? (
                      selectedCenter.shifts.map((s, idx) => (
                        <div key={idx} className="p-2.5 bg-white border border-slate-150 rounded-lg text-xs leading-relaxed animate-fadeIn">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span className="text-indigo-900">{s.name}</span>
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">👥 {s.workersCount} عمال</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                            ⏱ {s.startTime} إلى {s.endTime}
                          </div>
                          {s.assignedEmployees && s.assignedEmployees.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 border-t border-slate-50 pt-1">
                              <span className="text-[10px] text-indigo-700 font-bold">الموظفون المعينون:</span>
                              {s.assignedEmployees.map((emp, empIdx) => (
                                <span key={`wc-emp-${emp.id ?? empIdx}-${empIdx}`} className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded font-bold">
                                  {emp.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-0.5 mt-1.5">
                            {s.activeDays.map((day, dayIdx) => (
                              <span key={`wc-day-${s.id}-${day}-${dayIdx}`} className="px-1.5 py-0.5 bg-slate-100 text-[8px] text-slate-600 font-bold rounded">
                                {day}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-450 italic text-center py-4 text-slate-400">لا توجد تقاويم ورديات مجدولة لهذا المركز.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Connected Active Job Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-indigo-700 flex items-center gap-1 border-b pb-1.5 font-sans">
                  <PlayCircle className="w-4 h-4" />
                  بطاقات التشغيل الجارية أرض المصنع (Active Shop floor)
                </h3>
                {activeJobs.length > 0 ? (
                  <div className="space-y-2">
                    {activeJobs.map((job, jIdx) => (
                      <div key={`wc-job-${job.id ?? jIdx}-${jIdx}`} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{job.operation}</p>
                          <p className="text-[10px] text-slate-500 mt-1">بطاقة: {job.id} | أمر: {job.orderNumber} | العامل: {job.worker}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-bold ${job.status === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {job.status === 'running' ? 'جاري العمل' : 'معلق'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2 italic">لا توجد بطاقات تشغيل نشطة على هذا الماكينة حالياً.</p>
                )}
              </div>

              {/* Maintenance tickets */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-rose-700 flex items-center gap-1 border-b pb-1.5 font-sans">
                  <Wrench className="w-4 h-4" />
                  طلبات وبلاغات الصيانة المسجلة (Maintenance Status)
                </h3>
                {maintenanceTickets.length > 0 ? (
                  <div className="space-y-2">
                    {maintenanceTickets.map((ticket, tIdx) => (
                      <div key={`wc-ticket-${ticket.id ?? tIdx}-${tIdx}`} className="p-3 bg-rose-50/30 border border-rose-100 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{ticket.description}</p>
                          <p className="text-[10px] text-slate-500 mt-1">المعرف: {ticket.id} | التاريخ: {ticket.scheduledDate} | النوع: {ticket.type === 'preventive' ? 'صيانة وقائية' : 'عطل وعلاج طارئ'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          ticket.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {ticket.status === 'completed' ? 'مكتملة' : 'قيد العمل'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2 bg-emerald-50/30 rounded-xl border border-dashed border-emerald-100 font-medium">✔ مركز العمل سليم بالكامل، ولا توجد بلاغات صيانة مسجلة ضده حالياً.</p>
                )}
              </div>

              {/* Associated Recipes BOM */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-700 flex items-center gap-1 border-b pb-1.5 font-sans">
                  <Layers className="w-4 h-4" />
                  وصفات تصنيع تعتمد على مراحل هذا المركز (Referenced BOMs)
                </h3>
                {associatedBoms.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {associatedBoms.map((bom) => (
                      <div key={bom.id} className="p-2.5 bg-slate-50 border rounded-xl text-xs">
                        <p className="font-bold text-slate-800 truncate">{bom.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1">للمنتج المصنع: {bom.productId} | إصدار {bom.version}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2 italic font-sans">لم يتم إقران هذا المركز بأي وصفة تصنيع حتى الآن في قسم الجودة.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-150 bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={(e) => handleOpenEdit(selectedCenter, e)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-colors block cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                تعديل المكون بالكامل
              </button>
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق وتاكيد
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
