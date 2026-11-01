"""
Test Suite: Phase 5 - Evidence Verification Workflow & Truthful Findings
Validates:
1. Exact SHA-256 digest match for historical record returns AUTHENTIC_HISTORICAL
2. Divergent candidate digest returns TAMPERED with fileDigestMatches=False
3. Verification for nonexistent evidence returns 404
4. Empty hash returns 400
5. Truthful separation of file-digest match and on-chain verification
6. Verification for newly registered active record on Port 8546 returns AUTHENTIC and onChainVerified=True
7. Persistent Port 8545 strictly unmodified throughout verification tests
"""

import os
import io
import hashlib
import unittest
import json
import urllib.request
from app import app
from database.db import get_db


class TestPhase5EvidenceVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_ver_")
        cls.uploaded_files = []

        # Record initial block on 8545
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
        # Authenticate as HOD
        self.client.post("/api/auth/demo-switch", json={"email": "hod.cyber@agency.gov.in"})

    def test_01_verify_historical_matching_digest(self):
        """Historical record verification with matching digest returns AUTHENTIC_HISTORICAL."""
        # Find a historical record in DB
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT evidence_id, sha256_hash FROM evidence LIMIT 1")
        row = cur.fetchone()
        conn.close()

        ev_id, recorded_hash = row[0], row[1]

        res = self.client.post(f"/api/evidence/{ev_id}/verify", json={
            "currentHash": recorded_hash
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertTrue(data.get("fileDigestMatches"))
        self.assertEqual(data.get("storedHash"), recorded_hash.lower())
        self.assertEqual(data.get("currentHash"), recorded_hash.lower())
        self.assertIn(data.get("result"), ("AUTHENTIC", "AUTHENTIC_HISTORICAL"))

    def test_02_verify_tampered_digest_detected(self):
        """Tampered candidate hash must return TAMPERED with fileDigestMatches=False."""
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT evidence_id, sha256_hash FROM evidence LIMIT 1")
        row = cur.fetchone()
        conn.close()

        ev_id, recorded_hash = row[0], row[1]
        tampered_hash = "deadbeef" * 8

        res = self.client.post(f"/api/evidence/{ev_id}/verify", json={
            "currentHash": tampered_hash
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertFalse(data.get("fileDigestMatches"))
        self.assertFalse(data.get("isAuthentic"))
        self.assertFalse(data.get("onChainVerified"))
        self.assertEqual(data.get("result"), "TAMPERED")

    def test_03_verify_empty_hash_rejected(self):
        """Empty hash returns 400."""
        res = self.client.post("/api/evidence/EVD-001/verify", json={"currentHash": ""})
        self.assertEqual(res.status_code, 400)

    def test_04_verify_nonexistent_evidence_returns_404(self):
        """Verification of non-existent evidence returns 404."""
        res = self.client.post("/api/evidence/EVD-NONEXISTENT-88888/verify", json={
            "currentHash": "a" * 64
        })
        self.assertEqual(res.status_code, 404)

    def test_05_active_onchain_verification_on_isolated_net(self):
        """Active evidence on isolated testnet confirms onChainVerified=True."""
        # First register an evidence item on port 8546
        content = b"Verification active ledger test content"
        h = hashlib.sha256(content).hexdigest()
        reg_res = self.client.post("/api/evidence/register", data={
            "file": (io.BytesIO(content), "active_verify.bin"),
            "caseId": "CASE-2026-VERIFY-001",
            "clientHash": h
        }, content_type="multipart/form-data")
        self.assertEqual(reg_res.status_code, 201)
        ev_id = reg_res.get_json()["evidenceId"]
        upload_path = os.path.join(self.app.config["UPLOAD_FOLDER"], f"{ev_id}_active_verify.bin")
        self.__class__.uploaded_files.append(upload_path)

        # Now verify it
        ver_res = self.client.post(f"/api/evidence/{ev_id}/verify", json={"currentHash": h})
        self.assertEqual(ver_res.status_code, 200)
        ver_data = ver_res.get_json()
        self.assertEqual(ver_data.get("result"), "AUTHENTIC")
        self.assertTrue(ver_data.get("fileDigestMatches"))
        self.assertTrue(ver_data.get("onChainVerified"))

    def test_06_persistent_8545_unmodified(self):
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
