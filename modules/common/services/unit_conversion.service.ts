import { Pool, PoolClient } from "pg";

export type UnitCategory = "weight" | "volume" | "length" | "count" | "area" | "time" | "other";

export interface MasterUnitDefinition {
  code: string;
  nameAr: string;
  nameEn: string;
  symbolAr: string;
  symbolEn: string;
  category: UnitCategory;
  baseUnit: string;
  factorToBase: number; // multiply unit qty by this to get base unit qty
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

export interface ConversionResult {
  success: boolean;
  fromQuantity: number;
  fromUnit: string;
  fromUnitNormalized: string;
  toQuantity: number;
  toUnit: string;
  toUnitNormalized: string;
  factor: number; // toQuantity = fromQuantity * factor
  costFactor: number; // costPerToUnit = costPerFromUnit * costFactor
  category?: UnitCategory;
  isDirectSameCategory: boolean;
  ruleType: "identical" | "standard_category" | "item_specific" | "global_conversion" | "density" | "incompatible";
  explanation: string;
  error?: string;
}

export class UnitConversionService {
  /**
   * Normalizes any input unit string (Arabic or English, plural or abbreviated)
   * to its standard definition.
   */
  public static normalizeUnit(unitStr: string | null | undefined): MasterUnitDefinition | null {
    if (!unitStr) return null;
    const clean = String(unitStr).trim().toLowerCase().replace(/[()_\-\[\]]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return null;

    // 1. Direct match on code
    const directCode = MASTER_UNITS.find(u => u.code.toLowerCase() === clean);
    if (directCode) return directCode;

    // 2. Direct match on Arabic/English names or symbols
    const nameMatch = MASTER_UNITS.find(
      u => u.nameAr.toLowerCase() === clean ||
           u.nameEn.toLowerCase() === clean ||
           u.symbolAr.toLowerCase() === clean ||
           u.symbolEn.toLowerCase() === clean
    );
    if (nameMatch) return nameMatch;

    // 3. Search through aliases
    const aliasMatch = MASTER_UNITS.find(u => u.aliases.some(a => a.toLowerCase() === clean));
    if (aliasMatch) return aliasMatch;

    // 4. Substring / partial match fallback
    const partialMatch = MASTER_UNITS.find(u => u.aliases.some(a => clean.includes(a.toLowerCase()) || a.toLowerCase().includes(clean)));
    if (partialMatch) return partialMatch;

    return null;
  }

  /**
   * Check if two unit strings are effectively identical.
   */
  public static areUnitsIdentical(unitA: string, unitB: string): boolean {
    const a = this.normalizeUnit(unitA);
    const b = this.normalizeUnit(unitB);
    if (a && b) return a.code === b.code;
    return String(unitA).trim().toLowerCase() === String(unitB).trim().toLowerCase();
  }

  /**
   * Standard direct mathematical conversion between units of the same category.
   * e.g. 250 Gram -> 0.250 KG
   */
  public static convertStandardDirect(qty: number, fromUnit: string, toUnit: string): ConversionResult {
    const fromDef = this.normalizeUnit(fromUnit);
    const toDef = this.normalizeUnit(toUnit);
    const numQty = Number(qty) || 0;

    if (!fromDef || !toDef) {
      const isIdent = String(fromUnit).trim().toLowerCase() === String(toUnit).trim().toLowerCase();
      if (isIdent) {
        return {
          success: true,
          fromQuantity: numQty,
          fromUnit,
          fromUnitNormalized: fromUnit,
          toQuantity: numQty,
          toUnit,
          toUnitNormalized: toUnit,
          factor: 1,
          costFactor: 1,
          isDirectSameCategory: true,
          ruleType: "identical",
          explanation: `1 ${fromUnit} = 1 ${toUnit}`
        };
      }
      return {
        success: false,
        fromQuantity: numQty,
        fromUnit,
        fromUnitNormalized: fromDef?.code || fromUnit,
        toQuantity: numQty,
        toUnit,
        toUnitNormalized: toDef?.code || toUnit,
        factor: 1,
        costFactor: 1,
        isDirectSameCategory: false,
        ruleType: "incompatible",
        explanation: `تعذر التعرف على وحدة القياس: [${fromUnit}] أو [${toUnit}]`,
        error: `وحدة قياس غير معروفة`
      };
    }

    if (fromDef.code === toDef.code) {
      return {
        success: true,
        fromQuantity: numQty,
        fromUnit,
        fromUnitNormalized: fromDef.code,
        toQuantity: numQty,
        toUnit,
        toUnitNormalized: toDef.code,
        factor: 1,
        costFactor: 1,
        category: fromDef.category,
        isDirectSameCategory: true,
        ruleType: "identical",
        explanation: `1 ${fromDef.nameAr} = 1 ${toDef.nameAr}`
      };
    }

    if (fromDef.category === toDef.category) {
      // Both in same category (e.g. Weight: gram -> kg)
      // factor = fromDef.factorToBase / toDef.factorToBase
      // e.g. g -> kg: 0.001 / 1 = 0.001
      // e.g. ton -> kg: 1000 / 1 = 1000
      // e.g. kg -> g: 1 / 0.001 = 1000
      const factor = fromDef.factorToBase / toDef.factorToBase;
      const convertedQty = Math.round(numQty * factor * 1000000) / 1000000;
      const costFactor = 1 / factor;

      return {
        success: true,
        fromQuantity: numQty,
        fromUnit,
        fromUnitNormalized: fromDef.code,
        toQuantity: convertedQty,
        toUnit,
        toUnitNormalized: toDef.code,
        factor,
        costFactor,
        category: fromDef.category,
        isDirectSameCategory: true,
        ruleType: "standard_category",
        explanation: `1 ${fromDef.nameAr} (${fromDef.symbolAr}) = ${factor} ${toDef.nameAr} (${toDef.symbolAr})`
      };
    }

    return {
      success: false,
      fromQuantity: numQty,
      fromUnit,
      fromUnitNormalized: fromDef.code,
      toQuantity: numQty,
      toUnit,
      toUnitNormalized: toDef.code,
      factor: 1,
      costFactor: 1,
      category: fromDef.category,
      isDirectSameCategory: false,
      ruleType: "incompatible",
      explanation: `لا يمكن التحويل المباشر بين فئة [${fromDef.category}] وفئة [${toDef.category}] دون تحديد معامل تحويل مخصص للصنف`,
      error: `فئات وحدات القياس غير متطابقة (${fromDef.nameAr} / ${toDef.nameAr})`
    };
  }

  /**
   * Enterprise Item-Aware Conversion Engine:
   * 1. Checks if identical units
   * 2. Checks standard category math (e.g. Gram -> KG)
   * 3. Checks item_uom_conversions table in DB for the specific ingredient/product
   * 4. Checks global uom_conversions table in DB
   * 5. Checks ingredient density if converting between volume and weight
   * 6. Returns exact converted quantity and pricing factor.
   */
  public static async convertItemQuantity(
    db: Pool | PoolClient,
    options: {
      ingredientId?: number | null;
      productId?: number | null;
      quantity: number;
      fromUnit: string;
      toUnit?: string;
      context?: "consumption" | "purchase" | "sales" | "recipe" | "inventory";
    }
  ): Promise<ConversionResult> {
    const { ingredientId, productId, quantity, fromUnit, context } = options;
    const numQty = Number(quantity) || 0;

    let targetToUnit = options.toUnit;
    let itemMaster: any = null;

    // 1. Fast path: Check if identical units before any DB query
    if (targetToUnit && this.areUnitsIdentical(fromUnit, targetToUnit)) {
      const fromDef = this.normalizeUnit(fromUnit);
      return {
        success: true,
        fromQuantity: numQty,
        fromUnit,
        fromUnitNormalized: fromDef?.code || fromUnit,
        toQuantity: numQty,
        toUnit: targetToUnit,
        toUnitNormalized: fromDef?.code || targetToUnit,
        factor: 1,
        costFactor: 1,
        category: fromDef?.category,
        isDirectSameCategory: true,
        ruleType: "identical",
        explanation: `1 ${fromUnit} = 1 ${targetToUnit}`
      };
    }

    // 2. Fast path: Standard category math (e.g. Gram -> KG) before DB query
    if (targetToUnit) {
      const stdResult = this.convertStandardDirect(numQty, fromUnit, targetToUnit);
      if (stdResult.success) {
        return stdResult;
      }
    }

    // 3. Fetch item master to determine base unit if toUnit was not provided
    if (ingredientId && !targetToUnit) {
      try {
        const ingRes = await db.query(
          "SELECT id, name, unit, cost, avg_cost, last_purchase_price FROM ingredients WHERE id = $1",
          [ingredientId]
        );
        if (ingRes.rows.length > 0) {
          itemMaster = ingRes.rows[0];
          targetToUnit = itemMaster.unit || "kg";
        }
      } catch (err) {
        console.warn("[UnitConversionService] Failed to load ingredient master:", err);
      }
    }

    if (!targetToUnit) {
      targetToUnit = fromUnit || "وحدة";
    }

    // Check again after targetToUnit resolution
    if (this.areUnitsIdentical(fromUnit, targetToUnit)) {
      const fromDef = this.normalizeUnit(fromUnit);
      return {
        success: true,
        fromQuantity: numQty,
        fromUnit,
        fromUnitNormalized: fromDef?.code || fromUnit,
        toQuantity: numQty,
        toUnit: targetToUnit,
        toUnitNormalized: fromDef?.code || targetToUnit,
        factor: 1,
        costFactor: 1,
        category: fromDef?.category,
        isDirectSameCategory: true,
        ruleType: "identical",
        explanation: `1 ${fromUnit} = 1 ${targetToUnit}`
      };
    }

    // Standard category math after targetToUnit resolution
    const stdResult = this.convertStandardDirect(numQty, fromUnit, targetToUnit);
    if (stdResult.success) {
      return stdResult;
    }

    // 4. Query item_uom_conversions for item-specific custom conversions
    // e.g. For "Milk" / "لبن": 1 Carton = 12 KG, or 1 Bottle = 1 Liter
    if (ingredientId) {
      try {
        const itemUomRes = await db.query(
          `SELECT * FROM item_uom_conversions WHERE ingredient_id = $1 ORDER BY id ASC`,
          [ingredientId]
        );

        for (const row of itemUomRes.rows) {
          const rowFrom = String(row.from_uom || "");
          const rowTo = String(row.to_uom || "");
          const rawFactor = Number(row.conversion_factor) || 1;
          const operator = String(row.operator || "multiply").toLowerCase();
          const factor = operator === "divide" ? (1 / rawFactor) : rawFactor;

          // Direct match: fromUnit -> toUnit
          if (this.areUnitsIdentical(fromUnit, rowFrom) && this.areUnitsIdentical(targetToUnit, rowTo)) {
            const convertedQty = Math.round(numQty * factor * 1000000) / 1000000;
            return {
              success: true,
              fromQuantity: numQty,
              fromUnit,
              fromUnitNormalized: this.normalizeUnit(fromUnit)?.code || fromUnit,
              toQuantity: convertedQty,
              toUnit: targetToUnit,
              toUnitNormalized: this.normalizeUnit(targetToUnit)?.code || targetToUnit,
              factor,
              costFactor: 1 / factor,
              isDirectSameCategory: false,
              ruleType: "item_specific",
              explanation: `معامل تحويل الصنف المخصص: 1 ${fromUnit} = ${factor} ${targetToUnit}`
            };
          }

          // Inverse match: toUnit -> fromUnit
          if (this.areUnitsIdentical(fromUnit, rowTo) && this.areUnitsIdentical(targetToUnit, rowFrom)) {
            const invFactor = 1 / factor;
            const convertedQty = Math.round(numQty * invFactor * 1000000) / 1000000;
            return {
              success: true,
              fromQuantity: numQty,
              fromUnit,
              fromUnitNormalized: this.normalizeUnit(fromUnit)?.code || fromUnit,
              toQuantity: convertedQty,
              toUnit: targetToUnit,
              toUnitNormalized: this.normalizeUnit(targetToUnit)?.code || targetToUnit,
              factor: invFactor,
              costFactor: factor,
              isDirectSameCategory: false,
              ruleType: "item_specific",
              explanation: `معامل تحويل الصنف العكسي: 1 ${fromUnit} = ${invFactor} ${targetToUnit}`
            };
          }

          // Intermediate bridge conversion: e.g. 1 Carton = 12 Liter, and target is ML
          // Convert fromUnit -> rowTo (via item rule), then rowTo -> targetToUnit (via standard category)
          if (this.areUnitsIdentical(fromUnit, rowFrom)) {
            const bridgeToTarget = this.convertStandardDirect(1, rowTo, targetToUnit);
            if (bridgeToTarget.success) {
              const totalFactor = factor * bridgeToTarget.factor;
              const convertedQty = Math.round(numQty * totalFactor * 1000000) / 1000000;
              return {
                success: true,
                fromQuantity: numQty,
                fromUnit,
                fromUnitNormalized: this.normalizeUnit(fromUnit)?.code || fromUnit,
                toQuantity: convertedQty,
                toUnit: targetToUnit,
                toUnitNormalized: this.normalizeUnit(targetToUnit)?.code || targetToUnit,
                factor: totalFactor,
                costFactor: 1 / totalFactor,
                isDirectSameCategory: false,
                ruleType: "item_specific",
                explanation: `تحويل مركب للصنف: 1 ${fromUnit} = ${factor} ${rowTo} = ${totalFactor} ${targetToUnit}`
              };
            }
          }
        }
      } catch (err) {
        console.warn("[UnitConversionService] Error reading item_uom_conversions:", err);
      }
    }

    // 5. Query global uom_conversions table
    try {
      const globalUomRes = await db.query(
        "SELECT * FROM uom_conversions ORDER BY id ASC"
      );
      for (const row of globalUomRes.rows) {
        const rowFrom = String(row.from_uom || "");
        const rowTo = String(row.to_uom || "");
        const factor = Number(row.value) || 1;

        if (this.areUnitsIdentical(fromUnit, rowFrom) && this.areUnitsIdentical(targetToUnit, rowTo)) {
          const convertedQty = Math.round(numQty * factor * 1000000) / 1000000;
          return {
            success: true,
            fromQuantity: numQty,
            fromUnit,
            fromUnitNormalized: this.normalizeUnit(fromUnit)?.code || fromUnit,
            toQuantity: convertedQty,
            toUnit: targetToUnit,
            toUnitNormalized: this.normalizeUnit(targetToUnit)?.code || targetToUnit,
            factor,
            costFactor: 1 / factor,
            isDirectSameCategory: false,
            ruleType: "global_conversion",
            explanation: `قاعدة التحويل العامة: 1 ${fromUnit} = ${factor} ${targetToUnit}`
          };
        }

        if (this.areUnitsIdentical(fromUnit, rowTo) && this.areUnitsIdentical(targetToUnit, rowFrom)) {
          const invFactor = 1 / factor;
          const convertedQty = Math.round(numQty * invFactor * 1000000) / 1000000;
          return {
            success: true,
            fromQuantity: numQty,
            fromUnit,
            fromUnitNormalized: this.normalizeUnit(fromUnit)?.code || fromUnit,
            toQuantity: convertedQty,
            toUnit: targetToUnit,
            toUnitNormalized: this.normalizeUnit(targetToUnit)?.code || targetToUnit,
            factor: invFactor,
            costFactor: factor,
            isDirectSameCategory: false,
            ruleType: "global_conversion",
            explanation: `قاعدة التحويل العامة العكسية: 1 ${fromUnit} = ${invFactor} ${targetToUnit}`
          };
        }
      }
    } catch (err) {
      console.warn("[UnitConversionService] Error reading uom_conversions:", err);
    }

    // 6. Check density if converting between volume and weight
    const fromDef = this.normalizeUnit(fromUnit);
    const toDef = this.normalizeUnit(targetToUnit);

    if (fromDef && toDef) {
      const isVolumeToWeight = fromDef.category === "volume" && toDef.category === "weight";
      const isWeightToVolume = fromDef.category === "weight" && toDef.category === "volume";

      if ((isVolumeToWeight || isWeightToVolume) && itemMaster) {
        const density = Number(itemMaster.density) || 1.0; // kg per liter (water/milk default ~ 1.0)
        if (density > 0) {
          // from volume (e.g. Liter) to weight (e.g. KG)
          if (isVolumeToWeight) {
            // 1. fromUnit -> Liter
            const toLiters = fromDef.factorToBase; // e.g. ml -> 0.001 liter
            // 2. Liter -> KG via density
            const toKg = toLiters * density;
            // 3. KG -> toUnit
            const finalFactor = toKg / toDef.factorToBase;
            const convertedQty = Math.round(numQty * finalFactor * 1000000) / 1000000;

            return {
              success: true,
              fromQuantity: numQty,
              fromUnit,
              fromUnitNormalized: fromDef.code,
              toQuantity: convertedQty,
              toUnit: targetToUnit,
              toUnitNormalized: toDef.code,
              factor: finalFactor,
              costFactor: 1 / finalFactor,
              isDirectSameCategory: false,
              ruleType: "density",
              explanation: `تحويل حجم إلى وزن بالاعتماد على الكثافة (${density} كجم/لتر): 1 ${fromUnit} = ${finalFactor} ${targetToUnit}`
            };
          } else {
            // weight to volume
            const toKg = fromDef.factorToBase;
            const toLiters = toKg / density;
            const finalFactor = toLiters / toDef.factorToBase;
            const convertedQty = Math.round(numQty * finalFactor * 1000000) / 1000000;

            return {
              success: true,
              fromQuantity: numQty,
              fromUnit,
              fromUnitNormalized: fromDef.code,
              toQuantity: convertedQty,
              toUnit: targetToUnit,
              toUnitNormalized: toDef.code,
              factor: finalFactor,
              costFactor: 1 / finalFactor,
              isDirectSameCategory: false,
              ruleType: "density",
              explanation: `تحويل وزن إلى حجم بالاعتماد على الكثافة (${density} كجم/لتر): 1 ${fromUnit} = ${finalFactor} ${targetToUnit}`
            };
          }
        }
      }
    }

    // 7. No path found
    return {
      success: false,
      fromQuantity: numQty,
      fromUnit,
      fromUnitNormalized: fromDef?.code || fromUnit,
      toQuantity: numQty,
      toUnit: targetToUnit,
      toUnitNormalized: toDef?.code || targetToUnit,
      factor: 1,
      costFactor: 1,
      category: fromDef?.category,
      isDirectSameCategory: false,
      ruleType: "incompatible",
      explanation: `لا يوجد معامل تحويل مسجل بين [${fromUnit}] و [${targetToUnit}] للصنف المحدد #${ingredientId || ''}`,
      error: `لا يمكن التحويل بين [${fromUnit}] و [${targetToUnit}]. يرجى إضافة معامل تحويل من بطاقة الصنف بالمستودع.`
    };
  }

  /**
   * Returns list of all compatible units for a specific item:
   * Base unit + all category units (if standard category) + any item-specific packaging units.
   */
  public static async getAvailableUnitsForItem(
    db: Pool | PoolClient,
    ingredientId: number
  ): Promise<Array<{
    code: string;
    nameAr: string;
    nameEn: string;
    symbolAr: string;
    category: UnitCategory;
    factorToBase: number;
    isBase: boolean;
    isItemSpecific?: boolean;
    isPurchaseDefault?: boolean;
    isSalesDefault?: boolean;
    isConsumptionDefault?: boolean;
  }>> {
    const list: any[] = [];
    let baseUnitStr = "kg";

    try {
      const ingRes = await db.query(
        "SELECT id, name, unit FROM ingredients WHERE id = $1",
        [ingredientId]
      );
      if (ingRes.rows.length > 0) {
        baseUnitStr = ingRes.rows[0].unit || "kg";
      }
    } catch (err) {
      console.warn("[UnitConversionService] getAvailableUnitsForItem error:", err);
    }

    const baseDef = this.normalizeUnit(baseUnitStr);
    const baseCategory = baseDef?.category || "weight";

    // 1. Add all standard units belonging to the item's category
    const categoryUnits = MASTER_UNITS.filter(u => u.category === baseCategory);
    categoryUnits.forEach(u => {
      const isBase = baseDef ? u.code === baseDef.code : u.code === "kg";
      // factor to item's base unit
      const baseFactor = baseDef ? baseDef.factorToBase : 1;
      const factorToItemBase = u.factorToBase / baseFactor;

      list.push({
        code: u.code,
        nameAr: u.nameAr,
        nameEn: u.nameEn,
        symbolAr: u.symbolAr,
        category: u.category,
        factorToBase: factorToItemBase,
        isBase,
        isItemSpecific: false
      });
    });

    // 2. Add custom item conversions from item_uom_conversions
    try {
      const customRes = await db.query(
        "SELECT * FROM item_uom_conversions WHERE ingredient_id = $1 ORDER BY id ASC",
        [ingredientId]
      );
      customRes.rows.forEach((row: any) => {
        const fromUom = String(row.from_uom || "");
        const rawFactor = Number(row.conversion_factor) || 1;
        const operator = String(row.operator || "multiply").toLowerCase();
        const factor = operator === "divide" ? (1 / rawFactor) : rawFactor;

        // check if already in list
        const existing = list.find(u => this.areUnitsIdentical(u.code, fromUom) || this.areUnitsIdentical(u.nameAr, fromUom));
        if (!existing) {
          const norm = this.normalizeUnit(fromUom);
          list.push({
            code: norm?.code || fromUom,
            nameAr: norm?.nameAr || fromUom,
            nameEn: norm?.nameEn || fromUom,
            symbolAr: norm?.symbolAr || fromUom,
            category: norm?.category || "count",
            factorToBase: factor,
            isBase: false,
            isItemSpecific: true,
            isPurchaseDefault: Boolean(row.is_purchase_default),
            isSalesDefault: Boolean(row.is_sales_default),
            isConsumptionDefault: Boolean(row.is_consumption_default)
          });
        }
      });
    } catch (err) {
      console.warn("[UnitConversionService] Error loading item_uom_conversions in getAvailableUnitsForItem:", err);
    }

    return list;
  }
}
