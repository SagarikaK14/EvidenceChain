import sqlite3
import os
import sys
import uuid
import json

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
        try:
            from dotenv import load_dotenv
            load_dotenv(demo_env, override=True)
        except ImportError:
            pass
    else:
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

_load_env()


# ============================================================
# DATABASE LOCATION & ISOLATION GUARDS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

def get_database_path():
    db_path = os.getenv("DATABASE_PATH", "").strip()
    is_demo = os.getenv("PUBLIC_DEMO_MODE", "").strip().lower() in ("1", "true", "yes")
    fail_closed = os.getenv("FAIL_CLOSED", "").strip().lower() in ("1", "true", "yes")

    if is_demo or fail_closed:
        if not db_path:
            raise RuntimeError(
                "FAIL-CLOSED SECURITY ENFORCEMENT: Missing DATABASE_PATH environment variable in demonstration mode. "
                "Refusing to fall back to default development database."
            )
        if "EvidenceChain/backend" in db_path:
            raise RuntimeError(
                "FAIL-CLOSED SECURITY VIOLATION: Demonstration environment attempted to target protected development database. "
                "Operation aborted."
            )
    return db_path or os.path.join(BASE_DIR, "evidencechain.db")

DATABASE = get_database_path()

def verify_db_mutation_isolation():
    """
    Fail-closed runtime guard: prevents test suites or capture scripts from mutating
    the persistent evidencechain.db database.
    """
    flask_env = (os.getenv("FLASK_ENV") or "").lower()
    is_testing = (
        flask_env in ("test", "testing")
        or bool(os.getenv("PYTEST_CURRENT_TEST"))
        or ("unittest" in sys.modules and any("test" in arg.lower() for arg in sys.argv))
    )
    if is_testing:
        cur_db = get_database_path()
        if (cur_db.endswith("evidencechain.db") or os.path.basename(cur_db) == "evidencechain.db") and not os.getenv("ALLOW_TEST_PRIMARY_DB"):
            raise RuntimeError(
                "FAIL-CLOSED SECURITY VIOLATION: Database mutations during tests are strictly prohibited "
                "against the primary persistent database. "
                "Set DATABASE_PATH to an isolated test database in /tmp/."
            )


# ============================================================
# GET DATABASE CONNECTION
# ============================================================

def get_db():

    active_db = get_database_path()

    connection = sqlite3.connect(
        active_db
    )

    connection.row_factory = sqlite3.Row

    return connection


# Alias for compatibility
get_db_connection = get_db


# ============================================================
# INITIALIZE DATABASE
# ============================================================

def init_db():

    connection = get_db()

    cursor = connection.cursor()

    # ========================================================
    # USERS TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            email TEXT UNIQUE NOT NULL,

            password_hash TEXT NOT NULL,

            role TEXT NOT NULL,

            wallet_address TEXT,

            employee_id TEXT,

            department TEXT,

            organization TEXT,

            created_at
                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Check for additional user columns if users table pre-existed
    cursor.execute("PRAGMA table_info(users)")
    cols = [col["name"] for col in cursor.fetchall()]
    if "employee_id" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN employee_id TEXT")
    if "department" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN department TEXT")
    if "organization" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN organization TEXT")

    # ========================================================
    # MFA CHALLENGES TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mfa_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge_id TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            otp_hash TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            attempts INTEGER DEFAULT 0,
            is_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # ========================================================
    # EVIDENCE TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evidence (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            evidence_id TEXT UNIQUE NOT NULL,

            case_id TEXT NOT NULL,

            title TEXT,

            description TEXT,

            file_path TEXT,

            sha256_hash TEXT NOT NULL,

            registered_by INTEGER,

            blockchain_evidence_id TEXT,

            registration_tx_hash TEXT,

            current_custodian TEXT,

            created_at
                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (registered_by)
                REFERENCES users(id)
        )
    """)

    # ========================================================
    # DEPARTMENT AUDIT LOG TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS department_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_address TEXT NOT NULL,
            target_address TEXT NOT NULL,
            target_name TEXT,
            evidence_id TEXT NOT NULL,
            case_id TEXT,
            permission_type TEXT NOT NULL,
            action TEXT NOT NULL,
            tx_hash TEXT,
            block_number INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ========================================================
    # CASES TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            case_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ========================================================
    # CASE ASSIGNMENTS (REPORTING HIERARCHY) TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS case_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id TEXT UNIQUE NOT NULL,
            case_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            case_role TEXT NOT NULL,
            reports_to_assignment_id TEXT,
            responsibility_description TEXT,
            assignment_status TEXT DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (case_id) REFERENCES cases(case_id),
            FOREIGN KEY (reports_to_assignment_id) REFERENCES case_assignments(assignment_id)
        )
    """)

    # ========================================================
    # CASE HIERARCHY AUDIT LOG TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS case_hierarchy_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT NOT NULL,
            action TEXT NOT NULL,
            target_user_id INTEGER,
            target_user_name TEXT,
            assignment_id TEXT,
            old_values TEXT,
            new_values TEXT,
            performed_by_id INTEGER,
            performed_by_name TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ========================================================
    # BLOCKCHAIN DEPLOYMENTS TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blockchain_deployments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ledger_instance_id TEXT UNIQUE NOT NULL,
            chain_id INTEGER NOT NULL,
            contract_address TEXT NOT NULL,
            deployment_tx_hash TEXT,
            deployment_block_number INTEGER,
            deployment_block_hash TEXT,
            code_hash TEXT,
            is_active INTEGER DEFAULT 1,
            deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT
        )
    """)

    # ========================================================
    # EVIDENCE ANCHORING EVENTS TABLE
    # ========================================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evidence_anchoring_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT UNIQUE NOT NULL,
            evidence_id TEXT NOT NULL,
            event_type TEXT NOT NULL, -- 'ORIGINAL_REGISTRATION', 'HISTORICAL_PRESERVED', 'RE_ANCHOR'
            chain_id INTEGER,
            contract_address TEXT,
            ledger_instance_id TEXT,
            tx_hash TEXT,
            block_number INTEGER,
            block_hash TEXT,
            evidence_hash TEXT NOT NULL,
            anchored_by TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id)
        )
    """)

    # Ensure additive columns exist on evidence table
    cursor.execute("PRAGMA table_info(evidence)")
    existing_ev_cols = {row["name"] for row in cursor.fetchall()}
    ev_additive_cols = [
        ("original_registration_tx_hash", "TEXT"),
        ("anchor_block_number", "INTEGER"),
        ("anchor_contract_address", "TEXT"),
        ("anchor_chain_id", "INTEGER"),
        ("ledger_instance_id", "TEXT"),
        ("provenance_status", "TEXT"),
    ]
    for col_name, col_type in ev_additive_cols:
        if col_name not in existing_ev_cols:
            cursor.execute(f"ALTER TABLE evidence ADD COLUMN {col_name} {col_type}")

    connection.commit()
    connection.close()

    # Synchronize cases from evidence table
    sync_cases_from_evidence()


# ============================================================
# SEED DEMO USERS
# ============================================================

DEFAULT_DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "EvidenceChain@Demo2026!")

DEMO_USERS = [
    {
        "name": "Dr. Rajeshwar Sen",
        "email": "r.sen@forensics.example.com",
        "role": "Head of Department",
        "employee_id": "HOD-0001",
        "department": "Forensics Headquarters",
        "organization": "State Directorate of Forensic Sciences",
        "wallet_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    },
    {
        "name": "Rahul Sharma",
        "email": "r.sharma@forensics.example.com",
        "role": "Senior Forensic Officer",
        "employee_id": "OFF-1024",
        "department": "Cyber Crime Investigation Unit",
        "organization": "Metropolitan Police Department",
        "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    },
    {
        "name": "Ananya Patel",
        "email": "a.patel@forensics.example.com",
        "role": "Digital Forensics Analyst",
        "employee_id": "OFF-2048",
        "department": "Digital Evidence Review Board",
        "organization": "State Forensic Science Laboratory",
        "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    },
    {
        "name": "Sunita Rao",
        "email": "s.rao@forensics.example.com",
        "role": "Evidence Custodian",
        "employee_id": "CUST-4096",
        "department": "Central Evidence Vault",
        "organization": "Judicial Evidence Repository",
        "wallet_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
    },
    {
        "name": "Vikram Mehta",
        "email": "v.mehta@forensics.example.com",
        "role": "Investigating Officer",
        "employee_id": "EXAM-512",
        "department": "Judicial Forensic Commission",
        "organization": "High Court Special Investigation Team",
        "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
    }
]


def seed_demo_users(default_password=None):
    """
    Idempotently seed the 5 demo institutional employee accounts.
    Stores passwords hashed with Werkzeug (never plaintext).
    The password is read from DEMO_USER_PASSWORD environment variable,
    parameter, or defaults to a safe demonstration placeholder.
    """
    from werkzeug.security import generate_password_hash

    pwd = default_password or os.getenv("DEMO_USER_PASSWORD", DEFAULT_DEMO_PASSWORD)

    connection = get_db()
    cursor = connection.cursor()

    for u in DEMO_USERS:
        cursor.execute("SELECT id FROM users WHERE email = ?", (u["email"],))
        row = cursor.fetchone()
        user_pwd = u.get("password", pwd)
        hashed = generate_password_hash(user_pwd)
        if row:
            cursor.execute("""
                UPDATE users
                SET name = ?, password_hash = ?, role = ?, wallet_address = ?,
                    employee_id = ?, department = ?, organization = ?
                WHERE email = ?
            """, (
                u["name"], hashed, u["role"], u["wallet_address"],
                u["employee_id"], u["department"], u["organization"], u["email"]
            ))
        else:
            cursor.execute("""
                INSERT INTO users (
                    name, email, password_hash, role, wallet_address,
                    employee_id, department, organization
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                u["name"], u["email"], hashed, u["role"], u["wallet_address"],
                u["employee_id"], u["department"], u["organization"]
            ))

    connection.commit()
    connection.close()


# ============================================================
# SAVE EVIDENCE
# ============================================================

def save_evidence(
    evidence_id,
    case_id,
    title,
    description,
    file_path,
    sha256_hash,
    registered_by=None,
    blockchain_evidence_id=None,
    registration_tx_hash=None,
    current_custodian=None,
    anchor_block_number=None,
    anchor_contract_address=None,
    anchor_chain_id=None,
    ledger_instance_id=None
):
    verify_db_mutation_isolation()

    connection = get_db()
    cursor = connection.cursor()

    provenance_status = "VERIFIED_ACTIVE" if registration_tx_hash else "NEVER_ANCHORED"

    cursor.execute("""
        INSERT INTO evidence (
            evidence_id,
            case_id,
            title,
            description,
            file_path,
            sha256_hash,
            registered_by,
            blockchain_evidence_id,
            registration_tx_hash,
            current_custodian,
            original_registration_tx_hash,
            anchor_block_number,
            anchor_contract_address,
            anchor_chain_id,
            ledger_instance_id,
            provenance_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        evidence_id,
        case_id,
        title,
        description,
        file_path,
        sha256_hash,
        registered_by,
        blockchain_evidence_id,
        registration_tx_hash,
        current_custodian,
        registration_tx_hash,  # original_registration_tx_hash permanently set
        anchor_block_number,
        anchor_contract_address or ("0x5FbDB2315678afecb367f032d93F642f64180aa3" if registration_tx_hash else None),
        anchor_chain_id or (31337 if registration_tx_hash else None),
        ledger_instance_id,
        provenance_status
    ))

    # Record in evidence_anchoring_events if anchored
    if registration_tx_hash:
        event_id = f"EVT-ANCHOR-{evidence_id}"
        cursor.execute("""
            INSERT OR IGNORE INTO evidence_anchoring_events (
                event_id, evidence_id, event_type, chain_id,
                contract_address, ledger_instance_id, tx_hash,
                block_number, evidence_hash, anchored_by, notes
            ) VALUES (?, ?, 'ORIGINAL_REGISTRATION', ?, ?, ?, ?, ?, ?, ?, 'Original evidence registration anchor')
        """, (
            event_id,
            evidence_id,
            anchor_chain_id or 31337,
            anchor_contract_address or "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            ledger_instance_id or "ACTIVE_LEDGER",
            registration_tx_hash,
            anchor_block_number,
            sha256_hash,
            current_custodian or "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        ))

    # Synchronize cases registry with new case reference
    cursor.execute("""
        INSERT OR IGNORE INTO cases (case_id, title, description, status)
        VALUES (?, ?, ?, 'ACTIVE')
    """, (case_id, f"Forensic Docket {case_id}", description or "Judicial evidence docket."))

    connection.commit()
    connection.close()


# ============================================================
# UPDATE CUSTODIAN
# ============================================================

def update_custodian(
    evidence_id,
    new_custodian
):

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute("""
        UPDATE evidence

        SET current_custodian = ?

        WHERE evidence_id = ?
    """, (

        new_custodian,

        evidence_id
    ))

    connection.commit()

    rows_updated = cursor.rowcount

    connection.close()

    return rows_updated


# ============================================================
# GET EVIDENCE METADATA
# ============================================================

def get_evidence_metadata(
    evidence_id
):

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute("""
        SELECT *

        FROM evidence

        WHERE evidence_id = ?
    """, (
        evidence_id,
    ))

    row = cursor.fetchone()

    connection.close()

    if row:

        return dict(row)

    return None


# ============================================================
# DEPARTMENT AUDIT LOG HELPERS
# ============================================================

def save_admin_audit_log(
    admin_address,
    target_address,
    target_name,
    evidence_id,
    case_id,
    permission_type,
    action,
    tx_hash,
    block_number
):
    connection = get_db()
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO department_audit_log (
            admin_address,
            target_address,
            target_name,
            evidence_id,
            case_id,
            permission_type,
            action,
            tx_hash,
            block_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        admin_address,
        target_address,
        target_name,
        evidence_id,
        case_id,
        permission_type,
        action,
        tx_hash,
        block_number
    ))
    connection.commit()
    connection.close()


def get_db_admin_audit_log(limit=100):
    connection = get_db()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT
            id,
            admin_address,
            target_address,
            target_name,
            evidence_id,
            case_id,
            permission_type,
            action,
            tx_hash,
            block_number,
            created_at
        FROM department_audit_log
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    connection.close()
    return [dict(row) for row in rows]


# ============================================================
# CASES & ORGANIZATIONAL HIERARCHY HELPERS
# ============================================================

KNOWN_CASE_METADATA = {
    "CASE-2026-CYBER-091": {
        "title": "State Financial Gateway Security Breach",
        "description": "Digital forensics investigation into server tampering, database intrusions, and unauthorized log alterations.",
        "status": "UNDER_INVESTIGATION"
    },
    "CASE-2026-PDF-9041": {
        "title": "Financial Audit Document Verification",
        "description": "Multi-page forensic scrutiny of suspected altered audit documentation and fabricated digital signatures.",
        "status": "ACTIVE"
    },
    "CASE-ACCESS-E2E-001": {
        "title": "Access Management System Verification",
        "description": "Verification dossier for access management controls and cryptographic token verifications.",
        "status": "ACTIVE"
    },
    "CASE-DOC-001": {
        "title": "Document Authenticity Review",
        "description": "Forensic evaluation of extracted metadata from seized word processing documents.",
        "status": "ACTIVE"
    },
    "CASE-FINAL-DEMO-001": {
        "title": "Judicial Evidence Demonstration Dossier",
        "description": "High Court demonstration dossier for tamper-evident blockchain verification.",
        "status": "ACTIVE"
    }
}


def sync_cases_from_evidence():
    """
    Synchronizes cases from evidence table so all existing cases are represented
    with titles and status, without inventing fake personnel assignments.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT case_id FROM evidence WHERE case_id IS NOT NULL AND case_id != ''")
    case_ids = [r["case_id"] for r in cursor.fetchall()]

    for cid in case_ids:
        cursor.execute("SELECT case_id FROM cases WHERE case_id = ?", (cid,))
        if not cursor.fetchone():
            meta = KNOWN_CASE_METADATA.get(cid, {
                "title": f"Forensic Docket {cid}",
                "description": f"Active digital evidence registry and investigation for {cid}.",
                "status": "ACTIVE"
            })
            cursor.execute("""
                INSERT INTO cases (case_id, title, description, status)
                VALUES (?, ?, ?, ?)
            """, (cid, meta["title"], meta["description"], meta.get("status", "ACTIVE")))

    conn.commit()
    conn.close()


def get_all_cases_with_stats():
    """
    Retrieve all cases with assigned officer count and evidence item count.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            c.case_id,
            c.title,
            c.description,
            c.status,
            c.created_at,
            (SELECT COUNT(*) FROM case_assignments ca WHERE ca.case_id = c.case_id AND ca.assignment_status = 'ACTIVE') as assigned_officer_count,
            (SELECT COUNT(*) FROM evidence e WHERE e.case_id = c.case_id) as evidence_count
        FROM cases c
        ORDER BY c.case_id ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_case_assignments_list(case_id, active_only=True):
    """
    Retrieve flat list of assignments for a case with enriched officer and supervisor details.
    """
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT
            ca.id,
            ca.assignment_id,
            ca.case_id,
            ca.user_id,
            ca.case_role,
            ca.reports_to_assignment_id,
            ca.responsibility_description,
            ca.assignment_status,
            ca.created_at,
            ca.updated_at,
            ca.created_by,
            ca.updated_by,
            u.name as officer_name,
            u.email as officer_email,
            u.employee_id as officer_employee_id,
            u.role as official_designation,
            u.department as officer_department,
            u.organization as officer_organization,
            u.wallet_address as officer_wallet,
            sup_u.name as supervisor_name,
            sup_ca.case_role as supervisor_role,
            sup_u.employee_id as supervisor_employee_id
        FROM case_assignments ca
        JOIN users u ON ca.user_id = u.id
        LEFT JOIN case_assignments sup_ca ON ca.reports_to_assignment_id = sup_ca.assignment_id
        LEFT JOIN users sup_u ON sup_ca.user_id = sup_u.id
        WHERE ca.case_id = ?
    """
    if active_only:
        query += " AND ca.assignment_status = 'ACTIVE'"
    query += " ORDER BY ca.id ASC"

    cursor.execute(query, (case_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def build_case_hierarchy_tree_structure(case_id):
    """
    Builds a professional case reporting tree.
    Returns:
    - case: metadata
    - hasAssignments: bool
    - totalAssigned: int
    - leadsCount: int
    - roots: list of root nodes with children
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT case_id, title, description, status FROM cases WHERE case_id = ?", (case_id,))
    case_row = cursor.fetchone()
    conn.close()

    case_info = dict(case_row) if case_row else {
        "case_id": case_id,
        "title": f"Case {case_id}",
        "description": "",
        "status": "ACTIVE"
    }

    assignments = get_case_assignments_list(case_id, active_only=True)
    if not assignments:
        return {
            "case": case_info,
            "hasAssignments": False,
            "totalAssigned": 0,
            "leadsCount": 0,
            "roots": [],
            "assignments": []
        }

    asg_map = {
        a["assignment_id"]: {
            "assignmentId": a["assignment_id"],
            "assignment_id": a["assignment_id"],
            "userId": a["user_id"],
            "user_id": a["user_id"],
            "officerName": a["officer_name"],
            "officer_name": a["officer_name"],
            "officerEmail": a["officer_email"],
            "officer_email": a["officer_email"],
            "employeeId": a["officer_employee_id"],
            "officerEmployeeId": a["officer_employee_id"],
            "officer_employee_id": a["officer_employee_id"],
            "officialDesignation": a["official_designation"],
            "official_designation": a["official_designation"],
            "caseRole": a["case_role"],
            "case_role": a["case_role"],
            "reportsToAssignmentId": a["reports_to_assignment_id"],
            "reports_to_assignment_id": a["reports_to_assignment_id"],
            "supervisorName": a["supervisor_name"],
            "supervisor_name": a["supervisor_name"],
            "supervisorRole": a["supervisor_role"],
            "supervisor_role": a["supervisor_role"],
            "supervisorEmployeeId": a["supervisor_employee_id"],
            "supervisor_employee_id": a["supervisor_employee_id"],
            "responsibilities": a["responsibility_description"],
            "responsibility_description": a["responsibility_description"],
            "status": a["assignment_status"],
            "assignmentStatus": a["assignment_status"],
            "assignment_status": a["assignment_status"],
            "department": a["officer_department"],
            "officerDepartment": a["officer_department"],
            "officer_department": a["officer_department"],
            "organization": a["officer_organization"],
            "officerOrganization": a["officer_organization"],
            "officer_organization": a["officer_organization"],
            "walletAddress": a["officer_wallet"],
            "officerWallet": a["officer_wallet"],
            "officer_wallet": a["officer_wallet"],
            "createdAt": a["created_at"],
            "created_at": a["created_at"],
            "updatedAt": a["updated_at"],
            "updated_at": a["updated_at"],
            "createdBy": a["created_by"],
            "created_by": a["created_by"],
            "updatedBy": a["updated_by"],
            "updated_by": a["updated_by"],
            "children": []
        }
        for a in assignments
    }

    roots = []
    leads_count = 0

    for a in assignments:
        node = asg_map[a["assignment_id"]]
        sup_id = a.get("reports_to_assignment_id")
        role_lower = (a.get("case_role") or "").lower()
        is_lead = any(w in role_lower for w in ["lead", "head", "commander", "director"])
        is_joint = any(w in role_lower for w in ["joint", "peer", "collaborat", "co-lead", "co-investigat"])
        node["isLead"] = is_lead
        node["isJointInvestigator"] = is_joint
        node["isPeerCollaborator"] = is_joint
        if is_lead:
            leads_count += 1

        if not sup_id or sup_id not in asg_map:
            roots.append(node)
        else:
            asg_map[sup_id]["children"].append(node)

    def assign_depth(curr_node, current_depth):
        curr_node["depth"] = current_depth
        for child in curr_node.get("children", []):
            assign_depth(child, current_depth + 1)

    for r in roots:
        assign_depth(r, 0)

    return {
        "case": case_info,
        "hasAssignments": True,
        "totalAssigned": len(assignments),
        "leadsCount": leads_count,
        "roots": roots,
        "assignments": list(asg_map.values())
    }


def check_circular_reporting(case_id, assignment_id, target_supervisor_assignment_id):
    """
    Validates that setting target_supervisor_assignment_id as the supervisor for assignment_id
    does not create a cycle or circular reference.
    Returns (is_valid: bool, error_message: str or None)
    """
    if not target_supervisor_assignment_id:
        return True, None
    if assignment_id and assignment_id == target_supervisor_assignment_id:
        return False, "An officer cannot report to themselves."

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT assignment_id, reports_to_assignment_id, user_id
        FROM case_assignments
        WHERE assignment_id = ? AND case_id = ? AND assignment_status = 'ACTIVE'
    """, (target_supervisor_assignment_id, case_id))
    sup_row = cursor.fetchone()
    if not sup_row:
        conn.close()
        return False, f"Supervisor assignment '{target_supervisor_assignment_id}' does not exist as an active assignment in case '{case_id}'."

    visited = set()
    if assignment_id:
        visited.add(assignment_id)
    curr = target_supervisor_assignment_id

    while curr:
        if curr in visited:
            conn.close()
            return False, "Circular reporting hierarchy detected: an officer cannot report to their own subordinate or create a reporting loop."
        visited.add(curr)
        cursor.execute("""
            SELECT reports_to_assignment_id
            FROM case_assignments
            WHERE assignment_id = ? AND case_id = ? AND assignment_status = 'ACTIVE'
        """, (curr, case_id))
        row = cursor.fetchone()
        if not row or not row["reports_to_assignment_id"]:
            break
        curr = row["reports_to_assignment_id"]

    conn.close()
    return True, None


def add_case_assignment(case_id, user_id, case_role, reports_to_assignment_id, responsibility_description, performed_by_user):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT case_id FROM cases WHERE case_id = ?", (case_id,))
    if not cursor.fetchone():
        # Auto-register case if not yet in cases table
        meta = KNOWN_CASE_METADATA.get(case_id, {
            "title": f"Forensic Docket {case_id}",
            "description": f"Active digital evidence registry and investigation for {case_id}.",
            "status": "ACTIVE"
        })
        cursor.execute("""
            INSERT INTO cases (case_id, title, description, status)
            VALUES (?, ?, ?, ?)
        """, (case_id, meta["title"], meta["description"], meta.get("status", "ACTIVE")))

    cursor.execute("SELECT id, name, employee_id, role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise ValueError(f"User ID {user_id} not found.")

    cursor.execute("""
        SELECT id, assignment_id FROM case_assignments
        WHERE case_id = ? AND user_id = ? AND assignment_status = 'ACTIVE'
    """, (case_id, user_id))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise ValueError(f"Officer {user['name']} already holds an active assignment ({existing['assignment_id']}) in case {case_id}.")

    assignment_id = f"ASG-{uuid.uuid4().hex[:8].upper()}"
    if reports_to_assignment_id:
        is_valid, err = check_circular_reporting(case_id, assignment_id, reports_to_assignment_id)
        if not is_valid:
            conn.close()
            raise ValueError(err)

    creator_name = performed_by_user.get("name", "System Administrator")
    cursor.execute("""
        INSERT INTO case_assignments (
            assignment_id, case_id, user_id, case_role, reports_to_assignment_id,
            responsibility_description, assignment_status, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    """, (
        assignment_id, case_id, user_id, case_role,
        reports_to_assignment_id if reports_to_assignment_id else None,
        responsibility_description, creator_name, creator_name
    ))

    new_vals = json.dumps({
        "assignmentId": assignment_id,
        "caseRole": case_role,
        "reportsTo": reports_to_assignment_id,
        "responsibilities": responsibility_description
    })
    cursor.execute("""
        INSERT INTO case_hierarchy_audit_log (
            case_id, action, target_user_id, target_user_name, assignment_id,
            old_values, new_values, performed_by_id, performed_by_name, details
        ) VALUES (?, 'ASSIGN', ?, ?, ?, NULL, ?, ?, ?, ?)
    """, (
        case_id, user_id, user["name"], assignment_id,
        new_vals, performed_by_user.get("id"), creator_name,
        f"Assigned {user['name']} to {case_id} as {case_role}."
    ))

    conn.commit()
    conn.close()
    return assignment_id


def update_case_assignment(case_id, assignment_id, case_role, reports_to_assignment_id, responsibility_description, performed_by_user):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT ca.*, u.name as user_name
        FROM case_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.assignment_id = ? AND ca.case_id = ? AND ca.assignment_status = 'ACTIVE'
    """, (assignment_id, case_id))
    cur_asg = cursor.fetchone()
    if not cur_asg:
        conn.close()
        raise ValueError(f"Active assignment '{assignment_id}' not found in case '{case_id}'.")

    if reports_to_assignment_id and reports_to_assignment_id != cur_asg["reports_to_assignment_id"]:
        is_valid, err = check_circular_reporting(case_id, assignment_id, reports_to_assignment_id)
        if not is_valid:
            conn.close()
            raise ValueError(err)

    old_vals = json.dumps({
        "caseRole": cur_asg["case_role"],
        "reportsTo": cur_asg["reports_to_assignment_id"],
        "responsibilities": cur_asg["responsibility_description"]
    })

    editor_name = performed_by_user.get("name", "System Administrator")

    cursor.execute("""
        UPDATE case_assignments
        SET case_role = ?, reports_to_assignment_id = ?, responsibility_description = ?,
            updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE assignment_id = ? AND case_id = ?
    """, (
        case_role,
        reports_to_assignment_id if reports_to_assignment_id else None,
        responsibility_description,
        editor_name,
        assignment_id,
        case_id
    ))

    new_vals = json.dumps({
        "caseRole": case_role,
        "reportsTo": reports_to_assignment_id,
        "responsibilities": responsibility_description
    })

    action = "UPDATE_ROLE"
    if cur_asg["reports_to_assignment_id"] != reports_to_assignment_id:
        action = "REASSIGN_SUPERVISOR"
    elif cur_asg["case_role"] != case_role and "lead" in case_role.lower():
        action = "REASSIGN_LEAD"

    cursor.execute("""
        INSERT INTO case_hierarchy_audit_log (
            case_id, action, target_user_id, target_user_name, assignment_id,
            old_values, new_values, performed_by_id, performed_by_name, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        case_id, action, cur_asg["user_id"], cur_asg["user_name"], assignment_id,
        old_vals, new_vals, performed_by_user.get("id"), editor_name,
        f"Updated assignment for {cur_asg['user_name']} in {case_id}."
    ))

    conn.commit()
    conn.close()
    return True


def remove_case_assignment(case_id, assignment_id, performed_by_user):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT ca.*, u.name as user_name
        FROM case_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.assignment_id = ? AND ca.case_id = ? AND ca.assignment_status = 'ACTIVE'
    """, (assignment_id, case_id))
    cur_asg = cursor.fetchone()
    if not cur_asg:
        conn.close()
        raise ValueError(f"Active assignment '{assignment_id}' not found in case '{case_id}'.")

    supervisor_of_deleted = cur_asg["reports_to_assignment_id"]
    editor_name = performed_by_user.get("name", "System Administrator")

    # Safe subordinate handling: re-parent direct subordinates to the deleted officer's supervisor
    cursor.execute("""
        SELECT assignment_id, user_id
        FROM case_assignments
        WHERE reports_to_assignment_id = ? AND case_id = ? AND assignment_status = 'ACTIVE'
    """, (assignment_id, case_id))
    subordinates = cursor.fetchall()

    for sub in subordinates:
        cursor.execute("""
            UPDATE case_assignments
            SET reports_to_assignment_id = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE assignment_id = ?
        """, (supervisor_of_deleted, editor_name, sub["assignment_id"]))

        cursor.execute("""
            INSERT INTO case_hierarchy_audit_log (
                case_id, action, target_user_id, target_user_name, assignment_id,
                old_values, new_values, performed_by_id, performed_by_name, details
            ) VALUES (?, 'REASSIGN_SUPERVISOR', ?, NULL, ?, ?, ?, ?, ?, ?)
        """, (
            case_id, sub["user_id"], sub["assignment_id"],
            json.dumps({"reportsTo": assignment_id}),
            json.dumps({"reportsTo": supervisor_of_deleted}),
            performed_by_user.get("id"), editor_name,
            f"Automatically re-parented subordinate {sub['assignment_id']} to {supervisor_of_deleted or 'Case Root'} following supervisor removal."
        ))

    # Mark assignment INACTIVE
    cursor.execute("""
        UPDATE case_assignments
        SET assignment_status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE assignment_id = ?
    """, (editor_name, assignment_id))

    cursor.execute("""
        INSERT INTO case_hierarchy_audit_log (
            case_id, action, target_user_id, target_user_name, assignment_id,
            old_values, new_values, performed_by_id, performed_by_name, details
        ) VALUES (?, 'REMOVE', ?, ?, ?, ?, NULL, ?, ?, ?)
    """, (
        case_id, cur_asg["user_id"], cur_asg["user_name"], assignment_id,
        json.dumps({"caseRole": cur_asg["case_role"], "status": "ACTIVE"}),
        performed_by_user.get("id"), editor_name,
        f"Removed officer {cur_asg['user_name']} from case {case_id} team."
    ))

    conn.commit()
    conn.close()
    return True


def get_case_hierarchy_audit_log(case_id, limit=100):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, case_id, action, target_user_id, target_user_name, assignment_id,
               old_values, new_values, performed_by_id, performed_by_name, details, created_at
        FROM case_hierarchy_audit_log
        WHERE case_id = ?
        ORDER BY id DESC
        LIMIT ?
    """, (case_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    init_db()

    print(
        "SQLite database initialized."
    )
