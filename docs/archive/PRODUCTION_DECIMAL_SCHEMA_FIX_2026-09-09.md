# Production decimal schema fix — 2026-09-09

Fixed a legacy PostgreSQL schema issue where `ingredients.cost` (and related inventory cost/quantity fields) could remain INTEGER.

The production execution now normalizes these existing columns to NUMERIC before processing an order, so decimal values such as `10.15` are accepted. The migration preserves existing numeric values and the production execution remains transactional.

After updating the system, restart the server once so the schema guard runs. Then retry the production order.
