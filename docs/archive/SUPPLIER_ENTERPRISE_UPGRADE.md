# Supplier Module Enterprise Upgrade

This build upgrades the Suppliers module with:

- Supplier codes and stronger master data.
- Duplicate supplier name/tax-number protection on creation.
- Supplier bank accounts and contacts.
- Supplier documents with expiry dates.
- Supplier performance evaluations.
- Supplier payment methods stored in the supplier ledger.
- Payment-to-invoice allocation support.
- Purchase due dates based on supplier payment terms.
- Supplier aging APIs and overdue payable dashboard metric.
- Supplier price history API.
- Safer deletion: suppliers with history are deactivated instead of deleted.
- Supplier balances can represent credit balances (negative balance) instead of being forced to zero.
- Supplier balance recalculation endpoint.
- Consistent supplier sub-ledger posting for purchase invoices and payments.
- Frontend advanced supplier center inside the supplier detail page.
- Manual SQL migration in `migrations/003_supplier_enterprise_upgrade.sql`.

The database initialization is idempotent and also applies the new schema automatically on startup.
