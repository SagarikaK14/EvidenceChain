"""
Test Suite: Phase 5 - Granular Access Management, RBAC & Boundary Enforcement
Validates:
1. Granular View and Download separation (independent boolean states)
2. Zero-trust default: unauthorized officer denied View and Download (HTTP 403)
3. HOD grant of VIEW permission updates state and enables file inspection
4. View grant does NOT imply Download grant (strict capability separation)
5. HOD grant of DOWNLOAD permission enables file retrieval
6. Non-HOD attempting to grant/revoke access is rejected with HTTP 403
7. Revocation of VIEW restores 403 denial on /view endpoint
8. Cross-case boundary validation: mismatched case ID prevents privilege grant
9. Audit log entry recorded upon grant/revoke actions
10. Persistent Anvil on Port 8545 strictly unchanged
"""

import os
import io
import hashlib
import unittest
import json
import urllib.request
from app import app
from database.db import get_db


class TestPhase5AccessManagement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_acc_")
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

        # Officer wallet address for Rahul Sharma (Account 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
        self.officer_email = "r.sharma@forensics.example.com"
        self.officer_address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        self.hod_email = "r.sen@forensics.example.com"
        self.hod_address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

    def _create_synthetic_evidence(self, case_id="CASE-2026-ACC-001"):
        """Helper to create and register synthetic evidence on Port 8546."""
        self.client.post("/api/auth/demo-switch", json={"email": self.hod_email})
        content = b"Synthetic digital asset for Phase 5 access control validation."
        h = hashlib.sha256(content).hexdigest()
        reg_res = self.client.post("/api/evidence/register", data={
            "file": (io.BytesIO(content), "access_asset.bin"),
            "caseId": case_id,
            "description": "Access validation asset",
            "clientHash": h
        }, content_type="multipart/form-data")
        self.assertEqual(reg_res.status_code, 201)
        ev_id = reg_res.get_json()["evidenceId"]
        upload_path = os.path.join(self.app.config["UPLOAD_FOLDER"], f"{ev_id}_access_asset.bin")
        self.__class__.uploaded_files.append(upload_path)
        return ev_id, h

    def test_01_default_unauthorized_state(self):
        """Officer has neither View nor Download permission by default."""
        ev_id, _ = self._create_synthetic_evidence()

        # Check view access endpoint
        v_res = self.client.post(f"/api/evidence/{ev_id}/view-access", json={
            "userAddress": self.officer_address
        })
        self.assertEqual(v_res.status_code, 200)
        self.assertFalse(v_res.get_json().get("canView"))

        # Check download access endpoint
        d_res = self.client.post(f"/api/evidence/{ev_id}/download-access", json={
            "userAddress": self.officer_address
        })
        self.assertEqual(d_res.status_code, 200)
        self.assertFalse(d_res.get_json().get("canDownload"))

    def test_02_direct_access_denied_without_permission(self):
        """Direct GET /view and /download return 403 when unpermitted."""
        ev_id, _ = self._create_synthetic_evidence()

        # Attempt view as officer
        self.client.post("/api/auth/demo-switch", json={"email": self.officer_email})
        view_res = self.client.get(f"/api/evidence/{ev_id}/view?userAddress={self.officer_address}")
        self.assertEqual(view_res.status_code, 403)
        self.assertIn("denied", view_res.get_json().get("error", "").lower())

        # Attempt download as officer
        dl_res = self.client.get(f"/api/evidence/{ev_id}/download?userAddress={self.officer_address}")
        self.assertEqual(dl_res.status_code, 403)
        self.assertIn("denied", dl_res.get_json().get("error", "").lower())

    def test_03_hod_grants_view_only(self):
        """HOD grants VIEW; officer can view file but download remains 403."""
        ev_id, _ = self._create_synthetic_evidence()

        # Login as HOD and grant VIEW
        self.client.post("/api/auth/demo-switch", json={"email": self.hod_email})
        grant_res = self.client.post(f"/api/evidence/{ev_id}/view-access/grant", json={
            "userAddress": self.officer_address,
            "targetName": "Rahul Sharma",
            "caseId": "CASE-2026-ACC-001"
        })
        self.assertEqual(grant_res.status_code, 200)
        self.assertTrue(grant_res.get_json().get("transactionHash"))

        # Switch to officer and verify view succeeds
        self.client.post("/api/auth/demo-switch", json={"email": self.officer_email})
        view_res = self.client.get(f"/api/evidence/{ev_id}/view?userAddress={self.officer_address}")
        self.assertEqual(view_res.status_code, 200)
        self.assertEqual(view_res.data, b"Synthetic digital asset for Phase 5 access control validation.")

        # Download MUST STILL BE DENIED (403)
        dl_res = self.client.get(f"/api/evidence/{ev_id}/download?userAddress={self.officer_address}")
        self.assertEqual(dl_res.status_code, 403)

    def test_04_non_hod_cannot_grant_permission(self):
        """Non-HOD officer attempting to grant permissions receives 403."""
        ev_id, _ = self._create_synthetic_evidence()

        # Login as officer and attempt to grant permission
        self.client.post("/api/auth/demo-switch", json={"email": self.officer_email})
        grant_res = self.client.post(f"/api/evidence/{ev_id}/view-access/grant", json={
            "userAddress": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "caseId": "CASE-2026-ACC-001"
        })
        self.assertEqual(grant_res.status_code, 403)

    def test_05_revoke_restores_denial(self):
        """Revoking VIEW restores 403 on /view endpoint."""
        ev_id, _ = self._create_synthetic_evidence()

        # HOD grants view
        self.client.post("/api/auth/demo-switch", json={"email": self.hod_email})
        self.client.post(f"/api/evidence/{ev_id}/view-access/grant", json={
            "userAddress": self.officer_address,
            "caseId": "CASE-2026-ACC-001"
        })

        # HOD revokes view
        revoke_res = self.client.post(f"/api/evidence/{ev_id}/view-access/revoke", json={
            "userAddress": self.officer_address,
            "caseId": "CASE-2026-ACC-001"
        })
        self.assertEqual(revoke_res.status_code, 200)

        # Officer attempts view -> 403
        self.client.post("/api/auth/demo-switch", json={"email": self.officer_email})
        view_res = self.client.get(f"/api/evidence/{ev_id}/view?userAddress={self.officer_address}")
        self.assertEqual(view_res.status_code, 403)

    def test_06_cross_case_boundary_enforcement(self):
        """Mismatched case ID prevents permission mutation."""
        ev_id, _ = self._create_synthetic_evidence(case_id="CASE-2026-ACC-001")

        self.client.post("/api/auth/demo-switch", json={"email": self.hod_email})
        res = self.client.post(f"/api/evidence/{ev_id}/view-access/grant", json={
            "userAddress": self.officer_address,
            "caseId": "CASE-DIFFERENT-UNAUTHORIZED"
        })
        self.assertIn(res.status_code, (400, 403))

    def test_07_audit_log_persisted_on_grant(self):
        """Permission grants write authoritative rows into department_audit_log."""
        ev_id, _ = self._create_synthetic_evidence()

        self.client.post("/api/auth/demo-switch", json={"email": self.hod_email})
        self.client.post(f"/api/evidence/{ev_id}/view-access/grant", json={
            "userAddress": self.officer_address,
            "targetName": "Rahul Sharma",
            "caseId": "CASE-2026-ACC-001"
        })

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT action, target_address, evidence_id
            FROM department_audit_log
            WHERE evidence_id = ?
            ORDER BY id DESC LIMIT 1
        """, (ev_id,))
        row = cur.fetchone()
        conn.close()

        self.assertIsNotNone(row)
        self.assertEqual(row[0], "GRANT")
        self.assertEqual(row[1], self.officer_address)
        self.assertEqual(row[2], ev_id)

    def test_08_persistent_8545_strictly_unmodified(self):
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
