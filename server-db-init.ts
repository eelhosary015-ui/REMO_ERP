import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { initEnterpriseInventorySchema } from "./modules/warehouses/database/inventory_schema.js";

export async function ensureSalesPostingAccounts(db: any): Promise<void> {
  const requiredAccounts = [
    {
      key: "accounts_receivable",
      aliases: ["customer_receivables"],
      type: "asset",
      candidates: ["1130", "1102"],
      name: "ذمم العملاء",
      nameEn: "Accounts Receivable",
      accountType: "receivable",
      nature: "debit",
      parentCode: "1100",
    },
    {
      key: "sales_revenue",
      aliases: ["food_revenue"],
      type: "revenue",
      candidates: ["4102", "4101", "4000"],
      name: "إيراد المبيعات",
      nameEn: "Sales Revenue",
      accountType: "sales",
      nature: "credit",
      parentCode: "4000",
    },
    {
      key: "cost_of_goods_sold",
      aliases: [],
      type: "expense",
      candidates: ["5101", "5100"],
      name: "تكلفة البضاعة المباعة",
      nameEn: "Cost of Goods Sold",
      accountType: "cogs",
      nature: "debit",
      parentCode: "5000",
    },
    {
      key: "tax_payable",
      aliases: ["vat_payable"],
      type: "liability",
      candidates: ["2130", "2103"],
      name: "ضريبة المبيعات المستحقة",
      nameEn: "Sales Tax Payable",
      accountType: "tax",
      nature: "credit",
      parentCode: "2100",
    },
  ];

  for (const definition of requiredAccounts) {
    const configKeys = [
      definition.key,
      `${definition.key}_account`,
      ...definition.aliases.flatMap((key) => [key, `${key}_account`]),
    ];
    const configured = await db.query(
      `SELECT a.id
         FROM account_config ac
         JOIN accounts a ON a.id = ac.account_id
        WHERE ac.key = ANY($1::text[])
          AND a.type = $2
          AND a.is_leaf = true
          AND a.allow_posting = true
          AND COALESCE(a.status, true) = true
          AND COALESCE(a.is_active, true) = true
        ORDER BY array_position($1::text[], ac.key)
        LIMIT 1`,
      [configKeys, definition.type],
    );

    let accountId = Number(configured.rows[0]?.id) || 0;
    if (!accountId) {
      const existing = await db.query(
        `SELECT id
           FROM accounts
          WHERE code = ANY($1::text[])
            AND type = $2
            AND is_leaf = true
            AND allow_posting = true
            AND COALESCE(status, true) = true
            AND COALESCE(is_active, true) = true
          ORDER BY array_position($1::text[], code)
          LIMIT 1`,
        [definition.candidates, definition.type],
      );
      accountId = Number(existing.rows[0]?.id) || 0;
    }

    if (!accountId) {
      let codeToCreate: string | undefined;
      for (const code of definition.candidates) {
        const collision = await db.query("SELECT id FROM accounts WHERE code = $1 LIMIT 1", [code]);
        if (collision.rows.length === 0) {
          codeToCreate = code;
          break;
        }
      }
      if (!codeToCreate) {
        throw new Error(`أكواد حساب ${definition.name} مستخدمة بحسابات غير قابلة للترحيل`);
      }

      const parent = await db.query(
        "SELECT id, level FROM accounts WHERE code = $1 AND is_leaf = false LIMIT 1",
        [definition.parentCode],
      );
      const inserted = await db.query(
        `INSERT INTO accounts (
           code, name, name_ar, name_en, type, account_type, account_nature,
           parent_id, level, is_leaf, allow_posting, status, is_active, balance
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, true, true, 0)
         ON CONFLICT (code) DO NOTHING
         RETURNING id`,
        [
          codeToCreate,
          definition.name,
          definition.name,
          definition.nameEn,
          definition.type,
          definition.accountType,
          definition.nature,
          parent.rows[0]?.id || null,
          Number(parent.rows[0]?.level || 0) + 1,
        ],
      );
      accountId = Number(inserted.rows[0]?.id) || 0;
      if (!accountId) {
        const concurrentInsert = await db.query(
          `SELECT id
             FROM accounts
            WHERE code = $1
              AND type = $2
              AND is_leaf = true
              AND allow_posting = true
              AND COALESCE(status, true) = true
              AND COALESCE(is_active, true) = true
            LIMIT 1`,
          [codeToCreate, definition.type],
        );
        accountId = Number(concurrentInsert.rows[0]?.id) || 0;
      }
    }

    if (!accountId) {
      throw new Error(`تعذر إنشاء أو ربط حساب ${definition.name} لترحيل فواتير المبيعات`);
    }

    await db.query(
      `INSERT INTO account_config (key, account_id, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id`,
      [definition.key, accountId, definition.name],
    );
  }
}

export async function initDb(pool: any) {
  try {
    console.log("Connecting to database and verifying structure...");
    await pool.query('SELECT NOW()'); // Test connection

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        user_id TEXT,
        reference_id TEXT,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`);
    console.log("✅ Notifications table verified/created.");

    // Phase 1 — Enterprise transaction/idempotency foundation. This table is
    // intentionally additive and does not alter existing business tables.
    // It can be used by any future write endpoint to guarantee that a retried
    // request cannot create a second business transaction.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS erp_idempotency_keys (
          id BIGSERIAL PRIMARY KEY,
          idempotency_key VARCHAR(200) NOT NULL,
          scope VARCHAR(120) NOT NULL,
          request_hash VARCHAR(128),
          status VARCHAR(20) NOT NULL DEFAULT 'processing',
          response_status INTEGER,
          response_body JSONB,
          created_by INTEGER,
          company_id INTEGER,
          branch_id INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          expires_at TIMESTAMP,
          CONSTRAINT uq_erp_idempotency_scope_key UNIQUE (scope, idempotency_key)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_erp_idempotency_expires ON erp_idempotency_keys(expires_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_erp_idempotency_status ON erp_idempotency_keys(status)`);
      console.log('✅ Phase 1: transaction/idempotency foundation verified.');
    } catch (phase1SchemaError: any) {
      console.error('❌ Phase 1 schema foundation failed:', phase1SchemaError?.message || phase1SchemaError);
      throw phase1SchemaError;
    }

    // Critical self-healing schema guard for Purchases/Receiving.
    // Some existing databases were created before the enterprise purchase-order
    // columns were introduced. Keep these columns available before any route
    // can touch purchase orders, including triggers that may reference them.
    try {
      await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_amount DECIMAL(12,2) DEFAULT 0`);
      await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoiced_amount DECIMAL(12,2) DEFAULT 0`);
      await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(12,3) DEFAULT 0`);
      await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS invoiced_quantity DECIMAL(12,3) DEFAULT 0`);
      await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expiry_date DATE`);
      await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS batch_number TEXT`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS available DECIMAL(12,3) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reserved DECIMAL(12,3) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS in_transit DECIMAL(12,3) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(14,4) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost DECIMAL(14,4) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_quantity DECIMAL(14,4) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_cost DECIMAL(14,4) DEFAULT 0`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      // Rebuild available from the authoritative quantity/reserved values. This is important
      // for legacy databases where the newly-added available column may have been initialized to 0.
      await pool.query(`UPDATE inventory_items SET available = GREATEST(COALESCE(quantity,0) - COALESCE(reserved,0), 0)`);

      // Drop any non-internal triggers on inventory_items before altering column types
      // (PostgreSQL forbids ALTER COLUMN TYPE when a trigger specifies UPDATE OF <column>)
      try {
        await pool.query(`
          DO $$
          DECLARE r RECORD;
          BEGIN
            FOR r IN (
              SELECT t.tgname FROM pg_trigger t
              JOIN pg_class c ON t.tgrelid = c.oid
              WHERE c.relname = 'inventory_items' AND NOT t.tgisinternal
            ) LOOP
              EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON inventory_items';
            END LOOP;
          END $$;
        `);
      } catch (_) {
        try { await pool.query(`DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items`); } catch (__) {}
      }

      // Legacy-schema repair: production/warehouse quantities and costs must support
      // decimals. Repair each column independently and safely handle old defaults.
      const repairDecimalColumn = async (table: string, column: string, precision: string, defaultValue = '0') => {
        try {
          const colCheck = await pool.query(
            `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
            [table, column]
          );
          if (colCheck.rows?.[0]?.data_type === 'numeric') {
            return;
          }
        } catch (_) {}
        try { await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`); } catch (_) {}
        await pool.query(
          `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE NUMERIC(${precision}) USING COALESCE(NULLIF(TRIM(${column}::text), ''), '0')::numeric`
        );
        try { await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${defaultValue}`); } catch (_) {}
      };
      for (const [table, column, precision] of [
        ['ingredients', 'cost', '14,4'], ['ingredients', 'avg_cost', '14,4'],
        ['ingredients', 'last_purchase_price', '14,4'], ['ingredients', 'current_stock', '14,4'],
        ['ingredients', 'min_stock', '12,3'], ['inventory_items', 'quantity', '14,4'],
        ['inventory_items', 'min_quantity', '14,4'], ['inventory_items', 'reserved', '14,4'],
        ['inventory_items', 'in_transit', '14,4'], ['inventory_items', 'available', '14,4'],
        ['inventory_items', 'avg_cost', '14,4'], ['inventory_items', 'cost', '14,4']
      ] as const) {
        try { await repairDecimalColumn(table, column, precision); }
        catch (err: any) { console.warn(`[DB Schema] Skipped repairing ${table}.${column}:`, err?.message || err); }
      }

      // Re-attach inventory integrity trigger at row level (without OF <cols> lock)
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_inventory_items_integrity') THEN
              DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items;
              CREATE TRIGGER trg_guard_inventory_items_integrity
              BEFORE INSERT OR UPDATE ON inventory_items
              FOR EACH ROW EXECUTE FUNCTION guard_inventory_items_integrity();
            END IF;
          END $$;
        `);
      } catch (_) {}
      await pool.query(`CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY, warehouse_id INTEGER, ingredient_id INTEGER,
        field VARCHAR(50) DEFAULT 'quantity', before_qty DECIMAL(14,3) DEFAULT 0,
        delta DECIMAL(14,3) DEFAULT 0, after_qty DECIMAL(14,3) DEFAULT 0,
        ref_type VARCHAR(80), ref_id INTEGER, "user" VARCHAR(255), notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      for (const col of [
        'warehouse_id INTEGER','ingredient_id INTEGER','field VARCHAR(50)',
        'before_qty DECIMAL(14,3) DEFAULT 0','delta DECIMAL(14,3) DEFAULT 0',
        'after_qty DECIMAL(14,3) DEFAULT 0','ref_type VARCHAR(80)','ref_id INTEGER',
        '"user" VARCHAR(255)','notes TEXT','created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      ]) { try { await pool.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS ${col}`); } catch (_) {} }

      await pool.query(`CREATE TABLE IF NOT EXISTS inventory_transactions (
        id SERIAL PRIMARY KEY,
        transaction_number VARCHAR(100),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        warehouse_id INTEGER,
        ingredient_id INTEGER,
        quantity DECIMAL(14,4) DEFAULT 0,
        type TEXT NOT NULL DEFAULT 'receipt',
        unit_cost DECIMAL(14,4) DEFAULT 0,
        total_cost DECIMAL(14,4) DEFAULT 0,
        balance_before DECIMAL(14,4) DEFAULT 0,
        balance_after DECIMAL(14,4) DEFAULT 0,
        reference_type VARCHAR(80),
        reference_id INTEGER,
        reference_no VARCHAR(100),
        reason TEXT,
        reference TEXT,
        "user" VARCHAR(255),
        user_id INTEGER,
        status VARCHAR(50) DEFAULT 'approved',
        notes TEXT,
        items TEXT,
        supplier_id INTEGER,
        is_reversed INTEGER DEFAULT 0,
        approved_by VARCHAR(255),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      for (const col of [
        'transaction_number VARCHAR(100)',
        'date TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'warehouse_id INTEGER',
        'ingredient_id INTEGER',
        'quantity DECIMAL(14,4) DEFAULT 0',
        'type TEXT DEFAULT \'receipt\'',
        'unit_cost DECIMAL(14,4) DEFAULT 0',
        'total_cost DECIMAL(14,4) DEFAULT 0',
        'balance_before DECIMAL(14,4) DEFAULT 0',
        'balance_after DECIMAL(14,4) DEFAULT 0',
        'reference_type VARCHAR(80)',
        'reference_id INTEGER',
        'reference_no VARCHAR(100)',
        'reason TEXT',
        'reference TEXT',
        '"user" VARCHAR(255)',
        'user_id INTEGER',
        'status VARCHAR(50) DEFAULT \'approved\'',
        'notes TEXT',
        'items TEXT',
        'supplier_id INTEGER',
        'is_reversed INTEGER DEFAULT 0',
        'approved_by VARCHAR(255)',
        'approved_at TIMESTAMP',
        'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      ]) { try { await pool.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS ${col}`); } catch (_) {} }
      try {
        await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN transaction_number TYPE VARCHAR(100) USING transaction_number::text`);
      } catch (inventoryTransactionSchemaError: any) {
        console.error('Inventory transaction number migration failed:', inventoryTransactionSchemaError?.message || inventoryTransactionSchemaError);
      }

      try { await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN quantity DROP NOT NULL`); } catch (_) {}
      try { await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN quantity SET DEFAULT 0`); } catch (_) {}
      try { await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN ingredient_id DROP NOT NULL`); } catch (_) {}

      console.log('✅ Purchases/Receiving schema guard verified.');
    } catch (schemaGuardError: any) {
      console.error('❌ Purchases/Receiving schema guard failed:', schemaGuardError.message);
      throw schemaGuardError;
    }
    
    const tables = [
      `
        CREATE TABLE IF NOT EXISTS adjustment_reasons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50),
          name_ar VARCHAR(255),
          name_en VARCHAR(255),
          type VARCHAR(50),
          is_active BOOLEAN DEFAULT true
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS inventory_adjustments (
          id SERIAL PRIMARY KEY,
          adjustment_number VARCHAR(100) UNIQUE,
          adjustment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          warehouse_id INTEGER,
          type VARCHAR(50),
          reason_id INTEGER,
          reference_no VARCHAR(255),
          notes TEXT,
          total_value DECIMAL(15,3) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'draft',
          created_by INTEGER,
          approved_by INTEGER,
          approved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
          id SERIAL PRIMARY KEY,
          adjustment_id INTEGER,
          product_id INTEGER,
          current_qty DECIMAL(15,3),
          physical_qty DECIMAL(15,3),
          adjustment_qty DECIMAL(15,3),
          unit_cost DECIMAL(15,4),
          total_cost DECIMAL(15,4)
        )
      `
,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        tables_count INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS delivery_areas (
        id TEXT PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        permissions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        branch_id INTEGER,
        must_change_password BOOLEAN DEFAULT false,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS printers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        port INTEGER DEFAULT 9100,
        is_active INTEGER DEFAULT 1,
        branch_id INTEGER,
        category_ids TEXT,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        printer_id INTEGER,
        FOREIGN KEY (printer_id) REFERENCES printers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER,
        name TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        image TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        user_id INTEGER,
        table_number INTEGER,
        customer_name TEXT,
        customer_phone TEXT,
        customer_phone_2 TEXT,
        customer_address TEXT,
        delivery_time TIMESTAMP,
        notes TEXT,
        order_type TEXT DEFAULT 'dine_in',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total DECIMAL(10,2) NOT NULL,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        area_id TEXT,
        status TEXT DEFAULT 'pending',
        is_paid INTEGER DEFAULT 1,
        is_deducted INTEGER DEFAULT 0,
        delivery_driver_id INTEGER DEFAULT NULL,
        payment_method TEXT DEFAULT 'cash',
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (area_id) REFERENCES delivery_areas(id),
        FOREIGN KEY (delivery_driver_id) REFERENCES employees(id)
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        product_id INTEGER,
        size_name TEXT,
        quantity DECIMAL(10,3),
        price DECIMAL(10,2),
        notes TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS backup_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        filename TEXT,
        status TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        reservation_date DATE NOT NULL,
        reservation_time TIME NOT NULL,
        guests_count INTEGER NOT NULL,
        table_number INTEGER,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        cost DECIMAL(10,2) DEFAULT 0,
        supplier TEXT,
        min_stock DECIMAL(10,2) DEFAULT 0,
        current_stock DECIMAL(10,2) DEFAULT 0,
        item_group TEXT,
        item_code TEXT,
        is_fixed_asset INTEGER DEFAULT 0,
        asset_category TEXT,
        description TEXT,
        is_zero_rated INTEGER DEFAULT 0,
        is_exempt INTEGER DEFAULT 0,
        brand TEXT,
        shelf_life_in_days INTEGER,
        end_of_life DATE,
        default_material_request_type TEXT,
        valuation_method TEXT,
        warranty_period INTEGER,
        weight_per_unit DECIMAL(10,2),
        allow_negative_stock INTEGER DEFAULT 0,
        barcode TEXT,
        has_variants INTEGER DEFAULT 0,
        parent_item_id INTEGER,
        deferred_expense INTEGER DEFAULT 0,
        deferred_expense_months INTEGER,
        deferred_revenue INTEGER DEFAULT 0,
        deferred_revenue_months INTEGER,
        default_income_account TEXT,
        default_expense_account TEXT,
        customer TEXT,
        min_order_qty DECIMAL(10,2),
        lead_time_days INTEGER,
        safety_stock DECIMAL(10,2),
        max_discount DECIMAL(10,2),
        grant_commission INTEGER DEFAULT 0,
        allow_sales INTEGER DEFAULT 1,
        allow_purchase INTEGER DEFAULT 1,
        tax_template TEXT,
        inspection_required_before_purchase INTEGER DEFAULT 0,
        inspection_required_before_delivery INTEGER DEFAULT 0,
        is_manufactured INTEGER DEFAULT 0,
        is_subcontracted INTEGER DEFAULT 0,
        variant_colors TEXT,
        allow_alternative_item INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS alternative_items (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL REFERENCES ingredients(id),
        alternative_item_id INTEGER NOT NULL REFERENCES ingredients(id),
        two_way INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS product_ingredients (
        product_id INTEGER,
        ingredient_id INTEGER,
        quantity DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (product_id, ingredient_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS waste_logs (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER,
        ingredient_name TEXT,
        quantity DECIMAL(10,2) DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        reason TEXT,
        cost DECIMAL(10,2) DEFAULT 0,
        date DATE DEFAULT CURRENT_DATE,
        user_id INTEGER,
        branch_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS product_sizes (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        branch_id INTEGER,
        is_main INTEGER DEFAULT 0,
        is_kitchen INTEGER DEFAULT 0,
        type TEXT DEFAULT 'branch',
        activity TEXT DEFAULT 'factory_raw',
        is_group INTEGER DEFAULT 0,
        parent_id INTEGER,
        is_rejected INTEGER DEFAULT 0,
        account TEXT,
        phone TEXT,
        mobile TEXT,
        address1 TEXT,
        address2 TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        is_transit INTEGER DEFAULT 0,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS safes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0,
        branch_id INTEGER,
        warehouse_id INTEGER,
        status TEXT DEFAULT 'closed',
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )`,
      `CREATE TABLE IF NOT EXISTS safe_transactions (
        id SERIAL PRIMARY KEY,
        safe_id INTEGER,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT NOT NULL,
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        reference_id INTEGER,
        payment_method TEXT DEFAULT 'cash',
        FOREIGN KEY (safe_id) REFERENCES safes(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS safe_shifts (
        id SERIAL PRIMARY KEY,
        safe_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        opening_balance DECIMAL(10,2) DEFAULT 0,
        closing_balance DECIMAL(10,2),
        actual_balance DECIMAL(10,2),
        status TEXT DEFAULT 'open',
        FOREIGN KEY (safe_id) REFERENCES safes(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS sales_reps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(100),
        target_amount DECIMAL(12,2) DEFAULT 0,
        achieved_amount DECIMAL(12,2) DEFAULT 0,
        commission_rate DECIMAL(5,2) DEFAULT 2.5,
        total_commission DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'نشط',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        phone_2 TEXT,
        address TEXT,
        sales_rep_id INTEGER REFERENCES sales_reps(id) ON DELETE SET NULL,
        total_orders INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        last_order_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS sales_rep_id INTEGER REFERENCES sales_reps(id) ON DELETE SET NULL`,
      `CREATE TABLE IF NOT EXISTS customer_transactions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        type TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        order_id INTEGER,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS hr_penalties (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT NOT NULL,
        notes TEXT,
        category TEXT DEFAULT 'manual',
        threshold_minutes INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS hr_departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS hr_shifts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        total_hours DECIMAL(10,2) NOT NULL,
        grace_period INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        department_id INTEGER,
        job_title TEXT,
        branch_id INTEGER,
        salary_type TEXT,
        basic_salary DECIMAL(10,2),
        work_days INTEGER,
        has_insurance INTEGER DEFAULT 0,
        insurance_amount DECIMAL(10,2) DEFAULT 0,
        has_meal_allowance INTEGER DEFAULT 0,
        meal_allowance_amount DECIMAL(10,2) DEFAULT 0,
        fingerprint_code TEXT,
        national_id TEXT,
        phone TEXT,
        address TEXT,
        qualification TEXT,
        exempt_from_penalties INTEGER DEFAULT 0,
        FOREIGN KEY (department_id) REFERENCES hr_departments(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS employee_shifts (
        employee_id INTEGER,
        shift_id INTEGER,
        PRIMARY KEY (employee_id, shift_id),
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (shift_id) REFERENCES hr_shifts(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        date DATE NOT NULL,
        punch_time TIMESTAMP,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        work_hours DECIMAL(10,2) DEFAULT 0,
        overtime DECIMAL(10,2) DEFAULT 0,
        penalty DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'present',
        notes TEXT,
        delay_minutes INTEGER DEFAULT 0,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE(employee_id, punch_time)
      )`,
      `CREATE TABLE IF NOT EXISTS fingerprint_devices (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        port INTEGER DEFAULT 4370,
        is_active INTEGER DEFAULT 1,
        branch_id INTEGER,
        last_sync TIMESTAMP,
        device_type VARCHAR(20) DEFAULT 'zkteco',
        protocol VARCHAR(10) DEFAULT 'tcp',
        username TEXT,
        password TEXT,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS hr_official_holidays (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        holiday_date DATE NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS payroll (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        basic_salary DECIMAL(10,2) DEFAULT 0,
        bonuses DECIMAL(10,2) DEFAULT 0,
        deductions DECIMAL(10,2) DEFAULT 0,
        net_salary DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        paid_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS hr_job_postings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        department_id INTEGER,
        department_name TEXT,
        branch_id INTEGER,
        branch_name TEXT,
        vacancies_count INTEGER DEFAULT 1,
        salary_min DECIMAL(10,2) DEFAULT 0,
        salary_max DECIMAL(10,2) DEFAULT 0,
        employment_type TEXT DEFAULT 'full_time',
        experience_years INTEGER DEFAULT 0,
        required_skills TEXT,
        job_description TEXT,
        responsibilities TEXT,
        benefits TEXT,
        shift_info TEXT,
        work_location TEXT,
        status TEXT DEFAULT 'published',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS hr_job_applications (
        id SERIAL PRIMARY KEY,
        job_posting_id INTEGER,
        job_title TEXT,
        department_name TEXT,
        candidate_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        experience_years INTEGER DEFAULT 0,
        qualification TEXT,
        candidate_skills TEXT,
        cover_letter TEXT,
        cv_text TEXT,
        cv_file_url TEXT,
        ai_match_score INTEGER DEFAULT 0,
        ai_summary TEXT,
        ai_recommendation TEXT,
        ai_strengths TEXT,
        ai_gaps TEXT,
        status TEXT DEFAULT 'submitted',
        rejection_reason TEXT,
        rating INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS responsibilities TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS benefits TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS shift_info TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS work_location TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS candidate_skills TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 0`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS english_level TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS last_title TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS current_employer TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS address TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS reason_for_leaving TEXT`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS current_salary NUMERIC DEFAULT 0`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS expected_salary NUMERIC DEFAULT 0`,
      `ALTER TABLE hr_job_applications ADD COLUMN IF NOT EXISTS salary_condition TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS requisition_type TEXT DEFAULT 'job_posting'`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS requester_name TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS qualification_required TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS experience_required TEXT`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal'`,
      `ALTER TABLE hr_job_postings ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'zkteco'`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'tcp'`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS username TEXT`,
      `ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS password TEXT`,
      `CREATE TABLE IF NOT EXISTS hr_interviews (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES hr_job_applications(id) ON DELETE CASCADE,
        candidate_name TEXT,
        job_title TEXT,
        department_name TEXT,
        phone TEXT,
        interview_date DATE NOT NULL,
        interview_time TEXT NOT NULL,
        interviewer_name TEXT,
        interview_type TEXT DEFAULT 'personal',
        location TEXT,
        status TEXT DEFAULT 'scheduled',
        rating INTEGER DEFAULT 0,
        recommendation TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS putaway_rules (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER REFERENCES ingredients(id),
        warehouse_id INTEGER REFERENCES warehouses(id),
        priority INTEGER DEFAULT 1,
        capacity DECIMAL(10,2) DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS stock_entries (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        from_warehouse_id INTEGER REFERENCES warehouses(id),
        to_warehouse_id INTEGER REFERENCES warehouses(id),
        total_value DECIMAL(10,2) DEFAULT 0,
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS stock_entry_items (
        id SERIAL PRIMARY KEY,
        stock_entry_id INTEGER REFERENCES stock_entries(id),
        ingredient_id INTEGER REFERENCES ingredients(id),
        quantity DECIMAL(10,2) NOT NULL,
        from_warehouse_id INTEGER REFERENCES warehouses(id),
        to_warehouse_id INTEGER REFERENCES warehouses(id),
        unit_price DECIMAL(10,2) DEFAULT 0,
        total_price DECIMAL(10,2) DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS product_bundles (
        id SERIAL PRIMARY KEY,
        parent_item_id INTEGER REFERENCES ingredients(id),
        description TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS product_bundle_items (
        id SERIAL PRIMARY KEY,
        bundle_id INTEGER REFERENCES product_bundles(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES ingredients(id),
        quantity DECIMAL(10,2) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        warehouse_id INTEGER,
        ingredient_id INTEGER,
        quantity DECIMAL(10,2) DEFAULT 0,
        min_quantity DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
        UNIQUE(warehouse_id, ingredient_id)
      )`,
      `CREATE TABLE IF NOT EXISTS uom_conversions (
        id SERIAL PRIMARY KEY,
        category TEXT,
        from_uom TEXT NOT NULL,
        to_uom TEXT NOT NULL,
        value DECIMAL(10,4) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_requests (
        id SERIAL PRIMARY KEY,
        from_warehouse_id INTEGER,
        to_warehouse_id INTEGER,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER,
        ingredient_id INTEGER,
        requested_quantity DECIMAL(10,2) NOT NULL,
        approved_quantity DECIMAL(10,2),
        received_quantity DECIMAL(10,2),
        FOREIGN KEY (request_id) REFERENCES inventory_requests(id),
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_transactions (
        id SERIAL PRIMARY KEY,
        warehouse_id INTEGER,
        ingredient_id INTEGER,
        quantity DECIMAL(14,4) DEFAULT 0,
        type TEXT NOT NULL,
        reference_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_reversed INTEGER DEFAULT 0,
        user_id INTEGER,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
        id BIGSERIAL PRIMARY KEY,
        event_key VARCHAR(300) NOT NULL UNIQUE,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
        field VARCHAR(30) NOT NULL DEFAULT 'quantity',
        before_qty DECIMAL(18,6) NOT NULL,
        delta DECIMAL(18,6) NOT NULL,
        after_qty DECIMAL(18,6) NOT NULL,
        ref_type VARCHAR(80) NOT NULL,
        ref_id INTEGER NOT NULL,
        user_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_counts (
        id SERIAL PRIMARY KEY,
        inventory_no VARCHAR(50) UNIQUE,
        inventory_date DATE NOT NULL DEFAULT CURRENT_DATE,
        warehouse_id INTEGER REFERENCES warehouses(id),
        user_id INTEGER,
        status VARCHAR(30) DEFAULT 'draft',
        notes TEXT,
        total_difference_cost DECIMAL(15,2) DEFAULT 0,
        approved_at TIMESTAMP,
        approved_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_count_items (
        id SERIAL PRIMARY KEY,
        inventory_count_id INTEGER REFERENCES inventory_counts(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id),
        product_id INTEGER,
        warehouse_id INTEGER REFERENCES warehouses(id),
        book_quantity DECIMAL(12,3) DEFAULT 0,
        physical_quantity DECIMAL(12,3) DEFAULT 0,
        difference_quantity DECIMAL(12,3) DEFAULT 0,
        cost_price DECIMAL(12,2) DEFAULT 0,
        difference_cost DECIMAL(15,2) DEFAULT 0,
        difference_percent DECIMAL(8,2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'matched',
        notes TEXT,
        is_settled INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        phone_2 TEXT,
        email TEXT,
        address TEXT,
        commercial_register TEXT,
        tax_number TEXT,
        group_name TEXT,
        payment_terms TEXT DEFAULT 'cash',
        credit_limit DECIMAL(12,2) DEFAULT 0,
        balance DECIMAL(12,2) DEFAULT 0,
        opening_balance DECIMAL(12,2) DEFAULT 0,
        rating INTEGER DEFAULT 0,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATE,
        status TEXT DEFAULT 'draft',
        total_amount DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        ingredient_id INTEGER REFERENCES ingredients(id),
        quantity DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'Pending',
        requested_by TEXT,
        notes TEXT,
        purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        approved_by TEXT,
        approved_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_request_items (
        id SERIAL PRIMARY KEY,
        purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE CASCADE,
        ingredient_id TEXT,
        name TEXT,
        unit TEXT,
        quantity DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(10,2) DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS supplier_transactions (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER,
        type TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reference_id INTEGER,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS approved_by TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code TEXT`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS name_en TEXT`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website TEXT`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country TEXT`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city TEXT`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_registration_date DATE`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
      `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approved_by INTEGER`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS reference_type TEXT`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS due_date DATE`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS document_number TEXT`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'posted'`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS created_by INTEGER`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `CREATE TABLE IF NOT EXISTS supplier_contacts (
        id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        name TEXT NOT NULL, job_title TEXT, phone TEXT, mobile TEXT, email TEXT, is_primary BOOLEAN DEFAULT false, notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
        id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        bank_name TEXT NOT NULL, account_name TEXT, account_number TEXT, iban TEXT, swift TEXT, branch TEXT, currency TEXT DEFAULT 'EGP', is_default BOOLEAN DEFAULT false, notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS supplier_documents (
        id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        document_type TEXT NOT NULL, document_number TEXT, file_name TEXT, file_url TEXT, issue_date DATE, expiry_date DATE, status TEXT DEFAULT 'active', notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `UPDATE suppliers SET supplier_code = 'SUP-' || LPAD(id::text, 6, '0') WHERE supplier_code IS NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_supplier_code ON suppliers(supplier_code) WHERE supplier_code IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_bank_accounts_supplier_id ON supplier_bank_accounts(supplier_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_documents_expiry ON supplier_documents(expiry_date)`,

      `CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER,
        warehouse_id INTEGER,
        invoice_number TEXT,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'received',
        notes TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS internal_invoice_number TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_supplier_invoice_number ON purchases(supplier_id, supplier_invoice_number)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_idempotency_unique ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL`,
      // Normalize legacy purchase invoices: older records stored the supplier invoice
      // number in invoice_number. Keep it as supplier_invoice_number and generate a
      // stable internal PINV number so the invoice list always shows the correct number.
      `UPDATE purchases
       SET supplier_invoice_number = COALESCE(NULLIF(supplier_invoice_number, ''), invoice_number),
           internal_invoice_number = CASE
             WHEN invoice_number ~ '^PINV-[0-9]{8}-[0-9]{6}$' THEN invoice_number
             ELSE CONCAT('PINV-', TO_CHAR(COALESCE(date, CURRENT_DATE), 'YYYYMMDD'), '-', LPAD(id::text, 6, '0'))
           END,
           invoice_number = CASE
             WHEN invoice_number ~ '^PINV-[0-9]{8}-[0-9]{6}$' THEN invoice_number
             ELSE CONCAT('PINV-', TO_CHAR(COALESCE(date, CURRENT_DATE), 'YYYYMMDD'), '-', LPAD(id::text, 6, '0'))
           END
       WHERE invoice_number IS NOT NULL
         AND invoice_number <> ''
         AND invoice_number !~ '^PINV-[0-9]{8}-[0-9]{6}$'`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS due_date DATE`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'`,
      `UPDATE purchases SET payment_status = CASE WHEN COALESCE(paid_amount,0) >= total_amount THEN 'paid' WHEN COALESCE(paid_amount,0) > 0 THEN 'partially_paid' ELSE 'unpaid' END`,
      `UPDATE purchases p SET due_date = CASE s.payment_terms WHEN 'credit_30' THEN p.date::date+30 WHEN 'credit_60' THEN p.date::date+60 WHEN 'credit_90' THEN p.date::date+90 ELSE p.date::date END FROM suppliers s WHERE s.id=p.supplier_id AND p.due_date IS NULL`,
      `CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
        id SERIAL PRIMARY KEY, payment_transaction_id INTEGER NOT NULL REFERENCES supplier_transactions(id) ON DELETE CASCADE,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL, allocated_amount DECIMAL(12,2) NOT NULL CHECK (allocated_amount > 0), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS supplier_evaluations (
        id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        evaluation_date DATE DEFAULT CURRENT_DATE, quality_score DECIMAL(5,2) DEFAULT 0, delivery_score DECIMAL(5,2) DEFAULT 0, price_score DECIMAL(5,2) DEFAULT 0, service_score DECIMAL(5,2) DEFAULT 0,
        overall_score DECIMAL(5,2) DEFAULT 0, notes TEXT, created_by INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_supplier_due_date ON purchases(supplier_id, due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_payment ON supplier_payment_allocations(payment_transaction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_payment_allocations_purchase ON supplier_payment_allocations(purchase_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier ON supplier_evaluations(supplier_id, evaluation_date DESC)`,
      `CREATE TABLE IF NOT EXISTS purchase_items (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER,
        ingredient_id INTEGER,
        quantity DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id),
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_returns (
        id SERIAL PRIMARY KEY,
        return_number TEXT UNIQUE NOT NULL,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
        return_date DATE NOT NULL DEFAULT CURRENT_DATE,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        total_quantity DECIMAL(10,3) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        stock_posted BOOLEAN DEFAULT false,
        idempotency_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_returns_idempotency_key ON purchase_returns(idempotency_key) WHERE idempotency_key IS NOT NULL`,
      `CREATE TABLE IF NOT EXISTS purchase_return_items (
        id SERIAL PRIMARY KEY,
        return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        purchase_item_id INTEGER REFERENCES purchase_items(id) ON DELETE SET NULL,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        ingredient_name TEXT,
        unit TEXT,
        quantity DECIMAL(10,3) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        reason TEXT,
        notes TEXT,
        total_price DECIMAL(10,2) NOT NULL
      )`,
      // ═══════════════════════════════════════════════════════════════════════
      // Purchases Enterprise Upgrade (idempotent)
      // ═══════════════════════════════════════════════════════════════════════
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_number TEXT`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS requested_by TEXT`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by TEXT`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_terms TEXT`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_center_id INTEGER`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoiced_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(12,3) DEFAULT 0`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS invoiced_quantity DECIMAL(12,3) DEFAULT 0`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(7,3) DEFAULT 0`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expiry_date DATE`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS batch_number TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receipt_id INTEGER`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS matching_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'posted'`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cost_center_id INTEGER`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS treasury_account_id INTEGER`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS posted_journal_entry_id INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_order_receipt ON purchases(purchase_order_id, receipt_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_matching_status ON purchases(matching_status)`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_transactions_purchase_ref ON supplier_transactions(reference_type, reference_id)`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_by TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_order_number ON purchase_orders(order_number) WHERE order_number IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_status ON purchase_orders(supplier_id,status)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_date ON purchase_orders(delivery_date)`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_order_id ON purchases(purchase_order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_matching_status ON purchases(matching_status)`,
      `CREATE TABLE IF NOT EXISTS purchase_receipts (
        id SERIAL PRIMARY KEY,
        receipt_number TEXT UNIQUE NOT NULL,
        purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
        receipt_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        total_quantity DECIMAL(14,3) DEFAULT 0,
        accepted_quantity DECIMAL(14,3) DEFAULT 0,
        rejected_quantity DECIMAL(14,3) DEFAULT 0,
        posted_to_stock BOOLEAN DEFAULT false,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
        purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE SET NULL,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        ordered_quantity DECIMAL(12,3) DEFAULT 0,
        received_quantity DECIMAL(12,3) NOT NULL,
        accepted_quantity DECIMAL(12,3) DEFAULT 0,
        rejected_quantity DECIMAL(12,3) DEFAULT 0,
        unit_price DECIMAL(12,2) DEFAULT 0,
        rejection_reason TEXT,
        notes TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order ON purchase_receipts(purchase_order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier_date ON purchase_receipts(supplier_id,receipt_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt ON purchase_receipt_items(receipt_id)`,
      `CREATE TABLE IF NOT EXISTS purchase_landed_costs (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
        cost_type TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
        allocation_method TEXT DEFAULT 'by_value',
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_landed_costs_purchase ON purchase_landed_costs(purchase_id)`,
      // ═══════════════════════════════════════════════════════════════════════
      // Purchases deep integration schema (idempotent, no approval workflow)
      // ═══════════════════════════════════════════════════════════════════════
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS request_number TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS warehouse_id INTEGER`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS department TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS required_date DATE`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS reason TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS justification TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS cost_center_id INTEGER`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS cost_item_id INTEGER`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(14,2) DEFAULT 0`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS created_by TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual'`,
      `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'ingredient'`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS product_id INTEGER`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS item_code TEXT`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS stock_on_hand DECIMAL(14,3) DEFAULT 0`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS min_stock DECIMAL(14,3) DEFAULT 0`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS max_stock DECIMAL(14,3) DEFAULT 0`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS suggested_quantity DECIMAL(14,3) DEFAULT 0`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(14,2) DEFAULT 0`,
      `ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS notes TEXT`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS purchase_request_id INTEGER`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_center_id INTEGER`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS product_id INTEGER`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS item_code TEXT`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_request_id INTEGER`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS quotation_id INTEGER`,
      `ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS product_id INTEGER`,
      `ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS item_code TEXT`,
      `ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS unit TEXT`,
      `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS purchase_id INTEGER`,
      `ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_goods_receipts_idempotency_unique ON goods_receipts(idempotency_key) WHERE idempotency_key IS NOT NULL`,
      `CREATE TABLE IF NOT EXISTS purchase_quotations (
        id SERIAL PRIMARY KEY,
        quotation_number TEXT,
        request_id INTEGER,
        supplier_id INTEGER,
        supplier TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATE,
        estimated_value DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'Draft',
        notes TEXT,
        items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        quotation_date DATE,
        valid_until DATE,
        payment_terms TEXT DEFAULT '',
        delivery_terms TEXT DEFAULT '',
        currency TEXT DEFAULT 'EGP',
        discount_amount DECIMAL(12,2) DEFAULT 0,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        subtotal DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        contact_person TEXT DEFAULT '',
        contact_phone TEXT DEFAULT '',
        reference_number TEXT DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES purchase_quotations(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        item_type TEXT DEFAULT 'ingredient',
        item_code TEXT,
        name TEXT,
        unit TEXT,
        quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
        unit_price DECIMAL(14,4) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(14,2) DEFAULT 0,
        tax_amount DECIMAL(14,2) DEFAULT 0,
        total_price DECIMAL(14,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_request_attachments (
        id SERIAL PRIMARY KEY,
        purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER DEFAULT 0,
        file_data BYTEA NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_activity_log (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details JSONB DEFAULT '{}'::jsonb,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_number_unique ON purchase_requests(request_number) WHERE request_number IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_idempotency_unique ON purchase_requests(idempotency_key) WHERE idempotency_key IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_requests_branch_warehouse ON purchase_requests(branch_id,warehouse_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_date ON purchase_requests(status,date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request ON purchase_request_items(purchase_request_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_request_items_product ON purchase_request_items(product_id)`,
      `INSERT INTO purchase_quotation_items (quotation_id,ingredient_id,product_id,item_type,item_code,name,unit,quantity,unit_price,total_price)
       SELECT q.id,
              CASE WHEN COALESCE(j->>'ingredient_id','') ~ '^[0-9]+$' THEN (j->>'ingredient_id')::integer ELSE NULL END,
              CASE WHEN COALESCE(j->>'product_id','') ~ '^[0-9]+$' THEN (j->>'product_id')::integer ELSE NULL END,
              COALESCE(j->>'item_type',CASE WHEN COALESCE(j->>'product_id','')<>'' THEN 'product' ELSE 'ingredient' END),
              j->>'item_code',j->>'name',j->>'unit',COALESCE(NULLIF(j->>'quantity','')::numeric,0),COALESCE(NULLIF(j->>'unit_price','')::numeric,0),COALESCE(NULLIF(j->>'total_price','')::numeric,COALESCE(NULLIF(j->>'quantity','')::numeric,0)*COALESCE(NULLIF(j->>'unit_price','')::numeric,0))
       FROM purchase_quotations q CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(q.items)='array' THEN q.items ELSE '[]'::jsonb END) j
       WHERE NOT EXISTS (SELECT 1 FROM purchase_quotation_items qi WHERE qi.quotation_id=q.id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_quotation_items_quotation ON purchase_quotation_items(quotation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_quotation_items_item ON purchase_quotation_items(ingredient_id,product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_request_attachments_request ON purchase_request_attachments(purchase_request_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_activity_entity ON purchase_activity_log(entity_type,entity_id,created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_orders_request ON purchase_orders(purchase_request_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_request ON purchases(purchase_request_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_quotation ON purchases(quotation_id)`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchase_requests_branch') THEN
          IF NOT EXISTS (SELECT 1 FROM purchase_requests pr LEFT JOIN branches b ON b.id=pr.branch_id WHERE pr.branch_id IS NOT NULL AND b.id IS NULL) THEN
            ALTER TABLE purchase_requests ADD CONSTRAINT fk_purchase_requests_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchase_requests_warehouse') THEN
          IF NOT EXISTS (SELECT 1 FROM purchase_requests pr LEFT JOIN warehouses w ON w.id=pr.warehouse_id WHERE pr.warehouse_id IS NOT NULL AND w.id IS NULL) THEN
            ALTER TABLE purchase_requests ADD CONSTRAINT fk_purchase_requests_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchase_orders_request') THEN
          IF NOT EXISTS (SELECT 1 FROM purchase_orders po LEFT JOIN purchase_requests pr ON pr.id=po.purchase_request_id WHERE po.purchase_request_id IS NOT NULL AND pr.id IS NULL) THEN
            ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE SET NULL;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchases_request') THEN
          IF NOT EXISTS (SELECT 1 FROM purchases p LEFT JOIN purchase_requests pr ON pr.id=p.purchase_request_id WHERE p.purchase_request_id IS NOT NULL AND pr.id IS NULL) THEN
            ALTER TABLE purchases ADD CONSTRAINT fk_purchases_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE SET NULL;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchases_quotation') THEN
          IF NOT EXISTS (SELECT 1 FROM purchases p LEFT JOIN purchase_quotations q ON q.id=p.quotation_id WHERE p.quotation_id IS NOT NULL AND q.id IS NULL) THEN
            ALTER TABLE purchases ADD CONSTRAINT fk_purchases_quotation FOREIGN KEY (quotation_id) REFERENCES purchase_quotations(id) ON DELETE SET NULL;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_goods_receipts_purchase') THEN
          IF NOT EXISTS (SELECT 1 FROM goods_receipts gr LEFT JOIN purchases p ON p.id=gr.purchase_id WHERE gr.purchase_id IS NOT NULL AND p.id IS NULL) THEN
            ALTER TABLE goods_receipts ADD CONSTRAINT fk_goods_receipts_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL;
          END IF;
        END IF;
      END $$`,
      `UPDATE purchase_requests SET request_number = 'PR-' || TO_CHAR(COALESCE(date,CURRENT_TIMESTAMP),'YYYYMMDD') || '-' || LPAD(id::text,6,'0') WHERE request_number IS NULL OR request_number = ''`,
      `UPDATE purchase_request_items SET total_price = COALESCE(total_price,0) WHERE total_price IS NULL`,
      `UPDATE purchase_request_items SET total_price = quantity * COALESCE(unit_price,0) WHERE total_price = 0 AND (quantity <> 0 OR COALESCE(unit_price,0) <> 0)`,
      `UPDATE purchase_requests pr SET estimated_total = COALESCE((SELECT SUM(COALESCE(total_price, quantity * COALESCE(unit_price,0))) FROM purchase_request_items pri WHERE pri.purchase_request_id=pr.id),0) WHERE COALESCE(pr.estimated_total,0)=0`,
      `CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        name_ar VARCHAR(255) NOT NULL,
        name_en VARCHAR(255),
        parent_id INTEGER,
        type TEXT NOT NULL,
        account_type VARCHAR(50),
        account_nature VARCHAR(10),
        level INTEGER DEFAULT 1,
        is_leaf BOOLEAN DEFAULT TRUE,
        allow_posting BOOLEAN DEFAULT TRUE,
        status BOOLEAN DEFAULT TRUE,
        balance DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'EGP',
        FOREIGN KEY (parent_id) REFERENCES accounts(id)
      )`,
      `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EGP'`,
      `UPDATE accounts SET is_active = COALESCE(status, TRUE) WHERE is_active IS DISTINCT FROM COALESCE(status, TRUE)`,
      `CREATE TABLE IF NOT EXISTS journal_entries (
        id SERIAL PRIMARY KEY,
        entry_number VARCHAR(100),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_number VARCHAR(100)`,
      `CREATE TABLE IF NOT EXISTS cost_centers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- cash, bank, petty_cash, intermediate
        currency TEXT DEFAULT 'EGP',
        current_balance DECIMAL(15,2) DEFAULT 0,
        branch_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL, -- positive for inflow, negative for outflow
        transaction_type TEXT NOT NULL, -- cash_in, cash_out, transfer, adjustment
        reference_type TEXT, -- sales, purchase, payroll, cost, general
        reference_id INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        cost_center_id INTEGER,
        attachment_url TEXT,
        FOREIGN KEY (account_id) REFERENCES treasury_accounts(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS bank_transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        description TEXT,
        reference VARCHAR(100),
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        type VARCHAR(10) NOT NULL DEFAULT 'debit',
        status VARCHAR(20) NOT NULL DEFAULT 'unmatched',
        source VARCHAR(20) NOT NULL DEFAULT 'system',
        matched_with INTEGER,
        matched_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        branch_id INTEGER REFERENCES branches(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS vouchers (
        id SERIAL PRIMARY KEY,
        voucher_type VARCHAR(50) NOT NULL DEFAULT 'payment',
        voucher_number VARCHAR(50) NOT NULL,
        voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
        description TEXT,
        reference VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        branch_id INTEGER REFERENCES branches(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS voucher_items (
        id SERIAL PRIMARY KEY,
        voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
        account_id INTEGER,
        account_name VARCHAR(200),
        description TEXT,
        debit DECIMAL(15,2) NOT NULL DEFAULT 0,
        credit DECIMAL(15,2) NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS journal_items (
        id SERIAL PRIMARY KEY,
        journal_entry_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        debit DECIMAL(10,2) DEFAULT 0,
        credit DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        cost_center_id INTEGER,
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        account_number TEXT,
        balance DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name TEXT`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS iban TEXT`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS swift_code TEXT`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EGP'`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) DEFAULT 'current'`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) DEFAULT 0`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS branch_id INTEGER`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
      `CREATE TABLE IF NOT EXISTS real_estate_properties (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        property_type VARCHAR(50) DEFAULT 'building',
        address TEXT,
        branch_id INTEGER,
        owner_name TEXT,
        status VARCHAR(30) DEFAULT 'active',
        monthly_rent DECIMAL(15,2) DEFAULT 0,
        purchase_value DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_real_estate_branch ON real_estate_properties(branch_id)`,
      `CREATE TABLE IF NOT EXISTS real_estate_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS bank_module_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS financial_transactions (
        id SERIAL PRIMARY KEY,
        fin_number VARCHAR(100) UNIQUE NOT NULL,
        idempotency_key VARCHAR(255) UNIQUE,
        source_type VARCHAR(80) NOT NULL,
        source_id VARCHAR(100) NOT NULL,
        source_document_number VARCHAR(100),
        event_type VARCHAR(80) NOT NULL,
        branch_id INTEGER,
        user_id INTEGER,
        currency VARCHAR(10) DEFAULT 'EGP',
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        payment_method VARCHAR(50) DEFAULT 'cash',
        treasury_account_id INTEGER,
        bank_account_id INTEGER,
        customer_id INTEGER,
        supplier_id INTEGER,
        employee_id INTEGER,
        cost_center_id INTEGER,
        journal_entry_id INTEGER,
        treasury_transaction_id INTEGER,
        bank_transaction_id INTEGER,
        customer_transaction_id INTEGER,
        supplier_transaction_id INTEGER,
        status VARCHAR(50) DEFAULT 'posted',
        description TEXT,
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_financial_transactions_source ON financial_transactions(source_type, source_id)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_transactions_fin_number ON financial_transactions(fin_number)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_transactions_idempotency ON financial_transactions(idempotency_key)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_transactions_branch ON financial_transactions(branch_id)`,
      `CREATE TABLE IF NOT EXISTS financial_integration_logs (
        id SERIAL PRIMARY KEY,
        fin_number VARCHAR(100),
        source_type VARCHAR(80),
        source_id VARCHAR(100),
        action VARCHAR(80),
        status VARCHAR(50) DEFAULT 'SUCCESS',
        treasury_impact DECIMAL(15,2) DEFAULT 0,
        bank_impact DECIMAL(15,2) DEFAULT 0,
        customer_impact DECIMAL(15,2) DEFAULT 0,
        supplier_impact DECIMAL(15,2) DEFAULT 0,
        gl_journal_id INTEGER,
        details JSONB DEFAULT '{}'::jsonb,
        user_id INTEGER,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_fin_logs_fin_num ON financial_integration_logs(fin_number)`,
      `CREATE INDEX IF NOT EXISTS idx_fin_logs_source ON financial_integration_logs(source_type, source_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fin_logs_created_at ON financial_integration_logs(created_at DESC)`,
      `ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS fin_number VARCHAR(100)`,
      `ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`,
      `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS fin_number VARCHAR(100)`,
      `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`,
      `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fin_number VARCHAR(100)`,
      `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_type VARCHAR(80)`,
      `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_id VARCHAR(100)`,
      `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`,
      `ALTER TABLE customer_transactions ADD COLUMN IF NOT EXISTS fin_number VARCHAR(100)`,
      `ALTER TABLE customer_transactions ADD COLUMN IF NOT EXISTS source_type VARCHAR(80)`,
      `ALTER TABLE customer_transactions ADD COLUMN IF NOT EXISTS source_id VARCHAR(100)`,
      `ALTER TABLE customer_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)`,
      `ALTER TABLE customer_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS fin_number VARCHAR(100)`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS source_type VARCHAR(80)`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS source_id VARCHAR(100)`,
      `ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`,
      `CREATE TABLE IF NOT EXISTS daily_closings (
        id SERIAL PRIMARY KEY,
        safe_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (safe_id) REFERENCES safes(id)
      )`,
      `CREATE TABLE IF NOT EXISTS order_modifications (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        type TEXT,
        old_total DECIMAL(10,2),
        new_total DECIMAL(10,2),
        notes TEXT,
        details TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payroll_advances (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT,
        installments_count INTEGER DEFAULT 1,
        installment_amount DECIMAL(10,2),
        date DATE NOT NULL,
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payroll_bonuses (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT,
        date DATE NOT NULL,
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payroll_deductions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT,
        date DATE NOT NULL,
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )`,
      `CREATE TABLE IF NOT EXISTS employee_penalties (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        penalty_rule_id INTEGER,
        amount DECIMAL(10,2) NOT NULL,
        penalty_type TEXT NOT NULL,
        category TEXT DEFAULT 'manual',
        penalty_date DATE NOT NULL DEFAULT CURRENT_DATE,
        status TEXT DEFAULT 'active',
        applied_by INTEGER,
        notes TEXT,
        deduction_id INTEGER,
        reference_type TEXT DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (penalty_rule_id) REFERENCES hr_penalties(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        customer_name TEXT NOT NULL,
        phone TEXT,
        complaint_text TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        resolution_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS user_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id INTEGER,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS financial_periods (
        id SERIAL PRIMARY KEY,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status TEXT DEFAULT 'open',
        closed_at TIMESTAMP,
        UNIQUE(month, year)
      )`,
      `CREATE TABLE IF NOT EXISTS fiscal_years (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS gl_audit_logs (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL,
        record_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        user_id INTEGER,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        fiscal_year_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        cost_center_id INTEGER,
        branch_id INTEGER,
        monthly_amount DECIMAL(15,2) DEFAULT 0,
        annual_amount DECIMAL(15,2) DEFAULT 0,
        actual_amount DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS account_config (
        key VARCHAR(100) PRIMARY KEY,
        account_id INTEGER,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sub_ledger_entries (
        id SERIAL PRIMARY KEY,
        journal_item_id INTEGER NOT NULL,
        partner_type VARCHAR(20) NOT NULL,
        partner_id INTEGER NOT NULL,
        partner_name VARCHAR(255),
        due_date DATE,
        amount DECIMAL(15,2) NOT NULL,
        remaining_amount DECIMAL(15,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS document_sequences (
        id SERIAL PRIMARY KEY,
        document_type VARCHAR(50) NOT NULL UNIQUE,
        prefix VARCHAR(20) DEFAULT '',
        current_number INTEGER DEFAULT 0,
        padding INTEGER DEFAULT 6,
        reset_period VARCHAR(20) DEFAULT 'yearly',
        last_reset_date DATE
      )`,
      `CREATE TABLE IF NOT EXISTS web_orders (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        table_number INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        total DECIMAL(10,2) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS web_order_items (
        id SERIAL PRIMARY KEY,
        web_order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        size_name TEXT,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        notes TEXT,
        FOREIGN KEY (web_order_id) REFERENCES web_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS sales_orders (
        id SERIAL PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        warehouse_id INTEGER,
        status TEXT DEFAULT 'pending',
        delivery_percentage DECIMAL(5,2) DEFAULT 0.00,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sales_order_items (
        id SERIAL PRIMARY KEY,
        sales_order_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        delivered_quantity DECIMAL(10,2) DEFAULT 0.00,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
      )`,
      `CREATE TABLE IF NOT EXISTS delivery_notes (
        id SERIAL PRIMARY KEY,
        delivery_note_no TEXT UNIQUE NOT NULL,
        sales_order_id INTEGER,
        customer_name TEXT NOT NULL,
        warehouse_id INTEGER NOT NULL,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
      )`,
      `CREATE TABLE IF NOT EXISTS delivery_note_items (
        id SERIAL PRIMARY KEY,
        delivery_note_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
      )`,
      `CREATE TABLE IF NOT EXISTS sales_returns (
        id SERIAL PRIMARY KEY,
        return_no TEXT UNIQUE NOT NULL,
        invoice_id TEXT,
        customer_name TEXT NOT NULL,
        date DATE NOT NULL,
        reason TEXT,
        return_type TEXT,
        refund_method TEXT,
        sales_rep TEXT,
        warehouse TEXT,
        notes TEXT,
        status TEXT DEFAULT 'مسودة',
        items_total DECIMAL(10,2) DEFAULT 0.00,
        discount_total DECIMAL(10,2) DEFAULT 0.00,
        tax_total DECIMAL(10,2) DEFAULT 0.00,
        expenses DECIMAL(10,2) DEFAULT 0.00,
        grand_total DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sales_return_items (
        id SERIAL PRIMARY KEY,
        return_id INTEGER NOT NULL,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        unit TEXT,
        qty_invoiced DECIMAL(10,2) NOT NULL,
        qty_returned DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0.00,
        tax_rate DECIMAL(10,2) DEFAULT 0.00,
        price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        is_read BOOLEAN DEFAULT false,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      try {
        await pool.query(sql);
      } catch (err: any) {
        console.error(`Error executing SQL: ${sql.substring(0, 50)}...`, err.message);
      }
    }

    // Repair legacy databases where orders existed before delivery assignment was added.
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_driver_id INTEGER`);
      console.log("✅ Delivery driver column verified on orders table.");
    } catch (deliveryDriverSchemaError: any) {
      console.error("❌ Delivery driver schema guard failed:", deliveryDriverSchemaError.message);
      throw deliveryDriverSchemaError;
    }

    // Complete Bank Module schema (idempotent migration)
    try {
      const fs = await import("fs/promises");
      const bankSchema = await fs.readFile(new URL("./migrations/002_bank_module_complete.sql", import.meta.url), "utf8");
      await pool.query(bankSchema);
      console.log("✅ Complete Bank Module database schema verified/applied");
    } catch (e: any) {
      console.error("Error applying complete Bank Module schema:", e.message);
    }

    // Ensure trial columns exist on users table
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at DATE;`);
      // قفل دائم للحساب عند انتهاء الفترة التجريبية — لا يُرفع إلا بإجراء إداري صريح.
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_reason TEXT;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by TEXT;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_unlock_count INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_last_unlocked_at TIMESTAMPTZ;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_last_unlocked_by INTEGER;`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_trial_lock ON users (is_trial, is_locked, trial_ends_at);`);
      // حساب مدير النظام لا يخضع للفترة التجريبية إطلاقًا.
      const trialAdminsCleaned = await pool.query(
        `UPDATE users SET is_trial = false, trial_ends_at = NULL
         WHERE LOWER(COALESCE(role, 'user')) = 'admin' AND (is_trial = true OR trial_ends_at IS NOT NULL)
         RETURNING id`
      );
      if (trialAdminsCleaned.rowCount) {
        console.warn(`[Trial] تم تعطيل الفترة التجريبية عن ${trialAdminsCleaned.rowCount} حساب مدير نظام`);
      }
      // قفل الحسابات التجريبية المنتهية الموجودة قبل تشغيل الخدمة.
      await pool.query(
        `UPDATE users
            SET is_locked = true,
                locked_at = COALESCE(locked_at, NOW()),
                locked_reason = CASE WHEN trial_ends_at IS NULL THEN 'TRIAL_DATE_MISSING' ELSE 'TRIAL_EXPIRED' END,
                locked_by = 'startup:trial-expiry'
          WHERE COALESCE(is_locked, false) = false
            AND is_trial = true
            AND LOWER(COALESCE(role, 'user')) <> 'admin'
            AND (trial_ends_at IS NULL OR trial_ends_at < CURRENT_DATE)`
      );
      // Email column — optional but used by unified mobile login (admin detection).
      // The unified /api/hr/employee-login endpoint tolerates absence of this column,
      // but adding it makes admin login by email possible (e.g. admin@company.com).
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
    } catch (e: any) {
      console.error("Error adding trial columns to users:", e.message);
    }

    // Ensure Mobile App Employee Portal & Attendance selfie/location columns exist
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS app_password TEXT;`);
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code TEXT;`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_photo TEXT;`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_photo TEXT;`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_location TEXT;`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_location TEXT;`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lat DECIMAL(10,7);`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lng DECIMAL(10,7);`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lat DECIMAL(10,7);`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lng DECIMAL(10,7);`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS device_info TEXT;`);
    } catch (e: any) {
      console.error("Error adding mobile attendance columns:", e.message);
    }

    // Ensure fingerprint_devices table & columns exist
    try {
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS branch_id INTEGER;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'zkteco';`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'tcp';`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS username TEXT;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS password TEXT;`);
    } catch (e: any) {
      console.error("Error adding columns to fingerprint_devices:", e.message);
    }

    try {
      await pool.query(`ALTER TABLE settings ADD PRIMARY KEY (key);`);
    } catch (e) {
      // Primary key might already exist
    }

    try {
      await pool.query(`INSERT INTO settings (key, value) VALUES ('backup_interval', '6') ON CONFLICT (key) DO NOTHING`);
    } catch (e) {
      // Should not happen if constraint exists
    }

    // Performance Optimization: Indexes
    const indexes = [
      // Orders & Order Items
      'CREATE INDEX IF NOT EXISTS idx_orders_timestamp_branch_status ON orders(timestamp DESC, branch_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)',
      'CREATE INDEX IF NOT EXISTS idx_orders_table_number ON orders(table_number)',
      'CREATE INDEX IF NOT EXISTS idx_orders_branch_paid_status ON orders(branch_id, is_paid, status)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)',

      // Products & Product sizes
      'CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id ON product_sizes(product_id)',

      // Web Orders
      'CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_id ON purchase_returns(purchase_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON purchase_returns(supplier_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(return_date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON purchase_return_items(return_id)',
      'CREATE INDEX IF NOT EXISTS idx_web_orders_timestamp ON web_orders(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_web_orders_branch_id ON web_orders(branch_id)',
      'CREATE INDEX IF NOT EXISTS idx_web_orders_status ON web_orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_web_order_items_web_order_id ON web_order_items(web_order_id)',
      'CREATE INDEX IF NOT EXISTS idx_web_order_items_product_id ON web_order_items(product_id)',

      // User Logs & Audit Trails
      'CREATE INDEX IF NOT EXISTS idx_user_logs_timestamp ON user_logs(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON user_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_logs_action ON user_logs(action)',

      // Customers & Transactions
      'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)',
      'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)',
      'CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer_id ON customer_transactions(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_customer_transactions_timestamp ON customer_transactions(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_customer_transactions_order_id ON customer_transactions(order_id)',

      // Suppliers & Transactions
      'CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)',
      'CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions(supplier_id)',
      'CREATE INDEX IF NOT EXISTS idx_supplier_transactions_timestamp ON supplier_transactions(timestamp DESC)',

      // Inventory & Warehouses
      'CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_id ON inventory_items(warehouse_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_items_ingredient_id ON inventory_items(ingredient_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_warehouse_id ON inventory_transactions(warehouse_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ingredient_id ON inventory_transactions(ingredient_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(type)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ingredients_item_group ON ingredients(item_group)',
      'CREATE INDEX IF NOT EXISTS idx_ingredients_item_code ON ingredients(item_code)',
      'CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name)',

      // HR & Payroll & Attendance
      'CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift_id ON employee_shifts(shift_id)',
      'CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id)',
      'CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id)',

      // General Accounting & Journal Entries
      'CREATE INDEX IF NOT EXISTS idx_journal_items_entry_id ON journal_items(journal_entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_items_account_id ON journal_items(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_items_cost_center_id ON journal_items(cost_center_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_parent_id ON accounts(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code)',

      // Safes & Shifts & Transactions
      'CREATE INDEX IF NOT EXISTS idx_safes_branch_id ON safes(branch_id)',
      'CREATE INDEX IF NOT EXISTS idx_safes_warehouse_id ON safes(warehouse_id)',
      'CREATE INDEX IF NOT EXISTS idx_safe_transactions_safe_id ON safe_transactions(safe_id)',
      'CREATE INDEX IF NOT EXISTS idx_safe_transactions_timestamp ON safe_transactions(timestamp DESC)',

      // Stock Entries & Distribution PUTAWAY
      'CREATE INDEX IF NOT EXISTS idx_stock_entry_items_entry_id ON stock_entry_items(stock_entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_stock_entry_items_ingredient_id ON stock_entry_items(ingredient_id)',

      // Sales Orders items
      'CREATE INDEX IF NOT EXISTS idx_sales_order_items_ord_id ON sales_order_items(sales_order_id)',
      'CREATE INDEX IF NOT EXISTS idx_sales_order_items_ing_id ON sales_order_items(ingredient_id)',

      // Delivery notes
      'CREATE INDEX IF NOT EXISTS idx_delivery_notes_so_id ON delivery_notes(sales_order_id)',
      'CREATE INDEX IF NOT EXISTS idx_delivery_notes_wh_id ON delivery_notes(warehouse_id)',
      'CREATE INDEX IF NOT EXISTS idx_delivery_note_items_dn_id ON delivery_note_items(delivery_note_id)',
      'CREATE INDEX IF NOT EXISTS idx_delivery_note_items_ing_id ON delivery_note_items(ingredient_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiver_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC)'
    ];

    for (const idxSql of indexes) {
      try {
        await pool.query(idxSql);
      } catch (err: any) {
        console.error(`Error creating index: ${idxSql}`, err.message);
      }
    }

    try {
      // Guard: only add the unique constraint if no unique constraint on (month, year)
      // already exists. Postgres auto-numbers unnamed ADD UNIQUE constraints on rerun
      // (..._key, ..._key1, ..._key2, ...), so an unguarded call would add another
      // copy on every server restart and bloat the query planner.
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class cl ON cl.oid = c.conrelid
            WHERE cl.relname = 'financial_periods'
              AND c.contype = 'u'
              AND (
                SELECT array_agg(a.attname::text ORDER BY a.attname::text)
                FROM pg_attribute a
                WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
              ) = ARRAY['month','year']
          ) THEN
            ALTER TABLE financial_periods ADD UNIQUE (month, year);
          END IF;
        END $$;
      `);
    } catch (e) {
      // Constraint might already exist
    }

    try {
      // Consolidate any duplicate inventory_items rows per (warehouse_id, ingredient_id)
      await pool.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN 
            SELECT warehouse_id, ingredient_id, MIN(id) as keep_id,
                   SUM(COALESCE(quantity, 0)) as tot_qty,
                   SUM(COALESCE(reserved, 0)) as tot_res,
                   SUM(COALESCE(in_transit, 0)) as tot_trans
            FROM inventory_items
            WHERE warehouse_id IS NOT NULL AND ingredient_id IS NOT NULL
            GROUP BY warehouse_id, ingredient_id
            HAVING COUNT(*) > 1
          LOOP
            UPDATE inventory_items
            SET quantity = r.tot_qty,
                reserved = r.tot_res,
                in_transit = r.tot_trans,
                available = GREATEST(r.tot_qty - r.tot_res, 0),
                updated_at = NOW()
            WHERE id = r.keep_id;

            DELETE FROM inventory_items
            WHERE warehouse_id = r.warehouse_id
              AND ingredient_id = r.ingredient_id
              AND id != r.keep_id;
          END LOOP;
        END $$;
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class cl ON cl.oid = c.conrelid
            WHERE cl.relname = 'inventory_items'
              AND c.contype = 'u'
              AND (
                SELECT array_agg(a.attname::text ORDER BY a.attname::text)
                FROM pg_attribute a
                WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
              ) = ARRAY['ingredient_id','warehouse_id']
          ) THEN
            ALTER TABLE inventory_items ADD UNIQUE (warehouse_id, ingredient_id);
          END IF;
        END $$;
      `);
    } catch (e) {
      // Constraint or duplicate handling might already exist
    }

    try {
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_time TIMESTAMP;`);
      await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_key;`);
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_key1;`);
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_key2;`);
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_key3;`);
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_unique;`);
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_unique1;`);
      await pool.query(`DROP INDEX IF EXISTS attendance_employee_id_date_key;`);
      await pool.query(`DROP INDEX IF EXISTS attendance_employee_id_date_key1;`);
      await pool.query(`DROP INDEX IF EXISTS attendance_employee_id_date_unique;`);
    } catch (e) {
      // Constraints might not exist
    }

    // Dynamic cleanup of any constraint on attendance containing date
    try {
      await pool.query(`
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = 'attendance'
                  AND con.contype = 'u'
                  AND (conname LIKE '%attendance_employee_id_date%' OR conname LIKE '%attendance%date%')
            ) LOOP
                EXECUTE 'ALTER TABLE attendance DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
            END LOOP;
        END $$;
      `);
    } catch (e) {
      // Ignore if unsupported
    }

    // Clean up corrupted fingerprint_code values in employees table
    try {
      await pool.query(`
        UPDATE employees 
        SET fingerprint_code = COALESCE(NULLIF(employee_code, ''), id::text)
        WHERE fingerprint_code LIKE '%COALESCE%' 
           OR fingerprint_code LIKE '%NULLIF%' 
           OR fingerprint_code IS NULL 
           OR fingerprint_code = '';
      `);
    } catch (e: any) {
      console.error("[DB Init] Employee fingerprint_code cleanup warning:", e?.message);
    }

    // Consolidate duplicate attendance rows per employee and date into a single row
    try {
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
        await pool.query(`
          WITH aggregated AS (
            SELECT 
              employee_id,
              date,
              MIN(LEAST(check_in, COALESCE(check_out, check_in), COALESCE(punch_time, check_in))) as earliest_in,
              MAX(GREATEST(check_out, COALESCE(check_in, check_out), COALESCE(punch_time, check_out))) as latest_out,
              MIN(id) as main_id
            FROM attendance
            GROUP BY employee_id, date
            HAVING COUNT(*) > 1
          )
          UPDATE attendance a
          SET 
            check_in = agg.earliest_in,
            check_out = CASE WHEN agg.latest_out > agg.earliest_in THEN agg.latest_out ELSE a.check_out END,
            work_hours = CASE 
              WHEN agg.latest_out > agg.earliest_in THEN 
                ROUND(EXTRACT(EPOCH FROM (agg.latest_out - agg.earliest_in)) / 3600.0, 2)
              ELSE a.work_hours 
            END
          FROM aggregated agg
          WHERE a.id = agg.main_id;
        `);

        await pool.query(`
          DELETE FROM attendance a
          WHERE EXISTS (
            SELECT 1 FROM (
              SELECT employee_id, date, MIN(id) as main_id
              FROM attendance
              GROUP BY employee_id, date
              HAVING COUNT(*) > 1
            ) dups
            WHERE dups.employee_id = a.employee_id 
              AND dups.date = a.date 
              AND a.id <> dups.main_id
          );
        `);
      } else {
        // Safe offline in-memory consolidation
        const attRes = await pool.query("SELECT * FROM attendance");
        const list = Array.isArray(attRes.rows) ? attRes.rows : [];
        const seen = new Map<string, any>();
        const toDeleteIds: number[] = [];

        for (const row of list) {
          const key = `${row.employee_id}_${row.date}`;
          if (!seen.has(key)) {
            seen.set(key, row);
          } else {
            toDeleteIds.push(Number(row.id));
          }
        }

        for (const id of toDeleteIds) {
          await pool.query(`DELETE FROM attendance WHERE id = $1`, [id]);
        }
      }
      console.log("✅ Attendance duplicate rows consolidated successfully into single daily records!");
    } catch (e: any) {
      console.error("[DB Init] Attendance consolidation warning:", e?.message);
    }

    try {
      await pool.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_punch_time_key;`);
      await pool.query(`DROP INDEX IF EXISTS idx_attendance_employee_punch_time;`);
      await pool.query(`DROP INDEX IF EXISTS idx_attendance_emp_punch;`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance (employee_id, date);`);
      try {
        await pool.query(`ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_date_unique UNIQUE (employee_id, date);`);
      } catch (_uc) {}
    } catch (e: any) {
      console.error("[DB Init] Attendance index creation warning:", e?.message);
    }

    try {
      await pool.query(`CREATE OR REPLACE VIEW attendances AS SELECT * FROM attendance;`);
    } catch (e) {
      // View creation fallback
    }

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;`);
    } catch (e) {
      // Column might already exist
    }

    // accounts table column expansions
    try {
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name_ar VARCHAR(255);`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(50);`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_nature VARCHAR(10);`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_leaf BOOLEAN DEFAULT TRUE;`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS allow_posting BOOLEAN DEFAULT TRUE;`);
      await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT TRUE;`);
      
      // Update any pre-existing records to keep them working flawlessly
      await pool.query(`UPDATE accounts SET name_ar = name WHERE name_ar IS NULL;`);
      await pool.query(`UPDATE accounts SET account_type = 'ASSET' WHERE (type = 'asset' OR type = 'ASSET') AND account_type IS NULL;`);
      await pool.query(`UPDATE accounts SET account_type = 'LIABILITY' WHERE (type = 'liability' OR type = 'LIABILITY') AND account_type IS NULL;`);
      await pool.query(`UPDATE accounts SET account_type = 'EQUITY' WHERE (type = 'equity' OR type = 'EQUITY') AND account_type IS NULL;`);
      await pool.query(`UPDATE accounts SET account_type = 'REVENUE' WHERE (type = 'revenue' OR type = 'REVENUE') AND account_type IS NULL;`);
      await pool.query(`UPDATE accounts SET account_type = 'EXPENSE' WHERE (type = 'expense' OR type = 'EXPENSE') AND account_type IS NULL;`);
      
      await pool.query(`UPDATE accounts SET account_nature = 'DEBIT' WHERE account_nature IS NULL AND account_type IN ('ASSET', 'EXPENSE');`);
      await pool.query(`UPDATE accounts SET account_nature = 'CREDIT' WHERE account_nature IS NULL AND account_type IN ('LIABILITY', 'EQUITY', 'REVENUE');`);
    } catch (err: any) {
      console.error("Failed to alter accounts columns:", err.message);
    }

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER;`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS activity TEXT DEFAULT 'factory_raw';`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_group INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS parent_id INTEGER;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_rejected INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS account TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS phone TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS mobile TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address1 TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address2 TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS state TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS country TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_transit INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS code TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS manager TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS allow_negative BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS description TEXT;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS linked_module TEXT DEFAULT 'general';`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS linked_modules TEXT DEFAULT '[]';`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_module_default BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT true;`);
    } catch (e) {
      // Columns might already exist
    }

    try {
      await pool.query(`ALTER TABLE users ADD CONSTRAINT fk_user_branch FOREIGN KEY (branch_id) REFERENCES branches(id);`);
    } catch (e) {
      // Constraint might already exist
    }

    // Add delivery_fee and area_id to orders table if they don't exist
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;`);
    } catch (e) {
      // Column might already exist
    }
    
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS area_id TEXT;`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_number INTEGER;`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE safes ADD COLUMN IF NOT EXISTS warehouse_id INTEGER;`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE safe_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';`);
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'ip';`);
    } catch (e) {
      //
    }

    try {
      await pool.query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS system_printer_name TEXT;`);
    } catch (e) {
      //
    }

    // Create or update default admin
    const configuredAdminPassword = String(process.env.DEFAULT_ADMIN_PASSWORD || "").trim();
    if (!configuredAdminPassword && process.env.NODE_ENV === "production") {
      throw new Error("DEFAULT_ADMIN_PASSWORD must be set before creating admin users in production");
    }
    const adminPassword = configuredAdminPassword || randomBytes(12).toString("base64url");
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    const adminExists = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminExists.rowCount === 0) {
      if (!configuredAdminPassword) {
        console.warn(`[SECURITY] Created user "admin" with a one-time password: ${adminPassword}`);
      }
      await pool.query(
        "INSERT INTO users (username, password, role, permissions, must_change_password) VALUES ($1, $2, $3, $4, $5)",
        ["admin", hashedPassword, "admin", JSON.stringify({ all: true }), false]
      );
    } else {
      await pool.query("UPDATE users SET role = 'admin', permissions = $1 WHERE username = 'admin'", [JSON.stringify({ all: true })]);
    }

    // Seed Specific Admin User (elhosary)
    const elhosaryExists = await pool.query("SELECT * FROM users WHERE username = 'elhosary'");
    if (elhosaryExists.rowCount === 0) {
      if (!configuredAdminPassword) {
        console.warn(`[SECURITY] Created user "elhosary" with a one-time password: ${adminPassword}`);
      }
      await pool.query(
        "INSERT INTO users (username, password, role, permissions, must_change_password) VALUES ($1, $2, $3, $4, $5)",
        ["elhosary", hashedPassword, "admin", JSON.stringify({ all: true }), false]
      );
    } else {
      await pool.query("UPDATE users SET role = 'admin', permissions = $1 WHERE username = 'elhosary'", [JSON.stringify({ all: true })]);
    }

    if (!configuredAdminPassword && (adminExists.rowCount === 0 || elhosaryExists.rowCount === 0)) {
      console.warn(`[SECURITY] تُطبع كلمة المرور أعلاه مرة واحدة فقط: سجّل بها ثم غيّرها من الإعدادات، أو اضبط DEFAULT_ADMIN_PASSWORD في .env قبل أول تشغيل، أو أعد التعيين عبر: npm run user:set-password -- <username>`);
    }

    // Create default branch if not exists
    const branchExists = await pool.query("SELECT * FROM branches");
    if (branchExists.rowCount === 0) {
      await pool.query("INSERT INTO branches (name) VALUES ($1)", ["الفرع الرئيسي"]);
    }

    // Create main warehouse if not exists
    const warehouseExists = await pool.query("SELECT * FROM warehouses WHERE is_main = 1");
    if (warehouseExists.rowCount === 0) {
      await pool.query("INSERT INTO warehouses (name, is_main, type) VALUES ($1, $2, $3)", ["المخزن الرئيسي", 1, 'main']);
    }

    // Seed HR Departments if empty
    const deptCount = await pool.query("SELECT COUNT(*) as count FROM hr_departments");
    if (parseInt(deptCount.rows[0].count) === 0) {
      const depts = ['المطبخ', 'الصالة', 'الإدارة', 'الدليفري'];
      for (const d of depts) {
        await pool.query("INSERT INTO hr_departments (name) VALUES ($1)", [d]);
      }
    }

    // Seed Chart of Accounts if empty
    const accountCount = await pool.query("SELECT COUNT(*) as count FROM accounts");
    if (parseInt(accountCount.rows[0].count) === 0) {
      const accounts = [
        // Level 1
        { code: '1', name: 'الأصول', name_ar: 'الأصول', name_en: 'Assets', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 1, is_leaf: false, allow_posting: false, parent_code: null, status: true },
        { code: '2', name: 'الخصوم', name_ar: 'الخصوم', name_en: 'Liabilities', type: 'liability', account_type: 'LIABILITY', account_nature: 'CREDIT', level: 1, is_leaf: false, allow_posting: false, parent_code: null, status: true },
        { code: '3', name: 'حقوق الملكية', name_ar: 'حقوق الملكية', name_en: 'Equity', type: 'equity', account_type: 'EQUITY', account_nature: 'CREDIT', level: 1, is_leaf: false, allow_posting: false, parent_code: null, status: true },
        { code: '4', name: 'الإيرادات', name_ar: 'الإيرادات', name_en: 'Revenue', type: 'revenue', account_type: 'REVENUE', account_nature: 'CREDIT', level: 1, is_leaf: false, allow_posting: false, parent_code: null, status: true },
        { code: '5', name: 'المصروفات', name_ar: 'المصروفات', name_en: 'Expense', type: 'expense', account_type: 'EXPENSE', account_nature: 'DEBIT', level: 1, is_leaf: false, allow_posting: false, parent_code: null, status: true },

        // Level 2
        { code: '11', name: 'الأصول المتداولة', name_ar: 'الأصول المتداولة', name_en: 'Current Assets', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 2, is_leaf: false, allow_posting: false, parent_code: '1', status: true },
        { code: '12', name: 'الأصول الثابتة', name_ar: 'الأصول الثابتة', name_en: 'Fixed Assets', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 2, is_leaf: false, allow_posting: false, parent_code: '1', status: true },
        { code: '21', name: 'الخصوم المتداولة', name_ar: 'الخصوم المتداولة', name_en: 'Liabilities', type: 'liability', account_type: 'LIABILITY', account_nature: 'CREDIT', level: 2, is_leaf: false, allow_posting: false, parent_code: '2', status: true },

        // Level 3
        { code: '111', name: 'الصندوق', name_ar: 'الصندوق', name_en: 'Cash', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '11', status: true },
        { code: '112', name: 'البنك', name_ar: 'البنك', name_en: 'Bank', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '11', status: true },
        { code: '113', name: 'العملاء', name_ar: 'العملاء', name_en: 'Accounts Receivable', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '11', status: true },
        { code: '114', name: 'المخزون', name_ar: 'المخزون', name_en: 'Inventory', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '11', status: true },

        { code: '121', name: 'الأراضي', name_ar: 'الأراضي', name_en: 'Land', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '12', status: true },
        { code: '122', name: 'المباني', name_ar: 'المباني', name_en: 'Buildings', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '12', status: true },
        { code: '123', name: 'السيارات', name_ar: 'السيارات', name_en: 'Vehicles', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '12', status: true },
        { code: '124', name: 'الأجهزة', name_ar: 'الأجهزة', name_en: 'Equipment', type: 'asset', account_type: 'ASSET', account_nature: 'DEBIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '12', status: true },

        { code: '211', name: 'الموردون', name_ar: 'الموردون', name_en: 'Suppliers', type: 'liability', account_type: 'LIABILITY', account_nature: 'CREDIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '21', status: true },
        { code: '212', name: 'القروض', name_ar: 'القروض', name_en: 'Loans', type: 'liability', account_type: 'LIABILITY', account_nature: 'CREDIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '21', status: true },
        { code: '213', name: 'الضرائب المستحقة', name_ar: 'الضرائب المستحقة', name_en: 'Taxes Payable', type: 'liability', account_type: 'LIABILITY', account_nature: 'CREDIT', level: 3, is_leaf: true, allow_posting: true, parent_code: '21', status: true },

        { code: '31', name: 'رأس المال', name_ar: 'رأس المال', name_en: 'Capital', type: 'equity', account_type: 'EQUITY', account_nature: 'CREDIT', level: 2, is_leaf: true, allow_posting: true, parent_code: '3', status: true },
        { code: '41', name: 'مبيعات النشاط', name_ar: 'مبيعات النشاط', name_en: 'Sales', type: 'revenue', account_type: 'REVENUE', account_nature: 'CREDIT', level: 2, is_leaf: true, allow_posting: true, parent_code: '4', status: true },
        { code: '51', name: 'تكلفة البضاعة المباعة', name_ar: 'تكلفة البضاعة المباعة', name_en: 'Cost of Goods Sold', type: 'expense', account_type: 'EXPENSE', account_nature: 'DEBIT', level: 2, is_leaf: true, allow_posting: true, parent_code: '5', status: true },
        { code: '52', name: 'الرواتب والأجور', name_ar: 'الرواتب والأجور', name_en: 'Salaries and Wages', type: 'expense', account_type: 'EXPENSE', account_nature: 'DEBIT', level: 2, is_leaf: true, allow_posting: true, parent_code: '5', status: true }
      ];

      const codeToId: Record<string, number> = {};
      for (const acc of accounts) {
        const parentId = acc.parent_code ? codeToId[acc.parent_code] : null;
        const result = await pool.query(
          `INSERT INTO accounts (code, name, name_ar, name_en, type, account_type, account_nature, level, is_leaf, allow_posting, status, parent_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [acc.code, acc.name, acc.name_ar, acc.name_en, acc.type, acc.account_type, acc.account_nature, acc.level, acc.is_leaf, acc.allow_posting, acc.status, parentId]
        );
        codeToId[acc.code] = result.rows[0].id;
      }
    }

    // Seed Safes if empty
    const safeCount = await pool.query("SELECT COUNT(*) as count FROM safes");
    if (parseInt(safeCount.rows[0].count) === 0) {
      await pool.query("INSERT INTO safes (name, balance) VALUES ($1, $2)", ['الخزينة الرئيسية', 0]);
    }

    try {
      await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
    } catch (e) {}

    try {
      await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;`);
    } catch (e) {}

    const professionalCategoryColumns = [
      "show_in_pos BOOLEAN DEFAULT true",
      "color TEXT DEFAULT '#2563eb'",
      "icon TEXT DEFAULT 'package'",
      "description TEXT",
      "sort_order INTEGER DEFAULT 0",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const column of professionalCategoryColumns) {
      try {
        await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS ${column};`);
      } catch (e) {}
    }

    try {
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
    } catch (e) {}

    const professionalProductColumns = [
      "show_in_pos BOOLEAN DEFAULT true",
      "code TEXT",
      "item_code TEXT",
      "sku TEXT",
      "category TEXT",
      "cost_price DECIMAL(10,2) DEFAULT 0",
      "yield_portions INTEGER DEFAULT 1",
      "barcode TEXT",
      "unit TEXT DEFAULT 'قطعة'",
      "brand TEXT",
      "stock DECIMAL(10,2) DEFAULT 0",
      "cost DECIMAL(10,2) DEFAULT 0",
      "min_stock DECIMAL(10,2) DEFAULT 0",
      "max_stock DECIMAL(10,2) DEFAULT 0",
      "tax_rate DECIMAL(10,2) DEFAULT 14",
      "business_profile TEXT DEFAULT 'general'",
      "item_type TEXT DEFAULT 'sale'",
      "is_favorite BOOLEAN DEFAULT false",
      "allow_discount BOOLEAN DEFAULT true",
      "track_inventory BOOLEAN DEFAULT true",
      "preparation_time INTEGER DEFAULT 0",
      "kitchen_station TEXT",
      "size_label TEXT",
      "color TEXT",
      "material TEXT",
      "supplier TEXT",
      "shelf_life_days INTEGER DEFAULT 0",
      "display_order INTEGER DEFAULT 0",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const column of professionalProductColumns) {
      try {
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${column};`);
      } catch (e) {}
    }

    try {
      await pool.query(`ALTER TABLE order_items ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL;`);
    } catch (e) {}

    const newIngredientColumns = [
      "code TEXT",
      "category TEXT",
      "item_group TEXT",
      "item_code TEXT",
      "avg_cost DECIMAL(14,4) DEFAULT 0",
      "last_purchase_price DECIMAL(14,4) DEFAULT 0",
      "is_fixed_asset INTEGER DEFAULT 0",
      "asset_category TEXT",
      "description TEXT",
      "is_zero_rated INTEGER DEFAULT 0",
      "is_exempt INTEGER DEFAULT 0",
      "brand TEXT",
      "shelf_life_in_days INTEGER",
      "end_of_life DATE",
      "default_material_request_type TEXT",
      "valuation_method TEXT",
      "warranty_period INTEGER",
      "weight_per_unit DECIMAL(10,2)",
      "allow_negative_stock INTEGER DEFAULT 0",
      "barcode TEXT",
      "has_variants INTEGER DEFAULT 0",
      "parent_item_id INTEGER",
      "deferred_expense INTEGER DEFAULT 0",
      "deferred_expense_months INTEGER",
      "deferred_revenue INTEGER DEFAULT 0",
      "deferred_revenue_months INTEGER",
      "default_income_account TEXT",
      "default_expense_account TEXT",
      "customer TEXT",
      "min_order_qty DECIMAL(10,2)",
      "lead_time_days INTEGER",
      "safety_stock DECIMAL(10,2)",
      "max_discount DECIMAL(10,2)",
      "grant_commission INTEGER DEFAULT 0",
      "allow_sales INTEGER DEFAULT 1",
      "allow_purchase INTEGER DEFAULT 1",
      "tax_template TEXT",
      "inspection_required_before_purchase INTEGER DEFAULT 0",
      "inspection_required_before_delivery INTEGER DEFAULT 0",
      "is_manufactured INTEGER DEFAULT 0",
      "is_subcontracted INTEGER DEFAULT 0",
      "variant_colors TEXT",
      "allow_alternative_item INTEGER DEFAULT 0",
      "code TEXT",
      "category TEXT",
      "max_stock DECIMAL(12,3) DEFAULT 0",
      "reorder_point DECIMAL(12,3) DEFAULT 0",
      "last_purchase_price DECIMAL(14,4) DEFAULT 0",
      "avg_cost DECIMAL(14,4) DEFAULT 0"
    ];

    for (const col of newIngredientColumns) {
      try {
        await pool.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {}
    }

    // HR ERP Upgrades: Life cycle, Customizable Payroll elements, Custody, Production bonuses
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`);
    } catch (e) {}

    // Weekly off-days column (JSON array of day names: ["friday", "saturday"])
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_off_days TEXT;`);
    } catch (e) {}

    // Department Head and Supervisor status (role levels: head, supervisor, regular)
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_department_head INTEGER DEFAULT 0;`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_supervisor INTEGER DEFAULT 0;`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_level TEXT DEFAULT 'regular';`);
    } catch (e) {}

    const hrEmployeeProfessionalColumns = [
      "employee_code TEXT",
      "email TEXT",
      "gender TEXT",
      "birth_date DATE",
      "hire_date DATE",
      "contract_type TEXT DEFAULT 'full_time'",
      "contract_start_date DATE",
      "contract_end_date DATE",
      "probation_end_date DATE",
      "bank_name TEXT",
      "bank_account TEXT",
      "emergency_contact_name TEXT",
      "emergency_contact_phone TEXT",
      "manager_id INTEGER",
      "employee_grade TEXT",
      "annual_leave_balance DECIMAL(10,2) DEFAULT 0",
      "sick_leave_balance DECIMAL(10,2) DEFAULT 0",
      "casual_leave_balance DECIMAL(10,2) DEFAULT 0",
      "last_evaluation_score DECIMAL(5,2)",
      "last_evaluation_date DATE",
      "termination_date DATE",
      "termination_reason TEXT",
      "first_name TEXT",
      "second_name TEXT",
      "third_name TEXT",
      "fourth_name TEXT",
      "title_prefix TEXT",
      "english_title TEXT",
      "english_first_name TEXT",
      "english_second_name TEXT",
      "english_third_name TEXT",
      "english_fourth_name TEXT",
      "religion TEXT",
      "marital_status TEXT",
      "id_type TEXT",
      "blood_type TEXT",
      "passport_number TEXT",
      "nationality TEXT",
      "passport_expiry DATE",
      "mobile TEXT",
      "home_phone TEXT",
      "governorate TEXT",
      "city TEXT",
      "hospital_code TEXT",
      "hospital_name TEXT",
      "organization_id INTEGER",
      "organization_name TEXT",
      "organization_code TEXT",
      "job_level TEXT",
      "direct_manager TEXT",
      "actual_start_date DATE",
      "job_grade TEXT",
      "job_description TEXT",
      "branch_name TEXT",
      "shift_name TEXT",
      "department_name TEXT",
      "salary_status TEXT",
      "bank_code TEXT",
      "has_insurance_txt TEXT",
      "insurance_location TEXT",
      "insurance_reason TEXT",
      "form6_date DATE",
      "has_tax TEXT",
      "first_loan_date DATE",
      "annual_increase_pct TEXT",
      "health_insurance TEXT",
      "financial_level TEXT",
      "payment_method TEXT",
      "bank_sub_code TEXT",
      "doctor_iban TEXT",
      "first_salary TEXT",
      "insurance_number TEXT",
      "vac_start_date DATE",
      "stop_salary_date DATE",
      "start_salary_date DATE",
      "entry_date DATE",
      "basic_payout TEXT",
      "payroll_statement TEXT",
      "net_salary_option TEXT",
      "account_name TEXT",
      "bank_emp_code TEXT",
      "insurance_date DATE",
      "vac_end_date DATE",
      "salary_pct TEXT",
      "fixed_30_6 TEXT",
      "uninsured_commercial TEXT",
      "visa_status TEXT",
      "from_payroll TEXT",
      "to_payroll TEXT",
      "salary_components TEXT",
      "attendance_code TEXT",
      "attendance_group TEXT",
      "attendance_method TEXT",
      "shift_type_option TEXT",
      "vacation_equivalent TEXT",
      "max_overtime_hours TEXT",
      "work_days_count TEXT",
      "evening_hour_equiv TEXT",
      "works_hourly TEXT",
      "delay_permissions TEXT",
      "hour_status TEXT",
      "vac_attendance_allowance TEXT",
      "overtime_rate TEXT",
      "exit_permissions TEXT",
      "calc_max_overtime TEXT",
      "attendance_allowance TEXT",
      "new_hour_rate TEXT",
      "merge_permissions TEXT",
      "attendance_fingerprint_balance TEXT",
      "shifts_count_rate_change TEXT",
      "assigned_shifts TEXT",
      "documents TEXT",
      "profile_photo_url TEXT",
      "photo_url TEXT",
      "avatar TEXT",
      "qualification_level TEXT",
      "qualification_field TEXT",
      "university TEXT",
      "graduation_year TEXT",
      "graduation_grade TEXT",
      "license_number TEXT",
      "degree_certificates TEXT",
      "english_signature TEXT",
      "city_gov_combined TEXT"
    ];
    for (const col of hrEmployeeProfessionalColumns) {
      try {
        await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {}
    }

    // Organizations table and default seed
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id SERIAL PRIMARY KEY,
          org_code TEXT NOT NULL UNIQUE,
          org_name_ar TEXT NOT NULL,
          org_name_en TEXT,
          logo TEXT,
          address TEXT,
          tax_number TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      const orgCheck = await pool.query("SELECT id FROM organizations WHERE org_code = 'ORG-TG'");
      let defaultOrgId = null;
      if (orgCheck.rows.length === 0) {
        const insRes = await pool.query(`
          INSERT INTO organizations (org_code, org_name_ar, org_name_en, is_active)
          VALUES ('ORG-TG', 'مؤسسة تراستس جانكو', 'Trusts Janco Organization', true)
          RETURNING id
        `);
        defaultOrgId = insRes.rows[0]?.id;
      } else {
        defaultOrgId = orgCheck.rows[0].id;
      }

      if (defaultOrgId) {
        await pool.query(`
          UPDATE employees 
          SET organization_id = $1,
              organization_name = COALESCE(organization_name, hospital_name, 'مؤسسة تراستس جانكو'),
              organization_code = COALESCE(organization_code, hospital_code, 'ORG-TG'),
              hospital_name = COALESCE(hospital_name, 'مؤسسة تراستس جانكو'),
              hospital_code = COALESCE(hospital_code, 'ORG-TG')
          WHERE organization_id IS NULL OR organization_name IS NULL
        `, [defaultOrgId]);
      }
    } catch (e) {
      console.error("Error setting up organizations table:", e);
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_leave_requests (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          leave_type TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          days_count DECIMAL(10,2) DEFAULT 1,
          status TEXT DEFAULT 'pending_head',
          reason TEXT,
          approved_by TEXT,
          approved_at TIMESTAMP,
          notes TEXT,
          head_status TEXT DEFAULT 'pending',
          head_notes TEXT,
          head_approved_by TEXT,
          head_action_at TIMESTAMP,
          hr_status TEXT DEFAULT 'pending',
          hr_notes TEXT,
          hr_approved_by TEXT,
          hr_action_at TIMESTAMP,
          department_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS head_status TEXT DEFAULT 'pending';
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS head_notes TEXT;
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS head_approved_by TEXT;
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS head_action_at TIMESTAMP;
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS hr_status TEXT DEFAULT 'pending';
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS hr_notes TEXT;
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS hr_approved_by TEXT;
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS hr_action_at TIMESTAMP;
        ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS department_id INTEGER;
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_evaluations (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          evaluation_period TEXT NOT NULL,
          evaluator_name TEXT,
          score DECIMAL(5,2) DEFAULT 0,
          grade TEXT,
          strengths TEXT,
          improvement_points TEXT,
          action_plan TEXT,
          status TEXT DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_employee_documents (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          document_type TEXT NOT NULL,
          document_number TEXT,
          issue_date DATE,
          expiry_date DATE,
          file_url TEXT,
          status TEXT DEFAULT 'valid',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_training_courses (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          provider TEXT,
          start_date DATE,
          end_date DATE,
          cost DECIMAL(10,2) DEFAULT 0,
          status TEXT DEFAULT 'planned',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_training_enrollments (
          id SERIAL PRIMARY KEY,
          course_id INTEGER REFERENCES hr_training_courses(id) ON DELETE CASCADE,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          status TEXT DEFAULT 'registered',
          score DECIMAL(5,2),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(course_id, employee_id)
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_overtime_requests (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          hours DECIMAL(10,2) DEFAULT 0,
          rate DECIMAL(10,2) DEFAULT 0,
          amount DECIMAL(10,2) DEFAULT 0,
          status TEXT DEFAULT 'pending',
          approved_by TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_recruitment_requests (
          id SERIAL PRIMARY KEY,
          department_id INTEGER REFERENCES hr_departments(id) ON DELETE SET NULL,
          job_title TEXT NOT NULL,
          vacancies INTEGER DEFAULT 1,
          status TEXT DEFAULT 'open',
          priority TEXT DEFAULT 'normal',
          target_date DATE,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    const hrProfessionalIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee_date ON hr_leave_requests(employee_id, start_date DESC)",
      "CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests(status)",
      "CREATE INDEX IF NOT EXISTS idx_hr_evaluations_employee_period ON hr_evaluations(employee_id, evaluation_period)",
      "CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON hr_employee_documents(employee_id)",
      "CREATE INDEX IF NOT EXISTS idx_hr_documents_expiry ON hr_employee_documents(expiry_date)",
      "CREATE INDEX IF NOT EXISTS idx_hr_training_enrollments_employee ON hr_training_enrollments(employee_id)",
      "CREATE INDEX IF NOT EXISTS idx_employees_contract_end_date ON employees(contract_end_date)"
    ];
    for (const idx of hrProfessionalIndexes) {
      try {
        await pool.query(idx);
      } catch (e) {}
    }

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER;`);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employee_status_history (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          old_status TEXT,
          new_status TEXT,
          changed_by TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    // HR Annual Salary Increases Management
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_increase_pct DECIMAL(5,2) DEFAULT 10.00;`);
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_annual_increase_date DATE;`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_annual_increases (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          years_of_service INTEGER NOT NULL DEFAULT 1,
          hire_date DATE,
          due_date DATE,
          old_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
          increase_pct DECIMAL(5,2) NOT NULL DEFAULT 10.00,
          increase_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          new_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
          status TEXT DEFAULT 'pending',
          approved_by TEXT,
          approved_at TIMESTAMP,
          approval_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_annual_increases_emp ON hr_annual_increases(employee_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_annual_increases_status ON hr_annual_increases(status);`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS employee_notifications (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    // Clearance records - tracks every إخلاء طرف (termination) and إعادة تفعيل (reactivation)
    // so we have a full history per employee. Multiple clearances/reactivations are supported.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS clearance_records (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          employee_name TEXT,
          employee_code TEXT,
          department_id INTEGER,
          branch_id INTEGER,
          action TEXT NOT NULL DEFAULT 'clearance',
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          reason TEXT,
          financial_status TEXT,
          handover_status TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payroll_elements (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL, -- 'addition' or 'deduction'
          rule_type TEXT NOT NULL, -- 'fixed' or 'percentage'
          value DECIMAL(10,2) NOT NULL DEFAULT 0,
          is_system BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employee_payroll_elements (
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          element_id INTEGER REFERENCES payroll_elements(id) ON DELETE CASCADE,
          value_override DECIMAL(10,2),
          PRIMARY KEY (employee_id, element_id)
        );
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS custody_store_items (
          id SERIAL PRIMARY KEY,
          asset_name TEXT NOT NULL UNIQUE,
          serial_number TEXT,
          quantity INTEGER DEFAULT 0,
          replacement_cost DECIMAL(10,2) DEFAULT 0,
          notes TEXT
        );
      `);
    } catch (e) {
      console.error("Error creating custody_store_items table", e);
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employee_custody (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          custody_store_item_id INTEGER REFERENCES custody_store_items(id) ON DELETE SET NULL,
          asset_name TEXT NOT NULL,
          serial_number TEXT,
          received_date DATE,
          returned_date DATE,
          status TEXT DEFAULT 'handed_over', -- 'handed_over', 'returned', 'damaged', 'lost'
          replacement_cost DECIMAL(10,2) DEFAULT 0,
          notes TEXT
        );
      `);
    } catch (e) {}

    // Safe migrations for employee_custody
    try {
      await pool.query("ALTER TABLE employee_custody ADD COLUMN IF NOT EXISTS replacement_cost DECIMAL(10,2) DEFAULT 0;");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE employee_custody ADD COLUMN IF NOT EXISTS custody_store_item_id INTEGER;");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE employee_custody ADD CONSTRAINT fk_employee_custody_store_item FOREIGN KEY (custody_store_item_id) REFERENCES custody_store_items(id) ON DELETE SET NULL;");
    } catch (e) {}

    // Safe schema guards for HR ERP action buttons. These are intentionally idempotent so
    // older installations are upgraded without destroying existing HR data.
    try {
      await pool.query(`ALTER TABLE payroll_elements ADD COLUMN IF NOT EXISTS name TEXT;`);
      await pool.query(`ALTER TABLE payroll_elements ADD COLUMN IF NOT EXISTS type TEXT;`);
      await pool.query(`ALTER TABLE payroll_elements ADD COLUMN IF NOT EXISTS rule_type TEXT;`);
      await pool.query(`ALTER TABLE payroll_elements ADD COLUMN IF NOT EXISTS value DECIMAL(10,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE payroll_elements ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;`);
    } catch (e) { console.error("HR payroll_elements schema guard warning:", e); }
    try {
      await pool.query(`ALTER TABLE employee_payroll_elements ADD COLUMN IF NOT EXISTS value_override DECIMAL(10,2);`);
    } catch (e) { console.error("HR employee_payroll_elements schema guard warning:", e); }
    try {
      await pool.query(`ALTER TABLE custody_store_items ADD COLUMN IF NOT EXISTS asset_name TEXT;`);
      await pool.query(`ALTER TABLE custody_store_items ADD COLUMN IF NOT EXISTS serial_number TEXT;`);
      await pool.query(`ALTER TABLE custody_store_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE custody_store_items ADD COLUMN IF NOT EXISTS replacement_cost DECIMAL(10,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE custody_store_items ADD COLUMN IF NOT EXISTS notes TEXT;`);
    } catch (e) { console.error("HR custody_store_items schema guard warning:", e); }
    try {
      await pool.query(`ALTER TABLE employee_custody ADD COLUMN IF NOT EXISTS custody_store_item_id INTEGER;`);
      await pool.query(`ALTER TABLE employee_custody ADD COLUMN IF NOT EXISTS replacement_cost DECIMAL(10,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE employee_custody ADD COLUMN IF NOT EXISTS returned_date DATE;`);
      await pool.query(`ALTER TABLE employee_custody ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'handed_over';`);
    } catch (e) { console.error("HR employee_custody schema guard warning:", e); }
    try {
      await pool.query(`ALTER TABLE production_bonuses ADD COLUMN IF NOT EXISTS product_name TEXT;`);
      await pool.query(`ALTER TABLE production_bonuses ADD COLUMN IF NOT EXISTS units_produced INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE production_bonuses ADD COLUMN IF NOT EXISTS rate_per_unit DECIMAL(10,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE production_bonuses ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE production_bonuses ADD COLUMN IF NOT EXISTS date DATE;`);
      await pool.query(`ALTER TABLE production_bonuses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`);
    } catch (e) { console.error("HR production_bonuses schema guard warning:", e); }

    // Warehouse Sections and Item mapping safe migrations
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS warehouse_sections (
          id SERIAL PRIMARY KEY,
          warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      await pool.query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES warehouse_sections(id) ON DELETE SET NULL;");
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS production_bonuses (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
          product_name TEXT,
          units_produced INTEGER NOT NULL DEFAULT 0,
          rate_per_unit DECIMAL(10,2) DEFAULT 0,
          bonus_amount DECIMAL(10,2) DEFAULT 0,
          date DATE,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    // Migrations for Cost Centers
    try {
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS type TEXT;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS branch TEXT;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS manager TEXT;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'نشط';`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS budget NUMERIC(18,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS description TEXT;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(15,2) DEFAULT 0;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS company_id INTEGER;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS branch_id INTEGER;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS department_id INTEGER;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS accounting_analytic_ref TEXT;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS budget_enabled BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS production_enabled BOOLEAN DEFAULT false;`);
      await pool.query(`ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS allocation_enabled BOOLEAN DEFAULT true;`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_centers_parent ON cost_centers(parent_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_centers_scope ON cost_centers(company_id, branch_id, department_id);`);
    } catch (e) {}

    // Creation of Cost Items Table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cost_items (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          cost_type TEXT,
          department TEXT,
          status TEXT DEFAULT 'نشط'
        );
      `);
    } catch (e) {}

    // Creation/Migration of Operating Costs Table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS operating_costs (
          id SERIAL PRIMARY KEY,
          category TEXT NOT NULL DEFAULT 'other', -- required operating cost category
          amount DECIMAL(10,2) NOT NULL,
          branch_id INTEGER, -- keep for compatibility
          notes TEXT,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          voucher_no TEXT,
          branch TEXT,
          department TEXT,
          cost_center_id INTEGER,
          cost_item_id INTEGER,
          payment_method TEXT,
          safe TEXT,
          status TEXT DEFAULT 'جديد',
          created_by TEXT,
          link_ledger BOOLEAN DEFAULT FALSE
        );
      `);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS purchase_request_id INTEGER`);
      await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS purchase_order_id INTEGER`);
      await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS purchase_receipt_id INTEGER`);
      await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS purchase_quotation_id INTEGER`);
      await pool.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_operating_costs_purchase_request') THEN
          ALTER TABLE operating_costs ADD CONSTRAINT fk_operating_costs_purchase_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_operating_costs_purchase_order') THEN
          ALTER TABLE operating_costs ADD CONSTRAINT fk_operating_costs_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_operating_costs_purchase_receipt') THEN
          ALTER TABLE operating_costs ADD CONSTRAINT fk_operating_costs_purchase_receipt FOREIGN KEY (purchase_receipt_id) REFERENCES goods_receipts(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_operating_costs_purchase_quotation') THEN
          ALTER TABLE operating_costs ADD CONSTRAINT fk_operating_costs_purchase_quotation FOREIGN KEY (purchase_quotation_id) REFERENCES purchase_quotations(id) ON DELETE SET NULL;
        END IF;
      END $$`);
      await pool.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchase_requests_cost_center') THEN
          IF NOT EXISTS (SELECT 1 FROM purchase_requests pr LEFT JOIN cost_centers cc ON cc.id=pr.cost_center_id WHERE pr.cost_center_id IS NOT NULL AND cc.id IS NULL) THEN
            ALTER TABLE purchase_requests ADD CONSTRAINT fk_purchase_requests_cost_center FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchase_requests_cost_item') THEN
          IF NOT EXISTS (SELECT 1 FROM purchase_requests pr LEFT JOIN cost_items ci ON ci.id=pr.cost_item_id WHERE pr.cost_item_id IS NOT NULL AND ci.id IS NULL) THEN
            ALTER TABLE purchase_requests ADD CONSTRAINT fk_purchase_requests_cost_item FOREIGN KEY (cost_item_id) REFERENCES cost_items(id) ON DELETE SET NULL;
          END IF;
        END IF;
      END $$`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operating_costs_purchase_links ON operating_costs(purchase_id,purchase_order_id,purchase_request_id)`);
    } catch (e) { console.warn('Purchase cost links migration skipped:', (e as any)?.message || e); }

    // Creation of Estimated Budgets Table
    try {
      await pool.query(`
        
        CREATE TABLE IF NOT EXISTS standard_costs (
          id SERIAL PRIMARY KEY,
          item_type TEXT,
          item_id TEXT,
          materials DECIMAL(10,2) DEFAULT 0,
          labor DECIMAL(10,2) DEFAULT 0,
          overhead DECIMAL(10,2) DEFAULT 0,
          utilities DECIMAL(10,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS product_costs (
          id SERIAL PRIMARY KEY,
          product_id TEXT,
          raw_material DECIMAL(10,2) DEFAULT 0,
          direct_labor DECIMAL(10,2) DEFAULT 0,
          electricity DECIMAL(10,2) DEFAULT 0,
          maintenance DECIMAL(10,2) DEFAULT 0,
          depreciation DECIMAL(10,2) DEFAULT 0,
          transport DECIMAL(10,2) DEFAULT 0,
          packaging DECIMAL(10,2) DEFAULT 0,
          indirect_overhead DECIMAL(10,2) DEFAULT 0,
          selling_price DECIMAL(10,2) DEFAULT 0,
          total_cost DECIMAL(10,2) DEFAULT 0,
          profit_margin DECIMAL(10,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE product_costs ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE product_costs ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(10,2) DEFAULT 0;
CREATE TABLE IF NOT EXISTS estimated_budgets (
          id SERIAL PRIMARY KEY,
          year INTEGER NOT NULL,
          month TEXT NOT NULL,
          cost_center_id INTEGER,
          cost_item_id INTEGER,
          amount DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    try {
      const cols = [
        "voucher_no TEXT",
        "branch TEXT",
        "department TEXT",
        "cost_center_id INTEGER",
        "cost_item_id INTEGER",
        "payment_method TEXT",
        "safe TEXT",
        "status TEXT DEFAULT 'جديد'",
        "created_by TEXT",
        "link_ledger BOOLEAN DEFAULT FALSE",
        "journal_entry_id INTEGER",
        "source_type TEXT",
        "source_id INTEGER",
        "accounting_account TEXT",
        "project TEXT",
        "product TEXT",
        "supplier TEXT",
        "employee TEXT",
        "customer TEXT",
        "tax DECIMAL(10,2) DEFAULT 0",
        "total DECIMAL(10,2) DEFAULT 0",
        "currency TEXT DEFAULT 'EGP'",
        "approval_status TEXT DEFAULT 'Draft'",
        "customer_id INTEGER",
        "employee_id INTEGER",
        "supplier_id INTEGER",
        "product_id INTEGER",
        "warehouse_id INTEGER"
      ];
      for (const col of cols) {
        try {
          await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS ${col};`);
        } catch (err) {}
      }

      // Safety indexes for Costs and Journal integration (STEP 22)
      try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_operating_costs_journal_entry ON operating_costs(journal_entry_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_operating_costs_source ON operating_costs(source_type, source_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_operating_costs_voucher ON operating_costs(voucher_no);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);`);
      } catch (e) {}

      // Enterprise cost lifecycle and traceable allocation layer.
      const enterpriseCostCols = [
        "due_date DATE", "financial_period TEXT", "company_id INTEGER",
        "exchange_rate DECIMAL(18,6) DEFAULT 1", "discount DECIMAL(18,2) DEFAULT 0",
        "cost_type TEXT DEFAULT 'operating'", "cost_behavior TEXT DEFAULT 'variable'",
        "direct_indirect TEXT DEFAULT 'indirect'", "allocation_method TEXT DEFAULT 'manual'",
        "allocation_status TEXT DEFAULT 'unallocated'", "source TEXT DEFAULT 'manual'",
        "submitted_by TEXT", "submitted_at TIMESTAMP", "approved_by TEXT", "approved_at TIMESTAMP",
        "allocated_by TEXT", "allocated_at TIMESTAMP", "closed_by TEXT", "closed_at TIMESTAMP",
        "reversal_user TEXT", "reversal_reason TEXT"
      ];
      for (const col of enterpriseCostCols) {
        try { await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS ${col};`); } catch (_) {}
      }
      const costItemCols = [
        "code TEXT", "description TEXT", "default_center_id INTEGER",
        "default_allocation_method TEXT DEFAULT 'percentage'", "budget_cap NUMERIC(18,2) DEFAULT 0",
        "alert_threshold NUMERIC(9,2) DEFAULT 90", "is_hr_linked BOOLEAN DEFAULT false",
        "is_warehouse_linked BOOLEAN DEFAULT false", "is_procurement_linked BOOLEAN DEFAULT false",
        "accounting_account_id INTEGER", "parent_id INTEGER",
        "arabic_name TEXT", "english_name TEXT", "direct_indirect TEXT DEFAULT 'indirect'",
        "cost_behavior TEXT DEFAULT 'variable'", "allow_production_allocation BOOLEAN DEFAULT false"
      ];
      for (const col of costItemCols) {
        try { await pool.query(`ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS ${col};`); } catch (_) {}
      }
      await pool.query(`
        UPDATE cost_items
        SET code = 'CI-' || id::text
        WHERE code IS NULL OR BTRIM(code) = ''
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_cost_items_code ON cost_items(code)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_items_parent ON cost_items(parent_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_items_status ON cost_items(status)`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cost_allocations (
          id SERIAL PRIMARY KEY,
          operating_cost_id INTEGER NOT NULL REFERENCES operating_costs(id) ON DELETE CASCADE,
          source_cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
          target_cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
          production_order_id INTEGER, product_id INTEGER,
          allocation_method TEXT NOT NULL, allocation_basis NUMERIC(18,6) DEFAULT 0,
          allocation_percent NUMERIC(9,4) DEFAULT 0, allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'allocated', notes TEXT, created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_cost_allocations_cost ON cost_allocations(operating_cost_id);
        CREATE INDEX IF NOT EXISTS idx_cost_allocations_product ON cost_allocations(product_id);
        CREATE TABLE IF NOT EXISTS cost_audit_trail (
          id SERIAL PRIMARY KEY,
          operating_cost_id INTEGER NOT NULL REFERENCES operating_costs(id) ON DELETE CASCADE,
          action TEXT NOT NULL, from_status TEXT, to_status TEXT,
          details JSONB NOT NULL DEFAULT '{}'::jsonb, user_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_cost_audit_cost ON cost_audit_trail(operating_cost_id, created_at DESC);
      `);

      // Missing Cost tables: costs_activity_log and recipe_cost_history
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS costs_activity_log (
            id SERIAL PRIMARY KEY,
            action TEXT NOT NULL,
            details TEXT,
            username TEXT DEFAULT 'النظام',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (e) {}

      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS recipe_cost_history (
            id SERIAL PRIMARY KEY,
            product_id TEXT NOT NULL,
            recipe_version TEXT DEFAULT 'V1',
            cost_source TEXT DEFAULT 'weighted_avg',
            total_ingredients_cost DECIMAL(12,2) DEFAULT 0,
            total_waste_cost DECIMAL(12,2) DEFAULT 0,
            packaging_cost DECIMAL(12,2) DEFAULT 0,
            labor_cost DECIMAL(12,2) DEFAULT 0,
            overhead_cost DECIMAL(12,2) DEFAULT 0,
            grand_total_cost DECIMAL(12,2) DEFAULT 0,
            yield_portions DECIMAL(10,2) DEFAULT 1,
            cost_per_portion DECIMAL(12,2) DEFAULT 0,
            selling_price DECIMAL(12,2) DEFAULT 0,
            gross_profit DECIMAL(12,2) DEFAULT 0,
            profit_margin_pct DECIMAL(5,2) DEFAULT 0,
            status TEXT DEFAULT 'Calculated',
            calculated_by TEXT DEFAULT 'النظام',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (e) {}

      // Cost items schema extensions
      try {
        const itemCols = [
          "parent_id INTEGER",
          "accounting_account_id INTEGER",
          "description TEXT",
          "default_center_id INTEGER",
          "default_allocation_method TEXT DEFAULT 'percentage'",
          "budget_cap DECIMAL(10,2) DEFAULT 0",
          "alert_threshold INTEGER DEFAULT 90",
          "is_hr_linked BOOLEAN DEFAULT false",
          "is_warehouse_linked BOOLEAN DEFAULT false",
          "is_procurement_linked BOOLEAN DEFAULT false"
        ];
        for (const col of itemCols) {
          try {
            await pool.query(`ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS ${col};`);
          } catch (_) {}
        }
      } catch (_) {}
    } catch (e) {}

    // Ensure operating_costs.category is populated and has a safe default on existing databases.
    try {
      await pool.query("UPDATE operating_costs SET category = COALESCE(NULLIF(category, ''), NULLIF(department, ''), 'other') WHERE category IS NULL OR category = ''");
      await pool.query("ALTER TABLE operating_costs ALTER COLUMN category SET DEFAULT 'other'");
    } catch (err) {
      console.warn("Operating costs category migration warning:", err);
    }

    // Treasury ERP Schema Migration
    try {
      const accountCols = [
        "opening_balance DECIMAL(15,2) DEFAULT 0",
        "available_balance DECIMAL(15,2) DEFAULT 0",
        "account_number TEXT",
        "bank_name TEXT",
        "iban TEXT",
        "swift_code TEXT",
        "status TEXT DEFAULT 'active'",
        "min_balance_limit DECIMAL(15,2) DEFAULT 0",
        "max_balance_limit DECIMAL(15,2) DEFAULT 0",
        "responsible_user_id INTEGER",
        "is_main BOOLEAN DEFAULT false",
        "parent_id INTEGER",
        "company_id INTEGER"
      ];
      for (const col of accountCols) {
        try {
          await pool.query(`ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS ${col};`);
        } catch (err) {}
      }

      const txCols = [
        "status TEXT DEFAULT 'approved'",
        "approved_by INTEGER",
        "approved_at TIMESTAMP",
        "voucher_number TEXT",
        "voucher_type TEXT",
        "tax_amount DECIMAL(15,2) DEFAULT 0",
        "discount_amount DECIMAL(15,2) DEFAULT 0",
        "payment_method TEXT DEFAULT 'cash'",
        "client_type TEXT",
        "client_name TEXT",
        "balance_before DECIMAL(15,2) DEFAULT 0",
        "balance_after DECIMAL(15,2) DEFAULT 0",
        "is_cleared BOOLEAN DEFAULT true",
        "cleared_at TIMESTAMP",
        "reversal_transaction_id INTEGER",
        "canceled_by INTEGER",
        "canceled_at TIMESTAMP",
        "supplier_id INTEGER",
        "customer_id INTEGER",
        "employee_id INTEGER",
        "invoice_id INTEGER",
        "expense_account_id INTEGER"
      ];
      for (const col of txCols) {
        try {
          await pool.query(`ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS ${col};`);
        } catch (err) {}
      }

      // Create ERP tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS treasury_daily_closings (
          id SERIAL PRIMARY KEY,
          closing_number TEXT UNIQUE,
          account_id INTEGER NOT NULL REFERENCES treasury_accounts(id),
          closing_date DATE DEFAULT CURRENT_DATE,
          opening_balance DECIMAL(15,2) NOT NULL,
          receipts DECIMAL(15,2) DEFAULT 0,
          payments DECIMAL(15,2) DEFAULT 0,
          transfers_in DECIMAL(15,2) DEFAULT 0,
          transfers_out DECIMAL(15,2) DEFAULT 0,
          expected_balance DECIMAL(15,2) NOT NULL,
          actual_balance DECIMAL(15,2) NOT NULL,
          difference DECIMAL(15,2) DEFAULT 0,
          difference_type TEXT DEFAULT 'matched', -- shortage, overage, matched
          denomination_200 INTEGER DEFAULT 0,
          denomination_100 INTEGER DEFAULT 0,
          denomination_50 INTEGER DEFAULT 0,
          denomination_20 INTEGER DEFAULT 0,
          denomination_10 INTEGER DEFAULT 0,
          denomination_5 INTEGER DEFAULT 0,
          denomination_1 INTEGER DEFAULT 0,
          denomination_coins DECIMAL(15,2) DEFAULT 0,
          action_taken TEXT,
          journal_entry_id INTEGER,
          status TEXT DEFAULT 'closed',
          notes TEXT,
          created_by INTEGER NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          approved_by INTEGER REFERENCES users(id),
          approved_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_types (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          category VARCHAR(50) DEFAULT 'cash', -- cash, asset, equipment, tools, inventory, vehicle, keys_permits, temporary, permanent, custom
          requires_asset BOOLEAN DEFAULT false,
          requires_inventory BOOLEAN DEFAULT false,
          requires_treasury BOOLEAN DEFAULT true,
          max_limit DECIMAL(15,2) DEFAULT 0,
          default_duration_days INTEGER DEFAULT 30,
          is_active BOOLEAN DEFAULT true,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custodies (
          id SERIAL PRIMARY KEY,
          custody_number TEXT UNIQUE,
          custody_type_id INTEGER REFERENCES treasury_custody_types(id) ON DELETE SET NULL,
          custody_type TEXT DEFAULT 'cash',
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          employee_name TEXT,
          employee_code TEXT,
          department TEXT,
          section TEXT,
          branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
          cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
          project_name TEXT,
          account_id INTEGER REFERENCES treasury_accounts(id) ON DELETE SET NULL,
          amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          issued_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          spent_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          returned_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          additional_due_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          currency TEXT DEFAULT 'EGP',
          status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, rejected, issued, received, active, pending_settlement, partially_settled, overdue, returned, closed, cancelled
          request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          issue_date TIMESTAMP,
          due_date TIMESTAMP,
          duration_days INTEGER DEFAULT 30,
          purpose TEXT,
          notes TEXT,
          rejection_reason TEXT,
          cleared_amount DECIMAL(15,2) DEFAULT 0,
          clearance_notes TEXT,
          approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          approved_at TIMESTAMP,
          issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          issued_at TIMESTAMP,
          received_at TIMESTAMP,
          cleared_at TIMESTAMP,
          closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          closed_at TIMESTAMP,
          created_by INTEGER NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_expenses (
          id SERIAL PRIMARY KEY,
          custody_id INTEGER NOT NULL REFERENCES treasury_custodies(id) ON DELETE CASCADE,
          expense_number VARCHAR(100),
          expense_date DATE NOT NULL,
          description TEXT NOT NULL,
          category VARCHAR(100),
          amount DECIMAL(15,2) NOT NULL,
          tax_amount DECIMAL(15,2) DEFAULT 0,
          account_id INTEGER,
          cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
          supplier_name TEXT,
          invoice_number TEXT,
          payment_method VARCHAR(50) DEFAULT 'cash',
          notes TEXT,
          attachment_url TEXT,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_items (
          id SERIAL PRIMARY KEY,
          custody_id INTEGER NOT NULL REFERENCES treasury_custodies(id) ON DELETE CASCADE,
          item_type VARCHAR(50) DEFAULT 'fixed_asset', -- fixed_asset, inventory_ingredient, product, tool, vehicle, key_permit
          asset_id INTEGER,
          ingredient_id INTEGER,
          product_id INTEGER,
          item_name TEXT NOT NULL,
          item_code TEXT,
          serial_number TEXT,
          barcode TEXT,
          warehouse_id INTEGER,
          quantity DECIMAL(15,3) DEFAULT 1,
          unit_cost DECIMAL(15,2) DEFAULT 0,
          total_value DECIMAL(15,2) DEFAULT 0,
          condition_on_issue VARCHAR(100) DEFAULT 'جديدة / ممتازة',
          condition_on_return VARCHAR(100),
          status VARCHAR(50) DEFAULT 'assigned', -- assigned, returned, damaged, lost
          issued_at TIMESTAMP,
          returned_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_settlements (
          id SERIAL PRIMARY KEY,
          settlement_number VARCHAR(100) UNIQUE,
          custody_id INTEGER NOT NULL REFERENCES treasury_custodies(id) ON DELETE CASCADE,
          settlement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
          returned_to_treasury DECIMAL(15,2) NOT NULL DEFAULT 0,
          additional_paid_to_employee DECIMAL(15,2) NOT NULL DEFAULT 0,
          settlement_type VARCHAR(50) DEFAULT 'full',
          treasury_account_id INTEGER REFERENCES treasury_accounts(id) ON DELETE SET NULL,
          status VARCHAR(50) DEFAULT 'approved',
          notes TEXT,
          rejection_reason TEXT,
          reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TIMESTAMP,
          approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          approved_at TIMESTAMP,
          journal_entry_id INTEGER,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_approvals (
          id SERIAL PRIMARY KEY,
          custody_id INTEGER NOT NULL REFERENCES treasury_custodies(id) ON DELETE CASCADE,
          step_name VARCHAR(100),
          action VARCHAR(50),
          action_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          action_by_name TEXT,
          comments TEXT,
          amount_at_time DECIMAL(15,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_attachments (
          id SERIAL PRIMARY KEY,
          custody_id INTEGER NOT NULL REFERENCES treasury_custodies(id) ON DELETE CASCADE,
          expense_id INTEGER REFERENCES treasury_custody_expenses(id) ON DELETE SET NULL,
          file_name TEXT NOT NULL,
          file_url TEXT NOT NULL,
          file_type VARCHAR(50),
          file_size INTEGER,
          document_type VARCHAR(50) DEFAULT 'invoice',
          uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_custody_audit_logs (
          id SERIAL PRIMARY KEY,
          custody_id INTEGER NOT NULL,
          action_type VARCHAR(100) NOT NULL,
          old_status VARCHAR(50),
          new_status VARCHAR(50),
          details JSONB,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_name TEXT,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS treasury_audit_logs (
          id SERIAL PRIMARY KEY,
          transaction_id INTEGER,
          account_id INTEGER,
          action_type TEXT NOT NULL,
          old_values JSONB,
          new_values JSONB,
          user_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT
        );

        CREATE TABLE IF NOT EXISTS treasury_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT
        );
      `);

      // Install Immutable Audit Log Trigger
      try {
        await pool.query(`
          CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
          RETURNS TRIGGER AS $$
          BEGIN
            RAISE EXCEPTION 'Audit trail records are immutable and cannot be updated or deleted!';
          END;
          $$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS trg_prevent_audit_log_update_delete ON treasury_audit_logs;
          CREATE TRIGGER trg_prevent_audit_log_update_delete
          BEFORE UPDATE OR DELETE ON treasury_audit_logs
          FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();
        `);
      } catch (err) {
        console.error("Audit log trigger creation note:", err);
      }

      // Safe column additions for existing treasury_custodies
      const custodyCols = [
        "custody_number TEXT",
        "custody_type_id INTEGER",
        "custody_type TEXT DEFAULT 'cash'",
        "employee_name TEXT",
        "employee_code TEXT",
        "department TEXT",
        "section TEXT",
        "branch_id INTEGER",
        "cost_center_id INTEGER",
        "project_name TEXT",
        "issued_amount DECIMAL(15,2) DEFAULT 0",
        "spent_amount DECIMAL(15,2) DEFAULT 0",
        "remaining_amount DECIMAL(15,2) DEFAULT 0",
        "additional_due_amount DECIMAL(15,2) DEFAULT 0",
        "currency TEXT DEFAULT 'EGP'",
        "request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "issue_date TIMESTAMP",
        "due_date TIMESTAMP",
        "duration_days INTEGER DEFAULT 30",
        "notes TEXT",
        "rejection_reason TEXT",
        "approved_by INTEGER",
        "approved_at TIMESTAMP",
        "issued_by INTEGER",
        "issued_at TIMESTAMP",
        "received_at TIMESTAMP",
        "closed_by INTEGER",
        "closed_at TIMESTAMP",
        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
      ];
      for (const col of custodyCols) {
        try {
          await pool.query(`ALTER TABLE treasury_custodies ADD COLUMN IF NOT EXISTS ${col};`);
        } catch (err) {}
      }

      // Seed Default Custody Types
      try {
        const typeCountRes = await pool.query("SELECT COUNT(*) as count FROM treasury_custody_types");
        if (parseInt(typeCountRes.rows[0]?.count || 0) === 0) {
          await pool.query(`
            INSERT INTO treasury_custody_types (code, name_ar, name_en, category, requires_asset, requires_inventory, requires_treasury, max_limit, default_duration_days, description) VALUES
            ('CUST-CASH', 'عهدة نقدية / مشتريات ونثريات', 'Cash Custody / Petty Cash', 'cash', false, false, true, 50000, 30, 'عهدة مالية نقدية للمشتريات العاجلة والمصروفات اليومية والنثريات'),
            ('CUST-ASSET', 'عهدة أصول ثابتة', 'Fixed Asset Custody', 'asset', true, false, false, 0, 365, 'تسليم أصول ثابتة مسجلة بسجل الأصول (مكاتب، أجهزة، معدات ثقيلة) للموظف'),
            ('CUST-EQUIP', 'عهدة أجهزة ومعدات إلكترونية', 'Equipment & Hardware Custody', 'equipment', true, false, false, 0, 180, 'تسليم لابتوبات، هواتف، أجهزة كاشير، طابعات وشاشات للموظف للعمل'),
            ('CUST-TOOLS', 'عهدة أدوات ومعدات تشغيل', 'Tools & Operations Custody', 'tools', false, false, false, 0, 90, 'أدوات الصيانة والمطبخ والتشغيل الفندقي والعدد اليدوية'),
            ('CUST-INV', 'عهدة أصناف ومواد من المخزن', 'Warehouse Inventory Custody', 'inventory', false, true, false, 0, 30, 'صرف مواد وخامات من المخزن تحت عهدة المشرف للاستهلاك والتشغيل'),
            ('CUST-VEHICLE', 'عهدة سيارة أو مركبة أو دراجة', 'Vehicle / Fleet Custody', 'vehicle', true, false, false, 0, 365, 'تسليم مركبات التوصيل أو سيارات الشركة لسائق أو مندوب محدد'),
            ('CUST-KEYS', 'عهدة مفاتيح وكروت وتصاريح أمنية', 'Keys, Badges & Permits Custody', 'keys_permits', false, false, false, 0, 365, 'مفاتيح الخزائن، كروت الدخول الذكية، تصاريح البوابات والأختام'),
            ('CUST-TEMP', 'عهدة نقدية مؤقتة لمهمة محددة', 'Temporary Project Custody', 'temporary', false, false, true, 20000, 15, 'عهدة تصرف لمهمة مؤقتة أو مشروع خارجي محدد المدة بحد أقصى 15 يوماً'),
            ('CUST-PERM', 'عهدة تشغيلية مستديمة (Imprest)', 'Permanent Operational Custody', 'permanent', false, false, true, 100000, 365, 'عهدة دائمة متجددة للمشرفين يتم استعاضتها دورياً بناءً على فواتير التسوية')
            ON CONFLICT (code) DO NOTHING;
          `);
        }
      } catch (err) {
        console.error("Error seeding default custody types:", err);
      }

      // Seed Default Treasury & Custody Settings
      try {
        const defaultSettings = [
          { key: 'allow_negative_balance', value: 'false', description: 'منع السحب بالسالب عند عجز رصيد الخزينة' },
          { key: 'require_notes_for_transaction', value: 'true', description: 'إلزامية كتابة سبب أو بيان الحركة المالية' },
          { key: 'default_currency', value: 'EGP', description: 'العملة الافتراضية للتقارير المالية المجمعة' },
          { key: 'decimal_places', value: '2', description: 'عدد الخانات العشرية للمبالغ والتقارير' },
          { key: 'dual_auth_threshold', value: '50000', description: 'حد المبلغ الذي يتطلب موافقة اعتماد مزدوج (ج.م)' },
          { key: 'financial_period_locking_date', value: '', description: 'تاريخ إغلاق الفترة المالية لمنع التعديلات السابقة' },
          { key: 'auto_post_cash_discrepancy', value: 'true', description: 'إنشاء قيد محاسبي تلقائي لفروقات الجرد (عجز/زيادة)' },
          { key: 'custody_approval_tier1_limit', value: '5000', description: 'حد موافقة مدير القسم / الفرع للعهدة (ج.م)' },
          { key: 'custody_approval_tier2_limit', value: '20000', description: 'حد موافقة المدير المالي للعهدة (ج.م)' },
          { key: 'custody_approval_tier3_limit', value: '50000', description: 'حد موافقة الإدارة العليا / المدير العام (ج.م)' },
          { key: 'custody_default_due_days', value: '30', description: 'المدة الافتراضية للعهدة المؤقتة بالأيام' },
          { key: 'custody_auto_journal_posting', value: 'true', description: 'إنشاء القيود اليومية التلقائية عند الصرف والتسوية' },
          { key: 'custody_allow_partial_settlement', value: 'true', description: 'السماح بالتسوية الجزئية للعهدة' },
          { key: 'custody_overdue_warning_days', value: '3', description: 'عدد أيام التنبيه قبل موعد استحقاق العهدة' }
        ];
        for (const s of defaultSettings) {
          await pool.query(
            `INSERT INTO treasury_settings (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
            [s.key, s.value, s.description]
          );
        }
      } catch (err) {
        console.error("Error seeding default custody settings:", err);
      }
    } catch (e) {
      console.error("Error migrating Treasury ERP tables:", e);
    }

    // Cost centers, items, and operating costs initialized cleanly without dummy records.
    // Seed default system pay elements
    try {
      const elementCount = await pool.query("SELECT COUNT(*) as count FROM payroll_elements");
      if (parseInt(elementCount.rows[0].count) === 0) {
        await pool.query(`
          INSERT INTO payroll_elements (name, type, rule_type, value, is_system) VALUES
          ('بدل طبيعة عمل', 'addition', 'fixed', 500.00, true),
          ('بدل مخاطر', 'addition', 'fixed', 300.00, true),
          ('بدل غربة وسكن', 'addition', 'fixed', 400.00, true),
          ('حافز إنتاج إضافي', 'addition', 'fixed', 0.00, true),
          ('تأمينات اجتماعية', 'deduction', 'percentage', 11.00, true)
        `);
      }
    } catch (e) {}

    // ═══ ERP Accounting Enhancements ═══
    try {
      // Add enhanced columns to journal_entries
      const journalCols = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'journal_entries' AND column_name = 'source_type'
      `);
      if (journalCols.rows.length === 0) {
        await pool.query(`
          ALTER TABLE journal_entries 
            ADD COLUMN period_id INTEGER REFERENCES financial_periods(id),
            ADD COLUMN source_type VARCHAR(50) DEFAULT 'manual',
            ADD COLUMN source_id INTEGER,
            ADD COLUMN status VARCHAR(20) DEFAULT 'draft',
            ADD COLUMN total_debit DECIMAL(15,2) DEFAULT 0,
            ADD COLUMN total_credit DECIMAL(15,2) DEFAULT 0,
            ADD COLUMN created_by INTEGER,
            ADD COLUMN branch_id INTEGER,
            ADD COLUMN approved_by INTEGER,
            ADD COLUMN approved_at TIMESTAMP
        `);
        // Migrate existing entries to 'posted' status
        await pool.query("UPDATE journal_entries SET status = 'posted' WHERE status = 'draft'");
      }

      // Enhance financial_periods
      const fpCols = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'financial_periods' AND column_name = 'fiscal_year_id'
      `);
      if (fpCols.rows.length === 0) {
        await pool.query(`
          ALTER TABLE financial_periods 
            ADD COLUMN fiscal_year_id INTEGER REFERENCES fiscal_years(id),
            ADD COLUMN start_date DATE,
            ADD COLUMN end_date DATE,
            ADD COLUMN closed_by INTEGER
        `);
      }

      // Seed default fiscal years (2026 and 2025) and monthly periods
      const currentYear = new Date().getFullYear();
      const yearsToSeed = [currentYear, currentYear - 1];

      for (const y of yearsToSeed) {
        const fyName = `السنة المالية ${y}`;
        const startDate = `${y}-01-01`;
        const endDate = `${y}-12-31`;
        const initialStatus = y === currentYear ? 'active' : 'closed';

        let fyId: number;
        const existingFY = await pool.query("SELECT id FROM fiscal_years WHERE name = $1 OR (start_date = $2 AND end_date = $3)", [fyName, startDate, endDate]);
        
        if (existingFY.rows.length === 0) {
          const insertRes = await pool.query(
            "INSERT INTO fiscal_years (name, start_date, end_date, status) VALUES ($1, $2, $3, $4) RETURNING id",
            [fyName, startDate, endDate, initialStatus]
          );
          fyId = insertRes.rows[0].id;
        } else {
          fyId = existingFY.rows[0].id;
        }

        // Seed 12 monthly financial periods for this year
        for (let m = 1; m <= 12; m++) {
          const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
          const monthEnd = new Date(y, m, 0).toISOString().split('T')[0];
          const periodStatus = y === currentYear ? (m <= 3 ? 'closed' : 'open') : 'closed';

          await pool.query(
            `INSERT INTO financial_periods (fiscal_year_id, month, year, status, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (month, year) DO UPDATE 
             SET fiscal_year_id = COALESCE(financial_periods.fiscal_year_id, EXCLUDED.fiscal_year_id),
                 start_date = COALESCE(financial_periods.start_date, EXCLUDED.start_date),
                 end_date = COALESCE(financial_periods.end_date, EXCLUDED.end_date)`,
            [fyId, m, y, periodStatus, monthStart, monthEnd]
          );
        }
      }

      // ═══ Fix: Normalize account_config keys to match auto-posting service ═══
      // The auto-posting service strips '_account' suffix, so keys must match.
      // We use UPSERT to both insert new keys and update existing ones.
      const configKeys = [
        ['sales_revenue', 'إيراد المبيعات'],
        ['sales_discount', 'خصومات المبيعات (حساب مقابل)'],
        ['sales_returns', 'مرتجعات المبيعات (حساب مقابل)'],
        ['cash', 'الصندوق والبنوك'],
        ['bank', 'الحسابات البنكية'],
        ['accounts_receivable', 'العملاء (المدينون)'],
        ['accounts_payable', 'الموردون (الدائنون)'],
        ['payroll_expense', 'مصروف المرتبات والأجور'],
        ['employee_advances', 'سلف الموظفين (أصول)'],
        ['inventory_asset', 'المخزون (أصل)'],
        ['cost_of_goods_sold', 'تكلفة البضاعة المباعة'],
        ['cost_expense', 'مصروفات تشغيلية عامة'],
        ['rent_expense', 'مصروف الإيجار'],
        ['utilities_expense', 'مصروف المرافق (كهرباء/مياه/غاز)'],
        ['maintenance_expense', 'مصروف الصيانة'],
        ['marketing_expense', 'مصروف التسويق والإعلان'],
        ['supplies_expense', 'مصروف المستلزمات'],
        ['insurance_expense', 'مصروف التأمين'],
        ['transport_expense', 'مصروف النقل والتوصيل'],
        ['food_revenue', 'إيراد مبيعات الأغذية'],
        ['delivery_revenue', 'إيراد التوصيل'],
        ['other_income', 'إيرادات أخرى'],
        ['other_expense', 'مصروفات أخرى'],
        ['refund_expense', 'مصروف المردودات والتعويضات'],
        ['tax_payable', 'الضرائب المستحقة (VAT)'],
        ['retained_earnings_account', 'أرباح محتجزة'],
        ['income_summary_account', 'قائمة الدخل (فترة إقفال)'],
      ];
      for (const [key, desc] of configKeys) {
        await pool.query(
          `INSERT INTO account_config (key, description) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
          [key, desc]
        );
      }

      // Seed document sequences
      const seqs = [
        ['journal_entry', 'JE', 6, 'yearly'],
        ['receipt_voucher', 'RV', 6, 'yearly'],
        ['payment_voucher', 'PV', 6, 'yearly'],
      ];
      for (const [docType, prefix, padding, period] of seqs) {
        await pool.query(
          "INSERT INTO document_sequences (document_type, prefix, padding, reset_period) VALUES ($1, $2, $3, $4) ON CONFLICT (document_type) DO NOTHING",
          [docType, prefix, padding, period]
        );
      }

      // ═══ Add financial columns to complaints table ═══
      const complaintCols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'complaints' AND column_name = 'refund_amount'
      `);
      if (complaintCols.rows.length === 0) {
        await pool.query(`
          ALTER TABLE complaints
            ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0,
            ADD COLUMN compensation_amount DECIMAL(10,2) DEFAULT 0,
            ADD COLUMN compensation_type TEXT
        `);
      }

      // ═══ Add unit_cost to inventory_items for stock valuation ═══
      const invCols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'inventory_items' AND column_name = 'unit_cost'
      `);
      if (invCols.rows.length === 0) {
        await pool.query(`
          ALTER TABLE inventory_items
            ADD COLUMN unit_cost DECIMAL(10,2) DEFAULT 0
        `);
      }

      // ═══ GL Performance Indexes ═══
      const glIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_je_date_source ON journal_entries(date, source_type)',
        'CREATE INDEX IF NOT EXISTS idx_je_period_status ON journal_entries(period_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source_type, source_id)',
        'CREATE INDEX IF NOT EXISTS idx_ji_entry_account ON journal_items(journal_entry_id, account_id)',
        'CREATE INDEX IF NOT EXISTS idx_ji_account ON journal_items(account_id)',
        'CREATE INDEX IF NOT EXISTS idx_fp_status ON financial_periods(status)',
        'CREATE INDEX IF NOT EXISTS idx_budgets_fy ON budgets(fiscal_year_id, account_id)',
        'CREATE INDEX IF NOT EXISTS idx_subledger_partner ON sub_ledger_entries(partner_type, partner_id)',
      ];
      for (const idxSql of glIndexes) {
        try { await pool.query(idxSql); } catch (e) { /* index might already exist */ }
      }

      // ═══ Seed Default Chart of Accounts (if empty) ═══
      const accountCount = await pool.query('SELECT COUNT(*) FROM accounts');
      if (parseInt(accountCount.rows[0].count) === 0) {
        console.log('  📊 Seeding default Chart of Accounts...');
        const defaultAccounts = [
          // ═══ ASSETS (1xxx) ═══
          { code: '1', name: 'الأصول', name_ar: 'الأصول', name_en: 'Assets', type: 'asset', account_type: 'header', account_nature: 'debit', level: 1, is_leaf: false, parent_id: null },
          { code: '11', name: 'أصول متداولة', name_ar: 'أصول متداولة', name_en: 'Current Assets', type: 'asset', account_type: 'sub_header', account_nature: 'debit', level: 2, is_leaf: false, parent_id: 1 },
          { code: '1101', name: 'الصندوق والبنوك', name_ar: 'الصندوق والبنوك', name_en: 'Cash & Banks', type: 'asset', account_type: 'cash', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 2 },
          { code: '1102', name: 'العملاء', name_ar: 'العملاء (المدينون)', name_en: 'Accounts Receivable', type: 'asset', account_type: 'receivable', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 2 },
          { code: '1103', name: 'المخزون', name_ar: 'المخزون', name_en: 'Inventory', type: 'asset', account_type: 'inventory', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 2 },
          { code: '1104', name: 'سلف الموظفين', name_ar: 'سلف الموظفين', name_en: 'Employee Advances', type: 'asset', account_type: 'other', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 2 },
          { code: '1105', name: 'مصروفات مدفوعة مقدماً', name_ar: 'مصروفات مدفوعة مقدماً', name_en: 'Prepaid Expenses', type: 'asset', account_type: 'prepaid', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 2 },
          { code: '12', name: 'أصول ثابتة', name_ar: 'أصول ثابتة', name_en: 'Fixed Assets', type: 'asset', account_type: 'sub_header', account_nature: 'debit', level: 2, is_leaf: false, parent_id: 1 },
          { code: '1201', name: 'المعدات والأثاث', name_ar: 'المعدات والأثاث', name_en: 'Equipment & Furniture', type: 'asset', account_type: 'fixed', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 8 },
          { code: '1202', name: 'مجمع الإهلاك', name_ar: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'asset', account_type: 'contra_asset', account_nature: 'credit', level: 3, is_leaf: true, parent_id: 8 },
          // ═══ LIABILITIES (2xxx) ═══
          { code: '2', name: 'الخصوم', name_ar: 'الخصوم', name_en: 'Liabilities', type: 'liability', account_type: 'header', account_nature: 'credit', level: 1, is_leaf: false, parent_id: null },
          { code: '21', name: 'خصوم متداولة', name_ar: 'خصوم متداولة', name_en: 'Current Liabilities', type: 'liability', account_type: 'sub_header', account_nature: 'credit', level: 2, is_leaf: false, parent_id: 11 },
          { code: '2101', name: 'الموردون', name_ar: 'الموردون (الدائنون)', name_en: 'Accounts Payable', type: 'liability', account_type: 'payable', account_nature: 'credit', level: 3, is_leaf: true, parent_id: 12 },
          { code: '2102', name: 'مرتبات مستحقة', name_ar: 'مرتبات مستحقة', name_en: 'Salaries Payable', type: 'liability', account_type: 'accrued', account_nature: 'credit', level: 3, is_leaf: true, parent_id: 12 },
          { code: '2103', name: 'ضرائب مستحقة', name_ar: 'ضريبة القيمة المضافة', name_en: 'VAT Payable', type: 'liability', account_type: 'tax', account_nature: 'credit', level: 3, is_leaf: true, parent_id: 12 },
          { code: '2104', name: 'مصروفات مستحقة', name_ar: 'مصروفات مستحقة', name_en: 'Accrued Expenses', type: 'liability', account_type: 'accrued', account_nature: 'credit', level: 3, is_leaf: true, parent_id: 12 },
          { code: '2105', name: 'تأمينات وعرابين النزلاء', name_ar: 'تأمينات وعرابين النزلاء', name_en: 'Hotel Advance Deposits', type: 'liability', account_type: 'accrued', account_nature: 'credit', level: 3, is_leaf: true, parent_id: 12 },
          { code: '1106', name: 'حسابات النزلاء والغرف', name_ar: 'حسابات النزلاء والغرف', name_en: 'Guest Accounts Receivable', type: 'asset', account_type: 'receivable', account_nature: 'debit', level: 3, is_leaf: true, parent_id: 2 },
          // ═══ EQUITY (3xxx) ═══
          { code: '3', name: 'حقوق الملكية', name_ar: 'حقوق الملكية', name_en: 'Equity', type: 'equity', account_type: 'header', account_nature: 'credit', level: 1, is_leaf: false, parent_id: null },
          { code: '3101', name: 'رأس المال', name_ar: 'رأس المال', name_en: 'Capital', type: 'equity', account_type: 'capital', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 17 },
          { code: '3102', name: 'أرباح محتجزة', name_ar: 'أرباح محتجزة', name_en: 'Retained Earnings', type: 'equity', account_type: 'retained', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 17 },
          { code: '3103', name: 'قائمة الدخل', name_ar: 'قائمة الدخل', name_en: 'Income Summary', type: 'equity', account_type: 'summary', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 17 },
          // ═══ REVENUE (4xxx) ═══
          { code: '4', name: 'الإيرادات', name_ar: 'الإيرادات', name_en: 'Revenue', type: 'revenue', account_type: 'header', account_nature: 'credit', level: 1, is_leaf: false, parent_id: null },
          { code: '4101', name: 'إيراد مبيعات الأغذية', name_ar: 'إيراد مبيعات الأغذية', name_en: 'Food Sales Revenue', type: 'revenue', account_type: 'sales', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4102', name: 'إيراد المبيعات العامة', name_ar: 'إيراد المبيعات العامة', name_en: 'General Sales Revenue', type: 'revenue', account_type: 'sales', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4103', name: 'إيراد التوصيل', name_ar: 'إيراد التوصيل', name_en: 'Delivery Revenue', type: 'revenue', account_type: 'service', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4104', name: 'إيرادات أخرى', name_ar: 'إيرادات أخرى', name_en: 'Other Income', type: 'revenue', account_type: 'other', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4105', name: 'إيراد مبيعات وحجز الغرف', name_ar: 'إيراد مبيعات وحجز الغرف', name_en: 'Hotel Room Revenue', type: 'revenue', account_type: 'sales', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4106', name: 'إيراد الخدمات الفندقية والمغسلة', name_ar: 'إيراد الخدمات الفندقية والمغسلة', name_en: 'Hotel Service Revenue', type: 'revenue', account_type: 'service', account_nature: 'credit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4201', name: 'خصومات المبيعات', name_ar: 'خصومات المبيعات', name_en: 'Sales Discounts', type: 'revenue', account_type: 'contra_revenue', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 21 },
          { code: '4202', name: 'مرتجعات المبيعات', name_ar: 'مرتجعات المبيعات', name_en: 'Sales Returns', type: 'revenue', account_type: 'contra_revenue', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 21 },
          // ═══ EXPENSES (5xxx) ═══
          { code: '5', name: 'المصروفات', name_ar: 'المصروفات', name_en: 'Expenses', type: 'expense', account_type: 'header', account_nature: 'debit', level: 1, is_leaf: false, parent_id: null },
          { code: '5101', name: 'تكلفة البضاعة المباعة', name_ar: 'تكلفة البضاعة المباعة', name_en: 'Cost of Goods Sold', type: 'expense', account_type: 'cogs', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5102', name: 'مرتبات وأجور', name_ar: 'مرتبات وأجور', name_en: 'Salaries & Wages', type: 'expense', account_type: 'payroll', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5103', name: 'إيجار', name_ar: 'مصروف الإيجار', name_en: 'Rent Expense', type: 'expense', account_type: 'rent', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5104', name: 'مرافق (كهرباء/مياه/غاز)', name_ar: 'مرافق', name_en: 'Utilities', type: 'expense', account_type: 'utilities', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5105', name: 'صيانة', name_ar: 'مصروف الصيانة', name_en: 'Maintenance', type: 'expense', account_type: 'maintenance', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5106', name: 'تسويق وإعلان', name_ar: 'تسويق وإعلان', name_en: 'Marketing', type: 'expense', account_type: 'marketing', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5107', name: 'مستلزمات', name_ar: 'مصروف المستلزمات', name_en: 'Supplies', type: 'expense', account_type: 'supplies', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5108', name: 'تأمين', name_ar: 'مصروف التأمين', name_en: 'Insurance', type: 'expense', account_type: 'insurance', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5109', name: 'نقل وتوصيل', name_ar: 'نقل وتوصيل', name_en: 'Transport', type: 'expense', account_type: 'transport', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5110', name: 'مصروفات تشغيلية أخرى', name_ar: 'مصروفات أخرى', name_en: 'Other Expenses', type: 'expense', account_type: 'other', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5111', name: 'مردودات وتعويضات', name_ar: 'مردودات وتعويضات', name_en: 'Refunds & Compensation', type: 'expense', account_type: 'refund', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
          { code: '5112', name: 'مصروفات صيانة الغرف الفندقية', name_ar: 'مصروفات صيانة الغرف الفندقية', name_en: 'Hotel Maintenance Expense', type: 'expense', account_type: 'maintenance', account_nature: 'debit', level: 2, is_leaf: true, parent_id: 28 },
        ];

        for (const acc of defaultAccounts) {
          await pool.query(`
            INSERT INTO accounts (code, name, name_ar, name_en, type, account_type, account_nature, level, is_leaf, parent_id, balance, status, allow_posting)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, true, $11)
          `, [acc.code, acc.name, acc.name_ar, acc.name_en, acc.type, acc.account_type, acc.account_nature, acc.level, acc.is_leaf, acc.parent_id, acc.is_leaf]);
        }

        // ═══ Auto-link account_config to seeded accounts ═══
        const configAccountMap: Record<string, string> = {
          'cash': '111',
          'bank': '112',
          'accounts_receivable': '113',
          'inventory_asset': '114',
          'raw_materials_inventory': '114',
          'finished_goods_inventory': '114',
          'work_in_progress': '114',
          'employee_advances': '111',
          'accounts_payable': '211',
          'tax_payable': '213',
          'retained_earnings_account': '31',
          'income_summary_account': '31',
          'food_revenue': '41',
          'sales_revenue': '41',
          'delivery_revenue': '41',
          'other_income': '41',
          'sales_discount': '41',
          'sales_returns': '41',
          'cost_of_goods_sold': '51',
          'cost_expense': '51',
          'payroll_expense': '52',
          'salary_expense': '52',
          'rent_expense': '51',
          'utilities_expense': '51',
          'maintenance_expense': '51',
          'marketing_expense': '51',
          'supplies_expense': '51',
          'insurance_expense': '51',
          'transport_expense': '51',
          'other_expense': '51',
          'refund_expense': '51',
        };

        for (const [configKey, accountCode] of Object.entries(configAccountMap)) {
          const accResult = await pool.query('SELECT id FROM accounts WHERE code = $1', [accountCode]);
          if (accResult.rows.length > 0) {
            const accountId = accResult.rows[0].id;
            await pool.query(
              'UPDATE account_config SET account_id = $1 WHERE key = $2 AND account_id IS NULL',
              [accountId, configKey]
            );
          }
        }

        // Cost centers are managed dynamically by user operations - no automatic demo seeding

        // Seed current year financial periods (open)
        const cYear = new Date().getFullYear();
        const cMonth = new Date().getMonth() + 1;
        for (let m = 1; m <= 12; m++) {
          await pool.query(
            `INSERT INTO financial_periods (month, year, status)
             VALUES ($1, $2, $3)
             ON CONFLICT (month, year) DO NOTHING`,
            [m, cYear, m <= cMonth ? 'open' : 'closed']
          );
        }

        // Link periods to fiscal year
        const fyResult = await pool.query("SELECT id FROM fiscal_years WHERE name = $1", [`FY ${cYear}`]);
        if (fyResult.rows.length > 0) {
          const fyId = fyResult.rows[0].id;
          await pool.query(
            'UPDATE financial_periods SET fiscal_year_id = $1 WHERE year = $2 AND fiscal_year_id IS NULL',
            [fyId, cYear]
          );
        }

        console.log('  ✅ Default Chart of Accounts seeded');
      }

      // Ensure account_config is always linked even on existing DB runs
      const alwaysConfigMap: Record<string, string> = {
        'cash': '111',
        'bank': '112',
        'accounts_receivable': '113',
        'inventory_asset': '114',
        'raw_materials_inventory': '114',
        'finished_goods_inventory': '114',
        'work_in_progress': '114',
        'employee_advances': '111',
        'accounts_payable': '211',
        'tax_payable': '213',
        'retained_earnings_account': '31',
        'income_summary_account': '31',
        'food_revenue': '41',
        'sales_revenue': '41',
        'cost_of_goods_sold': '51',
        'cost_expense': '51',
        'payroll_expense': '52',
      };
      for (const [key, code] of Object.entries(alwaysConfigMap)) {
        const acc = await pool.query('SELECT id FROM accounts WHERE code = $1', [code]);
        if (acc.rows.length > 0) {
          await pool.query(
            `INSERT INTO account_config (key, account_id, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET account_id = COALESCE(account_config.account_id, EXCLUDED.account_id)`,
            [key, acc.rows[0].id, key]
          );
        }
      }

      await ensureSalesPostingAccounts(pool);
      console.log('  ✅ ERP Accounting enhancements applied');
    } catch (e: any) {
      console.error("  ⚠️  ERP Accounting enhancement warning:", e.message);
    }

    console.log("Database initialized successfully");
    
    // Apply critical fixes to settings
    try {
      await pool.query("INSERT INTO settings (key, value) VALUES ('receipt_reverse_arabic', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'");
      await pool.query("INSERT INTO settings (key, value) VALUES ('receipt_reverse_arabic_internal', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'");
      await pool.query("INSERT INTO settings (key, value) VALUES ('receipt_code_page_internal', '42') ON CONFLICT (key) DO UPDATE SET value = '42'");
      await pool.query("INSERT INTO settings (key, value) VALUES ('receipt_printer_width_internal', '32') ON CONFLICT (key) DO UPDATE SET value = '32'");
      console.log("Settings patched to enable Arabic reversal and internal printer defaults.");
    } catch (err) {
      console.error("Error patching settings:", err);
    }

    // Add missing columns to suppliers table (migration for existing DBs)
    try {
      const supplierColumns = [
        { col: 'phone_2', type: 'TEXT' },
        { col: 'email', type: 'TEXT' },
        { col: 'commercial_register', type: 'TEXT' },
        { col: 'tax_number', type: 'TEXT' },
        { col: 'group_name', type: 'TEXT' },
        { col: 'payment_terms', type: "TEXT DEFAULT 'cash'" },
        { col: 'credit_limit', type: 'DECIMAL(12,2) DEFAULT 0' },
        { col: 'opening_balance', type: 'DECIMAL(12,2) DEFAULT 0' },
        { col: 'rating', type: 'INTEGER DEFAULT 0' },
        { col: 'status', type: "TEXT DEFAULT 'active'" },
        { col: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      ];
      for (const col of supplierColumns) {
        await pool.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ${col.col} ${col.type}`);
      }
      console.log("Suppliers table columns verified/added.");
    } catch (err) {
      console.error("Error adding columns to suppliers table:", err);
    }

    // ═══════════════════════════════════════════════════════════
    // APPROVAL SYSTEM TABLES
    // ═══════════════════════════════════════════════════════════
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS approval_requests (
          id SERIAL PRIMARY KEY,
          module_type TEXT NOT NULL,
          reference_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          requested_by TEXT NOT NULL,
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          approved_by TEXT,
          approved_at TIMESTAMP,
          rejection_reason TEXT,
          priority TEXT DEFAULT 'normal',
          approval_notes TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS approval_settings (
          id SERIAL PRIMARY KEY,
          module_type TEXT UNIQUE NOT NULL,
          requires_approval BOOLEAN DEFAULT true,
          min_approver_role TEXT DEFAULT 'admin',
          auto_approve_below DECIMAL(10,2) DEFAULT 0,
          notify_on_request BOOLEAN DEFAULT true,
          notify_on_approve BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Seed default approval settings for modules that need approval
      const existingSettings = await pool.query("SELECT module_type FROM approval_settings");
      const existingTypes = existingSettings.rows.map((r: any) => r.module_type);
      const defaultModules = [
        { module_type: 'purchase_order', min_approver_role: 'manager' },
        { module_type: 'purchase_return', min_approver_role: 'manager' },
        { module_type: 'operating_cost', min_approver_role: 'manager' },
        { module_type: 'sales_return', min_approver_role: 'manager' },
        { module_type: 'journal_entry', min_approver_role: 'accountant' },
        { module_type: 'treasury_transaction', min_approver_role: 'manager' },
      ];
      for (const mod of defaultModules) {
        if (!existingTypes.includes(mod.module_type)) {
          await pool.query(
            `INSERT INTO approval_settings (module_type, min_approver_role) VALUES ($1, $2)`,
            [mod.module_type, mod.min_approver_role]
          );
        }
      }

      // ALTER purchase_orders to add approval columns
      const poCols = [
        { col: 'requested_by', type: 'TEXT' },
        { col: 'approved_by', type: 'TEXT' },
        { col: 'approved_at', type: 'TIMESTAMP' },
      ];
      for (const c of poCols) {
        await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ${c.col} ${c.type}`);
      }

      console.log("Approval system tables verified/created.");
    } catch (err) {
      console.error("Error creating approval system tables:", err);
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS warehouse_stock_alerts (
          id SERIAL PRIMARY KEY,
          warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
          ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
          alert_type TEXT NOT NULL DEFAULT 'low_stock',
          threshold DECIMAL(10,2) DEFAULT 0,
          current_quantity DECIMAL(10,2) DEFAULT 0,
          is_resolved INTEGER DEFAULT 0,
          resolved_by INTEGER,
          resolved_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Table 'warehouse_stock_alerts' verified/created.");
    } catch (err) {
      console.error("Error creating warehouse_stock_alerts table:", err);
    }

    // Add ingredient_id, warehouse_id and properties columns to products table if they do not exist
    try {
      await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredient_id INTEGER;");
      await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_id INTEGER;");
      await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS properties TEXT;");
      console.log("Database columns 'ingredient_id', 'warehouse_id' and 'properties' verified/added to 'products' table.");

      // Ensure product_ingredients table has safe defaults and no restrictive NOT NULL constraints on optional metadata
      try {
        await pool.query("ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS size_name TEXT DEFAULT '';");
        await pool.query("ALTER TABLE product_ingredients ALTER COLUMN size_name DROP NOT NULL;");
        await pool.query("ALTER TABLE product_ingredients ALTER COLUMN size_name SET DEFAULT '';");
      } catch (_) {}
      try {
        await pool.query("ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS waste_percent DECIMAL(5,2) DEFAULT 0;");
        await pool.query("ALTER TABLE product_ingredients ALTER COLUMN waste_percent DROP NOT NULL;");
        await pool.query("ALTER TABLE product_ingredients ALTER COLUMN waste_percent SET DEFAULT 0;");
      } catch (_) {}
      try {
        await pool.query("ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '';");
        await pool.query("ALTER TABLE product_ingredients ALTER COLUMN unit DROP NOT NULL;");
        await pool.query("ALTER TABLE product_ingredients ALTER COLUMN unit SET DEFAULT '';");
      } catch (_) {}

      // Auto-link existing products to inventory Master Items if not yet linked
      const unlinkedProducts = await pool.query("SELECT id, name, properties FROM products WHERE ingredient_id IS NULL");
      for (const prod of (unlinkedProducts.rows || [])) {
        // 1. Check if single recipe item exists in product_ingredients
        const piRes = await pool.query("SELECT ingredient_id FROM product_ingredients WHERE product_id = $1", [prod.id]);
        if (piRes.rows && piRes.rows.length === 1 && piRes.rows[0].ingredient_id) {
          await pool.query("UPDATE products SET ingredient_id = $1 WHERE id = $2", [piRes.rows[0].ingredient_id, prod.id]);
          continue;
        }
        // 2. Check by name in ingredients table
        if (prod.name) {
          const ingMatch = await pool.query("SELECT id FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1", [prod.name]);
          if (ingMatch.rows && ingMatch.rows.length > 0) {
            const matchedIngId = ingMatch.rows[0].id;
            await pool.query("UPDATE products SET ingredient_id = $1 WHERE id = $2", [matchedIngId, prod.id]);
            const hasPi = await pool.query("SELECT 1 FROM product_ingredients WHERE product_id = $1 AND ingredient_id = $2 LIMIT 1", [prod.id, matchedIngId]);
            if (!hasPi.rows || hasPi.rows.length === 0) {
              await pool.query("INSERT INTO product_ingredients (product_id, ingredient_id, quantity, size_name, waste_percent) VALUES ($1, $2, 1, '', 0)", [prod.id, matchedIngId]).catch(async () => {
                await pool.query("INSERT INTO product_ingredients (product_id, ingredient_id, quantity) VALUES ($1, $2, 1)", [prod.id, matchedIngId]);
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error setting up products ingredient_id columns/links:", err);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ERP ENTERPRISE EXTENSION — NEW TABLES
    // ═══════════════════════════════════════════════════════════════════

    // ─── 1. MULTI-COMPANY ───────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS companies (
          id SERIAL PRIMARY KEY,
          code VARCHAR(20) UNIQUE NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          tax_number VARCHAR(100),
          commercial_register VARCHAR(100),
          logo_url TEXT,
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100) DEFAULT 'مصر',
          phone VARCHAR(50),
          email VARCHAR(100),
          website VARCHAR(255),
          fiscal_year_start VARCHAR(20) DEFAULT '01',
          currency VARCHAR(10) DEFAULT 'EGP',
          is_active BOOLEAN DEFAULT true,
          default_branch_id INTEGER,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (default_branch_id) REFERENCES branches(id)
        )
      `);
      // Link branches to companies
      await pool.query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`);
      // Link users to companies
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`);
      console.log("Enterprise: companies table verified/created.");
    } catch (err) {
      console.error("Error creating companies table:", err);
    }

    // ─── 2. ROLES & PERMISSIONS (Enhanced RBAC) ───────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS roles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          name_ar VARCHAR(255),
          description TEXT,
          company_id INTEGER,
          is_system BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id SERIAL PRIMARY KEY,
          role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          permission_key VARCHAR(200) NOT NULL,
          is_granted BOOLEAN DEFAULT true,
          limits JSONB DEFAULT '{}',
          UNIQUE(role_id, permission_key)
        )
      `);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)`);
      // Seed default roles
      const existingRoles = await pool.query("SELECT name FROM roles");
      const roleNames = existingRoles.rows.map((r: any) => r.name);
      const defaultRoles = [
        { name: 'admin', name_ar: 'مدير النظام', description: 'صلاحيات كاملة على كل شيء', is_system: true },
        { name: 'manager', name_ar: 'مدير فرع', description: 'إدارة الفرع والعمليات اليومية', is_system: true },
        { name: 'accountant', name_ar: 'محاسب', description: 'الوصول للمحاسبة والخزينة والتقارير المالية', is_system: true },
        { name: 'cashier', name_ar: 'كاشير', description: 'شاشة نقطة البيع والفواتير', is_system: true },
        { name: 'inventory_keeper', name_ar: 'أمين مخزن', description: 'إدارة المخزون والمستودعات', is_system: true },
        { name: 'purchasing', name_ar: 'مشتريات', description: 'طلبات الشراء والموردين', is_system: true },
        { name: 'hr_manager', name_ar: 'مدير موارد بشرية', description: 'إدارة الموظفين والرواتب', is_system: true },
        { name: 'production_manager', name_ar: 'مدير إنتاج', description: 'إدارة خطوط الإنتاج', is_system: true },
        { name: 'viewer', name_ar: 'مشاهد فقط', description: 'عرض التقارير بدون تعديل', is_system: true },
      ];
      for (const r of defaultRoles) {
        if (!roleNames.includes(r.name)) {
          await pool.query(
            `INSERT INTO roles (name, name_ar, description, is_system) VALUES ($1, $2, $3, $4)`,
            [r.name, r.name_ar, r.description, r.is_system]
          );
        }
      }
      console.log("Enterprise: roles & role_permissions tables verified/created.");
    } catch (err) {
      console.error("Error creating roles tables:", err);
    }

    // ─── 3. INVENTORY — BATCH / LOT TRACKING ──────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS batch_tracking (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
          warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
          batch_number VARCHAR(100) NOT NULL,
          supplier_id INTEGER REFERENCES suppliers(id),
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit_cost DECIMAL(12,2) DEFAULT 0,
          manufacturing_date DATE,
          expiry_date DATE,
          received_date DATE DEFAULT CURRENT_DATE,
          notes TEXT,
          status VARCHAR(20) DEFAULT 'available',
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_batch_ingredient ON batch_tracking(ingredient_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_batch_warehouse ON batch_tracking(warehouse_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_batch_expiry ON batch_tracking(expiry_date)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_tracking_ing_wh_batch ON batch_tracking(ingredient_id, warehouse_id, batch_number)`);
      console.log("Enterprise: batch_tracking table verified/created.");
    } catch (err) {
      console.error("Error creating batch_tracking table:", err);
    }

    // ─── 4. INVENTORY — REORDERING RULES ─────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reordering_rules (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
          warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
          min_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          max_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          reorder_point DECIMAL(12,3) NOT NULL DEFAULT 0,
          economic_order_qty DECIMAL(12,3) DEFAULT 0,
          lead_time_days INTEGER DEFAULT 0,
          safety_stock DECIMAL(12,3) DEFAULT 0,
          supplier_id INTEGER REFERENCES suppliers(id),
          is_active BOOLEAN DEFAULT true,
          last_purchase_date DATE,
          avg_daily_usage DECIMAL(12,3) DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: reordering_rules table verified/created.");
    } catch (err) {
      console.error("Error creating reordering_rules table:", err);
    }

    // ─── 5. INVENTORY — STOCK VALUATION ──────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_valuation (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
          warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
          valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
          quantity_on_hand DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
          total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
          valuation_method VARCHAR(20) DEFAULT 'avg',
          reference_type VARCHAR(50),
          reference_id VARCHAR(100),
          production_order VARCHAR(100),
          production_receipt VARCHAR(100),
          cost_components TEXT,
          notes TEXT,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try {
        await pool.query(`ALTER TABLE stock_valuation ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`);
        await pool.query(`ALTER TABLE stock_valuation ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100)`);
        await pool.query(`ALTER TABLE stock_valuation ADD COLUMN IF NOT EXISTS production_order VARCHAR(100)`);
        await pool.query(`ALTER TABLE stock_valuation ADD COLUMN IF NOT EXISTS production_receipt VARCHAR(100)`);
        await pool.query(`ALTER TABLE stock_valuation ADD COLUMN IF NOT EXISTS cost_components TEXT`);
      } catch (_) {}
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_val_date ON stock_valuation(valuation_date)`);
      console.log("Enterprise: stock_valuation table verified/created.");
    } catch (err) {
      console.error("Error creating stock_valuation table:", err);
    }

    // ─── 6. PRODUCTION — BOM (Bill of Materials) ──────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS production_boms (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          bom_code VARCHAR(50) UNIQUE,
          version TEXT DEFAULT 'v1.0',
          total_cost DECIMAL(12,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'draft',
          effective_date DATE,
          notes TEXT,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bom_items (
          id SERIAL PRIMARY KEY,
          bom_id TEXT NOT NULL REFERENCES production_boms(id) ON DELETE CASCADE,
          ingredient_id TEXT NOT NULL,
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit VARCHAR(50),
          unit_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          is_optional BOOLEAN DEFAULT false,
          notes TEXT,
          sort_order INTEGER DEFAULT 0
        )
      `);
      try {
        await pool.query("ALTER TABLE bom_items DROP CONSTRAINT IF EXISTS bom_items_ingredient_id_fkey");
        await pool.query("ALTER TABLE production_boms ALTER COLUMN product_id TYPE TEXT USING product_id::text");
        await pool.query("ALTER TABLE bom_items ALTER COLUMN ingredient_id TYPE TEXT USING ingredient_id::text");
        await pool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(14,4) DEFAULT 0");
      } catch (_) {}
      console.log("Enterprise: production_boms & bom_items tables verified/created.");
    } catch (err) {
      console.error("Error creating BOM tables:", err);
    }

    // ─── 7. PRODUCTION — WORK CENTERS ────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_centers (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          name_ar VARCHAR(255),
          branch_id INTEGER REFERENCES branches(id),
          warehouse_id INTEGER REFERENCES warehouses(id),
          cost_per_hour DECIMAL(12,2) DEFAULT 0,
          capacity INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT true,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: work_centers table verified/created.");
    } catch (err) {
      console.error("Error creating work_centers table:", err);
    }

    // ─── 8. PRODUCTION — MANUFACTURING ORDERS ────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS manufacturing_orders (
          id SERIAL PRIMARY KEY,
          mo_number VARCHAR(50) UNIQUE NOT NULL,
          bom_id TEXT REFERENCES production_boms(id),
          product_id INTEGER,
          product_name VARCHAR(255),
          work_center_id INTEGER REFERENCES work_centers(id),
          quantity_planned DECIMAL(12,3) NOT NULL DEFAULT 0,
          quantity_produced DECIMAL(12,3) DEFAULT 0,
          quantity_scrapped DECIMAL(12,3) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'planned',
          priority VARCHAR(10) DEFAULT 'normal',
          planned_start DATE,
          planned_end DATE,
          actual_start TIMESTAMP,
          actual_end TIMESTAMP,
          total_material_cost DECIMAL(12,2) DEFAULT 0,
          total_labor_cost DECIMAL(12,2) DEFAULT 0,
          total_overhead_cost DECIMAL(12,2) DEFAULT 0,
          branch_id INTEGER REFERENCES branches(id),
          notes TEXT,
          created_by INTEGER,
          approval_request_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS manufacturing_order_items (
          id SERIAL PRIMARY KEY,
          mo_id INTEGER NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
          ingredient_id INTEGER REFERENCES ingredients(id),
          ingredient_name VARCHAR(255),
          planned_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
          consumed_qty DECIMAL(12,3) DEFAULT 0,
          unit_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          warehouse_id INTEGER REFERENCES warehouses(id)
        )
      `);
      console.log("Enterprise: manufacturing_orders tables verified/created.");
    } catch (err) {
      console.error("Error creating manufacturing_orders tables:", err);
    }

    // ─── 9. PRODUCTION — ROUTING ──────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS production_routing (
          id SERIAL PRIMARY KEY,
          bom_id TEXT REFERENCES production_boms(id) ON DELETE CASCADE,
          work_center_id INTEGER REFERENCES work_centers(id),
          operation_name VARCHAR(255) NOT NULL,
          sequence INTEGER NOT NULL DEFAULT 1,
          estimated_time_min DECIMAL(8,2) DEFAULT 0,
          setup_time_min DECIMAL(8,2) DEFAULT 0,
          labor_cost DECIMAL(12,2) DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: production_routing table verified/created.");
    } catch (err) {
      console.error("Error creating production_routing table:", err);
    }

    // Production services use stable string BOM IDs, while older databases
    // created all linked BOM columns as INTEGER. Convert the set together.
    try {
      await pool.query(`ALTER TABLE bom_items DROP CONSTRAINT IF EXISTS bom_items_bom_id_fkey`);
      await pool.query(`ALTER TABLE manufacturing_orders DROP CONSTRAINT IF EXISTS manufacturing_orders_bom_id_fkey`);
      await pool.query(`ALTER TABLE production_routing DROP CONSTRAINT IF EXISTS production_routing_bom_id_fkey`);
      await pool.query(`ALTER TABLE production_boms ALTER COLUMN id TYPE TEXT USING id::text`);
      await pool.query(`ALTER TABLE bom_items ALTER COLUMN bom_id TYPE TEXT USING bom_id::text`);
      await pool.query(`ALTER TABLE manufacturing_orders ALTER COLUMN bom_id TYPE TEXT USING bom_id::text`);
      await pool.query(`ALTER TABLE production_routing ALTER COLUMN bom_id TYPE TEXT USING bom_id::text`);
      await pool.query(`ALTER TABLE bom_items ADD CONSTRAINT bom_items_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES production_boms(id) ON DELETE CASCADE`);
      await pool.query(`ALTER TABLE manufacturing_orders ADD CONSTRAINT manufacturing_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES production_boms(id)`);
      await pool.query(`ALTER TABLE production_routing ADD CONSTRAINT production_routing_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES production_boms(id) ON DELETE CASCADE`);
      console.log("✅ Production BOM identifiers migrated to TEXT.");
    } catch (bomMigrationError: any) {
      console.error("❌ Production BOM identifier migration failed:", bomMigrationError?.message || bomMigrationError);
    }

    // ─── 10. PRODUCTION — QUALITY CONTROL ────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS quality_checks (
          id SERIAL PRIMARY KEY,
          mo_id INTEGER REFERENCES manufacturing_orders(id),
          product_id INTEGER,
          product_name VARCHAR(255),
          work_center_id INTEGER REFERENCES work_centers(id),
          check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checked_by INTEGER,
          total_checked INTEGER DEFAULT 0,
          passed INTEGER DEFAULT 0,
          failed INTEGER DEFAULT 0,
          pass_rate DECIMAL(5,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'passed',
          defects TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: quality_checks table verified/created.");
    } catch (err) {
      console.error("Error creating quality_checks table:", err);
    }

    // ─── 11. PRODUCTION — SCRAP MANAGEMENT ───────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scrap_records (
          id SERIAL PRIMARY KEY,
          mo_id INTEGER REFERENCES manufacturing_orders(id),
          ingredient_id INTEGER REFERENCES ingredients(id),
          ingredient_name VARCHAR(255),
          warehouse_id INTEGER REFERENCES warehouses(id),
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          reason TEXT,
          scrapped_by INTEGER,
          scrapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      console.log("Enterprise: scrap_records table verified/created.");
    } catch (err) {
      console.error("Error creating scrap_records table:", err);
    }

    // ─── 12. MAINTENANCE — ASSETS ────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS maintenance_assets (
          id SERIAL PRIMARY KEY,
          asset_code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          name_ar VARCHAR(255),
          category VARCHAR(100),
          brand VARCHAR(100),
          model VARCHAR(100),
          serial_number VARCHAR(100),
          location TEXT,
          branch_id INTEGER REFERENCES branches(id),
          work_center_id INTEGER REFERENCES work_centers(id),
          purchase_date DATE,
          purchase_cost DECIMAL(12,2) DEFAULT 0,
          current_value DECIMAL(12,2) DEFAULT 0,
          depreciation_rate DECIMAL(5,2) DEFAULT 0,
          warranty_end DATE,
          status VARCHAR(20) DEFAULT 'active',
          supplier_id INTEGER REFERENCES suppliers(id),
          specification TEXT,
          image_url TEXT,
          notes TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: maintenance_assets table verified/created.");
    } catch (err) {
      console.error("Error creating maintenance_assets table:", err);
    }

    // ─── 13. MAINTENANCE — REQUESTS & WORK ORDERS ────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS maintenance_requests (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES maintenance_assets(id),
          request_type VARCHAR(20) DEFAULT 'corrective',
          priority VARCHAR(10) DEFAULT 'normal',
          description TEXT NOT NULL,
          reported_by INTEGER,
          assigned_to INTEGER,
          status VARCHAR(20) DEFAULT 'open',
          branch_id INTEGER REFERENCES branches(id),
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_date DATE,
          completed_at TIMESTAMP,
          estimated_cost DECIMAL(12,2) DEFAULT 0,
          actual_cost DECIMAL(12,2) DEFAULT 0,
          approval_request_id INTEGER,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS maintenance_work_orders (
          id SERIAL PRIMARY KEY,
          wo_number VARCHAR(50) UNIQUE NOT NULL,
          request_id INTEGER REFERENCES maintenance_requests(id),
          asset_id INTEGER NOT NULL REFERENCES maintenance_assets(id),
          work_center_id INTEGER REFERENCES work_centers(id),
          description TEXT,
          priority VARCHAR(10) DEFAULT 'normal',
          status VARCHAR(20) DEFAULT 'pending',
          assigned_to INTEGER,
          planned_start DATE,
          planned_end DATE,
          actual_start TIMESTAMP,
          actual_end TIMESTAMP,
          labor_hours DECIMAL(8,2) DEFAULT 0,
          labor_cost DECIMAL(12,2) DEFAULT 0,
          parts_cost DECIMAL(12,2) DEFAULT 0,
          other_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          branch_id INTEGER REFERENCES branches(id),
          created_by INTEGER,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: maintenance tables verified/created.");
    } catch (err) {
      console.error("Error creating maintenance tables:", err);
    }

    // ─── 14. MAINTENANCE — PREVENTIVE & SPARE PARTS ───────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS preventive_maintenance (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES maintenance_assets(id) ON DELETE CASCADE,
          pm_code VARCHAR(50) UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          frequency_type VARCHAR(20) DEFAULT 'daily',
          frequency_value INTEGER DEFAULT 1,
          last_performed DATE,
          next_due DATE,
          assigned_to INTEGER,
          estimated_duration_min INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS maintenance_consumption (
          id SERIAL PRIMARY KEY,
          work_order_id INTEGER NOT NULL REFERENCES maintenance_work_orders(id) ON DELETE CASCADE,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
          warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          consumed_by INTEGER
        )
      `);
      console.log("Enterprise: preventive_maintenance & consumption tables verified/created.");
    } catch (err) {
      console.error("Error creating preventive maintenance tables:", err);
    }

    // ─── 15. CRM — LEADS & OPPORTUNITIES ─────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_leads (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          phone_2 VARCHAR(50),
          email VARCHAR(255),
          company_name VARCHAR(255),
          job_title VARCHAR(100),
          source VARCHAR(50),
          industry VARCHAR(100),
          address TEXT,
          city VARCHAR(100),
          notes TEXT,
          status VARCHAR(20) DEFAULT 'new',
          assigned_to INTEGER,
          branch_id INTEGER REFERENCES branches(id),
          estimated_value DECIMAL(12,2) DEFAULT 0,
          probability INTEGER DEFAULT 0,
          rating INTEGER DEFAULT 3,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_opportunities (
          id SERIAL PRIMARY KEY,
          lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          pipeline_stage VARCHAR(50) DEFAULT 'lead',
          estimated_value DECIMAL(12,2) DEFAULT 0,
          actual_value DECIMAL(12,2) DEFAULT 0,
          probability INTEGER DEFAULT 0,
          expected_close_date DATE,
          assigned_to INTEGER,
          branch_id INTEGER REFERENCES branches(id),
          source VARCHAR(50),
          lost_reason TEXT,
          notes TEXT,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Enterprise: CRM tables verified/created.");
    } catch (err) {
      console.error("Error creating CRM tables:", err);
    }

    // ─── 16. CRM — ACTIVITIES, PIPELINES, QUOTATIONS ─────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_activities (
          id SERIAL PRIMARY KEY,
          opportunity_id INTEGER REFERENCES crm_opportunities(id) ON DELETE CASCADE,
          lead_id INTEGER REFERENCES crm_leads(id) ON DELETE CASCADE,
          activity_type VARCHAR(50) NOT NULL,
          subject VARCHAR(255),
          description TEXT,
          scheduled_date TIMESTAMP,
          completed_date TIMESTAMP,
          status VARCHAR(20) DEFAULT 'planned',
          assigned_to INTEGER,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_pipelines (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          name_ar VARCHAR(255),
          stages JSONB DEFAULT '["lead","qualified","proposal","negotiation","won","lost"]'::jsonb,
          is_default BOOLEAN DEFAULT false,
          branch_id INTEGER REFERENCES branches(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_quotations (
          id SERIAL PRIMARY KEY,
          quotation_number VARCHAR(50) UNIQUE NOT NULL,
          opportunity_id INTEGER REFERENCES crm_opportunities(id),
          customer_id INTEGER REFERENCES customers(id),
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          customer_address TEXT,
          branch_id INTEGER REFERENCES branches(id),
          subtotal DECIMAL(12,2) DEFAULT 0,
          discount_amount DECIMAL(12,2) DEFAULT 0,
          tax_amount DECIMAL(12,2) DEFAULT 0,
          grand_total DECIMAL(12,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'draft',
          valid_until DATE,
          notes TEXT,
          terms_conditions TEXT,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_quotation_items (
          id SERIAL PRIMARY KEY,
          quotation_id INTEGER NOT NULL REFERENCES crm_quotations(id) ON DELETE CASCADE,
          ingredient_id INTEGER REFERENCES ingredients(id),
          item_name VARCHAR(255) NOT NULL,
          description TEXT,
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit VARCHAR(50),
          unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
          discount_percent DECIMAL(5,2) DEFAULT 0,
          tax_rate DECIMAL(5,2) DEFAULT 0,
          total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
          sort_order INTEGER DEFAULT 0
        )
      `);
      console.log("Enterprise: CRM activities, pipelines, quotations tables verified/created.");
    } catch (err) {
      console.error("Error creating CRM extended tables:", err);
    }

    // ─── 17. RESTAURANT — RECIPES & WASTE ────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS recipes (
          id SERIAL PRIMARY KEY,
          product_id INTEGER REFERENCES products(id),
          name VARCHAR(255) NOT NULL,
          name_ar VARCHAR(255),
          description TEXT,
          instructions TEXT,
          prep_time_min INTEGER DEFAULT 0,
          cook_time_min INTEGER DEFAULT 0,
          total_yield DECIMAL(12,3) DEFAULT 1,
          total_cost DECIMAL(12,2) DEFAULT 0,
          selling_price DECIMAL(12,2) DEFAULT 0,
          food_cost_percent DECIMAL(5,2) DEFAULT 0,
          branch_id INTEGER REFERENCES branches(id),
          is_active BOOLEAN DEFAULT true,
          image_url TEXT,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          id SERIAL PRIMARY KEY,
          recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit VARCHAR(50),
          unit_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          is_variable BOOLEAN DEFAULT false,
          waste_percent DECIMAL(5,2) DEFAULT 0,
          notes TEXT,
          sort_order INTEGER DEFAULT 0
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS waste_records (
          id SERIAL PRIMARY KEY,
          branch_id INTEGER REFERENCES branches(id),
          ingredient_id INTEGER REFERENCES ingredients(id),
          ingredient_name VARCHAR(255),
          quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
          unit_cost DECIMAL(12,2) DEFAULT 0,
          total_cost DECIMAL(12,2) DEFAULT 0,
          waste_type VARCHAR(50) DEFAULT 'spoilage',
          reason TEXT,
          recorded_by INTEGER,
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      console.log("Enterprise: recipes & waste_records tables verified/created.");

      // Costs Module Column Safeguards
      await pool.query(`
        ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS category TEXT;
        ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'direct';
        ALTER TABLE production_boms ADD COLUMN IF NOT EXISTS name TEXT;
        ALTER TABLE production_boms ADD COLUMN IF NOT EXISTS scrap_percentage DECIMAL(5,2) DEFAULT 0;
        ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_id INTEGER;
        UPDATE production_boms SET name = product_name WHERE (name IS NULL OR name = '') AND product_name IS NOT NULL;
        UPDATE ingredients SET cost_price = COALESCE(cost, avg_cost, 0) WHERE cost_price IS NULL OR cost_price = 0;
      `);
    } catch (err) {
      console.error("Error creating restaurant extension tables:", err);
    }

    // ─── 18. ACCOUNTING — ENHANCED AUDIT ─────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS enterprise_audit_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          username VARCHAR(100),
          action VARCHAR(50) NOT NULL,
          module VARCHAR(50) NOT NULL,
          table_name VARCHAR(100),
          record_id INTEGER,
          old_values JSONB,
          new_values JSONB,
          ip_address VARCHAR(45),
          user_agent TEXT,
          branch_id INTEGER,
          company_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_module ON enterprise_audit_log(module)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON enterprise_audit_log(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON enterprise_audit_log(created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_table ON enterprise_audit_log(table_name, record_id)`);
      console.log("Enterprise: audit_log table verified/created.");
    } catch (err) {
      console.error("Error creating enterprise_audit_log table:", err);
    }

    // ─── 19. ENTERPRISE — DASHBOARD KPIs SNAPSHOT ─────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_kpi_snapshots (
          id SERIAL PRIMARY KEY,
          snapshot_date DATE NOT NULL,
          branch_id INTEGER REFERENCES branches(id),
          company_id INTEGER,
          total_sales DECIMAL(15,2) DEFAULT 0,
          total_profit DECIMAL(15,2) DEFAULT 0,
          total_orders INTEGER DEFAULT 0,
          total_cost DECIMAL(15,2) DEFAULT 0,
          inventory_value DECIMAL(15,2) DEFAULT 0,
          production_output DECIMAL(12,2) DEFAULT 0,
          employee_count INTEGER DEFAULT 0,
          customer_count INTEGER DEFAULT 0,
          avg_order_value DECIMAL(12,2) DEFAULT 0,
          food_cost_percent DECIMAL(5,2) DEFAULT 0,
          labor_cost_percent DECIMAL(5,2) DEFAULT 0,
          extra_data JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(snapshot_date, branch_id)
        )
      `);
      console.log("Enterprise: daily_kpi_snapshots table verified/created.");
    } catch (err) {
      console.error("Error creating daily_kpi_snapshots table:", err);
    }

    // === FIX: Add missing columns referenced by route handlers ===

    // products table: self-healing columns for unified POS-Sales product sharing
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredient_id INTEGER");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_id INTEGER");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'قطعة'");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS stock DECIMAL(12,3) DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2) DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock DECIMAL(12,3) DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock DECIMAL(12,3) DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 14");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS business_profile TEXT DEFAULT 'general'");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'sale'");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_pos BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available_in_pos BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_sales BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available_in_sales BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_price DECIMAL(12,2) DEFAULT NULL");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_discount BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}'");
    await pool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2) DEFAULT 0");
    await pool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(12,2) DEFAULT 0");
    await pool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS last_purchase_price DECIMAL(12,2) DEFAULT 0");
    await pool.query("ALTER TABLE sales_products ADD COLUMN IF NOT EXISTS inventory_cost DECIMAL(12,2) DEFAULT 0");

    // orders table: missing columns used by POS and reports
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pos'");
    // table_id may already exist as table_number, add table_id separately
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id INTEGER");

    // suppliers table: missing contact_person
    await pool.query("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT");

    // journal_entries: missing company_id
    await pool.query("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS company_id INTEGER");

    // manufacturing_orders: missing company_id
    await pool.query("ALTER TABLE manufacturing_orders ADD COLUMN IF NOT EXISTS company_id INTEGER");

    // batch_tracking: missing company_id and branch_id
    await pool.query("ALTER TABLE batch_tracking ADD COLUMN IF NOT EXISTS company_id INTEGER");
    await pool.query("ALTER TABLE batch_tracking ADD COLUMN IF NOT EXISTS branch_id INTEGER");

    // Initialize Hotel Management Module Database Tables
    await initHotelDatabase(pool);

    // Initialize Enterprise Inventory Management Database Schema
    await initEnterpriseInventorySchema(pool);
    // Finalize cross-module FK only after the canonical warehouse GRN schema exists.
    try {
      await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_purchases_receipt_goods_receipt') THEN ALTER TABLE purchases ADD CONSTRAINT fk_purchases_receipt_goods_receipt FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE SET NULL; END IF; END $$`);
    } catch (e: any) {
      console.warn('Purchase/GRN foreign key migration skipped:', e.message);
    }
    // Costs integration is applied after operating_costs has been created.
    try {
      await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS purchase_id INTEGER`);
      await pool.query(`ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS source_type TEXT`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operating_costs_purchase ON operating_costs(purchase_id)`);
    } catch (e: any) {
      console.warn('Purchase/Costs migration skipped:', e.message);
    }

    // ─── 20. ENHANCED INDEXES FOR ENTERPRISE ────────────────────
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_branch_date ON orders(branch_id, timestamp)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_branch_daily ON orders(branch_id, daily_number, timestamp)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_product_ingredients_prod_id ON product_ingredients(product_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_product_ingredients_ing_id ON product_ingredients(ingredient_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_inv_items_wh_ing ON inventory_items(warehouse_id, ingredient_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_inv_trans_type ON inventory_transactions(type, created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_trans_date ON treasury_transactions(created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_source ON journal_entries(source_type, source_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ingredients_code ON ingredients(item_code)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
      console.log("Enterprise: additional indexes verified/created.");
    } catch (err) {
      console.error("Error creating enterprise indexes:", err);
    }

    // ─── SELF-HEALING: POSTED GRN STOCK & SUPPLIER BALANCE SYNCHRONIZATION ───
    try {
      // 1. Repair any posted GRN items where accepted_qty was 0 or stock transaction was missed
      const unstockedGrnItems = await pool.query(`
        SELECT gri.*, gr.warehouse_id, gr.receipt_no, gr.date, gr.posting_date
        FROM goods_receipt_items gri
        JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
        WHERE (gr.is_posted = true OR gr.status IN ('posted', 'completed'))
          AND gri.ingredient_id IS NOT NULL
          AND COALESCE(gri.received_qty, 0) > 0
          AND COALESCE(gri.qc_status, 'pending') <> 'failed'
          AND NOT EXISTS (
            SELECT 1 FROM inventory_transactions it
            WHERE it.reference_type = 'goods_receipt'
              AND it.reference_id = gr.id
              AND it.ingredient_id = gri.ingredient_id
          )
      `);

      if (unstockedGrnItems.rows.length > 0) {
        console.log(`Found ${unstockedGrnItems.rows.length} posted GRN items missing stock ledger entries. Synchronizing warehouse balances...`);
        for (const it of unstockedGrnItems.rows) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const rQty = Number(it.received_qty || 0);
            const freeQty = Number(it.free_qty || 0);
            const rejQty = Number(it.rejected_qty || 0);
            const quarQty = Number(it.quarantine_qty || 0);
            const damQty = Number(it.damaged_qty || 0);
            const accQty = Number(it.accepted_qty > 0 ? it.accepted_qty : Math.max(0, rQty + freeQty - rejQty - quarQty - damQty));
            if (accQty > 0 && it.warehouse_id && it.ingredient_id) {
              await client.query(
                "UPDATE goods_receipt_items SET accepted_qty = $1, qc_status = 'passed' WHERE id = $2",
                [accQty, it.id]
              );
              const unitCost = Number(it.landed_unit_cost > 0 ? it.landed_unit_cost : (it.unit_cost || it.unit_price || 0));
              const curStock = await client.query(
                "SELECT id, quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
                [it.warehouse_id, it.ingredient_id]
              );
              let beforeQty = 0;
              if (curStock.rows.length > 0) {
                beforeQty = Number(curStock.rows[0].quantity || 0);
                const beforeAvg = Number(curStock.rows[0].avg_cost || 0);
                const newQty = beforeQty + accQty;
                const newAvg = (newQty > 0 && beforeQty > 0 && beforeAvg > 0)
                  ? ((beforeQty * beforeAvg) + (accQty * unitCost)) / newQty
                  : unitCost;
                await client.query(
                  "UPDATE inventory_items SET quantity = $1, available = GREATEST($2::numeric - COALESCE(reserved, 0), 0), avg_cost = $3, last_cost = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
                  [newQty, newQty, newAvg, unitCost, curStock.rows[0].id]
                );
              } else {
                await client.query(
                  "INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, available, avg_cost, last_cost) VALUES ($1, $2, $3, GREATEST($4::numeric, 0), $5, $6)",
                  [it.warehouse_id, it.ingredient_id, accQty, accQty, unitCost, unitCost]
                );
              }
              await client.query(`
                UPDATE ingredients SET
                  last_purchase_price = COALESCE(NULLIF($1::numeric, 0), last_purchase_price),
                  avg_cost = COALESCE(NULLIF($2::numeric, 0), avg_cost),
                  current_stock = COALESCE((SELECT SUM(quantity) FROM inventory_items WHERE ingredient_id = $3), 0)
                WHERE id = $4
              `, [unitCost, unitCost, it.ingredient_id, it.ingredient_id]);
              await client.query(`
                INSERT INTO inventory_transactions (
                  transaction_number, warehouse_id, ingredient_id, quantity, type,
                  unit_cost, total_cost, balance_before, balance_after,
                  reference_type, reference_id, reference_no, status, notes, date
                ) VALUES ($1, $2, $3, $4, 'receipt', $5, $6, $7, $8, 'goods_receipt', $9, $10, 'posted', $11, $12)
              `, [
                `TXN-SYNC-${Date.now().toString().slice(-6)}-${it.id}`,
                it.warehouse_id, it.ingredient_id, accQty, unitCost, accQty * unitCost,
                beforeQty, beforeQty + accQty, it.goods_receipt_id, it.receipt_no,
                `مزامنة رصيد سند استلام مرحل ${it.receipt_no}`,
                it.posting_date || it.date || new Date().toISOString().split("T")[0]
              ]);
            }
            await client.query("COMMIT");
          } catch (syncErr: any) {
            await client.query("ROLLBACK");
            console.warn("GRN item stock sync warning:", syncErr.message);
          } finally {
            client.release();
          }
        }
      }

      console.log("Checking for posted GRNs without matching Purchase Invoices...");
      const unbilledGrns = await pool.query(`
        SELECT gr.* 
        FROM goods_receipts gr
        WHERE gr.status = 'posted' 
          AND gr.is_posted = true 
          AND gr.supplier_id IS NOT NULL 
          AND gr.purchase_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM purchases p WHERE p.receipt_id = gr.id
          )
        ORDER BY gr.id ASC
      `);

      if (unbilledGrns.rows.length > 0) {
        console.log(`Found ${unbilledGrns.rows.length} unbilled posted GRNs. Auto-generating Purchase Invoices to update supplier balances...`);
        for (const gr of unbilledGrns.rows) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            
            const id = gr.id;
            const itemsRes = await client.query("SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1", [id]);
            
            let totalAcceptedValue = 0;
            for (const it of itemsRes.rows) {
              const accQty = Number(it.accepted_qty > 0 ? it.accepted_qty : (it.qc_status === "passed" ? it.received_qty : 0));
              const unitCost = Number(it.landed_unit_cost > 0 ? it.landed_unit_cost : (it.unit_cost || it.unit_price || 0));
              totalAcceptedValue += accQty * unitCost;
            }

            if (totalAcceptedValue === 0) {
              totalAcceptedValue = Number(gr.net_amount || gr.total_amount || 0);
            }

            const totalAmount = totalAcceptedValue;
            const subtotal = Number(gr.net_amount || gr.total_amount || totalAmount);
            const taxAmount = Number(gr.tax_amount || 0);
            const discountAmount = Number(gr.discount_amount || 0);
            const shippingAmount = Number(gr.freight_charges || 0);
            const poId = gr.purchase_order_id || null;
            const invoiceNumber = `PINV-${new Date(gr.date || Date.now()).toISOString().slice(0,10).replace(/-/g,'')}-${String(id).padStart(6,'0')}`;

            // Create purchase invoice
            const purRes = await client.query(`
              INSERT INTO purchases (
                supplier_id, warehouse_id, invoice_number, supplier_invoice_number, internal_invoice_number,
                total_amount, paid_amount, status, notes, due_date, currency, payment_status,
                purchase_order_id, receipt_id, subtotal, tax_amount, discount_amount, shipping_amount,
                matching_status, invoice_status, created_by, branch_id, cost_center_id, payment_method, date, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, 0, 'received', $7, $8, $9, 'unpaid', $10, $11, $12, $13, $14, $15, 'matched', 'posted', $16, $17, $18, 'credit', $19, CURRENT_TIMESTAMP)
              RETURNING id
            `, [
              gr.supplier_id, gr.warehouse_id, invoiceNumber, gr.supplier_invoice_no || null, invoiceNumber,
              totalAmount, gr.notes || `فاتورة تلقائية لسند الاستلام ${gr.receipt_no}`, null, gr.currency || 'EGP',
              poId, id, subtotal, taxAmount, discountAmount, shippingAmount,
              gr.posted_by || null, gr.branch_id || 1, gr.cost_center_id || 1, gr.date || new Date()
            ]);

            const newPurchaseId = purRes.rows[0].id;

            // Link GRN to Purchase
            await client.query(`UPDATE goods_receipts SET purchase_id = $1 WHERE id = $2`, [newPurchaseId, id]);

            // Copy items to purchase_items
            for (const item of itemsRes.rows) {
              const itemAccQty = Number(item.accepted_qty > 0 ? item.accepted_qty : (item.qc_status === "passed" ? item.received_qty : 0));
              const itemUnitCost = Number(item.landed_unit_cost > 0 ? item.landed_unit_cost : (item.unit_cost || item.unit_price || 0));
              await client.query(`
                INSERT INTO purchase_items (purchase_id, ingredient_id, product_id, item_code, unit, quantity, unit_price, total_price)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `, [
                newPurchaseId, item.ingredient_id || null, item.product_id || null, item.item_code || null, item.unit || null,
                itemAccQty || 1, itemUnitCost, (itemAccQty || 1) * itemUnitCost
              ]);
            }

            // Create supplier transaction
            await client.query(`
              INSERT INTO supplier_transactions (
                supplier_id, type, amount, notes, reference_id, reference_type, currency, document_number, status, created_by, timestamp
              ) VALUES ($1, 'purchase', $2, $3, $4, 'purchase_invoice', $5, $6, 'posted', $7, $8)
            `, [
              gr.supplier_id, totalAmount, `فاتورة شراء تلقائية #${invoiceNumber} لسند الاستلام #${gr.receipt_no}`,
              newPurchaseId, gr.currency || 'EGP', invoiceNumber, gr.posted_by || null, gr.date || new Date()
            ]);

            // Update supplier balance
            await client.query(`
              UPDATE suppliers SET balance = COALESCE(balance, 0) + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
            `, [totalAmount, gr.supplier_id]);

            await client.query("COMMIT");
            console.log(`Successfully generated Purchase Invoice #${invoiceNumber} for GRN #${gr.receipt_no} (amount: ${totalAmount}) and updated supplier balance.`);
          } catch (grErr: any) {
            await client.query("ROLLBACK");
            console.error(`Failed to auto-generate invoice for GRN ${gr.receipt_no}:`, grErr.message);
          } finally {
            client.release();
          }
        }
      } else {
        console.log("All posted GRNs are correctly linked to Purchase Invoices.");
      }
    } catch (e: any) {
      console.error("Failed running GRN self-healing synchronization:", e.message);
    }

    console.log("═══ ERP Enterprise database extensions complete. ═══");

    if (!process.env.DEFAULT_ADMIN_PASSWORD) {
      console.log('⚠️  DEFAULT ADMIN PASSWORDS GENERATED — CHANGE IMMEDIATELY IN PRODUCTION');
    }
  } catch (error: any) {
    console.error("Database initialization failed:", error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error("\n" + "=".repeat(60));
      console.error("   خطأ في الاتصال بقاعدة بيانات PostgreSQL");
      console.error("   PostgreSQL Connection Error (Service Down)");
      console.error("=".repeat(60));
      console.error("1. تأكد من أن خدمة PostgreSQL تعمل على جهازك.");
      console.error("   Make sure the PostgreSQL service is running.");
      console.error("2. ابحث عن 'Services' وتأكد من تشغيل 'postgresql-x64-x'.");
      console.error("3. حاول تشغيل ملف CHECK_POSTGRES.bat لإصلاح المشكلة.");
      console.error("=".repeat(60) + "\n");
    } else if (error.code === '3D000') {
      console.error("\n" + "=".repeat(60));
      console.error("   قاعدة البيانات غير موجودة / Database Not Found");
      console.error("=".repeat(60));
      console.error("اسم قاعدة البيانات المذكور في .env غير موجود في PostgreSQL.");
      console.error("يرجى إنشاء قاعدة البيانات يدوياً (مثلاً: restaurant_db)");
      console.error("أو تغيير الاسم في DATABASE_URL.");
      console.error("=".repeat(60) + "\n");
    } else if (error.code === '28P01') {
      console.error("\n" + "=".repeat(60));
      console.error("   خطأ في كلمة المرور / Authentication Failed");
      console.error("=".repeat(60));
      console.error("كلمة المرور أو اسم المستخدم في .env غير صحيحة.");
      console.error("يرجى مراجعة DATABASE_URL.");
      console.error("=".repeat(60) + "\n");
    }
    // Fail fast: initialization stopped at the first error, so every statement
    // after it (admin seed, chart of accounts, enterprise tables, indexes,
    // self-healing sync) did NOT run. Callers must not start serving requests
    // as if the database were ready.
    throw error;
  }
}

async function initHotelDatabase(pool: any) {
  try {
    console.log("🏨 Initializing Hotel Management Module Database Tables...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_properties (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        address TEXT,
        phone TEXT,
        email TEXT,
        manager TEXT,
        floors_count INTEGER DEFAULT 5,
        rooms_count INTEGER DEFAULT 50,
        currency TEXT DEFAULT 'EGP',
        tax_rate DECIMAL(5,2) DEFAULT 14.00,
        checkin_time TEXT DEFAULT '14:00',
        checkout_time TEXT DEFAULT '12:00',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_room_types (
        id SERIAL PRIMARY KEY,
        hotel_id INTEGER REFERENCES hotel_properties(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT,
        capacity INTEGER DEFAULT 2,
        beds_count INTEGER DEFAULT 1,
        base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        description TEXT,
        amenities TEXT,
        images TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_rooms (
        id SERIAL PRIMARY KEY,
        hotel_id INTEGER REFERENCES hotel_properties(id) ON DELETE CASCADE,
        room_number TEXT NOT NULL,
        room_type_id INTEGER REFERENCES hotel_room_types(id),
        floor INTEGER DEFAULT 1,
        capacity INTEGER DEFAULT 2,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'available',
        housekeeping_status TEXT DEFAULT 'clean',
        maintenance_status TEXT DEFAULT 'ok',
        amenities TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(hotel_id, room_number)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_guests (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        nationality TEXT,
        id_number TEXT,
        passport_number TEXT,
        dob DATE,
        gender TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        id_document_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_reservations (
        id SERIAL PRIMARY KEY,
        reservation_number TEXT UNIQUE NOT NULL,
        hotel_id INTEGER REFERENCES hotel_properties(id),
        guest_id INTEGER REFERENCES hotel_guests(id),
        room_id INTEGER REFERENCES hotel_rooms(id),
        room_type_id INTEGER REFERENCES hotel_room_types(id),
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        nights_count INTEGER DEFAULT 1,
        adults INTEGER DEFAULT 1,
        children INTEGER DEFAULT 0,
        room_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        services_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        remaining_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        reservation_source TEXT DEFAULT 'direct',
        status TEXT DEFAULT 'confirmed',
        notes TEXT,
        actual_check_in TIMESTAMP,
        actual_check_out TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_folios (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER REFERENCES hotel_reservations(id) ON DELETE CASCADE,
        guest_id INTEGER REFERENCES hotel_guests(id),
        room_id INTEGER REFERENCES hotel_rooms(id),
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax_total DECIMAL(10,2) DEFAULT 0,
        discount_total DECIMAL(10,2) DEFAULT 0,
        grand_total DECIMAL(10,2) DEFAULT 0,
        paid_total DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_folio_charges (
        id SERIAL PRIMARY KEY,
        folio_id INTEGER REFERENCES hotel_folios(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reference_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_housekeeping (
        id SERIAL PRIMARY KEY,
        hotel_id INTEGER REFERENCES hotel_properties(id),
        room_id INTEGER REFERENCES hotel_rooms(id),
        cleaning_status TEXT DEFAULT 'dirty',
        assigned_staff_id INTEGER,
        assigned_staff_name TEXT,
        last_cleaned_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_maintenance (
        id SERIAL PRIMARY KEY,
        hotel_id INTEGER REFERENCES hotel_properties(id),
        room_id INTEGER REFERENCES hotel_rooms(id),
        problem TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        description TEXT,
        assigned_technician_id INTEGER,
        assigned_technician_name TEXT,
        cost DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'open',
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotel_settings (
        id SERIAL PRIMARY KEY,
        hotel_id INTEGER REFERENCES hotel_properties(id),
        key TEXT NOT NULL,
        value TEXT,
        UNIQUE(hotel_id, key)
      )
    `);

    // Hotel tables created. Operational data left clean for testing from scratch.
  } catch (err: any) {
    console.error("❌ Hotel Database initialization error:", err.message);
  }

  // Seed Rich Biometric & Attendance Demo Data
  try {
    await seedBiometricDemoData(pool);
  } catch (err: any) {
    console.error("❌ Biometric Demo Data initialization error:", err.message);
  }
}

export async function seedBiometricDemoData(pool: any) {
  try {
    // Ensure fingerprint_devices table & columns exist before querying
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fingerprint_devices (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          port INTEGER DEFAULT 4370,
          is_active INTEGER DEFAULT 1,
          branch_id INTEGER,
          last_sync TIMESTAMP,
          device_type VARCHAR(20) DEFAULT 'zkteco',
          protocol VARCHAR(10) DEFAULT 'tcp',
          username TEXT,
          password TEXT
        )
      `);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS branch_id INTEGER;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'zkteco';`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'tcp';`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS username TEXT;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS password TEXT;`);
    } catch (_e) {}

    // 1. Ensure Branches Exist
    let branchRes = await pool.query("SELECT id, name FROM branches LIMIT 1");
    let mainBranchId = branchRes.rows[0]?.id;
    if (!mainBranchId) {
      const newB = await pool.query("INSERT INTO branches (name, location, phone) VALUES ('الفرع الرئيسي', 'السويس - شارع الجيش', '01000000000') RETURNING id");
      mainBranchId = newB.rows[0].id;
    }

    // 2. Ensure Departments Exist
    const deptNames = ['الصالة', 'المطبخ', 'الإدارة', 'الكاشير', 'الدليفري', 'البار'];
    const deptMap: Record<string, number> = {};
    for (const name of deptNames) {
      let dRes = await pool.query("SELECT id FROM hr_departments WHERE name = $1 LIMIT 1", [name]);
      if (dRes.rows.length === 0) {
        dRes = await pool.query("INSERT INTO hr_departments (name) VALUES ($1) RETURNING id", [name]);
      }
      deptMap[name] = dRes.rows[0].id;
    }

    // 3. Ensure Shifts Exist
    let shiftRes = await pool.query("SELECT id FROM hr_shifts LIMIT 1");
    let mainShiftId = shiftRes.rows[0]?.id;
    if (!mainShiftId) {
      const s = await pool.query("INSERT INTO hr_shifts (name, start_time, end_time, total_hours, grace_period) VALUES ('الوردية الصباحية', '08:00', '16:30', 8.5, 15) RETURNING id");
      mainShiftId = s.rows[0].id;
    }

    // 4. Ensure Device Exists
    const devRes = await pool.query("SELECT id FROM fingerprint_devices LIMIT 1");
    if (devRes.rows.length === 0) {
      await pool.query(
        `INSERT INTO fingerprint_devices (name, ip_address, port, is_active, branch_id, device_type, protocol)
         VALUES ('جهاز البصمة الرئيسي - المدخل', '192.168.1.201', 4370, 1, $1, 'zkteco', 'tcp')`,
        [mainBranchId]
      );
    }
  } catch (err: any) {
    console.error("Error in seedBiometricDemoData:", err.message);
  }
}
