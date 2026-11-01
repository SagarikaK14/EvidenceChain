# EVIDENCECHAIN — VPS DEMONSTRATION DEPLOYMENT PLAN

**Document ID:** EVC-VPS-PLAN-2026-01  
**Target Platform:** Ubuntu 24.04 LTS (x86_64 or ARM64)  
**Security Level:** Public Demonstration Environment (Synthetic Data Only)  
**Date:** October 29, 2026  
**Status:** Gate 1 Review Submission  

---

## 1. Objective & Non-Negotiable Protection Rules

The objective is to establish a high-security, reproducible, and fully functional public demonstration of EvidenceChain accessible over HTTPS on an Ubuntu 24.04 LTS VPS.

### 1.1 Absolute Protection Rules
1. **Never Deploy Protected Data:** Under no circumstances will `backend/evidencechain.db`, `.anvil_state.json`, `backend/uploads/`, development `.env`, or historical evidence manifests be transferred to the VPS.
2. **Fresh Demonstration Ledger:** The VPS will run an entirely separate Foundry Anvil instance initialized at block 0, with a newly deployed demonstration smart contract instance.
3. **Synthetic Evidence Exclusively:** The VPS database and file repository will be populated with 100% fictional cases, officers, and synthetic forensic files.
4. **Local Development Preservation:** The local macOS development environment remains completely untouched.

---

## 2. Multi-Tier Production Architecture

```
                    Internet Visitors (HTTPS: 443)
                                │
                                ▼
         ┌──────────────────────────────────────────────┐
         │ Nginx Reverse Proxy (TLS Termination)        │
         │ - Static React SPA (/var/www/evidencechain)  │
         │ - Rate Limiting (10 req/s, burst=20)         │
         │ - Security Headers (nosniff, SAMEORIGIN)     │
         │ - Max Upload Size (50 MB)                    │
         └──────────────┬───────────────────────────────┘
                        │
                        │ Proxy: /api/* (HTTP: 127.0.0.1:5001)
                        ▼
         ┌──────────────────────────────────────────────┐
         │ Gunicorn WSGI Server (evidencechain-api)     │
         │ - 4 Workers, Bound to 127.0.0.1:5001         │
         │ - User: evidencechain (Non-root service)     │
         │ - Session Cookies (Secure, HttpOnly, Lax)    │
         └───────┬──────────────────────────────┬───────┘
                 │                              │
                 ▼                              ▼
    ┌────────────────────────┐    ┌────────────────────────┐
    │ SQLite Register (Demo) │    │ Anvil Consensus Node   │
    │ /var/lib/evidencechain/│    │ Port 127.0.0.1:8545    │
    │ demo_evidence.db (WAL) │    │ Chain ID: 31337        │
    │ Payloads: /var/lib/... │    │ .anvil_demo_state.json │
    └────────────────────────┘    └────────────────────────┘
```

---

## 3. Phased Execution & Approval Gates

EvidenceChain deployment is partitioned into three strict approval gates:

### GATE 1 — Local Audit, Planning & Packaging (CURRENT STAGE)
- [x] Complete 18-point Phase A compatibility audit (`EvidenceChain_VPS_Deployment_Audit.md`).
- [x] Identify deployment blockers and formulate targeted source code adjustments.
- [x] Draft all 10 deployment specifications, service units, Nginx configs, and initialization scripts.
- [x] Design the sanitized release artifact packaging pipeline.
- [x] **HALT AND PRESENT GATE 1 FOR EXPLICIT USER APPROVAL.**

### GATE 2 — VPS Provisioning, Staging & Isolation (REQUIRES USER APPROVAL)
- Execute VPS host setup (Ubuntu 24.04 LTS, non-root user, UFW firewall).
- Install system dependencies (Python 3.12, Node.js 20 LTS, Foundry Anvil, Nginx).
- Deploy sanitized release bundle to `/opt/evidencechain`.
- Launch isolated demonstration Anvil blockchain on loopback `127.0.0.1:8545`.
- Deploy fresh demonstration `EvidenceChain.sol` smart contract instance.
- Seed synthetic demo database and payload files.
- Configure and start `evidencechain-anvil.service` and `evidencechain-api.service`.
- **HALT BEFORE PUBLIC EXPOSURE FOR STAGING VALIDATION.**

### GATE 3 — Public Exposure, TLS & Final Smoke Tests (REQUIRES USER APPROVAL)
- Configure Certbot Let's Encrypt TLS certificates.
- Enable public Nginx site configuration with HTTP-to-HTTPS redirect.
- Execute full 18-point functional and security smoke test suite.
- Verify zero leakage of protected data and zero exposure of internal RPC ports.
- Deliver final deployment sign-off.

---

## 4. Proposed Code Changes for VPS Compatibility

To ensure clean execution on the VPS, four minimally invasive, targeted adjustments will be applied to the deployment branch:

### Fix 1: Frontend API Base URL Dynamic Fallback
In `frontend/src/api.js` (lines 6–9) and `frontend/src/App.jsx` (lines 45–48):
```javascript
// Before:
const API_BASE_URL = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:5001" : "http://127.0.0.1:5001";

// After (VPS Compatible):
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5001"
      : "");
```
*Effect:* When hosted on a domain/IP behind Nginx, `API_BASE_URL` becomes `""`, causing all API calls to route via `/api/...` through the secure Nginx reverse proxy.

### Fix 2: Backend Upload Folder Environment Binding
In `backend/app.py` (line 106):
```python
# Before:
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

# After:
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
```
*Effect:* Allows production file uploads to be stored in `/var/lib/evidencechain/uploads`, separate from application code.

### Fix 3: Pinned Python Requirements (`backend/requirements.txt`)
Generate and commit `backend/requirements.txt`:
```
Flask==3.1.3
flask-cors==6.0.5
web3==8.0.0
gunicorn==23.0.0
python-dotenv==1.2.3
pycryptodome==3.23.0
PyJWT==2.14.0
requests==2.34.2
Werkzeug==3.1.8
```

### Fix 4: Public Demo Mode Authentication Helper
In `backend/auth.py` and `frontend/src/views/LoginView.jsx`:
- When `PUBLIC_DEMO_MODE=true` is set in `.env`, the login challenge response includes `"demoOtp": otp` for synthetic demo profiles, and `LoginView.jsx` displays the code directly in the prompt.
- Visitors can experience the full 2-step MFA flow without requiring server terminal access.

---

## 5. Sanitized Deployment Release Plan

To guarantee zero transfer of protected assets:
1. Create a sanitized tarball `evidencechain-demo-v1.0.tar.gz` from Git tracking (`git archive`).
2. The archive includes:
   - Application source code (`frontend/src/`, `backend/`, `contracts/`, `artifacts/`)
   - Production configuration templates (`.env.demo.template`, Nginx configs, systemd units)
   - Synthetic demo database seeder (`scripts/seed_synthetic_demo.py`)
3. The archive strictly excludes:
   - `backend/evidencechain.db`
   - `.anvil_state.json`
   - `backend/uploads/`
   - `backups/`
   - `.env`
   - All screenshot archives and test artifacts
