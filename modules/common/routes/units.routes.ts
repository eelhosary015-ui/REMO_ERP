import { Router, Request, Response } from "express";
import { UnitConversionService, MASTER_UNITS } from "../services/unit_conversion.service.js";
import { pool } from "../../../server-db.js";

const router = Router();

// GET all master units
router.get("/api/v2/units", async (_req: Request, res: Response) => {
  try {
    let customUnits: any[] = [];
    try {
      const customRes = await pool.query("SELECT * FROM units ORDER BY category, name ASC");
      customUnits = customRes.rows;
    } catch (e) {
      // Table might not exist yet
    }

    res.json({
      success: true,
      standardUnits: MASTER_UNITS,
      customUnits,
      allUnits: [
        ...MASTER_UNITS.map(u => ({
          code: u.code,
          name: u.nameAr,
          nameEn: u.nameEn,
          symbol: u.symbolAr,
          symbolEn: u.symbolEn,
          category: u.category,
          baseUnit: u.baseUnit,
          factorToBase: u.factorToBase,
          isStandard: true
        })),
        ...customUnits.map(u => ({
          code: u.code || u.name,
          name: u.name,
          nameEn: u.name_en || u.name,
          symbol: u.symbol || u.name,
          symbolEn: u.symbol_en || u.name,
          category: u.category || "count",
          baseUnit: u.base_unit || "piece",
          factorToBase: Number(u.factor_to_base || 1),
          isStandard: false
        }))
      ]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add a custom unit
router.post("/api/v2/units", async (req: Request, res: Response) => {
  try {
    const { name, name_en, symbol, symbol_en, category, base_unit, factor_to_base } = req.body;
    if (!name || !category) {
      return res.status(400).json({ success: false, error: "اسم الوحدة والفئة مطلوبان" });
    }

    const code = (name_en || name).toLowerCase().replace(/\s+/g, "_");
    const result = await pool.query(`
      INSERT INTO units (code, name, name_en, symbol, symbol_en, category, base_unit, factor_to_base)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        name_en = EXCLUDED.name_en,
        symbol = EXCLUDED.symbol,
        symbol_en = EXCLUDED.symbol_en,
        category = EXCLUDED.category,
        base_unit = EXCLUDED.base_unit,
        factor_to_base = EXCLUDED.factor_to_base
      RETURNING *
    `, [
      code, name, name_en || name, symbol || name, symbol_en || name_en || name,
      category, base_unit || "piece", Number(factor_to_base || 1)
    ]);

    res.json({ success: true, unit: result.rows[0], message: "تمت إضافة وحدة القياس بنجاح" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET compatible units for a specific item
router.get("/api/v2/units/item-available-units/:ingredientId", async (req: Request, res: Response) => {
  try {
    const ingredientId = Number(req.params.ingredientId);
    if (!ingredientId) {
      return res.status(400).json({ success: false, error: "رقم الصنف غير صحيح" });
    }
    const units = await UnitConversionService.getAvailableUnitsForItem(pool, ingredientId);
    res.json({ success: true, ingredientId, units });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET calculate conversion
router.get("/api/v2/units/convert", async (req: Request, res: Response) => {
  try {
    const ingredientId = req.query.ingredient_id ? Number(req.query.ingredient_id) : undefined;
    const quantity = Number(req.query.quantity) || 1;
    const fromUnit = String(req.query.from_unit || "");
    const toUnit = req.query.to_unit ? String(req.query.to_unit) : undefined;

    if (!fromUnit) {
      return res.status(400).json({ success: false, error: "الوحدة الأصلية مطلوبة" });
    }

    const result = await UnitConversionService.convertItemQuantity(pool, {
      ingredientId,
      quantity,
      fromUnit,
      toUnit
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
