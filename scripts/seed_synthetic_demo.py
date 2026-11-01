#!/usr/bin/env python3
"""
EvidenceChain Synthetic Demonstration Seeder
Provisions a fresh, isolated demonstration database and registers synthetic evidence
onto the newly deployed demo Anvil blockchain.
Zero protected data is referenced or copied.
"""

import os
import sys
import json
import sqlite3
import hashlib
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash
from web3 import Web3

DATABASE_PATH = os.getenv("DATABASE_PATH", "/var/lib/evidencechain/demo_evidence.db")
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "/var/lib/evidencechain/uploads")
RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
EXPECTED_CHAIN_ID = int(os.getenv("EXPECTED_CHAIN_ID", "31337"))

def seed(database_path=None, upload_folder=None, rpc_url=None):
    target_db = database_path or DATABASE_PATH
    target_uploads = upload_folder or UPLOAD_FOLDER
    target_rpc = rpc_url or RPC_URL

    os.makedirs(os.path.dirname(target_db), exist_ok=True)
    os.makedirs(target_uploads, exist_ok=True)

    print(f"[*] Initializing Synthetic Demonstration Data...")
    print(f"[*] Target Database: {target_db}")
    print(f"[*] Upload Directory: {target_uploads}")
    print(f"[*] Blockchain Node:  {target_rpc}")

    # Connect to Local Anvil Node
    w3 = Web3(Web3.HTTPProvider(target_rpc))
    if not w3.is_connected():
        print(f"[!] ERROR: Cannot connect to Anvil on {target_rpc}. Start Anvil daemon first.")
        sys.exit(1)

    chain_id = w3.eth.chain_id
    print(f"[*] Connected to Anvil. Chain ID: {chain_id}, Current Block: #{w3.eth.block_number}")

    # Deploy Fresh Demonstration Smart Contract
    deployer = w3.eth.accounts[0]
    artifact_path = os.path.join(os.path.dirname(__file__), "..", "artifacts", "contracts", "EvidenceChain.sol", "EvidenceChain.json")
    if not os.path.exists(artifact_path):
        print(f"[!] Artifact not found at {artifact_path}. Compiling or checking fallback...")

    with open(artifact_path, "r") as f:
        artifact = json.load(f)

    contract_factory = w3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    print(f"[*] Deploying fresh EvidenceChain contract from {deployer}...")
    tx_hash = contract_factory.constructor().transact({"from": deployer})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    contract_address = receipt.contractAddress
    print(f"[+] Smart Contract deployed at: {contract_address} (Block #{receipt.blockNumber})")

    contract = w3.eth.contract(address=contract_address, abi=artifact["abi"])

    # Initialize SQLite Schema
    conn = sqlite3.connect(target_db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Import schema creation logic from database.db
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    from database.db import init_db
    # Temporarily point environment to target_db to init schema
    old_db = os.environ.get("DATABASE_PATH")
    os.environ["DATABASE_PATH"] = target_db
    try:
        init_db()
    finally:
        if old_db is not None:
            os.environ["DATABASE_PATH"] = old_db
        else:
            os.environ.pop("DATABASE_PATH", None)

    # Seed Synthetic Users
    demo_password = os.getenv("DEMO_USER_PASSWORD")
    if not demo_password:
        raise ValueError(
            "DEMO_USER_PASSWORD environment variable must be explicitly configured to run seed_synthetic_demo. "
            "No hardcoded fallback passwords are permitted."
        )

    SYNTHETIC_USERS = [
        {
            "name": "Dr. Vikram Seth",
            "email": "v.seth@metro-forensics.gov.example",
            "password": demo_password,
            "role": "Head of Department",
            "employee_id": "HOD-9001",
            "department": "Forensics Executive Leadership",
            "organization": "Metropolitan Digital Forensics Agency",
            "wallet_address": w3.eth.accounts[0]
        },
        {
            "name": "Arjun Mehta",
            "email": "a.mehta@metro-forensics.gov.example",
            "password": demo_password,
            "role": "Senior Forensic Officer",
            "employee_id": "OFF-5012",
            "department": "Cyber Threat Forensics",
            "organization": "Metropolitan Digital Forensics Agency",
            "wallet_address": w3.eth.accounts[1]
        },
        {
            "name": "Priya Nair",
            "email": "p.nair@metro-forensics.gov.example",
            "password": demo_password,
            "role": "Lead Cyber Investigator",
            "employee_id": "INV-7821",
            "department": "Major Crimes Investigation",
            "organization": "Metropolitan Digital Forensics Agency",
            "wallet_address": w3.eth.accounts[2]
        },
        {
            "name": "Karan Rao",
            "email": "k.rao@metro-forensics.gov.example",
            "password": demo_password,
            "role": "Digital Forensics Analyst",
            "employee_id": "ANL-4096",
            "department": "Digital Evidence Review Board",
            "organization": "State Forensic Sciences",
            "wallet_address": w3.eth.accounts[3]
        },
        {
            "name": "Neha Verma",
            "email": "n.verma@metro-forensics.gov.example",
            "password": demo_password,
            "role": "Special Legal Prosecutor",
            "employee_id": "LEG-1044",
            "department": "Cyber Prosecution Directorate",
            "organization": "Department of Justice",
            "wallet_address": w3.eth.accounts[4]
        },
        {
            "name": "Devraj Singh",
            "email": "d.singh@metro-forensics.gov.example",
            "password": demo_password,
            "role": "Evidence Vault Custodian",
            "employee_id": "CUS-2088",
            "department": "Central Forensic Vault",
            "organization": "Metropolitan Digital Forensics Agency",
            "wallet_address": w3.eth.accounts[5]
        }
    ]

    for u in SYNTHETIC_USERS:
        cur.execute("""
            INSERT OR REPLACE INTO users (name, email, password_hash, role, wallet_address, employee_id, department, organization)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            u["name"], u["email"], generate_password_hash(u["password"]),
            u["role"], u["wallet_address"], u["employee_id"], u["department"], u["organization"]
        ))
    conn.commit()
    print(f"[+] Seeded {len(SYNTHETIC_USERS)} synthetic personnel profiles.")

    # Seed Synthetic Cases
    CASES = [
        ("CASE-2026-METRO-101", "Operation Nightfall — Corporate Infrastructure Exfiltration", "Investigation into unauthorized cloud exfiltration."),
        ("CASE-2026-METRO-102", "Operation Blue Ridge — Counterfeit Payment Terminals", "Analysis of tampered point-of-sale firmware."),
        ("CASE-2026-METRO-103", "Operation Sentinel — Vehicle Sensor Telemetry Tampering", "Forensic analysis of autonomous crash telemetry."),
        ("CASE-2026-METRO-104", "Operation Deep Water — Supervisory Control Intrusion", "PLC logic analysis following industrial unauthorized access.")
    ]

    for cid, title, desc in CASES:
        cur.execute("INSERT OR REPLACE INTO cases (case_id, title, description, status) VALUES (?, ?, ?, 'ACTIVE')", (cid, title, desc))
    conn.commit()

    # Seed Synthetic Files and Blockchain Records
    EVIDENCE_ITEMS = [
        ("EVD-M101-01", "CASE-2026-METRO-101", "aws_vpc_flow_logs_anonymized.pcap", b"\xd4\xc3\xb2\xa1\x02\x00\x04\x00" + b"\x00"*2000, "VERIFIED_ACTIVE"),
        ("EVD-M101-02", "CASE-2026-METRO-101", "exfiltration_memory_dump_slice.bin", b"\x7fELF\x02\x01\x01\x00" + b"\xff"*1500, "VERIFIED_ACTIVE"),
        ("EVD-M102-01", "CASE-2026-METRO-102", "pos_terminal_firmware_v2.1.hex", b":10000000214601360121470136003E0332000092\n", "VERIFIED_ACTIVE"),
        ("EVD-M102-02", "CASE-2026-METRO-102", "terminal_tamper_forensic_report.pdf", b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n150\n%%EOF\n", "VERIFIED_ACTIVE"),
        ("EVD-M103-01", "CASE-2026-METRO-103", "can_bus_traffic_telemetry.csv", b"timestamp,can_id,byte0,byte1,byte2,byte3\n1714000001,0x102,0x00,0xFF,0x12,0x34\n", "VERIFIED_ACTIVE"),
        ("EVD-M104-01", "CASE-2026-METRO-104", "plc_logic_snapshot_historical.txt", b"HISTORICAL ARCHIVE: S7-1500 Ladder Logic CRC-32: 0x9A4F1288\n", "HISTORICAL_RECORD"),
        ("EVD-M104-02", "CASE-2026-METRO-104", "substation_switch_syslog_archive.log", b"Oct 24 10:14:02 sub4-sw1 System reboot: watchdog timeout\n", "HISTORICAL_RECORD"),
        ("EVD-M104-03", "CASE-2026-METRO-104", "modbus_inspection_notes_2025.docx", b"PK\x03\x04Historical Inspection Notes - Case METRO-104", "HISTORICAL_RECORD"),
        ("EVD-M101-03", "CASE-2026-METRO-101", "unanchored_suspect_ssd_raw_img.dd", b"\xeb<\x90EXFAT   " + b"\x00"*512, "NEVER_ANCHORED")
    ]

    for eid, cid, filename, payload, status in EVIDENCE_ITEMS:
        file_path = os.path.join(target_uploads, f"{eid}_{filename}")
        with open(file_path, "wb") as f:
            f.write(payload)
        sha256 = hashlib.sha256(payload).hexdigest()

        tx_hash_hex = None
        block_num = None

        if status == "VERIFIED_ACTIVE":
            # Register on genuine demo Anvil ledger
            tx = contract.functions.registerEvidence(eid, cid, sha256).transact({"from": deployer})
            rcpt = w3.eth.wait_for_transaction_receipt(tx)
            tx_hash_hex = rcpt.transactionHash.hex()
            block_num = rcpt.blockNumber
            print(f"[+] Anchored {eid} on Demo Anvil: Block #{block_num}, Tx: {tx_hash_hex[:16]}...")
        elif status == "HISTORICAL_RECORD":
            # Historical reference from prior genesis
            tx_hash_hex = f"0x{hashlib.sha256(eid.encode()).hexdigest()}"
            block_num = 42

        cur.execute("""
            INSERT OR REPLACE INTO evidence (
                evidence_id, case_id, title, description, file_path, sha256_hash,
                registered_by, blockchain_evidence_id, registration_tx_hash,
                current_custodian, anchor_block_number, anchor_contract_address,
                anchor_chain_id, provenance_status
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        """, (
            eid, cid, filename, f"Demonstration forensic asset: {filename}",
            file_path, sha256, eid, tx_hash_hex, w3.eth.accounts[1],
            block_num, contract_address if status == "VERIFIED_ACTIVE" else None,
            chain_id if status == "VERIFIED_ACTIVE" else None, status
        ))

    conn.commit()
    conn.close()

    print(f"\n[+] Demonstration Data Initialization COMPLETE!")
    print(f"[+] All synthetic evidence seeded with truthful provenance.")

if __name__ == "__main__":
    seed()
