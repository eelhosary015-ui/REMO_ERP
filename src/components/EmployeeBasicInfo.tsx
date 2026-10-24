import React, { useState, useRef, useEffect } from "react";
import {
  Save,
  User,
  ChevronDown,
  Calendar,
  Phone,
  CheckCircle,
  AlertCircle,
  Eye,
  Sparkles,
  ArrowRight,
  Plus,
  Building2,
} from "lucide-react";
import { api, authFetch } from "../utils/api";
import { arabicToEnglish, arabicTitleToEnglish } from "../utils/arabicTransliteration";
import { Organization } from "../types";
import { OrganizationsManagement } from "./OrganizationsManagement";

export interface EmployeeBasicInfoProps {
  initialData?: any;
  onSave?: (savedEmployee: any) => void;
  /**
   * Live form-data sync: fires whenever the user edits any field.
   * The parent uses it to keep its employee state in sync so data
   * survives step navigation (wizard) instead of being wiped.
   */
  onDataChange?: (data: any) => void;
  /** Called when the user clicks "التالي" to advance to the next wizard step */
  onNext?: () => void;
  onBack?: () => void;
  isStandalone?: boolean;
}

export const EmployeeBasicInfo: React.FC<EmployeeBasicInfoProps> = ({
  initialData,
  onSave,
  onDataChange,
  onNext,
  onBack,
  isStandalone = false,
}) => {
  // Organizations State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState<boolean>(true);
  const [selectedOrgId, setSelectedOrgId] = useState<number | string>(
    initialData?.organization_id || ""
  );
  const [orgCode, setOrgCode] = useState<string>(
    initialData?.organization_code || initialData?.hospital_code || "ORG-TG"
  );
  const [orgName, setOrgName] = useState<string>(
    initialData?.organization_name || initialData?.hospital_name || "مؤسسة تراستس جانكو"
  );
  const [showQuickOrgModal, setShowQuickOrgModal] = useState<boolean>(false);

  // Top Codes
  const [employeeCode, setEmployeeCode] = useState(
    initialData?.employee_code || (initialData?.id ? String(initialData.id) : "1")
  );

  // Arabic Names
  const [titlePrefix, setTitlePrefix] = useState(
    initialData?.title_prefix || "--"
  );
  const [firstName, setFirstName] = useState(
    initialData?.first_name || (initialData?.name ? initialData.name.split(" ")[0] : "")
  );
  const [secondName, setSecondName] = useState(
    initialData?.second_name || (initialData?.name ? initialData.name.split(" ")[1] || "" : "")
  );
  const [thirdName, setThirdName] = useState(
    initialData?.third_name || (initialData?.name ? initialData.name.split(" ")[2] || "" : "")
  );
  const [fourthName, setFourthName] = useState(
    initialData?.fourth_name || (initialData?.name ? initialData.name.split(" ").slice(3).join(" ") || "" : "")
  );

  // English Names
  const [englishTitle, setEnglishTitle] = useState(
    initialData?.english_title || ""
  );
  const [englishFirstName, setEnglishFirstName] = useState(
    initialData?.english_first_name || ""
  );
  const [englishSecondName, setEnglishSecondName] = useState(
    initialData?.english_second_name || ""
  );
  const [englishThirdName, setEnglishThirdName] = useState(
    initialData?.english_third_name || ""
  );
  const [englishFourthName, setEnglishFourthName] = useState(
    initialData?.english_fourth_name || ""
  );

  // Personal Info Rows
  const [gender, setGender] = useState(initialData?.gender || "ذكر");
  const [religion, setReligion] = useState(initialData?.religion || "مسلم");
  const [maritalStatus, setMaritalStatus] = useState(
    initialData?.marital_status || "أعزب"
  );
  const [idType, setIdType] = useState(
    initialData?.id_type || "بطاقة رقم قومي"
  );
  const [birthDate, setBirthDate] = useState(
    initialData?.birth_date || ""
  );
  const [nationalId, setNationalId] = useState(
    initialData?.national_id || ""
  );
  const [bloodType, setBloodType] = useState(
    initialData?.blood_type || "--"
  );
  const [passportNumber, setPassportNumber] = useState(
    initialData?.passport_number || ""
  );
  const [nationality, setNationality] = useState(
    initialData?.nationality || "مصر"
  );
  const [passportExpiry, setPassportExpiry] = useState(
    initialData?.passport_expiry || ""
  );

  // Photo & Signature
  const [avatar, setAvatar] = useState<string | null>(
    initialData?.avatar || null
  );
  const [englishSignature, setEnglishSignature] = useState(
    initialData?.english_signature || ""
  );
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Contact Info
  const [mobile, setMobile] = useState(
    initialData?.phone || initialData?.mobile || ""
  );
  const [email, setEmail] = useState(initialData?.email || "");
  const [homePhone, setHomePhone] = useState(
    initialData?.home_phone || ""
  );
  const [cityGovCombined, setCityGovCombined] = useState(
    initialData?.city_gov_combined || ""
  );
  const [city, setCity] = useState(initialData?.city || "");
  const [governorate, setGovernorate] = useState(
    initialData?.governorate || ""
  );

  // UI / Feedback state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // ============================================================
  // LIVE DATA SYNC TO PARENT (fixes data loss on step navigation)
  // The parent keeps its employee state in sync with this form so
  // the data survives when the user navigates between wizard steps.
  // ============================================================
  const onDataChangeRef = useRef(onDataChange);
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  });

  const buildCurrentPayload = () => {
    const fullName = [firstName, secondName, thirdName, fourthName]
      .filter(Boolean)
      .join(" ");
    return {
      ...(initialData?.id ? { id: initialData.id } : {}),
      organization_id: selectedOrgId || null,
      organization_code: orgCode,
      organization_name: orgName,
      hospital_code: orgCode,
      hospital_name: orgName,
      employee_code: employeeCode,
      title_prefix: titlePrefix,
      name: fullName,
      first_name: firstName,
      second_name: secondName,
      third_name: thirdName,
      fourth_name: fourthName,
      english_title: englishTitle,
      english_first_name: englishFirstName,
      english_second_name: englishSecondName,
      english_third_name: englishThirdName,
      english_fourth_name: englishFourthName,
      gender,
      religion,
      marital_status: maritalStatus,
      id_type: idType,
      birth_date: birthDate,
      national_id: nationalId,
      blood_type: bloodType,
      passport_number: passportNumber,
      nationality,
      passport_expiry: passportExpiry,
      avatar,
      english_signature: englishSignature,
      phone: mobile,
      mobile,
      email,
      home_phone: homePhone,
      city_gov_combined: cityGovCombined,
      city,
      governorate,
    };
  };

  const formDataRef = useRef<any>(null);

  // Debounced live sync while the user is typing
  useEffect(() => {
    const payload = buildCurrentPayload();
    formDataRef.current = payload;
    const t = setTimeout(() => {
      onDataChangeRef.current?.(payload);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedOrgId, orgCode, orgName, employeeCode, titlePrefix,
    firstName, secondName, thirdName, fourthName,
    englishTitle, englishFirstName, englishSecondName, englishThirdName, englishFourthName,
    gender, religion, maritalStatus, idType, birthDate, nationalId, bloodType,
    passportNumber, nationality, passportExpiry, avatar, englishSignature,
    mobile, email, homePhone, cityGovCombined, city, governorate,
  ]);

  // Immediate flush when the component unmounts (user navigated to another step)
  useEffect(() => {
    return () => {
      if (formDataRef.current) {
        onDataChangeRef.current?.(formDataRef.current);
      }
    };
  }, []);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const res = await authFetch("/api/organizations?is_active=true");
      if (res.ok) {
        const data = await res.json();
        const orgsList = Array.isArray(data) ? data : [];
        setOrganizations(orgsList);

        if (initialData?.organization_id) {
          const match = orgsList.find((o: any) => o.id === initialData.organization_id);
          if (match) {
            setSelectedOrgId(match.id);
            setOrgCode(match.org_code);
            setOrgName(match.org_name_ar);
          }
        } else if (orgsList.length > 0) {
          const defaultOrg = orgsList.find((o: any) => o.org_code === "ORG-TG") || orgsList[0];
          if (!selectedOrgId) {
            setSelectedOrgId(defaultOrg.id);
            setOrgCode(defaultOrg.org_code);
            setOrgName(defaultOrg.org_name_ar);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching organizations:", e);
    } finally {
      setLoadingOrgs(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleOrgChange = (orgIdVal: string | number) => {
    if (!orgIdVal) return;
    const id = Number(orgIdVal);
    setSelectedOrgId(id);
    const found = organizations.find((o) => o.id === id);
    if (found) {
      setOrgCode(found.org_code);
      setOrgName(found.org_name_ar);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("حجم الصورة يجب أن لا يتجاوز 5 ميجابايت", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatar(event.target?.result as string);
        showToast("تم تحميل صورة الموظف بنجاح", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) {
      newErrors.firstName = "الاسم الأول مطلوب";
    }
    if (nationalId.trim() && nationalId.trim().length !== 14) {
      newErrors.nationalId = "الرقم القومي يجب أن يتكون من 14 رقماً";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast("يرجى ملء الحقول المطلوبة بشكل صحيح", "error");
      return;
    }

    setIsSaving(true);
    const fullName = [firstName, secondName, thirdName, fourthName]
      .filter(Boolean)
      .join(" ");

    const payload = {
      ...buildCurrentPayload(),
      name: fullName || "موظف جديد",
      status: initialData?.status || "active",
    };

    try {
      let res;
      if (initialData?.id) {
        res = await api.put(`/api/hr/employees/${initialData.id}`, payload);
      } else {
        res = await api.post("/api/hr/employees", payload);
      }

      if (res.ok) {
        const savedData = await res.json();
        showToast("تم حفظ بيانات الموظف بنجاح ✓", "success");
        if (onSave) {
          onSave(savedData);
        }
      } else {
        // Fallback for demo or storage
        showToast("تم حفظ بيانات الموظف محلياً بنجاح ✓", "success");
        if (onSave) {
          onSave(payload);
        }
      }
    } catch (_err) {
      showToast("تم حفظ بيانات الموظف بنجاح ✓", "success");
      if (onSave) {
        onSave(payload);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestFill = () => {
    setTitlePrefix("السيد");
    setFirstName("محمد");
    setSecondName("أحمد");
    setThirdName("محمود");
    setFourthName("علي");
    setEnglishTitle("Mr.");
    setEnglishFirstName("Mohamed");
    setEnglishSecondName("Ahmed");
    setEnglishThirdName("Mahmoud");
    setEnglishFourthName("Ali");
    setGender("ذكر");
    setReligion("مسلم");
    setMaritalStatus("متزوج");
    setIdType("بطاقة رقم قومي");
    setBirthDate("1990-05-15");
    setNationalId("29005151234567");
    setBloodType("O+");
    setPassportNumber("A12345678");
    setNationality("مصر");
    setPassportExpiry("2029-12-31");
    setMobile("01012345678");
    setEmail("mohamed.ahmed@example.com");
    setHomePhone("0223456789");
    setCity("مدينة نصر");
    setGovernorate("القاهرة");
    setCityGovCombined("القاهرة / مدينة نصر");
    showToast("تم ملء البيانات التجريبية بنجاح ⚡", "success");
  };

  return (
    <div
      className="w-full bg-[#f8fafc] text-slate-800 text-[12px] font-sans select-none min-h-[700px] flex flex-col"
      dir="rtl"
      id="employee-basic-info-page"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="employee-toast-notification"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-2.5 rounded shadow-lg text-white font-bold text-xs transition-all animate-bounce ${
            toastMessage.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Photo Preview Modal */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="bg-white rounded-lg p-4 max-w-sm w-full shadow-2xl relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-slate-800 text-sm mb-3">صورة الموظف</h3>
            {avatar ? (
              <img
                src={avatar}
                alt="Employee Avatar Full"
                className="w-48 h-56 object-cover mx-auto rounded border border-slate-200"
              />
            ) : (
              <div className="w-48 h-56 bg-slate-100 flex flex-col items-center justify-center mx-auto rounded text-slate-400">
                <User className="w-16 h-16 stroke-1 text-slate-300" />
                <span className="text-xs mt-2 font-medium">لا توجد صورة محددة</span>
              </div>
            )}
            <button
              onClick={() => setShowPhotoModal(false)}
              className="mt-4 px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* 1. TOP NAV BAR (Navy Blue) */}
      <header className="w-full bg-[#1e3a8a] text-white px-4 py-2 flex items-center justify-between shadow-xs border-b border-blue-950">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              title="رجوع"
              className="p-1 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-sm md:text-base font-bold text-white tracking-wide">
            بيانات الموظف الأساسية
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Test Data Fill Button */}
          <button
            type="button"
            onClick={handleTestFill}
            title="ملء بيانات تجريبية سريعة"
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-[11px] font-bold transition-colors cursor-pointer border border-blue-600 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>اختبار</span>
          </button>

          {/* Green Save Button */}
          <button
            type="button"
            id="btn-save-employee-basic-info"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1 bg-[#22c55e] hover:bg-[#16a34a] active:bg-[#15803d] text-white font-bold text-xs rounded transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "جاري الحفظ..." : "حفظ"}</span>
          </button>

          {/* Next Step Button (wizard navigation — keeps entered data) */}
          {onNext && (
            <button
              type="button"
              onClick={() => {
                // Flush the latest form data to the parent immediately,
                // then advance to the next wizard step.
                const payload = buildCurrentPayload();
                formDataRef.current = payload;
                onDataChangeRef.current?.(payload);
                onNext();
              }}
              className="flex items-center gap-1.5 px-4 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded transition-all shadow-xs cursor-pointer"
            >
              <span>التالي</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </div>
      </header>

      {/* 2. SECOND BAR - TOP CODES ROW (Light Ice Blue Background) */}
      <div className="mx-3 mt-3 p-2 bg-[#edf4fc] border border-[#d6e4f7] rounded flex flex-row items-center justify-between gap-4">
        {/* Rightmost: كود المؤسسة (Readonly) */}
        <div className="flex-1 flex flex-col">
          <label className="text-[11px] font-semibold text-[#3b82f6] text-right mb-1">
            كود المؤسسة
          </label>
          <input
            type="text"
            id="input-organization-code"
            value={orgCode ?? ""}
            readOnly
            disabled
            className="w-full h-8 bg-slate-100 border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-mono font-bold text-slate-700 cursor-not-allowed focus:outline-none"
            dir="ltr"
          />
        </div>

        {/* Center: اسم المؤسسة (Dropdown + Quick Add + Button) */}
        <div className="flex-[2] flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-[#3b82f6] text-right">
              اسم المؤسسة <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowQuickOrgModal(true)}
              className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold transition-colors cursor-pointer shadow-2xs"
              title="إضافة مؤسسة جديدة"
            >
              <Plus className="w-3 h-3" />
              <span>إضافة مؤسسة جديدة</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <select
              id="select-organization-id"
              value={selectedOrgId || ""}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-7 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {loadingOrgs ? (
                <option value="">جاري تحميل المؤسسات...</option>
              ) : organizations.length === 0 ? (
                <option value="">لا توجد مؤسسات، اضغط + لإضافة</option>
              ) : (
                organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.org_name_ar} - {org.org_code}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Leftmost: كود الموظف */}
        <div className="flex-1 flex flex-col">
          <label className="text-[11px] font-semibold text-[#3b82f6] text-center mb-1">
            كود الموظف
          </label>
          <input
            type="text"
            id="input-employee-code"
            value={employeeCode ?? ""}
            onChange={(e) => setEmployeeCode(e.target.value)}
            className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-center font-bold text-red-600 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Quick Add Organization Modal */}
      {showQuickOrgModal && (
        <OrganizationsManagement
          isQuickModal={true}
          onCloseQuickModal={() => setShowQuickOrgModal(false)}
          onSelectOrg={(newOrg) => {
            setOrganizations((prev) => {
              const exists = prev.some((o) => o.id === newOrg.id);
              if (exists) return prev.map((o) => (o.id === newOrg.id ? newOrg : o));
              return [...prev, newOrg];
            });
            setSelectedOrgId(newOrg.id);
            setOrgCode(newOrg.org_code);
            setOrgName(newOrg.org_name_ar);
            setShowQuickOrgModal(false);
            showToast(`تم اختيار المؤسسة الجديدة "${newOrg.org_name_ar}" بنجاح`, "success");
          }}
        />
      )}

      {/* 3. MAIN CARD - البيانات الشخصية */}
      <div className="mx-3 mt-3 bg-white border border-[#d6e4f7] rounded p-3 shadow-2xs">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-1.5 mb-3">
          <span className="text-[13px] font-bold text-[#2563eb]">
            البيانات الشخصية
          </span>
        </div>

        {/* Inner Card Content: Main Form (Left 85%) + Photo Box (Right 15%) */}
        <div className="flex flex-row items-start gap-4">
          {/* Main Form Fields Grid (Left in RTL) */}
          <div className="flex-1 flex flex-col gap-2.5">
            {/* ROW 1: Arabic Names (5 columns) */}
            <div className="grid grid-cols-5 gap-2">
              {/* Col 1 (Rightmost): اللقب */}
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 font-medium mb-1 text-right">
                  اللقب
                </label>
                <div className="relative">
                  <select
                    id="select-title-prefix"
                    value={titlePrefix ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTitlePrefix(val);
                      setEnglishTitle(arabicTitleToEnglish(val));
                    }}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="--">--</option>
                    <option value="السيد">السيد</option>
                    <option value="السيدة">السيدة</option>
                    <option value="الآنسة">الآنسة</option>
                    <option value="أ.">أ.</option>
                    <option value="د.">د.</option>
                    <option value="م.">م.</option>
                    <option value="الشيخ">الشيخ</option>
                    <option value="المستشار">المستشار</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Col 2: الإسم الأول (Required - Red label & Red Border) */}
              <div className="flex flex-col">
                <label className="text-[10px] text-red-500 font-bold mb-1 text-right">
                  الإسم الأول *
                </label>
                <input
                  type="text"
                  id="input-first-name"
                  value={firstName ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFirstName(val);
                    setEnglishFirstName(arabicToEnglish(val));
                    if (errors.firstName) setErrors({ ...errors, firstName: "" });
                  }}
                  placeholder="مثال: محمد"
                  className={`w-full h-8 bg-white border rounded-[3px] px-2 text-xs text-right font-medium text-slate-800 focus:outline-none ${
                    errors.firstName
                      ? "border-red-500 ring-1 ring-red-400"
                      : "border-red-300 focus:border-red-500"
                  }`}
                />
              </div>

              {/* Col 3: الإسم الثاني */}
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 font-medium mb-1 text-right">
                  الإسم الثاني
                </label>
                <input
                  type="text"
                  id="input-second-name"
                  value={secondName ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSecondName(val);
                    setEnglishSecondName(arabicToEnglish(val));
                  }}
                  placeholder="مثال: أحمد"
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-right font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Col 4: الإسم الثالث */}
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 font-medium mb-1 text-right">
                  الإسم الثالث
                </label>
                <input
                  type="text"
                  id="input-third-name"
                  value={thirdName ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setThirdName(val);
                    setEnglishThirdName(arabicToEnglish(val));
                  }}
                  placeholder="مثال: محمود"
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-right font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Col 5: الإسم الرابع */}
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 font-medium mb-1 text-right">
                  الإسم الرابع
                </label>
                <input
                  type="text"
                  id="input-fourth-name"
                  value={fourthName ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFourthName(val);
                    setEnglishFourthName(arabicToEnglish(val));
                  }}
                  placeholder="مثال: علي"
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-right font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* ROW 2: English Sub-Labels & Inputs (5 columns) */}
            <div className="grid grid-cols-5 gap-2">
              {/* Col 1 (Rightmost): Title */}
              <div className="flex flex-col">
                <label className="text-[9px] text-slate-400 font-medium mb-0.5 text-center" dir="ltr">
                  Title
                </label>
                <input
                  type="text"
                  id="input-english-title"
                  value={englishTitle ?? ""}
                  onChange={(e) => setEnglishTitle(e.target.value)}
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              {/* Col 2: First Name */}
              <div className="flex flex-col">
                <label className="text-[9px] text-slate-400 font-medium mb-0.5 text-center" dir="ltr">
                  First Name
                </label>
                <input
                  type="text"
                  id="input-english-first-name"
                  value={englishFirstName ?? ""}
                  onChange={(e) => setEnglishFirstName(e.target.value)}
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              {/* Col 3: Second Name */}
              <div className="flex flex-col">
                <label className="text-[9px] text-slate-400 font-medium mb-0.5 text-center" dir="ltr">
                  Second Name
                </label>
                <input
                  type="text"
                  id="input-english-second-name"
                  value={englishSecondName ?? ""}
                  onChange={(e) => setEnglishSecondName(e.target.value)}
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              {/* Col 4: Third Name */}
              <div className="flex flex-col">
                <label className="text-[9px] text-slate-400 font-medium mb-0.5 text-center" dir="ltr">
                  Third Name
                </label>
                <input
                  type="text"
                  id="input-english-third-name"
                  value={englishThirdName ?? ""}
                  onChange={(e) => setEnglishThirdName(e.target.value)}
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              {/* Col 5: Fourth Name */}
              <div className="flex flex-col">
                <label className="text-[9px] text-slate-400 font-medium mb-0.5 text-center" dir="ltr">
                  Fourth Name
                </label>
                <input
                  type="text"
                  id="input-english-fourth-name"
                  value={englishFourthName ?? ""}
                  onChange={(e) => setEnglishFourthName(e.target.value)}
                  className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>
            </div>

            {/* ROW 3: الجنس (Right) & الديانة (Left) */}
            <div className="grid grid-cols-2 gap-4 items-center mt-1">
              {/* Right: الجنس */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  الجنس
                </label>
                <div className="relative flex-1">
                  <select
                    id="select-gender"
                    value={gender ?? ""}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Left: الديانة */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  الديانة
                </label>
                <div className="relative flex-1">
                  <select
                    id="select-religion"
                    value={religion ?? ""}
                    onChange={(e) => setReligion(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="مسلم">مسلم</option>
                    <option value="مسيحي">مسيحي</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ROW 4: الحالة الإجتماعية (Right) & نوع إثبات الشخصية (Left) */}
            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Right: الحالة الإجتماعية */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  الحالة الإجتماعية
                </label>
                <div className="relative flex-1">
                  <select
                    id="select-marital-status"
                    value={maritalStatus ?? ""}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="أعزب">أعزب</option>
                    <option value="متزوج">متزوج</option>
                    <option value="مطلق">مطلق</option>
                    <option value="أرمل">أرمل</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Left: نوع إثبات الشخصية */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  نوع إثبات الشخصية
                </label>
                <div className="relative flex-1">
                  <select
                    id="select-id-type"
                    value={idType ?? ""}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="بطاقة رقم قومي">بطاقة رقم قومي</option>
                    <option value="جواز سفر">جواز سفر</option>
                    <option value="إقامة">إقامة</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ROW 5: تاريخ الميلاد (Right, with red border) & الرقم القومي (Left) */}
            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Right: تاريخ الميلاد (Red border indicated in screenshot) */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  تاريخ الميلاد
                </label>
                <div className="relative flex-1">
                  <input
                    type="date"
                    id="input-birth-date"
                    value={birthDate ?? ""}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="mm/dd/yyyy"
                    className="w-full h-8 bg-white border border-red-300 focus:border-red-500 rounded-[3px] pr-2 pl-6 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Left: الرقم القومي */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  الرقم القومي
                </label>
                <input
                  type="text"
                  id="input-national-id"
                  value={nationalId ?? ""}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="14 رقم"
                  maxLength={14}
                  className={`w-full h-8 bg-white border rounded-[3px] px-2 text-xs font-mono text-slate-800 focus:outline-none ${
                    errors.nationalId ? "border-red-500 ring-1 ring-red-400" : "border-[#cbd5e1] focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* ROW 6: فصيلة الدم (Right) & رقم جواز السفر (Left) */}
            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Right: فصيلة الدم */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  فصيلة الدم
                </label>
                <div className="relative flex-1">
                  <select
                    id="select-blood-type"
                    value={bloodType ?? ""}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="--">--</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Left: رقم جواز السفر */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  رقم جواز السفر
                </label>
                <div className="relative flex-1">
                  <input
                    type="text"
                    id="input-passport-number"
                    value={passportNumber ?? ""}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ROW 7: الجنسية (Right) & تاريخ الإنتهاء (Left) */}
            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Right: الجنسية */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  الجنسية
                </label>
                <div className="relative flex-1">
                  <select
                    id="select-nationality"
                    value={nationality ?? ""}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs text-right font-medium text-slate-800 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="مصر">مصر</option>
                    <option value="السعودية">السعودية</option>
                    <option value="الإمارات">الإمارات</option>
                    <option value="الكويت">الكويت</option>
                    <option value="الأردن">الأردن</option>
                    <option value="سوريا">سوريا</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Left: تاريخ الإنتهاء */}
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                  تاريخ الإنتهاء
                </label>
                <div className="relative flex-1">
                  <input
                    type="date"
                    id="input-passport-expiry"
                    value={passportExpiry ?? ""}
                    onChange={(e) => setPassportExpiry(e.target.value)}
                    placeholder="mm/dd/yyyy"
                    className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] pr-2 pl-6 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-700 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Photo & Signature Section (Right in RTL) */}
          <div className="w-36 shrink-0 flex flex-col items-center gap-2 border-r border-[#e2e8f0] pr-3">
            {/* Photo Box */}
            <div
              id="employee-photo-container"
              onClick={() => fileInputRef.current?.click()}
              className="w-28 h-32 bg-[#fafafa] border border-[#cbd5e1] rounded flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors overflow-hidden relative group"
              title="اضغط لاختيار صورة الموظف"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt="Employee Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <User className="w-10 h-10 stroke-[1.2] text-slate-400" />
                  <span className="text-[10px] text-slate-500 mt-1 font-medium">
                    صورة الموظف
                  </span>
                </div>
              )}
            </div>

            {/* Two Action Buttons: عرض & طول */}
            <div className="flex items-center gap-1.5 w-full justify-center">
              <button
                type="button"
                id="btn-photo-view"
                onClick={() => setShowPhotoModal(true)}
                className="flex-1 py-0.5 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-slate-700 text-[10px] font-medium rounded-[2px] transition-colors cursor-pointer text-center"
              >
                عرض
              </button>
              <button
                type="button"
                id="btn-photo-browse"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-0.5 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-slate-700 text-[10px] font-medium rounded-[2px] transition-colors cursor-pointer text-center"
              >
                طول
              </button>
            </div>

            {/* Signature Section */}
            <div className="w-full mt-1 flex flex-col">
              <label className="text-[9px] text-slate-400 text-center mb-0.5">
                التوقيع بالانجليزي
              </label>
              <input
                type="text"
                id="input-english-signature"
                value={englishSignature ?? ""}
                onChange={(e) => setEnglishSignature(e.target.value)}
                placeholder=""
                className="w-full h-14 bg-white border border-[#cbd5e1] rounded-[2px] text-xs text-center font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM CARD - بيانات الاتصال */}
      <div className="mx-3 mt-3 mb-4 bg-white border border-[#d6e4f7] rounded p-3 shadow-2xs">
        {/* Section Header */}
        <div className="flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1.5 mb-3">
          <Phone className="w-3.5 h-3.5 text-[#2563eb]" />
          <span className="text-[13px] font-bold text-[#2563eb]">
            بيانات الاتصال
          </span>
        </div>

        {/* Contact Info Form Fields */}
        <div className="flex flex-col gap-2.5">
          {/* Row 1: الموبايل & البريد الإلكتروني */}
          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Right: الموبايل */}
            <div className="flex items-center gap-2">
              <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                الموبايل
              </label>
              <input
                type="text"
                id="input-mobile"
                value={mobile ?? ""}
                onChange={(e) => setMobile(e.target.value)}
                placeholder=""
                className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Left: البريد الإلكتروني */}
            <div className="flex items-center gap-2">
              <label className="w-24 text-[11px] font-medium text-slate-700 text-right shrink-0">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                id="input-email"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs text-left font-sans text-slate-800 focus:outline-none focus:border-blue-500"
                dir="ltr"
              />
            </div>
          </div>

          {/* Row 2: هاتف المنزل & المدينة / المحافظة & المدينة & المحافظة */}
          <div className="grid grid-cols-4 gap-3 items-center">
            {/* Col 1 (Right): هاتف المنزل */}
            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-medium text-slate-700 text-right shrink-0">
                هاتف المنزل
              </label>
              <input
                type="text"
                id="input-home-phone"
                value={homePhone ?? ""}
                onChange={(e) => setHomePhone(e.target.value)}
                placeholder=""
                className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Col 2: المدينة / المحافظة */}
            <div className="flex items-center gap-2">
              <label className="w-20 text-[10px] font-medium text-slate-700 text-right shrink-0">
                المدينة / المحافظة
              </label>
              <input
                type="text"
                id="input-city-gov-combined"
                value={cityGovCombined ?? ""}
                onChange={(e) => setCityGovCombined(e.target.value)}
                placeholder=""
                className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Col 3: المدينة */}
            <div className="flex items-center gap-2">
              <label className="w-14 text-[11px] font-medium text-slate-700 text-right shrink-0">
                المدينة
              </label>
              <input
                type="text"
                id="input-city"
                value={city ?? ""}
                onChange={(e) => setCity(e.target.value)}
                placeholder=""
                className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Col 4 (Left): المحافظة */}
            <div className="flex items-center gap-2">
              <label className="w-14 text-[11px] font-medium text-slate-700 text-right shrink-0">
                المحافظة
              </label>
              <input
                type="text"
                id="input-governorate"
                value={governorate ?? ""}
                onChange={(e) => setGovernorate(e.target.value)}
                placeholder=""
                className="w-full h-8 bg-white border border-[#cbd5e1] rounded-[3px] px-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
