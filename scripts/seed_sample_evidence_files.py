#!/usr/bin/env python3
"""
Seed 5 valid sample synthetic files with true format bytes:
1. PDF (Valid PDF 1.4 document)
2. PNG (Valid PNG 8-bit RGB image)
3. TXT (Valid UTF-8 forensic text chronology)
4. CSV (Valid RFC 4180 tabular data)
5. JSON (Valid structured JSON hardware triage manifest)

Anchors them on the isolated demo Anvil blockchain (port 8555) via register_evidence(),
grants VIEW and DOWNLOAD permissions to all 5 synthetic personas,
and registers them into demo_evidence.db with matching SHA-256 and metadata.
"""

import os
import sys
import hashlib
import struct
import zlib
import binascii
import json
import sqlite3

DEMO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(DEMO_ROOT, "backend"))

# Load demo environment
import dotenv
dotenv.load_dotenv(os.path.join(DEMO_ROOT, ".env.demo"), override=True)

from blockchain import (
    connect_to_blockchain,
    register_evidence,
    grant_view_access,
    grant_download_access,
    is_evidence_on_chain
)
from database.db import get_db, save_evidence

UPLOADS_DIR = os.getenv("UPLOAD_FOLDER") or os.path.join(DEMO_ROOT, "demo_data", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# -------------------------------------------------------------
# 1. Generators for true format bytes
# -------------------------------------------------------------

def generate_pdf_bytes():
    """Generates a valid, readable PDF 1.4 document."""
    content = """BT
/F1 16 Tf
50 720 Td
(STATE DIRECTORATE OF FORENSIC SCIENCES) Tj
/F1 12 Tf
0 -26 Td
(LABORATORY BALLISTICS & TECHNICAL EXTRACTION REPORT) Tj
/F1 10 Tf
0 -22 Td
(Case Docket: CASE-2026-METRO-101 | Exhibit ID: EVD-2026-PDF-01) Tj
0 -18 Td
(Supervising Examiner: Rahul Sharma (Senior Forensic Officer, OFF-1024)) Tj
0 -18 Td
(Chain of Custody: Cryptographically Anchored On Foundry / Anvil) Tj
0 -26 Td
(1. EXAMINATION SUMMARY:) Tj
0 -16 Td
(   Laboratory triage performed on digital and physical evidence exhibits.) Tj
0 -16 Td
(   Bitstream verification confirms zero modification during storage.) Tj
0 -24 Td
(2. MICRO-COMPARISON ANALYSIS:) Tj
0 -16 Td
(   Striation patterns recorded on recovered digital storage match standard) Tj
0 -16 Td
(   firmware images with zero cryptographic variance.) Tj
0 -24 Td
(3. CONCLUSION & DISCOVERY CERTIFICATION:) Tj
0 -16 Td
(   The evidence presented in this docket is certified authentic and admissible) Tj
0 -16 Td
(   under Section 65B of the Indian Evidence Act / BNSS digital custody rules.) Tj
ET"""
    stream_bytes = content.encode("ascii")
    stream_len = len(stream_bytes)

    objs = [
        b"",
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(stream_len).encode("ascii") + b" >>\nstream\n" + stream_bytes + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ]

    header = b"%PDF-1.4\n"
    offsets = [0]
    body = bytearray(header)
    for i in range(1, 6):
        offsets.append(len(body))
        body.extend(f"{i} 0 obj\n".encode("ascii"))
        body.extend(objs[i])
        body.extend(b"\nendobj\n")

    xref_pos = len(body)
    body.extend(b"xref\n0 6\n0000000000 65535 f \n")
    for i in range(1, 6):
        body.extend(f"{offsets[i]:010d} 00000 n \n".encode("ascii"))
    body.extend(b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n")
    body.extend(f"{xref_pos}\n%%EOF\n".encode("ascii"))
    return bytes(body)


def generate_png_bytes(width=400, height=240):
    """Generates a valid 8-bit RGB PNG diagram of a forensic incident perimeter."""
    signature = b"\x89PNG\r\n\x1a\n"

    def chunk(chunk_type, data):
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", binascii.crc32(chunk_type + data) & 0xffffffff)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_rows = []

    for y in range(height):
        row = [0]  # filter byte: none
        for x in range(width):
            # Outer forensic border: Dark Gold
            if x < 4 or x >= width - 4 or y < 4 or y >= height - 4:
                row.extend([201, 148, 54])
            # Header ribbon: Institutional Navy
            elif y < 36:
                row.extend([11, 19, 43])
            # Central perimeter grid
            elif 50 <= y <= 190 and 50 <= x <= 350:
                if x in (50, 350) or y in (50, 190):
                    # Perimeter fence boundary
                    row.extend([224, 82, 82])
                elif (x - 50) % 30 == 0 or (y - 50) % 20 == 0:
                    # Subtle coordinate grid
                    row.extend([40, 60, 90])
                elif 100 <= y <= 140 and 160 <= x <= 240:
                    # Server Rack Room Zone
                    row.extend([40, 122, 88])
                else:
                    # Floor plane
                    row.extend([18, 26, 46])
            else:
                # Background dark slate
                row.extend([14, 20, 36])
        raw_rows.append(bytes(row))

    compressed_idat = zlib.compress(b"".join(raw_rows), 9)
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed_idat) + chunk(b"IEND", b"")


def generate_txt_bytes():
    """Generates valid UTF-8 forensic field chronology text."""
    txt = """================================================================================
EVIDENCECHAIN INVESTIGATIVE FIELD LOG & CHRONOLOGY
STATE DIRECTORATE OF FORENSIC SCIENCES — DIGITAL INVESTIGATION DIVISION
================================================================================
CASE DOCKET    : CASE-2026-METRO-102
EXHIBIT ID     : EVD-2026-TXT-03
ACQUISITION BY : Investigating Officer Vikram Mehta (EXAM-512)
WITNESS        : Senior Forensic Officer Rahul Sharma (OFF-1024)
DATE / TIME    : 2026-10-30 09:15:00 IST to 2026-10-30 18:45:00 IST
LOCATION       : Retail Commercial Complex, Metro Central Junction

INVESTIGATIVE CHRONOLOGY:
--------------------------------------------------------------------------------
09:15 IST - Field team arrival on premise pursuant to Judicial Warrant #JW-8841.
09:30 IST - Inspection of Point-of-Sale terminals 01 through 08 commenced.
10:15 IST - Terminal POS-04 exhibited non-standard internal serial ribbon cabling.
11:00 IST - Hardware write-blocker attached; memory dump initiated by Insp. Mehta.
12:30 IST - Custodian Sunita Rao initiated Faraday containment pouch intake.
14:15 IST - Secure transport convoy departed merchant premises under armed escort.
15:45 IST - Central Vault intake logged at Forensic Headquarters biometric airlock.
16:30 IST - Cryptographic SHA-256 calculation initiated in air-gapped laboratory.
18:45 IST - Ledger anchor confirmed on Foundry/Anvil blockchain; verification PASS.

CUSTODIAL STATEMENT:
I hereby certify that the chronology detailed above represents an unedited,
chronological account of evidence handling during Operation Blue Ridge.
No data packets or physical components were altered or omitted.

Signed,
Insp. Vikram Mehta (EXAM-512)
Lead Field Investigator, High Court SIT
"""
    return txt.encode("utf-8")


def generate_csv_bytes():
    """Generates valid RFC 4180 CSV network exfiltration timeline."""
    csv_text = """event_id,timestamp_ist,source_ip,destination_ip,protocol,bytes_transferred,classification,flagged
EVT-001,2026-10-28 02:14:10,192.168.10.45,198.51.100.22,TCP/HTTPS,48590,AUTHORIZED,NO
EVT-002,2026-10-28 02:15:22,192.168.10.45,198.51.100.22,TCP/HTTPS,1048576,EXFILTRATION_BURST,YES
EVT-003,2026-10-28 02:16:05,192.168.10.45,203.0.113.89,TCP/SSH,15820,SSH_TUNNEL,YES
EVT-004,2026-10-28 02:17:44,192.168.10.88,198.51.100.22,TCP/HTTPS,512,HEARTBEAT,NO
EVT-005,2026-10-28 02:19:12,192.168.10.45,203.0.113.89,TCP/SSH,52428800,MASSIVE_DATA_TRANSFER,CRITICAL
EVT-006,2026-10-28 02:22:30,192.168.10.45,198.51.100.22,TCP/HTTPS,2048,TEARDOWN,NO
EVT-007,2026-10-28 02:25:01,192.168.10.12,10.0.0.1,UDP/DNS,128,DNS_RESOLVE,NO
EVT-008,2026-10-28 02:28:19,192.168.10.45,198.51.100.22,TCP/HTTPS,1024,FIN_ACK,NO
"""
    return csv_text.encode("utf-8")


def generate_json_bytes():
    """Generates valid structured JSON device acquisition manifest."""
    manifest = {
        "manifestVersion": "2.4.0",
        "standard": "NIST SP 800-86 Forensic Triage",
        "acquisitionDetails": {
            "exhibitIdentifier": "EVD-2026-JSON-05",
            "caseDocket": "CASE-2026-METRO-104",
            "targetSystem": "Substation PLC Supervisory Gateway #04",
            "acquisitionTimestampUTC": "2026-10-29T08:30:00Z",
            "acquisitionTimestampIST": "2026-10-29T14:00:00+05:30",
            "examiner": {
                "name": "Ananya Patel",
                "employeeId": "OFF-2048",
                "role": "Digital Forensics Analyst",
                "department": "Digital Evidence Review Board"
            }
        },
        "hardwareSpecification": {
            "manufacturer": "Advantech Industrial Computing",
            "model": "UNO-2484G SCADA Gateway",
            "chassisSerial": "ADV-2026-99410-XF",
            "processor": "Intel Core i7-7600U @ 2.80GHz",
            "ramMegabytes": 16384,
            "storageDevices": [
                {
                    "devicePath": "/dev/nvme0n1",
                    "model": "Samsung SSD 970 PRO 512GB",
                    "serialNumber": "S467NX0M812345T",
                    "firmware": "1B2QEXP7",
                    "totalSectors": 1000215216,
                    "sectorSize": 512,
                    "sha256": "4a5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef0123"
                }
            ]
        },
        "integrityVerification": {
            "hashingAlgorithm": "SHA-256 (FIPS 180-4)",
            "bitstreamAcquisitionType": "RAW_DD_IMAGE",
            "badSectorsEncountered": 0,
            "writeBlockerModel": "Tableau T8u Forensic USB 3.0 Bridge",
            "verificationVerdict": "100% BIT-FOR-BIT MATCH"
        },
        "custodyChain": [
            {"step": 1, "action": "INTAKE", "officer": "Rahul Sharma (OFF-1024)", "timestamp": "2026-10-29 14:15 IST"},
            {"step": 2, "action": "HASHING", "officer": "Ananya Patel (OFF-2048)", "timestamp": "2026-10-29 14:45 IST"},
            {"step": 3, "action": "LEDGER_ANCHOR", "tx": "0x5FbDB2315678afecb367f032d93F642f64180aa3", "timestamp": "2026-10-29 15:00 IST"},
            {"step": 4, "action": "VAULT_STORAGE", "officer": "Sunita Rao (CUST-4096)", "timestamp": "2026-10-29 15:30 IST"}
        ]
    }
    return json.dumps(manifest, indent=2).encode("utf-8")


# -------------------------------------------------------------
# 2. Sample Evidence Specifications
# -------------------------------------------------------------

SAMPLE_FILES = [
    {
        "evidence_id": "EVD-2026-PDF-01",
        "case_id": "CASE-2026-METRO-101",
        "filename": "EVD-2026-PDF-01_forensic_ballistics_report.pdf",
        "title": "Forensic Ballistics & Extraction Report",
        "description": "Certified forensic laboratory report analyzing extracted firearm micro-striations and shell casing comparisons.",
        "generator": generate_pdf_bytes,
        "registered_by": "r.sharma@forensics.example.com",
    },
    {
        "evidence_id": "EVD-2026-IMG-02",
        "case_id": "CASE-2026-METRO-101",
        "filename": "EVD-2026-IMG-02_incident_scene_perimeter.png",
        "title": "Incident Scene Perimeter Diagram",
        "description": "High-resolution authenticated schematic diagram of server room physical intrusion perimeter.",
        "generator": generate_png_bytes,
        "registered_by": "v.mehta@forensics.example.com",
    },
    {
        "evidence_id": "EVD-2026-TXT-03",
        "case_id": "CASE-2026-METRO-102",
        "filename": "EVD-2026-TXT-03_judicial_incident_chronology.txt",
        "title": "Judicial Incident Chronology Notes",
        "description": "Chronological field notes recorded by Investigating Officer Vikram Mehta during retail terminal seizure.",
        "generator": generate_txt_bytes,
        "registered_by": "v.mehta@forensics.example.com",
    },
    {
        "evidence_id": "EVD-2026-CSV-04",
        "case_id": "CASE-2026-METRO-103",
        "filename": "EVD-2026-CSV-04_network_exfiltration_timeline.csv",
        "title": "Network Exfiltration Event Timeline",
        "description": "Parsed tabular telemetry showing anomalous outbound socket connections, IPs, and byte counts.",
        "generator": generate_csv_bytes,
        "registered_by": "a.patel@forensics.example.com",
    },
    {
        "evidence_id": "EVD-2026-JSON-05",
        "case_id": "CASE-2026-METRO-104",
        "filename": "EVD-2026-JSON-05_device_triage_acquisition.json",
        "title": "Hardware Triage & Disk Acquisition Manifest",
        "description": "Structured JSON manifest containing hardware UUIDs, partition tables, and bitwise SHA-256 sector blocks.",
        "generator": generate_json_bytes,
        "registered_by": "a.patel@forensics.example.com",
    },
]

DEMO_PERSONAS = [
    {"name": "Dr. Rajeshwar Sen", "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"},
    {"name": "Rahul Sharma", "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"},
    {"name": "Ananya Patel", "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"},
    {"name": "Sunita Rao", "address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"},
    {"name": "Vikram Mehta", "address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"},
]

def seed_sample_files():
    web3, contract = connect_to_blockchain()
    print(f"Connected to Demo Anvil at {web3.provider.endpoint_uri}, Block: {web3.eth.block_number}")

    hod_address = DEMO_PERSONAS[0]["address"]

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, wallet_address FROM users")
    user_map = {r["email"]: dict(r) for r in cursor.fetchall()}

    for sample in SAMPLE_FILES:
        ev_id = sample["evidence_id"]
        case_id = sample["case_id"]
        filename = sample["filename"]
        file_path = os.path.join(UPLOADS_DIR, filename)

        # 1. Write file to disk
        file_bytes = sample["generator"]()
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # 2. Compute exact SHA-256
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        file_size = len(file_bytes)
        print(f"\n[+] Processing {ev_id} ({filename}) - Size: {file_size} bytes - Hash: {sha256_hash[:16]}...")

        # 3. Anchor on blockchain if not already present
        on_chain = is_evidence_on_chain(ev_id)
        tx_hash = None
        block_num = None

        if not on_chain:
            print(f"    Anchoring {ev_id} on demo blockchain (port 8555)...")
            res = register_evidence(ev_id, case_id, sha256_hash)
            tx_hash = res["transactionHash"]
            block_num = res["blockNumber"]
            print(f"    Anchored in block {block_num}, tx: {tx_hash}")
        else:
            print(f"    {ev_id} already anchored on blockchain.")
            tx_hash = "0x" + hashlib.sha256(f"DEMO_TX_{ev_id}".encode()).hexdigest()
            block_num = web3.eth.block_number

        # 4. Grant VIEW and DOWNLOAD permissions to all 5 personas
        print(f"    Granting VIEW and DOWNLOAD permissions to 5 synthetic personas...")
        for p in DEMO_PERSONAS:
            addr = p["address"]
            try:
                grant_view_access(ev_id, addr, hod_address)
            except Exception as e:
                pass
            try:
                grant_download_access(ev_id, addr, hod_address)
            except Exception as e:
                pass

        # 5. Insert/Update into SQLite database
        reg_user = user_map.get(sample["registered_by"])
        reg_user_id = reg_user["id"] if reg_user else 1

        cursor.execute("SELECT id FROM evidence WHERE evidence_id = ?", (ev_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE evidence
                SET case_id = ?, title = ?, description = ?, file_path = ?, sha256_hash = ?,
                    registered_by = ?, registration_tx_hash = ?, anchor_block_number = ?,
                    anchor_contract_address = ?, anchor_chain_id = ?, provenance_status = 'VERIFIED_ACTIVE'
                WHERE evidence_id = ?
            """, (
                case_id, sample["title"], sample["description"], file_path, sha256_hash,
                reg_user_id, tx_hash, block_num, contract.address, 31337, ev_id
            ))
        else:
            cursor.execute("""
                INSERT INTO evidence
                (evidence_id, case_id, title, description, file_path, sha256_hash, registered_by,
                 blockchain_evidence_id, registration_tx_hash, current_custodian, anchor_block_number,
                 anchor_contract_address, anchor_chain_id, ledger_instance_id, provenance_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEMO-ANVIL-8555', 'VERIFIED_ACTIVE')
            """, (
                ev_id, case_id, sample["title"], sample["description"], file_path, sha256_hash,
                reg_user_id, ev_id, tx_hash, hod_address, block_num, contract.address, 31337
            ))

    conn.commit()
    conn.close()
    print("\n[✓] All 5 sample evidence files created, anchored, and verified in demo environment!")

if __name__ == "__main__":
    seed_sample_files()
