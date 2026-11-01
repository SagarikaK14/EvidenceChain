# EVIDENCECHAIN — VPS ENVIRONMENT CONFIGURATION TEMPLATE

**Target File:** `/opt/evidencechain/backend/.env`  
**File Permissions:** `chmod 600 /opt/evidencechain/backend/.env` (Owned by `evidencechain:evidencechain`)  
**Revision:** Demonstration Release 1.0  

---

```ini
# ==============================================================================
# EVIDENCECHAIN DEMONSTRATION VPS ENVIRONMENT CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. CORE APPLICATION ENVIRONMENT
# ------------------------------------------------------------------------------
# Set explicitly to production to disable Flask debug reloaders and stack traces
FLASK_ENV=production
ENVIRONMENT=production

# Cryptographically strong secret key for signing session cookies
# Generate via: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=replace_with_generated_64_character_hex_secret_key_here

# ------------------------------------------------------------------------------
# 2. SESSION & COOKIE SECURITY
# ------------------------------------------------------------------------------
# Enforces transmission strictly over HTTPS TLS connections
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax
PERMANENT_SESSION_LIFETIME=28800

# ------------------------------------------------------------------------------
# 3. PUBLIC DEMO SECURITY GATEWAYS
# ------------------------------------------------------------------------------
# Disables development persona switching and raw debugging utilities
ALLOW_DEV_DEMO_SWITCH=false
ALLOW_DEV_DIAGNOSTICS=false

# Enables demonstration mode for public visitors:
# Displays the synthetic 6-digit MFA challenge code directly on the demo login portal
PUBLIC_DEMO_MODE=true

# ------------------------------------------------------------------------------
# 4. DATABASE & REPOSITORY PATHS (SEPARATE FROM SOURCE CODE)
# ------------------------------------------------------------------------------
# Dedicated demo SQLite database file location
DATABASE_PATH=/var/lib/evidencechain/demo_evidence.db

# Dedicated demo evidence files upload directory
UPLOAD_FOLDER=/var/lib/evidencechain/uploads

# Maximum allowed file upload size (50 MB in bytes: 52428800)
MAX_CONTENT_LENGTH=52428800

# ------------------------------------------------------------------------------
# 5. BLOCKCHAIN LEDGER COORDINATES (LOCAL ANVIL INSTANCE)
# ------------------------------------------------------------------------------
# Loopback JSON-RPC endpoint for local persistent Anvil daemon
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545

# Address of EvidenceChain smart contract deployed on the demo chain
# (Generated during demo contract initialization)
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# Expected Chain ID for private demonstration testnet
EXPECTED_CHAIN_ID=31337
```

---

## Variable Reference & Security Specifications

| Variable | Recommended VPS Value | Security Impact / Rationale |
| :--- | :--- | :--- |
| `FLASK_ENV` | `production` | Disables Flask debug pin and unhandled trace leaks |
| `SECRET_KEY` | 64-char Hex String | Prevents forgery of client-side session authentication cookies |
| `SESSION_COOKIE_SECURE` | `true` | Restricts cookies exclusively to encrypted HTTPS channels |
| `DATABASE_PATH` | `/var/lib/evidencechain/demo_evidence.db` | Isolates demonstration database from repository code |
| `UPLOAD_FOLDER` | `/var/lib/evidencechain/uploads` | Isolates evidence uploads from git tracking |
| `BLOCKCHAIN_RPC_URL` | `http://127.0.0.1:8545` | Binds EVM queries strictly to internal server loopback |
| `PUBLIC_DEMO_MODE` | `true` | Transparently discloses synthetic OTP codes to public visitors |
| `ALLOW_DEV_DEMO_SWITCH` | `false` | Prevents unauthenticated role switching on public web |
