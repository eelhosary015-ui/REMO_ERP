/**
 * Unified Frontend Unit Conversion Engine & Utilities
 * Compatible with backend UnitConversionService
 */

export type UnitCategory = "weight" | "volume" | "length" | "count" | "area" | "time" | "other";

export interface MasterUnitDefinition {
  code: string;
  nameAr: string;
  nameEn: string;
  symbolAr: string;
  symbolEn: string;
  category: UnitCategory;
  baseUnit: string;
  factorToBase: number; // multiply by this to get base unit quantity
  aliases: string[];
}

export const MASTER_UNITS: MasterUnitDefinition[] = [
  // ── WEIGHT (Base: kg) ──
  {
    code: "ton",
    nameAr: "طن",
    nameEn: "Ton",
    symbolAr: "طن",
    symbolEn: "t",
    category: "weight",
    baseUnit: "kg",
    factorToBase: 1000,
    aliases: ["ton", "tons", "tonne", "tonnes", "طن", "أطنان", "اطنان", "t"]
  },
  {
    code: "kg",
    nameAr: "كيلوجرام",
    nameEn: "Kilogram",
    symbolAr: "كجم",
    symbolEn: "kg",
    category: "weight",
    baseUnit: "kg",
    factorToBase: 1,
    aliases: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "كيلو", "كجم", "كغ", "كيلوجرام", "كيلوجرامات", "كيلوغرام"]
  },
  {
    code: "g",
    nameAr: "جرام",
    nameEn: "Gram",
    symbolAr: "جم",
    symbolEn: "g",
    category: "weight",
    baseUnit: "kg",
    factorToBase: 0.001,
    aliases: ["g", "gm", "gms", "gram", "grams", "gramme", "grammes", "جرام", "غرام", "جم", "غ", "جرامات", "غرامات"]
  },
  {
    code: "mg",
    nameAr: "ملليجرام",
    nameEn: "Milligram",
    symbolAr: "ملجم",
    symbolEn: "mg",
    category: "weight",
    baseUnit: "kg",
    factorToBase: 0.000001,
    aliases: ["mg", "mgs", "milligram", "milligrams", "ملليجرام", "ملليغرام", "ملجم", "مغ", "مليجرام"]
  },
  {
    code: "lb",
    nameAr: "رطل",
    nameEn: "Pound",
    symbolAr: "رطل",
    symbolEn: "lb",
    category: "weight",
    baseUnit: "kg",
    factorToBase: 0.45359237,
    aliases: ["lb", "lbs", "pound", "pounds", "رطل", "باوند", "ارطال", "أرطال"]
  },
  {
    code: "oz",
    nameAr: "أونصة",
    nameEn: "Ounce",
    symbolAr: "أونصة",
    symbolEn: "oz",
    category: "weight",
    baseUnit: "kg",
    factorToBase: 0.028349523125,
    aliases: ["oz", "ounce", "ounces", "اونصة", "أونصة", "اوقية", "أوقية"]
  },

  // ── VOLUME (Base: l) ──
  {
    code: "m3",
    nameAr: "متر مكعب",
    nameEn: "Cubic Meter",
    symbolAr: "م³",
    symbolEn: "m³",
    category: "volume",
    baseUnit: "l",
    factorToBase: 1000,
    aliases: ["m3", "cubic_meter", "cbm", "متر مكعب", "م³"]
  },
  {
    code: "l",
    nameAr: "لتر",
    nameEn: "Liter",
    symbolAr: "لتر",
    symbolEn: "L",
    category: "volume",
    baseUnit: "l",
    factorToBase: 1,
    aliases: ["l", "lt", "ltr", "liter", "liters", "litre", "litres", "لتر", "ل", "لترات"]
  },
  {
    code: "ml",
    nameAr: "ملليلتر",
    nameEn: "Milliliter",
    symbolAr: "مل",
    symbolEn: "mL",
    category: "volume",
    baseUnit: "l",
    factorToBase: 0.001,
    aliases: ["ml", "mls", "milliliter", "milliliters", "millilitre", "مل", "مللي", "ملليلتر", "مللي لتر", "سم3", "cc", "cm3"]
  },
  {
    code: "gal",
    nameAr: "جالون",
    nameEn: "Gallon",
    symbolAr: "جالون",
    symbolEn: "gal",
    category: "volume",
    baseUnit: "l",
    factorToBase: 3.785411784,
    aliases: ["gal", "gallon", "gallons", "جالون", "غالون", "جالونات"]
  },
  {
    code: "cup",
    nameAr: "كوب",
    nameEn: "Cup",
    symbolAr: "كوب",
    symbolEn: "cup",
    category: "volume",
    baseUnit: "l",
    factorToBase: 0.24,
    aliases: ["cup", "cups", "كوب", "كأس", "اكواب", "أكواب"]
  },
  {
    code: "tbsp",
    nameAr: "ملعقة كبيرة",
    nameEn: "Tablespoon",
    symbolAr: "م.ك",
    symbolEn: "tbsp",
    category: "volume",
    baseUnit: "l",
    factorToBase: 0.015,
    aliases: ["tbsp", "tablespoon", "tablespoons", "ملعقة كبيرة", "م.ك", "م ك"]
  },
  {
    code: "tsp",
    nameAr: "ملعقة صغيرة",
    nameEn: "Teaspoon",
    symbolAr: "م.ص",
    symbolEn: "tsp",
    category: "volume",
    baseUnit: "l",
    factorToBase: 0.005,
    aliases: ["tsp", "teaspoon", "teaspoons", "ملعقة صغيرة", "م.ص", "م ص"]
  },

  // ── LENGTH (Base: m) ──
  {
    code: "km",
    nameAr: "كيلومتر",
    nameEn: "Kilometer",
    symbolAr: "كم",
    symbolEn: "km",
    category: "length",
    baseUnit: "m",
    factorToBase: 1000,
    aliases: ["km", "kilometer", "kilometre", "كيلومتر", "كم"]
  },
  {
    code: "m",
    nameAr: "متر",
    nameEn: "Meter",
    symbolAr: "م",
    symbolEn: "m",
    category: "length",
    baseUnit: "m",
    factorToBase: 1,
    aliases: ["m", "meter", "meters", "metre", "metres", "متر", "م", "امتار", "أمتار"]
  },
  {
    code: "cm",
    nameAr: "سنتيمتر",
    nameEn: "Centimeter",
    symbolAr: "سم",
    symbolEn: "cm",
    category: "length",
    baseUnit: "m",
    factorToBase: 0.01,
    aliases: ["cm", "centimeter", "centimeters", "centimetre", "سنتيمتر", "سم", "سنتيمترات"]
  },
  {
    code: "mm",
    nameAr: "ملليمتر",
    nameEn: "Millimeter",
    symbolAr: "ملم",
    symbolEn: "mm",
    category: "length",
    baseUnit: "m",
    factorToBase: 0.001,
    aliases: ["mm", "millimeter", "millimeters", "millimetre", "ملليمتر", "ملم", "مليمتر"]
  },
  {
    code: "in",
    nameAr: "بوصة",
    nameEn: "Inch",
    symbolAr: "بوصة",
    symbolEn: "in",
    category: "length",
    baseUnit: "m",
    factorToBase: 0.0254,
    aliases: ["in", "inch", "inches", "بوصة", "إنش", "انش", "بوصات"]
  },
  {
    code: "ft",
    nameAr: "قدم",
    nameEn: "Foot",
    symbolAr: "قدم",
    symbolEn: "ft",
    category: "length",
    baseUnit: "m",
    factorToBase: 0.3048,
    aliases: ["ft", "foot", "feet", "قدم", "أقدام", "اقدام"]
  },
  {
    code: "yd",
    nameAr: "ياردة",
    nameEn: "Yard",
    symbolAr: "ياردة",
    symbolEn: "yd",
    category: "length",
    baseUnit: "m",
    factorToBase: 0.9144,
    aliases: ["yd", "yard", "yards", "ياردة", "ياردا", "ياردات"]
  },

  // ── COUNT / PACKAGING (Base: piece) ──
  {
    code: "piece",
    nameAr: "قطعة",
    nameEn: "Piece",
    symbolAr: "قطعة",
    symbolEn: "pc",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["piece", "pieces", "pc", "pcs", "item", "items", "unit", "units", "قطعة", "قطع", "حبة", "حبات", "عدد", "وحدة", "وحدات"]
  },
  {
    code: "dozen",
    nameAr: "دستة",
    nameEn: "Dozen",
    symbolAr: "دستة",
    symbolEn: "dz",
    category: "count",
    baseUnit: "piece",
    factorToBase: 12,
    aliases: ["dozen", "dozens", "dz", "دستة", "دسته", "دستات"]
  },
  {
    code: "carton",
    nameAr: "كرتونة",
    nameEn: "Carton",
    symbolAr: "كرتونة",
    symbolEn: "ctn",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["carton", "cartons", "ctn", "كرتونة", "كرتونه", "كراتين"]
  },
  {
    code: "box",
    nameAr: "صندوق / علبة",
    nameEn: "Box",
    symbolAr: "علبة",
    symbolEn: "box",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["box", "boxes", "علبة", "علبه", "علب", "صندوق", "صناديق", "طرد"]
  },
  {
    code: "pack",
    nameAr: "باكت / عبوة",
    nameEn: "Pack",
    symbolAr: "باكت",
    symbolEn: "pack",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["pack", "packs", "packet", "packets", "package", "packages", "باكت", "بكت", "عبوة", "عبوه", "عبوات", "ربطة", "ربطه"]
  },
  {
    code: "bag",
    nameAr: "شوال / كيس",
    nameEn: "Bag / Sack",
    symbolAr: "كيس",
    symbolEn: "bag",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["bag", "bags", "sack", "sacks", "شوال", "شيكارة", "شكارة", "كيس", "أكياس", "اكياس"]
  },
  {
    code: "bottle",
    nameAr: "زجاجة",
    nameEn: "Bottle",
    symbolAr: "زجاجة",
    symbolEn: "btl",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["bottle", "bottles", "btl", "زجاجة", "زجاجه", "قنينة", "قنينه", "قارورة"]
  },
  {
    code: "can",
    nameAr: "كانز / صفيحة",
    nameEn: "Can",
    symbolAr: "كانز",
    symbolEn: "can",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["can", "cans", "كانز", "صفيحة", "صفيحه", "برطمان", "جار"]
  },
  {
    code: "roll",
    nameAr: "رول / لفة",
    nameEn: "Roll",
    symbolAr: "رول",
    symbolEn: "roll",
    category: "count",
    baseUnit: "piece",
    factorToBase: 1,
    aliases: ["roll", "rolls", "رول", "لفة", "لفه", "طاقة", "طاقه"]
  }
];

export function normalizeUnit(unitStr: string | null | undefined): MasterUnitDefinition | null {
  if (!unitStr) return null;
  const clean = String(unitStr).trim().toLowerCase().replace(/[()_\-\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const directCode = MASTER_UNITS.find(u => u.code.toLowerCase() === clean);
  if (directCode) return directCode;

  const nameMatch = MASTER_UNITS.find(
    u => u.nameAr.toLowerCase() === clean ||
         u.nameEn.toLowerCase() === clean ||
         u.symbolAr.toLowerCase() === clean ||
         u.symbolEn.toLowerCase() === clean
  );
  if (nameMatch) return nameMatch;

  const aliasMatch = MASTER_UNITS.find(u => u.aliases.some(a => a.toLowerCase() === clean));
  if (aliasMatch) return aliasMatch;

  const partialMatch = MASTER_UNITS.find(u => u.aliases.some(a => clean.includes(a.toLowerCase()) || a.toLowerCase().includes(clean)));
  if (partialMatch) return partialMatch;

  return null;
}

export function areUnitsIdentical(unitA: string, unitB: string): boolean {
  const a = normalizeUnit(unitA);
  const b = normalizeUnit(unitB);
  if (a && b) return a.code === b.code;
  return String(unitA).trim().toLowerCase() === String(unitB).trim().toLowerCase();
}

export function getUnitLabel(unitStr: string | null | undefined): string {
  const def = normalizeUnit(unitStr);
  if (def) return def.symbolAr || def.nameAr;
  return unitStr || "وحدة";
}

export function getCompatibleUnits(baseUnitStr: string | null | undefined, customConversions: any[] = []): Array<{
  code: string;
  name: string;
  symbol: string;
  factorToBase: number;
  isBase: boolean;
}> {
  const baseDef = normalizeUnit(baseUnitStr) || MASTER_UNITS.find(u => u.code === "kg")!;
  const category = baseDef.category;

  const list: Array<{ code: string; name: string; symbol: string; factorToBase: number; isBase: boolean }> = [];

  // 1. Same category standard units
  const sameCat = MASTER_UNITS.filter(u => u.category === category);
  sameCat.forEach(u => {
    const isBase = u.code === baseDef.code;
    const factorToBase = u.factorToBase / baseDef.factorToBase;
    list.push({
      code: u.code,
      name: u.nameAr,
      symbol: u.symbolAr,
      factorToBase,
      isBase
    });
  });

  // 2. Custom conversions for this item
  if (Array.isArray(customConversions)) {
    customConversions.forEach(c => {
      const fromUom = c.from_uom || c.fromUom;
      const rawFactor = Number(c.conversion_factor || c.conversionFactor || 1);
      const op = String(c.operator || 'multiply').toLowerCase();
      const factor = op === 'divide' ? (1 / rawFactor) : rawFactor;

      const norm = normalizeUnit(fromUom);
      const code = norm?.code || fromUom;
      if (!list.some(item => item.code === code || item.name === fromUom)) {
        list.push({
          code,
          name: norm?.nameAr || fromUom,
          symbol: norm?.symbolAr || fromUom,
          factorToBase: factor,
          isBase: false
        });
      }
    });
  }

  return list;
}

/**
 * Converts a quantity from recipe/order unit to base warehouse unit (client-side preview).
 */
export function convertUnitClient(
  qty: number,
  fromUnit: string,
  toUnit: string,
  customConversions: any[] = []
): {
  success: boolean;
  convertedQty: number;
  factor: number;
  costFactor: number;
  equation: string;
} {
  const numQty = Number(qty) || 0;
  if (areUnitsIdentical(fromUnit, toUnit)) {
    return {
      success: true,
      convertedQty: numQty,
      factor: 1,
      costFactor: 1,
      equation: `${numQty} ${getUnitLabel(fromUnit)} = ${numQty} ${getUnitLabel(toUnit)}`
    };
  }

  const fromDef = normalizeUnit(fromUnit);
  const toDef = normalizeUnit(toUnit);

  // Standard category math
  if (fromDef && toDef && fromDef.category === toDef.category) {
    const factor = fromDef.factorToBase / toDef.factorToBase;
    const convertedQty = Math.round(numQty * factor * 1000000) / 1000000;
    return {
      success: true,
      convertedQty,
      factor,
      costFactor: 1 / factor,
      equation: `${numQty} ${fromDef.symbolAr || fromDef.nameAr} = ${convertedQty} ${toDef.symbolAr || toDef.nameAr}`
    };
  }

  // Check custom conversions
  if (Array.isArray(customConversions)) {
    for (const c of customConversions) {
      const fromUom = c.from_uom || c.fromUom;
      const toUom = c.to_uom || c.toUom;
      const rawFactor = Number(c.conversion_factor || c.conversionFactor || 1);
      const op = String(c.operator || 'multiply').toLowerCase();
      const factor = op === 'divide' ? (1 / rawFactor) : rawFactor;

      if (areUnitsIdentical(fromUnit, fromUom) && areUnitsIdentical(toUnit, toUom)) {
        const convertedQty = Math.round(numQty * factor * 1000000) / 1000000;
        return {
          success: true,
          convertedQty,
          factor,
          costFactor: 1 / factor,
          equation: `${numQty} ${getUnitLabel(fromUnit)} = ${convertedQty} ${getUnitLabel(toUnit)} (1 ${getUnitLabel(fromUnit)} = ${factor} ${getUnitLabel(toUnit)})`
        };
      }

      if (areUnitsIdentical(fromUnit, toUom) && areUnitsIdentical(toUnit, fromUom)) {
        const invFactor = 1 / factor;
        const convertedQty = Math.round(numQty * invFactor * 1000000) / 1000000;
        return {
          success: true,
          convertedQty,
          factor: invFactor,
          costFactor: factor,
          equation: `${numQty} ${getUnitLabel(fromUnit)} = ${convertedQty} ${getUnitLabel(toUnit)}`
        };
      }
    }
  }

  return {
    success: false,
    convertedQty: numQty,
    factor: 1,
    costFactor: 1,
    equation: `${numQty} ${getUnitLabel(fromUnit)}`
  };
}

export const convertQuantity = (
  qty: number,
  fromUnit: string,
  toUnit: string,
  customConversions: any[] = []
) => {
  const res = convertUnitClient(qty, fromUnit, toUnit, customConversions);
  return {
    success: res.success,
    fromQuantity: qty,
    toQuantity: res.convertedQty,
    factor: res.factor,
    explanation: res.equation
  };
};
