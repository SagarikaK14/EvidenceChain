import os
os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
from flask import Flask, request, jsonify, send_file, session, current_app
from flask_cors import CORS
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from dotenv import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix
import re
import mimetypes

# Load environment configuration: prioritize .env.demo in demo deployments, fallback to .env
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

from blockchain import (
    get_evidence,
    register_evidence,
    verify_evidence,
    can_view,
    can_download,
    grant_view_access,
    revoke_view_access,
    grant_download_access,
    revoke_download_access,
    record_access,
    get_access_history,
    get_head_of_department,
    is_hod,
    get_department_members,
    get_admin_audit_history,
    is_evidence_on_chain,
    audit_evidence_ledger_status,
    connect_to_blockchain,
    extract_clean_error,
    EvidenceNotFoundError,
    LedgerExecutionError
)

from database.db import (
    get_db,
    save_evidence,
    save_admin_audit_log,
    get_db_admin_audit_log,
    init_db,
    seed_demo_users,
    seed_demo_case_hierarchies,
    get_all_cases_with_stats,
    get_case_assignments_list,
    build_case_hierarchy_tree_structure,
    check_circular_reporting,
    add_case_assignment,
    update_case_assignment,
    remove_case_assignment,
    get_case_hierarchy_audit_log
)

from auth import auth_bp
from diagnostics import diagnostics_bp


# ============================================================
# APP CONFIGURATION & SESSION MANAGEMENT
# ============================================================

app = Flask(__name__)

# Secret key for server-side signed session cookies
app.secret_key = os.getenv(
    "SECRET_KEY",
    "evidencechain-forensic-secret-key-31337-change-in-production"
)

# Enforce secure cookie attributes & upload bounds
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = (
    os.getenv("SESSION_COOKIE_SECURE", "").strip().lower() in ("true", "1", "yes")
    or os.getenv("FLASK_ENV") == "production"
    or os.getenv("PUBLIC_DEMO_MODE", "").strip().lower() in ("true", "1", "yes")
)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB maximum upload bound

def get_public_demo_origin():
    """
    Returns the explicitly configured PUBLIC_DEMO_ORIGIN if set and valid.
    Reads from environment or dynamically from .env.demo.
    Strictly validates format: https://<subdomain>.trycloudflare.com (or explicit loopback override).
    Never permits wildcard trycloudflare domains.
    """
    origin = os.getenv("PUBLIC_DEMO_ORIGIN", "").strip()
    demo_env = os.getenv("DEMO_ENV_FILE") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.demo"
    )
    if os.path.exists(demo_env):
        try:
            with open(demo_env, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("PUBLIC_DEMO_ORIGIN="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            origin = val
                        break
        except Exception:
            pass

    if origin:
        if re.match(r"^https://[a-zA-Z0-9-]+\.trycloudflare\.com$", origin):
            return origin
        if re.match(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$", origin):
            return origin
    return None

# Dynamic Secure Session Cookie interface: enforces Secure when behind HTTPS, HttpOnly and SameSite=Lax always
class DynamicSecureSessionInterface(app.session_interface.__class__):
    def get_cookie_httponly(self, app):
        return True

    def get_cookie_samesite(self, app):
        return "Lax"

    def get_cookie_secure(self, app):
        if os.getenv("SESSION_COOKIE_SECURE", "").strip().lower() in ("true", "1", "yes"):
            return True
        try:
            if request and request.is_secure:
                return True
        except Exception:
            pass
        return False

app.session_interface = DynamicSecureSessionInterface()

# Apply ProxyFix for trusted reverse proxy headers (X-Forwarded-For, Proto, Host)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# In-memory registration rate limiter store (user_or_ip -> list of epoch seconds)
REGISTRATION_RATE_LIMITS = {}

@app.before_request
def enforce_session_expiration_and_csrf():
    """
    1. Enforce strict Host header validation against allowed loopback & exact PUBLIC_DEMO_ORIGIN.
    2. Enforce server-side session expiration across all routes.
    3. Enforce CSRF Origin / Referer validation on state-changing methods.
    """
    # 0. Strict Host Header Validation (Prevent Host-Header Injection & Unknown Hosts)
    host_header = (request.host or "").lower()
    allowed_hosts = {
        "127.0.0.1:5101",
        "localhost:5101",
        "127.0.0.1:8080",
        "localhost:8080",
        "127.0.0.1:5001",
        "localhost:5001",
        "127.0.0.1:5173",
        "localhost:5173",
        "127.0.0.1",
        "localhost",
        "testserver",
        "localhost.localdomain"
    }
    server_name = app.config.get("SERVER_NAME")
    if server_name:
        allowed_hosts.add(server_name.lower())

    pub_origin = get_public_demo_origin()
    if pub_origin:
        parsed_pub = urlparse(pub_origin)
        if parsed_pub.netloc:
            allowed_hosts.add(parsed_pub.netloc.lower())

    host_without_port = host_header.split(":")[0]
    if host_header not in allowed_hosts and host_without_port not in allowed_hosts:
        return jsonify({
            "status": "error",
            "message": f"Host validation failed: Unexpected Host header '{request.host}'."
        }), 400

    # 1. Check session expiration
    if session.get("authenticated") and session.get("expires_at"):
        try:
            exp_str = session["expires_at"].replace("Z", "+00:00")
            exp_dt = datetime.fromisoformat(exp_str)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                session.clear()
                if request.path.startswith("/api/"):
                    return jsonify({
                        "status": "unauthenticated",
                        "message": "Session has expired. Please sign in again."
                    }), 401
        except Exception:
            session.clear()

    # 2. CSRF Origin & Referer Defense on state-changing methods
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        is_testing = app.config.get("TESTING", False)
        if not is_testing:
            origin = request.headers.get("Origin")
            referer = request.headers.get("Referer")

            # Negative Check: Reject state-changing requests missing both Origin and Referer
            if not origin and not referer:
                return jsonify({
                    "status": "error",
                    "message": "CSRF validation failed: Missing required Origin or Referer header on state-changing request."
                }), 403

            # Determine whether current request arrived via public demo host or loopback host
            is_public_host = False
            if pub_origin:
                parsed_pub = urlparse(pub_origin)
                pub_netloc = (parsed_pub.netloc or "").lower()
                is_public_host = (host_header == pub_netloc or host_without_port == pub_netloc)

            # Determine authorized origins specifically for this effective host
            if is_public_host:
                host_allowed_origins = {pub_origin.rstrip("/").lower()}
            else:
                host_allowed_origins = {
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:5001",
                    "http://127.0.0.1:5001",
                    "http://localhost:5101",
                    "http://127.0.0.1:5101",
                    "http://localhost:8080",
                    "http://127.0.0.1:8080"
                }

            if origin:
                parsed_origin = urlparse(origin)
                if not parsed_origin.scheme or not parsed_origin.netloc or parsed_origin.scheme not in ("http", "https"):
                    return jsonify({
                        "status": "error",
                        "message": "CSRF validation failed: Malformed Origin header."
                    }), 400

                normalized_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}".lower()
                if normalized_origin not in host_allowed_origins:
                    return jsonify({
                        "status": "error",
                        "message": f"CSRF validation failed: Request origin '{origin}' is not authorized for host '{request.host}'."
                    }), 403

            elif referer:
                parsed_ref = urlparse(referer)
                if not parsed_ref.scheme or not parsed_ref.netloc or parsed_ref.scheme not in ("http", "https"):
                    return jsonify({
                        "status": "error",
                        "message": "CSRF validation failed: Malformed Referer header."
                    }), 400

                normalized_ref = f"{parsed_ref.scheme}://{parsed_ref.netloc}".lower()
                if normalized_ref not in host_allowed_origins:
                    return jsonify({
                        "status": "error",
                        "message": f"CSRF validation failed: Referer origin '{referer}' is not authorized for host '{request.host}'."
                    }), 403

def is_cors_origin_allowed(origin):
    if not origin:
        return False
    parsed = urlparse(origin)
    normalized = f"{parsed.scheme}://{parsed.netloc}".lower()
    allowed = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5001",
        "http://127.0.0.1:5001",
        "http://localhost:5101",
        "http://127.0.0.1:5101",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    }
    pub = get_public_demo_origin()
    if pub:
        allowed.add(pub.rstrip("/").lower())
    return normalized in allowed

# Configure dynamic CORS origin validation with credentials support
CORS(
    app,
    supports_credentials=True,
    origins=is_cors_origin_allowed
)

@app.after_request
def set_security_headers(response):
    """
    Harden HTTP response headers with standard defense-in-depth protections.
    """
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type, Content-Length"
    return response

# Register institutional authentication blueprint
app.register_blueprint(auth_bp)

# Register system health & diagnostics blueprint
app.register_blueprint(diagnostics_bp)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.getenv(
    "UPLOAD_FOLDER",
    os.path.join(BASE_DIR, "uploads")
)

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Standard JSON error handlers for production reliability
@app.errorhandler(404)
def handle_404(e):
    return jsonify({"status": "error", "message": "Resource not found."}), 404

@app.errorhandler(400)
def handle_400(e):
    desc = getattr(e, "description", "Bad request.")
    return jsonify({"status": "error", "message": desc}), 400

@app.errorhandler(413)
def handle_413(e):
    return jsonify({
        "status": "error",
        "message": "Payload Too Large: Evidence file exceeds maximum permitted size of 10 MB."
    }), 413

@app.errorhandler(500)
def handle_500(e):
    return jsonify({"status": "error", "message": "An internal server error occurred."}), 500

# Initialize database schema and seed demo accounts on startup
try:
    init_db()
    seed_demo_case_hierarchies()
    if os.getenv("DEMO_USER_PASSWORD"):
        seed_demo_users()
    else:
        print("[EvidenceChain Startup Notice] DEMO_USER_PASSWORD not configured. Demo personas remain unseeded until explicitly configured.")
except Exception as _startup_err:
    print(f"[EvidenceChain Startup Notice] DB init: {_startup_err}")


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_sha256(file_path):
    """
    Calculate SHA-256 hash of a file.
    """

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:

        while True:

            chunk = file.read(8192)

            if not chunk:
                break

            sha256.update(chunk)

    return sha256.hexdigest()


def generate_evidence_id():
    """
    Generate a unique EvidenceChain evidence ID.
    """

    return (
        "EVD-"
        + uuid.uuid4().hex[:8].upper()
    )


def get_request_address(data, field_name="userAddress"):
    """
    Extract a blockchain address from request data.
    """

    if not data:

        return ""

    return str(
        data.get(
            field_name,
            ""
        )
    ).strip()


# ============================================================
# GET OFF-CHAIN FILE METADATA
# ============================================================

def get_evidence_metadata_for_file(evidence_id):
    connection = get_db()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            evidence_id,
            case_id,
            title,
            description,
            file_path,
            sha256_hash,
            registered_by,
            blockchain_evidence_id,
            registration_tx_hash
        FROM evidence
        WHERE evidence_id = ?
    """, (evidence_id,))

    row = cursor.fetchone()
    connection.close()

    if row:
        return dict(row)

    return None


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    return jsonify({

        "status": "ok",

        "service": (
            "EvidenceChain Backend"
        )
    })


# ============================================================
# LIST ALL EVIDENCE
# ============================================================

@app.route(
    "/api/evidence",
    methods=["GET"]
)
def list_evidence_route():

    try:
        connection = get_db()
        cursor = connection.cursor()

        cursor.execute("SELECT id, name, email, wallet_address FROM users")
        user_rows = cursor.fetchall()
        user_map = {u["id"]: u for u in user_rows}

        cursor.execute(
            """
            SELECT
                evidence_id,
                case_id,
                title,
                description,
                file_path,
                sha256_hash,
                registered_by,
                blockchain_evidence_id,
                registration_tx_hash,
                created_at
            FROM evidence
            ORDER BY id DESC
            """
        )

        rows = cursor.fetchall()
        connection.close()

        evidence_list = []
        active_count = 0
        historical_count = 0
        never_anchored_count = 0
        pending_count = 0
        unavailable_count = 0

        # Reuse single connection instance across rows for optimal performance
        shared_web3, shared_contract = None, None
        try:
            shared_web3, shared_contract = connect_to_blockchain()
        except Exception:
            pass

        for row in rows:
            ev_id = row[0]
            file_name = (
                row[2] or
                (os.path.basename(row[4]) if row[4] else "evidence.bin")
            )
            audit = audit_evidence_ledger_status(
                ev_id,
                db_hash=row[5],
                registration_tx_hash=row[8],
                blockchain_evidence_id=row[7],
                web3=shared_web3,
                contract=shared_contract
            )

            if audit["status"] == "VERIFIED_ACTIVE":
                active_count += 1
            elif audit["status"] == "HISTORICAL_RECORD":
                historical_count += 1
            elif audit["status"] == "NEVER_ANCHORED":
                never_anchored_count += 1
            elif audit["status"] == "PENDING_VERIFICATION":
                pending_count += 1
            else:
                unavailable_count += 1

            reg_raw = row[6]
            if isinstance(reg_raw, int) and reg_raw in user_map:
                registered_by_str = user_map[reg_raw]["wallet_address"] or user_map[reg_raw]["email"] or str(reg_raw)
            elif reg_raw is not None and str(reg_raw).strip():
                registered_by_str = str(reg_raw).strip()
            else:
                registered_by_str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

            evidence_list.append({
                "evidenceId": ev_id,
                "caseId": row[1],
                "title": file_name,
                "description": row[3] or "",
                "filePath": row[4],
                "sha256Hash": row[5],
                "registeredBy": registered_by_str,
                "blockchainEvidenceId": row[7] or row[0],
                "registrationTxHash": row[8],
                "createdAt": row[9],
                "isOnChain": audit["isOnChain"],
                "isHistorical": audit["isHistorical"],
                "ledgerStatus": audit["status"],
                "ledgerStatusLabel": audit["label"],
                "activeChainId": audit["activeChainId"],
                "contractAddress": audit["contractAddress"]
            })

        return jsonify({
            "status": "success",
            "count": len(evidence_list),
            "totalCount": len(evidence_list),
            "activeLedgerCount": active_count,
            "historicalCount": historical_count,
            "neverAnchoredCount": never_anchored_count,
            "pendingCount": pending_count,
            "unavailableCount": unavailable_count,
            "evidence": evidence_list
        })

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


# ============================================================
# GET EVIDENCE
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>",
    methods=["GET"]
)
def get_evidence_route(evidence_id):

    try:
        connection = get_db()
        cursor = connection.cursor()

        cursor.execute("SELECT id, name, email, wallet_address FROM users")
        user_rows = cursor.fetchall()
        user_map = {u["id"]: u for u in user_rows}

        cursor.execute(
            """
            SELECT
                evidence_id,
                case_id,
                title,
                description,
                file_path,
                sha256_hash,
                registered_by,
                blockchain_evidence_id,
                registration_tx_hash,
                current_custodian
            FROM evidence
            WHERE evidence_id = ?
            """,
            (evidence_id,)
        )

        row = cursor.fetchone()
        connection.close()

        blockchain_data = None
        try:
            blockchain_data = get_evidence(evidence_id)
        except Exception:
            blockchain_data = None

        if not row and not blockchain_data:
            return jsonify({
                "status": "error",
                "message": f"Evidence record '{evidence_id}' does not exist."
            }), 404

        database_data = None
        if row:
            database_data = {
                "evidenceId": row[0],
                "caseId": row[1],
                "title": row[2],
                "description": row[3],
                "filePath": row[4],
                "sha256Hash": row[5],
                "registeredBy": row[6],
                "blockchainEvidenceId": row[7],
                "registrationTxHash": row[8],
                "currentCustodian": row[9]
            }

        audit = audit_evidence_ledger_status(
            evidence_id,
            db_hash=row[5] if row else None,
            registration_tx_hash=row[8] if row else None,
            blockchain_evidence_id=row[7] if row else None
        )

        if blockchain_data:
            evidence_payload = dict(blockchain_data)
            evidence_payload["isOnChain"] = audit["isOnChain"]
            evidence_payload["isHistorical"] = audit["isHistorical"]
            evidence_payload["ledgerStatus"] = audit["status"]
            evidence_payload["ledgerStatusLabel"] = audit["label"]
        elif database_data:
            evidence_payload = {
                "evidenceId": database_data["evidenceId"],
                "caseId": database_data["caseId"],
                "evidenceHash": database_data["sha256Hash"],
                "registeredBy": database_data["registeredBy"],
                "timestamp": None,
                "exists": False,
                "isHistorical": True,
                "isOnChain": False,
                "ledgerStatus": audit["status"],
                "ledgerStatusLabel": audit["label"]
            }
        else:
            evidence_payload = None

        return jsonify({
            "status": "success",
            "evidence": evidence_payload,
            "database": database_data,
            "isOnChain": audit["isOnChain"],
            "isHistorical": audit["isHistorical"],
            "ledgerStatus": audit["status"],
            "ledgerStatusLabel": audit["label"],
            "activeChainId": audit["activeChainId"],
            "contractAddress": audit["contractAddress"]
        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# REGISTER EVIDENCE
# ============================================================

@app.route(
    "/api/evidence/register",
    methods=["POST"]
)
def register_evidence_route():

    try:
        # ----------------------------------------------------
        # AUTHENTICATION & ACCESS CONTROL CHECK
        # ----------------------------------------------------
        if not session.get("authenticated") and not app.config.get("TESTING"):
            return jsonify({
                "status": "unauthenticated",
                "message": "Authentication required: Please sign in to register forensic evidence."
            }), 401

        # ----------------------------------------------------
        # RATE LIMITING & DEMONSTRATION QUOTA ENFORCEMENT
        # ----------------------------------------------------
        client_key = f"reg_{session.get('user_id', request.remote_addr or '127.0.0.1')}"
        now_ts = datetime.now(timezone.utc).timestamp()
        reg_timestamps = [t for t in REGISTRATION_RATE_LIMITS.get(client_key, []) if now_ts - t < 60]
        if len(reg_timestamps) >= 3 and not app.config.get("TESTING"):
            return jsonify({
                "status": "error",
                "message": "Registration rate limit exceeded: Maximum 3 registrations permitted per minute. Please wait."
            }), 429

        if session.get("is_demo"):
            demo_count = session.get("demo_registrations_count", 0)
            if demo_count >= 5:
                return jsonify({
                    "status": "error",
                    "message": "Demonstration quota reached: You have reached the maximum allowance of 5 evidence registrations per demonstration session."
                }), 403

        # ----------------------------------------------------
        # CONTENT LENGTH BOUND CHECK (10 MB)
        # ----------------------------------------------------
        if request.content_length and request.content_length > 10 * 1024 * 1024:
            return jsonify({
                "status": "error",
                "message": "Payload Too Large: Evidence file exceeds 10 MB limit."
            }), 413

        # ----------------------------------------------------
        # CHECK FILE
        # ----------------------------------------------------

        if "file" not in request.files:

            return jsonify({

                "status": "error",

                "message": (
                    "No evidence file provided."
                )
            }), 400

        uploaded_file = request.files[
            "file"
        ]

        if uploaded_file.filename == "":

            return jsonify({

                "status": "error",

                "message": (
                    "No evidence file selected."
                )
            }), 400

        # ----------------------------------------------------
        # GET FORM DATA
        # ----------------------------------------------------

        case_id = request.form.get(
            "caseId",
            ""
        ).strip()

        description = request.form.get(
            "description",
            ""
        ).strip()

        if not case_id:

            return jsonify({

                "status": "error",

                "message": (
                    "Case ID is required."
                )
            }), 400

        # ----------------------------------------------------
        # GENERATE EVIDENCE ID
        # ----------------------------------------------------

        evidence_id = generate_evidence_id()

        # ----------------------------------------------------
        # SAVE FILE
        # ----------------------------------------------------

        original_filename = (
            uploaded_file.filename
        )

        safe_filename = (
            evidence_id
            + "_"
            + original_filename
        )

        file_path = os.path.join(
            app.config["UPLOAD_FOLDER"],
            safe_filename
        )

        uploaded_file.save(
            file_path
        )

        if os.path.getsize(file_path) > 10 * 1024 * 1024:
            try:
                os.remove(file_path)
            except Exception:
                pass
            return jsonify({
                "status": "error",
                "message": "Payload Too Large: Evidence file exceeds maximum permitted size of 10 MB."
            }), 413

        # ----------------------------------------------------
        # CALCULATE SHA-256 AND VERIFY CLIENT HASH
        # ----------------------------------------------------

        evidence_hash = calculate_sha256(
            file_path
        )

        client_hash = request.form.get(
            "clientHash",
            ""
        ).strip().lower()

        if client_hash and client_hash != evidence_hash.lower():
            try:
                os.remove(file_path)
            except Exception:
                pass
            return jsonify({
                "status": "error",
                "message": (
                    f"Integrity check failed: Client hash ({client_hash[:12]}...) "
                    f"does not match server digest ({evidence_hash[:12]}...). "
                    "File may have corrupted in transit."
                )
            }), 400

        # ----------------------------------------------------
        # REGISTER ON BLOCKCHAIN
        # ----------------------------------------------------

        blockchain_result = register_evidence(

            evidence_id,

            case_id,

            evidence_hash
        )

        registered_by = (
            blockchain_result.get(
                "registeredBy"
            )
        )

        # ----------------------------------------------------
        # SAVE METADATA IN SQLITE
        #
        # current_custodian is retained only because the
        # existing database schema contains this column.
        #
        # It now represents the original registering owner
        # rather than a transferable custody owner.
        # ----------------------------------------------------

        save_evidence(

            evidence_id=evidence_id,

            case_id=case_id,

            title=original_filename,

            description=description,

            file_path=file_path,

            sha256_hash=evidence_hash,

            registered_by=registered_by,

            blockchain_evidence_id=evidence_id,

            registration_tx_hash=(
                blockchain_result[
                    "transactionHash"
                ]
            ),

            current_custodian=registered_by
        )

        # ----------------------------------------------------
        # UPDATE RATE LIMIT & DEMO REGISTRATION QUOTA
        # ----------------------------------------------------
        reg_timestamps.append(now_ts)
        REGISTRATION_RATE_LIMITS[client_key] = reg_timestamps
        if session.get("is_demo"):
            session["demo_registrations_count"] = session.get("demo_registrations_count", 0) + 1

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "message": (
                "Evidence registered "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "caseId": case_id,

            "description": description,

            "fileName": original_filename,

            "evidenceHash": evidence_hash,

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            ),

            "registeredBy": registered_by

        }), 201

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# VERIFY EVIDENCE
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/verify",
    methods=["POST"]
)
def verify_evidence_route(evidence_id):

    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "Request body is required."
            }), 400

        current_hash = (
            data.get("currentHash") or data.get("hash") or ""
        ).strip().lower()
        if not current_hash:
            return jsonify({
                "status": "error",
                "message": "Current hash is required."
            }), 400

        # Query SQLite metadata
        connection = get_db()
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT sha256_hash, case_id, title, registration_tx_hash, blockchain_evidence_id
            FROM evidence
            WHERE evidence_id = ?
            """,
            (evidence_id,)
        )
        row = cursor.fetchone()
        connection.close()

        blockchain_data = None
        try:
            blockchain_data = get_evidence(evidence_id)
        except Exception:
            blockchain_data = None

        if not row and not blockchain_data:
            return jsonify({
                "status": "error",
                "message": f"Evidence record '{evidence_id}' does not exist in register."
            }), 404

        audit = audit_evidence_ledger_status(
            evidence_id,
            db_hash=row[0] if row else None,
            registration_tx_hash=row[3] if row else None,
            blockchain_evidence_id=row[4] if row else None
        )

        stored_hash = (
            blockchain_data["evidenceHash"].lower()
            if blockchain_data and blockchain_data.get("evidenceHash")
            else (row[0].lower() if row else "")
        )

        file_digest_matches = (current_hash == stored_hash)

        if audit["status"] == "VERIFIED_ACTIVE":
            is_authentic = file_digest_matches
            result = "AUTHENTIC" if is_authentic else "TAMPERED"
            msg = (
                "Candidate file digest matches authoritative active blockchain anchor byte-for-byte."
                if is_authentic
                else "Candidate file digest diverges from the anchor recorded on the blockchain."
            )
        elif audit["status"] == "HISTORICAL_RECORD":
            is_authentic = file_digest_matches
            result = "AUTHENTIC_HISTORICAL" if is_authentic else "TAMPERED"
            msg = (
                "Candidate file digest matches recorded SQLite intake hash. Active blockchain anchor is unavailable on this ephemeral ledger session."
                if is_authentic
                else "Candidate file digest diverges from the recorded intake hash."
            )
        else:
            is_authentic = False
            result = "UNAVAILABLE"
            msg = "Blockchain verification service is currently unavailable."

        return jsonify({
            "status": "success",
            "evidenceId": evidence_id,
            "result": result,
            "isAuthentic": is_authentic,
            "fileDigestMatches": file_digest_matches,
            "onChainVerified": audit["isOnChain"] and file_digest_matches,
            "storedHash": stored_hash,
            "currentHash": current_hash,
            "ledgerStatus": audit["status"],
            "ledgerStatusLabel": audit["label"],
            "message": msg
        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# CHECK VIEW ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/view-access",
    methods=["POST"]
)
def check_view_access_route(evidence_id):

    try:

        data = request.get_json() or {}

        user_address, _ = resolve_target_officer(data)

        if not user_address:

            return jsonify({

                "status": "error",

                "message": (
                    "User blockchain address or valid Employee ID "
                    "is required."
                )
            }), 400

        # Resolve on-chain identifier from database record if available
        target_onchain_id = evidence_id
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT evidence_id, blockchain_evidence_id FROM evidence WHERE evidence_id = ? OR id = ? OR blockchain_evidence_id = ?",
                (evidence_id, evidence_id, evidence_id)
            )
            row = cursor.fetchone()
            conn.close()
            if row:
                target_onchain_id = row["blockchain_evidence_id"] or row["evidence_id"]
        except Exception:
            pass

        if not is_evidence_on_chain(target_onchain_id):
            return jsonify({
                "status": "error",
                "code": "EVIDENCE_NOT_ON_CHAIN",
                "message": "This evidence record is not anchored on the active blockchain ledger.",
                "evidenceId": evidence_id,
                "onChainEvidenceId": target_onchain_id,
                "onChain": False
            }), 404

        allowed = can_view(
            target_onchain_id,
            user_address
        )

        return jsonify({
            "status": "success",
            "evidenceId": evidence_id,
            "onChainEvidenceId": target_onchain_id,
            "userAddress": user_address,
            "canView": allowed,
            "onChain": True
        })

    except EvidenceNotFoundError as error:
        return jsonify({
            "status": "error",
            "code": "EVIDENCE_NOT_ON_CHAIN",
            "message": "This evidence record is not anchored on the active blockchain ledger.",
            "evidenceId": evidence_id,
            "onChain": False
        }), 404

    except Exception as error:
        app.logger.warning("View access check error for %s: %s", evidence_id, error)
        clean_message = extract_clean_error(error)
        return jsonify({
            "status": "error",
            "code": "LEDGER_QUERY_FAILED",
            "message": clean_message
        }), 500


# ============================================================
# CHECK DOWNLOAD ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/download-access",
    methods=["POST"]
)
def check_download_access_route(evidence_id):

    try:

        data = request.get_json() or {}

        user_address, _ = resolve_target_officer(data)

        if not user_address:

            return jsonify({

                "status": "error",

                "message": (
                    "User blockchain address or valid Employee ID "
                    "is required."
                )
            }), 400

        # Resolve on-chain identifier from database record if available
        target_onchain_id = evidence_id
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT evidence_id, blockchain_evidence_id FROM evidence WHERE evidence_id = ? OR id = ? OR blockchain_evidence_id = ?",
                (evidence_id, evidence_id, evidence_id)
            )
            row = cursor.fetchone()
            conn.close()
            if row:
                target_onchain_id = row["blockchain_evidence_id"] or row["evidence_id"]
        except Exception:
            pass

        if not is_evidence_on_chain(target_onchain_id):
            return jsonify({
                "status": "error",
                "code": "EVIDENCE_NOT_ON_CHAIN",
                "message": "This evidence record is not anchored on the active blockchain ledger.",
                "evidenceId": evidence_id,
                "onChainEvidenceId": target_onchain_id,
                "onChain": False
            }), 404

        allowed = can_download(
            target_onchain_id,
            user_address
        )

        return jsonify({
            "status": "success",
            "evidenceId": evidence_id,
            "onChainEvidenceId": target_onchain_id,
            "userAddress": user_address,
            "canDownload": allowed,
            "onChain": True
        })

    except EvidenceNotFoundError as error:
        return jsonify({
            "status": "error",
            "code": "EVIDENCE_NOT_ON_CHAIN",
            "message": "This evidence record is not anchored on the active blockchain ledger.",
            "evidenceId": evidence_id,
            "onChain": False
        }), 404

    except Exception as error:
        app.logger.warning("Download access check error for %s: %s", evidence_id, error)
        clean_message = extract_clean_error(error)
        return jsonify({
            "status": "error",
            "code": "LEDGER_QUERY_FAILED",
            "message": clean_message
        }), 500


# ============================================================
# ACCESS CONTROL HELPER FUNCTIONS & PRIVILEGE ENFORCEMENT
# ============================================================

def resolve_admin_and_verify_hod(data, action_desc="modify permissions"):
    """
    Server-side session verification and HOD privilege resolution.
    1. Rejects demonstration sessions immediately (403 Forbidden).
    2. If an authenticated user session is active, enforces role == 'Head of Department'
       and binds admin_address directly to the authenticated session's wallet.
    3. If no session is active, requires automated testing mode (TESTING=True).
       In production or public demo mode, unauthenticated admin calls are strictly blocked (401).
    """
    if session.get("authenticated") and session.get("user_id"):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT role, wallet_address, email FROM users WHERE id = ?", (session["user_id"],))
        s_user = cursor.fetchone()
        conn.close()

        if not s_user or s_user["role"] != "Head of Department":
            return None, (jsonify({
                "status": "error",
                "message": f"Unauthorized: Active institutional session does not hold Head of Department (HOD) authority to {action_desc}."
            }), 403)

        # Demonstration sessions for non-administrative roles are restricted
        if session.get("is_demo") and s_user["email"] != "r.sen@forensics.example.com":
            return None, (jsonify({
                "status": "forbidden",
                "message": f"Unauthorized: Demonstration sessions for non-administrative roles are restricted from executing administrative actions ({action_desc})."
            }), 403)

        return s_user["wallet_address"], None

    # Enforce authentication in non-test runtime environments
    if not current_app.config.get("TESTING"):
        return None, (jsonify({
            "status": "unauthenticated",
            "message": f"Authentication required: An active Head of Department session is required to {action_desc}."
        }), 401)

    admin_address = (
        data.get("adminAddress") or
        data.get("hodAddress") or
        request.headers.get("X-Admin-Address")
    )
    if not admin_address:
        return None, (jsonify({
            "status": "error",
            "message": "Admin blockchain address is required."
        }), 400)

    if not is_hod(admin_address):
        return None, (jsonify({
            "status": "error",
            "message": f"Unauthorized: Only Head of Department (HOD) can {action_desc}."
        }), 403)

    return admin_address, None


def verify_evidence_case_match(evidence_id, data):
    """
    Verifies that the target evidence exists and matches the selected case ID (if provided).
    """
    case_id = str(data.get("caseId") or data.get("case_id") or "").strip()
    metadata = get_evidence_metadata_for_file(evidence_id)
    if not metadata:
        return None, (jsonify({
            "status": "error",
            "message": f"Evidence record {evidence_id} not found."
        }), 404)
    if case_id and metadata.get("case_id") and metadata["case_id"].strip().lower() != case_id.lower():
        return None, (jsonify({
            "status": "error",
            "message": f"Case verification failed: Evidence {evidence_id} belongs to case {metadata.get('case_id')}, not {case_id}."
        }), 400)
    return metadata, None


def resolve_target_officer(data):
    """
    Resolves the target officer's wallet address and name from trusted database mapping.
    """
    user_address = get_request_address(data)
    employee_id = str(data.get("employeeId") or data.get("employee_id") or "").strip()
    target_name = str(data.get("targetName") or data.get("officerName") or "").strip()

    conn = get_db()
    cursor = conn.cursor()
    if employee_id:
        cursor.execute("SELECT name, wallet_address FROM users WHERE LOWER(employee_id) = ?", (employee_id.lower(),))
        u_row = cursor.fetchone()
        if u_row:
            if not user_address:
                user_address = u_row["wallet_address"]
            if not target_name:
                target_name = u_row["name"]

    if user_address and not target_name:
        cursor.execute("SELECT name FROM users WHERE LOWER(wallet_address) = ?", (user_address.lower(),))
        u_row = cursor.fetchone()
        if u_row and u_row["name"]:
            target_name = u_row["name"]
    conn.close()

    return user_address, target_name


# ============================================================
# GRANT VIEW ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/view-access/grant",
    methods=["POST"]
)
def grant_view_access_route(evidence_id):

    try:

        data = request.get_json() or {}

        admin_address, err_resp = resolve_admin_and_verify_hod(data, "grant view permissions")
        if err_resp:
            return err_resp

        metadata, err_resp = verify_evidence_case_match(evidence_id, data)
        if err_resp:
            return err_resp

        user_address, target_name = resolve_target_officer(data)

        if not user_address:

            return jsonify({

                "status": "error",

                "message": (
                    "User blockchain address "
                    "is required."
                )
            }), 400

        target_onchain_id = (metadata.get("blockchain_evidence_id") if metadata else None) or evidence_id

        blockchain_result = grant_view_access(
            target_onchain_id,
            user_address,
            admin_address=admin_address
        )

        case_id = metadata.get("case_id", "") if metadata else ""
        save_admin_audit_log(
            admin_address=blockchain_result.get("admin", admin_address or "HOD"),
            target_address=user_address,
            target_name=target_name or data.get("targetName", ""),
            evidence_id=evidence_id,
            case_id=case_id,
            permission_type="VIEW",
            action="GRANT",
            tx_hash=blockchain_result["transactionHash"],
            block_number=blockchain_result["blockNumber"]
        )

        return jsonify({

            "status": "success",

            "message": (
                "View access granted "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "userAddress": user_address,

            "action": "VIEW_GRANTED",

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            )

        })

    except EvidenceNotFoundError as not_found_err:
        return jsonify({
            "status": "error",
            "code": "EVIDENCE_NOT_ON_CHAIN",
            "message": str(not_found_err)
        }), 404

    except PermissionError as perm_err:
        return jsonify({
            "status": "error",
            "message": str(perm_err)
        }), 403

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": extract_clean_error(error)
        }), 500


# ============================================================
# REVOKE VIEW ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/view-access/revoke",
    methods=["POST"]
)
def revoke_view_access_route(evidence_id):

    try:

        data = request.get_json() or {}

        admin_address, err_resp = resolve_admin_and_verify_hod(data, "revoke view permissions")
        if err_resp:
            return err_resp

        metadata, err_resp = verify_evidence_case_match(evidence_id, data)
        if err_resp:
            return err_resp

        user_address, target_name = resolve_target_officer(data)

        if not user_address:

            return jsonify({

                "status": "error",

                "message": (
                    "User blockchain address "
                    "is required."
                )
            }), 400

        target_onchain_id = (metadata.get("blockchain_evidence_id") if metadata else None) or evidence_id

        blockchain_result = revoke_view_access(
            target_onchain_id,
            user_address,
            admin_address=admin_address
        )

        case_id = metadata.get("case_id", "") if metadata else ""
        save_admin_audit_log(
            admin_address=blockchain_result.get("admin", admin_address or "HOD"),
            target_address=user_address,
            target_name=target_name or data.get("targetName", ""),
            evidence_id=evidence_id,
            case_id=case_id,
            permission_type="VIEW",
            action="REVOKE",
            tx_hash=blockchain_result["transactionHash"],
            block_number=blockchain_result["blockNumber"]
        )

        return jsonify({

            "status": "success",

            "message": (
                "View access revoked "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "userAddress": user_address,

            "action": "VIEW_REVOKED",

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            )

        })

    except EvidenceNotFoundError as not_found_err:
        return jsonify({
            "status": "error",
            "code": "EVIDENCE_NOT_ON_CHAIN",
            "message": str(not_found_err)
        }), 404

    except PermissionError as perm_err:
        return jsonify({
            "status": "error",
            "message": str(perm_err)
        }), 403

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": extract_clean_error(error)
        }), 500


# ============================================================
# GRANT DOWNLOAD ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/download-access/grant",
    methods=["POST"]
)
def grant_download_access_route(evidence_id):

    try:

        data = request.get_json() or {}

        admin_address, err_resp = resolve_admin_and_verify_hod(data, "grant download permissions")
        if err_resp:
            return err_resp

        metadata, err_resp = verify_evidence_case_match(evidence_id, data)
        if err_resp:
            return err_resp

        user_address, target_name = resolve_target_officer(data)

        if not user_address:

            return jsonify({

                "status": "error",

                "message": (
                    "User blockchain address "
                    "is required."
                )
            }), 400

        target_onchain_id = (metadata.get("blockchain_evidence_id") if metadata else None) or evidence_id

        blockchain_result = grant_download_access(
            target_onchain_id,
            user_address,
            admin_address=admin_address
        )

        case_id = metadata.get("case_id", "") if metadata else ""
        save_admin_audit_log(
            admin_address=blockchain_result.get("admin", admin_address or "HOD"),
            target_address=user_address,
            target_name=target_name or data.get("targetName", ""),
            evidence_id=evidence_id,
            case_id=case_id,
            permission_type="DOWNLOAD",
            action="GRANT",
            tx_hash=blockchain_result["transactionHash"],
            block_number=blockchain_result["blockNumber"]
        )

        return jsonify({

            "status": "success",

            "message": (
                "Download access granted "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "userAddress": user_address,

            "action": "DOWNLOAD_GRANTED",

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            )

        })

    except EvidenceNotFoundError as not_found_err:
        return jsonify({
            "status": "error",
            "code": "EVIDENCE_NOT_ON_CHAIN",
            "message": str(not_found_err)
        }), 404

    except PermissionError as perm_err:
        return jsonify({
            "status": "error",
            "message": str(perm_err)
        }), 403

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": extract_clean_error(error)
        }), 500


# ============================================================
# REVOKE DOWNLOAD ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/download-access/revoke",
    methods=["POST"]
)
def revoke_download_access_route(evidence_id):

    try:

        data = request.get_json() or {}

        admin_address, err_resp = resolve_admin_and_verify_hod(data, "revoke download permissions")
        if err_resp:
            return err_resp

        metadata, err_resp = verify_evidence_case_match(evidence_id, data)
        if err_resp:
            return err_resp

        user_address, target_name = resolve_target_officer(data)

        if not user_address:

            return jsonify({

                "status": "error",

                "message": (
                    "User blockchain address "
                    "is required."
                )
            }), 400

        target_onchain_id = (metadata.get("blockchain_evidence_id") if metadata else None) or evidence_id

        blockchain_result = revoke_download_access(
            target_onchain_id,
            user_address,
            admin_address=admin_address
        )

        case_id = metadata.get("case_id", "") if metadata else ""
        save_admin_audit_log(
            admin_address=blockchain_result.get("admin", admin_address or "HOD"),
            target_address=user_address,
            target_name=target_name or data.get("targetName", ""),
            evidence_id=evidence_id,
            case_id=case_id,
            permission_type="DOWNLOAD",
            action="REVOKE",
            tx_hash=blockchain_result["transactionHash"],
            block_number=blockchain_result["blockNumber"]
        )

        return jsonify({

            "status": "success",

            "message": (
                "Download access revoked "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "userAddress": user_address,

            "action": "DOWNLOAD_REVOKED",

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            )

        })

    except EvidenceNotFoundError as not_found_err:
        return jsonify({
            "status": "error",
            "code": "EVIDENCE_NOT_ON_CHAIN",
            "message": str(not_found_err)
        }), 404

    except PermissionError as perm_err:
        return jsonify({
            "status": "error",
            "message": str(perm_err)
        }), 403

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": extract_clean_error(error)
        }), 500


# ============================================================
# RECORD EVIDENCE ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/access",
    methods=["POST"]
)
def record_access_route(evidence_id):
    try:
        # Enforce authentication in non-testing environments
        if not session.get("authenticated") and not app.config.get("TESTING"):
            return jsonify({
                "status": "unauthenticated",
                "message": "Authentication required to record on-chain evidence access."
            }), 401

        data = request.get_json()

        if not data:
            return jsonify({
                "status": "error",
                "message": "Request body is required."
            }), 400

        action = str(
            data.get("action", "")
        ).strip().upper()

        if action not in [
            "VIEW",
            "DOWNLOAD"
        ]:
            return jsonify({
                "status": "error",
                "message": (
                    "Action must be VIEW or DOWNLOAD."
                )
            }), 400

        user_address = data.get("userAddress")

        # Auto-derive user_address from session wallet if omitted, or verify match
        if not user_address and session.get("authenticated") and session.get("user_id"):
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT wallet_address FROM users WHERE id = ?", (session["user_id"],))
            u_row = cur.fetchone()
            conn.close()
            if u_row and u_row["wallet_address"]:
                user_address = u_row["wallet_address"]
        elif user_address and session.get("authenticated") and session.get("user_id") and not app.config.get("TESTING"):
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT wallet_address FROM users WHERE id = ?", (session["user_id"],))
            u_row = cur.fetchone()
            conn.close()
            if u_row and u_row["wallet_address"] and user_address.lower() != u_row["wallet_address"].lower():
                return jsonify({
                    "status": "error",
                    "message": "Authorization mismatch: userAddress does not match authenticated officer's wallet."
                }), 403

        if not user_address:
            return jsonify({
                "status": "error",
                "message": "userAddress is required."
            }), 400

        blockchain_result = record_access(
            evidence_id,
            action,
            user_address
        )

        return jsonify({
            "status": "success",
            "message": (
                "Evidence access recorded "
                "successfully."
            ),
            "evidenceId": evidence_id,
            "accessedBy": (
                blockchain_result["accessedBy"]
            ),
            "action": action,
            "transactionHash": (
                blockchain_result["transactionHash"]
            ),
            "blockNumber": (
                blockchain_result["blockNumber"]
            )
        })

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

# ============================================================
# ACCESS HISTORY
# ============================================================

# ============================================================
# VIEW EVIDENCE FILE
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/view",
    methods=["GET"]
)
def view_evidence_file_route(evidence_id):

    try:
        user_address = request.args.get("userAddress")

        # Auto-derive from authenticated session or verify query param against session wallet
        if session.get("authenticated") and session.get("user_id"):
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT wallet_address FROM users WHERE id = ?", (session["user_id"],))
            u_row = cursor.fetchone()
            conn.close()
            if u_row and u_row["wallet_address"]:
                if user_address and user_address.lower() != u_row["wallet_address"].lower() and not app.config.get("TESTING"):
                    return jsonify({"error": "Forbidden: userAddress does not match authenticated session wallet."}), 403
                user_address = u_row["wallet_address"]

        if not user_address:
            return jsonify({
                "error": "userAddress is required or an active authenticated session must exist."
            }), 400

        # Check that the evidence exists in the application database.
        metadata = get_evidence_metadata_for_file(evidence_id)

        if not metadata:
            return jsonify({
                "error": "Evidence not found."
            }), 404

        # Check blockchain VIEW permission.
        allowed = can_view(
            evidence_id,
            user_address
        )

        if not allowed:
            return jsonify({
                "error": "View access denied."
            }), 403

        file_path = metadata["file_path"]

        if not file_path or not os.path.exists(file_path):
            return jsonify({
                "error": "Evidence file not found on server."
            }), 404

        # Verify target file is strictly confined within authorized uploads directory
        upload_dir = os.path.abspath(app.config["UPLOAD_FOLDER"])
        canonical_path = os.path.abspath(file_path)
        if not canonical_path.startswith(upload_dir + os.sep) and canonical_path != upload_dir:
            return jsonify({
                "error": "Forbidden: Target file is outside authorized evidence repository storage."
            }), 403

        # Record the successful VIEW on blockchain.
        record_access(
            evidence_id,
            "VIEW",
            user_address
        )

        filename = os.path.basename(file_path)
        mime, _ = mimetypes.guess_type(file_path)
        if not mime:
            lower = filename.lower()
            if lower.endswith(".pdf"):
                mime = "application/pdf"
            elif lower.endswith(".json"):
                mime = "application/json"
            elif lower.endswith(".csv"):
                mime = "text/csv"
            elif lower.endswith((".png", ".jpg", ".jpeg")):
                ext = lower.split(".")[-1]
                mime = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"
            elif lower.endswith((".txt", ".log", ".sql")):
                mime = "text/plain; charset=utf-8"
            else:
                mime = "application/octet-stream"

        resp = send_file(
            file_path,
            as_attachment=False,
            mimetype=mime,
            download_name=filename
        )
        resp.headers["Content-Disposition"] = f'inline; filename="{filename}"'
        resp.headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type, Content-Length"
        return resp

    except Exception as error:
        return jsonify({
            "error": str(error)
        }), 500


# ============================================================
# DOWNLOAD EVIDENCE FILE
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/download",
    methods=["GET"]
)
def download_evidence_file_route(evidence_id):

    try:
        user_address = request.args.get("userAddress")

        # Auto-derive from authenticated session or verify query param against session wallet
        if session.get("authenticated") and session.get("user_id"):
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT wallet_address FROM users WHERE id = ?", (session["user_id"],))
            u_row = cursor.fetchone()
            conn.close()
            if u_row and u_row["wallet_address"]:
                if user_address and user_address.lower() != u_row["wallet_address"].lower() and not app.config.get("TESTING"):
                    return jsonify({"error": "Forbidden: userAddress does not match authenticated session wallet."}), 403
                user_address = u_row["wallet_address"]

        if not user_address:
            return jsonify({
                "error": "userAddress is required or an active authenticated session must exist."
            }), 400

        # Check that the evidence exists in the application database.
        metadata = get_evidence_metadata_for_file(evidence_id)

        if not metadata:
            return jsonify({
                "error": "Evidence not found."
            }), 404

        # Check blockchain DOWNLOAD permission separately.
        allowed = can_download(
            evidence_id,
            user_address
        )

        if not allowed:
            return jsonify({
                "error": "Download access denied."
            }), 403

        file_path = metadata["file_path"]

        if not file_path or not os.path.exists(file_path):
            return jsonify({
                "error": "Evidence file not found on server."
            }), 404

        # Verify target file is strictly confined within authorized uploads directory
        upload_dir = os.path.abspath(app.config["UPLOAD_FOLDER"])
        canonical_path = os.path.abspath(file_path)
        if not canonical_path.startswith(upload_dir + os.sep) and canonical_path != upload_dir:
            return jsonify({
                "error": "Forbidden: Target file is outside authorized evidence repository storage."
            }), 403

        # Record the successful DOWNLOAD on blockchain.
        record_access(
            evidence_id,
            "DOWNLOAD",
            user_address
        )

        filename = os.path.basename(file_path)
        mime, _ = mimetypes.guess_type(file_path)
        if not mime:
            lower = filename.lower()
            if lower.endswith(".pdf"):
                mime = "application/pdf"
            elif lower.endswith(".json"):
                mime = "application/json"
            elif lower.endswith(".csv"):
                mime = "text/csv"
            elif lower.endswith((".png", ".jpg", ".jpeg")):
                ext = lower.split(".")[-1]
                mime = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"
            elif lower.endswith((".txt", ".log", ".sql")):
                mime = "text/plain; charset=utf-8"
            else:
                mime = "application/octet-stream"

        resp = send_file(
            file_path,
            as_attachment=True,
            mimetype=mime,
            download_name=filename
        )
        resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        resp.headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type, Content-Length"
        return resp

    except Exception as error:
        return jsonify({
            "error": str(error)
        }), 500


@app.route(
    "/api/evidence/<evidence_id>/access-history",
    methods=["GET"]
)
def access_history_route(evidence_id):
    try:
        # 1. Resolve evidence metadata from SQLite database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                evidence_id,
                case_id,
                title,
                description,
                file_path,
                sha256_hash,
                registered_by,
                blockchain_evidence_id,
                registration_tx_hash,
                created_at
            FROM evidence
            WHERE evidence_id = ? OR id = ? OR blockchain_evidence_id = ?
            """,
            (evidence_id, evidence_id, evidence_id)
        )
        ev_row = cursor.fetchone()

        target_onchain_id = evidence_id
        ev_title = "evidence.bin"
        ev_case_id = ""
        ev_hash = ""
        ev_desc = ""

        if ev_row:
            target_onchain_id = ev_row["blockchain_evidence_id"] or ev_row["evidence_id"]
            ev_title = ev_row["title"] or "evidence.bin"
            ev_case_id = ev_row["case_id"] or ""
            ev_hash = ev_row["sha256_hash"] or ""
            ev_desc = ev_row["description"] or ""

        # 2. Check on-chain existence against smart contract
        on_chain = is_evidence_on_chain(target_onchain_id) or is_evidence_on_chain(evidence_id)

        # Non-existent evidence ID: not in SQLite and not on blockchain
        if not ev_row and not on_chain:
            conn.close()
            return jsonify({
                "status": "error",
                "code": "EVIDENCE_NOT_FOUND",
                "message": f"Evidence record '{evidence_id}' was not found in the evidence repository.",
                "evidenceId": evidence_id,
                "isOnChain": False
            }), 404

        # Evidence exists in local database but is not anchored on active blockchain ledger
        if not on_chain:
            conn.close()
            return jsonify({
                "status": "success",
                "evidenceId": ev_row["evidence_id"] if ev_row else evidence_id,
                "blockchainEvidenceId": target_onchain_id,
                "caseId": ev_case_id,
                "title": ev_title,
                "sha256Hash": ev_hash,
                "description": ev_desc,
                "isOnChain": False,
                "onChainStatus": "NOT_ANCHORED",
                "message": "This evidence record is not anchored on the active blockchain ledger.",
                "count": 0,
                "metrics": {
                    "total": 0,
                    "views": 0,
                    "downloads": 0,
                    "grants": 0,
                    "revokes": 0
                },
                "records": []
            }), 200

        # 3. Evidence is ON-CHAIN: Fetch all on-chain events
        # A. File access events (VIEW / DOWNLOAD)
        raw_access_history = get_access_history(target_onchain_id)
        if not raw_access_history and target_onchain_id != evidence_id:
            raw_access_history = get_access_history(evidence_id)

        # B. Permission audit events (GRANT / REVOKE for VIEW / DOWNLOAD)
        all_admin_history = get_admin_audit_history()
        evidence_admin_history = [
            r for r in all_admin_history
            if r.get("evidenceId") in (target_onchain_id, evidence_id)
        ]

        # C. Fetch users directory for identity enrichment
        cursor.execute("SELECT wallet_address, name, employee_id, role, department FROM users")
        user_rows = cursor.fetchall()
        users_by_addr = {}
        for u in user_rows:
            if u["wallet_address"]:
                users_by_addr[u["wallet_address"].lower()] = {
                    "name": u["name"],
                    "employeeId": u["employee_id"] or "OFF-VERIFIED",
                    "role": u["role"] or "Forensic Officer",
                    "department": u["department"] or "Forensics Directorate"
                }

        hod_address = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
        if hod_address not in users_by_addr:
            users_by_addr[hod_address] = {
                "name": "Dr. Rajeshwar Sen",
                "employeeId": "HOD-0001",
                "role": "Head of Department",
                "department": "Forensics Headquarters"
            }

        # D. Fetch department_audit_log for transaction hashes and block numbers
        cursor.execute(
            """
            SELECT
                admin_address,
                target_address,
                target_name,
                permission_type,
                action,
                tx_hash,
                block_number,
                created_at
            FROM department_audit_log
            WHERE evidence_id = ? OR evidence_id = ?
            ORDER BY id DESC
            """,
            (evidence_id, target_onchain_id)
        )
        db_audit_logs = [dict(r) for r in cursor.fetchall()]
        conn.close()

        # Build unified chronological audit timeline
        combined_records = []

        # Process file access events (VIEW / DOWNLOAD)
        for idx, acc in enumerate(raw_access_history):
            addr = (acc.get("accessedBy") or "").lower()
            u_info = users_by_addr.get(addr, {})
            action_type = (acc.get("action") or "").upper()
            ts = int(acc.get("timestamp", 0))

            combined_records.append({
                "id": f"acc-{idx}-{ts}",
                "category": "ACCESS",
                "eventType": "EVIDENCE_VIEWED" if action_type == "VIEW" else "EVIDENCE_DOWNLOADED",
                "action": action_type,
                "actionLabel": "Evidence Viewed" if action_type == "VIEW" else "Evidence Downloaded",
                "description": (
                    f"{u_info.get('name', 'Authorized Officer')} viewed and inspected this evidence record."
                    if action_type == "VIEW" else
                    f"{u_info.get('name', 'Authorized Officer')} downloaded an authorized binary copy of this evidence."
                ),
                "officerName": u_info.get("name", "Authorized Officer"),
                "officerEmployeeId": u_info.get("employeeId", "OFF-VERIFIED"),
                "officerRole": u_info.get("role", "Forensic Examiner"),
                "officerDepartment": u_info.get("department", "Digital Forensics Unit"),
                "officerAddress": acc.get("accessedBy"),
                "authorizedByName": "Institutional Session Gate",
                "authorizedByRole": "Smart Contract Access Rule",
                "authorizedByAddress": None,
                "timestamp": ts,
                "isVerifiedOnChain": True,
                "ledgerStatus": "VERIFIED_ON_CHAIN",
                "source": "Smart Contract (recordAccess)"
            })

        # Process permission audit events (GRANT / REVOKE)
        for idx, adm in enumerate(evidence_admin_history):
            admin_addr = (adm.get("admin") or "").lower()
            target_addr = (adm.get("targetMember") or "").lower()
            admin_info = users_by_addr.get(admin_addr, {
                "name": "Dr. Rajeshwar Sen",
                "employeeId": "HOD-0001",
                "role": "Head of Department"
            })
            target_info = users_by_addr.get(target_addr, {
                "name": "Authorized Officer",
                "employeeId": "OFF-VERIFIED",
                "role": "Forensic Investigator"
            })

            perm_type = (adm.get("permissionType") or "").upper()
            act = (adm.get("action") or "").upper()
            ts = int(adm.get("timestamp", 0))

            if perm_type == "VIEW":
                event_type = "VIEW_PERMISSION_GRANTED" if act == "GRANT" else "VIEW_PERMISSION_REVOKED"
                action_label = "View Permission Granted" if act == "GRANT" else "View Permission Revoked"
                desc = (
                    f"View authorization granted to {target_info.get('name')} by {admin_info.get('name')}."
                    if act == "GRANT" else
                    f"View authorization revoked for {target_info.get('name')} by {admin_info.get('name')}."
                )
            else:
                event_type = "DOWNLOAD_PERMISSION_GRANTED" if act == "GRANT" else "DOWNLOAD_PERMISSION_REVOKED"
                action_label = "Download Permission Granted" if act == "GRANT" else "Download Permission Revoked"
                desc = (
                    f"Download authorization granted to {target_info.get('name')} by {admin_info.get('name')}."
                    if act == "GRANT" else
                    f"Download authorization revoked for {target_info.get('name')} by {admin_info.get('name')}."
                )

            # Match matching DB audit log for tx_hash & block_number
            matched_tx = None
            matched_block = None
            for db_log in db_audit_logs:
                if (
                    db_log.get("target_address", "").lower() == target_addr and
                    db_log.get("permission_type") == perm_type and
                    db_log.get("action") == act
                ):
                    matched_tx = db_log.get("tx_hash")
                    matched_block = db_log.get("block_number")
                    break

            combined_records.append({
                "id": f"admin-{idx}-{ts}",
                "category": "AUTHORIZATION",
                "eventType": event_type,
                "action": act,
                "permissionType": perm_type,
                "actionLabel": action_label,
                "description": desc,
                "officerName": target_info.get("name", "Authorized Officer"),
                "officerEmployeeId": target_info.get("employeeId", "OFF-VERIFIED"),
                "officerRole": target_info.get("role", "Forensic Investigator"),
                "officerDepartment": target_info.get("department", "Cyber Crime Unit"),
                "officerAddress": adm.get("targetMember"),
                "authorizedByName": admin_info.get("name", "Dr. Rajeshwar Sen"),
                "authorizedByRole": admin_info.get("role", "Head of Department"),
                "authorizedByAddress": adm.get("admin"),
                "timestamp": ts,
                "txHash": matched_tx,
                "blockNumber": matched_block,
                "isVerifiedOnChain": True,
                "ledgerStatus": "VERIFIED_ON_CHAIN",
                "source": "Smart Contract (adminAuditHistory)"
            })

        # Sort newest first
        combined_records.sort(key=lambda x: x["timestamp"], reverse=True)

        # Compute summary metrics
        metrics = {
            "total": len(combined_records),
            "views": sum(1 for r in combined_records if r["eventType"] == "EVIDENCE_VIEWED"),
            "downloads": sum(1 for r in combined_records if r["eventType"] == "EVIDENCE_DOWNLOADED"),
            "grants": sum(1 for r in combined_records if "GRANTED" in r["eventType"]),
            "revokes": sum(1 for r in combined_records if "REVOKED" in r["eventType"])
        }

        return jsonify({
            "status": "success",
            "evidenceId": ev_row["evidence_id"] if ev_row else evidence_id,
            "blockchainEvidenceId": target_onchain_id,
            "caseId": ev_case_id,
            "title": ev_title,
            "sha256Hash": ev_hash,
            "description": ev_desc,
            "isOnChain": True,
            "onChainStatus": "ANCHORED",
            "count": len(combined_records),
            "metrics": metrics,
            "records": combined_records,
            # Backward compatibility for legacy callers:
            "accessHistory": raw_access_history
        }), 200

    except Exception as error:
        app.logger.warning("Access history fetch error for %s: %s", evidence_id, error)
        clean_msg = extract_clean_error(error)
        return jsonify({
            "status": "error",
            "code": "ACCESS_HISTORY_FETCH_FAILED",
            "message": clean_msg,
            "evidenceId": evidence_id
        }), 500


# ============================================================
# DEPARTMENT COMMAND STRUCTURE & LIVE ACCESS CONTROL
# ============================================================

@app.route("/api/department/hod", methods=["GET"])
def get_department_hod_route():
    try:
        is_auth = session.get("authenticated") and session.get("user_id")
        if not is_auth:
            return jsonify({
                "status": "unauthenticated",
                "message": "Authentication required to query department authority."
            }), 401

        hod_address = get_head_of_department()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, employee_id, role, department, organization, wallet_address
            FROM users
            WHERE LOWER(wallet_address) = LOWER(?)
        """, (hod_address,))
        u = cursor.fetchone()

        is_current_session_hod = False
        if session.get("authenticated") and session.get("user_id"):
            cursor.execute("SELECT role, wallet_address FROM users WHERE id = ?", (session["user_id"],))
            cur_u = cursor.fetchone()
            if cur_u and (cur_u["role"] == "Head of Department" or cur_u["wallet_address"].lower() == hod_address.lower()):
                is_current_session_hod = True

        conn.close()

        name = u["name"] if u else "Dr. Rajeshwar Sen"
        employee_id = u["employee_id"] if u else "HOD-0001"
        department = u["department"] if u else "Forensics Headquarters"
        organization = u["organization"] if u else "State Directorate of Forensic Sciences"

        caps = {
            "canAdministerPersonnel": True,
            "canGrantRevokeEvidenceAccess": True,
            "universalAccessGranted": False,
            "evidenceAccessEnforcement": "Evidence-Specific On-Chain Zero Trust",
            "administrative": "Authorized to manage department personnel directory and administer smart contract access grants and revocations.",
            "viewAccess": "Evidence-specific: requires explicit on-chain grant or initial evidence registration.",
            "downloadAccess": "Evidence-specific: requires explicit on-chain grant or initial evidence registration.",
            "custody": "Evidence-specific: requires active on-chain custody assignment."
        }

        hod_obj = {
            "name": name,
            "badgeNumber": "DFS-DIR-001",
            "employeeId": employee_id,
            "role": "Head of Department",
            "authorizationTitle": "Department Administrator",
            "department": department,
            "organization": organization,
            "walletAddress": hod_address,
            "isCurrentSessionHOD": is_current_session_hod,
            "capabilities": caps
        }

        return jsonify({
            "status": "success",
            "hodAddress": hod_address,
            "name": name,
            "employeeId": employee_id,
            "role": "Head of Department",
            "authorizationTitle": "Department Administrator",
            "department": department,
            "organization": organization,
            "isCurrentSessionHOD": is_current_session_hod,
            "capabilities": caps,
            "hod": hod_obj
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/members", methods=["GET"])
@app.route("/api/officers", methods=["GET"])
def get_department_members_route():
    try:
        is_auth = session.get("authenticated") and session.get("user_id")
        if not is_auth:
            return jsonify({
                "status": "unauthenticated",
                "message": "Authentication required to query department members."
            }), 401

        members = get_department_members()
        hod_address = get_head_of_department()

        # Query database evidence records to calculate precise registered and custody counts
        connection = get_db()
        cursor = connection.cursor()
        cursor.execute("SELECT evidence_id, case_id, title, registered_by, current_custodian, created_at FROM evidence ORDER BY id DESC")
        evidence_rows = [dict(r) for r in cursor.fetchall()]

        # Query database users for rich employee profiles
        cursor.execute("""
            SELECT id, name, email, employee_id, role, department, organization, wallet_address
            FROM users
            WHERE wallet_address IS NOT NULL
        """)
        db_users = {row["wallet_address"].lower(): dict(row) for row in cursor.fetchall() if row["wallet_address"]}
        connection.close()

        enriched_members = []
        seen_wallets = set()

        for m in members:
            addr = m["walletAddress"].lower()
            seen_wallets.add(addr)
            is_hod_user = (addr == hod_address.lower())

            # Specific, precise evidence calculations
            registered_ev = [
                ev for ev in evidence_rows
                if ev.get("registered_by") and ev.get("registered_by").lower() == addr
            ]
            custody_ev = [
                ev for ev in evidence_rows
                if ev.get("current_custodian") and ev.get("current_custodian").lower() == addr
            ]

            db_u = db_users.get(addr, {})

            enriched_members.append({
                **m,
                "isHOD": is_hod_user,
                "registeredEvidenceCount": len(registered_ev),
                "custodyEvidenceCount": len(custody_ev),
                "assignedEvidenceCount": len(custody_ev),
                "registeredEvidence": registered_ev,
                "custodyEvidence": custody_ev,
                "employeeId": db_u.get("employee_id") or f"EMP-{m['walletAddress'][-4:].upper()}",
                "department": db_u.get("department") or m.get("departmentId"),
                "designation": db_u.get("role") or m.get("role"),
                "email": db_u.get("email") or "",
                "isVerified": True
            })

        # Append any DB users not in contract members
        for addr, u in db_users.items():
            if addr not in seen_wallets:
                seen_wallets.add(addr)
                registered_ev = [
                    ev for ev in evidence_rows
                    if ev.get("registered_by") and ev.get("registered_by").lower() == addr
                ]
                custody_ev = [
                    ev for ev in evidence_rows
                    if ev.get("current_custodian") and ev.get("current_custodian").lower() == addr
                ]
                enriched_members.append({
                    "walletAddress": u["wallet_address"],
                    "name": u["name"],
                    "role": u.get("role") or "Forensic Officer",
                    "designation": u.get("role") or "Forensic Officer",
                    "departmentId": u.get("department") or "DEPT-FORENSICS",
                    "department": u.get("department") or "Forensics Division",
                    "employeeId": u.get("employee_id") or f"EMP-{u['wallet_address'][-4:].upper()}",
                    "email": u.get("email") or "",
                    "isActive": True,
                    "isHOD": (addr == hod_address.lower()),
                    "isVerified": True,
                    "registeredEvidenceCount": len(registered_ev),
                    "custodyEvidenceCount": len(custody_ev),
                    "assignedEvidenceCount": len(custody_ev),
                    "registeredEvidence": registered_ev,
                    "custodyEvidence": custody_ev
                })

        return jsonify({
            "status": "success",
            "hodAddress": hod_address,
            "count": len(enriched_members),
            "members": enriched_members,
            "officers": enriched_members
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/cases", methods=["GET"])
def get_department_cases_route():
    """
    Returns cases available in EvidenceChain with reporting hierarchy status,
    officer assignment count, and evidence metrics.
    """
    try:
        is_auth = session.get("authenticated") and session.get("user_id")
        if not is_auth:
            return jsonify({
                "status": "unauthenticated",
                "message": "Authentication required to query department cases."
            }), 401

        cases_from_db = get_all_cases_with_stats()

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT evidence_id, case_id FROM evidence")
        all_ev = cur.fetchall()
        conn.close()

        case_anchored_counts = {}
        for ev in all_ev:
            cid = ev["case_id"]
            if is_evidence_on_chain(ev["evidence_id"]):
                case_anchored_counts[cid] = case_anchored_counts.get(cid, 0) + 1

        cases = []
        for c in cases_from_db:
            cid = c["case_id"]
            tot_ev = c["evidence_count"]
            anchored = case_anchored_counts.get(cid, 0)
            cases.append({
                "caseId": cid,
                "case_id": cid,
                "title": c["title"],
                "description": c["description"] or "",
                "status": c["status"] or "ACTIVE",
                "assignedOfficerCount": c["assigned_officer_count"],
                "hasAssignments": c["assigned_officer_count"] > 0,
                "evidenceCount": tot_ev,
                "totalEvidenceCount": tot_ev,
                "anchoredCount": anchored,
                "anchoredEvidenceCount": anchored,
                "isFullyAnchored": (anchored == tot_ev and tot_ev > 0),
                "createdAt": c.get("created_at")
            })

        return jsonify({
            "status": "success",
            "cases": cases,
            "totalCases": len(cases)
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/case-hierarchy", methods=["GET"])
def get_case_hierarchy_route():
    """
    Returns the dynamic organizational reporting hierarchy for a specific case.
    Independent across cases. Shows who reports to whom.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to query case reporting hierarchy."
        }), 401

    case_id = request.args.get("caseId", "").strip()
    if not case_id:
        return jsonify({
            "status": "error",
            "message": "caseId query parameter is required."
        }), 400

    try:
        hierarchy_data = build_case_hierarchy_tree_structure(case_id)
        
        # Determine whether current authenticated user holds HOD authority
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, role, employee_id, department, organization FROM users WHERE id = ?", (session["user_id"],))
        cur_u = cursor.fetchone()
        conn.close()

        is_hod_user = (cur_u["role"] == "Head of Department") if cur_u else False

        return jsonify({
            "status": "success",
            "caseId": case_id,
            "case": hierarchy_data["case"],
            "hasAssignments": hierarchy_data["hasAssignments"],
            "totalAssigned": hierarchy_data["totalAssigned"],
            "leadsCount": hierarchy_data["leadsCount"],
            "roots": hierarchy_data["roots"],
            "assignments": hierarchy_data["assignments"],
            "departmentOversight": {
                "name": "Dr. Rajeshwar Sen",
                "employeeId": "HOD-0001",
                "role": "Head of Department",
                "designation": "Head of Department",
                "department": "Forensics Headquarters",
                "organization": "State Directorate of Forensic Sciences",
                "scope": "Executive Departmental Oversight"
            },
            "currentUser": {
                "isHOD": is_hod_user,
                "role": cur_u["role"] if cur_u else "Officer",
                "name": cur_u["name"] if cur_u else "Officer"
            }
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/personnel", methods=["GET"])
def get_department_personnel_roster():
    """
    Returns available department officers eligible for case assignment.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to query personnel."
        }), 401

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id as userId, name, email, employee_id as employeeId,
                   role as officialDesignation, department, organization, wallet_address as walletAddress
            FROM users
            ORDER BY id ASC
        """)
        rows = cursor.fetchall()
        conn.close()

        return jsonify({
            "status": "success",
            "personnel": [dict(r) for r in rows],
            "totalPersonnel": len(rows)
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/case-assignments", methods=["POST"])
def create_case_assignment_route():
    """
    Assign an officer to a specific case with a case-specific role, supervisor, and duties.
    Enforces server-side HOD-only RBAC (403 for non-HOD).
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to assign officers to cases."
        }), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, role FROM users WHERE id = ?", (session["user_id"],))
    cur_u = cursor.fetchone()
    conn.close()

    if not cur_u or cur_u["role"] != "Head of Department":
        return jsonify({
            "status": "forbidden",
            "message": "Unauthorized: Only Head of Department (HOD) can assign officers or configure case reporting hierarchies."
        }), 403

    data = request.get_json() or {}
    case_id = str(data.get("caseId", "")).strip()
    user_id = data.get("userId")
    case_role = str(data.get("caseRole", "")).strip()
    reports_to = data.get("reportsToAssignmentId")
    if reports_to:
        reports_to = str(reports_to).strip()
        if not reports_to:
            reports_to = None
    responsibilities = str(data.get("responsibilities", "")).strip()

    if not case_id:
        return jsonify({"status": "error", "message": "caseId is required."}), 400
    if not user_id:
        return jsonify({"status": "error", "message": "userId is required."}), 400
    if not case_role:
        return jsonify({"status": "error", "message": "caseRole is required."}), 400

    try:
        assignment_id = add_case_assignment(
            case_id=case_id,
            user_id=int(user_id),
            case_role=case_role,
            reports_to_assignment_id=reports_to,
            responsibility_description=responsibilities,
            performed_by_user=dict(cur_u)
        )
        return jsonify({
            "status": "success",
            "message": f"Officer assigned successfully to {case_id} as {case_role}.",
            "assignmentId": assignment_id,
            "caseId": case_id
        }), 201
    except ValueError as val_err:
        return jsonify({"status": "error", "message": str(val_err)}), 400
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.route("/api/department/case-assignments/<assignment_id>/update", methods=["POST", "PUT"])
@app.route("/api/department/case-assignments/<assignment_id>", methods=["PUT"])
def update_case_assignment_route(assignment_id):
    """
    Update a case assignment's role, reporting supervisor, or assigned duties.
    Enforces server-side HOD-only RBAC and validates circular reporting prevention.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to update case assignments."
        }), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, role FROM users WHERE id = ?", (session["user_id"],))
    cur_u = cursor.fetchone()
    conn.close()

    if not cur_u or cur_u["role"] != "Head of Department":
        return jsonify({
            "status": "forbidden",
            "message": "Unauthorized: Only Head of Department (HOD) can modify case reporting hierarchies."
        }), 403

    data = request.get_json() or {}
    case_id = str(data.get("caseId", "")).strip()
    case_role = str(data.get("caseRole", "")).strip()
    reports_to = data.get("reportsToAssignmentId")
    if reports_to:
        reports_to = str(reports_to).strip()
        if not reports_to:
            reports_to = None
    responsibilities = str(data.get("responsibilities", "")).strip()

    if not case_id:
        return jsonify({"status": "error", "message": "caseId is required."}), 400
    if not case_role:
        return jsonify({"status": "error", "message": "caseRole is required."}), 400

    try:
        update_case_assignment(
            case_id=case_id,
            assignment_id=assignment_id,
            case_role=case_role,
            reports_to_assignment_id=reports_to,
            responsibility_description=responsibilities,
            performed_by_user=dict(cur_u)
        )
        return jsonify({
            "status": "success",
            "message": f"Case assignment {assignment_id} updated successfully.",
            "assignmentId": assignment_id,
            "caseId": case_id
        }), 200
    except ValueError as val_err:
        return jsonify({"status": "error", "message": str(val_err)}), 400
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.route("/api/department/case-assignments/<assignment_id>/remove", methods=["POST", "DELETE"])
@app.route("/api/department/case-assignments/<assignment_id>", methods=["DELETE"])
def remove_case_assignment_route(assignment_id):
    """
    Remove an officer from a case assignment. Safely re-parents any subordinates to prevent orphans.
    Enforces server-side HOD-only RBAC.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to remove case assignments."
        }), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, role FROM users WHERE id = ?", (session["user_id"],))
    cur_u = cursor.fetchone()
    conn.close()

    if not cur_u or cur_u["role"] != "Head of Department":
        return jsonify({
            "status": "forbidden",
            "message": "Unauthorized: Only Head of Department (HOD) can remove officers from case assignments."
        }), 403

    data = request.get_json() or {}
    case_id = str(data.get("caseId", request.args.get("caseId", ""))).strip()
    if not case_id:
        return jsonify({"status": "error", "message": "caseId is required."}), 400

    try:
        remove_case_assignment(
            case_id=case_id,
            assignment_id=assignment_id,
            performed_by_user=dict(cur_u)
        )
        return jsonify({
            "status": "success",
            "message": f"Officer assignment {assignment_id} removed and subordinates safely re-parented.",
            "assignmentId": assignment_id,
            "caseId": case_id
        }), 200
    except ValueError as val_err:
        return jsonify({"status": "error", "message": str(val_err)}), 400
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.route("/api/department/case-hierarchy/audit-log", methods=["GET"])
def get_case_hierarchy_audit_log_route():
    """
    Returns the complete audit log of case assignment modifications for the specified case.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to query case audit logs."
        }), 401

    case_id = request.args.get("caseId", "").strip()
    if not case_id:
        return jsonify({"status": "error", "message": "caseId query parameter is required."}), 400

    try:
        logs = get_case_hierarchy_audit_log(case_id)
        return jsonify({
            "status": "success",
            "caseId": case_id,
            "totalEntries": len(logs),
            "auditLog": logs
        })
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.route("/api/department/case-evidence", methods=["GET"])
def get_department_case_evidence_route():
    """
    Step 2: Returns all evidence records belonging to the selected case,
    including verifiable on-chain anchor status.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to query case evidence."
        }), 401

    case_id = request.args.get("caseId", "").strip()
    if not case_id:
        return jsonify({
            "status": "error",
            "message": "caseId query parameter is required."
        }), 400

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT evidence_id, case_id, title, description, file_path, sha256_hash, registered_by, current_custodian, created_at
            FROM evidence
            WHERE case_id = ?
            ORDER BY id ASC
        """, (case_id,))
        rows = cursor.fetchall()
        conn.close()

        evidence_items = []
        for r in rows:
            eid = r["evidence_id"]
            on_chain = is_evidence_on_chain(eid)
            f_size = None
            try:
                if r["file_path"] and os.path.exists(r["file_path"]):
                    f_size = os.path.getsize(r["file_path"])
            except Exception:
                pass

            evidence_items.append({
                "evidenceId": eid,
                "evidence_id": eid,
                "caseId": r["case_id"],
                "case_id": r["case_id"],
                "title": r["title"] or "Evidence Artifact",
                "description": r["description"] or "",
                "sha256Hash": r["sha256_hash"],
                "fileSize": f_size,
                "file_size_bytes": f_size if f_size is not None else 0,
                "registeredBy": r["registered_by"],
                "currentCustodian": r["current_custodian"],
                "createdAt": r["created_at"],
                "isAnchored": on_chain,
                "onChainStatus": "Anchored" if on_chain else "Unanchored",
                "anchorStatus": "Anchored" if on_chain else "Historical (Unanchored)"
            })

        return jsonify({
            "status": "success",
            "caseId": case_id,
            "evidenceCount": len(evidence_items),
            "evidence": evidence_items,
            "evidenceItems": evidence_items
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/evidence-permissions", methods=["GET"])
def get_department_evidence_permissions_route():
    """
    Step 3: Queries on-chain permissions (canView, canDownload) for all department
    members for a specific evidence item.
    Properly distinguishes anchored from unanchored records and network errors.
    """
    is_auth = session.get("authenticated") and session.get("user_id")
    if not is_auth:
        return jsonify({
            "status": "unauthenticated",
            "message": "Authentication required to query evidence permissions."
        }), 401

    evidence_id = request.args.get("evidenceId", "").strip()
    if not evidence_id:
        return jsonify({
            "status": "error",
            "message": "evidenceId query parameter is required."
        }), 400

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT evidence_id, case_id, title, sha256_hash, registered_by, current_custodian, created_at
            FROM evidence
            WHERE evidence_id = ?
        """, (evidence_id,))
        ev_row = cursor.fetchone()

        cursor.execute("""
            SELECT id, name, email, employee_id, role, department, wallet_address
            FROM users
            WHERE wallet_address IS NOT NULL
            ORDER BY id ASC
        """)
        user_rows = cursor.fetchall()
        conn.close()

        if not ev_row:
            return jsonify({
                "status": "error",
                "code": "EVIDENCE_NOT_FOUND",
                "message": f"Evidence '{evidence_id}' does not exist in local database."
            }), 404

        case_id = ev_row["case_id"]
        title = ev_row["title"] or "Evidence Artifact"
        reg_by = (ev_row["registered_by"] or "").lower()
        custodian = (ev_row["current_custodian"] or "").lower()

        # Check whether this evidence record is anchored on the active blockchain ledger
        on_chain = is_evidence_on_chain(evidence_id)

        officer_permissions = []
        view_allowed_count = 0
        download_allowed_count = 0

        hod_address = get_head_of_department()

        for u in user_rows:
            w = u["wallet_address"]
            w_lower = w.lower()
            is_hod_user = (w_lower == hod_address.lower())
            is_reg = (w_lower == reg_by)
            is_cust = (w_lower == custodian)

            if not on_chain:
                # Unanchored historical development record
                officer_permissions.append({
                    "name": u["name"],
                    "employeeId": u["employee_id"],
                    "role": u["role"],
                    "department": u["department"],
                    "walletAddress": w,
                    "isHOD": is_hod_user,
                    "isRegistrant": is_reg,
                    "isCustodian": is_cust,
                    "canView": False,
                    "canDownload": False,
                    "statusView": "Unavailable",
                    "statusDownload": "Unavailable",
                    "reason": "Not anchored on active ledger"
                })
            else:
                # Active anchored record: query smart contract
                try:
                    can_v = can_view(evidence_id, w)
                    status_v = "Allowed" if can_v else "Denied"
                except Exception:
                    can_v = False
                    status_v = "Not verified"

                try:
                    can_d = can_download(evidence_id, w)
                    status_d = "Allowed" if can_d else "Denied"
                except Exception:
                    can_d = False
                    status_d = "Not verified"

                if can_v:
                    view_allowed_count += 1
                if can_d:
                    download_allowed_count += 1

                officer_permissions.append({
                    "name": u["name"],
                    "employeeId": u["employee_id"],
                    "role": u["role"],
                    "department": u["department"],
                    "walletAddress": w,
                    "isHOD": is_hod_user,
                    "isRegistrant": is_reg,
                    "isCustodian": is_cust,
                    "canView": can_v,
                    "canDownload": can_d,
                    "statusView": status_v,
                    "statusDownload": status_d,
                    "reason": None
                })

        denied_count = 0
        unavailable_count = 0
        for p in officer_permissions:
            if p["statusView"] == "Denied":
                denied_count += 1
            elif p["statusView"] == "Unavailable":
                unavailable_count += 1

        summary_metrics = {
            "totalOfficers": len(officer_permissions),
            "viewAllowedCount": view_allowed_count,
            "allowedViewCount": view_allowed_count,
            "downloadAllowedCount": download_allowed_count,
            "allowedDownloadCount": download_allowed_count,
            "deniedCount": denied_count,
            "unavailableCount": unavailable_count,
            "isAnchored": on_chain,
            "statusLabel": "Active Ledger" if on_chain else "Historical Unanchored"
        }

        ev_info = {
            "evidenceId": evidence_id,
            "caseId": case_id,
            "title": title,
            "isAnchored": on_chain,
            "onChainStatus": "Anchored" if on_chain else "Unanchored",
            "anchorNotice": (
                "Verified and anchored on active blockchain ledger."
                if on_chain
                else "This evidence record is not anchored on the active blockchain ledger (created prior to Hardhat restart)."
            )
        }

        return jsonify({
            "status": "success",
            "evidenceId": evidence_id,
            "caseId": case_id,
            "title": title,
            "isAnchored": on_chain,
            "onChainStatus": "Anchored" if on_chain else "Unanchored",
            "anchorNotice": ev_info["anchorNotice"],
            "evidence": ev_info,
            "officers": officer_permissions,
            "permissions": officer_permissions,
            "summary": summary_metrics,
            "summaryMetrics": summary_metrics
        })

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/permissions-matrix", methods=["GET"])
def get_permissions_matrix_route():
    try:
        members = get_department_members()
        hod_address = get_head_of_department()

        connection = get_db()
        cursor = connection.cursor()
        cursor.execute("SELECT evidence_id, case_id, title, created_at FROM evidence ORDER BY id DESC")
        evidence_list = [dict(r) for r in cursor.fetchall()]
        connection.close()

        matrix = []
        for ev in evidence_list:
            ev_id = ev["evidence_id"]
            case_id = ev["case_id"]
            title = ev["title"] or "evidence.bin"

            for m in members:
                w = m["walletAddress"]
                try:
                    can_v = can_view(ev_id, w)
                except Exception:
                    can_v = False

                try:
                    can_d = can_download(ev_id, w)
                except Exception:
                    can_d = False

                matrix.append({
                    "evidenceId": ev_id,
                    "caseId": case_id,
                    "title": title,
                    "memberAddress": w,
                    "memberName": m["name"],
                    "memberRole": m["role"],
                    "departmentId": m["departmentId"],
                    "isHOD": (w.lower() == hod_address.lower()),
                    "canView": can_v,
                    "canDownload": can_d,
                    "evidenceCreatedAt": ev.get("created_at")
                })

        return jsonify({
            "status": "success",
            "hodAddress": hod_address,
            "totalEntries": len(matrix),
            "totalMembers": len(members),
            "totalEvidence": len(evidence_list),
            "matrix": matrix
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/permissions/change", methods=["POST"])
def change_department_permission_route():
    try:
        if session.get("is_demo") and session.get("email") != "r.sen@forensics.example.com":
            return jsonify({
                "status": "forbidden",
                "message": "Unauthorized: Demonstration sessions for non-administrative roles cannot modify department permissions."
            }), 403

        is_auth = session.get("authenticated") and session.get("user_id")
        if not is_auth:
            return jsonify({
                "status": "unauthenticated",
                "message": "Authentication required to modify department permissions."
            }), 401

        data = request.get_json() or {}

        # ----------------------------------------------------
        # Server-Side Session Verification & Privilege Check
        # ----------------------------------------------------
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT role, wallet_address FROM users WHERE id = ?", (session["user_id"],))
        s_user = cursor.fetchone()
        conn.close()

        if not s_user or s_user["role"] != "Head of Department":
            return jsonify({
                "status": "forbidden",
                "message": "Unauthorized: Active institutional session does not hold Head of Department (HOD) authority."
            }), 403
        
        admin_address = s_user["wallet_address"]

        target_address = (
            data.get("targetAddress") or
            data.get("officerWallet") or
            data.get("officerAddress") or
            data.get("target_address") or
            ""
        ).strip()
        evidence_id = str(data.get("evidenceId", "")).strip()
        permission_type = str(data.get("permissionType", "")).strip().upper()
        action = str(data.get("action", "")).strip().upper()

        if not admin_address:
            return jsonify({
                "status": "error",
                "message": "Admin blockchain address is required."
            }), 400

        # Enforce strict HOD authorization
        if not is_hod(admin_address):
            return jsonify({
                "status": "forbidden",
                "message": "Unauthorized: Only Head of Department (HOD) can grant or revoke evidence permissions."
            }), 403

        if not target_address:
            return jsonify({
                "status": "error",
                "message": "Target member blockchain address is required."
            }), 400

        if not evidence_id:
            return jsonify({
                "status": "error",
                "message": "Evidence ID is required."
            }), 400

        # Verify evidence record is anchored on the active blockchain ledger
        if not is_evidence_on_chain(evidence_id):
            err_msg = f"Cannot change permissions: evidence record '{evidence_id}' is not anchored on active blockchain ledger."
            return jsonify({
                "status": "error",
                "message": err_msg,
                "error": err_msg
            }), 400

        if permission_type not in ["VIEW", "DOWNLOAD"]:
            return jsonify({
                "status": "error",
                "message": "Permission type must be VIEW or DOWNLOAD."
            }), 400

        if action not in ["GRANT", "REVOKE"]:
            return jsonify({
                "status": "error",
                "message": "Action must be GRANT or REVOKE."
            }), 400

        # Execute on-chain operation
        if permission_type == "VIEW":
            if action == "GRANT":
                blockchain_result = grant_view_access(evidence_id, target_address, admin_address)
            else:
                blockchain_result = revoke_view_access(evidence_id, target_address, admin_address)
        else: # DOWNLOAD
            if action == "GRANT":
                blockchain_result = grant_download_access(evidence_id, target_address, admin_address)
            else:
                blockchain_result = revoke_download_access(evidence_id, target_address, admin_address)

        # Get evidence case ID for audit log
        metadata = get_evidence_metadata_for_file(evidence_id)
        case_id = metadata.get("case_id", "") if metadata else ""

        # Record in SQLite persistent audit log
        save_admin_audit_log(
            admin_address=blockchain_result.get("admin", admin_address),
            target_address=target_address,
            target_name=data.get("targetName", ""),
            evidence_id=evidence_id,
            case_id=case_id,
            permission_type=permission_type,
            action=action,
            tx_hash=blockchain_result["transactionHash"],
            block_number=blockchain_result["blockNumber"]
        )

        new_can_view = can_view(evidence_id, target_address) if is_evidence_on_chain(evidence_id) else False
        new_can_download = can_download(evidence_id, target_address) if is_evidence_on_chain(evidence_id) else False

        return jsonify({
            "status": "success",
            "message": f"{permission_type} permission {action.lower()}ed successfully for {target_address[:10]}...",
            "evidenceId": evidence_id,
            "targetAddress": target_address,
            "permissionType": permission_type,
            "action": action,
            "transactionHash": blockchain_result["transactionHash"],
            "txHash": blockchain_result["transactionHash"],
            "blockNumber": blockchain_result["blockNumber"],
            "canView": new_can_view,
            "canDownload": new_can_download,
            "administeredBy": blockchain_result.get("admin", admin_address)
        })

    except PermissionError as perm_err:
        return jsonify({
            "status": "error",
            "message": str(perm_err)
        }), 403

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/department/audit-log", methods=["GET"])
def get_department_audit_log_route():
    try:
        # Fetch on-chain administrative audit logs
        on_chain_logs = get_admin_audit_history()

        # Fetch SQLite database audit records
        db_logs = get_db_admin_audit_log(limit=100)

        return jsonify({
            "status": "success",
            "onChainCount": len(on_chain_logs),
            "dbCount": len(db_logs),
            "onChainAudit": on_chain_logs,
            "databaseAudit": db_logs
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


# ============================================================
# DOCUMENTATION DOWNLOAD ENDPOINT
# ============================================================

@app.route("/api/docs/<doc_id>", methods=["GET"])
def download_documentation_file(doc_id):
    docs_dir = os.path.join(os.path.dirname(BASE_DIR), "docs")
    file_map = {
        "manual": (os.path.join(docs_dir, "EVIDENCECHAIN_COMPLETE_SYSTEM_MANUAL.md"), "EVIDENCECHAIN_COMPLETE_SYSTEM_MANUAL.md"),
        "walkthrough": (os.path.join(docs_dir, "walkthrough.md"), "walkthrough.md"),
        "plan": (os.path.join(docs_dir, "implementation_plan.md"), "implementation_plan.md"),
        "system-manual-artifact": (os.path.join(docs_dir, "evidencechain_system_manual.md"), "evidencechain_system_manual.md"),
        "all-zip": (os.path.join(docs_dir, "EvidenceChain_Documentation.zip"), "EvidenceChain_Documentation.zip")
    }

    if doc_id not in file_map:
        return jsonify({"error": "Document not found"}), 404

    target_path, download_name = file_map[doc_id]
    if not os.path.exists(target_path):
        target_path = os.path.join(os.path.dirname(BASE_DIR), download_name)

    if not os.path.exists(target_path):
        return jsonify({"error": f"File {download_name} not found on server"}), 404

    return send_file(target_path, as_attachment=True, download_name=download_name)


# ============================================================
# ROOT
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def index():

    return jsonify({

        "service": (
            "EvidenceChain Backend"
        ),

        "status": "running"
    })


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    app.run(

        host="127.0.0.1",

        port=5001,

        debug=True
    )
