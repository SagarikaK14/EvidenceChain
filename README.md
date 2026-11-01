# EvidenceChain

**Blockchain-Anchored Digital Evidence Management & Chain of Custody System**

EvidenceChain is an institutional-grade digital evidence management platform combining an immutable Ethereum/EVM smart contract ledger with a secure Python Flask backend and a modern React + Vite frontend. It enforces cryptographic evidence integrity, non-repudiable chain of custody tracking, multi-tier role-based access controls, and dynamic multi-factor authentication (MFA).

---

## Key Capabilities

- **Four-Pillar Integrity Verification**: Every evidence artifact is validated across four distinct cryptographic layers: Database Registry, POSIX Storage SHA-256 Digest, Smart Contract Consensus Anchor, and Public Audit Logs.
- **Living Dossier Architecture**: 6-section comprehensive case dossier presenting evidentiary metadata, cryptographic fingerprints, multi-tier custody history, and institutional verification badges.
- **Role-Based Access Control (RBAC)**: Distinct permissions across five departmental roles: Head of Department (HOD), Senior Forensic Officer, Digital Forensics Analyst, Evidence Custodian, and Investigating Officer.
- **Independent View & Download Governance**: Smart-contract-enforced access control allowing granular View and Download authorization managed by Department Authority.
- **Dynamic Multi-Factor Authentication**: Two-stage login with cryptographic password verification and dynamic time-bound OTP challenges with lockout thresholds.
- **Institutional Telemetry & IST Clock**: Real-time consensus node status, network latency, active session monitoring, and Indian Standard Time (IST / UTC+5:30) timestamps.
- **Interactive Lifecycle Visualizer**: Animated landing page with network topology visualizer demonstrating the 5-stage pipeline: `Register → Hash → Anchor → Verify → Audit`.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Consensus & Smart Contracts** | Solidity (`^0.8.34`), Foundry Anvil / Hardhat, Ethers.js v6 |
| **Backend Runtime & Security** | Python 3.11+, Flask, Werkzeug, SQLite3 (WAL mode), Web3.py |
| **Frontend UI/UX** | React 18, Vite, Lucide Icons, Custom Animated CSS |
| **Production Infrastructure** | Gunicorn WSGI, Nginx Reverse Proxy, systemd unit orchestration |

---

## Project Structure

```text
EvidenceChain/
├── contracts/
│   └── EvidenceChain.sol             # Ethereum EVM smart contract
├── frontend/
│   ├── src/                          # React views, components, utils
│   │   ├── components/Header.jsx     # Header with IST clock & telemetry
│   │   ├── utils/dateUtils.js        # IST timezone formatting utilities
│   │   ├── views/                    # Dashboard, Repository, Dossier, etc.
│   │   └── App.css                   # Custom responsive styling & animations
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app.py                        # Core Flask API & security middleware
│   ├── auth.py                       # RBAC, session management & MFA
│   ├── blockchain.py                 # Web3.py smart contract interface
│   ├── database/                     # SQLite schema & migrations
│   ├── tests/                        # 160+ automated unit & integration tests
│   └── requirements.txt
├── deploy/
│   ├── nginx.conf                    # Hardened reverse proxy configuration
│   ├── evidencechain-api.service     # systemd service for Gunicorn
│   └── evidencechain-anvil.service   # systemd service for Anvil node
├── docs/
│   ├── DEMO_GUIDE.md                 # Evaluation personas & demonstration guide
│   ├── phase6/                       # Architectural & security hardening manuals
│   └── vps/                          # VPS deployment & operations documentation
├── scripts/                          # Automation, deployment, and verification
├── .env.example                      # Root environment configuration template
└── hardhat.config.ts
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18+ and `npm`
- **Python**: 3.11+ and `pip`
- **Foundry / Anvil** (or Hardhat node)

### 2. Blockchain Setup
Start a local EVM development node:
```bash
# Using Foundry Anvil:
anvil --port 8545 --chain-id 31337

# Or compile and deploy contracts using Hardhat:
npm install
npx hardhat compile
node scripts/deploy.js
```

### 3. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment:
cp .env.example .env

# Initialize database:
python3 -c "from database.db import init_db; init_db()"

# Start API server:
python3 app.py
```
*API will listen at `http://127.0.0.1:5001`.*

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend will launch at `http://localhost:5173`.*

---

## Demonstration & Evaluation

EvidenceChain includes five synthetic evaluation personas demonstrating institutional role hierarchies and permissions.

For detailed evaluation credentials and dynamic MFA procedures, see:  
**[`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md)**

---

## Security & Hardening

- **Session Security**: Server-side Flask sessions signed with 256-bit entropy keys, `HttpOnly`, `SameSite=Lax`, and `Secure` cookie attributes.
- **Dynamic Origin Validation**: Nginx and backend middleware validate exact public origins and strip untrusted reverse proxy headers to prevent Host header injection and cross-origin attacks.
- **Role-Based Command Restrictions**: Administrative smart contract calls (`grantViewAccess`, `revokeDownloadAccess`, etc.) require cryptographic verification of the caller's authorized session and registered wallet address.

---

## Testing & Quality Assurance

Run the comprehensive test suite:
```bash
cd backend
pytest -v tests/
```

Run frontend production build verification:
```bash
cd frontend
npm run build
```

---

## License

This project is licensed under the MIT License.
