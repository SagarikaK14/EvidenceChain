import { ethers } from "ethers";
import fs from "fs";

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

const artifact = JSON.parse(
    fs.readFileSync(
        "./artifacts/contracts/EvidenceChain.sol/EvidenceChain.json",
        "utf8"
    )
);

async function main() {
    console.log("Connecting to local Hardhat blockchain...");

    const signer = await provider.getSigner(0);

    console.log("Deploying EvidenceChain...");

    const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        signer
    );

    const contract = await factory.deploy();

    await contract.waitForDeployment();

    console.log("EvidenceChain deployed!");
    console.log("Contract address:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});