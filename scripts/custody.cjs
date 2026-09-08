const { ethers } = require("ethers");

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
                "internalType": "address",
                "name": "_newCustodian",
                "type": "address"
            }
        ],
        "name": "transferCustody",
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
    }
];

const evidenceId = "evidence001";

async function main() {

    console.log("====================================");
    console.log("EVIDENCE CUSTODY TRANSFER TEST");
    console.log("====================================");

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Account 0 = current custodian
    const currentCustodian = await provider.getSigner(0);

    // Account 1 = new custodian
    const newCustodian = await provider.getSigner(1);

    const currentAddress = await currentCustodian.getAddress();
    const newAddress = await newCustodian.getAddress();

    const contract = new ethers.Contract(
        contractAddress,
        abi,
        currentCustodian
    );

    console.log("\nCurrent custodian:");
    console.log(currentAddress);

    console.log("\nNew custodian:");
    console.log(newAddress);

    // ------------------------------------
    // READ CURRENT RECORD
    // ------------------------------------

    console.log("\n====================================");
    console.log("CURRENT BLOCKCHAIN RECORD");
    console.log("====================================");

    let evidence = await contract.getEvidence(evidenceId);

    console.log("Evidence ID:", evidence[0]);
    console.log("Case ID:", evidence[1]);
    console.log("Current Custodian:", evidence[5]);

    // ------------------------------------
    // TRANSFER CUSTODY
    // ------------------------------------

    console.log("\n====================================");
    console.log("TRANSFERRING CUSTODY");
    console.log("====================================");

    const tx = await contract.transferCustody(
        evidenceId,
        newAddress
    );

    console.log("Transaction:", tx.hash);

    await tx.wait();

    console.log("Custody transferred successfully!");

    // ------------------------------------
    // READ UPDATED RECORD
    // ------------------------------------

    console.log("\n====================================");
    console.log("UPDATED BLOCKCHAIN RECORD");
    console.log("====================================");

    evidence = await contract.getEvidence(evidenceId);

    console.log("Evidence ID:", evidence[0]);
    console.log("Case ID:", evidence[1]);
    console.log("New Current Custodian:", evidence[5]);

    // ------------------------------------
    // VERIFY
    // ------------------------------------

    console.log("\n====================================");
    console.log("CUSTODY VERIFICATION");
    console.log("====================================");

    if (evidence[5].toLowerCase() === newAddress.toLowerCase()) {
        console.log("✓ CUSTODY TRANSFER SUCCESSFUL");
        console.log("✓ New custodian matches blockchain record.");
    } else {
        console.log("✗ CUSTODY TRANSFER FAILED");
    }

    console.log("\n====================================");
    console.log("CUSTODY TEST COMPLETE");
    console.log("====================================");
}

main().catch((error) => {
    console.error("\nERROR:");
    console.error(error);
});