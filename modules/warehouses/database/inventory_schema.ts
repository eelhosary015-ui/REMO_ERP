import { Pool } from "pg";

export async function initEnterpriseInventorySchema(pool: Pool) {
  try {
    console.log("📦 Initializing REMO PRO Enterprise Inventory Management Database Schema...");

    // ─────────────────────────────────────────────────────────────
    // 1. EXTEND WAREHOUSES TABLE
    // ─────────────────────────────────────────────────────────────
    const warehouseColumns = [
      "code VARCHAR(50)",
      "type VARCHAR(50) DEFAULT 'main'", // main, raw_material, finished_goods, transit, quarantine, scrap, retail, hotel, maintenance, kitchen
      "manager_name VARCHAR(100)",
      "manager_phone VARCHAR(50)",
      "manager_email VARCHAR(100)",
      "address TEXT",
      "city VARCHAR(100)",
      "state VARCHAR(100)",
      "country VARCHAR(100) DEFAULT 'مصر'",
      "status VARCHAR(20) DEFAULT 'active'", // active, inactive, maintenance
      "is_default BOOLEAN DEFAULT false",
      "allow_negative_stock BOOLEAN DEFAULT false",
      "cost_center VARCHAR(100)",
      "linked_module VARCHAR(50) DEFAULT 'general'", // general, restaurant, hotel, manufacturing, maintenance, sales, purchases
      "storage_capacity DECIMAL(12,2) DEFAULT 0",
      "total_area_sqm DECIMAL(10,2) DEFAULT 0",
      "temperature_controlled BOOLEAN DEFAULT false",
      "min_temp DECIMAL(5,2)",
      "max_temp DECIMAL(5,2)",
      "company_id INTEGER",
      "notes TEXT"
    ];

    for (const col of warehouseColumns) {
      try {
        await pool.query(`

      CREATE TABLE IF NOT EXISTS wastage_reasons (
        id SERIAL PRIMARY KEY,
        name_ar VARCHAR(255),
        name_en VARCHAR(255),
        type VARCHAR(50),
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS inventory_wastage (
        id SERIAL PRIMARY KEY,
        wastage_number VARCHAR(100) UNIQUE,
        wastage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        warehouse_id INTEGER,
        wastage_type VARCHAR(50),
        reason_id INTEGER,
        responsible_person VARCHAR(255),
        notes TEXT,
        total_value DECIMAL(15,3) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        created_by INTEGER,
        approved_by INTEGER,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inventory_wastage_items (
        id SERIAL PRIMARY KEY,
        wastage_id INTEGER,
        product_id INTEGER,
        current_qty DECIMAL(15,3),
        wastage_qty DECIMAL(15,3),
        unit_cost DECIMAL(15,4),
        total_cost DECIMAL(15,4)
      );


      CREATE TABLE IF NOT EXISTS adjustment_reasons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50),
        name_ar VARCHAR(255),
        name_en VARCHAR(255),
        type VARCHAR(50),
        is_active BOOLEAN DEFAULT true
      );

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
      );

      CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
        id SERIAL PRIMARY KEY,
        adjustment_id INTEGER,
        product_id INTEGER,
        current_qty DECIMAL(15,3),
        physical_qty DECIMAL(15,3),
        adjustment_qty DECIMAL(15,3),
        unit_cost DECIMAL(15,4),
        total_cost DECIMAL(15,4)
      );
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {
        // ignore if exists
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. WAREHOUSE LOCATIONS (Zones -> Racks -> Shelves -> Bins Hierarchy)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_locations (
        id SERIAL PRIMARY KEY,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES warehouse_locations(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(30) DEFAULT 'bin', -- zone, rack, shelf, bin, bulk, staging, quarantine, dock
        zone VARCHAR(50),
        rack VARCHAR(50),
        shelf VARCHAR(50),
        bin VARCHAR(50),
        barcode VARCHAR(100),
        max_weight DECIMAL(10,2) DEFAULT 0,
        max_volume DECIMAL(10,2) DEFAULT 0,
        is_occupied BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(warehouse_id, code)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wh_locations_wh ON warehouse_locations(warehouse_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wh_locations_parent ON warehouse_locations(parent_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wh_locations_code ON warehouse_locations(code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wh_locations_barcode ON warehouse_locations(barcode)`);

    // ─────────────────────────────────────────────────────────────
    // 3. EXTEND INGREDIENTS / ITEMS TABLE (Enterprise Item Master)
    // ─────────────────────────────────────────────────────────────
    const itemColumns = [
      "sku VARCHAR(100)",
      "name_en VARCHAR(255)",
      "short_name VARCHAR(100)",
      "category VARCHAR(100)",
      "subcategory VARCHAR(100)",
      "brand VARCHAR(100)",
      "manufacturer VARCHAR(100)",
      "model VARCHAR(100)",
      "part_number VARCHAR(100)",
      "country_of_origin VARCHAR(100)",
      "image_url TEXT",
      "is_active BOOLEAN DEFAULT true",
      "tracking_type VARCHAR(20) DEFAULT 'none'", // none, batch, serial
      "tax_category VARCHAR(50) DEFAULT 'standard'",
      "purchase_unit VARCHAR(50)",
      "stock_unit VARCHAR(50)",
      "sales_unit VARCHAR(50)",
      "consumption_unit VARCHAR(50)",
      "conversion_factor DECIMAL(14,6) DEFAULT 1.0",
      "min_stock DECIMAL(12,3) DEFAULT 0",
      "max_stock DECIMAL(12,3) DEFAULT 0",
      "reorder_point DECIMAL(12,3) DEFAULT 0",
      "safety_stock DECIMAL(12,3) DEFAULT 0",
      "lead_time_days INTEGER DEFAULT 0",
      "preferred_supplier_id INTEGER",
      "item_type VARCHAR(50) DEFAULT 'raw_material'", // raw_material, finished_good, consumable, spare_part, asset, service, recipe_item
      "valuation_method VARCHAR(30) DEFAULT 'weighted_average'", // weighted_average, fifo, standard, last_purchase
      "standard_cost DECIMAL(14,4) DEFAULT 0",
      "last_purchase_cost DECIMAL(14,4) DEFAULT 0"
    ];

    for (const col of itemColumns) {
      try {
        await pool.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {
        // ignore
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ITEM BARCODES (Standards: Code 128, EAN-13, EAN-8, UPC, QR)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_barcodes (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        barcode VARCHAR(100) NOT NULL,
        barcode_type VARCHAR(30) DEFAULT 'code128', -- code128, ean13, ean8, upc, qr, internal, supplier, manufacturer
        uom VARCHAR(50),
        is_primary BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(barcode)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_barcodes_item ON item_barcodes(ingredient_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_barcodes_val ON item_barcodes(barcode)`);

    // ─────────────────────────────────────────────────────────────
    // 5. ITEM UOM CONVERSIONS (Multi-UOM Engine)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_uom_conversions (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        from_uom VARCHAR(50) NOT NULL,
        to_uom VARCHAR(50) NOT NULL,
        conversion_factor DECIMAL(14,6) NOT NULL, -- e.g. 1 Carton = 12 Boxes -> factor = 12
        operator VARCHAR(10) DEFAULT 'multiply', -- multiply, divide
        is_purchase_default BOOLEAN DEFAULT false,
        is_sales_default BOOLEAN DEFAULT false,
        is_consumption_default BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_uom_item ON item_uom_conversions(ingredient_id)`);

    // ─────────────────────────────────────────────────────────────
    // 6. ITEM SUPPLIERS (Vendor Price Catalog & Lead Times)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_suppliers (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        supplier_part_no VARCHAR(100),
        supplier_price DECIMAL(14,4) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'EGP',
        lead_time_days INTEGER DEFAULT 0,
        min_order_qty DECIMAL(12,3) DEFAULT 1,
        is_preferred BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ingredient_id, supplier_id)
      )
    `);

    // ─────────────────────────────────────────────────────────────
    // 7. SERIAL NUMBER TRACKING
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_serials (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        warehouse_id INTEGER REFERENCES warehouses(id),
        location_id INTEGER REFERENCES warehouse_locations(id),
        serial_number VARCHAR(100) NOT NULL UNIQUE,
        batch_number VARCHAR(100),
        status VARCHAR(30) DEFAULT 'in_stock', -- in_stock, issued, transferred, damaged, returned, reserved
        purchase_cost DECIMAL(14,4) DEFAULT 0,
        purchase_receipt_id INTEGER,
        warranty_start_date DATE,
        warranty_end_date DATE,
        supplier_id INTEGER REFERENCES suppliers(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_serials_item ON item_serials(ingredient_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_serials_wh ON item_serials(warehouse_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_serials_val ON item_serials(serial_number)`);

    // ─────────────────────────────────────────────────────────────
    // 8. EXTEND INVENTORY_ITEMS TABLE (Add location, reserved, in_transit)
    // ─────────────────────────────────────────────────────────────
    const invItemsColumns = [
      "reserved DECIMAL(12,3) DEFAULT 0",
      "in_transit DECIMAL(12,3) DEFAULT 0",
      "location_id INTEGER",
      "reorder_point DECIMAL(12,3) DEFAULT 0",
      "max_quantity DECIMAL(12,3) DEFAULT 0",
      "last_count_date DATE",
      "last_cost DECIMAL(14,4) DEFAULT 0",
      "avg_cost DECIMAL(14,4) DEFAULT 0",
      "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];

    for (const col of invItemsColumns) {
      try {
        await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {
        // ignore
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 9. EXTEND INVENTORY_TRANSACTIONS (Stock Ledger Details)
    // ─────────────────────────────────────────────────────────────
    const invTxnColumns = [
      "transaction_number VARCHAR(100)",
      "uom VARCHAR(50)",
      "unit_cost DECIMAL(14,4) DEFAULT 0",
      "total_cost DECIMAL(16,4) DEFAULT 0",
      "balance_before DECIMAL(14,4) DEFAULT 0",
      "balance_after DECIMAL(14,4) DEFAULT 0",
      "batch_number VARCHAR(100)",
      "serial_number VARCHAR(100)",
      "expiry_date DATE",
      "location_id INTEGER",
      "target_warehouse_id INTEGER",
      "target_location_id INTEGER",
      "reference_type VARCHAR(50)", // purchase_order, goods_receipt, material_request, sales_order, transfer_order, stock_count, production_order, pos_order, hotel_order, manual
      "reference_no VARCHAR(100)",
      "department VARCHAR(100)",
      "cost_center VARCHAR(100)",
      "employee_id INTEGER",
      "status VARCHAR(30) DEFAULT 'posted'", // draft, pending_approval, approved, posted, cancelled, reversed
      "approved_by INTEGER",
      "approved_at TIMESTAMP",
      "reversed_by INTEGER",
      "reversal_reason TEXT",
      "company_id INTEGER",
      "branch_id INTEGER"
    ];

    for (const col of invTxnColumns) {
      try {
        await pool.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {
        // ignore
      }
    }

    try { await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN quantity DROP NOT NULL;`); } catch (_) {}
    try { await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN quantity SET DEFAULT 0;`); } catch (_) {}
    try { await pool.query(`ALTER TABLE inventory_transactions ALTER COLUMN ingredient_id DROP NOT NULL;`); } catch (_) {}

    // ─────────────────────────────────────────────────────────────
    // 10. FIFO COST LAYERS
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_cost_layers (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        batch_id INTEGER REFERENCES batch_tracking(id),
        batch_number VARCHAR(100),
        received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        quantity_received DECIMAL(14,4) NOT NULL,
        quantity_remaining DECIMAL(14,4) NOT NULL,
        unit_cost DECIMAL(14,4) NOT NULL,
        total_cost DECIMAL(16,4) NOT NULL,
        transaction_id INTEGER REFERENCES inventory_transactions(id),
        status VARCHAR(20) DEFAULT 'open', -- open, depleted, cancelled
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_layers_item_wh ON stock_cost_layers(ingredient_id, warehouse_id, status)`);

    // ─────────────────────────────────────────────────────────────
    // 11. GOODS RECEIPTS (Inbound Receiving & Inspection Cycle)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goods_receipts (
        id SERIAL PRIMARY KEY,
        receipt_no VARCHAR(50) UNIQUE NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        posting_date DATE DEFAULT CURRENT_DATE,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        supplier_invoice_no VARCHAR(100),
        delivery_note_no VARCHAR(100),
        status VARCHAR(30) DEFAULT 'draft', -- draft, submitted, qc_pending, qc_approved, warehouse_approved, posted, completed, rejected, cancelled, reversed
        qc_status VARCHAR(30) DEFAULT 'pending', -- pending, passed, failed, partial, quarantine
        qc_inspector VARCHAR(100),
        qc_inspection_date TIMESTAMP,
        qc_notes TEXT,
        currency VARCHAR(10) DEFAULT 'EGP',
        exchange_rate DECIMAL(10,4) DEFAULT 1.0,
        receiver_name VARCHAR(100),
        reference VARCHAR(100),
        total_amount DECIMAL(15,2) DEFAULT 0,
        discount_amount DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        net_amount DECIMAL(15,2) DEFAULT 0,
        freight_charges DECIMAL(15,2) DEFAULT 0,
        customs_charges DECIMAL(15,2) DEFAULT 0,
        other_charges DECIMAL(15,2) DEFAULT 0,
        total_landed_cost DECIMAL(15,2) DEFAULT 0,
        landed_cost_allocation VARCHAR(30) DEFAULT 'value',
        is_posted BOOLEAN DEFAULT false,
        posted_at TIMESTAMP,
        posted_by INTEGER REFERENCES users(id),
        journal_entry_id INTEGER,
        over_receipt_approved BOOLEAN DEFAULT false,
        over_receipt_approved_by INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add any missing columns to existing goods_receipts
    const grColumns = [
      "posting_date DATE DEFAULT CURRENT_DATE",
      "currency VARCHAR(10) DEFAULT 'EGP'",
      "exchange_rate DECIMAL(10,4) DEFAULT 1.0",
      "receiver_name VARCHAR(100)",
      "reference VARCHAR(100)",
      "discount_amount DECIMAL(15,2) DEFAULT 0",
      "tax_amount DECIMAL(15,2) DEFAULT 0",
      "net_amount DECIMAL(15,2) DEFAULT 0",
      "freight_charges DECIMAL(15,2) DEFAULT 0",
      "customs_charges DECIMAL(15,2) DEFAULT 0",
      "other_charges DECIMAL(15,2) DEFAULT 0",
      "total_landed_cost DECIMAL(15,2) DEFAULT 0",
      "landed_cost_allocation VARCHAR(30) DEFAULT 'value'",
      "qc_inspection_date TIMESTAMP",
      "is_posted BOOLEAN DEFAULT false",
      "posted_at TIMESTAMP",
      "posted_by INTEGER REFERENCES users(id)",
      "journal_entry_id INTEGER",
      "over_receipt_approved BOOLEAN DEFAULT false",
      "over_receipt_approved_by INTEGER REFERENCES users(id)",
      "idempotency_key TEXT"
    ];
    for (const col of grColumns) {
      try {
        await pool.query(`ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {}
    }
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_goods_receipts_idempotency_unique ON goods_receipts(idempotency_key) WHERE idempotency_key IS NOT NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_items (
        id SERIAL PRIMARY KEY,
        goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
        po_item_id INTEGER,
        ordered_qty DECIMAL(12,3) DEFAULT 0,
        previously_received_qty DECIMAL(12,3) DEFAULT 0,
        expected_qty DECIMAL(12,3) DEFAULT 0,
        received_qty DECIMAL(12,3) NOT NULL,
        free_qty DECIMAL(12,3) DEFAULT 0,
        accepted_qty DECIMAL(12,3) DEFAULT 0,
        rejected_qty DECIMAL(12,3) DEFAULT 0,
        quarantine_qty DECIMAL(12,3) DEFAULT 0,
        damaged_qty DECIMAL(12,3) DEFAULT 0,
        unit_price DECIMAL(14,4) DEFAULT 0,
        unit_cost DECIMAL(14,4) DEFAULT 0,
        discount_rate DECIMAL(6,2) DEFAULT 0,
        tax_rate DECIMAL(6,2) DEFAULT 0,
        net_price DECIMAL(14,4) DEFAULT 0,
        total_cost DECIMAL(16,4) DEFAULT 0,
        landed_unit_cost DECIMAL(14,4) DEFAULT 0,
        total_landed_cost DECIMAL(16,4) DEFAULT 0,
        uom VARCHAR(50),
        batch_number VARCHAR(100),
        lot_number VARCHAR(100),
        expiry_date DATE,
        manufacturing_date DATE,
        supplier_batch VARCHAR(100),
        serial_numbers TEXT,
        location_id INTEGER REFERENCES warehouse_locations(id),
        qc_status VARCHAR(30) DEFAULT 'pending',
        rejection_reason TEXT,
        qc_sample_size DECIMAL(12,3) DEFAULT 0,
        qc_defects_count INTEGER DEFAULT 0,
        putaway_status VARCHAR(30) DEFAULT 'pending',
        notes TEXT
      )
    `);

    // Add missing columns to goods_receipt_items
    const griColumns = [
      "po_item_id INTEGER",
      "previously_received_qty DECIMAL(12,3) DEFAULT 0",
      "expected_qty DECIMAL(12,3) DEFAULT 0",
      "free_qty DECIMAL(12,3) DEFAULT 0",
      "quarantine_qty DECIMAL(12,3) DEFAULT 0",
      "unit_price DECIMAL(14,4) DEFAULT 0",
      "discount_rate DECIMAL(6,2) DEFAULT 0",
      "tax_rate DECIMAL(6,2) DEFAULT 0",
      "net_price DECIMAL(14,4) DEFAULT 0",
      "landed_unit_cost DECIMAL(14,4) DEFAULT 0",
      "total_landed_cost DECIMAL(16,4) DEFAULT 0",
      "lot_number VARCHAR(100)",
      "supplier_batch VARCHAR(100)",
      "qc_status VARCHAR(30) DEFAULT 'pending'",
      "rejection_reason TEXT",
      "qc_sample_size DECIMAL(12,3) DEFAULT 0",
      "qc_defects_count INTEGER DEFAULT 0",
      "putaway_status VARCHAR(30) DEFAULT 'pending'"
    ];
    for (const col of griColumns) {
      try {
        await pool.query(`ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {}
    }

    // QC Inspection Records (Detailed checklists & lab tests)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qc_inspection_records (
        id SERIAL PRIMARY KEY,
        goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
        goods_receipt_item_id INTEGER REFERENCES goods_receipt_items(id) ON DELETE CASCADE,
        template_type VARCHAR(50) DEFAULT 'general', -- food, electronics, medical, general, chemicals, spare_parts
        checklist_data JSONB,
        temperature DECIMAL(5,2),
        hygiene_score INTEGER,
        packaging_condition VARCHAR(50),
        physical_condition VARCHAR(50),
        sample_size_inspected DECIMAL(12,3) DEFAULT 0,
        defects_found INTEGER DEFAULT 0,
        inspector_id INTEGER REFERENCES users(id),
        inspector_name VARCHAR(100),
        inspection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        result VARCHAR(30) DEFAULT 'passed', -- passed, failed, partial, quarantine
        action_taken VARCHAR(50) DEFAULT 'accept', -- accept, reject_full, reject_partial, quarantine, return_to_supplier
        rejection_reason TEXT,
        notes TEXT,
        attachments JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Supplier Return Requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_return_requests (
        id SERIAL PRIMARY KEY,
        return_no VARCHAR(50) UNIQUE NOT NULL,
        goods_receipt_id INTEGER REFERENCES goods_receipts(id),
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        return_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(30) DEFAULT 'draft', -- draft, approved, dispatched, completed, cancelled
        total_amount DECIMAL(15,2) DEFAULT 0,
        reason TEXT,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        dispatched_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Supplier Return Items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_return_items (
        id SERIAL PRIMARY KEY,
        return_id INTEGER NOT NULL REFERENCES supplier_return_requests(id) ON DELETE CASCADE,
        goods_receipt_item_id INTEGER REFERENCES goods_receipt_items(id),
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
        quantity DECIMAL(12,3) NOT NULL,
        unit_cost DECIMAL(14,4) DEFAULT 0,
        total_cost DECIMAL(16,4) DEFAULT 0,
        batch_number VARCHAR(100),
        serial_numbers TEXT,
        rejection_reason TEXT
      )
    `);

    // Goods Receipt Attachments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_attachments (
        id SERIAL PRIMARY KEY,
        goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        doc_type VARCHAR(50) DEFAULT 'invoice', -- invoice, delivery_note, packing_list, inspection_report, photo, certificate, other
        uploaded_by VARCHAR(100),
        file_size INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Multi-Location Put Away Distribution
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_putaway (
        id SERIAL PRIMARY KEY,
        goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
        goods_receipt_item_id INTEGER REFERENCES goods_receipt_items(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        location_id INTEGER NOT NULL REFERENCES warehouse_locations(id),
        quantity DECIMAL(12,3) NOT NULL,
        batch_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_grn_wh ON goods_receipts(warehouse_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_grn_supplier ON goods_receipts(supplier_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipts(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_grn_qc ON goods_receipts(qc_status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts(purchase_order_id)`);

    // ─────────────────────────────────────────────────────────────
    // 12. MATERIAL REQUESTS & ISSUES (Outbound Consumptions)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_requests (
        id SERIAL PRIMARY KEY,
        request_no VARCHAR(50) UNIQUE NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        request_type VARCHAR(50) DEFAULT 'department_issue', -- department_issue, production_consumption, hotel_amenities, kitchen_prep, maintenance, scrap
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        department VARCHAR(100),
        cost_center VARCHAR(100),
        employee_id INTEGER REFERENCES employees(id),
        work_order_no VARCHAR(100),
        status VARCHAR(30) DEFAULT 'pending', -- draft, pending_approval, approved, partially_issued, issued, rejected, cancelled
        priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
        requested_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
        requested_qty DECIMAL(12,3) NOT NULL,
        approved_qty DECIMAL(12,3) DEFAULT 0,
        issued_qty DECIMAL(12,3) DEFAULT 0,
        uom VARCHAR(50),
        batch_number VARCHAR(100),
        notes TEXT
      )
    `);
    // Self-healing workflow columns. Legacy databases were created before the
    // two-step approval (department → warehouse) and the issue posting existed,
    // which made every approval / issue call fail with "column does not exist".
    const materialRequestColumns = [
      "approved_by_dept VARCHAR(150)",
      "approved_dept_at TIMESTAMP",
      "approved_by_wh VARCHAR(150)",
      "approved_wh_at TIMESTAMP",
      "issued_at TIMESTAMP",
      "issued_by VARCHAR(150)",
      "recipient_name VARCHAR(150)",
      "rejection_reason TEXT",
      "requested_by_name VARCHAR(150)",
      "total_value DECIMAL(16,4) DEFAULT 0",
      "request_date TIMESTAMP",
      "needed_date DATE",
      "attachments JSONB",
    ];
    for (const col of materialRequestColumns) {
      try { await pool.query(`ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS ${col}`); } catch (_) {}
    }
    const materialRequestItemColumns = [
      "unit_cost DECIMAL(14,4) DEFAULT 0",
      "purpose TEXT",
      "line_no INTEGER",
      "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ];
    for (const col of materialRequestItemColumns) {
      try { await pool.query(`ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS ${col}`); } catch (_) {}
    }
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mat_req_wh ON material_requests(warehouse_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mat_req_status ON material_requests(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mat_req_created ON material_requests(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mat_req_items_request ON material_request_items(request_id)`);

    // ─────────────────────────────────────────────────────────────
    // 13. WAREHOUSE TRANSFERS (Extended In-Transit Support)
    // ─────────────────────────────────────────────────────────────
    const transferColumns = [
      "transfer_no VARCHAR(50)",
      "type VARCHAR(50) DEFAULT 'standard'",
      "priority VARCHAR(20) DEFAULT 'normal'",
      "department VARCHAR(100)",
      "purpose TEXT",
      "dispatch_date TIMESTAMP",
      "dispatched_at TIMESTAMP",
      "dispatched_by VARCHAR(100)",
      "received_date TIMESTAMP",
      "received_at TIMESTAMP",
      "received_by VARCHAR(100)",
      "approved_at TIMESTAMP",
      "approved_by VARCHAR(100)",
      "rejected_at TIMESTAMP",
      "rejected_by VARCHAR(100)",
      "rejected_reason TEXT",
      "qc_status VARCHAR(50)",
      "qc_notes TEXT",
      "driver_name VARCHAR(100)",
      "driver_phone VARCHAR(50)",
      "vehicle_no VARCHAR(50)",
      "waybill_no VARCHAR(100)",
      "shipping_cost DECIMAL(12,2) DEFAULT 0",
      "status_history TEXT",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];

    for (const col of transferColumns) {
      try {
        await pool.query(`ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS ${col};`);
      } catch (e) {}
    }

    // ─────────────────────────────────────────────────────────────
    // 14. STOCK RESERVATIONS
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_reservations (
        id SERIAL PRIMARY KEY,
        reservation_no VARCHAR(50) UNIQUE NOT NULL,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        quantity DECIMAL(12,3) NOT NULL,
        uom VARCHAR(50),
        reserved_for_type VARCHAR(50) NOT NULL, -- sales_order, pos_order, production_order, material_request, maintenance_order, hotel_request
        reference_id INTEGER,
        reference_no VARCHAR(100),
        status VARCHAR(30) DEFAULT 'active', -- active, fulfilled, released, expired
        batch_id INTEGER REFERENCES batch_tracking(id),
        expires_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_res_item_wh ON stock_reservations(ingredient_id, warehouse_id, status)`);

    // ─────────────────────────────────────────────────────────────
    // 15. QUALITY INSPECTIONS (QC & Quarantine Engine)
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quality_inspections (
        id SERIAL PRIMARY KEY,
        inspection_no VARCHAR(50) UNIQUE NOT NULL,
        reference_type VARCHAR(50) NOT NULL, -- goods_receipt, production_batch, return_in, stock_sample
        reference_id INTEGER,
        ingredient_id INTEGER REFERENCES ingredients(id),
        warehouse_id INTEGER REFERENCES warehouses(id),
        inspected_quantity DECIMAL(12,3) NOT NULL,
        accepted_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
        rejected_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
        quarantine_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
        status VARCHAR(30) DEFAULT 'completed', -- pending, in_progress, completed
        verdict VARCHAR(30) DEFAULT 'passed', -- passed, failed, conditional
        inspector_id INTEGER REFERENCES users(id),
        parameters JSONB DEFAULT '[]',
        rejection_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ─────────────────────────────────────────────────────────────
    // 16. INVENTORY SETTINGS
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_settings (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        costing_method VARCHAR(30) DEFAULT 'weighted_average', -- weighted_average, fifo, standard, last_purchase
        allow_negative_stock BOOLEAN DEFAULT false,
        require_approval_for_transactions BOOLEAN DEFAULT true,
        require_qc_for_receipts BOOLEAN DEFAULT false,
        auto_post_receipts BOOLEAN DEFAULT false,
        default_warehouse_id INTEGER REFERENCES warehouses(id),
        quarantine_warehouse_id INTEGER REFERENCES warehouses(id),
        scrap_warehouse_id INTEGER REFERENCES warehouses(id),
        expiry_warning_days INTEGER DEFAULT 30,
        enable_fefo BOOLEAN DEFAULT true,
        enable_multi_uom BOOLEAN DEFAULT true,
        enable_barcode_scanner BOOLEAN DEFAULT true,
        enable_ai_reorder BOOLEAN DEFAULT true,
        inventory_policy VARCHAR(50) DEFAULT 'periodic',
        default_reorder_point DECIMAL(12,2) DEFAULT 10,
        allowed_wastage_percentage DECIMAL(5,2) DEFAULT 2.5,
        lock_stock_during_count BOOLEAN DEFAULT true,
        auto_link_accounts BOOLEAN DEFAULT true,
        settings_json JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure columns exist in inventory_settings
    const invSetCols = [
      "inventory_policy VARCHAR(50) DEFAULT 'periodic'",
      "default_reorder_point DECIMAL(12,2) DEFAULT 10",
      "allowed_wastage_percentage DECIMAL(5,2) DEFAULT 2.5",
      "lock_stock_during_count BOOLEAN DEFAULT true",
      "auto_link_accounts BOOLEAN DEFAULT true",
      "costing_method VARCHAR(30) DEFAULT 'weighted_average'",
      "allow_negative_stock BOOLEAN DEFAULT false",
      "expiry_warning_days INTEGER DEFAULT 30"
    ];
    for (const c of invSetCols) {
      try { await pool.query(`ALTER TABLE inventory_settings ADD COLUMN IF NOT EXISTS ${c};`); } catch (e) {}
    }

    // Seed default settings if empty
    const settingsCheck = await pool.query("SELECT id FROM inventory_settings LIMIT 1");
    if (settingsCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO inventory_settings (
          costing_method, allow_negative_stock, require_approval_for_transactions,
          require_qc_for_receipts, auto_post_receipts, expiry_warning_days,
          enable_fefo, enable_multi_uom, enable_barcode_scanner, enable_ai_reorder,
          inventory_policy, default_reorder_point, allowed_wastage_percentage,
          lock_stock_during_count, auto_link_accounts
        ) VALUES (
          'weighted_average', false, true, false, false, 30,
          true, true, true, true,
          'periodic', 10, 2.5,
          true, true
        )
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 16.1 WAREHOUSE TYPES
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const wtCols = [
      "description TEXT",
      "is_active BOOLEAN DEFAULT true",
      "is_system BOOLEAN DEFAULT false",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const c of wtCols) {
      try { await pool.query(`ALTER TABLE warehouse_types ADD COLUMN IF NOT EXISTS ${c};`); } catch (e) {}
    }

    const wtCheck = await pool.query("SELECT COUNT(*) as count FROM warehouse_types");
    if (Number(wtCheck.rows[0]?.count || 0) === 0) {
      await pool.query(`
        INSERT INTO warehouse_types (name, code, description, is_active, is_system) VALUES
        ('مستودع رئيسي (مركزي)', 'main', 'مستودع التخزين المركزي العام للبضائع والمواد', true, true),
        ('مستودع فرعي (نقاط بيع وتوزيع)', 'secondary', 'مستودع وسيط لتوزيع المواد على الأقسام أو الفروع', true, true),
        ('مستودع تالف وهالك', 'damaged', 'مستودع حجز وفصل المواد التالفة والهالكة والمنتهية', true, true),
        ('مستودع أمانات وبضاعة موردين', 'consignment', 'مستودع خاص ببضاعة الأمانة واستلامات الموردين المؤقتة', true, true),
        ('مستودع تشغيل وإنتاج', 'production', 'مستودع خطوط الإنتاج والتشغيل وإعداد الوجبات', true, true)
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 16.2 TRANSACTION TYPES
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        effect VARCHAR(20) DEFAULT 'in', -- in, out, adjust
        requires_approval BOOLEAN DEFAULT true,
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const ttCols = [
      "requires_approval BOOLEAN DEFAULT true",
      "is_system BOOLEAN DEFAULT false",
      "is_active BOOLEAN DEFAULT true",
      "description TEXT",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const c of ttCols) {
      try { await pool.query(`ALTER TABLE transaction_types ADD COLUMN IF NOT EXISTS ${c};`); } catch (e) {}
    }

    const ttCheck = await pool.query("SELECT COUNT(*) as count FROM transaction_types");
    if (Number(ttCheck.rows[0]?.count || 0) === 0) {
      await pool.query(`
        INSERT INTO transaction_types (name, code, effect, requires_approval, is_system, is_active, description) VALUES
        ('استلام وارد (GRN)', 'receive_in', 'in', true, true, true, 'إضافة كميات واردة من الموردين أو أوامر الشراء'),
        ('صرف مواد واستهلاك', 'issue_out', 'out', true, true, true, 'صرف مواد ومستلزمات للأقسام أو خطوط التشغيل'),
        ('تحويل صادر', 'transfer_out', 'out', true, true, true, 'إخراج بضاعة من المخزن مرسلة إلى مخزن آخر'),
        ('تحويل وارد', 'transfer_in', 'in', true, true, true, 'استلام وتسكين بضاعة محولة من مخزن آخر'),
        ('تسوية جردية - زيادة', 'adj_surplus', 'in', true, true, true, 'إضافة فروقات جرد إيجابية (فائض)'),
        ('تسوية جردية - عجز', 'adj_shortage', 'out', true, true, true, 'خصم فروقات جرد سلبية (عجز)'),
        ('إتلاف وهالك مخزني', 'wastage', 'out', true, true, true, 'إثبات هالك أو منتهي الصلاحية أو تالف تخزين')
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 16.3 TRANSACTION REASONS
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_reasons (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50),
        transaction_type VARCHAR(50) DEFAULT 'all',
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const trCols = [
      "transaction_type VARCHAR(50) DEFAULT 'all'",
      "description TEXT",
      "is_active BOOLEAN DEFAULT true",
      "is_system BOOLEAN DEFAULT false",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const c of trCols) {
      try { await pool.query(`ALTER TABLE transaction_reasons ADD COLUMN IF NOT EXISTS ${c};`); } catch (e) {}
    }

    const trCheck = await pool.query("SELECT COUNT(*) as count FROM transaction_reasons");
    if (Number(trCheck.rows[0]?.count || 0) === 0) {
      await pool.query(`
        INSERT INTO transaction_reasons (name, code, transaction_type, description, is_active, is_system) VALUES
        ('تالف أثناء التخزين', 'storage_damage', 'wastage', 'تلف ناتج عن سوء التخزين أو رطوبة أو حرارة', true, true),
        ('انتهاء فترة الصلاحية', 'expiry', 'wastage', 'انتهاء صلاحية الصنف قبل استهلاكه', true, true),
        ('كسر وتلف أثناء المناولة', 'breakage', 'wastage', 'كسر أو تلف أثناء النقل والتحميل والتنزيل', true, true),
        ('عجز في الجرد الدوري', 'count_shortage', 'adj_shortage', 'فارق عجز بين الرصيد الفعلي والدفتري', true, true),
        ('فائض في الجرد الدوري', 'count_surplus', 'adj_surplus', 'فارق زيادة بين الرصيد الفعلي والدفتري', true, true),
        ('سحب عينات فحص الجودة', 'qc_sample', 'issue_out', 'عينات مسحوبة للمختبر أو الفحص الدوري', true, true),
        ('هالك تشغيل وإعداد', 'production_scrap', 'wastage', 'هالك طبيعي أثناء التحضير والتصنيع', true, true)
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 17. INVENTORY AUDIT TRAIL
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_audit_trail (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL, -- warehouse, item, transaction, transfer, count, receipt, issue, reservation, setting
        entity_id INTEGER,
        action VARCHAR(50) NOT NULL, -- create, update, approve, reject, post, cancel, reverse, delete
        user_id INTEGER REFERENCES users(id),
        user_name VARCHAR(100),
        before_data JSONB,
        after_data JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inv_audit_entity ON inventory_audit_trail(entity_type, entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inv_audit_date ON inventory_audit_trail(created_at)`);

    // ─────────────────────────────────────────────────────────────
    // 18. SEED STANDARD WAREHOUSES & LOCATIONS IF EMPTY
    // ─────────────────────────────────────────────────────────────
    const whCountRes = await pool.query("SELECT COUNT(*) as count FROM warehouses");
    if (Number(whCountRes.rows[0]?.count || 0) === 0) {
      console.log("🌱 Seeding initial Enterprise Warehouses & Locations...");
      const wh1 = await pool.query(`
        INSERT INTO warehouses (name, code, type, is_main, address1, city, status, linked_module, allow_negative_stock)
        VALUES ('المخزن الرئيسي (المركزي)', 'WH-MAIN-01', 'main', 1, 'المنطقة الصناعية - مبنى A', 'القاهرة', 'active', 'general', false)
        RETURNING id
      `);
      const wh2 = await pool.query(`
        INSERT INTO warehouses (name, code, type, is_main, address1, city, status, linked_module, allow_negative_stock)
        VALUES ('مخزن المواد الخام والتشغيل', 'WH-RAW-01', 'raw_material', 0, 'المجمع الصناعي - بوابة 2', 'الجيزة', 'active', 'manufacturing', false)
        RETURNING id
      `);
      const wh3 = await pool.query(`
        INSERT INTO warehouses (name, code, type, is_main, address1, city, status, linked_module, allow_negative_stock)
        VALUES ('مخزن الأغذية والمشروبات (F&B)', 'WH-FB-01', 'kitchen', 0, 'مبنى الفندق والضيافة - الطابق الأرضي', 'القاهرة', 'active', 'restaurant', false)
        RETURNING id
      `);
      const wh4 = await pool.query(`
        INSERT INTO warehouses (name, code, type, is_main, address1, city, status, linked_module, allow_negative_stock)
        VALUES ('مخزن قطع الغيار والصيانة', 'WH-MAINT-01', 'maintenance', 0, 'ورشة الصيانة المركزية', 'القاهرة', 'active', 'maintenance', false)
        RETURNING id
      `);

      // Seed locations for main warehouse (Zone -> Rack -> Shelf -> Bin)
      const mWhId = wh1.rows[0].id;
      const zoneA = await pool.query(`
        INSERT INTO warehouse_locations (warehouse_id, code, name, type, zone)
        VALUES ($1, 'Z-A', 'المنطقة أ (استقبال وتخزين سريع)', 'zone', 'Zone A') RETURNING id
      `, [mWhId]);
      const rack01 = await pool.query(`
        INSERT INTO warehouse_locations (warehouse_id, parent_id, code, name, type, zone, rack)
        VALUES ($1, $2, 'Z-A-R01', 'الرف الرأسي 01', 'rack', 'Zone A', 'Rack 01') RETURNING id
      `, [mWhId, zoneA.rows[0].id]);
      await pool.query(`
        INSERT INTO warehouse_locations (warehouse_id, parent_id, code, name, type, zone, rack, shelf, bin, barcode)
        VALUES 
        ($1, $2, 'Z-A-R01-S01-B01', 'حاوية تخزين A-01-01', 'bin', 'Zone A', 'Rack 01', 'Shelf 01', 'Bin 01', 'LOC-A01-01'),
        ($1, $2, 'Z-A-R01-S01-B02', 'حاوية تخزين A-01-02', 'bin', 'Zone A', 'Rack 01', 'Shelf 01', 'Bin 02', 'LOC-A01-02'),
        ($1, $2, 'Z-A-R01-S02-B01', 'حاوية تخزين A-02-01', 'bin', 'Zone A', 'Rack 01', 'Shelf 02', 'Bin 01', 'LOC-A02-01')
      `, [mWhId, rack01.rows[0].id]);
    }

    // ─────────────────────────────────────────────────────────────
    // 19. UNIT OF MEASURE (UOM) TABLES & INGREDIENT COLUMNS
    // ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        name_en VARCHAR(100),
        symbol VARCHAR(20),
        symbol_en VARCHAR(20),
        category VARCHAR(50) NOT NULL DEFAULT 'count',
        base_unit VARCHAR(50) DEFAULT 'piece',
        factor_to_base NUMERIC(15,6) DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS uom_conversions (
        id SERIAL PRIMARY KEY,
        from_uom VARCHAR(50) NOT NULL,
        to_uom VARCHAR(50) NOT NULL,
        value NUMERIC(15,6) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS item_uom_conversions (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER,
        product_id INTEGER,
        from_uom VARCHAR(50) NOT NULL,
        to_uom VARCHAR(50) NOT NULL,
        conversion_factor NUMERIC(15,6) NOT NULL DEFAULT 1,
        operator VARCHAR(20) DEFAULT 'multiply',
        is_purchase_default BOOLEAN DEFAULT false,
        is_sales_default BOOLEAN DEFAULT false,
        is_consumption_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS density DECIMAL(10,4) DEFAULT 1.0;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50);
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS recipe_unit VARCHAR(50);
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS sales_unit VARCHAR(50);
    `);

    console.log("✅ REMO PRO Enterprise Inventory Schema Initialized Successfully!");
  } catch (err: any) {
    console.error("❌ Enterprise Inventory Database initialization error:", err.message);
  }
}
