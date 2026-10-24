import { erpPool } from "../../../server-erp-core.js";
import { CreateEmployeeDTO, ClockInOutDTO } from "../dto/employee.dto.js";

export class EmployeeRepository {
  async getAll(): Promise<any[]> {
    const result = await erpPool.query("SELECT * FROM employees ORDER BY id ASC");
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    const result = await erpPool.query("SELECT * FROM employees WHERE id = $1", [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * BUG-ERP-012 / PHASE 4 + PHASE 18.
   *
   * The previous INSERT only wrote (name, role, phone, salary, branch_id):
   *   - `job_title`, `employee_code`, `company_id` were silently dropped even
   *     when the caller supplied them, so the HR list, employee_code driven
   *     exports and the company filter all showed blanks.
   *   - `basic_salary` was never written, while every HR/payroll query reads
   *     `basic_salary` (not `salary`), so the employee's payroll salary was 0.
   *
   * `basic_salary` is the canonical column; `salary` is kept mirrored so no
   * legacy reader can drift from the canonical value.
   */
  async create(dto: CreateEmployeeDTO): Promise<any> {
    const basicSalary = Number((dto as any).basic_salary ?? dto.salary ?? 0) || 0;
    const query = `
      INSERT INTO employees (
        name, role, job_title, employee_code, company_id,
        phone, email, national_id, branch_id, department_id,
        basic_salary, salary, hire_date, status
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $11, COALESCE($12::date, CURRENT_DATE), COALESCE($13, 'active')
      )
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      dto.name,
      dto.role || (dto as any).job_title || null,
      (dto as any).job_title || dto.role || null,
      (dto as any).employee_code || null,
      (dto as any).company_id ?? null,
      dto.phone || null,
      (dto as any).email || null,
      (dto as any).national_id || null,
      dto.branch_id ?? null,
      (dto as any).department_id ?? null,
      basicSalary,
      (dto as any).hire_date || null,
      (dto as any).status || null,
    ]);
    return result.rows[0];
  }

  /**
   * BUG-ERP-009 / PHASE 17.
   *
   * The previous statement was
   *     INSERT INTO attendance (employee_id, action_type, notes)
   * but `attendance.date` is NOT NULL, so every clock in/out failed with a
   * PostgreSQL not-null violation surfaced as HTTP 500.
   *
   * `attendance` also has a UNIQUE (employee_id, date) constraint, so the
   * correct business behaviour is:
   *   - clock IN  -> upsert today's row and stamp check_in/punch_time
   *   - clock OUT -> stamp check_out on today's row (never a second row)
   * A clock-in while a shift is still open is idempotent (it does not open a
   * second record); a clock-out with no open shift is rejected by the service.
   */
  async clockInOut(dto: ClockInOutDTO): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Lock today's row (if any) so concurrent punches cannot race the upsert.
      const existing = await client.query(
        `SELECT * FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE FOR UPDATE`,
        [dto.employee_id]
      );

      let row: any;

      if (existing.rows.length === 0) {
        // First punch of the day.
        const isIn = dto.type === "in";
        const ins = await client.query(
          `INSERT INTO attendance
             (employee_id, date, action_type, notes, status, punch_time, check_in, check_out, work_hours)
           VALUES ($1, CURRENT_DATE, $2, $3, 'present', NOW(),
                   CASE WHEN $4::boolean THEN NOW() ELSE NULL END,
                   CASE WHEN $4::boolean THEN NULL ELSE NOW() END,
                   0)
           RETURNING *`,
          [dto.employee_id, dto.type, dto.notes || null, isIn]
        );
        row = ins.rows[0];
      } else if (dto.type === "in") {
        // Already have a record for today. An "in" punch must never open a
        // second record (that is the illogical duplicate clock-in we must
        // prevent) — keep the original check_in and only refresh metadata.
        const upd = await client.query(
          `UPDATE attendance
              SET action_type = $2,
                  punch_time  = NOW(),
                  notes       = COALESCE($3, notes),
                  check_in    = COALESCE(check_in, NOW())
            WHERE id = $1
          RETURNING *`,
          [existing.rows[0].id, dto.type, dto.notes || null]
        );
        row = upd.rows[0];
      } else {
        // "out" punch — close today's shift and compute hours worked.
        const upd = await client.query(
          `UPDATE attendance
              SET action_type = $2,
                  punch_time  = NOW(),
                  notes       = COALESCE($3, notes),
                  check_in    = COALESCE(check_in, NOW()),
                  check_out   = NOW(),
                  work_hours  = GREATEST(0,
                                  EXTRACT(EPOCH FROM (NOW() - COALESCE(check_in, NOW()))) / 3600.0),
                  status      = 'present'
            WHERE id = $1
          RETURNING *`,
          [existing.rows[0].id, dto.type, dto.notes || null]
        );
        row = upd.rows[0];
      }

      await client.query("COMMIT");
      return row;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** True when the employee has an open (clocked-in, not clocked-out) shift today. */
  async hasOpenShiftToday(employeeId: number): Promise<boolean> {
    const { rows } = await erpPool.query(
      `SELECT 1 FROM attendance
        WHERE employee_id = $1 AND date = CURRENT_DATE
          AND check_in IS NOT NULL AND check_out IS NULL
        LIMIT 1`,
      [employeeId]
    );
    return rows.length > 0;
  }
}
