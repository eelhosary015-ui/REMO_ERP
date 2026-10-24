# Code Review Fixes — Stage 4

- Accounting: treasury closing now rejects missing/invalid authenticated operator IDs instead of defaulting to user ID 1.
- Accounts: enhanced balance-sheet queries always restrict journal entries to `posted`, including when `as_of_date` is supplied.
- HR: custody-store audit entry no longer impersonates user ID 1 for the newly-added item action.
- System approvals: leave-balance SQL column selection now uses an explicit allowlist.
