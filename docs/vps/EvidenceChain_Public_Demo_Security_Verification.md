# EVIDENCECHAIN — PUBLIC DEMO SECURITY VERIFICATION REPORT
**Document Reference:** `EC-REPORT-2026-VPS-DEMO-SECURITY-01`  
**Classification:** APPLICATION SECURITY & THREAT AUDIT  
**Date:** October 29, 2026  
**Auditor / Roles:** Application Security Auditor & Senior Backend Engineer  
**Target Module:** `backend/auth.py`, `backend/routes/`, `scripts/seed_synthetic_demo.py`  
**Public Demo Mode Status:** HARDENED & VERIFIED ISOLATED  

---

## 1. OBJECTIVE & EXECUTIVE SUMMARY

The deployment of EvidenceChain to a publicly accessible Ubuntu VPS demo website requires that the public cannot tamper with protected institutional accounts, escalate privileges to Head of Department (HOD) authority, exhaust server resources, or submit uncontrolled transactions to the blockchain.

This audit validates:
1. Hardening of `POST /api/auth/demo-login`.
2. Strict separation of synthetic demonstration personas from protected development identities.
3. Automated prevention of administrative privilege escalation.
4. Server-side session lifespan controls and IP rate limits.
5. Protection of all blockchain write routes.

---

## 2. PUBLIC DEMO AUTHENTICATION ARCHITECTURE (`POST /api/auth/demo-login`)

The demonstration authentication endpoint permits seamless evaluation of the Living Dossier interface by non-technical visitors while enforcing strict defense-in-depth protections.

### Source Implementation Verification (`backend/auth.py`)

```python
# Security Check 1: Block administrative and Head of Department (HOD) escalation
if resolved_email == "v.seth@metro-forensics.gov.example" or "hod" in resolved_email or "director" in resolved_email:
    return jsonify({
        "status": "error",
        "message": "Privilege Escalation Prevention: Administrative and Head of Department (HOD) accounts cannot be accessed via demonstration authentication."
    }), 403

# Security Check 2: Deny access to protected development identities
if resolved_email in PROTECTED_IDENTITIES or resolved_email.endswith("@forensics.example.com") or resolved_email == "officer@example.com":
    return jsonify({
        "status": "error",
        "message": "Access Denied: Demonstration login is restricted to synthetic demonstration identities only. Protected institutional accounts must authenticate via institutional credentials and MFA."
    }), 403

# Security Check 3: Must be an authorized synthetic demonstration persona
if resolved_email not in SYNTHETIC_DEMO_PERSONAS:
    return jsonify({
        "status": "error",
        "message": "Unauthorized demonstration persona. Only designated synthetic demonstration accounts are permitted."
    }), 403
```

---

## 3. SYNTHETIC PERSONA ACCESS MATRIX

The demonstration seeder (`scripts/seed_synthetic_demo.py`) and authentication module configure exactly 5 synthetic personas for public evaluation, plus 1 restricted administrative identity:

| Persona Name | Email | Role | Permitted Demo Login? | Permitted Operations | Privilege Boundaries |
|---|---|---|:---:|---|---|
| **Arjun Mehta** | `a.mehta@metro-forensics.gov.example` | Senior Forensic Officer | **YES** | Register evidence (max 5), verify hashes, view dossier | Cannot grant or revoke permissions |
| **Priya Nair** | `p.nair@metro-forensics.gov.example` | Lead Cyber Investigator | **YES** | Evidence verification, review cases, inspect custody logs | Cannot grant or revoke permissions |
| **Karan Rao** | `k.rao@metro-forensics.gov.example` | Digital Forensics Analyst | **YES** | Cryptographic verification, calculate SHA-256, view telemetry | Cannot grant or revoke permissions |
| **Neha Verma** | `n.verma@metro-forensics.gov.example` | Special Legal Prosecutor | **YES** | Judicial review, chain-of-custody tracking, audit trail | Cannot grant or revoke permissions |
| **Devraj Singh** | `d.singh@metro-forensics.gov.example` | Evidence Vault Custodian | **YES** | Vault media inspection, custodian logs, verification | Cannot grant or revoke permissions |
| **Dr. Vikram Seth** | `v.seth@metro-forensics.gov.example` | Head of Department | **NO (BLOCKED)** | Full authority (Requires CLI dispatch / MFA) | **403 Forbidden on Demo Login** |
| **Dr. Rajeshwar Sen** | `r.sen@forensics.example.com` | Protected Baseline HOD | **NO (BLOCKED)** | Protected Local Dev Only | **403 Forbidden on Public VPS** |

---

## 4. SESSION LIFESPAN, RATE LIMITING & DISCLOSURE

1. **Short-Lived Sessions:**
   - Server-side session timestamp `expires_at` is set to `datetime.now(timezone.utc) + timedelta(minutes=30)`.
   - Every protected route enforces this check, invalidating stale sessions and returning `401 Unauthorized` with `"Session has expired. Please sign in again."`.
2. **IP Rate Limiting:**
   - `DEMO_LOGIN_RATE_LIMITS`: Maximum 5 demo login requests per 60 seconds per IP address (`429 Too Many Requests`).
   - General login rate limiting: Maximum 5 password attempts per 60 seconds per IP address.
3. **Explicit Demonstration Disclosure:**
   Every successful demo login returns structured disclosure metadata in the JSON payload:
   ```json
   {
     "status": "success",
     "isDemoSession": true,
     "authType": "SYNTHETIC_DEMO_PASSTHROUGH",
     "notice": "Demonstration session active using a synthetic persona with restricted operational privileges. Hardware/Dynamic MFA is bypassed for demonstration purposes. Administrative actions (Head of Department authority) and persistent state modification are strictly restricted.",
     "sessionExpiresInSeconds": 1800,
     "role": "Senior Forensic Officer"
   }
   ```

---

## 5. BLOCKCHAIN WRITE ENDPOINTS AUDIT

Every backend route capable of issuing on-chain transactions via unlocked Anvil accounts was audited:

| Endpoint | HTTP Method | Target Contract Function | Access Control & Security Guards | Public Demo Exposure Risk |
|---|:---:|---|---|:---:|
| `/api/evidence/register` | `POST` | `registerEvidence(id, case, hash)` | Requires active session; enforces quota of max 5 registrations per demo session; restricts upload payload to 25MB. | **LOW / MITIGATED** |
| `/api/access/grant` | `POST` | `grantViewAccess` / `grantDownloadAccess` | Requires `Head of Department` role. Demo personas cannot assume HOD role; attempts return `403 Forbidden`. | **ZERO / BLOCKED** |
| `/api/access/revoke` | `POST` | `revokeViewAccess` / `revokeDownloadAccess` | Requires `Head of Department` role. Demo personas cannot assume HOD role; attempts return `403 Forbidden`. | **ZERO / BLOCKED** |
| `/api/audit/record` | `POST` | Internal DB / Verification | Requires active authenticated session; validates evidence ID; rate-limited. | **LOW / MITIGATED** |

---

## 6. AUTOMATED TEST SUITE EVIDENCE

Automated security tests in `backend/tests/test_demo_auth_security.py` and `backend/tests/test_blockchain_endpoint_security.py` verify all rules:

- `test_demo_login_synthetic_personas`: Verifies all 5 synthetic personas successfully log in with restricted role assignment.
- `test_demo_login_blocks_hod_escalation`: Verifies `v.seth...` returns `403 Forbidden`.
- `test_demo_login_blocks_protected_dev_accounts`: Verifies `r.sen@forensics.example.com` and `officer@example.com` return `403 Forbidden`.
- `test_demo_login_rate_limiting`: Verifies 6th consecutive request within 60s returns `429 Too Many Requests`.
- `test_demo_login_expiration`: Verifies session is rejected after 30 minutes.
- `test_blockchain_unauthorized_access_grant_blocked`: Verifies demo users cannot submit `grantViewAccess` or `grantDownloadAccess`.

**Verdict:** The public demo authentication flow is fully verified, robustly compartmentalized, and ready for deployment.
