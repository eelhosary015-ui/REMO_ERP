import React, { useEffect, useState } from "react";
import { api, authFetch } from "../utils/api";
import { Landmark, Users, FileText, Star, Plus, Trash2, RefreshCw, AlertTriangle } from "lucide-react";

interface Props { supplierId: number; }

export function SupplierAdvancedPanel({ supplierId }: Props) {
  const [aging, setAging] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({ name: "", job_title: "", phone: "", mobile: "", email: "", is_primary: false });
  const [bank, setBank] = useState({ bank_name: "", account_name: "", account_number: "", iban: "", swift: "", currency: "EGP", is_default: false });
  const [evaluation, setEvaluation] = useState({ quality_score: 0, delivery_score: 0, price_score: 0, service_score: 0, notes: "" });
  const [docType, setDocType] = useState("بطاقة المورد");
  const [docNumber, setDocNumber] = useState("");
  const [docIssueDate, setDocIssueDate] = useState("");
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a,c,b,d,e] = await Promise.all([
        api.get(`/api/suppliers/${supplierId}/aging`).then(r=>r.json()),
        api.get(`/api/suppliers/${supplierId}/contacts`).then(r=>r.json()),
        api.get(`/api/suppliers/${supplierId}/bank-accounts`).then(r=>r.json()),
        api.get(`/api/suppliers/${supplierId}/documents`).then(r=>r.json()),
        api.get(`/api/suppliers/${supplierId}/evaluations`).then(r=>r.json()),
      ]);
      setAging(a.rows || []); setContacts(Array.isArray(c)?c:[]); setBanks(Array.isArray(b)?b:[]); setDocuments(Array.isArray(d)?d:[]); setEvaluations(Array.isArray(e)?e:[]);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[supplierId]);

  const post = async (url:string, body:any, reset:()=>void) => { const r=await api.post(url,body); if(!r.ok){const x=await r.json().catch(()=>({})); alert(x.error||"فشل الحفظ"); return;} reset(); load(); };
  const openDocument = async (documentId:number, fileName?:string) => {
    try {
      const r = await authFetch(`/api/suppliers/${supplierId}/documents/${documentId}/download`);
      if (!r.ok) {
        const data = await r.json().catch(()=>({}));
        throw new Error(data.error || "تعذر فتح المستند");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = fileName || "supplier-document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e:any) {
      alert(e.message || "تعذر فتح المستند");
    }
  };

  const uploadDocument = async () => {
    if (!docFile) return alert("اختر المستند أولاً");
    if (docFile.size > 15 * 1024 * 1024) return alert("حجم المستند يجب ألا يتجاوز 15MB");
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append("file", docFile);
      fd.append("document_type", docType);
      if (docNumber) fd.append("document_number", docNumber);
      if (docIssueDate) fd.append("issue_date", docIssueDate);
      if (docExpiryDate) fd.append("expiry_date", docExpiryDate);
      if (docNotes) fd.append("notes", docNotes);
      const r = await authFetch(`/api/suppliers/${supplierId}/documents`, { method: "POST", body: fd });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data.error || "فشل رفع المستند");
      setDocFile(null); setDocNumber(""); setDocIssueDate(""); setDocExpiryDate(""); setDocNotes("");
      const input = document.getElementById("supplier-document-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (e:any) { alert(e.message || "فشل رفع المستند"); }
    finally { setUploadingDoc(false); }
  };
  const money=(v:any)=>Number(v||0).toLocaleString("ar-EG",{minimumFractionDigits:2,maximumFractionDigits:2});

  return <div className="space-y-5">
    <div className="flex items-center justify-between">
      <div><h3 className="font-black text-slate-800">مركز المورد المتقدم</h3><p className="text-xs text-slate-400">الحساب، الاستحقاقات، البنوك، جهات الاتصال، المستندات وتقييم الأداء</p></div>
      <button onClick={load} className="p-2 rounded-xl hover:bg-slate-100"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[['حالي',aging.filter(x=>Number(x.overdue_days)===0).reduce((s,x)=>s+Number(x.outstanding||0),0)],['1-30 يوم',aging.filter(x=>Number(x.overdue_days)>=1&&Number(x.overdue_days)<=30).reduce((s,x)=>s+Number(x.outstanding||0),0)],['31-90 يوم',aging.filter(x=>Number(x.overdue_days)>=31&&Number(x.overdue_days)<=90).reduce((s,x)=>s+Number(x.outstanding||0),0)],['أكثر من 90',aging.filter(x=>Number(x.overdue_days)>90).reduce((s,x)=>s+Number(x.outstanding||0),0)]].map(([label,value])=><div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-xs text-slate-400 font-bold">{label}</div><div className="text-lg font-black text-slate-800">{money(value)} ج.م</div></div>)}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <h4 className="font-black text-slate-700 flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-orange-500"/> جهات الاتصال</h4>
        <div className="space-y-2 mb-3">{contacts.map(c=><div key={c.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl"><div><b>{c.name}</b><div className="text-xs text-slate-400">{c.job_title||""} {c.phone||c.mobile||""} {c.email||""}</div></div><button onClick={async()=>{await api.delete(`/api/suppliers/${supplierId}/contacts/${c.id}`);load()}}><Trash2 className="w-4 h-4 text-rose-500"/></button></div>)}</div>
        <div className="grid grid-cols-2 gap-2">
          {([['name','الاسم'],['job_title','الوظيفة'],['phone','الهاتف'],['email','البريد']] as const).map(([k,l])=><input key={k} placeholder={l} value={(contact as any)[k]} onChange={e=>setContact({...contact,[k]:e.target.value})} className="p-2 bg-slate-50 border rounded-xl text-sm"/>)}
        </div>
        <button onClick={()=>post(`/api/suppliers/${supplierId}/contacts`,contact,()=>setContact({name:"",job_title:"",phone:"",mobile:"",email:"",is_primary:false}))} className="mt-2 px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold flex items-center gap-1"><Plus className="w-4 h-4"/> إضافة جهة اتصال</button>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <h4 className="font-black text-slate-700 flex items-center gap-2 mb-3"><Landmark className="w-4 h-4 text-blue-500"/> الحسابات البنكية</h4>
        <div className="space-y-2 mb-3">{banks.map(b=><div key={b.id} className="p-2 bg-slate-50 rounded-xl flex justify-between"><div><b>{b.bank_name}</b><div className="text-xs text-slate-400">IBAN: {b.iban||"-"} | الحساب: {b.account_number||"-"}</div></div><button onClick={async()=>{await api.delete(`/api/suppliers/${supplierId}/bank-accounts/${b.id}`);load()}}><Trash2 className="w-4 h-4 text-rose-500"/></button></div>)}</div>
        <div className="grid grid-cols-2 gap-2">{([['bank_name','اسم البنك'],['account_name','اسم الحساب'],['account_number','رقم الحساب'],['iban','IBAN']] as const).map(([k,l])=><input key={k} placeholder={l} value={(bank as any)[k]} onChange={e=>setBank({...bank,[k]:e.target.value})} className="p-2 bg-slate-50 border rounded-xl text-sm"/>)}</div>
        <button onClick={()=>post(`/api/suppliers/${supplierId}/bank-accounts`,bank,()=>setBank({bank_name:"",account_name:"",account_number:"",iban:"",swift:"",currency:"EGP",is_default:false}))} className="mt-2 px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold flex items-center gap-1"><Plus className="w-4 h-4"/> إضافة حساب بنكي</button>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <h4 className="font-black text-slate-700 flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-purple-500"/> الاستحقاقات والمستندات</h4>
        <div className="space-y-2 max-h-56 overflow-auto">{aging.map(x=><div key={x.id} className="flex justify-between p-2 bg-slate-50 rounded-xl text-sm"><span>{x.invoice_number||`فاتورة #${x.id}`}<span className="text-xs text-slate-400 mr-2">استحقاق: {x.due_date||"حسب تاريخ الفاتورة"}</span></span><b className={Number(x.overdue_days)>0?'text-rose-600':'text-slate-700'}>{money(x.outstanding)} ج.م</b></div>)}{documents.map(d=><div key={`d${d.id}`} className="flex items-center justify-between p-2 bg-purple-50 rounded-xl text-xs gap-2"><span className="min-w-0 truncate"><b>{d.document_type}</b> {d.document_number||""}<span className="block text-slate-400">{d.file_name || "مستند"} • {d.file_size ? `${(Number(d.file_size)/1024/1024).toFixed(2)} MB` : ""}</span></span><span className="flex items-center gap-2 shrink-0"><span>{d.expiry_date||"بدون انتهاء"}</span><button type="button" onClick={()=>openDocument(d.id,d.file_name)} className="px-2 py-1 rounded-lg bg-white border border-purple-200 text-purple-700 font-bold">عرض</button></span></div>)}</div>
        <div className="mt-3 border-t pt-3 space-y-2">
          <div className="text-xs font-black text-slate-600">رفع مستند المورد وحفظه داخل قاعدة البيانات</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={docType} onChange={e=>setDocType(e.target.value)} className="p-2 bg-slate-50 border rounded-xl text-sm"><option>بطاقة المورد</option><option>السجل التجاري</option><option>البطاقة الضريبية</option><option>شهادة ضريبة القيمة المضافة</option><option>بيانات المورد</option><option>عقد</option><option>شهادة بنكية</option><option>مستند آخر</option></select>
            <input placeholder="رقم المستند" value={docNumber} onChange={e=>setDocNumber(e.target.value)} className="p-2 bg-slate-50 border rounded-xl text-sm"/>
            <input type="date" title="تاريخ الإصدار" value={docIssueDate} onChange={e=>setDocIssueDate(e.target.value)} className="p-2 bg-slate-50 border rounded-xl text-sm"/>
            <input type="date" title="تاريخ الانتهاء" value={docExpiryDate} onChange={e=>setDocExpiryDate(e.target.value)} className="p-2 bg-slate-50 border rounded-xl text-sm"/>
          </div>
          <input id="supplier-document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.doc,.docx,.xls,.xlsx" onChange={e=>setDocFile(e.target.files?.[0] || null)} className="w-full p-2 bg-slate-50 border rounded-xl text-sm"/>
          <input placeholder="ملاحظات" value={docNotes} onChange={e=>setDocNotes(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl text-sm"/>
          <button disabled={uploadingDoc} onClick={uploadDocument} className="w-full px-3 py-2 rounded-xl bg-purple-600 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">{uploadingDoc ? "جاري رفع وحفظ المستند..." : "رفع وحفظ المستند في قاعدة البيانات"}</button>
          <div className="text-[11px] text-slate-400">PDF أو صور أو Word/Excel — الحد الأقصى 15MB للملف.</div>
        </div>
        {aging.some(x=>Number(x.overdue_days)>0)&&<div className="mt-3 p-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> توجد فواتير مستحقة/متأخرة تحتاج متابعة.</div>}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <h4 className="font-black text-slate-700 flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-500"/> تقييم أداء المورد</h4>
        <div className="space-y-2 mb-3">{evaluations.slice(0,5).map(e=><div key={e.id} className="flex justify-between p-2 bg-slate-50 rounded-xl"><span className="text-sm">{e.evaluation_date}</span><b className="text-amber-600">{Number(e.overall_score).toFixed(1)} / 100</b></div>)}</div>
        <div className="grid grid-cols-2 gap-2">{([['quality_score','الجودة'],['delivery_score','التوريد'],['price_score','السعر'],['service_score','الخدمة']] as const).map(([k,l])=><label key={k} className="text-xs font-bold text-slate-500">{l}<input type="number" min="0" max="100" value={(evaluation as any)[k]} onChange={e=>setEvaluation({...evaluation,[k]:Number(e.target.value)})} className="mt-1 w-full p-2 bg-slate-50 border rounded-xl"/></label>)}</div>
        <button onClick={()=>post(`/api/suppliers/${supplierId}/evaluations`,evaluation,()=>setEvaluation({quality_score:0,delivery_score:0,price_score:0,service_score:0,notes:""}))} className="mt-2 px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold flex items-center gap-1"><Star className="w-4 h-4"/> حفظ التقييم</button>
      </section>
    </div>
  </div>;
}
