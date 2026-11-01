# EVIDENCECHAIN — LOCAL DEMONSTRATION TEST RESULTS REPORT
**Document Reference:** `EC-REPORT-2026-LOCAL-DEMO-TESTS-01`  
**Classification:** QUALITY ASSURANCE, CRYPTOGRAPHIC AUDIT & COMPLIANCE VERIFICATION  
**Evaluation Date:** November 1, 2026  
**Auditor / Roles:** Senior Full-Stack Engineer, Application Security Auditor & DevOps Engineer  
**Target Architecture:**
- Local Same-Origin Reverse Proxy: `http://127.0.0.1:8080`
- Production Gunicorn WSGI Backend: `http://127.0.0.1:5101` (2 sync workers, 120s timeout)
- Demonstration Anvil EVM: `http://127.0.0.1:8555` (Chain ID 31337, Persistent State Snapshot)
- Protected Development Anvil Node: `http://127.0.0.1:8545` (Chain ID 31337, Frozen Block #113)
- Protected Baseline Database: `EvidenceChain/backend/evidencechain.db` (Manifest `148edd48...`)  
**Readiness Verdict:** **PASS — 14/14 SMOKE TESTS | 12/12 SECURITY CONTROLS | GENUINE RESTART PERSISTENCE VERIFIED | 102/102 REGRESSION TESTS**

---

## 1. SMOKE TEST RESULTS SCORECARD (`scripts/run_smoke_tests.py`)

| # | Test Verification Item | Target Endpoint | HTTP Method | Expected Result | Observed Status | Verdict |
|:---:|---|---|:---:|---|---|:---:|
| **01** | Static Frontend Ingress | `http://127.0.0.1:8080/` | `GET` | HTTP 200, serves React SPA bundle | 200 OK (884 bytes index.html) | **PASS** |
| **02** | Reverse Proxy API Pass | `http://127.0.0.1:8080/api/health` | `GET` | HTTP 200, `{"status": "ok"}` | 200 OK (`service: EvidenceChain`) | **PASS** |
| **03** | Synthetic Demo Sign-In | `/api/auth/demo-login` | `POST` | HTTP 200, Arjun Mehta session, 30m exp | 200 OK (Role: Senior Forensic Officer) | **PASS** |
| **04** | Protected Identity Rejection | `/api/auth/demo-login` | `POST` | HTTP 403 Forbidden on `@forensics.example.com` | 403 Forbidden (Blocked 3/3 targets) | **PASS** |
| **05** | Synthetic Repository Listing | `/api/evidence` | `GET` | Returns synthetic records only | 200 OK (0 baseline records returned) | **PASS** |
| **06** | Real EVM Evidence Anchoring | `/api/evidence/register` | `POST` | Real tx hash + block receipt from Anvil 8555 | 201 Created (Tx receipt on port 8555) | **PASS** |
| **07** | SHA-256 Digest Verification | `/api/evidence/<id>/verify` | `POST` | Result `AUTHENTIC` via genuine on-chain hash | 200 OK (`result: AUTHENTIC`) | **PASS** |
| **08** | Fresh Anvil State Mining | Port 8555 JSON-RPC | `POST` | Block height increments with each write | Block receipt confirmed mined | **PASS** |
| **09** | Role Privilege Enforcement | `/api/evidence/<id>/view-access/grant` | `POST` | HTTP 403 Forbidden for non-HOD personas | 403 Forbidden (`Unauthorized role`) | **PASS** |
| **10** | Access History Auditing | `/api/evidence/<id>/access-history`| `GET` | HTTP 200, structured audit log returned | 200 OK (responsive) | **PASS** |
| **11** | Baseline SQLite Preservation | `backend/evidencechain.db` | Direct SQL | 27 records, manifest `148edd48...` | Bit-for-bit match (`148edd48...`) | **PASS** |
| **12** | Baseline Anvil Preservation | Port 8545 JSON-RPC | `POST` | Block height remains strictly at Block #113 | Block #113 confirmed frozen | **PASS** |
| **13** | CSRF Malicious Origin Block | `/api/auth/demo-login` | `POST` | HTTP 403 for `https://malicious-attacker.com` | 403 Forbidden (`Request origin not authorized`) | **PASS** |
| **14** | Exact Origin Enforced (No Wildcard) | `/api/auth/demo-login` | `POST` | Rejects arbitrary trycloudflare, accepts exact | Unregistered: 400/403, Exact: 200 OK | **PASS** |

---

## 2. TARGETED SECURITY SAFEGUARDS SCORECARD (`scripts/verify_security_safeguards.py`)

| Control # | Control Description | Expected Behavior | Observed Result | Verdict |
|:---:|---|---|---|:---:|
| **01** | Cloudflare Tunnel Target Restriction | Exclusively targets `http://127.0.0.1:8080` | Verified across all runbooks and scripts | **PASS** |
| **02** | Loopback Binding Isolation | No external interface listening | Ports 5101, 8555, 8080 bound strictly to `127.0.0.1` | **PASS** |
| **03** | Host Header Injection Defense | Reject unexpected Host headers | `evil-attacker.com`: 400, `unregistered.trycloudflare`: 400 | **PASS** |
| **04** | CSRF Origin Whitelist Enforcement | Reject unauthorized state-changing origins | `malicious-site.com`: 403, `other.trycloudflare`: 403 | **PASS** |
| **05** | Dynamic Exact PUBLIC_DEMO_ORIGIN & Quarantine | Reject before enable (503), accept exact (200), reject other (403) | Quarantine: 503, Exact: 200 OK, Other: 403 | **PASS** |
| **06** | Proxy Header Stripping & Anti-Spoofing | Strip client-supplied `X-Forwarded-*` | Injected `X-Forwarded-Host: evil.com` stripped safely | **PASS** |
| **07** | Cookie Security Attributes Audit | HttpOnly, SameSite=Lax, and Secure on HTTPS | `HttpOnly=True`, `SameSite=Lax`, `Secure=True` (HTTPS) | **PASS** |
| **08** | Inaccessibility of Protected Identities | Reject original personnel emails | `r.sen`, `officer`, `v.seth` blocked with 403 | **PASS** |
| **09** | HOD Privilege Escalation Denial | Non-HOD cannot grant permissions | Access grant blocked with 403 Forbidden | **PASS** |
| **10** | Response Secrets Leakage Prevention | Zero private keys or server paths in JSON | 0 leaks found across `/api/health`, `/api/evidence` | **PASS** |
| **11** | Bounded Uploads & Quotas | File limit 25MB, registration limit 5 | Bounded payload and session quotas verified | **PASS** |
| **12** | Protected Baseline Immutability | Anvil 8545 frozen, SQLite manifest match | Port 8545: Block #113, Manifest: `148edd48...` | **PASS** |

---

## 3. GENUINE RESTART-PERSISTENCE AUDIT (`scripts/run_genuine_persistence_test.py`)

A full, genuine restart-persistence verification was conducted without reseeding. The test registered a brand new synthetic artifact, captured all database and on-chain parameters, executed a cold shutdown of the entire demonstration stack, restarted all services from the persisted Anvil disk snapshot, and verified the transaction receipt and cryptographic validity on-chain.

### 3.1 Pre-Restart Recorded Evidence Metadata
```text
---------------------------------------------------------------------------
RECORDED SYNTHETIC EVIDENCE METADATA (PRE-RESTART):
---------------------------------------------------------------------------
  Evidence ID:             EVD-C21A73EA
  SQLite Row ID:           #29
  SHA-256 Digest:          4ad6f2536d4e76513424811023fb7dff2161d542e783275e5719e37828c6dd7d
  Registration Tx Hash:    2b234d428e5728a57a1f714c05874791f5f3c63a300870775287f4a16181e14b
  Anchor Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  Anchor Block Number:     #16
---------------------------------------------------------------------------
[+] Pre-restart verification result: AUTHENTIC
```

### 3.2 Cold Shutdown & Disk Snapshot Verification
```text
[*] Saving isolated Anvil state snapshot and shutting down demonstration services...
[+] All demonstration ports (8555, 5101, 8080) completely closed.
[+] Verified Anvil snapshot file exists (2,274,705 bytes on disk).
```

### 3.3 Post-Restart Confirmation & On-Chain Audit
```text
[*] Restarting demonstration stack from disk state snapshot (NO RESEEDING)...
[+] Demonstration services successfully restarted.

---------------------------------------------------------------------------
POST-RESTART CONFIRMATION & VERIFICATION AUDIT:
---------------------------------------------------------------------------
[+] Post-restart Demo Anvil Block Height: #16 (Must be >= anchor block #16)
[+] Smart contract bytecode present at 0x5FbDB2315678afecb367f032d93F642f64180aa3 (46,078 bytes).
[+] On-Chain Transaction Receipt Verified: Block #16, Status: 1 (SUCCESS)
[+] SQLite Record Verified: Row #29, ID: EVD-C21A73EA, Digest matches exactly.
[+] Post-restart Cryptographic Verification Result: AUTHENTIC
[+] Protected Baseline Untouched: Port 8545 frozen at Block #113, SQLite manifest intact.

===========================================================================
GENUINE RESTART-PERSISTENCE AUDIT: 100% VERIFIED PASS
Record EVD-C21A73EA (Tx: 2b234d428e5728a57a1f714c05874791f5f3c63a300870775287f4a16181e14b)
successfully verified across cold restart!
===========================================================================
```

---

## 4. BACKEND UNIT & REGRESSION TEST SUITE

The complete EvidenceChain backend regression suite was executed against the isolated testnet on port 8546:

```bash
cd backend && venv/bin/python -m unittest discover tests
```

```text
----------------------------------------------------------------------
Ran 102 tests in 50.388s

OK
```

**Score: 102/102 Tests PASSED (0 failures, 0 errors).**

---

## 5. RECONCILED SYNTHETIC PERSONAS & ROLES

Ground-truth reconciliation against `backend/auth.py` (`SYNTHETIC_DEMO_PERSONAS`):

| Persona | Synthetic Email | Role | Department & Organization | Shortcut | Allowed Capabilities |
|:---|:---|:---|:---|:---|:---|
| **Arjun Mehta** | `a.mehta@metro-forensics.gov.example` | Senior Forensic Officer | Cyber Threat Forensics, Metropolitan Digital Forensics Agency | `officer` | Upload evidence (max 5), on-chain EVM registration, SHA-256 verification |
| **Priya Nair** | `p.nair@metro-forensics.gov.example` | Lead Cyber Investigator | Major Crimes Investigation, Metropolitan Digital Forensics Agency | `investigator` | Evidence review, verification, case dossier inspection, custody tracking |
| **Karan Rao** | `k.rao@metro-forensics.gov.example` | Digital Forensics Analyst | Digital Evidence Review Board, State Forensic Sciences | `analyst` | Cryptographic verification, calculate SHA-256 digests, proof inspection |
| **Neha Verma** | `n.verma@metro-forensics.gov.example` | Special Legal Prosecutor | Cyber Prosecution Directorate, Department of Justice | `prosecutor` | Judicial review, chain-of-custody tracking, access history audit |
| **Devraj Singh** | `d.singh@metro-forensics.gov.example` | Evidence Vault Custodian | Central Forensic Vault, Metropolitan Digital Forensics Agency | `custodian` | Vault media inspection, custodian logs, verification |

*Blocked Administrative HOD:* **Dr. Vikram Seth** (`v.seth@metro-forensics.gov.example`, `HOD-0001`) is strictly in `PROTECTED_IDENTITIES` and denied demo login to eliminate privilege escalation vectors.
