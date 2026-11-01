# EVIDENCECHAIN — PHASE 6: ADMINISTRATOR & DEPARTMENT HEAD GUIDE

**Document ID:** EVC-P6-AG-2026-FINAL  
**Audience:** Heads of Department (HODs), Chief Forensic Officers, and Systems Administrators  
**Revision:** Release Candidate 1.0  
**Date:** October 28, 2026  

---

## 1. Overview of Administrative Responsibilities

Administrative control in EvidenceChain is strictly partitioned between two leadership roles:

1. **Head of Department / Director (`Dr. Rajesh Sen`):** Governs operational evidence authority, case assignments, investigator authorizations, and permission grants/revocations on the smart contract.
2. **System Administrator (`A. Kumar`):** Manages server infrastructure, database integrity, blockchain node operations, backups, and security monitoring.

---

## 2. Department Authority & Case Assignment

The **Department Authority** portal is the primary operational command center for the Head of Department.

### 2.1 Reassigning Case Ownership
1. Navigate to **Department Authority**.
2. Select the target case from the **Active Department Cases** list.
3. In the assignment panel, select the new Lead Investigator from the authorized staff directory.
4. Enter an administrative reason for the reassignment (e.g., *"Transferring primary investigator role due to court deployment"*).
5. Click **Confirm Case Reassignment**.
6. The database and smart contract update simultaneously, emitting an audit record.

### 2.2 Granting & Revoking Case Access
Department Heads can grant temporary or permanent access to forensic cases for secondary investigators or outside specialists:
- **Add Team Member:** Select the case, choose the investigator, set the authorized permissions (View Only or Full Analysis), and confirm.
- **Revoke Team Member:** Click **Revoke** beside an assigned officer's name. Their access to case evidence is immediately invalidated.

---

## 3. Access Management Console

The **Access Management** console provides granular, individual-level permission control over specific evidence assets:

### 3.1 Granting View or Download Permissions
1. Navigate to **Access Management**.
2. Select the specific Evidence ID requiring authorization.
3. Select the grantee user (e.g., Legal Counsel, Defense Attorney, Outside Expert).
4. Specify the permission type:
   - **View Permission:** Authorizes browser-based document/media inspection.
   - **Download Permission:** Authorizes raw file payload transfer.
5. Set expiration duration or leave open-ended.
6. Click **Authorize Access**. The grant is recorded in SQLite and dispatched to the EVM contract.

### 3.2 Revoking Active Permissions
1. In the **Active Grants** table, locate the permission grant.
2. Click the **Revoke Access** button.
3. The backend invalidates the session token, and a revocation transaction is registered on-chain. Subsequent download requests will be rejected with HTTP 403 Forbidden.

---

## 4. Access History & Forensic Audit Logging

The **Access History** console provides an immutable, chronological record of every forensic event in the system:

```
┌────────────────────────────────────────────────────────┐
│ Access History Ledger                                  │
├─────────────┬──────────────┬──────────────┬────────────┤
│ Timestamp   │ Evidence ID  │ User Identity│ Action     │
├─────────────┼──────────────┼──────────────┼────────────┤
│ 10:14:22    │ EVD-25BB2C6B │ S. Chen      │ VIEW_FILE  │
│ 10:18:05    │ EVD-25BB2C6B │ S. Chen      │ DOWNLOAD   │
│ 11:02:40    │ EVD-19C45E2A │ Dr. R. Sen   │ GRANT_VIEW │
└─────────────┴──────────────┴──────────────┴────────────┘
```

- **Forensic Filtering:** Search audit trails by specific officer, date range, or evidence ID.
- **Audit Export:** Export tamper-evident CSV or JSON audit packages for courtroom presentation under Federal Rule of Evidence 902(14).

---

## 5. System Health & Node Diagnostics

System Administrators can monitor operational infrastructure via the **System Health** portal:

- **Anvil Node Connection:** Displays RPC latency, current block height (e.g., `#107`), and network ID (`31337`).
- **Database Status:** Monitors SQLite connection pool, WAL journal file size, and PRAGMA integrity health (`ok`).
- **Storage Subsystem:** Reports available disk storage in the evidence payload directory.
- **Smart Contract ABI:** Confirms runtime bytecode alignment with deployed contract `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

---

## 6. Incident Response & Forensic Containment

In the event of suspected credential compromise or unauthorized access attempts:

1. **Immediate Session Termination:**
   - Execute the emergency session flush to invalidate all active cookies:
   ```bash
   python3 -c "from app import clear_all_sessions; clear_all_sessions()"
   ```
2. **Revoke Target Grants on Ledger:**
   - Use the **Access Management** console or administrative CLI script to revoke all outstanding view grants for the affected user address.
3. **Inspect Block Traversal Logs:**
   - Review `/var/log/evidencechain/api_access.log` for any 403 Forbidden or traversal events logged by the canonical path checker.
4. **Run Database Integrity Verification:**
   - Confirm evidence manifest matches expected SHA-256 hash `148edd48944dfa34c8ff549411c5c887d4ff8e2f0785782bd45073ab175a6532`.
