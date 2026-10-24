import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════════════
// Enterprise Validators
// Request validation for all enterprise endpoints
// ═══════════════════════════════════════════════════════════════

interface ValidationError {
  field: string;
  message: string;
}

export class ValidationErrorBuilder {
  private errors: ValidationError[] = [];

  required(data: any, field: string, label?: string): this {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      this.errors.push({ field, message: `${label || field} مطلوب` });
    }
    return this;
  }

  string(data: any, field: string, label?: string): this {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      this.errors.push({ field, message: `${label || field} يجب أن يكون نص` });
    }
    return this;
  }

  number(data: any, field: string, label?: string): this {
    if (data[field] !== undefined && (isNaN(Number(data[field])) || data[field] === '')) {
      this.errors.push({ field, message: `${label || field} يجب أن يكون رقم` });
    }
    return this;
  }

  positiveNumber(data: any, field: string, label?: string): this {
    if (data[field] !== undefined && Number(data[field]) < 0) {
      this.errors.push({ field, message: `${label || field} يجب أن يكون رقم موجب` });
    }
    return this;
  }

  minNumber(data: any, field: string, min: number, label?: string): this {
    if (data[field] !== undefined && Number(data[field]) < min) {
      this.errors.push({ field, message: `${label || field} يجب أن يكون على الأقل ${min}` });
    }
    return this;
  }

  maxLength(data: any, field: string, max: number, label?: string): this {
    if (data[field] && String(data[field]).length > max) {
      this.errors.push({ field, message: `${label || field} يجب ألا يتجاوز ${max} حرف` });
    }
    return this;
  }

  email(data: any, field: string): this {
    if (data[field] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[field])) {
      this.errors.push({ field, message: 'بريد إلكتروني غير صالح' });
    }
    return this;
  }

  inArray(data: any, field: string, allowed: string[], label?: string): this {
    if (data[field] !== undefined && !allowed.includes(data[field])) {
      this.errors.push({ field, message: `${label || field} يجب أن يكون أحد: ${allowed.join(', ')}` });
    }
    return this;
  }

  array(data: any, field: string, label?: string): this {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      this.errors.push({ field, message: `${label || field} يجب أن يكون مصفوفة` });
    }
    return this;
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get errorList(): ValidationError[] {
    return this.errors;
  }

  build(): ValidationError[] {
    return this.errors;
  }
}

function sendValidationError(res: Response, errors: ValidationError[]): void {
  res.status(400).json({ error: 'VALIDATION_ERROR', message: 'خطأ في البيانات المدخلة', details: errors });
}

// ─── Company Validators ───
export function validateCreateCompany(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'code', 'كود الشركة').maxLength(req.body, 'code', 50);
  v.required(req.body, 'name_ar', 'اسم الشركة بالعربي').maxLength(req.body, 'name_ar', 200);
  v.maxLength(req.body, 'name_en', 200);
  v.email(req.body, 'email');
  v.maxLength(req.body, 'tax_number', 100);
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Role Validators ───
export function validateCreateRole(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'name', 'اسم الدور').maxLength(req.body, 'name', 100);
  v.maxLength(req.body, 'name_ar', 100);
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

export function validateUpdateRolePermissions(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.array(req.body, 'permissions', 'الصلاحيات');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Batch Validators ───
export function validateCreateBatch(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'ingredient_id', 'المادة').number(req.body, 'ingredient_id');
  v.required(req.body, 'warehouse_id', 'المستودع').number(req.body, 'warehouse_id');
  v.required(req.body, 'batch_number', 'رقم التشغيلة');
  v.required(req.body, 'quantity', 'الكمية').number(req.body, 'quantity').positiveNumber(req.body, 'quantity');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Reordering Rule Validators ───
export function validateCreateReorderingRule(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'ingredient_id', 'المادة').number(req.body, 'ingredient_id');
  v.required(req.body, 'warehouse_id', 'المستودع').number(req.body, 'warehouse_id');
  v.required(req.body, 'reorder_point', 'نقطة إعادة الطلب').number(req.body, 'reorder_point').minNumber(req.body, 'reorder_point', 0);
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── BOM Validators ───
export function validateCreateBOM(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.array(req.body, 'items', 'عناصر BOM');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  const items = req.body.items || [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i].ingredient_id) {
      sendValidationError(res, [{ field: `items[${i}].ingredient_id`, message: 'المادة مطلوبة' }]);
      return;
    }
    if (!items[i].quantity || Number(items[i].quantity) <= 0) {
      sendValidationError(res, [{ field: `items[${i}].quantity`, message: 'الكمية يجب أن تكون أكبر من صفر' }]);
      return;
    }
  }
  next();
}

// ─── Work Center Validators ───
export function validateCreateWorkCenter(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'code', 'الكود').maxLength(req.body, 'code', 50);
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Manufacturing Order Validators ───
export function validateCreateMO(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'quantity_planned', 'الكمية المخططة').number(req.body, 'quantity_planned').minNumber(req.body, 'quantity_planned', 1);
  v.inArray(req.body, 'priority', ['low', 'normal', 'high', 'urgent'], 'الأولوية');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

export function validateUpdateMOStatus(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'status', 'الحالة');
  v.inArray(req.body, 'status', ['planned', 'in_progress', 'completed', 'cancelled', 'on_hold'], 'الحالة');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Quality Check Validators ───
export function validateCreateQualityCheck(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'total_checked', 'الإجمالي المفحوص').number(req.body, 'total_checked').minNumber(req.body, 'total_checked', 0);
  v.required(req.body, 'passed', 'المقبول').number(req.body, 'passed').minNumber(req.body, 'passed', 0);
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Asset Validators ───
export function validateCreateAsset(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'asset_code', 'كود الأصل').maxLength(req.body, 'asset_code', 50);
  v.required(req.body, 'name', 'اسم الأصل').maxLength(req.body, 'name', 200);
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Maintenance Request Validators ───
export function validateCreateMaintenanceRequest(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'asset_id', 'الأصل').number(req.body, 'asset_id');
  v.required(req.body, 'description', 'الوصف');
  v.inArray(req.body, 'priority', ['low', 'normal', 'high', 'urgent'], 'الأولوية');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Work Order Validators ───
export function validateCreateWorkOrder(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'asset_id', 'الأصل').number(req.body, 'asset_id');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Lead Validators ───
export function validateCreateLead(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'name', 'الاسم').maxLength(req.body, 'name', 200);
  v.email(req.body, 'email');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Quotation Validators ───
export function validateCreateQuotation(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.array(req.body, 'items', 'العناصر');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  const items = req.body.items || [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i].item_name) {
      sendValidationError(res, [{ field: `items[${i}].item_name`, message: 'اسم الصنف مطلوب' }]);
      return;
    }
    if (items[i].quantity === undefined || Number(items[i].quantity) <= 0) {
      sendValidationError(res, [{ field: `items[${i}].quantity`, message: 'الكمية مطلوبة' }]);
      return;
    }
  }
  next();
}

// ─── Waste Validators ───
export function validateCreateWaste(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'quantity', 'الكمية').number(req.body, 'quantity').positiveNumber(req.body, 'quantity');
  v.inArray(req.body, 'waste_type', ['spoilage', 'breakage', 'overcooking', 'waste', 'theft', 'other'], 'نوع الهدر');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}

// ─── Recipe Validators ───
export function validateCreateRecipe(req: Request, res: Response, next: NextFunction) {
  const v = new ValidationErrorBuilder();
  v.required(req.body, 'name', 'الاسم').maxLength(req.body, 'name', 200);
  v.array(req.body, 'items', 'المكونات');
  if (v.hasErrors) { sendValidationError(res, v.build()); return; }
  next();
}