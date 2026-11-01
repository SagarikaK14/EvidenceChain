"""
Test Suite: Phase 5 - Evidence Registration Workflow & Integrity Protection
Validates:
1. Registration with valid PDF evidence in isolated environment (Port 8546)
2. Accurate SHA-256 digest computation matching client-side calculations
3. Explicit clientHash verification success when clientHash matches server digest
4. Rejection of corrupted/tampered upload with mismatched clientHash (HTTP 400)
5. Rejection of registration request missing file (HTTP 400)
6. Rejection of registration request with empty filename (HTTP 400)
7. Rejection of registration request missing Case ID (HTTP 400)
8. Transaction hash and block number returned from isolated testnet
9. Database record correctly saved with file_path and sha256_hash
10. Fail-closed safeguard: persistent blockchain (Port 8545) block height strictly unchanged
"""

import os
import io
import hashlib
import unittest
import json
import urllib.request
from app import app
from database.db import get_db


class TestPhase5EvidenceRegistration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_reg_")
        cls.uploaded_files = []

        # Check initial persistent node block height
        req = urllib.request.Request(
            "http://127.0.0.1:8545",
            data=json.dumps({"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            cls.initial_8545_block = data.get("result")

    @classmethod
    def tearDownClass(cls):
        from tests.test_isolation_helper import teardown_isolated_test_environment
        teardown_isolated_test_environment(cls.temp_db)
        # Clean up any test uploads
        for f in cls.uploaded_files:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except OSError:
                    pass

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["BLOCKCHAIN_RPC_URL"] = "http://127.0.0.1:8546"
        os.environ["DATABASE_PATH"] = self.temp_db
        os.environ["FLASK_ENV"] = "testing"
        # Authenticate as HOD
        self.client.post("/api/auth/demo-switch", json={"email": "hod.cyber@agency.gov.in"})

    def test_01_register_valid_evidence_isolated(self):
        """Registering synthetic evidence against Port 8546 succeeds and returns tx info."""
        content = b"%PDF-1.4 synthetic automated evidence content for phase 5 test 01"
        computed_hash = hashlib.sha256(content).hexdigest()

        data = {
            "file": (io.BytesIO(content), "phase5_test_synthetic.pdf"),
            "caseId": "CASE-2026-PHASE5-001",
            "description": "Synthetic PDF for automated Phase 5 registration validation",
            "clientHash": computed_hash
        }

        res = self.client.post("/api/evidence/register", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 201)
        res_data = res.get_json()

        self.assertEqual(res_data.get("status"), "success")
        ev_id = res_data.get("evidenceId")
        self.assertTrue(ev_id.startswith("EVD-"))
        self.assertEqual(res_data.get("evidenceHash"), computed_hash)
        self.assertTrue(res_data.get("transactionHash"))
        self.assertGreater(res_data.get("blockNumber"), 0)

        # Track upload path for cleanup
        upload_path = os.path.join(self.app.config["UPLOAD_FOLDER"], f"{ev_id}_phase5_test_synthetic.pdf")
        self.__class__.uploaded_files.append(upload_path)

        # Verify record exists in ephemeral DB
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT sha256_hash, case_id FROM evidence WHERE evidence_id = ?", (ev_id,))
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], computed_hash)
        self.assertEqual(row[1], "CASE-2026-PHASE5-001")

    def test_02_register_with_mismatched_client_hash_rejected(self):
        """Mismatched clientHash must fail with 400 and reject upload."""
        content = b"Content to test client-side hash mismatch detection"
        fake_hash = "0000000000000000000000000000000000000000000000000000000000000000"

        data = {
            "file": (io.BytesIO(content), "corrupt_transit.bin"),
            "caseId": "CASE-2026-PHASE5-002",
            "description": "File with corrupted transit digest",
            "clientHash": fake_hash
        }

        res = self.client.post("/api/evidence/register", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 400)
        res_data = res.get_json()
        self.assertEqual(res_data.get("status"), "error")
        self.assertIn("Integrity check failed", res_data.get("message", ""))

    def test_03_register_missing_file_rejected(self):
        """Missing file field returns 400."""
        data = {
            "caseId": "CASE-2026-PHASE5-003",
            "description": "Registration with no file payload"
        }
        res = self.client.post("/api/evidence/register", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get("status"), "error")

    def test_04_register_missing_case_id_rejected(self):
        """Missing caseId returns 400."""
        content = b"Content with missing case id"
        data = {
            "file": (io.BytesIO(content), "nocase.txt"),
            "caseId": "",
            "description": "Missing case ID"
        }
        res = self.client.post("/api/evidence/register", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Case ID is required", res.get_json().get("message", ""))

    def test_05_register_empty_filename_rejected(self):
        """Empty filename returns 400."""
        data = {
            "file": (io.BytesIO(b"data"), ""),
            "caseId": "CASE-2026-PHASE5-004"
        }
        res = self.client.post("/api/evidence/register", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 400)

    def test_06_persistent_8545_strictly_unmodified(self):
        """Verify persistent node on Port 8545 remained at exactly the initial block height."""
        req = urllib.request.Request(
            "http://127.0.0.1:8545",
            data=json.dumps({"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            current_8545_block = data.get("result")

        self.assertEqual(
            current_8545_block,
            self.initial_8545_block,
            f"CRITICAL VIOLATION: Persistent Anvil (8545) moved from {self.initial_8545_block} to {current_8545_block}!"
        )


if __name__ == "__main__":
    unittest.main()
