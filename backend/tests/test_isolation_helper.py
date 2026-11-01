"""
EvidenceChain - Test Isolation & Ephemeral Environment Helper
Ensures all automated tests execute strictly against:
1. An isolated ephemeral database copy in /tmp/
2. An isolated test Anvil node on Port 8546
Enforces fail-closed architecture to prevent persistent state pollution.
"""

import os
import shutil
import tempfile
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
BACKUP_DB = os.getenv(
    "TEST_BASELINE_DB",
    os.path.join(
        PROJECT_ROOT,
        "backups",
        "evidencechain_backup_20261025_214734",
        "evidencechain.db"
    )
)

def setup_isolated_test_environment(prefix="test_ec_"):
    """
    Provisions an ephemeral test database in /tmp/ and points environment
    to the isolated test Anvil node on port 8546.
    """
    temp_fd, temp_path = tempfile.mkstemp(prefix=prefix, suffix=".db")
    os.close(temp_fd)

    candidates = [
        os.getenv("TEST_BASELINE_DB"),
        os.path.join(PROJECT_ROOT, "backups", "evidencechain_backup_20261025_214734", "evidencechain.db"),
        os.path.join(os.path.dirname(PROJECT_ROOT), "EvidenceChain", "backups", "evidencechain_backup_20261025_214734", "evidencechain.db"),
        os.path.join(os.path.dirname(PROJECT_ROOT), "EvidenceChain", "backend", "evidencechain.db"),
        os.path.join(PROJECT_ROOT, "backend", "evidencechain.db"),
    ]
    source_db = next((c for c in candidates if c and os.path.exists(c)), None)

    # Copy clean baseline database
    if source_db:
        shutil.copy2(source_db, temp_path)
    else:
        # Self-contained initialization for standalone clean clones
        import sys
        if BASE_DIR not in sys.path:
            sys.path.insert(0, BASE_DIR)
        os.environ["DATABASE_PATH"] = temp_path
        from database.db import init_db
        init_db()

    os.environ["DATABASE_PATH"] = temp_path
    import sys
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)
    from database.db import seed_demo_users
    seed_demo_users("EvidenceChain@Demo2026!")

    os.environ["BLOCKCHAIN_RPC_URL"] = os.getenv("TEST_RPC_URL", "http://127.0.0.1:8546")
    os.environ["CONTRACT_ADDRESS"] = os.getenv("TEST_CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
    os.environ["FLASK_ENV"] = "testing"

    return temp_path

def teardown_isolated_test_environment(temp_path):
    """Cleanly unlinks the ephemeral test database and resets environment variables."""
    os.environ.pop("DATABASE_PATH", None)
    os.environ.pop("BLOCKCHAIN_RPC_URL", None)
    if temp_path and os.path.exists(temp_path):
        try:
            os.remove(temp_path)
        except OSError:
            pass
