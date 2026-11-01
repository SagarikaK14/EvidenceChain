# EvidenceChain — Demonstration & Evaluation Guide

This guide describes how to initialize, evaluate, and test EvidenceChain in local evaluation or demonstration mode.

---

## 1. Institutional Persona & Role Architecture

EvidenceChain provides five pre-configured institutional employee roles, reproducing a complete forensic hierarchy:

| # | Role / Designation | Employee Name | Official Demo Email | Employee ID | Registered EVM Testnet Wallet | Permissions & Responsibilities |
|:---:|:---|:---|:---|:---|:---|:---|
| **1** | **Head of Department (HOD)** | Dr. Rajeshwar Sen | `r.sen@forensics.example.com` | `HOD-0001` | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Hardhat #0) | Full command authority; grant/revoke View/Download permissions; register evidence; inspect audit trails. |
| **2** | **Senior Forensic Officer** | Rahul Sharma | `r.sharma@forensics.example.com` | `OFF-1024` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Hardhat #1) | Operational forensics; register evidence artifacts; SHA-256 integrity verifications. |
| **3** | **Digital Forensics Analyst** | Ananya Patel | `a.patel@forensics.example.com` | `OFF-2048` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (Hardhat #2) | In-browser evidence viewing; file downloads restricted unless authorized by Department Head. |
| **4** | **Evidence Custodian** | Sunita Rao | `s.rao@forensics.example.com` | `CUST-4096` | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (Hardhat #4) | Physical & cryptographic vault custody tracking; ledger continuity monitoring. |
| **5** | **Investigating Officer** | Vikram Mehta | `v.mehta@forensics.example.com` | `EXAM-512` | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (Hardhat #3) | Judicial commission examiner; inquiry mode; case-by-case authorization. |

---

## 2. Authentication & Dynamic Multi-Factor Authentication (MFA)

EvidenceChain enforces a two-factor gateway:
1. **First Factor**: Institutional email and password verified against cryptographic salted hashes (`scrypt`/`PBKDF2`).
2. **Second Factor (Dynamic MFA)**: A server-generated, cryptographically random, 6-digit one-time passcode (OTP) valid for 5 minutes with a 3-attempt lockout threshold.
3. **Session Anchoring**: Server-managed session cookies (`HttpOnly`, `SameSite=Lax`) cryptographically bound to the authenticated user and wallet.

### Local Evaluation Dispatch
For local academic or demo evaluation without an external SMTP service:
- Set `FLASK_ENV=development` in your `.env`.
- When an account authenticates with password, the backend issues a dynamic OTP printed directly to the terminal console and saved to `/tmp/evidencechain_dev_otp.json`.
- In public demonstration mode (`PUBLIC_DEMO_MODE=true`), the synthetic OTP is also displayed in the interactive demo modal.

---

## 3. Configuring Evaluation Passwords

Passwords are never stored in plaintext. When seeding a fresh local database:
1. Set `DEMO_USER_PASSWORD` in your `.env` to your preferred evaluation password:
   ```ini
   DEMO_USER_PASSWORD=YourSecureEvaluationPassword!
   ```
2. Initialize the database:
   ```bash
   cd backend
   python -c "from database.db import init_db; init_db()"
   ```
3. All five synthetic demo personas will be seeded with cryptographic hashes corresponding to your chosen password.
