# Remo Pro — Stage 2 Security Center

Implemented security hardening for authenticated accounts:

- Persistent server-side sessions with JTI, expiry, last-seen, IP and user-agent.
- Session validation on API requests and session revocation endpoints.
- Revoke one session or all other sessions.
- TOTP 2FA setup/confirmation/disable with encrypted secret at rest.
- QR code provisioning for authenticator apps.
- 2FA challenge during normal `/api/login` and `/api/login/2fa` completion.
- Security event log for login, 2FA and session events.
- Password changes revoke other active sessions.
- Removed the hardcoded `admin/admin` mobile backdoor.
- Mobile login JWTs now receive server-side session records.

Environment:
- `SECURITY_ENCRYPTION_KEY` is recommended and should be a long random secret. If omitted, the service derives encryption material from `JWT_SECRET`.
