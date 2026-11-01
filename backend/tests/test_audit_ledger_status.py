"""
Test Suite for Centralized Ledger Status, Evidence Continuity, and Verification Consistency
Validates:
1. GET /api/evidence returns authoritative breakdown (totalCount, activeLedgerCount, historicalCount)
2. Historical evidence records (e.g. EVD-287CA65A) return 200 on GET /api/evidence/<id> with HISTORICAL_RECORD status
3. Active evidence records (e.g. EVD-5C87A12D) return 200 with VERIFIED_ACTIVE status
4. POST /api/evidence/<id>/verify correctly verifies active on-chain records
5. POST /api/evidence/<id>/verify correctly reports AUTHENTIC_HISTORICAL when file digest matches historical record
6. POST /api/evidence/<id>/verify correctly detects TAMPERED when digest diverges
7. POST /api/evidence/register enforces clientHash validation when provided
"""

import os
import unittest
import json
import io
from app import app
from database.db import get_db

class TestAuditLedgerStatus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_audit_")

    @classmethod
    def tearDownClass(cls):
        from tests.test_isolation_helper import teardown_isolated_test_environment
        teardown_isolated_test_environment(cls.temp_db)

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["BLOCKCHAIN_RPC_URL"] = "http://127.0.0.1:8546"
        os.environ["DATABASE_PATH"] = self.temp_db
        os.environ["FLASK_ENV"] = "testing"
        # Authenticate as Head of Department
        self.client.post("/api/auth/demo-switch", json={"email": "hod.cyber@agency.gov.in"})

    def test_01_list_evidence_returns_authoritative_ledger_counts(self):
        """GET /api/evidence must return authoritative counts matching System Health diagnostics."""
        res = self.client.get("/api/evidence")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("totalCount", data)
        self.assertIn("activeLedgerCount", data)
        self.assertIn("historicalCount", data)

        self.assertEqual(data["totalCount"], 27)
        total_reconciled = (
            data["activeLedgerCount"] +
            data["historicalCount"] +
            data.get("neverAnchoredCount", 0) +
            data.get("pendingCount", 0) +
            data.get("unavailableCount", 0)
        )
        self.assertEqual(total_reconciled, 27)

        # Ensure every item has a recognized ledgerStatus
        for item in data.get("evidence", []):
            self.assertIn(item.get("ledgerStatus"), ["VERIFIED_ACTIVE", "HISTORICAL_RECORD", "NEVER_ANCHORED", "PENDING_VERIFICATION", "VERIFICATION_UNAVAILABLE"])
            if item["ledgerStatus"] == "VERIFIED_ACTIVE":
                self.assertTrue(item.get("isOnChain"))
            else:
                self.assertFalse(item.get("isOnChain"))

    def _create_temp_active_evidence(self, prefix="TEST-AUDIT-ACTIVE"):
        import uuid
        ev_id = f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
        from blockchain import register_evidence
        from database.db import save_evidence, get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM blockchain_deployments WHERE is_active = 1")
        deploy = dict(cursor.fetchone() or {})
        conn.close()

        test_hash = "a" * 64
        tx_res = register_evidence(ev_id, "CASE-TEST-AUDIT", test_hash)
        save_evidence(
            evidence_id=ev_id,
            case_id="CASE-TEST-AUDIT",
            title="test_active.txt",
            description="Active evidence test record",
            file_path="",
            sha256_hash=test_hash,
            registered_by="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            blockchain_evidence_id=ev_id,
            registration_tx_hash=tx_res["transactionHash"],
            anchor_block_number=tx_res.get("blockNumber"),
            anchor_contract_address=deploy.get("contract_address"),
            anchor_chain_id=deploy.get("chain_id"),
            ledger_instance_id=deploy.get("ledger_instance_id")
        )
        return ev_id, test_hash

    def _cleanup_temp_evidence(self, ev_id):
        from database.db import get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM evidence WHERE evidence_id = ?", (ev_id,))
        cursor.execute("DELETE FROM evidence_anchoring_events WHERE evidence_id = ?", (ev_id,))
        conn.commit()
        conn.close()

    def test_02_get_active_evidence_details(self):
        """Active evidence record must return VERIFIED_ACTIVE and isOnChain: True."""
        ev_id, _ = self._create_temp_active_evidence("TEST-EVD-ACT-02")
        try:
            res = self.client.get(f"/api/evidence/{ev_id}")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data.get("status"), "success")
            ev = data.get("evidence", {})
            self.assertEqual(ev.get("evidenceId"), ev_id)
            self.assertEqual(ev.get("ledgerStatus"), "VERIFIED_ACTIVE")
            self.assertTrue(ev.get("isOnChain"))
        finally:
            self._cleanup_temp_evidence(ev_id)

    def test_03_get_historical_evidence_details_no_404(self):
        """Historical evidence record must return 200 with HISTORICAL_RECORD, never 404."""
        res = self.client.get("/api/evidence/EVD-287CA65A")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        ev = data.get("evidence", {})
        self.assertEqual(ev.get("evidenceId"), "EVD-287CA65A")
        self.assertEqual(ev.get("ledgerStatus"), "HISTORICAL_RECORD")
        self.assertFalse(ev.get("isOnChain"))
        self.assertTrue(ev.get("isHistorical"))

    def test_04_verify_active_evidence_success(self):
        """POST /api/evidence/<id>/verify with matching hash on active record returns AUTHENTIC."""
        ev_id, rec_hash = self._create_temp_active_evidence("TEST-EVD-ACT-04")
        try:
            verify_res = self.client.post(f"/api/evidence/{ev_id}/verify", json={"hash": rec_hash})
            self.assertEqual(verify_res.status_code, 200)
            vdata = verify_res.get_json()
            self.assertEqual(vdata.get("result"), "AUTHENTIC")
            self.assertTrue(vdata.get("fileDigestMatches"))
            self.assertTrue(vdata.get("onChainVerified"))
            self.assertTrue(vdata.get("isAuthentic"))
        finally:
            self._cleanup_temp_evidence(ev_id)

    def test_05_verify_historical_evidence_success(self):
        """POST /api/evidence/<id>/verify on historical record returns AUTHENTIC_HISTORICAL."""
        res = self.client.get("/api/evidence/EVD-287CA65A")
        rec_hash = res.get_json()["evidence"]["evidenceHash"]

        verify_res = self.client.post("/api/evidence/EVD-287CA65A/verify", json={"hash": rec_hash})
        self.assertEqual(verify_res.status_code, 200)
        vdata = verify_res.get_json()
        self.assertEqual(vdata.get("result"), "AUTHENTIC_HISTORICAL")
        self.assertTrue(vdata.get("fileDigestMatches"))
        self.assertFalse(vdata.get("onChainVerified"))
        self.assertTrue(vdata.get("isAuthentic"))

    def test_06_verify_tampered_hash_detection(self):
        """POST /api/evidence/<id>/verify with wrong hash returns TAMPERED."""
        tampered_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        verify_res = self.client.post("/api/evidence/EVD-35703AEE/verify", json={"hash": tampered_hash})
        self.assertEqual(verify_res.status_code, 200)
        vdata = verify_res.get_json()
        self.assertEqual(vdata.get("result"), "TAMPERED")
        self.assertFalse(vdata.get("fileDigestMatches"))
        self.assertFalse(vdata.get("isAuthentic"))
        self.assertEqual(verify_res.status_code, 200)
        vdata = verify_res.get_json()
        self.assertEqual(vdata.get("result"), "TAMPERED")
        self.assertFalse(vdata.get("fileDigestMatches"))
        self.assertFalse(vdata.get("isAuthentic"))

    def test_07_register_rejects_corrupted_client_hash(self):
        """POST /api/evidence/register rejects request if clientHash doesn't match uploaded file digest."""
        fake_file = io.BytesIO(b"Unit test evidence payload content")
        fake_file.name = "test_evidence.txt"

        data = {
            "file": (fake_file, "test_evidence.txt"),
            "caseId": "CASE-2026-001",
            "description": "Integrity check test",
            "clientHash": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        }

        res = self.client.post(
            "/api/evidence/register",
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Integrity check failed", res.get_json().get("message", ""))

if __name__ == "__main__":
    unittest.main()
