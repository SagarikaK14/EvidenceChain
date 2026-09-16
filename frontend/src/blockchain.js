import { ethers } from "ethers";

// ==================================================
// BLOCKCHAIN CONFIGURATION
// ==================================================

const RPC_URL = "http://127.0.0.1:8545";

// IMPORTANT:
// This is the correct first Hardhat deployment address
// for the local Hardhat node used by this project.

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// ==================================================
// SMART CONTRACT ABI
// ==================================================

const CONTRACT_ABI = [

  // ==================================================
  // REGISTER EVIDENCE
  // ==================================================

  {
    inputs: [
      {
        internalType: "string",
        name: "_evidenceId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_caseId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_evidenceHash",
        type: "string",
      },
    ],
    name: "registerEvidence",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ==================================================
  // GET EVIDENCE
  // ==================================================

  {
    inputs: [
      {
        internalType: "string",
        name: "_evidenceId",
        type: "string",
      },
    ],
    name: "getEvidence",
    outputs: [
      {
        components: [
          {
            internalType: "string",
            name: "evidenceId",
            type: "string",
          },
          {
            internalType: "string",
            name: "caseId",
            type: "string",
          },
          {
            internalType: "string",
            name: "evidenceHash",
            type: "string",
          },
          {
            internalType: "address",
            name: "registeredBy",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "currentCustodian",
            type: "address",
          },
        ],
        internalType: "struct EvidenceChain.Evidence",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==================================================
  // VERIFY EVIDENCE
  // ==================================================

  {
    inputs: [
      {
        internalType: "string",
        name: "_evidenceId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_currentHash",
        type: "string",
      },
    ],
    name: "verifyEvidence",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==================================================
  // TRANSFER CUSTODY
  // ==================================================

  {
    inputs: [
      {
        internalType: "string",
        name: "_evidenceId",
        type: "string",
      },
      {
        internalType: "address",
        name: "_newCustodian",
        type: "address",
      },
    ],
    name: "transferCustody",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ==================================================
// CONNECT BLOCKCHAIN
// ==================================================

export async function connectBlockchain() {

  console.log("====================================");
  console.log("Connecting to EvidenceChain...");
  console.log("RPC:", RPC_URL);
  console.log("Contract:", CONTRACT_ADDRESS);

  // ----------------------------------------------
  // Provider
  // ----------------------------------------------

  const provider =
    new ethers.JsonRpcProvider(RPC_URL);

  // ----------------------------------------------
  // Check network
  // ----------------------------------------------

  const network =
    await provider.getNetwork();

  console.log(
    "Chain ID:",
    network.chainId.toString()
  );

  if (network.chainId.toString() !== "31337") {
    throw new Error(
      `Wrong network. Expected Hardhat chain 31337, received ${network.chainId.toString()}`
    );
  }

  // ----------------------------------------------
  // Get Hardhat account #0
  // ----------------------------------------------

  const signer =
    await provider.getSigner(0);

  const address =
    await signer.getAddress();

  console.log(
    "Account:",
    address
  );

  // ----------------------------------------------
  // Create contract
  // ----------------------------------------------

  const contract =
    new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

  // ----------------------------------------------
  // Verify contract exists
  // ----------------------------------------------

  const code =
    await provider.getCode(
      CONTRACT_ADDRESS
    );

  if (code === "0x") {
    throw new Error(
      "No smart contract found at the configured address. Make sure Terminal 1 is running the same Hardhat node used for deployment."
    );
  }

  console.log(
    "Smart contract detected."
  );

  console.log(
    "EvidenceChain connected successfully."
  );

  console.log("====================================");

  return {
    provider,
    signer,
    contract,
    address,
    chainId:
      network.chainId.toString(),
  };
}

// ==================================================
// REGISTER EVIDENCE
// ==================================================

export async function registerEvidence(
  contract,
  evidenceId,
  caseId,
  evidenceHash
) {

  console.log(
    "Registering evidence..."
  );

  console.log(
    "Evidence ID:",
    evidenceId
  );

  console.log(
    "Case ID:",
    caseId
  );

  console.log(
    "SHA-256:",
    evidenceHash
  );

  const tx =
    await contract.registerEvidence(
      String(evidenceId),
      String(caseId),
      String(evidenceHash)
    );

  console.log(
    "Transaction:",
    tx.hash
  );

  await tx.wait();

  console.log(
    "Registration confirmed."
  );

  return tx;
}

// ==================================================
// GET EVIDENCE
// ==================================================

export async function getEvidence(
  contract,
  evidenceId
) {

  console.log(
    "Reading evidence from blockchain..."
  );

  console.log(
    "Evidence ID:",
    evidenceId
  );

  const result =
    await contract.getEvidence(
      String(evidenceId)
    );

  console.log(
    "Blockchain result:",
    result
  );

  return {
    evidenceId:
      result[0],

    caseId:
      result[1],

    evidenceHash:
      result[2],

    registeredBy:
      result[3],

    timestamp:
      result[4].toString(),

    currentCustodian:
      result[5],
  };
}

// ==================================================
// VERIFY EVIDENCE
// ==================================================

export async function verifyEvidence(
  contract,
  evidenceId,
  currentHash
) {

  console.log(
    "Calling blockchain verification..."
  );

  console.log(
    "Evidence ID:",
    evidenceId
  );

  console.log(
    "Current Hash:",
    currentHash
  );

  const result =
    await contract.verifyEvidence(
      String(evidenceId),
      String(currentHash)
    );

  console.log(
    "Blockchain verification:",
    result
  );

  return result;
}

// ==================================================
// TRANSFER CUSTODY
// ==================================================

export async function transferCustody(
  contract,
  evidenceId,
  newCustodian
) {

  console.log(
    "Transferring custody..."
  );

  const validAddress =
    ethers.getAddress(
      newCustodian.trim()
    );

  const tx =
    await contract.transferCustody(
      String(evidenceId),
      validAddress
    );

  console.log(
    "Custody transaction:",
    tx.hash
  );

  await tx.wait();

  console.log(
    "Custody transfer confirmed."
  );

  return tx;
}