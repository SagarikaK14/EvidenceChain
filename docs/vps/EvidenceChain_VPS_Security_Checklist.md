# EVIDENCECHAIN — VPS SECURITY CHECKLIST & HARDENING AUDIT

**Document ID:** EVC-VPS-SEC-2026-01  
**Target Environment:** Ubuntu 24.04 LTS Public Demonstration  
**Classification:** Security Assurance Checklist  
**Date:** October 29, 2026  

---

## 1. Zero Protected Data Verification Checklist

| Security Control | Verification Procedure | Verification Standard | Status |
| :--- | :--- | :--- | :---: |
| **SEC-01: No Protected DB** | Check `/var/lib/evidencechain/` on VPS | File `evidencechain.db` does NOT exist | [ ] Pending Gate 2 |
| **SEC-02: No Protected State** | Check Anvil state on VPS | File `.anvil_state.json` does NOT exist | [ ] Pending Gate 2 |
| **SEC-03: No Original Files** | Inspect `/var/lib/evidencechain/uploads` | Zero files from local Mac `backend/uploads` | [ ] Pending Gate 2 |
| **SEC-04: No Development Keys** | Scan `.env` on VPS | Fresh generated `SECRET_KEY` (64 hex chars) | [ ] Pending Gate 2 |
| **SEC-05: Sanitized Tarball** | Run `tar -ztvf` on release artifact | Only tracked source code, no binaries or dumps | [ ] Verified Gate 1 |

---

## 2. Network & Host Hardening Checklist

| Security Control | Verification Procedure | Verification Standard | Status |
| :--- | :--- | :--- | :---: |
| **NET-01: UFW Firewall** | `sudo ufw status verbose` | Default: deny incoming. Allowed: 22, 80, 443 | [ ] Pending Gate 2 |
| **NET-02: Anvil Port Isolation** | `ss -tulpn \| grep 8545` | Bound strictly to `127.0.0.1:8545` | [ ] Pending Gate 2 |
| **NET-03: Flask API Isolation** | `ss -tulpn \| grep 5001` | Bound strictly to `127.0.0.1:5001` | [ ] Pending Gate 2 |
| **NET-04: External RPC Block** | `curl -m 2 http://YOUR_SERVER_IP:8545` | Connection refused / timed out | [ ] Pending Gate 2 |
| **NET-05: External API Block** | `curl -m 2 http://YOUR_SERVER_IP:5001` | Connection refused / timed out | [ ] Pending Gate 2 |
| **NET-06: SSH Hardening** | `sshd -T \| grep permitrootlogin` | `permitrootlogin prohibit-password` / no | [ ] Pending Gate 2 |

---

## 3. Web & Application Security Checklist

| Security Control | Verification Procedure | Verification Standard | Status |
| :--- | :--- | :--- | :---: |
| **WEB-01: HTTPS Enforced** | `curl -I http://demo.evidencechain.org` | HTTP 301 redirect to `https://...` | [ ] Pending Gate 3 |
| **WEB-02: Security Headers** | `curl -I https://demo.evidencechain.org` | `X-Content-Type-Options: nosniff`, `SAMEORIGIN` | [ ] Pending Gate 3 |
| **WEB-03: Session Cookies** | Inspect `Set-Cookie` response header | Contains `HttpOnly`, `SameSite=Lax`, `Secure` | [x] Verified Gate 1 |
| **WEB-04: CSRF Origin/Referer Defense** | Cross-origin POST request | Blocked with HTTP 403 Forbidden | [x] Verified Gate 1 |
| **WEB-05: Upload Boundary (10 MB)** | Attempt upload of > 10 MB file | Returns HTTP 413 Payload Too Large | [x] Verified Gate 1 |
| **WEB-06: Hidden File Block** | `curl https://demo.evidencechain.org/.env` | Returns HTTP 403 Forbidden | [ ] Pending Gate 3 |
| **WEB-07: DB File Block** | `curl https://.../demo_evidence.db` | Returns HTTP 403 Forbidden | [ ] Pending Gate 3 |

---

## 4. Blockchain & Identity Gating Checklist

| Security Control | Verification Procedure | Verification Standard | Status |
| :--- | :--- | :--- | :---: |
| **EVM-01: Demo Chain ID** | Query `eth_chainId` via loopback | Returns `0x7a69` (`31337`) | [ ] Pending Gate 2 |
| **EVM-02: Fresh Genesis** | Query contract deployment block | Deployed at Block #1 on fresh VPS chain | [ ] Pending Gate 2 |
| **EVM-03: Unlocked Account Guard** | Attempt external `eth_sendTransaction` | Inaccessible from internet (loopback only) | [x] Verified Gate 1 |
| **EVM-04: Transaction Rate Limiting** | Rapid POST to `/api/evidence/register` | Rate limited after 3 req/min (HTTP 429) | [x] Verified Gate 1 |
| **EVM-05: Demo Registration Quota** | 6th registration attempt in demo session | Blocked with HTTP 403 Forbidden | [x] Verified Gate 1 |
| **EVM-06: Demo Admin Block** | Demo session calling grant/revoke endpoints | Blocked with HTTP 403 Forbidden | [x] Verified Gate 1 |
| **EVM-07: Unauthenticated TX Rejection** | POST to `/api/evidence/register` without session | Blocked with HTTP 401 Unauthorized | [x] Verified Gate 1 |

---

## 5. Public Demo Safety & User Experience Checklist

| Security Control | Verification Procedure | Verification Standard | Status |
| :--- | :--- | :--- | :---: |
| **DMO-01: Demo Notice Banner** | Load landing page in browser | Prominently displays "Demonstration Environment" | [x] Verified Gate 1 |
| **DMO-02: Synthetic Profiles Only** | Query `/api/auth/demo-profiles` | Displays only synthetic non-admin personnel | [x] Verified Gate 1 |
| **DMO-03: No Pseudo-MFA Leakage** | Inspect `/api/auth/login` and `/mfa/resend` | Zero `demoOtp` or secrets in JSON response | [x] Verified Gate 1 |
| **DMO-04: HOD Escalation Prevention** | Attempt demo sign-in as HOD / Admin | Blocked with HTTP 403 Forbidden | [x] Verified Gate 1 |
| **DMO-05: Protected Account Defense** | Attempt demo sign-in with `@forensics.example.com` | Blocked with HTTP 403 Forbidden | [x] Verified Gate 1 |
| **DMO-06: Session Expiration** | Inspect demo session metadata | Strict 30-minute lifetime (`expires_at`) | [x] Verified Gate 1 |
| **DMO-07: Role Switching Block** | Attempt `/api/auth/demo-switch` outside loopback | Returns HTTP 403 Forbidden | [x] Verified Gate 1 |
| **DMO-08: Clean Error Sanitization**| Trigger malformed API call | Returns structured JSON error, no stack trace | [x] Verified Gate 1 |
