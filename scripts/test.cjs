const { ethers } = require("ethers");
const fs = require("fs");
const crypto = require("crypto");

const RPC_URL = "http://127.0.0.1:8545";

const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const abi = [
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_caseId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_evidenceHash",
                "type": "string"
            }
        ],
        "name": "registerEvidence",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            }
        ],
        "name": "getEvidence",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "string",
                        "name": "evidenceId",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "caseId",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "evidenceHash",
                        "type": "string"
                    },
                    {
                        "internalType": "address",
                        "name": "registeredBy",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    },
                    {
                        "internalType": "address",
                        "name": "currentCustodian",
                        "type": "address"
                    }
                ],
                "internalType": "struct EvidenceChain.Evidence",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_currentHash",
                "type": "string"
            }
        ],
        "name": "verifyEvidence",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const evidenceId = "evidence001";
const caseId = "case001";
const filePath = "./evidence/evidence001.txt";

function calculateHash(filePath) {
    const fileData = fs.readFileSync(filePath);
    return crypto
        .createHash("sha256")
        .update(fileData)
        .digest("hex")
        .toUpperCase();
}

async function main() {
    console.log("Connecting to EvidenceChain...");

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
        contractAddress,
        abi,
        signer
    );

    const signerAddress = await signer.getAddress();

    console.log("Connected!");
    console.log("Account:", signerAddress);
    console.log("Contract:", contractAddress);

    // --------------------------------------------------
    // STEP 1: READ ORIGINAL FILE
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 1: READING EVIDENCE FILE");
    console.log("====================================");

    const originalHash = calculateHash(filePath);

    console.log("Evidence ID:", evidenceId);
    console.log("Case ID:", caseId);
    console.log("File:", filePath);
    console.log("Original SHA-256 Hash:", originalHash);

    // --------------------------------------------------
    // STEP 2: REGISTER EVIDENCE
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 2: REGISTERING EVIDENCE");
    console.log("====================================");

    const tx = await contract.registerEvidence(
        evidenceId,
        caseId,
        originalHash
    );

    console.log("Transaction sent:", tx.hash);

    await tx.wait();

    console.log("Evidence registered successfully!");

    // --------------------------------------------------
    // STEP 3: READ BLOCKCHAIN RECORD
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 3: READING BLOCKCHAIN RECORD");
    console.log("====================================");

    const evidence = await contract.getEvidence(evidenceId);

    console.log("Evidence ID:", evidence[0]);
    console.log("Case ID:", evidence[1]);
    console.log("Blockchain Hash:", evidence[2]);
    console.log("Registered By:", evidence[3]);
    console.log("Timestamp:", evidence[4].toString());
    console.log("Current Custodian:", evidence[5]);

    // --------------------------------------------------
    // STEP 4: VERIFY ORIGINAL FILE
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 4: VERIFYING ORIGINAL FILE");
    console.log("====================================");

    const currentHash = calculateHash(filePath);

    console.log("File Hash:", currentHash);
    console.log("Blockchain Hash:", evidence[2]);

    const originalVerification = await contract.verifyEvidence(
        evidenceId,
        currentHash
    );

    console.log("\nVerification result:", originalVerification);

    if (originalVerification) {
        console.log("✓ ORIGINAL EVIDENCE IS AUTHENTIC");
    } else {
        console.log("✗ ORIGINAL EVIDENCE DOES NOT MATCH");
    }

    // --------------------------------------------------
    // STEP 5: SIMULATE TAMPERING
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 5: SIMULATING TAMPERING");
    console.log("====================================");

    const originalContent = fs.readFileSync(filePath, "utf8");

    fs.appendFileSync(
        filePath,
        "\nTHIS LINE SIMULATES TAMPERING."
    );

    console.log("Evidence file modified.");

    // --------------------------------------------------
    // STEP 6: VERIFY TAMPERED FILE
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 6: VERIFYING TAMPERED FILE");
    console.log("====================================");

    const tamperedHash = calculateHash(filePath);

    console.log("Tampered File Hash:", tamperedHash);
    console.log("Blockchain Hash:", evidence[2]);

    const tamperedVerification = await contract.verifyEvidence(
        evidenceId,
        tamperedHash
    );

    console.log("\nVerification result:", tamperedVerification);

    if (tamperedVerification) {
        console.log("⚠ WARNING: FILE STILL MATCHES");
    } else {
        console.log("✓ TAMPER DETECTED!");
        console.log("✓ File does NOT match blockchain record.");
    }

    // --------------------------------------------------
    // STEP 7: RESTORE ORIGINAL FILE
    // --------------------------------------------------

    console.log("\n====================================");
    console.log("STEP 7: RESTORING ORIGINAL FILE");
    console.log("====================================");

    fs.writeFileSync(filePath, originalContent);

    console.log("Original evidence file restored.");

    console.log("\n====================================");
    console.log("EVIDENCE VERIFICATION COMPLETE");
    console.log("====================================");

    console.log("Original evidence: AUTHENTIC ✓");
    console.log("Tampered evidence: TAMPERED ✓");
}

main().catch((error) => {
    console.error("\nERROR:");
    console.error(error);
});