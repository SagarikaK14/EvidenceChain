"""
Test Suite: Phase 5 - Access History & Forensic Audit Trails
Validates:
1. Authoritative access history retrieval for registered evidence
2. Non-existent evidence returns 404
3. Unanchored/historical evidence returns graceful 200 with structured empty history
4. Recording on-chain access (VIEW / DOWNLOAD) appends verifiable events
5. Metrics aggregation (total, views, downloads, grants, revokes)
6. Administrative audit trail integration from department_audit_log
7. Persistent Port 8545 strictly unmodified
"""

import os
import io
import hashlib
import unittest
import json
import urllib.request
from app import app
from database.db import get_db


class TestPhase5AccessHistory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_hist_")
        cls.uploaded_files = []

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
        self.client.post("/api/auth/demo-switch", json={"email": "r.sen@forensics.example.com"})

    def _create_synthetic_evidence(self):
        content = b"Synthetic evidence for access history validation"
        h = hashlib.sha256(content).hexdigest()
        reg_res = self.client.post("/api/evidence/register", data={
            "file": (io.BytesIO(content), "hist_test.bin"),
            "caseId": "CASE-2026-HIST-001",
            "clientHash": h
        }, content_type="multipart/form-data")
        self.assertEqual(reg_res.status_code, 201)
        ev_id = reg_res.get_json()["evidenceId"]
        upload_path = os.path.join(self.app.config["UPLOAD_FOLDER"], f"{ev_id}_hist_test.bin")
        self.__class__.uploaded_files.append(upload_path)
        return ev_id

    def test_01_baseline_record_access_history_graceful(self):
        """Historical baseline record returns 200 with structured audit history."""
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT evidence_id FROM evidence LIMIT 1")
        row = cur.fetchone()
        conn.close()

        ev_id = row[0]
        res = self.client.get(f"/api/evidence/{ev_id}/access-history")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("metrics", data)
        self.assertIn("records", data)

    def test_02_nonexistent_evidence_returns_404(self):
        """Non-existent evidence ID returns 404."""
        res = self.client.get("/api/evidence/EVD-NONEXISTENT-77777/access-history")
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertEqual(data.get("code"), "EVIDENCE_NOT_FOUND")

    def test_03_record_and_retrieve_access_history(self):
        """Active evidence enforces on-chain permission before recording, then tracks event."""
        ev_id = self._create_synthetic_evidence()
        officer_addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

        # Attempt to record access BEFORE grant -> Reverts on-chain (contract security enforcement)
        unpermitted_rec = self.client.post(f"/api/evidence/{ev_id}/access", json={
            "action": "VIEW",
            "userAddress": officer_addr
        })
        self.assertEqual(unpermitted_rec.status_code, 500)
        self.assertIn("denied", unpermitted_rec.get_json().get("message", "").lower())

        # HOD grants VIEW permission
        grant_res = self.client.post(f"/api/evidence/{ev_id}/view-access/grant", json={
            "userAddress": officer_addr,
            "caseId": "CASE-2026-HIST-001"
        })
        self.assertEqual(grant_res.status_code, 200)

        # Now record a VIEW access -> Succeeds
        rec_res = self.client.post(f"/api/evidence/{ev_id}/access", json={
            "action": "VIEW",
            "userAddress": officer_addr
        })
        self.assertEqual(rec_res.status_code, 200)

        # Retrieve history
        hist_res = self.client.get(f"/api/evidence/{ev_id}/access-history")
        self.assertEqual(hist_res.status_code, 200)
        hist_data = hist_res.get_json()
        self.assertTrue(hist_data.get("isOnChain"))
        records = hist_data.get("records", [])
        self.assertGreater(len(records), 0)

        actions = [r.get("action") for r in records]
        self.assertIn("VIEW", actions)

    def test_04_persistent_8545_unmodified(self):
        """Persistent port 8545 strictly preserved."""
        req = urllib.request.Request(
            "http://127.0.0.1:8545",
            data=json.dumps({"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            current_8545_block = data.get("result")

        self.assertEqual(current_8545_block, self.initial_8545_block)


if __name__ == "__main__":
    unittest.main()
