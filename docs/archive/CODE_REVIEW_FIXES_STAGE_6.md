# CODE_REVIEW_FIXES_STAGE_6

## Employee self-service hardening
- Employee biometric enrollment now ignores a client-supplied employee_id and binds enrollment to the authenticated employee.
- QR attendance now binds employee identity to the authenticated employee for employee tokens.
- QR attendance now rejects a QR code belonging to another branch for employee self-service.
- QR tokens are consumed only after branch/geofence checks succeed.
- Duplicate QR consumption returns HTTP 409 instead of a generic 500.
- Employee mobile attendance no longer accepts client-provided attendance date/time overrides.
- Employee portal request listing endpoint is scoped to the authenticated employee; it cannot expose all employees' requests.

## Verification
- Source-level brace balance was checked on modified HR route.
- Existing repository SQL parameterization patterns were reviewed.
- Full TypeScript build/test execution remains dependent on installing the project's Node dependencies.
