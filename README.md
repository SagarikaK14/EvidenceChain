# EvidenceChain

EvidenceChain is a blockchain-based digital evidence management system designed to provide evidence integrity, custody tracking, and access history.

## Project Overview

EvidenceChain uses a Solidity smart contract deployed on a local Hardhat blockchain.

The smart contract provides:

- Evidence registration
- SHA-256 evidence hash storage
- Evidence integrity verification
- Custody transfer
- Custody transfer history
- Evidence access recording
- Access history
- Blockchain events

## Project Structure

```text
EvidenceChain/
├── contracts/
│   └── EvidenceChain.sol
├── scripts/
│   └── deploy.js
├── frontend/
├── artifacts/
├── hardhat.config.ts
├── package.json
└── README.md
```

## Requirements

The project requires:

- Node.js
- npm
- Hardhat

Install the project dependencies:

```bash
npm install
```

## Smart Contract

The main smart contract is located at:

```text
contracts/EvidenceChain.sol
```

The contract provides:

- `registerEvidence()` - registers evidence on the blockchain
- `getEvidence()` - retrieves an evidence record
- `verifyEvidence()` - verifies evidence integrity using its hash
- `transferCustody()` - transfers evidence custody
- `getCustodyHistory()` - retrieves custody transfer history
- `recordAccess()` - records access to evidence
- `getAccessHistory()` - retrieves evidence access history

## Local Blockchain Setup

### 1. Build the Smart Contract

Run:

```bash
npx hardhat clean
npx hardhat build
```

The compiled contract artifact is generated at:

```text
artifacts/contracts/EvidenceChain.sol/EvidenceChain.json
```

### 2. Start the Hardhat Blockchain

Open Terminal 1 and run:

```bash
npx hardhat node
```

The local blockchain runs at:

```text
http://127.0.0.1:8545
```

Keep this terminal running.

### 3. Deploy the Smart Contract

Open Terminal 2 and run:

```bash
node scripts/deploy.js
```

Example output:

```text
Connecting to local Hardhat blockchain...
Deploying EvidenceChain...
EvidenceChain deployed!
Contract address: 0x...
```

The displayed address is the contract address for the current local Hardhat blockchain session.

## Deployment Reproducibility

The EvidenceChain smart contract can be reproduced and deployed on a fresh local Hardhat blockchain using the repository files and deployment script.

The deployment process is:

```text
contracts/EvidenceChain.sol
        ↓
npx hardhat build
        ↓
EvidenceChain.json
        ↓
node scripts/deploy.js
        ↓
Deployed EvidenceChain contract
```

Another developer can clone the repository, install the dependencies, build the contract, start a local Hardhat blockchain, and deploy the contract using the provided deployment script.

## Local Blockchain State

The local Hardhat blockchain is temporary and is intended for development and testing.

When the Hardhat node is stopped, the current local blockchain session ends. After starting a new Hardhat node, deploy the EvidenceChain contract again:

```bash
node scripts/deploy.js
```

The deployment script will print the contract address for the new blockchain session.

## Testing

Build the contract:

```bash
npx hardhat clean
npx hardhat build
```

Run the Hardhat tests:

```bash
npx hardhat test
```

Test contract deployment:

```bash
node scripts/deploy.js
```

## Development Workflow

```text
Install dependencies
        ↓
Start Hardhat blockchain
        ↓
Build smart contract
        ↓
Deploy EvidenceChain
        ↓
Start backend
        ↓
Start frontend
        ↓
Test EvidenceChain
```

## Evidence Integrity Verification

EvidenceChain stores the hash of an evidence file on the blockchain.

During verification, the current hash of the evidence file is compared with the hash stored on the blockchain.

If the hashes match, the evidence is considered unchanged.

If the hashes do not match, the evidence integrity check fails.

## Chain of Custody

EvidenceChain records custody transfers on the blockchain.

The current custodian can transfer custody to another blockchain address.

Each custody transfer records:

- Evidence ID
- Previous custodian
- New custodian
- Timestamp

## Access History

EvidenceChain records evidence access events.

Each access record contains:

- Blockchain address that accessed the evidence
- Timestamp

The access history can be retrieved from the smart contract.

## Repository

The repository contains the EvidenceChain smart contract, deployment script, frontend, and supporting project configuration required to develop and test the system.