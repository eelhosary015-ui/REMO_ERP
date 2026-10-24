import { erpPool } from "../../../server-erp-core.js";
import { CreateCustomerDTO, RecordCustomerTransactionDTO } from "../dto/customer.dto.js";

export class CustomerRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTablesExists();
  }

  private async ensureTablesExists(): Promise<void> {
    if (CustomerRepository.tablesEnsured) return;
    if (CustomerRepository.ensurePromise) return CustomerRepository.ensurePromise;

    const custDdl = `
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(100),
        address TEXT,
        balance DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const transDdl = `
      CREATE TABLE IF NOT EXISTS customer_transactions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'payment' (credit) or 'charge' (debit)
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    CustomerRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(custDdl);
        await erpPool.query(transDdl);
        CustomerRepository.tablesEnsured = true;
      } catch (err: any) {
        // Warning logged via pool error handler if needed
      } finally {
        CustomerRepository.ensurePromise = null;
      }
    })();
    return CustomerRepository.ensurePromise;
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExists();
    const result = await erpPool.query("SELECT * FROM customers ORDER BY name ASC");
    return result.rows;
  }

  async create(cust: CreateCustomerDTO): Promise<any> {
    await this.ensureTablesExists();
    const query = `
      INSERT INTO customers (name, phone, email, address)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, address = EXCLUDED.address
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      cust.name,
      cust.phone,
      cust.email || null,
      cust.address || null
    ]);
    return result.rows[0];
  }

  async recordTransaction(tx: RecordCustomerTransactionDTO): Promise<any> {
    await this.ensureTablesExists();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Canonical ledger contract (PHASE 16/18): 'invoice' = debit (customer owes
      // more), 'payment' = credit. The legacy 'charge' alias is mapped onto the
      // canonical 'invoice' type so both entry points share one contract.
      const canonicalType = tx.type === "charge" ? "invoice" : tx.type;
      const res = await client.query(
        `INSERT INTO customer_transactions (customer_id, amount, type, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tx.customer_id, tx.amount, canonicalType, tx.notes || null]
      );

      // PHASE 20: the customer receivable is derived from this ledger; there is
      // no `customers.balance` column to update (the old UPDATE threw
      // "column balance does not exist").

      await client.query("COMMIT");
      return res.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getTransactions(customerId: number): Promise<any[]> {
    await this.ensureTablesExists();
    const result = await erpPool.query(
      "SELECT * FROM customer_transactions WHERE customer_id = $1 ORDER BY created_at DESC",
      [customerId]
    );
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    await this.ensureTablesExists();
    const result = await erpPool.query("SELECT * FROM customers WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async update(id: number, cust: Partial<CreateCustomerDTO>): Promise<any> {
    await this.ensureTablesExists();
    const result = await erpPool.query(
      "UPDATE customers SET name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email), address = COALESCE($4, address) WHERE id = $5 RETURNING *",
      [cust.name, cust.phone, cust.email, cust.address, id]
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    await this.ensureTablesExists();
    const result = await erpPool.query("DELETE FROM customers WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
