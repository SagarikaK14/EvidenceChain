# EVIDENCECHAIN — PHASE 6: USER & INVESTIGATOR GUIDE

**Document ID:** EVC-P6-UG-2026-FINAL  
**Audience:** Forensic Examiners, Lead Investigators, Evidence Custodians, and Legal Counsel  
**Revision:** Release Candidate 1.0  
**Date:** October 28, 2026  

---

## 1. Introduction to EvidenceChain

EvidenceChain is a Digital Evidence Management & Chain of Custody System designed to ensure that digital evidence—including disk images, surveillance footage, audio recordings, documents, and mobile extractions—remains authentic, securely accounted for, and legally defensible from intake through courtroom presentation.

EvidenceChain pairs traditional forensic metadata tracking with immutable cryptographic digests and tamper-evident ledger logging.

---

## 2. Authentication & Secure Sign-In

To protect forensic integrity, access to EvidenceChain is restricted by role-based permissions and Multi-Factor Authentication (MFA).

```
┌─────────────────────────────────┐
│ 1. Enter Email & Password       │
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 2. MFA Challenge Screen         │
│    Enter 6-Digit Code (e.g. 123456)
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 3. Access Authorized Dashboard  │
└─────────────────────────────────┘
```

1. Navigate to the EvidenceChain portal in your web browser.
2. Select your designated role or enter your institutional credentials.
3. Upon credential validation, a Multi-Factor Authentication (MFA) challenge prompt will appear.
4. Enter your current 6-digit verification code.
5. Upon successful entry, you will be redirected to the Executive Dashboard.

---

## 3. Navigating the Evidence Repository

The **Evidence Repository** provides a searchable catalog of all registered evidence items across active and historical cases.

### 3.1 Search and Filtering
- **Full-Text Search:** Enter an Evidence ID (e.g., `EVD-25BB2C6B`), a case docket number (e.g., `CASE002`), or keywords from the evidence title or description.
- **SHA-256 Hash Lookup:** Paste a 64-character SHA-256 hash to locate the exact evidence file matching that cryptographic fingerprint.
- **Status Filter:** Filter records by *All*, *Anchored*, or *Historical References*.
- **Pagination & Density:** Navigate large case archives using the page selectors at the bottom of the table.

---

## 4. Understanding Evidence Dossiers & Chain of Custody

Clicking on any evidence entry opens its **Living Evidence Dossier**, containing:

1. **Intake Metadata:** Case number, intake date, registering officer, and evidence type.
2. **Cryptographic Fingerprint:** The official SHA-256 digest calculated at the moment of intake.
3. **Chain of Custody Timeline:** A chronological record of every transfer, forensic extraction, authorized viewing, and legal review.
4. **Ledger Status Disclosures:**
   - **`Historical registration reference recorded; current-ledger verification unavailable`:** Indicates the evidence was anchored in an earlier institutional ledger snapshot. The intake metadata and cryptographic hash remain preserved in the agency's records.
   - **`Live Ledger Verified`:** Indicates the evidence has been anchored on the active blockchain ledger with an immutable transaction hash and block confirmation.

---

## 5. Verifying an Evidence File

The **Verify Evidence** tool allows investigators and defense counsel to independently test any digital file to confirm that its content has not changed since intake.

```
┌──────────────────────────────────────────────┐
│ 1. Navigate to "Verify Evidence"             │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│ 2. Select Registered Evidence ID             │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│ 3. Upload Local Candidate File               │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│ 4. System Computes Local SHA-256 Digest      │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│ 5. Automated Cryptographic Comparison        │
│    SHA-256 Digest Match Confirmed / Mismatch │
└──────────────────────────────────────────────┘
```

### Verification Findings:
- **SHA-256 Digest Match Confirmed:** The cryptographic digest of the candidate file matches the recorded intake digest bit-for-bit.
- **SHA-256 Digest Mismatch Detected:** The candidate file has been modified, corrupted, or does not correspond to the selected evidence record.

> [!NOTE]
> SHA-256 digest verification confirms that the candidate file matches the recorded intake digest. It does not replace an independent forensic laboratory examination.

---

## 6. Registering New Evidence

Forensic analysts and investigators with intake privileges can register new digital evidence into the custody vault:

1. Navigate to **Register Evidence**.
2. **Step 1: File Ingestion & Fingerprinting:**
   - Select or drag-and-drop the forensic image or document.
   - The browser automatically calculates the client-side SHA-256 digest before transmission.
3. **Step 2: Case Details & Attribution:**
   - Enter Case Docket ID (e.g., `CASE2026-004`).
   - Provide an descriptive evidence title and collection details.
   - Assign the initial evidence custodian.
4. **Step 3: Cryptographic Ledger Anchoring:**
   - Submit the registration.
   - The system stores the payload, records the database metadata, and anchors the cryptographic fingerprint onto the ledger.
   - A unique Evidence ID (e.g., `EVD-A1B2C3D4`) and Transaction Receipt will be issued.

---

## 7. Viewing and Downloading Evidence Payloads

Access to download or view raw evidence files is strictly audited under zero-trust protocols:

1. Locate the evidence record in the **Evidence Repository**.
2. If your role or individual credentials hold an active authorization grant, the **View File** and **Download File** buttons will be enabled.
3. Clicking **View File** launches the secure document or media preview modal.
4. Clicking **Download File** transmits the byte stream to your local workstation.
5. Every view and download operation is automatically timestamped, attributed to your identity, and permanently recorded in the **Access History Ledger**.
