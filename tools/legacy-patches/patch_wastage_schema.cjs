const fs = require('fs');
let content = fs.readFileSync('modules/warehouses/database/inventory_schema.ts', 'utf8');

const sql = `
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
`;

content = content.replace('await pool.query(`', 'await pool.query(`\n' + sql);
fs.writeFileSync('modules/warehouses/database/inventory_schema.ts', content);
console.log("Patched inventory_schema.ts with wastage tables");
