import React from 'react';
import { Plus, Trash2, Users, Cpu, Clock, DollarSign, Calculator } from 'lucide-react';
import { LaborStage, MachineItem } from './types';

interface LaborAndMachinesTabProps {
  labor: LaborStage[];
  onChangeLabor: (labor: LaborStage[]) => void;
  machines: MachineItem[];
  onChangeMachines: (machines: MachineItem[]) => void;
  batchSize: number;
}

export const LaborAndMachinesTab: React.FC<LaborAndMachinesTabProps> = ({
  labor,
  onChangeLabor,
  machines,
  onChangeMachines,
  batchSize
}) => {
  // Labor handlers
  const handleUpdateLabor = (index: number, updates: Partial<LaborStage>) => {
    const updated = [...labor];
    const item = { ...updated[index], ...updates };
    item.cost = Number((item.workers * item.hours * item.hourly_rate).toFixed(2));
    updated[index] = item;
    onChangeLabor(updated);
  };

  const handleAddLabor = () => {
    onChangeLabor([
      ...labor,
      {
        stage: `مرحلة إنتاج ${labor.length + 1}`,
        workers: 1,
        hours: 0.5,
        hourly_rate: 45.0,
        cost: 22.5
      }
    ]);
  };

  const handleDeleteLabor = (index: number) => {
    if (labor.length <= 1) return;
    onChangeLabor(labor.filter((_, i) => i !== index));
  };

  // Machine handlers
  const handleUpdateMachine = (index: number, updates: Partial<MachineItem>) => {
    const updated = [...machines];
    const item = { ...updated[index], ...updates };
    item.cost = Number((item.hours * item.hourly_rate).toFixed(2));
    updated[index] = item;
    onChangeMachines(updated);
  };

  const handleAddMachine = () => {
    onChangeMachines([
      ...machines,
      {
        name: `معدة / خط إنتاج ${machines.length + 1}`,
        hours: 0.5,
        hourly_rate: 25.0,
        power_kwh: 2.5,
        cost: 12.5
      }
    ]);
  };

  const handleDeleteMachine = (index: number) => {
    if (machines.length <= 1) return;
    onChangeMachines(machines.filter((_, i) => i !== index));
  };

  const totalLaborCost = labor.reduce((sum, l) => sum + (l.workers * l.hours * l.hourly_rate), 0);
  const totalMachineCost = machines.reduce((sum, m) => sum + (m.hours * m.hourly_rate), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* 1. Direct Labor Stages Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تكلفة العمالة ومراحل الإنتاج (Direct Labor)</h3>
              <p className="text-xs font-bold text-slate-400">معادلة الاحتساب: عدد العمال × الساعات × أجر الساعة</p>
            </div>
          </div>

          <button
            onClick={handleAddLabor}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مرحلة</span>
          </button>
        </div>

        {/* Labor Stages List */}
        <div className="space-y-3">
          {labor.map((stage, idx) => {
            const stageTotal = stage.workers * stage.hours * stage.hourly_rate;

            return (
              <div 
                key={idx}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={stage.stage}
                    onChange={(e) => handleUpdateLabor(idx, { stage: e.target.value })}
                    className="flex-1 font-black text-slate-800 text-xs bg-transparent border-0 focus:ring-0 p-0"
                    placeholder="اسم مرحلة الإنتاج..."
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-blue-700">
                      {stageTotal.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">ج.م.</span>
                    </span>
                    <button
                      onClick={() => handleDeleteLabor(idx)}
                      className="text-slate-300 hover:text-rose-600 p-1 transition"
                      title="حذف المرحلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">عدد العمال</label>
                    <input
                      type="number"
                      min="1"
                      value={stage.workers}
                      onChange={(e) => handleUpdateLabor(idx, { workers: parseInt(e.target.value) || 1 })}
                      className="w-full text-center font-bold bg-white border border-slate-200 rounded-lg py-1 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">ساعات العمل</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={stage.hours}
                      onChange={(e) => handleUpdateLabor(idx, { hours: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center font-bold bg-white border border-slate-200 rounded-lg py-1 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">أجر الساعة (ج.م.)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={stage.hourly_rate}
                      onChange={(e) => handleUpdateLabor(idx, { hourly_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center font-bold bg-white border border-slate-200 rounded-lg py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Labor Summary Footer */}
        <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between text-xs font-bold">
          <span className="text-blue-900">إجمالي عمالة الدفعة ({batchSize} وحدة):</span>
          <div className="text-right">
            <span className="text-base font-black text-blue-700">{totalLaborCost.toFixed(2)} ج.م.</span>
            <span className="text-[10px] text-slate-400 block">{(totalLaborCost / (batchSize || 1)).toFixed(2)} ج.م. / للوحدة</span>
          </div>
        </div>
      </div>

      {/* 2. Machine & Equipment Costs Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تكلفة الآلات والمعدات (Machine Hours)</h3>
              <p className="text-xs font-bold text-slate-400">معادلة الاحتساب: ساعات التشغيل × تكلفة ساعة الماكينة</p>
            </div>
          </div>

          <button
            onClick={handleAddMachine}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة ماكينة</span>
          </button>
        </div>

        {/* Machines List */}
        <div className="space-y-3">
          {machines.map((mc, idx) => {
            const mcTotal = mc.hours * mc.hourly_rate;

            return (
              <div 
                key={idx}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-purple-200 transition space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={mc.name}
                    onChange={(e) => handleUpdateMachine(idx, { name: e.target.value })}
                    className="flex-1 font-black text-slate-800 text-xs bg-transparent border-0 focus:ring-0 p-0"
                    placeholder="اسم الآلة أو مركز العمل..."
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-purple-700">
                      {mcTotal.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">ج.م.</span>
                    </span>
                    <button
                      onClick={() => handleDeleteMachine(idx)}
                      className="text-slate-300 hover:text-rose-600 p-1 transition"
                      title="حذف الآلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">ساعات تشغيل الماكينة</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={mc.hours}
                      onChange={(e) => handleUpdateMachine(idx, { hours: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center font-bold bg-white border border-slate-200 rounded-lg py-1 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">تكلفة الساعة شاملة الطاقة والاستهلاك (ج.م.)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={mc.hourly_rate}
                      onChange={(e) => handleUpdateMachine(idx, { hourly_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center font-bold bg-white border border-slate-200 rounded-lg py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Machine Summary Footer */}
        <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs font-bold">
          <span className="text-purple-900">إجمالي تشغيل الآلات للدفعة:</span>
          <div className="text-right">
            <span className="text-base font-black text-purple-700">{totalMachineCost.toFixed(2)} ج.م.</span>
            <span className="text-[10px] text-slate-400 block">{(totalMachineCost / (batchSize || 1)).toFixed(2)} ج.م. / للوحدة</span>
          </div>
        </div>
      </div>

    </div>
  );
};
