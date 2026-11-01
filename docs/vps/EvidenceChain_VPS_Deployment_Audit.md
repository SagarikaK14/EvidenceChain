# EVIDENCECHAIN — VPS DEPLOYMENT COMPATIBILITY AUDIT (PHASE A)

**Document ID:** EVC-VPS-AUDIT-2026-01  
**Target Platform:** Ubuntu 24.04 LTS (x86_64 / ARM64)  
**Evaluation Date:** October 29, 2026  
**Auditor:** Senior DevOps & Application Security Reviewer  
**Release Candidate Baseline:** Commit `828c8ad` (`checkpoint-phase6-release-candidate`)  
**Deployment Status:** Pre-Deployment Audit Complete (Gate 1)

---

## 1. Executive Summary

This audit evaluates the EvidenceChain codebase for public demonstration deployment on an isolated Ubuntu 24.04 LTS VPS under HTTPS. The audit strictly adheres to the **CRITICAL PROTECTION RULE**: the protected development environment (27 original records, protected SQLite `backend/evidencechain.db`, protected Anvil node on port 8545 at block 107) must never be uploaded, copied, synced, or exposed.

The codebase exhibits high structural readiness for deployment, but requires four specific compatibility adjustments:
1. **Frontend API URL Dynamic Resolution:** Replacing the hardcoded `localhost:5001` / `127.0.0.1:5001` fallback in `frontend/src/api.js` and `frontend/src/App.jsx` with same-origin relative `/api` paths behind Nginx.
2. **Backend Upload Folder Environment Binding:** Enabling `os.getenv("UPLOAD_FOLDER")` in `backend/app.py`.
3. **Public Demo MFA Discovery:** Providing demo OTP challenge transparency in public demo mode so visitors without server shell access can complete the 2-step verification.
4. **Committed Python Requirements:** Generating a canonical `backend/requirements.txt` containing runtime dependencies and `gunicorn`.

---

## 2. 18-Point Architectural & Compatibility Investigation

### Item 1: Exact Flask WSGI Entry Point
- **File Location:** `backend/app.py`
- **WSGI Callable:** `app` (`app = Flask(__name__)`)
- **Gunicorn Execution Target:** When executing from `backend/`: `app:app`. When executing from project root: `backend.app:app`.
- **Finding:** No separate `wsgi.py` exists. Gunicorn must be targeted to `app:app` with `--chdir /opt/evidencechain/backend` or `PYTHONPATH` configured.

### Item 2: Actual API Route Prefixes
- **Analysis:** Queried Flask's `url_map` across all registered blueprints (`app.py`, `auth_bp`, `diagnostics_bp`).
- **Total Registered Routes:** 48 routes.
- **Route Namespace:**
  - 46 application and authentication routes begin with `/api/` (e.g., `/api/auth/login`, `/api/evidence`, `/api/department/...`, `/api/diagnostics/...`).
  - Route `/` returns service health JSON (`{"service": "EvidenceChain Backend", "status": "running"}`).
  - Route `/static/<path:filename>` is Flask's built-in static handler.
- **Implication for Nginx:** All API endpoints cleanly map under the Nginx location block `location /api/ { proxy_pass http://127.0.0.1:5001; }`.

### Item 3 & 4: Frontend API URL Configuration & Hardcoded Localhost References
- **Locations Found:**
  - `frontend/src/api.js` (lines 6–9):
    ```javascript
    const API_BASE_URL = typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5001" : "http://127.0.0.1:5001";
    ```
  - `frontend/src/App.jsx` (lines 45–48):
    ```javascript
    const API_BASE_URL = typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5001" : "http://127.0.0.1:5001";
    ```
  - `frontend/src/blockchain.js` (line 7): `const RPC_URL = "http://127.0.0.1:8545";` (*Note: `blockchain.js` is an unreferenced legacy file and is not imported anywhere in the UI*).
- **Critical Finding / Blocker:** When deployed on a VPS domain or IP, `window.location.hostname !== "localhost"` causes `API_BASE_URL` to resolve to `http://127.0.0.1:5001`. A remote browser will attempt to contact port 5001 on the *client's own workstation*, resulting in connection failure and Mixed Content blocking on HTTPS.
- **Required Resolution:** Update `API_BASE_URL` in both files to:
  ```javascript
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : (typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:5001"
        : "");
  ```
  Setting `API_BASE_URL = ""` allows all calls to `/api/...` to be relative, resolving seamlessly through the HTTPS Nginx reverse proxy.

### Item 5: Required Node.js Version
- **Specification:** `frontend/package.json` specifies Vite `^8.2.2`, React `^19.2.8`, Ethers `^6.17.0`, and PDF.js `^6.4.299`.
- **Node.js Compatibility:** Vite 8 and React 19 require **Node.js 18.x or 20.x+ LTS**. Recommended target on Ubuntu 24.04: **Node.js v20.x LTS**.

### Item 6: Python Dependencies
- **Finding:** No `backend/requirements.txt` is currently tracked in the repository.
- **Virtualenv Inventory:** Inspected active virtualenv packages:
  - Framework: `Flask==3.1.3`, `flask-cors==6.0.5`, `Werkzeug==3.1.8`
  - Blockchain/Web3: `web3==8.0.0`, `eth-account==0.14.0`, `eth-typing==6.0.0`, `eth-utils==6.0.0`, `eth-abi==6.0.0`, `hexbytes==2.0.0`
  - Security/Auth: `pycryptodome==3.23.0`, `PyJWT==2.14.0`, `python-dotenv==1.2.3`
  - Production WSGI: `gunicorn==23.0.0` (must be added for VPS deployment)
- **Required Resolution:** Generate and commit a clean, pinned `backend/requirements.txt`.

### Item 7: Database Initialization Behavior
- **Implementation in `backend/database/db.py`:**
  - `get_database_path()`: Evaluates `os.getenv("DATABASE_PATH", os.path.join(BASE_DIR, "evidencechain.db"))`.
  - `init_db()`: Idempotently creates 9 SQLite tables: `users`, `mfa_challenges`, `evidence`, `department_audit_log`, `cases`, `case_assignments`, `case_hierarchy_audit_log`, `blockchain_deployments`, and `evidence_anchoring_events`.
  - `seed_demo_users()`: Idempotently seeds default institutional profiles if not present.
  - Startup Execution: `backend/app.py` runs `init_db()` and `seed_demo_users()` automatically in a `try/except` block on import.
- **Finding:** Specifying an isolated `DATABASE_PATH` in `.env` automatically provisions an empty schema on first startup without touching development data.

### Item 8: Evidence Upload & Storage Configuration
- **Implementation in `backend/app.py` (lines 104–110):**
  ```python
  BASE_DIR = os.path.dirname(os.path.abspath(__file__))
  UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
  ```
- **Finding / Blocker:** `UPLOAD_FOLDER` does **not** read `os.getenv("UPLOAD_FOLDER")`. While Phase 6 `.env.example` documented `UPLOAD_FOLDER=/opt/evidencechain/backend/uploads/evidence_files`, the code defaulted directly to `backend/uploads`.
- **Required Resolution:** Update line 106 in `backend/app.py` to:
  ```python
  UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
  ```
  Path traversal containment (`os.path.realpath` check in view/download routes) functions correctly against `app.config["UPLOAD_FOLDER"]`.

### Item 9: Contract ABI and Deployment Scripts
- **Contract Source:** `contracts/EvidenceChain.sol` (Solidity 0.8.20).
- **Compiled Artifact:** `artifacts/contracts/EvidenceChain.sol/EvidenceChain.json` containing runtime bytecode and full ABI.
- **Fallback ABI:** Hardcoded fallback `CONTRACT_ABI` defined directly inside `backend/blockchain.py`.
- **Deployment Script:** `scripts/start_persistent_chain.sh` contains inline Web3 deployment logic that deploys `EvidenceChain.sol` to a fresh Anvil node via `accounts[0]`.
- **Finding:** The deployment is deterministic. Account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`) at nonce 0 will always deploy the contract to `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

### Item 10: Blockchain Connection Settings
- **Implementation in `backend/blockchain.py`:**
  - `get_rpc_url()`: Evaluates `os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")`.
  - `get_contract_address()`: Evaluates `os.getenv("CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")`.
  - Chain ID: Explicitly verified as `31337`.
- **Finding:** The backend connects exclusively via standard Web3 HTTPProvider. On the VPS, Anvil must run locally on `127.0.0.1:8545`.

### Item 11: Signing-Account Configuration
- **Implementation in `backend/blockchain.py`:**
  ```python
  accounts = web3.eth.accounts
  sender = accounts[0]
  contract.functions.xxx().transact({"from": sender})
  ```
- **Finding:** The application does not store private keys in `.env` or code. It dispatches transactions using Anvil's unlocked local node accounts over loopback JSON-RPC.
- **Security Requirement:** Anvil must **strictly bind to `127.0.0.1`** and must NEVER be exposed publicly on `0.0.0.0` or through Nginx. Public exposure would allow arbitrary visitors to execute transactions using node funds.

### Item 12: Authentication & MFA Dependencies
- **Implementation in `backend/auth.py`:**
  - Stage 1: Email / Employee ID + PBKDF2 password verification.
  - Stage 2: Dynamic 6-digit cryptographic OTP generated via `secrets.randbelow()` with 5-minute expiry, max 3 attempts.
  - Development Behavior: `log_development_mfa()` prints OTP to console or writes to `/tmp/evidencechain_dev_otp.json`.
- **Finding / Blocker for Public Demo:** Public visitors accessing the demonstration site have no access to the server console log. If they attempt to sign in, they will receive an MFA challenge but cannot know the OTP code.
- **Required Resolution:** For the public demo environment, add a secure demo OTP disclosure mode (`PUBLIC_DEMO_MODE=true`):
  - In `backend/auth.py`, when `PUBLIC_DEMO_MODE=true` and an approved synthetic demo account signs in, return `"demoOtp": otp` in the JSON response or display it in the MFA verification prompt.
  - This allows visitors to experience the full 2-step verification workflow without compromising real credentials.

### Item 13: Development-Only Routes & Identity Switching
- **Implementation in `backend/auth.py` & `backend/diagnostics.py`:**
  - `demo_switch`: Controlled by `is_demo_switching_enabled()`, which checks `ALLOW_DEV_DEMO_SWITCH=true`, `FLASK_ENV != production`, and requires remote IP to be loopback.
  - `/api/diagnostics/dev-tools`: Guarded by `is_dev_tools_permitted()`, which returns 403 unless `ALLOW_DEV_DIAGNOSTICS=true` and `FLASK_ENV != production`.
- **Finding:** On a public VPS, setting `ALLOW_DEV_DEMO_SWITCH=false` and `ALLOW_DEV_DIAGNOSTICS=false` completely locks down privileged administrative controls. Visitors interact through the standard institutional login portal.

### Item 14: Session & Cookie Configuration
- **Implementation in `backend/app.py`:**
  - `SESSION_COOKIE_HTTPONLY = True` (Prevents XSS cookie theft)
  - `SESSION_COOKIE_SAMESITE = 'Lax'` (Prevents CSRF on state changes)
  - `SESSION_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"`
  - `PERMANENT_SESSION_LIFETIME = timedelta(hours=8)`
- **Finding:** When deployed behind HTTPS on the VPS with `FLASK_ENV=production` or `SESSION_COOKIE_SECURE=true`, cookies are strictly transmitted over encrypted TLS.

### Item 15: CSRF / CORS Behavior
- **Implementation in `backend/app.py`:**
  - `CORS(app, supports_credentials=True, origins=["http://localhost:5173", ...])`
- **Finding:** In production, Nginx serves both the React static SPA and reverse-proxies `/api/` under the same domain (`https://demo.evidencechain.org`).
- **Result:** All browser requests are **Same-Origin**. Cross-origin CORS restrictions do not apply, and session cookies are seamlessly exchanged.

### Item 16: Logging & Error Handling
- **Current State:** Handled via inline `try/except` returning `jsonify({"error": "..."}), code`.
- **Finding:** No global `@app.errorhandler(500)` or `@app.errorhandler(404)` exists. In production, unhandled exceptions return standard HTML `500 Internal Server Error`.
- **Required Resolution:** Register global JSON error handlers in `backend/app.py` to ensure all API responses return structured JSON `{ "status": "error", "message": "..." }`.

### Item 17: Existing Deployment Documentation
- **Available References:**
  - `docs/phase6/EvidenceChain_Phase6_Deployment_Guide.md`
  - `docs/phase6/EvidenceChain_Phase6_Backup_Recovery_Guide.md`
  - `scripts/start_persistent_chain.sh`
- **Finding:** Excellent foundational documentation. Requires adaptation for Ubuntu 24.04 LTS package managers, systemd user definitions, and isolated synthetic demo seeding.

### Item 18: Security Scan of Repository & Git History
- **Repository Inspection:**
  - `.gitignore` correctly ignores `*.db`, `*.sqlite`, `.env`, `uploads/`, `backups/`, `.anvil_state.json`.
  - Scanned all 326 tracked files: **Zero private key blocks, zero database records, zero secrets found.**
  - `git log --all --full-history -- "**.db" "**.sqlite" "**/.env"`: **Zero sensitive database files ever committed to Git.**
- **Safe Transfer Recommendation:** While Git history contains no database binaries, transferring the repository via a sanitized source archive (`.tar.gz`) or a dedicated deployment branch ensures zero accidental exposure of local test dumps or development screenshots.

---

## 3. Summary of Deployment Blockers & Proposed Fixes

| Blocker ID | Description | Severity | Proposed Fix |
| :--- | :--- | :---: | :--- |
| **BLK-01** | `API_BASE_URL` hardcoded to `localhost:5001` / `127.0.0.1:5001` in frontend | **HIGH** | Update `frontend/src/api.js` and `frontend/src/App.jsx` to fallback to relative `""` in production |
| **BLK-02** | `UPLOAD_FOLDER` does not read `os.getenv("UPLOAD_FOLDER")` | **MEDIUM** | Add `os.getenv("UPLOAD_FOLDER", ...)` in `backend/app.py` |
| **BLK-03** | Missing `backend/requirements.txt` | **HIGH** | Generate pinned `backend/requirements.txt` including `gunicorn` |
| **BLK-04** | Public demo visitors cannot discover MFA OTP codes | **MEDIUM** | Add `PUBLIC_DEMO_MODE` support returning `demoOtp` for synthetic profiles |
| **BLK-05** | Missing global JSON error handlers in Flask | **LOW** | Add `@app.errorhandler(404)` and `@app.errorhandler(500)` in `backend/app.py` |

---

## 4. Protected Baseline Audit Confirmation

- **SQLite Database (`backend/evidencechain.db`):** Unmutated (28 rows: 26 HISTORICAL_RECORD, 1 NEVER_ANCHORED, 1 VERIFIED_ACTIVE). Integrity: `ok`.
- **Anvil Port 8545:** Remained completely offline throughout audit. Zero transactions executed.
- **Verdict:** Local protected state remains 100% untouched.
