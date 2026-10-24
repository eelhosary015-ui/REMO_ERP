import { pool } from '../../../server-db.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Database Migration System
// Organized, versioned migrations instead of ad-hoc schema changes
// ═══════════════════════════════════════════════════════════════

export interface Migration {
  version: string;           // e.g. "001", "002", or timestamp-based "20240101_001"
  name: string;              // Human-readable description
  module: string;            // Which module this migration belongs to
  type: 'schema' | 'data' | 'index' | 'permission' | 'seed';
  up: (client: any) => Promise<void>;
  down?: (client: any) => Promise<void>;  // Rollback (optional)
}

// Track which migrations have been applied
const MIGRATION_TABLE = `
  CREATE TABLE IF NOT EXISTS _enterprise_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    module VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'schema',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'success',
    checksum VARCHAR(64)
  );
  CREATE INDEX IF NOT EXISTS idx_migrations_version ON _enterprise_migrations(version);
  CREATE INDEX IF NOT EXISTS idx_migrations_module ON _enterprise_migrations(module);
`;

class MigrationRunner {
  private migrations: Migration[] = [];

  register(migration: Migration): void {
    // Check for duplicate version
    if (this.migrations.some(m => m.version === migration.version)) {
      throw new Error(`Migration version "${migration.version}" is already registered`);
    }
    this.migrations.push(migration);
  }

  registerAll(migrations: Migration[]): void {
    for (const m of migrations) {
      this.register(m);
    }
  }

  async ensureMigrationTable(): Promise<void> {
    await pool.query(MIGRATION_TABLE);
  }

  async getAppliedVersions(): Promise<Set<string>> {
    const { rows } = await pool.query('SELECT version FROM _enterprise_migrations WHERE status = $1', ['success']);
    return new Set(rows.map((r: any) => r.version));
  }

  async runAll(): Promise<{ applied: string[]; skipped: string[]; errors: Array<{ version: string; error: string }> }> {
    await this.ensureMigrationTable();
    const applied = await this.getAppliedVersions();

    const result: { applied: string[]; skipped: string[]; errors: Array<{ version: string; error: string }> } = {
      applied: [],
      skipped: [],
      errors: [],
    };

    // Sort migrations by version
    const sorted = [...this.migrations].sort((a, b) => a.version.localeCompare(b.version));

    for (const migration of sorted) {
      if (applied.has(migration.version)) {
        result.skipped.push(migration.version);
        continue;
      }

      const startTime = Date.now();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await migration.up(client);
        const executionTime = Date.now() - startTime;
        await client.query(
          `INSERT INTO _enterprise_migrations (version, name, module, type, execution_time_ms, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (version) DO UPDATE SET
             name = EXCLUDED.name,
             module = EXCLUDED.module,
             type = EXCLUDED.type,
             execution_time_ms = EXCLUDED.execution_time_ms,
             status = EXCLUDED.status,
             applied_at = CURRENT_TIMESTAMP`,
          [migration.version, migration.name, migration.module, migration.type, executionTime, 'success']
        );
        await client.query('COMMIT');
        result.applied.push(migration.version);
        console.log(`  ✅ Migration ${migration.version} [${migration.module}] "${migration.name}" applied (${executionTime}ms)`);
      } catch (error: any) {
        await client.query('ROLLBACK');
        const executionTime = Date.now() - startTime;
        await pool.query(
          `INSERT INTO _enterprise_migrations (version, name, module, type, execution_time_ms, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (version) DO UPDATE SET
             name = EXCLUDED.name,
             module = EXCLUDED.module,
             type = EXCLUDED.type,
             execution_time_ms = EXCLUDED.execution_time_ms,
             status = EXCLUDED.status,
             applied_at = CURRENT_TIMESTAMP`,
          [migration.version, migration.name, migration.module, migration.type, executionTime, 'failed']
        ).catch(() => {});
        result.errors.push({ version: migration.version, error: error.message });
        console.error(`  ❌ Migration ${migration.version} FAILED:`, error.message);
      } finally {
        client.release();
      }
    }

    return result;
  }

  async rollback(version: string): Promise<boolean> {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) throw new Error(`Migration "${version}" not found`);
    if (!migration.down) throw new Error(`Migration "${version}" does not have a rollback`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await migration.down(client);
      await client.query("DELETE FROM _enterprise_migrations WHERE version = $1", [version]);
      await client.query('COMMIT');
      console.log(`  ⏪ Rolled back migration ${version}`);
      return true;
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStatus(): Promise<{ total: number; applied: number; pending: number; list: Array<{ version: string; name: string; module: string; applied: boolean }> }> {
    await this.ensureMigrationTable();
    const applied = await this.getAppliedVersions();
    const list = this.migrations.map(m => ({
      version: m.version,
      name: m.name,
      module: m.module,
      applied: applied.has(m.version),
    }));
    return {
      total: this.migrations.length,
      applied: applied.size,
      pending: this.migrations.length - applied.size,
      list,
    };
  }
}

// Singleton instance
export const migrationRunner = new MigrationRunner();

// ═══════════════════════════════════════════════════════════════
// Enterprise Migrations Registry
// All enterprise migrations are registered here
// ═══════════════════════════════════════════════════════════════

export function registerEnterpriseMigrations(): void {
  // ── Migration 001: Add company_id to core tables ──
  migrationRunner.register({
    version: 'ENT_001',
    name: 'Add company_id and branch_id to core tables',
    module: 'enterprise',
    type: 'schema',
    up: async (client) => {
      const tables = [
        { table: 'customers', has_branch: false },
        { table: 'suppliers', has_branch: false },
        { table: 'ingredients', has_branch: true },
        { table: 'products', has_branch: true },
        { table: 'categories', has_branch: true },
        { table: 'orders', has_branch: true },
        { table: 'sales_orders', has_branch: true },
        { table: 'purchase_orders', has_branch: true },
        { table: 'purchases', has_branch: true },
        { table: 'inventory_items', has_branch: true },
        { table: 'inventory_transactions', has_branch: true },
        { table: 'journal_entries', has_branch: true },
        { table: 'warehouses', has_branch: true },
        { table: 'employees', has_branch: true },
        { table: 'manufacturing_orders', has_branch: true },
        { table: 'work_centers', has_branch: true },
        { table: 'maintenance_assets', has_branch: true },
        { table: 'maintenance_requests', has_branch: true },
        { table: 'maintenance_work_orders', has_branch: true },
        { table: 'preventive_maintenance', has_branch: false },
        { table: 'crm_leads', has_branch: true },
        { table: 'crm_opportunities', has_branch: true },
        { table: 'crm_quotations', has_branch: true },
        { table: 'recipes', has_branch: true },
        { table: 'waste_records', has_branch: true },
        { table: 'safes', has_branch: true },
        { table: 'treasury_accounts', has_branch: true },
        { table: 'treasury_transactions', has_branch: true },
        { table: 'batch_tracking', has_branch: true },
        { table: 'reordering_rules', has_branch: true },
        { table: 'production_boms', has_branch: true },
      ];

      for (const t of tables) {
        // Add company_id column
        await client.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${t.table}' AND column_name = 'company_id') THEN
              ALTER TABLE ${t.table} ADD COLUMN company_id INTEGER REFERENCES companies(id);
            END IF;
          END $$;
        `);
      }

      for (const t of tables) {
        if (t.has_branch) {
          await client.query(`
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${t.table}' AND column_name = 'branch_id') THEN
                ALTER TABLE ${t.table} ADD COLUMN branch_id INTEGER REFERENCES branches(id);
              END IF;
            END $$;
          `);
        }
      }
    },
  });

  // ── Migration 002: Add company_id to users table ──
  migrationRunner.register({
    version: 'ENT_002',
    name: 'Add company_id to users table and JWT payload',
    module: 'enterprise',
    type: 'schema',
    up: async (client) => {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'company_id') THEN
            ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id);
          END IF;
        END $$;
      `);
    },
  });

  // ── Migration 003: Create permission actions table ──
  migrationRunner.register({
    version: 'ENT_003',
    name: 'Create enhanced permission structure (module-action level)',
    module: 'enterprise',
    type: 'schema',
    up: async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS permission_modules (
          id SERIAL PRIMARY KEY,
          module_key VARCHAR(100) NOT NULL UNIQUE,
          name_ar VARCHAR(200) NOT NULL,
          name_en VARCHAR(200),
          category VARCHAR(50),
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS permission_actions (
          id SERIAL PRIMARY KEY,
          module_id INTEGER REFERENCES permission_modules(id) ON DELETE CASCADE,
          action_key VARCHAR(50) NOT NULL,
          name_ar VARCHAR(100) NOT NULL,
          name_en VARCHAR(100),
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          UNIQUE(module_id, action_key)
        );

        CREATE INDEX IF NOT EXISTS idx_perm_modules_key ON permission_modules(module_key);
        CREATE INDEX IF NOT EXISTS idx_perm_actions_module ON permission_actions(module_id);
      `);
    },
  });

  // ── Migration 004: Add indexes for multi-company performance ──
  migrationRunner.register({
    version: 'ENT_004',
    name: 'Add composite indexes for company/branch filtering performance',
    module: 'enterprise',
    type: 'index',
    up: async (client) => {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_orders_company_branch ON orders(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_products_company_branch ON products(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_ingredients_company_branch ON ingredients(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_inventory_company_branch ON inventory_items(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_journal_company_branch ON journal_entries(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_purchases_company_branch ON purchase_orders(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_sales_company_branch ON sales_orders(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_mo_company_branch ON manufacturing_orders(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_employees_company_branch ON employees(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_warehouses_company ON warehouses(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_safes_company_branch ON safes(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_treasury_company_branch ON treasury_accounts(company_id, branch_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_user ON enterprise_audit_log(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_table ON enterprise_audit_log(table_name)',
        'CREATE INDEX IF NOT EXISTS idx_audit_created ON enterprise_audit_log(created_at)',
      ];
      for (const idx of indexes) {
        await client.query(idx);
      }

      // Check if enterprise_audit_log table has company_id column before indexing it (ENT_006 introduces it)
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_audit_log' AND column_name = 'company_id') THEN
            CREATE INDEX IF NOT EXISTS idx_audit_company ON enterprise_audit_log(company_id);
          END IF;
        END $$;
      `);
    },
  });

  // ── Migration 005: Seed permission modules and actions ──
  migrationRunner.register({
    version: 'ENT_005',
    name: 'Seed permission modules and actions for enterprise RBAC',
    module: 'enterprise',
    type: 'seed',
    up: async (client) => {
      const modules = [
        { key: 'pos', name_ar: 'نقاط البيع', name_en: 'POS', category: 'operations', sort: 1 },
        { key: 'restaurant', name_ar: 'المطعم', name_en: 'Restaurant', category: 'operations', sort: 2 },
        { key: 'products', name_ar: 'المنتجات', name_en: 'Products', category: 'operations', sort: 3 },
        { key: 'inventory', name_ar: 'المخزون', name_en: 'Inventory', category: 'operations', sort: 4 },
        { key: 'warehouses', name_ar: 'المستودعات', name_en: 'Warehouses', category: 'operations', sort: 5 },
        { key: 'purchases', name_ar: 'المشتريات', name_en: 'Purchases', category: 'operations', sort: 6 },
        { key: 'suppliers', name_ar: 'الموردين', name_en: 'Suppliers', category: 'operations', sort: 7 },
        { key: 'sales', name_ar: 'المبيعات', name_en: 'Sales', category: 'operations', sort: 8 },
        { key: 'customers', name_ar: 'العملاء', name_en: 'Customers', category: 'operations', sort: 9 },
        { key: 'production', name_ar: 'الإنتاج', name_en: 'Production', category: 'operations', sort: 10 },
        { key: 'kitchen', name_ar: 'المطبخ', name_en: 'Kitchen', category: 'operations', sort: 11 },
        { key: 'accounting', name_ar: 'المحاسبة', name_en: 'Accounting', category: 'finance', sort: 12 },
        { key: 'treasury', name_ar: 'الخزينة', name_en: 'Treasury', category: 'finance', sort: 13 },
        { key: 'costs', name_ar: 'التكاليف', name_en: 'Costs', category: 'finance', sort: 14 },
        { key: 'hr', name_ar: 'الموارد البشرية', name_en: 'HR', category: 'hr', sort: 15 },
        { key: 'payroll', name_ar: 'الرواتب', name_en: 'Payroll', category: 'hr', sort: 16 },
        { key: 'attendance', name_ar: 'الحضور', name_en: 'Attendance', category: 'hr', sort: 17 },
        { key: 'reports', name_ar: 'التقارير', name_en: 'Reports', category: 'system', sort: 18 },
        { key: 'system', name_ar: 'النظام', name_en: 'System', category: 'system', sort: 19 },
        { key: 'security', name_ar: 'الأمان', name_en: 'Security', category: 'system', sort: 20 },
        { key: 'enterprise', name_ar: 'الشركات والفروع', name_en: 'Enterprise', category: 'system', sort: 21 },
        { key: 'maintenance', name_ar: 'الصيانة', name_en: 'Maintenance', category: 'operations', sort: 22 },
        { key: 'crm', name_ar: 'إدارة العملاء', name_en: 'CRM', category: 'operations', sort: 23 },
      ];

      for (const m of modules) {
        await client.query(
          `INSERT INTO permission_modules (module_key, name_ar, name_en, category, sort_order)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (module_key) DO NOTHING`,
          [m.key, m.name_ar, m.name_en, m.category, m.sort]
        );
      }

      // Seed standard actions for all modules
      const actions = [
        { key: 'view', name_ar: 'عرض', name_en: 'View' },
        { key: 'create', name_ar: 'إنشاء', name_en: 'Create' },
        { key: 'update', name_ar: 'تعديل', name_en: 'Update' },
        { key: 'delete', name_ar: 'حذف', name_en: 'Delete' },
        { key: 'approve', name_ar: 'اعتماد', name_en: 'Approve' },
        { key: 'export', name_ar: 'تصدير', name_en: 'Export' },
      ];

      const { rows: moduleRows } = await client.query('SELECT id, module_key FROM permission_modules');
      for (const mod of moduleRows) {
        for (const action of actions) {
          await client.query(
            `INSERT INTO permission_actions (module_id, action_key, name_ar, name_en)
             VALUES ($1, $2, $3, $4) ON CONFLICT (module_id, action_key) DO NOTHING`,
            [mod.id, action.key, action.name_ar, action.name_en]
          );
        }
      }
    },
  });

  // ── Migration 006: Enhance enterprise_audit_log with risk level ──
  migrationRunner.register({
    version: 'ENT_006',
    name: 'Enhance enterprise_audit_log with risk_level and changed_fields',
    module: 'enterprise',
    type: 'schema',
    up: async (client) => {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_audit_log' AND column_name = 'risk_level') THEN
            ALTER TABLE enterprise_audit_log ADD COLUMN risk_level VARCHAR(20) DEFAULT 'normal';
            CREATE INDEX IF NOT EXISTS idx_audit_risk ON enterprise_audit_log(risk_level);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_audit_log' AND column_name = 'changed_fields') THEN
            ALTER TABLE enterprise_audit_log ADD COLUMN changed_fields JSONB;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_audit_log' AND column_name = 'company_id') THEN
            ALTER TABLE enterprise_audit_log ADD COLUMN company_id INTEGER;
            CREATE INDEX IF NOT EXISTS idx_audit_company ON enterprise_audit_log(company_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_audit_log' AND column_name = 'branch_id') THEN
            ALTER TABLE enterprise_audit_log ADD COLUMN branch_id INTEGER;
          END IF;
        END $$;
      `);
    },
  });

  // ── Migration 009: Daily treasury closings (cash verification) ──
  // The route modules/accounting/treasury_closings_api.routes.ts reads
  // `treasury_closings`, but migrations/001_treasury_closings.sql was never wired
  // into this runner, so every archive query failed with 42P01.
  migrationRunner.register({
    version: 'ENT_009',
    name: 'Create treasury_closings table for daily cash verification',
    module: 'enterprise',
    type: 'schema',
    up: async (client) => {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treasury_closing_status') THEN
            CREATE TYPE treasury_closing_status AS ENUM (
              'Matched', 'Deficit - Pending Review', 'Surplus - Pending Review', 'Settled', 'Reopened'
            );
          END IF;
        END $$;
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS treasury_closings (
          id SERIAL PRIMARY KEY,
          treasury_id INTEGER NOT NULL REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
          closing_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
          total_deposits NUMERIC(15,2) NOT NULL DEFAULT 0.00,
          total_withdrawals NUMERIC(15,2) NOT NULL DEFAULT 0.00,
          book_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
          actual_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
          variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
          responsible_user VARCHAR(150) NOT NULL,
          responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'Matched',
          notes TEXT,
          denominations JSONB NOT NULL DEFAULT '{}'::jsonb,
          journal_entry_id INTEGER,
          reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TIMESTAMP WITH TIME ZONE,
          review_notes TEXT,
          company_id INTEGER,
          branch_id INTEGER,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_treasury_closings_treasury_id ON treasury_closings(treasury_id);
        CREATE INDEX IF NOT EXISTS idx_treasury_closings_closing_date ON treasury_closings(closing_date DESC);
        CREATE INDEX IF NOT EXISTS idx_treasury_closings_status ON treasury_closings(status);
        CREATE INDEX IF NOT EXISTS idx_treasury_closings_variance ON treasury_closings(variance);
        CREATE INDEX IF NOT EXISTS idx_treasury_closings_combined ON treasury_closings(treasury_id, closing_date DESC);
      `);
      await client.query(`
        CREATE OR REPLACE FUNCTION update_treasury_closings_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_update_treasury_closings_updated_at ON treasury_closings;
        CREATE TRIGGER trg_update_treasury_closings_updated_at
        BEFORE UPDATE ON treasury_closings
        FOR EACH ROW
        EXECUTE FUNCTION update_treasury_closings_updated_at();
      `);
      await client.query(`
        COMMENT ON TABLE treasury_closings IS
          'Enterprise Daily Treasury Closing, Cash Denomination Breakdown and Cash Verification Audit Ledger';
        COMMENT ON COLUMN treasury_closings.book_balance IS
          'Calculated expected ledger balance from opening + deposits - withdrawals';
        COMMENT ON COLUMN treasury_closings.actual_balance IS
          'Sum of physical cash counted via denominations';
        COMMENT ON COLUMN treasury_closings.variance IS
          'actual_balance - book_balance. Zero means Matched, negative is Deficit, positive is Surplus';
      `);
    },
  });

  // ── Migration 010: treasury_accounts.code ──
  // treasury_closings_api.routes.ts reads treasury_accounts.code in its archive
  // queries (hard SQL error) and reads account.code on its detail payloads
  // (silently undefined). The column was never added, so every closing screen
  // fell back to the synthetic "SAFE-<id>" label.
  migrationRunner.register({
    version: 'ENT_010',
    name: 'Add treasury_accounts.code used by the closings module',
    module: 'enterprise',
    type: 'schema',
    up: async (client) => {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'treasury_accounts' AND column_name = 'code') THEN
            ALTER TABLE treasury_accounts ADD COLUMN code VARCHAR(100);
          END IF;
        END $$;
      `);
      // Backfill so existing treasuries get a stable, readable code.
      await client.query(`
        UPDATE treasury_accounts
           SET code = COALESCE(NULLIF(account_number, ''), 'SAFE-' || id::text)
         WHERE code IS NULL OR code = ''
      `);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'treasury_accounts' AND indexname = 'idx_treasury_accounts_code') THEN
            CREATE UNIQUE INDEX IF NOT EXISTS idx_treasury_accounts_code ON treasury_accounts(code);
          END IF;
        END $$;
      `);
    },
  });
}

/**
 * Run all pending enterprise migrations
 * Called during server startup
 */
export async function runEnterpriseMigrations(): Promise<void> {
  try {
    console.log('🔄 Running Enterprise Migrations...');
    registerEnterpriseMigrations();
    const result = await migrationRunner.runAll();
    if (result.applied.length > 0) {
      console.log(`  ✅ Applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`);
    }
    if (result.skipped.length > 0) {
      console.log(`  ⏭️  Skipped ${result.skipped.length} already-applied migration(s)`);
    }
    if (result.errors.length > 0) {
      console.error(`  ❌ ${result.errors.length} migration(s) failed!`);
      for (const e of result.errors) {
        console.error(`     - ${e.version}: ${e.error}`);
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Enterprise migrations notice:', err?.message || err);
  }
}