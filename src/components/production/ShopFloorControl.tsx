import React, { useState, useEffect } from 'react';
import { 
  Package, Activity, Clock, Users, Wrench, Plus, X, 
  Play, Pause, CheckCircle2, AlertOctagon, Scale, TrendingUp, 
  Trash2, UserCheck, ChevronRight, Hash, Cpu, BarChart3, Eye, FileText, Check, ShieldAlert, Award, ClipboardList
} from 'lucide-react';
import { ProductionOrder, WorkCenter } from './types';
import { databaseStorage } from '../../utils/databaseStorage';

interface JobCard {
  id: string;
  orderNumber: string;
  operation: string;
  workCenter: string;
  workCenterId?: string;
  worker: string;
  producedQty: number;
  scrapQty: number;
  startTime: string;
  endTime?: string;
  status: 'running' | 'paused' | 'completed';
  notes?: string;
  targetQty?: number;
}

const DEFAULT_ORDERS: any[] = [];
const DEFAULT_CENTERS: any[] = [];
const MOCK_JOBS: JobCard[] = [];

export function ShopFloorControl() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [qualityChecks, setQualityChecks] = useState<any[]>([]);
  const [qualityAlerts, setQualityAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      const savedJobs = await databaseStorage.getItem<JobCard[]>('remo_production_shopfloor', []);
      const savedOrders = await databaseStorage.getItem<any[]>('remo_production_orders', []);
      const savedCenters = await databaseStorage.getItem<any[]>('remo_production_workcenters', []);
      const savedProducts = await databaseStorage.getItem<any[]>('remo_production_products', []);
      const savedChecks = await databaseStorage.getItem<any[]>('remo_pro_quality_checks', []);
      const savedAlerts = await databaseStorage.getItem<any[]>('remo_pro_quality_alerts', []);
      
      const cleanJobs = Array.isArray(savedJobs) ? savedJobs.filter(j => j && !['JC-1001', 'JC-1002'].includes(j.id)) : [];
      const cleanOrders = Array.isArray(savedOrders) ? savedOrders.filter(o => o && !['PRD-2026-001', 'PRD-2026-002', 'PRD-2026-003'].includes(o.orderNumber)) : [];
      const cleanCenters = Array.isArray(savedCenters) ? savedCenters.filter(c => c && !['MC-101', 'LN-001'].includes(c.code)) : [];

      setJobs(cleanJobs);
      setOrders(cleanOrders);
      setCenters(cleanCenters);
      setProducts(Array.isArray(savedProducts) ? savedProducts : []);
      setQualityChecks(Array.isArray(savedChecks) ? savedChecks : []);
      setQualityAlerts(Array.isArray(savedAlerts) ? savedAlerts : []);
      setIsLoading(false);
    };
    loadAll();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedJobToFinish, setSelectedJobToFinish] = useState<JobCard | null>(null);
  const [showLiveKPIs, setShowLiveKPIs] = useState(true);
  const [dispatchViewMode, setDispatchViewMode] = useState<'table' | 'grid'>('table');

  // Quality Control integration states
  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  const [selectedJobForQc, setSelectedJobForQc] = useState<JobCard | null>(null);
  const [qcStatus, setQcStatus] = useState<'accepted' | 'rejected'>('accepted');
  const [qcNotes, setQcNotes] = useState('');
  const [qcTestType, setQcTestType] = useState<'pass_fail' | 'measure'>('pass_fail');
  const [qcMeasuredValue, setQcMeasuredValue] = useState<number>(3.0);

  // Form states for creating job
  const [newJob, setNewJob] = useState<Partial<JobCard>>({
    orderNumber: '', 
    operation: '', 
    workCenterId: '', 
    worker: '', 
    status: 'paused',
    notes: '',
    targetQty: 50
  });

  // Finish modal entry numbers
  const [finishProduced, setFinishProduced] = useState(0);
  const [finishScrap, setFinishScrap] = useState(0);

  const saveJobs = async (updated: JobCard[]) => {
    setJobs(updated);
    await databaseStorage.setItem('remo_production_shopfloor', updated);
  };

  const handleAddJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.orderNumber || !newJob.operation || !newJob.workCenterId) {
      alert('الرجاء تعبئة الحقول المطلوبة لإصدار بطاقة العمل!');
      return;
    }

    const matchedCenter = centers.find(c => c.id === newJob.workCenterId || c.code === newJob.workCenterId);
    const centerName = matchedCenter ? matchedCenter.name : newJob.workCenterId;

    const matchedOrder = orders.find(o => o.orderNumber === newJob.orderNumber);
    const targetCount = matchedOrder ? matchedOrder.quantity : (newJob.targetQty || 50);

    const todayDate = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const added: JobCard = {
      id: `JC-${Math.floor(1000 + Math.random() * 9000)}`,
      orderNumber: newJob.orderNumber,
      operation: newJob.operation,
      workCenter: centerName,
      workCenterId: matchedCenter?.id || newJob.workCenterId,
      worker: newJob.worker || 'عامل وردية غير مسمى',
      producedQty: 0,
      scrapQty: 0,
      startTime: newJob.status === 'running' ? todayDate : '-',
      status: newJob.status || 'paused',
      notes: newJob.notes || '',
      targetQty: targetCount
    };

    const updated = [added, ...jobs];
    saveJobs(updated);
    setIsModalOpen(false);

    // Reset Form
    setNewJob({
      orderNumber: '',
      operation: '',
      workCenterId: '',
      worker: '',
      status: 'paused',
      notes: '',
      targetQty: 50
    });
  };

  // Start job execution
  const handleTogglePlay = (id: string, currentStatus: JobCard['status']) => {
    const todayDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const updated = jobs.map(j => {
      if (j.id === id) {
        const nextStatus = currentStatus === 'running' ? 'paused' : 'running';
        return {
          ...j,
          status: nextStatus as 'running' | 'paused',
          startTime: j.startTime === '-' ? todayDate : j.startTime
        };
      }
      return j;
    });
    saveJobs(updated);
  };

  // Open "Finish Job" modal
  const handleOpenFinishModal = (job: JobCard) => {
    setSelectedJobToFinish(job);
    setFinishProduced(job.producedQty);
    setFinishScrap(job.scrapQty);
    setIsCompleteModalOpen(true);
  };

  // Confirm Finishing Operation
  const handleConfirmFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobToFinish) return;

    const todayDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const updated = jobs.map(j => {
      if (j.id === selectedJobToFinish.id) {
        return {
          ...j,
          status: 'completed' as const,
          producedQty: finishProduced,
          scrapQty: finishScrap,
          endTime: todayDate
        };
      }
      return j;
    });

    saveJobs(updated);
    setIsCompleteModalOpen(false);
    setSelectedJobToFinish(null);

    // If matching production order exists, we could also update its progress
    const jobOrderNum = selectedJobToFinish.orderNumber;
    const orderToUpdate = orders.find(o => o.orderNumber === jobOrderNum);
    if (orderToUpdate) {
      // Increment or calculate percentage
      const targetQty = orderToUpdate.quantity || 1;
      const percentage = Math.min(100, Math.floor((finishProduced / targetQty) * 100));
      const updatedOrders = orders.map((o: any) => {
        if (o.orderNumber === jobOrderNum) {
          return {
            ...o,
            progress: selectStatusProgress(percentage)
          };
        }
        return o;
      });
      setOrders(updatedOrders);
      databaseStorage.setItem('remo_production_orders', updatedOrders);
    }
  };

  const selectStatusProgress = (prog: number) => {
    return prog > 100 ? 100 : prog;
  };

  const handleOpenQcModal = (job: JobCard) => {
    setSelectedJobForQc(job);
    setQcStatus('accepted');
    setQcNotes('');
    setQcTestType('pass_fail');
    setQcMeasuredValue(job.producedQty > 0 ? Number((job.producedQty / 10).toFixed(1)) : 5.0);
    setIsQcModalOpen(true);
  };

  const handleSaveQcCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForQc) return;

    // Load actual product details
    const matchedOrder = orders.find(o => o.orderNumber === selectedJobForQc.orderNumber);
    const targetProductCode = matchedOrder ? matchedOrder.productId : 'RAW-UNK';
    
    // Find product name
    const matchProd = products.find((p: any) => p.code === targetProductCode);
    const targetProductName = matchProd ? matchProd.name : 'منتج تشغيلي أرضية المصنع';

    const checkId = `QC-${Math.floor(1000 + Math.random() * 9000)}`;
    const today = new Date().toISOString().split('T')[0];

    // Create custom Quality Check record
    const newCheck = {
      id: checkId,
      qcpId: 'QCP-MANUAL-FLOOR',
      qcpTitle: `فحص جودة فوري - ${selectedJobForQc.operation}`,
      orderNumber: selectedJobForQc.orderNumber,
      productName: `${targetProductName} (${targetProductCode})`,
      testType: qcTestType,
      measuredValue: qcTestType === 'measure' ? qcMeasuredValue : 0,
      targetValue: qcTestType === 'measure' ? qcMeasuredValue : 0,
      toleranceMin: qcTestType === 'measure' ? Number((qcMeasuredValue * 0.9).toFixed(2)) : 0,
      toleranceMax: qcTestType === 'measure' ? Number((qcMeasuredValue * 1.1).toFixed(2)) : 0,
      unit: qcTestType === 'measure' ? 'وحدة قياس' : '',
      status: qcStatus,
      inspector: selectedJobForQc.worker || 'مهندس الجودة المناوب',
      lotNumber: `LOT-${selectedJobForQc.orderNumber}-${checkId}`,
      checkedDate: today,
      notes: qcNotes || `تم الفحص الفوري من قبل فني الصالة: ${selectedJobForQc.worker}`
    };

    // Save checks to databaseStorage key 'remo_pro_quality_checks'
    const updatedChecks = [newCheck, ...qualityChecks];
    setQualityChecks(updatedChecks);
    databaseStorage.setItem('remo_pro_quality_checks', updatedChecks);

    // If QA rejected, create NCR Quality Alert in 'remo_pro_quality_alerts'
    if (qcStatus === 'rejected') {
      const alertId = `QLT-${Math.floor(1000 + Math.random() * 9000)}`;
      const newAlert = {
        id: alertId,
        checkId: checkId,
        title: `حالة عدم مطابقة: ${selectedJobForQc.operation}`,
        referenceCode: selectedJobForQc.orderNumber,
        category: 'production',
        priority: 'high',
        stage: 'new',
        description: `تنبيه جودة فوري مرسل من صالة الإنتاج أثناء تشغيل البطاقة: [${selectedJobForQc.id}]. ملاحظات الفحص الميداني: ${qcNotes}`,
        createdDate: today,
        resolvedDate: null,
        assignedTo: 'أخصائيي وفريق الجودة الفني'
      };

      const updatedAlerts = [newAlert, ...qualityAlerts];
      setQualityAlerts(updatedAlerts);
      databaseStorage.setItem('remo_pro_quality_alerts', updatedAlerts);
    }

    // Append flag in job card notes
    const updatedJobs = jobs.map(j => {
      if (j.id === selectedJobForQc.id) {
        const statusLabel = qcStatus === 'accepted' ? 'سليم ومقبول ✓' : 'مرفوض وبه عيوب ❌';
        return {
          ...j,
          notes: j.notes 
            ? `${j.notes} | (فحص جودة: ${statusLabel} كود: ${checkId})` 
            : `(فحص جودة: ${statusLabel} كود: ${checkId})`
        };
      }
      return j;
    });
    saveJobs(updatedJobs);

    // Close Modal
    setIsQcModalOpen(false);
    setSelectedJobForQc(null);
  };

  const handleIncrementQty = (id: string, field: 'producedQty' | 'scrapQty', amount: number) => {
    const updated = jobs.map(j => {
      if (j.id === id) {
        const currentVal = j[field] || 0;
        const nextVal = Math.max(0, currentVal + amount);
        return {
          ...j,
          [field]: nextVal
        };
      }
      return j;
    });
    saveJobs(updated);
  };

  const handleDeleteJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من مسح وإلغاء بطاقة تشغيل أرض المصنع هذه تماماً؟')) {
      const updated = jobs.filter(j => j.id !== id);
      saveJobs(updated);
    }
  };

  // Metrics calculations
  const totalActive = jobs.filter(j => j.status === 'running').length;
  const totalPaused = jobs.filter(j => j.status === 'paused').length;
  const totalDone = jobs.filter(j => j.status === 'completed').length;
  
  const sumProduced = jobs.reduce((acc, j) => acc + j.producedQty, 0);
  const sumScrap = jobs.reduce((acc, j) => acc + j.scrapQty, 0);
  const scrapRate = sumProduced + sumScrap > 0 ? ((sumScrap / (sumProduced + sumScrap)) * 100).toFixed(1) : '0.0';

  // Live Machine/Work-center OEE & Loading Metrics
  const machinePerformance = (centers || []).map(center => {
    // find all job cards assigned to this work center code/name
    const centerJobs = jobs.filter(j => j.workCenterId === center.id || j.workCenter === center.name || j.workCenter.includes(center.code));
    const activeJob = centerJobs.find(j => j.status === 'running');
    const pausedJob = centerJobs.find(j => j.status === 'paused');
    
    let currentStatus = 'خامل (Idle)';
    let statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
    
    if (activeJob) {
      currentStatus = 'قيد العمل (Active)';
      statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (center.status === 'maintenance') {
      currentStatus = 'صيانة (Maintenance)';
      statusColor = 'text-rose-705 bg-rose-50 border-rose-200';
    } else if (pausedJob) {
      currentStatus = 'معلق مؤقتاً (Paused)';
      statusColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
    }
    
    const totalProduced = centerJobs.reduce((sum, j) => sum + (j.producedQty || 0), 0);
    const totalScrap = centerJobs.reduce((sum, j) => sum + (j.scrapQty || 0), 0);
    const totalTarget = centerJobs.reduce((sum, j) => sum + (j.targetQty || 50), 0);
    
    // Performance & Quality levels matching live inputs
    const performanceRate = totalTarget > 0 ? Math.min(100, Math.round((totalProduced / totalTarget) * 100)) : (center.efficiency || 90);
    const qualityRate = totalProduced > 0 ? Math.round(((totalProduced - totalScrap) / totalProduced) * 100) : 100;
    
    // OEE score = Availability * Performance * Quality
    const availabilityRate = activeJob ? 98 : (center.status === 'maintenance' ? 15 : 70);
    const oeeScore = Math.round((availabilityRate * (performanceRate / 100) * (qualityRate / 100)));
    
    return {
      ...center,
      currentStatus,
      statusColor,
      totalProduced,
      totalScrap,
      liveEfficiency: performanceRate,
      estimatedOee: Math.max(12, Math.min(100, oeeScore))
    };
  });

  // Live Worker KPIs & Quality statistics
  const workerList = Array.from(new Set(jobs.map(j => j.worker || 'فني غير محدد')));
  const workerPerformance = workerList.map(workerName => {
    const workerJobs = jobs.filter(j => j.worker === workerName);
    const totalProduced = workerJobs.reduce((sum, j) => sum + (j.producedQty || 0), 0);
    const totalScrap = workerJobs.reduce((sum, j) => sum + (j.scrapQty || 0), 0);
    const totalTarget = workerJobs.reduce((sum, j) => sum + (j.targetQty || 50), 0);
    
    const workerScrapRate = totalProduced + totalScrap > 0 ? (totalScrap / (totalProduced + totalScrap) * 100) : 0;
    const completionRate = totalTarget > 0 ? Math.min(100, Math.round((totalProduced / totalTarget) * 100)) : 100;
    
    let qualityBadge = 'ممتاز (Pristine QA)';
    let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (workerScrapRate > 6) {
      qualityBadge = 'فاقد متزايد (High Scrap)';
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (workerScrapRate > 2) {
      qualityBadge = 'مستوفي المعايير (Standard QA)';
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return {
      name: workerName,
      totalProduced,
      totalScrap,
      completionRate,
      scrapRate: workerScrapRate.toFixed(1),
      qualityBadge,
      badgeColor,
      activeJobs: workerJobs.filter(j => j.status === 'running').length
    };
  });

  return (
    <div className="space-y-8 animate-fadeIn" id="shop_floor_main_view">
      
      {/* Metrics Center - Bento-Grid Glowing Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/85 p-6 rounded-[2rem] flex items-center justify-between shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-indigo-200 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="space-y-1 text-right">
            <span className="block text-xs font-black text-slate-400 uppercase tracking-wider">البطاقات التشغيلية الجارية</span>
            <span className="text-3xl font-black text-indigo-700 font-mono tracking-tight block">
              {totalActive} <span className="text-xs font-bold text-slate-400">نشطة</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-bold block">● تتبع ميداني مباشر</span>
          </div>
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-indigo-650 group-hover:text-white transition-colors">
            <Clock className="w-6 h-6 animate-spin-slow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/85 p-6 rounded-[2rem] flex items-center justify-between shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-amber-200 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="space-y-1 text-right">
            <span className="block text-xs font-black text-slate-400 uppercase tracking-wider font-bold">تحت التوقف المؤقت</span>
            <span className="text-3xl font-black text-amber-600 font-mono tracking-tight block">
              {totalPaused} <span className="text-xs font-bold text-slate-400">معلقة</span>
            </span>
            <span className="text-[10px] text-amber-600 font-bold block">⚠️ متعطرة بانتظار استجابة</span>
          </div>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <Pause className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/85 p-6 rounded-[2rem] flex items-center justify-between shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-emerald-200 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="space-y-1 text-right">
            <span className="block text-xs font-black text-slate-400 uppercase tracking-wider font-bold">بطاقات مكتملة اليوم</span>
            <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight block">
              {totalDone} <span className="text-xs font-bold text-slate-400">مغلقة</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-bold block">✓ جرى الترحيل للمخازن</span>
          </div>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/85 p-6 rounded-[2rem] flex items-center justify-between shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-rose-200 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="space-y-1 text-right">
            <span className="block text-xs font-black text-slate-400 uppercase tracking-wider font-bold">معدل الفاقد للمواد</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-black text-rose-600 font-mono tracking-tight">{scrapRate}%</span>
              <span className="text-[10px] text-slate-400 font-bold">({sumScrap} هالك)</span>
            </div>
            <span className="text-[10px] text-rose-600 font-bold block">📉 معدل الهدر اليومي</span>
          </div>
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-rose-600 group-hover:text-white transition-colors">
            <Scale className="w-6 h-6" />
          </div>
        </div>
      </div>
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10 text-right">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/30 rounded-xl flex items-center justify-center text-indigo-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-white m-0">التحكم المباشر والمراقبة اللحظية الأرضية (Shop Floor Control Room)</h2>
          </div>
          <p className="text-slate-300 text-xs font-medium max-w-3xl leading-relaxed">
            غرفة تحكم مركزية لقادة صالة العمل ومراقبي الجودة. تُوفر الجداول التفاعلية دقة لحظية في تتبع العدادات، تسجيل كميات المنتجات الصالحة، وإسباغ تصنيفات الكفاءة والجدارة على العمال والماكينات.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center relative z-10 w-full lg:w-auto">
          {/* Dispatch View Mode Selector */}
          <div className="bg-slate-800 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-700 text-xs shadow-inner">
            <button 
              type="button"
              onClick={() => setDispatchViewMode('table')}
              className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer ${
                dispatchViewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              كشف جدول موحد
            </button>
            <button 
              type="button"
              onClick={() => setDispatchViewMode('grid')}
              className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer ${
                dispatchViewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              كروت تفصيلية
            </button>
          </div>

          <button 
            type="button"
            onClick={() => setShowLiveKPIs(!showLiveKPIs)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl font-black text-xs transition-all cursor-pointer ${
              showLiveKPIs 
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' 
                : 'bg-indigo-950 text-indigo-300 border-indigo-900 hover:bg-indigo-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showLiveKPIs ? 'إخفاء جداول الأداء الحي' : 'عرض جداول الأداء المباشر'}
          </button>
          
          <button 
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-600 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-600/20 text-xs cursor-pointer transition-all active:scale-95 animate-pulse-once"
          >
            <Plus className="w-4 h-4" />
            إصدار بطاقة تشغيل ذكية
          </button>
        </div>
      </div>

      {/* Redesigned Real-time Performance Cockpit - BEAUTIFUL TABLES */}
      {showLiveKPIs && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 text-right">
          
          {/* Table 1: Live Machine Performance (6 columns) */}
          <div className="xl:col-span-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 leading-none">
                  <Cpu className="w-4 h-4 text-emerald-500" />
                  كفاءة الماكينات والأصول (Live Machine OEE)
                </h3>
              </div>
              <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-100">تحليل لحظي</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-150">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                  <tr>
                    <th className="p-3">الماكينة / الكود</th>
                    <th className="p-3">الحالة الراهنة</th>
                    <th className="p-3 text-center">مؤشر OEE الكلي</th>
                    <th className="p-3 text-center">كفاءة التحميل</th>
                    <th className="p-3 text-center">الإنتاج السليم</th>
                    <th className="p-3 text-center text-rose-600">الهالك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {machinePerformance.map((mac, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/40 transition-colors font-medium">
                      
                      <td className="p-3">
                        <span className="font-extrabold text-slate-800 block text-[11px]">{mac.name}</span>
                        <span className="text-[9px] text-indigo-650 font-mono font-bold mt-0.5 block">{mac.code || `WC-${idx}`}</span>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${mac.statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${mac.currentStatus.includes('قيد') ? 'bg-emerald-500 animate-pulse' : mac.currentStatus.includes('صيانة') ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
                          {mac.currentStatus}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-mono font-black text-xs ${mac.estimatedOee > 80 ? 'text-emerald-600' : mac.estimatedOee > 50 ? 'text-amber-500' : 'text-rose-600'}`}>
                            {mac.estimatedOee}%
                          </span>
                          <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${mac.estimatedOee > 80 ? 'bg-emerald-500' : mac.estimatedOee > 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                              style={{ width: `${mac.estimatedOee}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono text-slate-705 font-bold">{mac.liveEfficiency}%</span>
                          <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${mac.liveEfficiency}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center font-mono font-black text-slate-700">
                        {mac.totalProduced} <span className="text-[9px] font-medium text-slate-400">وحدة</span>
                      </td>

                      <td className="p-3 text-center font-mono font-black text-rose-600 bg-rose-50/10">
                        {mac.totalScrap > 0 ? (
                          <span className="px-1.5 py-0.5 bg-rose-50 text-[10px] rounded border border-rose-100 text-rose-700">
                            {mac.totalScrap} هالك
                          </span>
                        ) : '0'}
                      </td>
                    </tr>
                  ))}
                  {machinePerformance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-slate-400 italic">لم نجد أي معلومات لمراكز التشغيل.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Live Worker Performance (6 columns) */}
          <div className="xl:col-span-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 leading-none">
                  <Users className="w-4 h-4 text-indigo-600" />
                  إنتاجية وكفاءة مشغلي الصالة (Live Worker KPIs)
                </h3>
              </div>
              <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-100 font-mono">Real-time</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-150">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                  <tr>
                    <th className="p-3">الفني / المشغل</th>
                    <th className="p-3">تقييم الجودة</th>
                    <th className="p-3 text-center">إنجاز الحصص القياسية</th>
                    <th className="p-3 text-center text-rose-600">نسبة هالك الاستلام</th>
                    <th className="p-3 text-center">إجمالي الإنتاج</th>
                    <th className="p-3 text-center">البطاقات الجارية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {workerPerformance.map((work, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/40 transition-colors font-medium">
                      
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-[9px] flex items-center justify-center font-mono">
                            {String(work.name || '').substring(0, 2)}
                          </div>
                          <span className="font-extrabold text-slate-800 block text-[11px]">{String(work.name || '')}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black border ${work.badgeColor}`}>
                          <Award className="w-3 h-3" />
                          {work.qualityBadge}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono text-indigo-700 font-extrabold">{work.completionRate}%</span>
                          <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${work.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center font-mono font-black text-rose-600 bg-rose-50/10">
                        {work.scrapRate}%
                      </td>

                      <td className="p-3 text-center font-mono font-black text-slate-700">
                        {work.totalProduced} <span className="text-[9px] font-medium text-slate-400">كمية</span>
                      </td>

                      <td className="p-3 text-center font-mono text-slate-600 font-extrabold">
                        {work.activeJobs > 0 ? (
                          <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-sm text-[9px] font-black">
                            {work.activeJobs} نشط
                          </span>
                        ) : '0'}
                      </td>
                    </tr>
                  ))}
                  {workerPerformance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-slate-400 italic">الرجاء إسناد مهام للعاملين لعرض إحصاءات الأداء اللحظية.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Controller Core - Unified Master Table vs Grid Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-4">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-650" />
            بطاقات وكشوفات التحكم في صالة الإنتاج الميدانية (Active Dispatch Slips)
          </h3>
          <span className="text-[11px] text-slate-400 font-extrabold font-mono">البطاقات النفاذة بالصالة: {jobs.length}</span>
        </div>

        {dispatchViewMode === 'table' ? (
          /* MASTER UNIFIED DISPATCH TABLE */
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xs transition-all hover:shadow-lg text-right">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-4 rounded-rt-[2rem]">رمز البطاقة</th>
                    <th className="p-4">أمر الإنتاج</th>
                    <th className="p-4">العملية والوصف الميداني</th>
                    <th className="p-4">مركز العمل المسند</th>
                    <th className="p-4">الفني المسؤول</th>
                    <th className="p-4 text-center">الكمية المقبولة</th>
                    <th className="p-4 text-center">تعديل سريع (صالح)</th>
                    <th className="p-4 text-center text-rose-300">الهالك</th>
                    <th className="p-4 text-center">تعديل سريع (هالك)</th>
                    <th className="p-4">البدء / الإغلاق</th>
                    <th className="p-4 text-center">الوضعية الحالية</th>
                    <th className="p-4 text-center rounded-lt-[2rem]">إجراءات المشرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {jobs.map((job) => {
                    const finishedAtPercent = Math.min(100, Math.floor(((job.producedQty || 0) / (job.targetQty || 50)) * 100));
                    return (
                      <tr 
                        key={job.id} 
                        className={`hover:bg-slate-50/40 transition-colors ${
                          job.status === 'running' ? 'bg-indigo-50/5' : job.status === 'completed' ? 'bg-slate-50/20' : ''
                        }`}
                      >
                        
                        {/* Job ID */}
                        <td className="p-3">
                          <span className="text-[10px] font-mono font-black bg-slate-900 text-white px-2 py-0.5 rounded-md shadow-xs">
                            {job.id}
                          </span>
                        </td>

                        {/* Production Order Code */}
                        <td className="p-3">
                          <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {job.orderNumber}
                          </span>
                        </td>

                        {/* Operation Name */}
                        <td className="p-3 max-w-[200px]">
                          <span className="font-extrabold text-slate-800 block text-[11px] leading-relaxed">{job.operation}</span>
                          {job.notes && (
                            <span className="text-[9px] text-amber-700 font-bold block mt-0.5">⚠️ {job.notes}</span>
                          )}
                        </td>

                        {/* Work Center */}
                        <td className="p-3">
                          <span className="font-extrabold text-slate-700 block">{job.workCenter}</span>
                        </td>

                        {/* Worker */}
                        <td className="p-3">
                          <span className="font-bold text-slate-600 block">{job.worker}</span>
                        </td>

                        {/* Produced Acceptable */}
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono font-black text-slate-800 text-xs">
                              {job.producedQty} <span className="text-[10px] font-bold text-slate-400">/ {job.targetQty}</span>
                            </span>
                            <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-350 ${job.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                style={{ width: `${finishedAtPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Acceptable Increments */}
                        <td className="p-3 text-center">
                          {job.status !== 'completed' ? (
                            <div className="inline-flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-250 font-mono">
                              <button 
                                type="button"
                                onClick={() => handleIncrementQty(job.id, 'producedQty', -5)}
                                className="w-6 h-6 rounded bg-white hover:bg-rose-50 border border-slate-205 font-black text-[10px] cursor-pointer"
                                title="إنقاص ٥ قطع"
                              >
                                -٥
                              </button>
                              <strong className="font-mono text-slate-800 text-[11px] w-6 text-center">{job.producedQty}</strong>
                              <button 
                                type="button"
                                onClick={() => handleIncrementQty(job.id, 'producedQty', 5)}
                                className="w-6 h-6 rounded bg-white hover:bg-emerald-50 border border-slate-205 font-black text-[10px] cursor-pointer"
                                title="زيادة ٥ قطع"
                              >
                                +٥
                              </button>
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-black text-xs">مؤمَّن</span>
                          )}
                        </td>

                        {/* Scrap / Defect Count */}
                        <td className="p-3 text-center">
                          <span className={`font-mono text-xs font-black ${job.scrapQty > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {job.scrapQty} تالف
                          </span>
                        </td>

                        {/* Scrap Increments */}
                        <td className="p-3 text-center">
                          {job.status !== 'completed' ? (
                            <div className="inline-flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-250 font-mono">
                              <button 
                                type="button"
                                onClick={() => handleIncrementQty(job.id, 'scrapQty', -1)}
                                className="w-6 h-6 rounded bg-white hover:bg-rose-50 border border-slate-205 font-black text-[10px] cursor-pointer"
                              >
                                -١
                              </button>
                              <strong className="font-mono text-rose-600 text-[11px] w-4 text-center">{job.scrapQty}</strong>
                              <button 
                                type="button"
                                onClick={() => handleIncrementQty(job.id, 'scrapQty', 1)}
                                className="w-6 h-6 rounded bg-white hover:bg-rose-50 border border-slate-205 font-black text-[10px] cursor-pointer"
                              >
                                +١
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>

                        {/* Shift Start / Stop times */}
                        <td className="p-3 text-slate-500 font-mono text-[10px] font-semibold">
                          <div>بدء: {job.startTime}</div>
                          {job.endTime && <div className="text-emerald-600 font-black mt-0.5">نهاية: {job.endTime}</div>}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          {job.status === 'running' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold text-[9px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              نشط (دوران)
                            </span>
                          )}
                          {job.status === 'paused' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-extrabold text-[9px] bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              معطل مؤقتاً
                            </span>
                          )}
                          {job.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 text-slate-500 font-extrabold text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              مرحَّل ومكتمل
                            </span>
                          )}
                        </td>

                        {/* Quick Control Actions */}
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {job.status !== 'completed' ? (
                              <>
                                <button 
                                  type="button"
                                  onClick={() => handleTogglePlay(job.id, job.status)}
                                  className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
                                    job.status === 'running' 
                                      ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100' 
                                      : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                                  }`}
                                  title={job.status === 'running' ? 'تعليق الوردية مؤقتاً' : 'استئناف تشغيل الماكينة'}
                                >
                                  {job.status === 'running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                </button>

                                <button 
                                  type="button"
                                  onClick={() => handleOpenFinishModal(job)}
                                  className="p-1.5 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                  title="إقفال وترحيل البطاقة"
                                >
                                  <Check className="w-3.5 h-3.5 font-bold" />
                                </button>

                                <button 
                                  type="button"
                                  onClick={() => handleOpenQcModal(job)}
                                  className="p-1.5 border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                                  title="إجراء فحص جودة فوري"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-black">جاهز</span>
                                <button 
                                  type="button"
                                  onClick={() => handleOpenQcModal(job)}
                                  className="p-1 px-1.5 text-purple-700 bg-purple-50 border border-purple-100 rounded hover:bg-purple-100 transition-colors cursor-pointer"
                                  title="إجراء فحص جودة ميداني فوري"
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <button 
                              type="button"
                              onClick={(e) => handleDeleteJob(job.id, e)}
                              className="p-1.5 border border-rose-105 text-rose-650 text-rose-605 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف سجل السطر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={12} className="text-center py-12 text-slate-400 font-extrabold bg-slate-50/20 italic">
                        لا توجد كشوف تشغيل نفاذة بالدفاتر حالياً. قم بإصدار بطاقة تشغيل ذكية لتنظيم صالة المصنع.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* DETAILED GRID CARDS */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-right">
            {jobs.map(job => {
              const finishedAtPercent = Math.min(100, Math.floor(((job.producedQty || 0) / (job.targetQty || 50)) * 105));

              return (
                <div 
                  key={job.id} 
                  className={`p-6 rounded-[2rem] border transition-all ${
                    job.status === 'running' ? 'border-indigo-300 bg-indigo-50/10 shadow-md shadow-indigo-100/30' : 
                    job.status === 'completed' ? 'border-emerald-200 bg-emerald-50/10 opacity-90' : 'border-slate-200 bg-white'
                  } relative overflow-hidden group`}
                >
                  {/* Decorative state bar */}
                  {job.status === 'running' && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-indigo-500 animate-pulse" />
                  )}
                  {job.status === 'completed' && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500" />
                  )}

                  {/* Header info */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-black bg-slate-900 text-white px-2 py-0.5 rounded shadow-sm">
                          {job.id}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-100">
                          أمر: {job.orderNumber}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm mt-3 leading-relaxed">{job.operation}</h3>
                      {job.notes && (
                        <p className="text-[11px] text-amber-700 italic mt-1 font-bold">🔍 تعليمات: {job.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 text-xs">
                      {job.status === 'running' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[9px] bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full animate-pulse">
                          ● دوران نشط
                        </span>
                      )}
                      {job.status === 'paused' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-black text-[9px] bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                          ● موقوف حالياً
                        </span>
                      )}
                      {job.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-black text-[9px] bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                          ● مرحل وتام
                        </span>
                      )}

                      <button 
                        type="button"
                        onClick={(e) => handleDeleteJob(job.id, e)}
                        className="p-1 px-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100 cursor-pointer"
                        title="حذف البطاقة التأسيسية"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Parameters Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-150 my-4 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="block text-[9px] text-slate-400">مركز العمل المسند</span>
                        <strong className="text-slate-800">{job.workCenter}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="block text-[9px] text-slate-400">الفني المسؤول المناوب</span>
                        <strong className="text-slate-800">{job.worker}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t pt-2.5 mt-2 col-span-2 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <div className="font-mono text-[10px] font-bold">
                        تاريخ إطلاق الوردية: <strong className="text-slate-700">{job.startTime}</strong> {job.endTime ? `تاريخ الإنجاز: ${job.endTime}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Counters */}
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">المستهدف بالأمر: <strong className="font-mono text-slate-700">{job.targetQty || 50} وحدة</strong></span>
                      <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-mono text-[9px]">{finishedAtPercent}% من الحصة</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${job.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-650'}`}
                        style={{ width: `${finishedAtPercent}%` }}
                      />
                    </div>

                    {job.status !== 'completed' ? (
                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        
                        {/* Rec produced */}
                        <div className="bg-emerald-50/30 p-3 rounded-xl border border-emerald-150/40 flex flex-col justify-between">
                          <span className="text-[10px] text-emerald-800 font-black block mb-1">الكمية الصالحة المقبولة</span>
                          <div className="flex items-center justify-between">
                            <button 
                              type="button"
                              onClick={() => handleIncrementQty(job.id, 'producedQty', -5)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-emerald-105 border font-bold text-xs cursor-pointer"
                            >
                              -٥
                            </button>
                            <span className="font-mono font-black text-emerald-700 text-xs">{job.producedQty}</span>
                            <button 
                              type="button"
                              onClick={() => handleIncrementQty(job.id, 'producedQty', 5)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-emerald-105 border font-bold text-xs cursor-pointer"
                            >
                              +٥
                            </button>
                          </div>
                        </div>

                        {/* Rec scrap */}
                        <div className="bg-rose-50/30 p-3 rounded-xl border border-rose-150/40 flex flex-col justify-between">
                          <span className="text-[10px] text-rose-800 font-black block mb-1">الفواقد والعوادم بالمصنع</span>
                          <div className="flex items-center justify-between">
                            <button 
                              type="button"
                              onClick={() => handleIncrementQty(job.id, 'scrapQty', -1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-rose-105 border font-bold text-xs cursor-pointer"
                            >
                              -١
                            </button>
                            <span className="font-mono font-black text-rose-700 text-xs">{job.scrapQty}</span>
                            <button 
                              type="button"
                              onClick={() => handleIncrementQty(job.id, 'scrapQty', 1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-rose-105 border font-bold text-xs cursor-pointer"
                            >
                              +١
                            </button>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="bg-slate-50 p-3 rounded-xl flex justify-around text-xs font-bold text-slate-700 border text-center font-mono">
                        <div>
                          <span className="block text-[9px] text-slate-400 font-bold mb-1">المخرجات الصالحة النهائية</span>
                          <span className="text-emerald-600 font-black text-sm">{job.producedQty} وحدة</span>
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div>
                          <span className="block text-[9px] text-slate-405 text-slate-400 font-bold mb-1">الهدر والعوادم الفعلية</span>
                          <span className="text-rose-600 font-black text-sm">{job.scrapQty} هالك</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Commands strip */}
                  <div className="border-t border-slate-100 pt-4 mt-4 flex flex-wrap gap-2">
                    {job.status !== 'completed' ? (
                      <>
                        <button 
                          type="button"
                          onClick={() => handleTogglePlay(job.id, job.status)}
                          className={`flex-1 min-w-[120px] py-1.5 rounded-xl transition-all font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                            job.status === 'running' 
                              ? 'bg-amber-100 hover:bg-amber-105 text-amber-700 border border-amber-200' 
                              : 'bg-indigo-650 hover:bg-indigo-700 text-white shadow-md'
                          }`}
                        >
                          {job.status === 'running' ? (
                            <>
                              <Pause className="w-3 h-3" />
                              تعليق الوردية
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              دوران الماكينة
                            </>
                          )}
                        </button>

                        <button 
                          type="button"
                          onClick={() => handleOpenFinishModal(job)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Check className="w-3 h-3 font-bold" />
                          ترحيل
                        </button>

                        <button 
                          type="button"
                          onClick={() => handleOpenQcModal(job)}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 font-black rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          فحص الجودة
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between gap-2 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 font-black">
                          ✓ جرى الترحيل بنجاح وتم تجميد البطاقة
                        </span>
                        <button 
                          type="button"
                          onClick={() => handleOpenQcModal(job)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg text-[9px] flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldAlert className="w-3 h-3 cursor-pointer" />
                          فحص الجودة الميداني
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE JOB MODAL - Upgraded for High Fidelity design templates */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-205 text-right relative font-sans">
            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-505 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 m-0">إصدار بطاقة عمل ميدانية ذكية</h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">يُغذي النظام تسلسل الحصيلة التأسيسية لحظياً للوحات التحكم</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 border border-slate-200 bg-white rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddJobSubmit} className="p-6 space-y-4">
              
              {/* Target Order dropdown selection */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-400 tracking-wider">أمر الإنتاج المراد إسناد التشغيل له</label>
                <select
                  required
                  value={newJob.orderNumber}
                  onChange={e => {
                    const ordNum = e.target.value;
                    const match = orders.find(o => o.orderNumber === ordNum);
                    setNewJob(prev => ({
                      ...prev,
                      orderNumber: ordNum,
                      targetQty: match ? match.quantity : 50
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-550/10 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs text-slate-800 font-extrabold cursor-pointer transition-all"
                >
                  <option value="">-- حدد أمر الإنتاج القياسي --</option>
                  {orders.map((o, idx) => (<option key={`ord-sfc-${o.id || o.orderNumber || idx}-${idx}`} value={o.orderNumber}>
                      {o.orderNumber} (المستهدف بأمر التصنيع الكلي: {o.quantity} {o.productId})
                    </option>
                  ))}
                  {orders.length === 0 && (
                    <option value="" disabled>لا توجد أوامر إنتاج فعالة بالفرع</option>
                  )}
                </select>
                <span className="text-[9px] text-indigo-700 font-bold block">يدمج النظام كمية البطاقة تلقائياً بالمخزن الإجمالي للمنتج</span>
              </div>

              {/* Name description */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-400 tracking-wider">رمز أو اسم خطوة العمل والتشغيل الميدانية</label>
                <input 
                  required
                  type="text" 
                  placeholder="مثال: الخراطة بالليزر، لف الكابلات الكهربية الفرعي"
                  value={newJob.operation}
                  onChange={e => setNewJob({...newJob, operation: e.target.value})}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs font-bold transition-all"
                />
              </div>

              {/* Allied machine & operator selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 tracking-wider">الماكينة / مركز العمل المسند</label>
                  <select
                    required
                    value={newJob.workCenterId}
                    onChange={e => setNewJob({...newJob, workCenterId: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs text-slate-800 font-bold cursor-pointer transition-all"
                  >
                    <option value="">-- حدد مركز العمل --</option>
                    {centers.map((c, idx) => (<option key={`wc-sfc-${c.id || idx}-${idx}`} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 tracking-wider">العامل المشغل (موارد البشرية)</label>
                  <input 
                    required
                    type="text" 
                    placeholder="مثال: ممدوح عبد السلام"
                    value={newJob.worker}
                    onChange={e => setNewJob({...newJob, worker: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs font-bold transition-all"
                  />
                </div>
              </div>

              {/* Status and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 tracking-wider">الوضعية المبدئية للخطوة</label>
                  <select 
                    value={newJob.status}
                    onChange={e => setNewJob({...newJob, status: e.target.value as 'running' | 'paused'})}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs font-bold cursor-pointer transition-all"
                  >
                    <option value="paused">معلق وبانتظار أمر البدء (Paused)</option>
                    <option value="running">جاري ومعاود الدوران (Running)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 tracking-wider">ملاحظات التشغيل أو البعد القياسي</label>
                  <input 
                    type="text" 
                    placeholder="مثال: سرعة 40 دورة في الدقيقة"
                    value={newJob.notes}
                    onChange={e => setNewJob({...newJob, notes: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs font-bold transition-all"
                  />
                </div>
              </div>

              {/* form footer actions */}
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/10 transition-colors active:scale-95"
                >
                  🚀 إرسال بطاقة التشغيل المباشر
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 text-center cursor-pointer transition-all"
                >
                  تراجع وإلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* COMPLETE / FINISH OPERATION DIALOG */}
      {isCompleteModalOpen && selectedJobToFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 text-right relative font-sans">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md animate-pulse">
                  <Check className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 m-0 text-emerald-700">إغلاق وتدوين بطاقة التشغيل: {selectedJobToFinish.id}</h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">مطابقة الحصيلة النهائية لقسم الإنتاج وحساب معدلات OEE</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsCompleteModalOpen(false)} 
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 border border-slate-200 bg-white rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmFinish} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-1.5 text-xs font-bold leading-relaxed text-slate-705 shadow-inner">
                <p>العملية المكتملة: <span className="text-slate-900 font-black">{selectedJobToFinish.operation}</span></p>
                <p>مركز العمل المسؤول: <span className="text-slate-900 font-black">{selectedJobToFinish.workCenter}</span></p>
                <p>المستهدف المخطط بالأمر: <span className="text-indigo-700 font-black font-mono">{selectedJobToFinish.targetQty} وحدات</span></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-400">الكمية الصالحة المنتجة المعتمدة</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    value={finishProduced}
                    onChange={e => setFinishProduced(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-mono font-black text-slate-800 text-center text-xs transition-all"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">القطع المطابقة تماماً للجودة</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-400 text-rose-600">هادر وعوادم التشغيل الفعلية</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    value={finishScrap}
                    onChange={e => setFinishScrap(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 font-mono font-black text-rose-600 text-center text-xs transition-all"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">القطع المستبعدة أو المعيبة برمجياً</span>
                </div>
              </div>

              {/* Modal footer actions */}
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-slate-900 text-white font-black rounded-xl text-xs cursor-pointer shadow-lg transition-colors active:scale-95"
                >
                  ✓ تثبيت وتعديل الحصيلة وترحيل البطاقة نهائياً
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCompleteModalOpen(false)} 
                  className="px-5 py-3 bg-slate-105 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 text-center cursor-pointer transition-all"
                >
                  إلغاء الترحيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK INLINE QUALITY CONTROL RECORDING MODAL */}
      {isQcModalOpen && selectedJobForQc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-fadeIn text-right font-sans">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 relative">
            <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="p-6 border-b border-purple-100 flex justify-between items-center bg-purple-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-md">
                  <ShieldAlert className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 m-0">تسجيل فحص الجودة الفوري بأرض المصنع</h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">ربط مباشر مع نقطة فحص جودة Odoo وحالة مطابقة الدفعة</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsQcModalOpen(false);
                  setSelectedJobForQc(null);
                }} 
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 border border-slate-200 bg-white rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQcCheck} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-1.5 text-xs font-semibold leading-relaxed text-slate-700">
                <p>البطاقة الفنية: <span className="text-slate-900 font-black">{selectedJobForQc.id}</span></p>
                <p>العملية الميدانية: <span className="text-slate-900 font-black">{selectedJobForQc.operation}</span></p>
                <p>أمر الإنتاج المرتبط: <span className="text-indigo-700 font-black font-mono">{selectedJobForQc.orderNumber}</span></p>
                <p>الفني المناوب: <span className="text-slate-800 font-black">{selectedJobForQc.worker}</span></p>
              </div>

              {/* Status input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">نتيجة اختبار المطابقة الفني</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setQcStatus('accepted')}
                    className={`p-3 rounded-xl border font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      qcStatus === 'accepted' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-4 h-4 font-bold" />
                    مقبول ومطابق ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setQcStatus('rejected')}
                    className={`p-3 rounded-xl border font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      qcStatus === 'rejected' 
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <X className="w-4 h-4 font-bold" />
                    مرفوض وفاشل ❌
                  </button>
                </div>
                {qcStatus === 'rejected' && (
                  <p className="text-[9px] text-rose-600 font-bold">
                    ⚠️ تنبيك: سيقوم النظام بإنشاء "أمر تنبيه جودة (Quality Alert NCR)" بشكل آلي لمعالجة الانحراف.
                  </p>
                )}
              </div>

              {/* Test Type selection */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">نوعية الفحص الميداني</label>
                <select
                  value={qcTestType}
                  onChange={e => setQcTestType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 outline-none text-xs text-slate-800 font-bold"
                >
                  <option value="pass_fail">فحص قبولي / ثنائي (نجاح/فشل)</option>
                  <option value="measure">فحص قياسي / تجريبي (إدخال معلمة قياس)</option>
                </select>
              </div>

              {/* Measured values */}
              {qcTestType === 'measure' && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="block text-[11px] font-black text-slate-400">القيمة والبعد المقاس فعلياً بالصالة</label>
                  <div className="relative">
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={qcMeasuredValue}
                      onChange={e => setQcMeasuredValue(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 font-mono font-black text-slate-800 text-center text-xs outline-none"
                    />
                    <div className="absolute inset-y-2 left-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-[9px] font-black text-slate-400">
                      مقياس ملم/سم
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">ملاحظات ومرئيات مراقب الجودة الفوري</label>
                <textarea 
                  rows={2}
                  placeholder="سر دقة القياس، تشوهات معينة، أو سبب الرفض إن وجد..."
                  value={qcNotes}
                  onChange={e => setQcNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 outline-none font-medium text-slate-705 text-slate-700 text-xs leading-relaxed"
                />
              </div>

              {/* form footer actions */}
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-slate-900 text-white font-black rounded-xl text-xs cursor-pointer shadow-lg transition-colors active:scale-95"
                >
                  🚀 ترحيل فحص الجودة وربطه بالملفات
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsQcModalOpen(false);
                    setSelectedJobForQc(null);
                  }} 
                  className="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 text-center cursor-pointer transition-all"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
