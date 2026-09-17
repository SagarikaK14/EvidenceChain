import sqlite3
import os


# ============================================================
# DATABASE LOCATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DATABASE = os.path.join(
    BASE_DIR,
    "evidencechain.db"
)


# ============================================================
# GET DATABASE CONNECTION
# ============================================================

def get_db():

    connection = sqlite3.connect(
        DATABASE
    )

    connection.row_factory = sqlite3.Row

    return connection


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

            created_at
                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    current_custodian=None
):

    connection = get_db()

    cursor = connection.cursor()

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

            current_custodian

        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

        current_custodian
    ))

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
# MAIN
# ============================================================

if __name__ == "__main__":

    init_db()

    print(
        "SQLite database initialized."
    )
