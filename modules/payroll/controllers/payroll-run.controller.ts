import { Request, Response } from "express";
import { PayrollRunError, payrollRunService } from "../services/payroll-run.service.js";

/**
 * نقاط النهاية الخاصة بمسير المرتبات:
 *  - إقفال المسير (قيد استحقاق) بلا أي حركة خزينة.
 *  - صرف المرتبات من الخزينة/البنك مع سند صرف وحركة خزينة وقيد مرتبط.
 */
export class PayrollRunController {
  private readonly service = payrollRunService;

  private handleError(res: Response, error: any) {
    if (error instanceof PayrollRunError) {
      res.status(error.status).json({ success: false, error: error.message, code: error.code });
      return;
    }
    console.error("[PayrollRun] unexpected error:", error?.message || error);
    res.status(500).json({ success: false, error: error?.message || "فشل تنفيذ عملية مسير المرتبات" });
  }

  private idempotencyKey(req: Request): string | null {
    const header = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
    const value = Array.isArray(header) ? header[0] : header;
    return value ? String(value) : null;
  }

  private periodFrom(req: Request): { year: number; month: number; branchId: number | null; departmentId: number | null } {
    const source: any = { ...req.query, ...req.body };
    const year = Number(source.year);
    const month = Number(source.month);
    const branchValue = source.branch_id ?? source.branch ?? null;
    const departmentValue = source.department_id ?? source.department ?? null;
    const parseNullableId = (value: any): number | null => {
      if (value === null || value === undefined || value === "" || value === "all") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    return {
      year,
      month,
      branchId: parseNullableId(branchValue),
      departmentId: parseNullableId(departmentValue),
    };
  }

  /** GET /runs — قائمة مسيرات المرتبات مع حالتها المالية. */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const period = this.periodFrom(req);
      const runs = await this.service.listRuns({
        year: Number.isFinite(period.year) && period.year > 0 ? period.year : undefined,
        month: Number.isFinite(period.month) && period.month > 0 ? period.month : undefined,
        branchId: period.branchId,
        departmentId: period.departmentId,
      });
      res.status(200).json({ success: true, data: runs });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** GET /runs/period-status — حالة مسير الشهر المحدد (تُستخدم في الواجهة). */
  periodStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const period = this.periodFrom(req);
      const status = await this.service.getPeriodStatus(period);
      res.status(200).json({ success: true, data: status });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /**
   * GET /runs/disbursement-report — تقرير صرف المرتبات الشهري:
   * صف لكل موظف (المستحق والمصروف) + سندات الصرف + إجماليات الشهر.
   */
  disbursementReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const source: any = { ...req.query };
      const treasuryAccountId = Number(source.treasury_account_id ?? source.treasuryAccountId ?? source.account_id);
      const report = await this.service.getMonthlyDisbursementReport({
        year: Number(source.year),
        month: Number(source.month),
        branchId: source.branch_id ? Number(source.branch_id) : null,
        departmentId: source.department_id ? Number(source.department_id) : null,
        treasuryAccountId: Number.isFinite(treasuryAccountId) && treasuryAccountId > 0 ? treasuryAccountId : null,
      });
      res.status(200).json({ success: true, data: report });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** GET /runs/:id — تفاصيل المسير: الإجماليات وما تم صرفه والمتبقي والسندات والقيود. */
  getOne = async (req: Request, res: Response): Promise<void> => {
    try {
      const runId = Number(req.params.id);
      if (!Number.isInteger(runId) || runId <= 0) {
        res.status(400).json({ success: false, error: "معرف المسير غير صحيح" });
        return;
      }
      const run = await this.service.getRunStatus(runId);
      res.status(200).json({ success: true, data: run });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** POST /runs/draft — حساب/تحديث مسودة مسير الشهر من بيانات النظام الفعلية. */
  buildDraft = async (req: Request, res: Response): Promise<void> => {
    try {
      const period = this.periodFrom(req);
      const run = await this.service.buildDraft(period, (req as any).user);
      res.status(200).json({ success: true, data: run });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** POST /runs/:id/close — إقفال المسير: قيد استحقاق بلا أي صرف من الخزينة. */
  close = async (req: Request, res: Response): Promise<void> => {
    try {
      const runId = Number(req.params.id);
      const run = await this.service.closeRun(runId, (req as any).user, {
        idempotencyKey: this.idempotencyKey(req),
      });
      res.status(200).json({ success: true, data: run });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** POST /runs/:id/pay — صرف المرتبات من الخزينة أو البنك (كامل أو جزئي). */
  pay = async (req: Request, res: Response): Promise<void> => {
    try {
      const runId = Number(req.params.id);
      const body: any = req.body || {};
      const run = await this.service.payRun(
        runId,
        {
          amount: body.amount === undefined || body.amount === null || body.amount === "" ? undefined : Number(body.amount),
          treasuryAccountId: body.treasury_account_id ? Number(body.treasury_account_id) : null,
          paymentSource: body.payment_source,
          paymentDate: body.payment_date,
          referenceNumber: body.reference_number,
          paymentMethod: body.payment_method,
          notes: body.notes,
        },
        (req as any).user,
        { idempotencyKey: this.idempotencyKey(req) },
      );
      res.status(200).json({ success: true, data: run });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** POST /runs/:id/reverse — عكس قيد الاستحقاق (قبل أي صرف). */
  reverseAccrual = async (req: Request, res: Response): Promise<void> => {
    try {
      const runId = Number(req.params.id);
      const run = await this.service.reverseAccrual(runId, (req as any).user);
      res.status(200).json({ success: true, data: run });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  /** POST /runs/:id/payments/:paymentId/reverse — عكس سند صرف وإرجاع الرصيد للخزينة. */
  reversePayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const runId = Number(req.params.id);
      const paymentId = Number(req.params.paymentId);
      const run = await this.service.reversePayment(runId, paymentId, (req as any).user);
      res.status(200).json({ success: true, data: run });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };
}
