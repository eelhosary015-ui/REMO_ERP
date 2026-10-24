# FIX15 — Startup / Migration Fix

## Fixed
1. Enterprise migration registry had two migrations using `ENT_006`.
   - The later database-hardening migration is now `ENT_007`.
   - This removes the startup crash: `Migration version "ENT_006" is already registered`.

2. POS daily-number unique index could fail when legacy duplicate `daily_number` values existed.
   - Startup now deterministically preserves the first row's number per branch/day/number.
   - Later duplicates are moved above the existing daily maximum.
   - The allocator sequence is then backfilled.
   - The unique partial index is created after normalization.

## Expected result
`npm run dev` should pass migration registration and POS index initialization on databases containing legacy duplicates.
