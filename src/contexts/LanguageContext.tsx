import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const translations: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    'nav.main': 'الرئيسية',
    'nav.admin': 'الإدارة',
    'dashboard.search': 'بحث في المديولات والأنظمة...',
    'dashboard.active_sub_menu': 'القائمة الداخلية للقسم',
    'dashboard.features': 'الخصائص',
    'dashboard.settings': 'الاعدادات',
    'dashboard.reports': 'التقارير',
    'dashboard.close': 'إغلاق',
    'dashboard.no_content': 'لا توجد عناصر متاحة',
    'dashboard.smart_system': 'منظومة REMO PRO الذكية',
    'dashboard.hint': 'يرجى الضغط على أي مديول جانبي لعرض واختيار القوائم الإدارية والتشغيلية المتاحة داخله.',
    'header.voice_command': 'أمر صوتي',
    'header.version': 'الإصدار',
    'header.status': 'مباشر',
    'header.messages': 'الرسائل',
  },
  en: {
    'nav.main': 'Main',
    'nav.admin': 'Admin',
    'dashboard.search': 'Search modules and systems...',
    'dashboard.active_sub_menu': 'Internal Section Menu',
    'dashboard.features': 'Features',
    'dashboard.settings': 'Settings',
    'dashboard.reports': 'Reports',
    'dashboard.close': 'Close',
    'dashboard.no_content': 'No items available',
    'dashboard.smart_system': 'REMO PRO Smart System',
    'dashboard.hint': 'Please click on any side module to view and select available administrative and operational menus.',
    'header.voice_command': 'Voice Command',
    'header.version': 'Version',
    'header.status': 'Live',
    'header.messages': 'Messages',
    'module.pos': 'POS',
    'module.web-orders': 'Online Orders',
    'module.tables': 'Tables Management',
    'module.kitchen': 'Kitchen Orders',
    'module.service': 'Call Center',
    'module.reservations': 'Reservations',
    'module.branch-reports': 'Branch Reports',
    'module.delivery': 'Delivery Service',
    'module.customers': 'Customer Base',
    'module.ai-chef': 'AI Smart Chef',
    'module.warehouses': 'Warehouses',
    'module.printers': 'Printers',
    'module.complaints': 'Complaints',
    'module.production': 'Production',
    'module.products': 'Items & Ingredients',
    'module.hr': 'Human Resources',
    'module.branches': 'Branches',
    'module.safes': 'Safes',
    'module.customer-accounts': 'Customer Accounts',
    'module.suppliers': 'Suppliers',
    'module.salaries': 'Salaries',
    'module.general-accounts': 'General Accounts',
    'module.database': 'Database',
    'module.costs': 'Costs',
    'module.central-reports': 'Central Reports',
    'module.purchases': 'Purchases',
    'module.attendance': 'Attendance',
    'module.security': 'Security & Control',
    'module.exclusive': 'Exclusive',
    'module.erp_core': 'ERP Professional System',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return saved === 'en' ? 'en' : 'ar';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    applyLanguage(language === 'ar' ? 'en' : 'ar');
  };

  /**
   * تغيير اللغة مع إعادة تحميل واحدة:
   * إعادة التحميل ضرورية لأن Chrome قد يكون قد بدأ ترجمة الصفحة تلقائيًا وهو ما زال
   * يعرض شريط "Translated to…". بعد التحميل يقرأ index.html اللغة من localStorage
   * ويضع lang/translate=no من أول رسم، فلا يظهر شريط الترجمة.
   */
  const applyLanguage = (lang: Language) => {
    try {
      localStorage.setItem('app_lang', lang);
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('translate', 'no');
    } catch {
      /* ignore */
    }
    setLanguage(lang);
    window.setTimeout(() => window.location.reload(), 80);
  };

  const t = (key: string) => {
    const dict = translations[language as 'ar' | 'en'] || translations['en'];
    return dict[key] || key;
  };

  const isRtl = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage: applyLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
