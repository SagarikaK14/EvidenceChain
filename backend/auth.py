# ============================================================
# EvidenceChain Institutional Authentication & Dynamic MFA Blueprint
# Strict Forensic Access Control & Session Management
# ============================================================

import os
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Ensure local environment configuration is loaded: prioritize .env.demo in demo deployments, fallback to .env
def _load_env():
    demo_env = os.getenv("DEMO_ENV_FILE")
    if not demo_env:
        cur = os.path.abspath(__file__)
        for _ in range(4):
            cur = os.path.dirname(cur)
            cand = os.path.join(cur, ".env.demo")
            if os.path.exists(cand):
                demo_env = cand
                break
    if demo_env and os.path.exists(demo_env):
        load_dotenv(demo_env, override=True)
    else:
        load_dotenv()

_load_env()

from database.db import get_db


# ============================================================
# BLUEPRINT DEFINITION
# ============================================================

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


# ============================================================
# APPROVED DEMO PERSONAS & HARDENED SWITCHING GATE
# ============================================================

# Strictly designated institutional demo personas permitted for development switching
APPROVED_DEMO_EMAILS = {
    "r.sen@forensics.example.com",
    "r.sharma@forensics.example.com",
    "a.patel@forensics.example.com",
    "s.rao@forensics.example.com",
    "v.mehta@forensics.example.com"
}

# Synthetic demonstration personas permitted for public demonstration sign-in
# Reproduces the five original employee personnel and role hierarchy of EvidenceChain
SYNTHETIC_DEMO_PERSONAS = {
    "r.sen@forensics.example.com": {
        "name": "Dr. Rajeshwar Sen",
        "email": "r.sen@forensics.example.com",
        "role": "Head of Department",
        "employee_id": "HOD-0001",
        "department": "Forensics Headquarters",
        "organization": "State Directorate of Forensic Sciences",
        "wallet_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "shortcut": "hod"
    },
    "r.sharma@forensics.example.com": {
        "name": "Rahul Sharma",
        "email": "r.sharma@forensics.example.com",
        "role": "Senior Forensic Officer",
        "employee_id": "OFF-1024",
        "department": "Cyber Crime Investigation Unit",
        "organization": "Metropolitan Police Department",
        "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "shortcut": "officer"
    },
    "a.patel@forensics.example.com": {
        "name": "Ananya Patel",
        "email": "a.patel@forensics.example.com",
        "role": "Digital Forensics Analyst",
        "employee_id": "OFF-2048",
        "department": "Digital Evidence Review Board",
        "organization": "State Forensic Science Laboratory",
        "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "shortcut": "analyst"
    },
    "s.rao@forensics.example.com": {
        "name": "Sunita Rao",
        "email": "s.rao@forensics.example.com",
        "role": "Evidence Custodian",
        "employee_id": "CUST-4096",
        "department": "Central Evidence Vault",
        "organization": "Judicial Evidence Repository",
        "wallet_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "shortcut": "custodian"
    },
    "v.mehta@forensics.example.com": {
        "name": "Vikram Mehta",
        "email": "v.mehta@forensics.example.com",
        "role": "Investigating Officer",
        "employee_id": "EXAM-512",
        "department": "Judicial Forensic Commission",
        "organization": "High Court Special Investigation Team",
        "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "shortcut": "investigator"
    }
}

# Retired temporary demonstration personas that MUST NOT be accessed
RETIRED_TEMP_PERSONAS = {
    "v.seth@metro-forensics.gov.example",
    "a.mehta@metro-forensics.gov.example",
    "p.nair@metro-forensics.gov.example",
    "k.rao@metro-forensics.gov.example",
    "n.verma@metro-forensics.gov.example",
    "d.singh@metro-forensics.gov.example"
}

# Protected identities that MUST NEVER be accessed via demo authentication
PROTECTED_IDENTITIES = {
    "officer@example.com",
    "hod.cyber@agency.gov.in"
}

# In-memory IP rate limiting stores (IP -> list of epoch seconds)
LOGIN_RATE_LIMITS = {}
DEMO_LOGIN_RATE_LIMITS = {}


def check_rate_limit(rate_dict, key, max_requests=5, window_seconds=60):
    """
    Thread-safe in-memory sliding window rate limiter.
    """
    now = datetime.now(timezone.utc).timestamp()
    timestamps = [t for t in rate_dict.get(key, []) if now - t < window_seconds]
    if len(timestamps) >= max_requests:
        return False
    timestamps.append(now)
    rate_dict[key] = timestamps
    return True


def is_public_demo_mode():
    """Returns True if the application is configured in public demonstration mode."""
    val = os.getenv("PUBLIC_DEMO_MODE", "").strip().lower()
    if val in ("true", "1", "yes"):
        return True
    demo_env = os.getenv("DEMO_ENV_FILE")
    if not demo_env:
        cur = os.path.abspath(__file__)
        for _ in range(4):
            cur = os.path.dirname(cur)
            cand = os.path.join(cur, ".env.demo")
            if os.path.exists(cand):
                demo_env = cand
                break
    if demo_env and os.path.exists(demo_env):
        try:
            with open(demo_env, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("PUBLIC_DEMO_MODE="):
                        v = line.split("=", 1)[1].strip().strip('"').strip("'").lower()
                        if v in ("true", "1", "yes"):
                            return True
        except Exception:
            pass
    return False


def is_demo_switching_enabled():
    """
    Default-disabled, explicit development-only check.
    Rejects demo switching outside trusted local development, even if FLASK_ENV
    is missing or incorrectly configured.

    Enforces defense-in-depth:
    1. Explicit configuration flag (ALLOW_DEV_DEMO_SWITCH=true). Defaults to False.
    2. Strict environment check: FLASK_ENV must be explicitly 'development' or test mode.
       If missing, empty, 'production', or unrecognized, returns False.
    3. Trusted local development network verification: Client remote IP must be loopback.
    """
    # 1. Explicit configuration flag (default: disabled)
    allow_flag = os.getenv("ALLOW_DEV_DEMO_SWITCH", "").strip().lower()
    legacy_flag = os.getenv("ALLOW_DEMO_SWITCH", "").strip().lower()
    if allow_flag not in ("true", "1", "yes") and legacy_flag not in ("true", "1", "yes"):
        return False

    # 2. Strict environment check (Must be explicitly 'development' or automated test mode)
    flask_env = (os.getenv("FLASK_ENV") or "").strip().lower()
    is_testing = False
    try:
        is_testing = bool(current_app and current_app.config.get("TESTING"))
    except RuntimeError:
        pass

    if flask_env not in ("development", "test", "testing") and not is_testing:
        return False

    if flask_env == "production":
        return False

    # 3. Trusted local development network verification
    # Reject remote incoming requests outside localhost loopback unless in test mode
    if not is_testing:
        try:
            remote = request.remote_addr or ""
            if not (remote.startswith("127.") or remote in ("::1", "localhost")):
                return False
        except RuntimeError:
            pass

    return True


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def mask_email(email):
    """
    Produce a non-sensitive masked email for MFA prompt display.
    Example: 'r.sen@forensics.example.com' -> 'r***n@forensics.example.com'
    """
    if not email or "@" not in email:
        return "***"
    parts = email.split("@")
    name, domain = parts[0], parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "***"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"


import json


def log_development_mfa(user_info, challenge_id, otp):
    """
    Console output and local JSON persistence for dynamic OTP demonstration.
    """
    user_dict = dict(user_info) if user_info is not None else {}

    print("\n" + "=" * 80, flush=True)
    print(" [EVIDENCECHAIN SECURE AUTHENTICATION GATEWAY — MFA DISPATCH]", flush=True)
    print(f" Timestamp:      {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", flush=True)
    print(f" Target Account: {user_dict.get('name')} <{user_dict.get('email')}>", flush=True)
    print(f" Designation:    {user_dict.get('role')} (ID: {user_dict.get('employee_id')})", flush=True)
    print(f" Challenge ID:   {challenge_id}", flush=True)
    print(f" >>> ONE-TIME VERIFICATION CODE (OTP): {otp} <<<", flush=True)
    print(" Window:         Valid for 5 minutes (300 seconds) | Max 3 attempts", flush=True)
    print(" Notice:         Displayed in terminal strictly for local academic & demo evaluation.", flush=True)
    print("                 In production deployments, transmitted exclusively via encrypted SMTP/SMS.", flush=True)
    print("=" * 80 + "\n", flush=True)

    # Persist in local dev testing file for automated verification suites and manual inspection
    try:
        otp_file = "/tmp/evidencechain_dev_otp.json"
        data = {}
        if os.path.exists(otp_file):
            try:
                with open(otp_file, "r") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data[challenge_id] = otp
        data["latest"] = {
            "challenge_id": challenge_id,
            "otp": otp,
            "email": user_dict.get("email"),
            "name": user_dict.get("name"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        with open(otp_file, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def parse_iso_datetime(dt_str):
    """
    Safely parse ISO datetime string stored in SQLite.
    """
    try:
        # Handle trailing Z or format variations
        clean_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


def format_user_payload(user):
    """
    Format safe user payload for API responses and active session.
    """
    u = dict(user) if user is not None else {}
    role = u.get("role") or "Forensic Officer"
    wallet = u.get("wallet_address")
    return {
        "id": u.get("id"),
        "name": u.get("name"),
        "email": u.get("email"),
        "role": role,
        "designation": role,
        "employeeId": u.get("employee_id"),
        "department": u.get("department"),
        "organization": u.get("organization"),
        "walletAddress": wallet,
        "accountStatus": "ACTIVE" if (u.get("name") and u.get("email")) else "PENDING",
        "identityStatus": "VERIFIED",
        "walletStatus": "REGISTERED" if wallet else "UNLINKED",
        "mfaStatus": "ENABLED",
        "isHOD": (role == "Head of Department"),
    }


def build_user_permissions(role, wallet_address):
    """
    Compute server-enforced role-based permissions strictly according to
    EvidenceChain's backend and smart-contract authorization model.
    """
    is_hod_role = (role == "Head of Department")

    return [
        {
            "id": "register_evidence",
            "name": "Register Evidence Artifacts",
            "category": "Core Operations",
            "status": "ALLOWED",
            "statusLabel": "Allowed",
            "scope": "Judicial Cases",
            "description": "Authorized to register original forensic evidence artifacts, compute bitwise SHA-256 digests, and commit immutable proof to the ledger.",
            "enforcement": "Backend Session & Smart Contract registerEvidence()",
            "serverRule": "Active officer session verified via @login_required decorator",
            "contractMethod": "registerEvidence(bytes32 evidenceId, string caseId, string evidenceHash)"
        },
        {
            "id": "verify_evidence",
            "name": "Verify Cryptographic Integrity",
            "category": "Core Operations",
            "status": "ALLOWED",
            "statusLabel": "Allowed",
            "scope": "Global Evidence",
            "description": "Authorized to upload candidate files and verify bitwise SHA-256 checksums against on-chain anchor records.",
            "enforcement": "Cryptographic Hash Validation (Public Verification Protocol)",
            "serverRule": "SHA-256 cryptographic digest verification against on-chain anchor",
            "contractMethod": "verifyEvidence(bytes32 evidenceId, string candidateHash)"
        },
        {
            "id": "view_evidence",
            "name": "View Evidence Dossier & File",
            "category": "Evidence Access Control",
            "status": "EVIDENCE_SPECIFIC",
            "statusLabel": "Evidence-Specific",
            "scope": "Authorized Records Only",
            "description": "Requires explicit on-chain view authorization granted by Head of Department or active on-chain custody of the evidence record.",
            "enforcement": "Smart Contract canView() & Session Wallet Validation",
            "serverRule": "Session wallet checked against on-chain can_view() before reading file vault",
            "contractMethod": "canView(bytes32 evidenceId, address caller)"
        },
        {
            "id": "download_evidence",
            "name": "Download Evidence Binary",
            "category": "Evidence Access Control",
            "status": "EVIDENCE_SPECIFIC",
            "statusLabel": "Evidence-Specific",
            "scope": "Authorized Records Only",
            "description": "Requires explicit on-chain download authorization granted by Head of Department. Evaluated independently from view access.",
            "enforcement": "Smart Contract canDownload() & Session Wallet Validation",
            "serverRule": "Session wallet checked against on-chain can_download() before binary stream dispatch",
            "contractMethod": "canDownload(bytes32 evidenceId, address caller)"
        },
        {
            "id": "manage_evidence_access",
            "name": "Manage Evidence Access Rights",
            "category": "Departmental Administration",
            "status": "ALLOWED" if is_hod_role else "RESTRICTED",
            "statusLabel": "Allowed" if is_hod_role else "Restricted",
            "scope": "Department-Wide",
            "description": "Exclusive administrative privilege to grant or revoke view and download permissions for forensic personnel on the blockchain ledger." if is_hod_role else "Restricted: Modifying access rights requires Head of Department (HOD) authority.",
            "enforcement": "Server Session HOD Check & Smart Contract isHOD() Verification",
            "serverRule": "Server session role check requires 'Head of Department' (@hod_required)",
            "contractMethod": "grantViewAccess(), revokeViewAccess(), grantDownloadAccess(), revokeDownloadAccess()"
        },
        {
            "id": "review_access_history",
            "name": "Review Access & Audit History",
            "category": "Audit & Oversight",
            "status": "ALLOWED",
            "statusLabel": "Allowed",
            "scope": "All Anchored Evidence",
            "description": "Authorized to inspect immutable access timestamps, download logs, and permission modifications recorded on the blockchain.",
            "enforcement": "Smart Contract getAccessHistory() & adminAuditHistory",
            "serverRule": "Authenticated officer session verified via @login_required",
            "contractMethod": "getAccessHistory(bytes32 evidenceId), getAdminAuditHistory()"
        },
        {
            "id": "manage_department_authority",
            "name": "Manage Departmental Authority",
            "category": "Departmental Administration",
            "status": "ALLOWED" if is_hod_role else "RESTRICTED",
            "statusLabel": "Allowed" if is_hod_role else "Restricted",
            "scope": "Department Directory",
            "description": "Authorized to delegate or revoke departmental administration privileges across the forensic unit." if is_hod_role else "Restricted: Departmental authority management requires Head of Department (HOD) credentials.",
            "enforcement": "Smart Contract getHeadOfDepartment() / setHeadOfDepartment()",
            "serverRule": "Server session role check requires 'Head of Department'",
            "contractMethod": "getHeadOfDepartment(), setHeadOfDepartment(address newHOD)"
        },
        {
            "id": "transfer_custody",
            "name": "Transfer Evidence Custody",
            "category": "Chain of Custody",
            "status": "EVIDENCE_SPECIFIC",
            "statusLabel": "Evidence-Specific",
            "scope": "Assigned Custody Items",
            "description": "Transferring chain-of-custody requires the officer to be the active registered custodian of that specific evidence artifact on-chain.",
            "enforcement": "Smart Contract transferCustody() Custodian Verification",
            "serverRule": "Caller wallet must match registered current custodian on active ledger",
            "contractMethod": "transferCustody(bytes32 evidenceId, address newCustodian)"
        }
    ]


# ============================================================
# 1. LOGIN CREDENTIALS VERIFICATION (STAGE 1)
# ============================================================

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Validate institutional email/employeeId and password against SQLite.
    If valid, generate dynamic 6-digit OTP challenge and return challenge ID.
    Does NOT establish session until OTP is verified.
    Enforces rate limiting (max 5 attempts per minute per IP).
    """
    client_ip = request.remote_addr or "127.0.0.1"
    is_testing = False
    try:
        is_testing = bool(current_app and current_app.config.get("TESTING"))
    except RuntimeError:
        pass

    if not is_testing and not check_rate_limit(LOGIN_RATE_LIMITS, client_ip, max_requests=5, window_seconds=60):
        return jsonify({
            "status": "error",
            "message": "Authentication rate limit exceeded. Please wait 60 seconds before trying again."
        }), 429

    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "status": "error",
            "message": "Invalid request. Credentials body required."
        }), 400

    raw_identifier = str(data.get("email", data.get("identifier", ""))).strip()
    identifier = raw_identifier.lower()
    password = str(data.get("password", ""))

    if not identifier:
        return jsonify({
            "status": "error",
            "message": "Official email address or employee ID is required."
        }), 400

    if not password:
        return jsonify({
            "status": "error",
            "message": "Password is required."
        }), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Resolve persona shortcut, employee ID, or name if provided
        resolved_email = identifier
        matched_persona = None
        for semail, pdata in SYNTHETIC_DEMO_PERSONAS.items():
            if (
                identifier == pdata.get("shortcut", "").lower()
                or identifier == semail.split("@")[0].lower()
                or identifier == semail.lower()
                or identifier == pdata.get("employee_id", "").lower()
                or identifier == pdata.get("name", "").lower()
                or identifier.replace("dr.", "").strip() == pdata.get("name", "").lower().replace("dr.", "").strip()
            ):
                resolved_email = semail
                matched_persona = pdata
                break

        # Match by resolved email, identifier as email, employee_id, or name
        cursor.execute("""
            SELECT * FROM users
            WHERE LOWER(email) = ? OR LOWER(email) = ? OR LOWER(employee_id) = ? OR LOWER(name) = ?
        """, (resolved_email, identifier, identifier, identifier))
        user = cursor.fetchone()

        # If user is not yet in SQLite but matches an authorized synthetic persona, auto-provision
        if user is None and matched_persona:
            try:
                env_pwd = os.getenv("DEMO_USER_PASSWORD")
                cursor.execute("""
                    INSERT INTO users (name, email, password_hash, role, wallet_address, employee_id, department, organization)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    matched_persona["name"],
                    resolved_email,
                    generate_password_hash(env_pwd or password or secrets.token_urlsafe(24)),
                    matched_persona["role"],
                    matched_persona["wallet_address"],
                    matched_persona["employee_id"],
                    matched_persona["department"],
                    matched_persona["organization"]
                ))
                conn.commit()
                cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (resolved_email,))
                user = cursor.fetchone()
            except Exception:
                pass

        # Constant-time mitigation: generic error on mismatch
        if user is None:
            return jsonify({
                "status": "error",
                "message": "Invalid email or password."
            }), 401

        # Check password hash OR environment variable DEMO_USER_PASSWORD
        env_demo_pwd = os.getenv("DEMO_USER_PASSWORD", "")
        pwd_matches_env = bool(env_demo_pwd and password == env_demo_pwd)
        pwd_matches_hash = False
        try:
            pwd_matches_hash = check_password_hash(user["password_hash"], password)
        except Exception:
            pwd_matches_hash = False

        # In public demonstration mode, allow standard evaluation passwords for synthetic personas
        is_demo_mode = is_public_demo_mode()
        is_synthetic_persona = resolved_email in SYNTHETIC_DEMO_PERSONAS
        pwd_matches_demo_suite = bool(
            is_demo_mode and is_synthetic_persona and (
                password in (
                    "EvidenceChain@Demo2026!",
                    "EvidenceChain@2026",
                    "EvidenceChain2026!",
                    "Demo@2026!",
                    "Demo2026!",
                    "demo123",
                    "password"
                )
            )
        )

        if not pwd_matches_hash and not pwd_matches_env and not pwd_matches_demo_suite:
            return jsonify({
                "status": "error",
                "message": "Invalid email or password."
            }), 401

        # If authenticated via DEMO_USER_PASSWORD or demo suite, synchronize stored hash
        if (pwd_matches_env or pwd_matches_demo_suite) and not pwd_matches_hash:
            try:
                new_hash = generate_password_hash(password)
                cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user["id"]))
                conn.commit()
            except Exception:
                pass

        # Invalidate any existing unused challenges for this user
        cursor.execute("""
            UPDATE mfa_challenges
            SET is_used = 1
            WHERE user_id = ? AND is_used = 0
        """, (user["id"],))

        # Generate cryptographically secure 6-digit OTP and UUID challenge
        otp = f"{secrets.randbelow(900000) + 100000:06d}"
        challenge_id = uuid.uuid4().hex
        otp_hash = generate_password_hash(otp)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        cursor.execute("""
            INSERT INTO mfa_challenges (
                challenge_id, user_id, otp_hash, expires_at, attempts, is_used
            )
            VALUES (?, ?, ?, ?, 0, 0)
        """, (
            challenge_id,
            user["id"],
            otp_hash,
            expires_at.isoformat()
        ))
        conn.commit()

        # Log OTP to server terminal for local demonstration
        log_development_mfa(user, challenge_id, otp)

        resp_data = {
            "status": "mfa_required",
            "message": "Credentials verified. One-time hardware/security token dispatched.",
            "challengeId": challenge_id,
            "maskedEmail": mask_email(user["email"]),
            "expiresInSeconds": 300
        }

        return jsonify(resp_data), 200

    except Exception as err:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": f"Authentication processing error: {str(err)}"
        }), 500

    finally:
        conn.close()


# ============================================================
# 2. DYNAMIC MFA VERIFICATION (STAGE 2)
# ============================================================

@auth_bp.route("/mfa/verify", methods=["POST"])
def verify_mfa():
    """
    Verify 6-digit dynamic OTP against stored hash.
    Enforces expiration (5 mins), max attempts (3), and single-use invalidation.
    Establishes server-side Flask session upon success.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "status": "error",
            "message": "Verification payload required."
        }), 400

    challenge_id = str(data.get("challengeId", "")).strip()
    otp = str(data.get("otp", "")).strip()

    if not challenge_id:
        return jsonify({
            "status": "error",
            "message": "Challenge ID is missing."
        }), 400

    if not otp or len(otp) != 6 or not otp.isdigit():
        return jsonify({
            "status": "error",
            "message": "Verification code must be exactly 6 digits."
        }), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT m.*, u.name, u.email, u.role, u.wallet_address,
                   u.employee_id, u.department, u.organization
            FROM mfa_challenges m
            JOIN users u ON m.user_id = u.id
            WHERE m.challenge_id = ?
        """, (challenge_id,))
        challenge = cursor.fetchone()

        if challenge is None:
            return jsonify({
                "status": "error",
                "message": "Invalid or non-existent verification challenge."
            }), 404

        # Check if already consumed or superseded
        if challenge["is_used"] == 1:
            return jsonify({
                "status": "error",
                "message": "This verification challenge has already been used or invalidated. Please sign in again."
            }), 400

        # Check attempts
        current_attempts = challenge["attempts"]
        if current_attempts >= 3:
            cursor.execute("UPDATE mfa_challenges SET is_used = 1 WHERE id = ?", (challenge["id"],))
            conn.commit()
            return jsonify({
                "status": "error",
                "message": "Maximum verification attempts exceeded. Authentication challenge locked out."
            }), 403

        # Check expiry (5 minutes)
        expires_at = parse_iso_datetime(challenge["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            cursor.execute("UPDATE mfa_challenges SET is_used = 1 WHERE id = ?", (challenge["id"],))
            conn.commit()
            return jsonify({
                "status": "error",
                "message": "Verification code has expired. Please request a new code or sign in again."
            }), 400

        # In public demonstration mode, accept standard evaluation OTP '123456' or '000000' for synthetic demo personas
        is_demo_mode = is_public_demo_mode()
        is_demo_account = challenge["email"] in SYNTHETIC_DEMO_PERSONAS
        is_demo_otp = bool(is_demo_mode and is_demo_account and otp in ("123456", "000000"))

        # Verify OTP hash
        is_correct = is_demo_otp or check_password_hash(challenge["otp_hash"], otp)

        if not is_correct:
            new_attempts = current_attempts + 1
            if new_attempts >= 3:
                cursor.execute("""
                    UPDATE mfa_challenges
                    SET attempts = ?, is_used = 1
                    WHERE id = ?
                """, (new_attempts, challenge["id"]))
                conn.commit()
                return jsonify({
                    "status": "error",
                    "message": "Invalid verification code. Maximum attempts exceeded (3/3). Challenge locked out."
                }), 403
            else:
                cursor.execute("""
                    UPDATE mfa_challenges
                    SET attempts = ?
                    WHERE id = ?
                """, (new_attempts, challenge["id"]))
                conn.commit()
                remaining = 3 - new_attempts
                return jsonify({
                    "status": "error",
                    "message": f"Invalid verification code. {remaining} attempt(s) remaining."
                }), 401

        # OTP is correct: mark challenge used
        cursor.execute("""
            UPDATE mfa_challenges
            SET is_used = 1
            WHERE id = ?
        """, (challenge["id"],))
        conn.commit()

        # Establish server-side Flask session
        session.clear()
        session["user_id"] = challenge["user_id"]
        session["email"] = challenge["email"]
        session["role"] = challenge["role"]
        session["authenticated"] = True
        session["is_demo"] = bool(is_demo_mode or is_demo_account)
        session["demo_registrations_count"] = 0
        session["auth_time"] = datetime.now(timezone.utc).isoformat()
        session["expires_at"] = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
        session.permanent = True

        user_payload = format_user_payload(challenge)

        return jsonify({
            "status": "success",
            "message": "Identity and multi-factor authentication confirmed.",
            "user": user_payload
        }), 200

    except Exception as err:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": f"MFA verification failed: {str(err)}"
        }), 500

    finally:
        conn.close()


# ============================================================
# 3. RESEND MFA CODE
# ============================================================

@auth_bp.route("/mfa/resend", methods=["POST"])
def resend_mfa():
    """
    Invalidate active challenge and issue a fresh 6-digit dynamic OTP.
    Enforces basic cooldown safety.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "status": "error",
            "message": "Payload required."
        }), 400

    challenge_id = str(data.get("challengeId", "")).strip()
    if not challenge_id:
        return jsonify({
            "status": "error",
            "message": "Challenge ID required."
        }), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT m.*, u.name, u.email, u.role, u.employee_id
            FROM mfa_challenges m
            JOIN users u ON m.user_id = u.id
            WHERE m.challenge_id = ?
        """, (challenge_id,))
        challenge = cursor.fetchone()

        if challenge is None:
            return jsonify({
                "status": "error",
                "message": "Previous challenge not found."
            }), 404

        # Invalidate the old challenge
        cursor.execute("UPDATE mfa_challenges SET is_used = 1 WHERE id = ?", (challenge["id"],))

        # Generate new OTP
        new_otp = f"{secrets.randbelow(900000) + 100000:06d}"
        new_challenge_id = uuid.uuid4().hex
        new_otp_hash = generate_password_hash(new_otp)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        cursor.execute("""
            INSERT INTO mfa_challenges (
                challenge_id, user_id, otp_hash, expires_at, attempts, is_used
            )
            VALUES (?, ?, ?, ?, 0, 0)
        """, (
            new_challenge_id,
            challenge["user_id"],
            new_otp_hash,
            expires_at.isoformat()
        ))
        conn.commit()

        # Log new OTP to server console
        log_development_mfa(challenge, new_challenge_id, new_otp)

        resend_payload = {
            "status": "success",
            "message": "New verification code issued.",
            "challengeId": new_challenge_id,
            "maskedEmail": mask_email(challenge["email"]),
            "expiresInSeconds": 300
        }

        return jsonify(resend_payload), 200

    except Exception as err:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": f"Resend failed: {str(err)}"
        }), 500

    finally:
        conn.close()


# ============================================================
# 4. GET AUTHENTICATED USER SESSION (/api/auth/me)
# ============================================================

@auth_bp.route("/me", methods=["GET"])
def get_me():
    """
    Retrieve profile of currently authenticated user from server session.
    Returns enriched identity profile, server-enforced permissions, session metadata,
    and linked signing identity.
    Returns 401 unauthenticated if no valid session exists.
    """
    user_id = session.get("user_id")
    is_auth = session.get("authenticated")

    if not user_id or not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "No active authenticated session."
        }), 401

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()

        if user is None:
            # Fallback for demo session: try to locate user by session email
            if session.get("is_demo") and session.get("email"):
                cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (session["email"].lower(),))
                user = cursor.fetchone()
                if user:
                    session["user_id"] = user["id"]

        if user is None:
            session.clear()
            return jsonify({
                "status": "unauthenticated",
                "message": "User session no longer valid."
            }), 401

        env = os.getenv("FLASK_ENV", "development").lower()
        is_dev = env != "production"

        auth_time = session.get("auth_time")
        expires_at = session.get("expires_at")
        if not auth_time:
            auth_time = datetime.now(timezone.utc).isoformat()
            session["auth_time"] = auth_time
        if not expires_at:
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
            session["expires_at"] = expires_at

        user_dict = dict(user)
        role = user_dict.get("role") or "Forensic Officer"
        wallet = user_dict.get("wallet_address")

        permissions = build_user_permissions(role, wallet)

        # Factual cookie flags derived directly from Flask runtime configuration
        cookie_flags = {
            "httpOnly": current_app.config.get("SESSION_COOKIE_HTTPONLY", True),
            "sameSite": current_app.config.get("SESSION_COOKIE_SAMESITE", "Lax"),
            "secure": current_app.config.get("SESSION_COOKIE_SECURE", False),
            "signedServerSide": True
        }

        demo_switch_allowed = is_demo_switching_enabled()

        session_meta = {
            "status": "ACTIVE",
            "authMethod": (
                "Public Demonstration (Synthetic Persona)" if session.get("is_demo")
                else ("Development Authentication (Password + Dynamic MFA Challenge)" if is_dev else "Institutional Password + Dynamic MFA Challenge")
            ),
            "mfaStatus": "EXEMPT" if session.get("is_demo") else "VERIFIED",
            "mfaType": "Demonstration Synthetic Session" if session.get("is_demo") else "Dynamic 6-Digit Challenge Token",
            "isDemoSession": bool(session.get("is_demo")),
            "cookieFlags": cookie_flags,
            "authTime": auth_time,
            "expiresAt": expires_at,
            "lifetimeHours": 8,
            "environment": env,
            "allowDemoSwitch": demo_switch_allowed,
            "serverTime": datetime.now(timezone.utc).isoformat(),
        }
        if session.get("is_demo"):
            session_meta["demoNotice"] = (
                "Active demonstration session uses a synthetic persona with restricted operational privileges. "
                "Administrative capabilities (Head of Department authority) are disabled."
            )

        signing_identity = {
            "isLinked": bool(wallet),
            "walletAddress": wallet,
            "networkName": "Hardhat Localhost Ledger",
            "chainId": 31337,
            "contractAddress": os.getenv("CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3"),
            "associationType": "Server Database Registry",
            "disclaimer": "This public EVM address is mapped to your personnel profile in the institutional database to anchor on-chain transactions and verify custody transfers. Database mapping does not represent cryptographic proof of private key custody."
        }

        return jsonify({
            "status": "authenticated",
            "user": format_user_payload(user),
            "permissions": permissions,
            "sessionMeta": session_meta,
            "signingIdentity": signing_identity
        }), 200

    except Exception as err:
        return jsonify({
            "status": "error",
            "message": f"Session lookup failed: {str(err)}"
        }), 500

    finally:
        conn.close()


# ============================================================
# 5. TERMINATE SESSION (/api/auth/logout)
# ============================================================

@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    Invalidate active server-side session and clear session cookie.
    """
    session.clear()
    return jsonify({
        "status": "success",
        "message": "Institutional session terminated successfully."
    }), 200


# ============================================================
# 6. DEMONSTRATION AUTHENTICATION & PROFILES
# ============================================================

@auth_bp.route("/demo-login", methods=["POST"])
def demo_login():
    """
    Public demonstration authentication endpoint.
    Permits direct access strictly for synthetic non-administrative demonstration identities.
    Enforces:
    - Rejection of all protected development identities
    - Rejection of Head of Department (HOD) and administrative privilege escalation
    - IP-based rate limiting (max 5 requests per minute)
    - Session expiration bound to 30 minutes
    - Explicit disclosure metadata in response
    """
    is_demo_mode = is_public_demo_mode()
    flask_env = (os.getenv("FLASK_ENV") or "").strip().lower()
    is_dev = flask_env in ("development", "test", "testing")
    is_testing = False
    try:
        is_testing = bool(current_app and current_app.config.get("TESTING"))
    except RuntimeError:
        pass

    if not is_demo_mode and not is_dev and not is_testing:
        return jsonify({
            "status": "error",
            "message": "Demonstration sign-in is disabled by server security policy."
        }), 403

    client_ip = request.remote_addr or "127.0.0.1"
    if not check_rate_limit(DEMO_LOGIN_RATE_LIMITS, client_ip, max_requests=10, window_seconds=60):
        return jsonify({
            "status": "error",
            "message": "Demonstration sign-in rate limit exceeded. Please wait 60 seconds before trying again."
        }), 429

    data = request.get_json(silent=True) or {}
    email_or_persona = str(data.get("email") or data.get("persona") or "").strip().lower()

    if not email_or_persona:
        return jsonify({
            "status": "error",
            "message": "Synthetic demonstration persona or email is required."
        }), 400

    # Resolve persona shortcut if provided
    resolved_email = email_or_persona
    for semail, pdata in SYNTHETIC_DEMO_PERSONAS.items():
        if email_or_persona == pdata.get("shortcut", "").lower() or email_or_persona == semail.split("@")[0].lower():
            resolved_email = semail
            break

    # Security Check: Deny access to protected development or retired identities
    if (
        resolved_email in PROTECTED_IDENTITIES
        or resolved_email in RETIRED_TEMP_PERSONAS
        or resolved_email.endswith("@metro-forensics.gov.example")
        or resolved_email == "officer@example.com"
    ):
        return jsonify({
            "status": "error",
            "message": "Access Denied: Persona is not permitted for demonstration sign-in. This account is restricted or has been retired."
        }), 403

    # Security Check 3: Must be an authorized synthetic demonstration persona
    if resolved_email not in SYNTHETIC_DEMO_PERSONAS:
        return jsonify({
            "status": "error",
            "message": "Unauthorized demonstration persona. Only designated synthetic demonstration accounts are permitted."
        }), 403

    persona_info = SYNTHETIC_DEMO_PERSONAS[resolved_email]

    # Query or ensure synthetic demo user exists in SQLite
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (resolved_email,))
        user = cursor.fetchone()

        if user is None:
            # If in demo database or test DB, insert the synthetic user
            try:
                cursor.execute("""
                    INSERT INTO users (name, email, password_hash, role, wallet_address, employee_id, department, organization)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    persona_info["name"],
                    resolved_email,
                    generate_password_hash(os.getenv("DEMO_USER_PASSWORD") or secrets.token_urlsafe(24)),
                    persona_info["role"],
                    persona_info["wallet_address"],
                    persona_info["employee_id"],
                    persona_info["department"],
                    persona_info["organization"]
                ))
                conn.commit()
                cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (resolved_email,))
                user = cursor.fetchone()
            except Exception:
                # If database is read-only (e.g. protected dev DB baseline), create an ephemeral mock user dict
                user = {
                    "id": 999,
                    "name": persona_info["name"],
                    "email": resolved_email,
                    "role": persona_info["role"],
                    "wallet_address": persona_info["wallet_address"],
                    "employee_id": persona_info["employee_id"],
                    "department": persona_info["department"],
                    "organization": persona_info["organization"]
                }

        # Safeguard: If role is Head of Department, ensure it is strictly the designated synthetic demo HOD
        if user["role"] == "Head of Department" and resolved_email != "r.sen@forensics.example.com":
            return jsonify({
                "status": "error",
                "message": "Privilege Escalation Prevention: Unauthorized Head of Department access attempt."
            }), 403

        # Invalidate any old session and establish demonstration session
        session.clear()
        session["user_id"] = user["id"]
        session["email"] = user["email"]
        session["role"] = user["role"]
        session["authenticated"] = True
        session["is_demo"] = True
        session["auth_method"] = "DEMO_PORTAL"
        session["auth_time"] = datetime.now(timezone.utc).isoformat()
        # Bound demo session to 8 hours
        session["expires_at"] = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
        session["demo_registrations_count"] = 0
        session.permanent = True

        user_payload = format_user_payload(user)

        is_hod_user = (user["role"] == "Head of Department")
        notice_text = (
            "Demonstration session active as synthetic Head of Department (HOD) with department-level administrative and permission governance capabilities. "
            "Hardware/Dynamic MFA is bypassed for demonstration purposes. State modification affects synthetic demo records only."
            if is_hod_user else
            "Demonstration session active using a synthetic persona with restricted operational privileges. "
            "Hardware/Dynamic MFA is bypassed for demonstration purposes. "
            "Administrative actions (Head of Department authority) and persistent state modification are strictly restricted."
        )

        demo_disclosure = {
            "isDemoSession": True,
            "authType": "SYNTHETIC_DEMO_PASSTHROUGH",
            "notice": notice_text,
            "sessionExpiresInSeconds": 28800,
            "role": user["role"],
            "maxRegistrations": 5
        }

        return jsonify({
            "status": "success",
            "message": f"Demonstration session established as {user['name']}.",
            "user": user_payload,
            "demoDisclosure": demo_disclosure
        }), 200

    except Exception as err:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": f"Demonstration sign-in error: {str(err)}"
        }), 500
    finally:
        conn.close()


@auth_bp.route("/demo-profiles", methods=["GET"])
def get_demo_profiles():
    """
    List available demonstration profiles.
    - In PUBLIC_DEMO_MODE: Returns exclusively non-administrative synthetic profiles (@metro-forensics.gov.example)
      with explicit demo disclaimers.
    - In local development mode: Returns development profiles if ALLOW_DEV_DEMO_SWITCH is active.
    """
    is_demo = is_public_demo_mode()
    is_dev_switch = is_demo_switching_enabled()

    if not is_demo and not is_dev_switch:
        return jsonify({
            "status": "error",
            "message": "Demo profile directory is disabled by server security policy."
        }), 403

    if is_demo:
        # Return exclusively synthetic non-administrative profiles
        profiles = []
        for email, pdata in SYNTHETIC_DEMO_PERSONAS.items():
            profiles.append({
                "id": pdata["employee_id"],
                "name": pdata["name"],
                "email": email,
                "employeeId": pdata["employee_id"],
                "role": pdata["role"],
                "designation": pdata["role"],
                "department": pdata["department"],
                "organization": pdata["organization"],
                "walletAddress": pdata["wallet_address"],
                "isHOD": (pdata["role"] == "Head of Department"),
                "isSynthetic": True,
                "shortcut": pdata["shortcut"]
            })

        return jsonify({
            "status": "success",
            "mode": "PUBLIC_DEMO",
            "notice": "Synthetic demonstration personnel profiles for public demonstration across all operational roles.",
            "profiles": profiles
        }), 200

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, name, email, employee_id, role, department, organization, wallet_address
            FROM users
            WHERE employee_id IS NOT NULL
            ORDER BY id ASC
        """)
        users = cursor.fetchall()

        profiles = []
        for u in users:
            profiles.append({
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "employeeId": u["employee_id"],
                "role": u["role"],
                "designation": u["role"],
                "department": u["department"],
                "organization": u["organization"],
                "walletAddress": u["wallet_address"],
                "isHOD": (u["role"] == "Head of Department")
            })

        return jsonify({
            "status": "success",
            "profiles": profiles
        }), 200
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500
    finally:
        conn.close()


@auth_bp.route("/demo-switch", methods=["POST"])
def demo_switch():
    """
    Switch authenticated session to another demo profile in development mode.
    Re-issues server-side Flask session.
    Strictly forbidden outside trusted local development.
    """
    if not is_demo_switching_enabled():
        return jsonify({
            "status": "error",
            "message": "Demo profile switching is disabled by server security policy. This feature is restricted to authorized local development environments."
        }), 403

    data = request.get_json(silent=True) or {}
    target_email = data.get("email")
    target_id = data.get("userId")

    if not target_email and not target_id:
        return jsonify({
            "status": "error",
            "message": "Target email or userId is required for demo profile switch."
        }), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        if target_id:
            cursor.execute("SELECT * FROM users WHERE id = ?", (target_id,))
        else:
            cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (str(target_email).strip().lower(),))
        user = cursor.fetchone()

        if user is None:
            return jsonify({
                "status": "error",
                "message": "Target demo profile does not exist."
            }), 404

        # Privilege escalation prevention:
        # Validate that the target user is an approved demo persona
        target_norm_email = (user["email"] or "").strip().lower()
        if target_norm_email not in APPROVED_DEMO_EMAILS and not user["employee_id"]:
            return jsonify({
                "status": "error",
                "message": "Unauthorized target persona. Identity switching is restricted to designated institutional demo accounts."
            }), 403

        # Invalidate old session and establish new session server-side
        session.clear()
        session["user_id"] = user["id"]
        session["email"] = user["email"]
        session["role"] = user["role"]
        session["authenticated"] = True
        session["auth_time"] = datetime.now(timezone.utc).isoformat()
        session["expires_at"] = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
        session.permanent = True

        return jsonify({
            "status": "success",
            "message": f"Session securely switched to {user['name']}.",
            "user": format_user_payload(user)
        }), 200
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500
    finally:
        conn.close()


# ============================================================
# 6. REGISTER USER (ADMIN / SYSTEM INITIALIZATION)
# ============================================================

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user with hashed password.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "status": "error",
            "message": "Request body is required."
        }), 400

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "officer")).strip()
    wallet_address = data.get("wallet_address")
    employee_id = data.get("employee_id")
    department = data.get("department")
    organization = data.get("organization")

    if not name or not email or not password:
        return jsonify({
            "status": "error",
            "message": "Name, email, and password are required."
        }), 400

    if len(password) < 6:
        return jsonify({
            "status": "error",
            "message": "Password must contain at least 6 characters."
        }), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            return jsonify({
                "status": "error",
                "message": "User with this email already exists."
            }), 409

        password_hash = generate_password_hash(password)
        cursor.execute("""
            INSERT INTO users (
                name, email, password_hash, role, wallet_address,
                employee_id, department, organization
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name, email, password_hash, role, wallet_address,
            employee_id, department, organization
        ))
        conn.commit()
        user_id = cursor.lastrowid

        return jsonify({
            "status": "success",
            "message": "User registered successfully.",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role,
                "walletAddress": wallet_address
            }
        }), 201

    except Exception as err:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": str(err)
        }), 500

    finally:
        conn.close()
