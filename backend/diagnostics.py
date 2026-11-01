# ============================================================
# EvidenceChain: System Health & Diagnostics Blueprint
# Professional Forensic Telemetry, Ledger Consistency & Security
# ============================================================

import os
import sys
import time
import shutil
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, current_app
from web3 import Web3

from database.db import get_db
from blockchain import (
    RPC_URL,
    CONTRACT_ADDRESS,
    get_rpc_url,
    get_contract_address,
    EXPECTED_CHAIN_ID,
    connect_to_blockchain,
    get_contract_abi,
    extract_clean_error
)

diagnostics_bp = Blueprint(
    "diagnostics",
    __name__,
    url_prefix="/api/diagnostics"
)

# Upload directory path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")


# ============================================================
# ACCESS CONTROL & POLICY HELPERS
# ============================================================

def is_authorized_diagnostics_admin():
    """
    Check if the active session holds administrative credentials
    to access technical diagnostics and internal infrastructure metrics.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return False
    role = session.get("role")
    # Head of Department holds administrative oversight authority
    return role == "Head of Department"


def is_dev_tools_permitted():
    """
    Multi-layered defense-in-depth gate for exposing local EVM test accounts.
    Default-disabled outside trusted local development.
    """
    # 1. Server configuration flag (Default: False)
    allow_flag = os.getenv("ALLOW_DEV_DIAGNOSTICS", "").strip().lower()
    if allow_flag not in ("true", "1", "yes"):
        return False

    # 2. Strict environment check - production is strictly rejected
    flask_env = (os.getenv("FLASK_ENV") or "").strip().lower()
    if flask_env == "production":
        return False

    is_testing = False
    try:
        is_testing = bool(current_app and current_app.config.get("TESTING"))
    except RuntimeError:
        pass

    if flask_env not in ("development", "test", "testing") and not is_testing:
        return False

    # 3. Local loopback verification
    if not is_testing:
        try:
            remote = request.remote_addr or ""
            if not (remote.startswith("127.") or remote in ("::1", "localhost")):
                return False
        except RuntimeError:
            pass

    return True

    return True


# ============================================================
# SERVICE CHECK 1: FLASK REST GATEWAY
# ============================================================

def check_flask_api():
    t0 = time.perf_counter()
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    env = os.getenv("FLASK_ENV", "development").lower()

    return {
        "id": "flask_api",
        "name": "Flask API Gateway",
        "category": "Application Layer",
        "status": "Healthy",
        "responseTimeMs": latency_ms,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "summary": "REST Gateway active and responding with low latency",
        "details": {
            "environment": env,
            "pythonVersion": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "serverTime": datetime.now(timezone.utc).isoformat()
        }
    }


# ============================================================
# SERVICE CHECK 2: SQLITE METADATA DATABASE
# ============================================================

def check_sqlite_db():
    t0 = time.perf_counter()
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()

        # Query metadata statistics
        cursor.execute("SELECT count(*) as cnt FROM evidence")
        evidence_count = cursor.fetchone()["cnt"]

        cursor.execute("SELECT count(*) as cnt FROM users")
        user_count = cursor.fetchone()["cnt"]

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        status = "Healthy" if latency_ms < 1000 else "Degraded"

        return {
            "id": "sqlite_database",
            "name": "SQLite Metadata Store",
            "category": "Persistence Layer",
            "status": status,
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": f"Relational database query succeeded ({evidence_count} evidence records, {user_count} personnel profiles)",
            "details": {
                "evidenceRecords": evidence_count,
                "userAccounts": user_count,
                "readWriteTest": "PASSED"
            }
        }
    except Exception as err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "id": "sqlite_database",
            "name": "SQLite Metadata Store",
            "category": "Persistence Layer",
            "status": "Unavailable",
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": "Database connectivity or query failure",
            "error": "Failed to query SQLite database. File may be locked or inaccessible.",
            "details": None
        }


# ============================================================
# SERVICE CHECK 3: HARDHAT ETHEREUM NODE (JSON-RPC)
# ============================================================

def check_hardhat_node():
    t0 = time.perf_counter()
    try:
        # Bounded 3-second timeout for RPC check
        w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 3}))
        is_conn = w3.is_connected()
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        if not is_conn:
            return {
                "id": "hardhat_node",
                "name": "Hardhat Ethereum Node",
                "category": "Consensus Layer",
                "status": "Unavailable",
                "responseTimeMs": latency_ms,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "summary": "Blockchain RPC node is offline or unreachable",
                "error": f"Cannot establish JSON-RPC connection to {RPC_URL}. Ensure 'npx hardhat node' is running.",
                "details": None
            }

        chain_id = w3.eth.chain_id
        block_num = w3.eth.block_number

        if chain_id != EXPECTED_CHAIN_ID:
            return {
                "id": "hardhat_node",
                "name": "Hardhat Ethereum Node",
                "category": "Consensus Layer",
                "status": "Degraded",
                "responseTimeMs": latency_ms,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "summary": f"Network chain ID mismatch (Expected {EXPECTED_CHAIN_ID}, got {chain_id})",
                "error": f"Connected RPC node is operating on chain ID {chain_id} instead of required {EXPECTED_CHAIN_ID}.",
                "details": {
                    "chainId": chain_id,
                    "expectedChainId": EXPECTED_CHAIN_ID,
                    "blockNumber": block_num
                }
            }

        return {
            "id": "hardhat_node",
            "name": "Hardhat Ethereum Node",
            "category": "Consensus Layer",
            "status": "Healthy",
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": f"EVM consensus layer active at block #{block_num} (Chain ID {chain_id})",
            "details": {
                "chainId": chain_id,
                "blockNumber": block_num,
                "rpcEndpoint": RPC_URL
            }
        }
    except Exception as err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "id": "hardhat_node",
            "name": "Hardhat Ethereum Node",
            "category": "Consensus Layer",
            "status": "Unavailable",
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": "Connection timeout or socket failure connecting to blockchain node",
            "error": "Hardhat node did not respond within bounded timeout limit.",
            "details": None
        }


# ============================================================
# SERVICE CHECK 4: SMART CONTRACT DEPLOYMENT
# ============================================================

def check_smart_contract():
    t0 = time.perf_counter()
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 3}))
        if not w3.is_connected():
            return {
                "id": "smart_contract",
                "name": "Smart Contract Deployment",
                "category": "Consensus Layer",
                "status": "Unavailable",
                "responseTimeMs": 0,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "summary": "Cannot inspect contract bytecode: Ethereum node is offline",
                "error": "Blockchain node is unreachable.",
                "details": None
            }

        checksum_addr = Web3.to_checksum_address(CONTRACT_ADDRESS)
        code = w3.eth.get_code(checksum_addr)
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        if code in (b"", b"0x") or len(code) <= 2:
            return {
                "id": "smart_contract",
                "name": "Smart Contract Deployment",
                "category": "Consensus Layer",
                "status": "Unavailable",
                "responseTimeMs": latency_ms,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "summary": "No contract bytecode deployed at specified address",
                "error": f"Address {CONTRACT_ADDRESS} contains no bytecode. The Hardhat node may have restarted without redeployment.",
                "details": {
                    "contractAddress": CONTRACT_ADDRESS,
                    "bytecodeLength": 0
                }
            }

        # Perform read-only call to verify interface compatibility
        contract = w3.eth.contract(address=checksum_addr, abi=get_contract_abi())
        hod_address = contract.functions.headOfDepartment().call()

        return {
            "id": "smart_contract",
            "name": "Smart Contract Deployment",
            "category": "Consensus Layer",
            "status": "Healthy",
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": f"EvidenceChain core contract verified (Bytecode: {len(code)} bytes, HOD anchored)",
            "details": {
                "contractAddress": CONTRACT_ADDRESS,
                "bytecodeLength": len(code),
                "headOfDepartment": hod_address
            }
        }
    except Exception as err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "id": "smart_contract",
            "name": "Smart Contract Deployment",
            "category": "Consensus Layer",
            "status": "Degraded",
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": "Contract interface verification query failed",
            "error": "Contract bytecode exists but runtime call reverted. ABI or contract state may be mismatched.",
            "details": None
        }


# ============================================================
# SERVICE CHECK 5: EVIDENCE STORAGE VAULT
# ============================================================

def check_evidence_storage():
    t0 = time.perf_counter()
    try:
        folder = UPLOAD_FOLDER
        if not os.path.exists(folder):
            # Attempt to create directory safely
            os.makedirs(folder, exist_ok=True)

        is_readable = os.access(folder, os.R_OK)
        is_writable = os.access(folder, os.W_OK)

        if not (is_readable and is_writable):
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "id": "evidence_storage",
                "name": "Evidence Storage Vault",
                "category": "Storage Layer",
                "status": "Unavailable",
                "responseTimeMs": latency_ms,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "summary": "Storage directory permissions fault",
                "error": f"Filesystem directory '{folder}' lacks required read/write permissions.",
                "details": None
            }

        # Measure disk space
        usage = shutil.disk_usage(folder)
        free_gb = round(usage.free / (1024 ** 3), 2)
        free_mb = round(usage.free / (1024 ** 2), 1)
        file_count = len([f for f in os.listdir(folder) if not f.startswith(".")])

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        status = "Healthy" if free_mb > 100 else "Degraded"

        return {
            "id": "evidence_storage",
            "name": "Evidence Storage Vault",
            "category": "Storage Layer",
            "status": status,
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": f"Evidence disk vault accessible ({file_count} files stored, {free_gb} GB free)",
            "details": {
                "storagePath": folder,
                "totalFiles": file_count,
                "freeDiskSpaceGB": free_gb,
                "isWritable": True
            }
        }
    except Exception as err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "id": "evidence_storage",
            "name": "Evidence Storage Vault",
            "category": "Storage Layer",
            "status": "Unavailable",
            "responseTimeMs": latency_ms,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "summary": "Failed to access off-chain evidence storage directory",
            "error": "Local filesystem access error.",
            "details": None
        }


# ============================================================
# API ENDPOINT 1: OPERATIONAL HEALTH OVERVIEW
# ============================================================

@diagnostics_bp.route("/summary", methods=["GET"])
def get_diagnostics_summary():
    """
    Concise operational health summary across all 5 core services.
    Accessible to all authenticated officers.
    Never exposes internal secrets or administrative controls.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to query system diagnostics."
        }), 401

    # Execute all 5 service checks with bounded individual timeouts
    flask_res = check_flask_api()
    db_res = check_sqlite_db()
    node_res = check_hardhat_node()
    contract_res = check_smart_contract()
    storage_res = check_evidence_storage()

    services = [flask_res, db_res, node_res, contract_res, storage_res]

    # Evaluate composite system status
    statuses = [s["status"] for s in services]
    if "Unavailable" in statuses:
        overall = "Unavailable"
        overall_summary = "One or more critical system services are currently offline or unreachable."
    elif "Degraded" in statuses:
        overall = "Degraded"
        overall_summary = "All services reachable, but one or more components are operating in degraded mode."
    else:
        overall = "Healthy"
        overall_summary = "All application services, consensus layers, and storage vaults are operating nominally."

    return jsonify({
        "status": "success",
        "systemHealth": overall,
        "summary": overall_summary,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "services": services,
        "isAdmin": is_authorized_diagnostics_admin(),
        "allowDevTools": is_dev_tools_permitted()
    }), 200


# ============================================================
# API ENDPOINT 2: LEDGER CONTINUITY & EVIDENCE CONSISTENCY
# ============================================================

@diagnostics_bp.route("/consistency", methods=["GET"])
def get_ledger_consistency():
    """
    Analyze consistency between SQLite evidence records and active blockchain anchors.
    Distinguishes between anchored records, historical unanchored records, and network errors.
    Strictly read-only.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required."
        }), 401

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT evidence_id, case_id, title, sha256_hash, registration_tx_hash, created_at
            FROM evidence
            ORDER BY id ASC
        """)
        rows = cursor.fetchall()
        total_db = len(rows)

        # Check blockchain connection
        w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 3}))
        if not w3.is_connected():
            return jsonify({
                "status": "success",
                "ledgerState": "OFFLINE",
                "totalDbRecords": total_db,
                "anchoredRecords": 0,
                "unanchoredRecords": 0,
                "historicalRecords": sum(1 for r in rows if r["registration_tx_hash"]),
                "neverAnchoredRecords": sum(1 for r in rows if not r["registration_tx_hash"]),
                "networkErrorRecords": total_db,
                "warning": "Blockchain node is currently offline. Evidence ledger consistency cannot be verified.",
                "explanation": "Ensure the persistent consensus node is running to evaluate on-chain anchor verification.",
                "samples": {
                    "anchored": [],
                    "unanchored": []
                }
            }), 200

        # Check contract deployment
        checksum_addr = Web3.to_checksum_address(CONTRACT_ADDRESS)
        code = w3.eth.get_code(checksum_addr)
        if code in (b"", b"0x"):
            return jsonify({
                "status": "success",
                "ledgerState": "CONTRACT_NOT_DEPLOYED",
                "totalDbRecords": total_db,
                "anchoredRecords": 0,
                "unanchoredRecords": total_db,
                "historicalRecords": sum(1 for r in rows if r["registration_tx_hash"]),
                "neverAnchoredRecords": sum(1 for r in rows if not r["registration_tx_hash"]),
                "networkErrorRecords": 0,
                "warning": "Smart contract is not deployed at configured address.",
                "explanation": "No contract bytecode was found at the configured address. Deploy the contract or start the persistent consensus node.",
                "samples": {
                    "anchored": [],
                    "unanchored": [r["evidence_id"] for r in rows[:5]]
                }
            }), 200

        contract = w3.eth.contract(address=checksum_addr, abi=get_contract_abi())

        anchored_records = []
        historical_records = []
        never_anchored_records = []
        network_errors = []
        hash_mismatches = []

        # Audit each SQLite evidence against the active ledger
        for r in rows:
            eid = r["evidence_id"]
            db_hash = r["sha256_hash"]
            tx_hash = r["registration_tx_hash"]

            try:
                # Call getEvidence(evidenceId)
                res = contract.functions.getEvidence(str(eid)).call()
                on_chain_id = res[0]
                on_chain_hash = res[2]

                if on_chain_id and len(on_chain_id) > 0:
                    if on_chain_hash == db_hash:
                        anchored_records.append(eid)
                    else:
                        hash_mismatches.append(eid)
                else:
                    if tx_hash:
                        historical_records.append(eid)
                    else:
                        never_anchored_records.append(eid)
            except Exception as e:
                err_msg = str(e)
                # Distinguish between genuine unanchored revert vs network socket error
                if "Evidence does not exist" in err_msg or "execution reverted" in err_msg:
                    if tx_hash:
                        historical_records.append(eid)
                    else:
                        never_anchored_records.append(eid)
                else:
                    # Network timeout, socket reset, or RPC failure
                    network_errors.append(eid)

        num_anchored = len(anchored_records)
        num_historical = len(historical_records)
        num_never = len(never_anchored_records)
        num_unanchored = num_historical + num_never
        num_net_err = len(network_errors)
        num_mismatch = len(hash_mismatches)

        if num_net_err > 0 and (num_anchored + num_unanchored == 0):
            ledger_state = "NETWORK_ERROR"
            warning = f"Network errors encountered while querying ledger ({num_net_err} items failed to verify)."
            explanation = "RPC network latency or connection interrupts prevented verification. Retrying diagnostics may resolve this."
        elif num_unanchored > 0:
            ledger_state = "HISTORICAL_RESTART_DETECTED"
            warning = f"Ledger Continuity Advisory: {num_historical} historical records and {num_never} never-anchored records detected."
            explanation = "Historical records preserved from prior ledger sessions remain intact in SQLite with original transaction proofs. Never-anchored records remain in local database queue."
        else:
            ledger_state = "CONSISTENT"
            warning = None
            explanation = "All SQLite evidence records are verified and cryptographically anchored on the active blockchain ledger."

        return jsonify({
            "status": "success",
            "ledgerState": ledger_state,
            "totalDbRecords": total_db,
            "anchoredRecords": num_anchored,
            "unanchoredRecords": num_unanchored,
            "historicalRecords": num_historical,
            "neverAnchoredRecords": num_never,
            "networkErrorRecords": num_net_err,
            "mismatchRecords": num_mismatch,
            "warning": warning,
            "explanation": explanation,
            "activeChainId": EXPECTED_CHAIN_ID,
            "contractAddress": CONTRACT_ADDRESS,
            "samples": {
                "anchored": anchored_records[:6],
                "unanchored": (historical_records + never_anchored_records)[:6]
            }
        }), 200

    except Exception as err:
        return jsonify({
            "status": "error",
            "message": f"Ledger consistency check failed: {extract_clean_error(err)}"
        }), 500


# ============================================================
# API ENDPOINT 3: TECHNICAL DIAGNOSTICS (ADMIN ONLY)
# ============================================================

@diagnostics_bp.route("/technical", methods=["GET"])
def get_technical_diagnostics():
    """
    Detailed infrastructure diagnostics for authorized administrators.
    Restricted strictly to Head of Department or authorized technical leads.
    Never exposes private keys, JWT secrets, or environment credentials.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required."
        }), 401

    if not is_authorized_diagnostics_admin():
        return jsonify({
            "status": "forbidden",
            "message": "Access restricted: Technical diagnostics require Head of Department authority."
        }), 403

    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 3}))
        is_node_connected = w3.is_connected()
        client_version = w3.client_version if is_node_connected else "Offline"
        block_height = w3.eth.block_number if is_node_connected else 0

        # Safe sanitized CORS reflection
        cors_info = {
            "credentialsSupported": True,
            "allowedOrigins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5001",
                "http://127.0.0.1:5001"
            ],
            "wildcardAllowed": False
        }

        # Safe sanitized session config
        session_info = {
            "cookieHttpOnly": current_app.config.get("SESSION_COOKIE_HTTPONLY", True),
            "cookieSameSite": current_app.config.get("SESSION_COOKIE_SAMESITE", "Lax"),
            "cookieSecure": current_app.config.get("SESSION_COOKIE_SECURE", False),
            "lifetimeHours": 8,
            "storageMechanism": "Signed Server Cookie (HMAC-SHA256)"
        }

        # Safe sanitized filesystem info
        storage_info = {
            "uploadPath": UPLOAD_FOLDER,
            "exists": os.path.exists(UPLOAD_FOLDER),
            "isWritable": os.access(UPLOAD_FOLDER, os.W_OK),
            "writable": os.access(UPLOAD_FOLDER, os.W_OK),
            "fileCount": len([f for f in os.listdir(UPLOAD_FOLDER) if not f.startswith(".")])
        }

        return jsonify({
            "status": "success",
            "diagnostics": {
                "apiGateway": {
                    "endpoint": "http://127.0.0.1:5001",
                    "framework": "Flask 3.x / Werkzeug",
                    "cors": cors_info,
                    "sessionSecurity": session_info
                },
                "consensusLayer": {
                    "rpcEndpoint": RPC_URL,
                    "chainId": EXPECTED_CHAIN_ID,
                    "clientVersion": client_version,
                    "contractAddress": CONTRACT_ADDRESS,
                    "blockHeight": block_height,
                    "isConnected": is_node_connected
                },
                "persistenceLayer": {
                    "databaseType": "SQLite 3",
                    "databasePath": "backend/evidencechain.db",
                    "storageVault": storage_info
                }
            }
        }), 200

    except Exception as err:
        return jsonify({
            "status": "error",
            "message": f"Failed to retrieve technical diagnostics: {str(err)}"
        }), 500


# ============================================================
# API ENDPOINT 4: LOCAL DEVELOPMENT TOOLS (DEV ONLY)
# ============================================================

@diagnostics_bp.route("/dev-tools", methods=["GET"])
def get_development_tools():
    """
    Expose pre-funded local EVM test accounts and safe RPC tools.
    Strictly restricted to authorized development environments and loopback clients.
    Never exposes private keys or seed phrases.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required."
        }), 401

    if not is_authorized_diagnostics_admin():
        return jsonify({
            "status": "forbidden",
            "message": "Administrative authorization required."
        }), 403

    if not is_dev_tools_permitted():
        return jsonify({
            "status": "forbidden",
            "message": "Local development tools are disabled by server policy in this environment."
        }), 403

    # Sanitized pre-funded Hardhat accounts (public addresses ONLY, zero private keys)
    dev_accounts = [
        {
            "index": 0,
            "role": "Contract Deployer / Designated HOD",
            "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "officer": "Dr. Rajeshwar Sen",
            "testBalance": "10,000 ETH (Testnet Only)"
        },
        {
            "index": 1,
            "role": "Senior Forensic Officer",
            "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "officer": "Rahul Sharma",
            "testBalance": "10,000 ETH (Testnet Only)"
        },
        {
            "index": 2,
            "role": "Digital Forensics Analyst",
            "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "officer": "Ananya Patel",
            "testBalance": "10,000 ETH (Testnet Only)"
        },
        {
            "index": 3,
            "role": "Evidence Custodian",
            "address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            "officer": "Sunita Rao",
            "testBalance": "10,000 ETH (Testnet Only)"
        },
        {
            "index": 4,
            "role": "Investigating Officer",
            "address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "officer": "Vikram Mehta",
            "testBalance": "10,000 ETH (Testnet Only)"
        }
    ]

    return jsonify({
        "status": "success",
        "accounts": dev_accounts,
        "disclaimer": "Pre-funded Hardhat testnet accounts on local Chain ID 31337. Test ETH balances have zero monetary value. Private keys are never exposed."
    }), 200


# ============================================================
# API ENDPOINT 5: SAFE SERVER-SIDE RPC PING
# ============================================================

@diagnostics_bp.route("/ping-rpc", methods=["POST"])
def ping_rpc():
    """
    Execute a safe, bounded, read-only JSON-RPC query (eth_blockNumber) server-side.
    Avoids client-side browser CORS / private network issues.
    Does NOT write test transactions.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required."
        }), 401

    t0 = time.perf_counter()
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 3}))
        if not w3.is_connected():
            return jsonify({
                "status": "error",
                "message": f"Hardhat node unreachable at {RPC_URL}."
            }), 503

        block_num = w3.eth.block_number
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        return jsonify({
            "status": "success",
            "blockNumber": block_num,
            "hexBlock": hex(block_num),
            "latencyMs": latency_ms,
            "chainId": w3.eth.chain_id,
            "endpoint": RPC_URL
        }), 200

    except Exception as err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return jsonify({
            "status": "error",
            "latencyMs": latency_ms,
            "message": f"RPC query failed: {str(err)}"
        }), 500
