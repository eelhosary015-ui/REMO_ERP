# Bank Module — Complete Database Layer

This migration adds the corporate bank-management data model while preserving the existing `bank_accounts` and `bank_transactions` tables used by the current ERP.

## Core entities
- `banks` — bank master data
- `bank_branches` — bank branches
- `bank_account_types` — controlled account types
- `bank_accounts` — existing ERP bank accounts, extended safely
- `bank_accounts_ext` — extended account metadata and GL linkage
- `bank_transaction_categories` — transaction classification
- `bank_transactions` — existing ERP movements
- `bank_transactions_ext` — detailed transaction metadata and source/accounting links
- `bank_transfers` — transfer lifecycle and two-sided references
- `bank_beneficiaries` — beneficiary master data
- `bank_payment_orders` — payment workflow
- `bank_statements` / `bank_statement_lines` — imported bank statements
- `bank_reconciliations` / `bank_reconciliation_items` — reconciliation workflow
- `bank_fees` — bank fees and taxes
- `bank_interest_entries` — interest income/expense
- `bank_account_limits` — account and approval limits
- `bank_audit_log` — bank-module audit trail

## Integration points
The schema links bank data to existing ERP users, branches, chart of accounts, journal entries and cost centers where those tables exist.

## Compatibility
The migration is idempotent and uses `IF NOT EXISTS`/upserts. Existing bank data is not deleted. Extended account records are automatically initialized from the legacy `bank_accounts` rows.
