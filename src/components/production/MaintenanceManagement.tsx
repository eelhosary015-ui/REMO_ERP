import React, { useState, useEffect } from 'react';
import { Wrench, ShieldAlert, CheckCircle, Clock, X } from 'lucide-react';

interface MaintenanceTask {
  id: string;
  workCenterId: string;
  workCenterName: string;
  type: 'preventive' | 'corrective' | 'breakdown';
  description: string;
  scheduledDate: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const MOCK_TASKS: MaintenanceTask[] = [];

export function MaintenanceManagement() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>(() => {
    const saved = localStorage.getItem('remo_production_maintenance');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(t => t && !['MT-001', 'MT-002'].includes(t.id));
        }
      } catch (e) { console.error('Failed to parse from local storage'); }
    }
    return [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<MaintenanceTask>>({
    workCenterId: '', workCenterName: '', type: 'preventive', description: '', scheduledDate: '', status: 'pending'
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.workCenterName || !newTask.description) return;

    const added: MaintenanceTask = {
      ...(newTask as MaintenanceTask),
      id: `MT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      workCenterId: newTask.workCenterId || 'VARIOUS'
    };

    const updated = [...tasks, added];
    setTasks(updated);
    localStorage.setItem('remo_production_maintenance', JSON.stringify(updated));
    
    setIsModalOpen(false);
    setNewTask({ workCenterId: '', workCenterName: '', type: 'preventive', description: '', scheduledDate: '', status: 'pending' });
  };


  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'preventive': return 'bg-blue-100 text-blue-700';
      case 'corrective': return 'bg-amber-100 text-amber-700';
      case 'breakdown': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'preventive': return 'وقائية (Preventive)';
      case 'corrective': return 'علاجية (Corrective)';
      case 'breakdown': return 'طارئة/أعطال (Breakdown)';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">إدارة الصيانة والمعدات</h2>
          <p className="text-slate-500 text-sm mt-1">تخطيط ومتابعة صيانة الماكينات ومراكز العمل</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700"
        >
          <ShieldAlert className="w-5 h-5" />
          تسجيل بلاغ عطل
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">رقم المهمة</th>
              <th className="p-4 font-bold text-slate-600">مركز العمل / الماكينة</th>
              <th className="p-4 font-bold text-slate-600">نوع الصيانة</th>
              <th className="p-4 font-bold text-slate-600">الوصف</th>
              <th className="p-4 font-bold text-slate-600">التاريخ المجدول</th>
              <th className="p-4 font-bold text-slate-600">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-4 font-mono font-bold text-slate-700">{task.id}</td>
                <td className="p-4 font-bold text-indigo-600">{task.workCenterName}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${getTypeStyle(task.type)}`}>
                    {getTypeName(task.type)}
                  </span>
                </td>
                <td className="p-4 text-slate-600 max-w-xs truncate">{task.description}</td>
                <td className="p-4 text-slate-600">{task.scheduledDate}</td>
                <td className="p-4">
                  {task.status === 'pending' && <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded w-fit"><Clock className="w-3 h-3"/> معلقة</span>}
                  {task.status === 'in_progress' && <span className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded w-fit"><Wrench className="w-3 h-3"/> جاري العمل</span>}
                  {task.status === 'completed' && <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded w-fit"><CheckCircle className="w-3 h-3"/> مكتملة</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">تسجيل بلاغ صيانة / طلب فحص</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">مركز العمل / الماكينة</label>
                  <input 
                    required
                    type="text" 
                    value={newTask.workCenterName}
                    onChange={e => setNewTask({...newTask, workCenterName: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ الصيانة / البلاغ</label>
                  <input 
                    required
                    type="date" 
                    value={newTask.scheduledDate}
                    onChange={e => setNewTask({...newTask, scheduledDate: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">نوع الصيانة المطلوبة</label>
                  <select 
                    value={newTask.type}
                    onChange={e => setNewTask({...newTask, type: e.target.value as MaintenanceTask['type']})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    <option value="preventive">وقائية (مجدولة)</option>
                    <option value="corrective">علاجية (اكتشاف خلل)</option>
                    <option value="breakdown">طارئة (توقف تام/عطل)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">حالة المهمة</label>
                  <select 
                    value={newTask.status}
                    onChange={e => setNewTask({...newTask, status: e.target.value as MaintenanceTask['status']})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    <option value="pending">معلقة</option>
                    <option value="in_progress">جاري العمل</option>
                    <option value="completed">مكتملة</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">وصف العطل / المطلوب</label>
                <textarea 
                  required
                  rows={3}
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-bold">
                  حفظ وتسجيل المهمة
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
