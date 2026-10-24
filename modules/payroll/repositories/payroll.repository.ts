import { erpPool } from "../../../server-erp-core.js";
import { CreateAdvanceDTO, CalculatePayrollDTO } from "../dto/payroll.dto.js";

export class PayrollRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTablesExists();
  }

  private async ensureTablesExists(): Promise<void> {
    if (PayrollRepository.tablesEnsured) return;
    if (PayrollRepository.ensurePromise) return PayrollRepository.ensurePromise;

    const advancesDdl = `
      CREATE TABLE IF NOT EXISTS employee_advances (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        notes TEXT,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const payrollDdl = `
      CREATE TABLE IF NOT EXISTS payroll_records (
        id SERIAL PRIMARY KEY,
        month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
        employee_id INTEGER NOT NULL,
        basic_salary DECIMAL(10,2) NOT NULL,
        bonuses DECIMAL(10,2) DEFAULT 0,
        deductions DECIMAL(10,2) DEFAULT 0,
        advances DECIMAL(10,2) DEFAULT 0,
        net_salary DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'unpaid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    PayrollRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(advancesDdl);
        await erpPool.query(payrollDdl);
        PayrollRepository.tablesEnsured = true;
      } catch (err: any) {
        // Handled via pool
      } finally {
        PayrollRepository.ensurePromise = null;
      }
    })();
    return PayrollRepository.ensurePromise;
  }

  async getAdvances(): Promise<any[]> {
    await this.ensureTablesExists();
    const result = await erpPool.query(`
      SELECT a.*, e.name as employee_name
      FROM employee_advances a
      LEFT JOIN employees e ON a.employee_id = e.id
      ORDER BY a.date DESC
    `);
    return result.rows;
  }

  async createAdvance(adv: CreateAdvanceDTO): Promise<any> {
    await this.ensureTablesExists();
    const query = `
      INSERT INTO employee_advances (employee_id, amount, notes, date)
      VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE))
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      adv.employee_id,
      adv.amount,
      adv.notes || null,
      adv.date || null
    ]);
    return result.rows[0];
  }

  async getPayrollForMonth(month: string): Promise<any[]> {
    await this.ensureTablesExists();
    const result = await erpPool.query(`
      SELECT p.*, e.name as employee_name, e.role as employee_role
      FROM payroll_records p
      LEFT JOIN employees e ON p.employee_id = e.id
      WHERE p.month = $1
    `, [month]);
    return result.rows;
  }

  async generatePayrollForMonth(month: string): Promise<void> {
    await this.ensureTablesExists();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // 1. Clear existing unpaid ones for safety
      await client.query("DELETE FROM payroll_records WHERE month = $1 AND status = 'unpaid'", [month]);

      // 2. Fetch all active employees
      const employeesRes = await client.query("SELECT id, name, basic_salary FROM employees");
      const employees = employeesRes.rows;

      for (const emp of employees) {
        const salary = Number(emp.basic_salary || 0);

        // Fetch advances
        const advRes = await client.query(
          "SELECT COALESCE(SUM(amount), 0) as total FROM employee_advances WHERE employee_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2",
          [emp.id, month]
        );
        const adv = Number(advRes.rows[0].total || 0);

        // Fetch custom allowances/bonuses
        const bonusRes = await client.query(
          "SELECT COALESCE(SUM(amount), 0) as total FROM employee_bonuses WHERE employee_id = $1 AND month = $2",
          [emp.id, month]
        );
        const bonus = Number(bonusRes.rows[0]?.total || 0);

        // Fetch custom deductions (penalties, etc)
        const dedRes = await client.query(
          "SELECT COALESCE(SUM(amount), 0) as total FROM employee_deductions WHERE employee_id = $1 AND month = $2",
          [emp.id, month]
        );
        const ded = Number(dedRes.rows[0]?.total || 0);

        const net = salary + bonus - ded - adv;

        await client.query(
          `INSERT INTO payroll_records (month, employee_id, basic_salary, bonuses, deductions, advances, net_salary)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [month, emp.id, salary, bonus, ded, adv, net]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
