# EVIDENCECHAIN — PROTECTED BLOCKCHAIN AUDIT & TRANSACTION RECONCILIATION
**Document Reference:** `EC-REPORT-2026-VPS-BLOCKCHAIN-AUDIT-01`  
**Classification:** FORENSIC READ-ONLY AUDIT REPORT  
**Date:** October 29, 2026  
**Auditor / Roles:** Lead Blockchain Engineer & Smart Contract Auditor  
**Target Environment:** Local Anvil EVM on Port 8545 (Protected Development Node, Chain ID: 31337)  
**Contract Address:** `0x5FbDB2315678afecb367f032d93F642f64180aa3` (Deployer: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`)  
**Audit Status:** COMPLETE — FORENSICALLY ATTRIBUTED  

---

## 1. AUDIT OBJECTIVE & SCOPE

During Gate 1 pre-flight checks, an inspection of the persistent Anvil node on `http://127.0.0.1:8545` revealed a current block height of **Block #113 (hex `0x71`)**, whereas earlier Phase 3B recovery documentation recorded a block height of **Block #107 (hex `0x6b`)**.

This audit was conducted strictly using **read-only JSON-RPC queries** (`eth_blockNumber`, `eth_getBlockByNumber`, `eth_getTransactionByHash`, `eth_getTransactionReceipt`) to:
1. Decode every transaction included in Blocks 108 through 113.
2. Identify the contract method, caller, recipient, parameters, gas consumption, and timestamp for each block.
3. Identify which evidence records were created, modified, or accessed.
4. Establish definitive evidentiary attribution for the origin of these transactions.
5. Explicitly differentiate confirmed facts from hypotheses.
6. Verify whether any of the 27 original baseline evidence records were affected.

---

## 2. BLOCK-BY-BLOCK FORENSIC DECODING (BLOCKS 106–113)

To establish complete contextual continuity, Block #106 and Block #107 (the Phase 3B append-only revocation transactions) were audited alongside Blocks 108 through 113.

### Summary Table of Decoded Transactions

| Block # | Hex | Block Timestamp (UTC) | Tx Hash | Method Invoked | Target Evidence ID | Target Subject Address | Result / Status |
|:---:|:---:|:---|:---|:---|:---|:---|:---:|
| **106** | `0x6a` | 2026-10-27 15:05:16 | `0x22a00c65...` | `revokeViewAccess` | `TEST-EVD-DEPT-07-28D439FD` | `0x70997970...79C8` | SUCCESS (Receipt: 1) |
| **107** | `0x6b` | 2026-10-27 15:31:43 | `0x15a781b0...` | `revokeViewAccess` | `EVD-6C4A0F00` | `0x70997970...79C8` | SUCCESS (Receipt: 1) |
| **108** | `0x6c` | 2026-10-27 22:10:34 | `0x22aaa1fb...` | `registerEvidence` | `EVD-109BD71C` | `0x5FbDB231...0aa3` | SUCCESS (Receipt: 1) |
| **109** | `0x6d` | 2026-10-27 22:10:51 | `0xc7453396...` | `grantViewAccess` | `EVD-109BD71C` | `0x90F79bf6...b906` | SUCCESS (Receipt: 1) |
| **110** | `0x6e` | 2026-10-27 22:10:53 | `0x119b98ff...` | `grantDownloadAccess` | `EVD-109BD71C` | `0x90F79bf6...b906` | SUCCESS (Receipt: 1) |
| **111** | `0x6f` | 2026-10-27 22:11:02 | `0xa4eafe8b...` | `revokeViewAccess` | `EVD-109BD71C` | `0x90F79bf6...b906` | SUCCESS (Receipt: 1) |
| **112** | `0x70` | 2026-10-27 22:11:10 | `0x2809fc57...` | `revokeDownloadAccess` | `EVD-109BD71C` | `0x90F79bf6...b906` | SUCCESS (Receipt: 1) |
| **113** | `0x71` | 2026-10-27 22:14:41 | `0xd5204fc1...` | `grantViewAccess` | `EVD-109BD71C` | `0x70997970...79C8` | SUCCESS (Receipt: 1) |

---

### Detailed Transaction Forensic Dissection

#### Block #108 (`0x6c`)
- **Block Timestamp:** `1793119234` (2026-10-27 22:10:34 UTC)
- **Transaction Hash:** `0x22aaa1fb2461ec4d5885f838a59fe05634b074aa4c5039281a7337920409a80e`
- **From (Caller):** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Contract Owner / Deployer)
- **To (Contract):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Function Selector:** `0xd3e738ec` -> `registerEvidence(string,string,string)`
- **Decoded Parameters:**
  - `evidenceId`: `"EVD-109BD71C"`
  - `caseId`: `"CASE-2026-CYBER-091"`
  - `fileHash`: `"724c33f6dfdf57ff0e812d49c69d80d285906d042617f0a6316e6992be7e0766"`
- **Gas Used:** `117,738`
- **Receipt Status:** `0x1` (Success)

#### Block #109 (`0x6d`)
- **Block Timestamp:** `1793119251` (2026-10-27 22:10:51 UTC)
- **Transaction Hash:** `0xc7453396655c0a0cff15cf48dc1e42e31671ec5087aee82dd9f09eb058d8442c`
- **From (Caller):** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Contract Owner / HOD)
- **To (Contract):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Function Selector:** `0xa5dc12ba` -> `grantViewAccess(string,address)`
- **Decoded Parameters:**
  - `evidenceId`: `"EVD-109BD71C"`
  - `user`: `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (Anvil Account #2)
- **Gas Used:** `47,402`
- **Receipt Status:** `0x1` (Success)

#### Block #110 (`0x6e`)
- **Block Timestamp:** `1793119253` (2026-10-27 22:10:53 UTC)
- **Transaction Hash:** `0x119b98ff6a98f0607a7018ae50493aa9a4e320f77918a9010bcba7f714eb6c1f`
- **From (Caller):** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **To (Contract):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Function Selector:** `0x61da2d1b` -> `grantDownloadAccess(string,address)`
- **Decoded Parameters:**
  - `evidenceId`: `"EVD-109BD71C"`
  - `user`: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`
- **Gas Used:** `47,424`
- **Receipt Status:** `0x1` (Success)

#### Block #111 (`0x6f`)
- **Block Timestamp:** `1793119262` (2026-10-27 22:11:02 UTC)
- **Transaction Hash:** `0xa4eafe8bba4dfc4465df51e9e7354db1e8a0443c5b8b617b73c4f74d9e035048`
- **From (Caller):** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **To (Contract):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Function Selector:** `0xd8bf172a` -> `revokeViewAccess(string,address)`
- **Decoded Parameters:**
  - `evidenceId`: `"EVD-109BD71C"`
  - `user`: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`
- **Gas Used:** `29,880`
- **Receipt Status:** `0x1` (Success)

#### Block #112 (`0x70`)
- **Block Timestamp:** `1793119270` (2026-10-27 22:11:10 UTC)
- **Transaction Hash:** `0x2809fc5747444b706c9a7fc2b963777d1dc3bfcb2462b536fae75faee279d0ad`
- **From (Caller):** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **To (Contract):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Function Selector:** `0x3266bb6c` -> `revokeDownloadAccess(string,address)`
- **Decoded Parameters:**
  - `evidenceId`: `"EVD-109BD71C"`
  - `user`: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`
- **Gas Used:** `29,880`
- **Receipt Status:** `0x1` (Success)

#### Block #113 (`0x71`)
- **Block Timestamp:** `1793119481` (2026-10-27 22:14:41 UTC)
- **Transaction Hash:** `0xd5204fc199c0ec982362a5fe4dbe1f1b2123512b9308a8a25c7e10882e7ea403`
- **From (Caller):** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **To (Contract):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Function Selector:** `0xa5dc12ba` -> `grantViewAccess(string,address)`
- **Decoded Parameters:**
  - `evidenceId`: `"EVD-109BD71C"`
  - `user`: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Officer Rahul Nair)
- **Gas Used:** `47,402`
- **Receipt Status:** `0x1` (Success)

---

## 3. EVIDENTIARY SOURCE ATTRIBUTION

### Forensic Database Correlation
Cross-referencing `backend/evidencechain.db`:
- Row ID: `96`
- Evidence ID: `EVD-109BD71C`
- Case ID: `CASE-2026-CYBER-091`
- Created At: `2026-10-27 22:10:34`
- Registration Tx Hash: `0x22aaa1fb2461ec4d5885f838a59fe05634b074aa4c5039281a7337920409a80e` (exact match to Block #108)

### Chronological Execution Timeline Correlation
The timestamps across Blocks 108 through 113 span exactly 4 minutes and 7 seconds:
- `1793119234` (22:10:34 UTC) -> `1793119481` (22:14:41 UTC) on October 27, 2026.
This corresponds precisely to the execution of the Phase 4 UI review test harness (`verify_access_management_e2e.cjs` / `capture_phase4.cjs`) which was validating the Living Dossier Access Management drawer and capturing production screenshots of permission grants and revocations.

---

## 4. CONFIRMED FACTS VS. HYPOTHESES

### Confirmed Facts
1. **Zero Baseline Mutation:** Not a single transaction in Blocks 108 through 113 interacted with any of the 27 original baseline evidence records (e.g., `EVD-25BB2C6B`, `EVD-DB550B68`, `EVD-1E20C91F`, etc.).
2. **Singular Test Target:** All 6 transactions in Blocks 108–113 operate strictly on `EVD-109BD71C`.
3. **Sequence Lifecycle:** The 6 transactions form a complete, self-contained access management verification lifecycle: Register -> Grant View -> Grant Download -> Revoke View -> Revoke Download -> Grant View to Officer Rahul Nair.
4. **Current Inactivity:** The persistent Anvil node on port 8545 has remained completely stationary at Block #113 since October 27, 2026, 22:14:41 UTC. Zero automated tests or scripts have submitted transactions to port 8545 since that time.

### Hypotheses & Environmental Analysis
- *Hypothesis on Port Selection:* During the execution of the Phase 4 browser screenshot scripts, the Flask backend environment configuration defaulted to `BLOCKCHAIN_RPC_URL="http://127.0.0.1:8545"`. When the interactive test script submitted access grant/revoke actions through the frontend UI, Flask routed those actions to port 8545 instead of the isolated testnet port 8546.
- *Remediation Status:* In Phase 5, fail-closed runtime interlocks were implemented in `backend/blockchain.py` and test harnesses (`test_isolation_helper.py`), making it impossible for automated tests running under `TESTING=True` or `FLASK_ENV=test` to connect to port 8545.

---

## 5. EVIDENCE INTEGRITY VERDICT

```
+----------------------------------------------------------------------------------------------------+
|                                    BLOCKCHAIN AUDIT VERDICT                                        |
+----------------------------------------------------------------------------------------------------+
| Total Baseline Records Verified Intact: 27 of 27 (100%)                                            |
| Baseline Record Trie Mutated:           0 records                                                  |
| Divergence Nature:                      6 transactions on isolated test item EVD-109BD71C          |
| Port 8545 Protected State Status:       PRISTINE WITH RESPECT TO ORIGINAL 27 BASELINE RECORDS      |
+----------------------------------------------------------------------------------------------------+
```
