-- Production finished-goods inventory integration
-- Keeps the product master (products) linked to the ingredient-based warehouse ledger.
CREATE TABLE IF NOT EXISTS product_inventory_links (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_inventory_links_ingredient_id
  ON product_inventory_links(ingredient_id);
