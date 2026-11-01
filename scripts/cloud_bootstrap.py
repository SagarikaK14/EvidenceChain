#!/usr/bin/env python3
"""
EvidenceChain Cloud Bootstrap & Automated Provisioning Engine
Automatically connects to Foundry Anvil, deploys EvidenceChain.sol,
initializes the database, establishes case hierarchies, and provisions sample exhibits.
"""

import os
import sys
import time
from web3 import Web3

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
sys.path.insert(0, ROOT_DIR)

# Load environment configuration
from app import _load_env
_load_env()

from database.db import init_db, seed_demo_case_hierarchies, get_database_path
from blockchain import (
    get_rpc_url,
    get_contract_address,
    get_contract_abi,
    get_contract_bytecode
)


def wait_for_anvil(rpc_url, max_retries=30, delay=1.0):
    print(f"[*] Connecting to blockchain node at {rpc_url}...")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    for i in range(max_retries):
        try:
            if w3.is_connected():
                chain_id = w3.eth.chain_id
                print(f"[✓] Blockchain node connected! Chain ID: {chain_id}, Block: {w3.eth.block_number}")
                return w3
        except Exception:
            pass
        print(f"    Waiting for blockchain node... (attempt {i+1}/{max_retries})")
        time.sleep(delay)
    raise RuntimeError(f"Failed to connect to blockchain node at {rpc_url} after {max_retries} attempts.")


def ensure_contract_deployed(w3, target_address):
    print(f"[*] Checking contract deployment at target address: {target_address}...")
    try:
        code = w3.eth.get_code(Web3.to_checksum_address(target_address))
        if len(code) > 2:
            print(f"[✓] Contract already deployed at {target_address} (code length: {len(code)} bytes).")
            return target_address
    except Exception as e:
        print(f"    Checking code notice: {e}")

    print(f"[*] Deploying EvidenceChain.sol onto active blockchain ledger...")
    abi = get_contract_abi()
    bytecode = get_contract_bytecode()
    if not bytecode:
        raise RuntimeError("Bytecode for EvidenceChain.sol is missing or empty.")

    accounts = w3.eth.accounts
    if not accounts:
        raise RuntimeError("No accounts found on active blockchain ledger.")

    deployer = accounts[0]
    print(f"[*] Deploying from account 0: {deployer}")
    contract_factory = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = contract_factory.constructor().transact({"from": deployer})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    deployed_address = receipt.contractAddress
    print(f"[✓] Contract successfully deployed at: {deployed_address} (Block #{receipt.blockNumber})")
    return deployed_address


def bootstrap():
    print("=" * 60)
    print("  EVIDENCECHAIN CLOUD BOOTSTRAP INITIALIZATION")
    print("=" * 60)

    # 1. Connect to blockchain
    rpc_url = get_rpc_url()
    target_contract = get_contract_address()
    w3 = wait_for_anvil(rpc_url)

    # 2. Deploy contract if needed
    deployed_addr = ensure_contract_deployed(w3, target_contract)

    # 3. Initialize SQLite database & seed users
    print(f"[*] Initializing database at {get_database_path()}...")
    init_db()
    print("[✓] Database initialized and synthetic demo personas provisioned.")

    # 4. Seed case reporting hierarchies
    print("[*] Establishing Department Authority case hierarchies...")
    seed_demo_case_hierarchies()
    print("[✓] Case hierarchies established under HOD Dr. Rajeshwar Sen.")

    # 5. Seed sample evidence exhibits
    print("[*] Seeding multi-format sample evidence exhibits...")
    try:
        from scripts.seed_sample_evidence_files import seed_sample_files
        seed_sample_files()
        print("[✓] Multi-format sample exhibits seeded and anchored.")
    except Exception as e:
        print(f"[!] Warning: sample evidence seeding encountered notice: {e}")

    print("=" * 60)
    print("  EVIDENCECHAIN CLOUD BOOTSTRAP COMPLETED SUCCESSFULLY")
    print("=" * 60)


if __name__ == "__main__":
    bootstrap()
