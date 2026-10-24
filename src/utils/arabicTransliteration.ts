/**
 * Arabic to English Name Transliteration Utility
 * Specifically tuned for Egyptian and Arabic names.
 */

// Title mappings
export const ARABIC_TITLES_MAP: Record<string, string> = {
  "السيد": "Mr.",
  "السيدة": "Mrs.",
  "الآنسة": "Ms.",
  "الانسه": "Ms.",
  "أ.": "Mr.",
  "أستاذ": "Prof.",
  "أستاذة": "Prof.",
  "د.": "Dr.",
  "دكتور": "Dr.",
  "دكتورة": "Dr.",
  "م.": "Eng.",
  "مهندس": "Eng.",
  "مهندسة": "Eng.",
  "الشيخ": "Sheikh",
  "المستشار": "Counselor",
  "--": "",
};

// Common Egyptian and Arabic Name Dictionary (300+ common names)
export const COMMON_ARABIC_NAMES: Record<string, string> = {
  // Common Male Names
  "محمد": "Mohamed",
  "احمد": "Ahmed",
  "أحمد": "Ahmed",
  "محمود": "Mahmoud",
  "علي": "Ali",
  "على": "Ali",
  "مصطفى": "Mostafa",
  "مصطفي": "Mostafa",
  "إبراهيم": "Ibrahim",
  "ابراهيم": "Ibrahim",
  "حسن": "Hassan",
  "حسين": "Hussein",
  "عمر": "Omar",
  "عمرو": "Amr",
  "عثمان": "Osman",
  "يوسف": "Youssef",
  "طارق": "Tarek",
  "وليد": "Waleed",
  "خالد": "Khaled",
  "كريم": "Karim",
  "سامح": "Sameh",
  "رامي": "Ramy",
  "رامى": "Ramy",
  "شريف": "Sherif",
  "وائل": "Wael",
  "ياسر": "Yasser",
  "هاني": "Hany",
  "هانى": "Hany",
  "مجدي": "Magdy",
  "مجدى": "Magdy",
  "مدحت": "Medhat",
  "إيهاب": "Ehab",
  "ايهاب": "Ehab",
  "تامر": "Tamer",
  "هيثم": "Haitham",
  "أشرف": "Ashraf",
  "اشرف": "Ashraf",
  "علاء": "Alaa",
  "حسام": "Hossam",
  "نبيل": "Nabil",
  "سعيد": "Saeed",
  "سعد": "Saad",
  "سامي": "Samy",
  "سامى": "Samy",
  "سمير": "Samir",
  "عادل": "Adel",
  "كمال": "Kamal",
  "جلال": "Galal",
  "جمال": "Gamal",
  "عصام": "Essam",
  "عماد": "Emad",
  "أيمن": "Ayman",
  "ايمن": "Ayman",
  "أسامة": "Osama",
  "اسامة": "Osama",
  "ممدوح": "Mamdouh",
  "بهجت": "Bahgat",
  "بدوي": "Badawy",
  "صابر": "Saber",
  "متولي": "Metwally",
  "مرسي": "Morsi",
  "شعبان": "Shaaban",
  "رمضان": "Ramadan",
  "رجب": "Ragab",
  "شوقي": "Shawky",
  "صبري": "Sabry",
  "صفوت": "Safwat",
  "راغب": "Ragheb",
  "رمزي": "Ramzy",
  "لطفي": "Lotfy",
  "لبيب": "Labib",
  "مكرم": "Makram",
  "مختار": "Mokhtar",
  "مراد": "Mourad",
  "منير": "Mounir",
  "مروان": "Marwan",
  "مسعد": "Mosaad",
  "مصلح": "Mosleh",
  "مظهر": "Mazhar",
  "معوض": "Moawad",
  "مهران": "Mehran",
  "ناجي": "Nagy",
  "نادر": "Nader",
  "ناصر": "Nasser",
  "نصحي": "Noshy",
  "نصار": "Nassar",
  "نصر": "Nasr",
  "نظمي": "Nazmy",
  "نعيم": "Naeem",
  "وجدي": "Wagdy",
  "وحيد": "Waheed",
  "وفيق": "Wafeek",
  "ياسين": "Yassin",
  "يحيى": "Yehia",
  "يحيي": "Yehia",
  "يسري": "Yousry",
  "يعقوب": "Yacoub",
  "يونان": "Younan",
  "يوحنا": "Youhanna",
  "إدريس": "Idris",
  "ادريس": "Idris",
  "إسماعيل": "Ismail",
  "اسماعيل": "Ismail",
  "إلياس": "Elias",
  "الياس": "Elias",
  "أنس": "Anas",
  "انس": "Anas",
  "أنور": "Anwar",
  "انور": "Anwar",
  "بدر": "Badr",
  "باهر": "Baher",
  "باسل": "Bassel",
  "باسم": "Bassem",
  "بكر": "Bakr",
  "بلال": "Belal",
  "توفيق": "Tawfik",
  "ثابت": "Thabet",
  "ثروت": "Sarwat",
  "جابر": "Gaber",
  "جاد": "Gad",
  "جعفر": "Gaafar",
  "جميل": "Gamil",
  "جمعة": "Gomaa",
  "جهاد": "Gehad",
  "جواد": "Gawad",
  "حاتم": "Hatem",
  "حازم": "Hazem",
  "حافظ": "Hafez",
  "حامد": "Hamed",
  "حبيب": "Habib",
  "حسني": "Hosny",
  "حمدي": "Hamdy",
  "حمزة": "Hamza",
  "حيدر": "Haidar",
  "درويش": "Darwish",
  "دياب": "Diab",
  "راشد": "Rashed",
  "راضي": "Rady",
  "رافت": "Raafat",
  "رأفت": "Raafat",
  "رشدي": "Roshdy",
  "رضا": "Reda",
  "رضوان": "Radwan",
  "زكريا": "Zakaria",
  "زكي": "Zaki",
  "زياد": "Ziad",
  "ساهر": "Saher",
  "سراج": "Serag",
  "سرحان": "Sarhan",
  "سرور": "Sorrour",
  "سليم": "Selim",
  "سليمان": "Soliman",
  "سيف": "Seif",
  "شحاتة": "Shehata",
  "شديد": "Shadid",
  "شفيق": "Shafik",
  "شكري": "Shoukry",
  "شوق": "Shawq",
  "صادق": "Sadek",
  "صالح": "Saleh",
  "صلاح": "Salah",
  "صبحي": "Sobhy",
  "صديق": "Sedik",
  "صفوان": "Safwan",
  "صقر": "Saqr",
  "طلعت": "Talaat",
  "طاهر": "Taher",
  "طلبة": "Tolba",
  "عابد": "Abed",
  "عابدين": "Abedin",
  "عاطف": "Atef",
  "عامر": "Amer",
  "عاصم": "Assem",
  "عبده": "Abdo",
  "عرفة": "Arafa",
  "عزت": "Ezzat",
  "عزمي": "Azmy",
  "عشري": "Eshry",
  "عطية": "Attia",
  "عفيفي": "Afifi",
  "عقيل": "Akeel",
  "عمار": "Ammar",
  "عنتر": "Antar",
  "عواد": "Awwad",
  "عوض": "Awad",
  "عوني": "Awny",
  "عيد": "Eid",
  "عيسى": "Issa",
  "عيسا": "Issa",
  "غريب": "Ghareeb",
  "غزالي": "Ghazaly",
  "فاروق": "Farouk",
  "فاضل": "Fadel",
  "فايز": "Fayez",
  "فتوح": "Fetouh",
  "فخري": "Fakhry",
  "فراج": "Farag",
  "فرج": "Farag",
  "فريد": "Farid",
  "فضل": "Fadl",
  "فهمي": "Fahmy",
  "فوزي": "Fawzy",
  "فؤاد": "Fouad",
  "فواد": "Fouad",
  "فيصل": "Faisal",
  "قاسم": "Kassem",
  "قطب": "Kotb",
  "كامل": "Kamel",
  "كرم": "Karam",
  "كنعان": "Kanaan",
  "لطيف": "Latif",
  "ماجد": "Maged",
  "مازن": "Mazen",
  "مالك": "Malek",
  "مأمون": "Mamoun",
  "مامون": "Mamoun",
  "مجاهد": "Megahed",
  "مخلص": "Mokhles",
  "مدين": "Madyan",
  "مرزوق": "Marzouk",
  "مسعود": "Massoud",
  "مطاوع": "Motawea",
  "ميسرة": "Maysara",
  "ناجح": "Nageh",
  "نادي": "Nady",
  "نافع": "Nafea",
  "نبوي": "Nabawy",
  "نجاتي": "Nagaty",
  "نجم": "Negm",
  "نسيم": "Nassim",
  "نشأت": "Nashaat",
  "نصري": "Nasry",
  "نظير": "Nazir",
  "نمر": "Nemr",
  "نهاد": "Nehad",
  "نوار": "Nawar",
  "نوري": "Noury",
  "هاشم": "Hashem",
  "هشام": "Hesham",
  "همام": "Hammam",
  "وافي": "Wafy",
  "واكد": "Waked",
  "والي": "Waly",
  "وجيه": "Wagih",
  "وديع": "Wadea",
  "وصفي": "Wasfy",
  "وضاح": "Waddah",
  "ياقوت": "Yaqout",
  "يامن": "Yamen",

  // Egyptian Coptic/Christian Names
  "مينا": "Mina",
  "بيشوي": "Bishoy",
  "كيرلس": "Kyrillos",
  "كرلس": "Kyrillos",
  "جورج": "George",
  "بيتر": "Peter",
  "بولا": "Paula",
  "أبانوب": "Abanoub",
  "ابانوب": "Abanoub",
  "فيكتور": "Victor",
  "مايكل": "Michael",
  "فادي": "Fady",
  "فادى": "Fady",
  "شادي": "Shady",
  "شادى": "Shady",
  "سامر": "Samer",
  "ملاك": "Malak",
  "عمانوئيل": "Emmanuel",
  "شنودة": "Shenouda",
  "تواضروس": "Tawadros",
  "مرقص": "Morcos",
  "مرقس": "Morcos",
  "متى": "Matta",
  "لوقا": "Louka",
  "تادرس": "Tadros",

  // Female Names
  "هدى": "Hoda",
  "هدي": "Hoda",
  "فاطمة": "Fatma",
  "فاطمه": "Fatma",
  "مريم": "Mariam",
  "آية": "Aya",
  "ايه": "Aya",
  "آيه": "Aya",
  "سارة": "Sara",
  "ساره": "Sara",
  "رانيا": "Rania",
  "نورا": "Nora",
  "نوره": "Nora",
  "دينا": "Dina",
  "منى": "Mona",
  "مني": "Mona",
  "نهى": "Noha",
  "نهي": "Noha",
  "إيمان": "Iman",
  "ايمان": "Iman",
  "ياسمين": "Yasmin",
  "شيماء": "Shaimaa",
  "هبة": "Heba",
  "هبه": "Heba",
  "مي": "Mai",
  "ميّ": "Mai",
  "ندى": "Nada",
  "ندي": "Nada",
  "ريهام": "Reham",
  "سلمى": "Salma",
  "سلمي": "Salma",
  "هاجر": "Hagar",
  "خديجة": "Khadija",
  "خديجه": "Khadija",
  "عائشة": "Aisha",
  "عائشه": "Aisha",
  "زينب": "Zeinab",
  "أسماء": "Asmaa",
  "اسماء": "Asmaa",
  "رضوى": "Radwa",
  "رضوي": "Radwa",
  "إسراء": "Esraa",
  "اسراء": "Esraa",
  "رنا": "Rana",
  "أماني": "Amany",
  "اماني": "Amany",
  "دعاء": "Doaa",
  "شروق": "Shorouk",
  "عبير": "Abeer",
  "سمر": "Samar",
  "هالة": "Hala",
  "هاله": "Hala",
  "نجلاء": "Naglaa",
  "غادة": "Ghada",
  "غاده": "Ghada",
  "رحاب": "Rehab",
  "ابتسام": "Ebtissam",
  "إبتسام": "Ebtissam",
  "نيفين": "Nevin",
  "مروة": "Marwa",
  "مروه": "Marwa",
  "داليا": "Dalia",
  "يمنى": "Yomna",
  "يمني": "Yomna",
  "بسنت": "Passant",
  "روان": "Rowan",
  "نور": "Nour",
  "جنة": "Ganna",
  "جنه": "Ganna",
  "حبيبة": "Habiba",
  "حبيبه": "Habiba",
  "ميرنا": "Mirna",
  "مارينا": "Marina",
  "منار": "Manar",
  "حنان": "Hanan",
  "سهام": "Seham",
  "صباح": "Sabah",
  "صفاء": "Safaa",
  "ولاء": "Walaa",
  "وفاء": "Wafaa",
  "وفا": "Wafaa",
  "نجوى": "Nagwa",
  "هند": "Hend",
  "لبنى": "Lobna",
  "لبني": "Lobna",
  "إلهام": "Elham",
  "الهام": "Elham",
  "سميحة": "Samiha",
  "أميرة": "Amira",
  "اميرة": "Amira",
  "أميره": "Amira",
  "اميره": "Amira",

  // Compound / Abdel Names
  "عبدالله": "Abdallah",
  "عبد الله": "Abdallah",
  "عبدالرحمن": "Abdelrahman",
  "عبد الرحمن": "Abdelrahman",
  "عبدالعزيز": "Abdelaziz",
  "عبد العزيز": "Abdelaziz",
  "عبدالحميد": "Abdelhamid",
  "عبد الحميد": "Abdelhamid",
  "عبدالمجيد": "Abdelmagid",
  "عبد المجيد": "Abdelmagid",
  "عبدالفتاح": "Abdelfattah",
  "عبد الفتاح": "Abdelfattah",
  "عبدالقادر": "Abdelkader",
  "عبد القادر": "Abdelkader",
  "عبدالرؤوف": "Abdelraouf",
  "عبد الرؤوف": "Abdelraouf",
  "عبدالمنعم": "Abdelmoneim",
  "عبد المنعم": "Abdelmoneim",
  "عبدالوهاب": "Abdelwahab",
  "عبد الوهاب": "Abdelwahab",
  "عبدالسلام": "Abdelsalam",
  "عبد السلام": "Abdelsalam",
  "عبدالصمد": "Abdelsamad",
  "عبد الصمد": "Abdelsamad",
  "عبدالعظيم": "Abdelazim",
  "عبد العظيم": "Abdelazim",
  "عبدالباسط": "Abdelbaset",
  "عبد الباسط": "Abdelbaset",
  "عبدالرازق": "Abdelrazek",
  "عبد الرازق": "Abdelrazek",
  "عبدالرزاق": "Abdelrazek",
  "عبد الرزاق": "Abdelrazek",
  "عبدالعليم": "Abdelalim",
  "عبد العليم": "Abdelalim",
  "عبدالمعطي": "Abdelmoaty",
  "عبد المعطي": "Abdelmoaty",
  "عبدالجليل": "Abdelgalil",
  "عبد الجليل": "Abdelgalil",
  "عبدالهادي": "Abdelhady",
  "عبد الهادي": "Abdelhady",
  "عبداللطيف": "Abdellatif",
  "عبد اللطيف": "Abdellatif",
  "عبدالشافي": "Abdelshafy",
  "عبد الشافي": "Abdelshafy",
  "عبدالستار": "Abdelsattar",
  "عبد الستار": "Abdelsattar",
  "عبدالغني": "Abdelghany",
  "عبد الغني": "Abdelghany",
  "عبدالنبي": "Abdelnaby",
  "عبد النبي": "Abdelnaby",
  "علاء الدين": "Alaa Eldin",
  "علاءالدين": "Alaa Eldin",
  "سيف الدين": "Seif Eldin",
  "سيفالدين": "Seif Eldin",
  "حسام الدين": "Hossam Eldin",
  "حسامالدين": "Hossam Eldin",
  "نور الدين": "Nour Eldin",
  "نورالدين": "Nour Eldin",
  "ضياء الدين": "Diaa Eldin",
  "ضياءالدين": "Diaa Eldin",
  "عماد الدين": "Emad Eldin",
  "عمادالدين": "Emad Eldin",
  "بهاء الدين": "Bahaa Eldin",
  "بهاءالدين": "Bahaa Eldin",
  "أبو بكر": "Abu Bakr",
  "ابو بكر": "Abu Bakr",
  "أبوبكر": "Abu Bakr",
  "ابوبكر": "Abu Bakr",
};

// Character-by-character transliteration map
const CHAR_MAP: Record<string, string> = {
  "ا": "a",
  "أ": "a",
  "إ": "e",
  "آ": "a",
  "ء": "",
  "ئ": "e",
  "ؤ": "o",
  "ب": "b",
  "ت": "t",
  "ث": "th",
  "ج": "g",
  "ح": "h",
  "خ": "kh",
  "د": "d",
  "ذ": "th",
  "ر": "r",
  "ز": "z",
  "س": "s",
  "ش": "sh",
  "ص": "s",
  "ض": "d",
  "ط": "t",
  "ظ": "z",
  "ع": "a",
  "غ": "gh",
  "ف": "f",
  "ق": "k",
  "ك": "k",
  "ل": "l",
  "م": "m",
  "ن": "n",
  "ه": "h",
  "و": "w",
  "ي": "y",
  "ى": "a",
  "ة": "a",
  " ": " ",
};

/**
 * Clean Arabic text from tashkeel/diacritics and normalize
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel
    .replace(/\s+/g, " ");
}

/**
 * Capitalize first letter of a word, keeping other letters lower/mixed appropriately
 */
export function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Transliterate single Arabic word character-by-character if not in dictionary
 */
function transliterateSingleWord(word: string): string {
  if (!word) return "";

  // Check dictionary directly
  const cleanWord = normalizeArabic(word);
  if (COMMON_ARABIC_NAMES[cleanWord]) {
    return COMMON_ARABIC_NAMES[cleanWord];
  }

  // Handle common prefixes
  if (cleanWord.startsWith("عبد") && cleanWord.length > 3) {
    const remainder = cleanWord.slice(3).trim();
    if (remainder.startsWith("ال")) {
      const baseRemainder = remainder.slice(2).trim();
      const transliteratedRem = transliterateSingleWord(baseRemainder);
      return "Abdel" + transliteratedRem.toLowerCase();
    }
    const transliteratedRem = transliterateSingleWord(remainder);
    return "Abd" + transliteratedRem.toLowerCase();
  }

  if (cleanWord.startsWith("ال") && cleanWord.length > 2) {
    const remainder = cleanWord.slice(2);
    const transliteratedRem = transliterateSingleWord(remainder);
    return "El" + transliteratedRem;
  }

  // Fallback: character-by-character mapping
  let result = "";
  for (let i = 0; i < cleanWord.length; i++) {
    const ch = cleanWord[i];
    const nextCh = cleanWord[i + 1];

    // Contextual heuristics:
    // 'و' inside or end of word as vowel 'o' or 'ou' or 'u'
    if (ch === "و") {
      if (i === 0) {
        result += "W";
      } else if (cleanWord[i - 1] === "م" && (nextCh === "د" || nextCh === "ن" || nextCh === "ر" || nextCh === "س")) {
        result += "ou";
      } else if (i === cleanWord.length - 1) {
        result += "o";
      } else {
        result += "oo";
      }
    }
    // 'ي' inside or end
    else if (ch === "ي") {
      if (i === 0) {
        result += "Y";
      } else if (i === cleanWord.length - 1) {
        result += "y";
      } else {
        result += "e";
      }
    }
    // 'ة' at end
    else if (ch === "ة") {
      result += "a";
    }
    // other mapped chars
    else if (CHAR_MAP[ch] !== undefined) {
      result += CHAR_MAP[ch];
    } else {
      result += ch;
    }
  }

  // Clean consecutive vowels or awkward double letters
  result = result
    .replace(/aa+/gi, "a")
    .replace(/ee+/gi, "ee")
    .replace(/oo+/gi, "ou");

  return capitalize(result);
}

/**
 * Main function: Convert Arabic full/part name to English
 */
export function arabicToEnglish(arabicText: string): string {
  if (!arabicText) return "";

  const trimmed = normalizeArabic(arabicText);
  if (!trimmed) return "";

  // 1. Direct match in dictionary for full phrase (e.g. "عبد الرحمن", "سيف الدين")
  if (COMMON_ARABIC_NAMES[trimmed]) {
    return COMMON_ARABIC_NAMES[trimmed];
  }

  // 2. Direct match in Title Map
  if (ARABIC_TITLES_MAP[trimmed] !== undefined) {
    return ARABIC_TITLES_MAP[trimmed];
  }

  // 3. Multi-word handling (e.g., "محمد أحمد")
  const words = trimmed.split(" ").filter(Boolean);
  if (words.length > 1) {
    // Check if entire multi-word exists
    const fullKey = words.join(" ");
    if (COMMON_ARABIC_NAMES[fullKey]) {
      return COMMON_ARABIC_NAMES[fullKey];
    }

    return words
      .map((w) => {
        if (COMMON_ARABIC_NAMES[w]) {
          return COMMON_ARABIC_NAMES[w];
        }
        return transliterateSingleWord(w);
      })
      .join(" ");
  }

  // 4. Single word transliteration
  return transliterateSingleWord(trimmed);
}

/**
 * Transliterate Title (السيد -> Mr., etc.)
 */
export function arabicTitleToEnglish(title: string): string {
  if (!title) return "";
  const trimmed = title.trim();
  if (ARABIC_TITLES_MAP[trimmed] !== undefined) {
    return ARABIC_TITLES_MAP[trimmed];
  }
  return arabicToEnglish(title);
}
