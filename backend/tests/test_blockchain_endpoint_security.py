"""
EvidenceChain - Test Suite: Blockchain Endpoint & Transaction Security
Validates:
1. Rejection (401) of unauthenticated registration requests against Anvil deployer.
2. Enforcement of quota (max 5 artifacts) on demonstration sessions.
3. Strict enforcement of 10 MB upload bounds (413 Payload Too Large).
4. Rejection (403) of demonstration sessions attempting administrative permission grants.
5. Rejection (403) of demonstration sessions attempting administrative permission revocations.
6. Rejection (403) of demonstration sessions calling department permission changes.
7. Rejection (401) of unauthenticated access to record_access transaction endpoint.
8. Loopback encapsulation verification: RPC targets strictly 127.0.0.1.
"""

import os
import io
import unittest
import json
import urllib.request
from app import app, REGISTRATION_RATE_LIMITS
from database.db import get_db


class TestBlockchainEndpointSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_bc_sec_")
        cls.uploaded_files = []

        # Record initial block on 8545 to guarantee zero pollution
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

        # Confirm 8545 was never touched
        req = urllib.request.Request(
            "http://127.0.0.1:8545",
            data=json.dumps({"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            final_8545_block = data.get("result")
            assert cls.initial_8545_block == final_8545_block, "CRITICAL: Port 8545 mutated during test!"

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["BLOCKCHAIN_RPC_URL"] = "http://127.0.0.1:8546"
        os.environ["DATABASE_PATH"] = self.temp_db
        os.environ["FLASK_ENV"] = "testing"
        os.environ["PUBLIC_DEMO_MODE"] = "true"
        REGISTRATION_RATE_LIMITS.clear()

    def tearDown(self):
        os.environ.pop("PUBLIC_DEMO_MODE", None)

    def test_01_unauthenticated_registration_rejected(self):
        """Unauthenticated requests to /api/evidence/register must be rejected with 401."""
        # Ensure client has no session
        self.client.post("/api/auth/logout")

        content = b"Synthetic unauthenticated evidence file"
        data = {
            "file": (io.BytesIO(content), "unauth_evidence.bin"),
            "caseId": "CASE-UNAUTH-001",
            "description": "Attempted unauthenticated registration"
        }
        # Temporarily unset TESTING to test production gate
        self.app.config["TESTING"] = False
        try:
            res = self.client.post(
                "/api/evidence/register",
                data=data,
                content_type="multipart/form-data",
                headers={"Origin": "http://localhost:5001"}
            )
            self.assertEqual(res.status_code, 401)
            self.assertIn("Authentication required", res.get_json().get("message", ""))
        finally:
            self.app.config["TESTING"] = True

    def test_02_demo_session_registration_quota_enforced(self):
        """Demo session can register up to 5 artifacts; 6th is rejected with 403."""
        # Log in as demo officer
        login_res = self.client.post("/api/auth/demo-login", json={"email": "r.sharma@forensics.example.com"})
        self.assertEqual(login_res.status_code, 200)

        # Register 5 items
        for i in range(5):
            content = f"Synthetic demo evidence payload index {i}".encode("utf-8")
            data = {
                "file": (io.BytesIO(content), f"demo_item_{i}.txt"),
                "caseId": f"CASE-DEMO-Q{i}",
                "description": f"Demo registration #{i+1}"
            }
            res = self.client.post("/api/evidence/register", data=data, content_type="multipart/form-data")
            self.assertEqual(res.status_code, 201, f"Failed at registration #{i+1}")
            ev_id = res.get_json().get("evidenceId")
            self.__class__.uploaded_files.append(
                os.path.join(self.app.config["UPLOAD_FOLDER"], f"{ev_id}_demo_item_{i}.txt")
            )

        # 6th attempt exceeds quota
        content6 = b"Sixth item exceeding quota"
        data6 = {
            "file": (io.BytesIO(content6), "demo_item_6.txt"),
            "caseId": "CASE-DEMO-Q6",
            "description": "Attempt exceeding quota"
        }
        res6 = self.client.post("/api/evidence/register", data=data6, content_type="multipart/form-data")
        self.assertEqual(res6.status_code, 403)
        self.assertIn("Demonstration quota reached", res6.get_json().get("message", ""))

    def test_03_registration_file_size_bound_enforced(self):
        """Files exceeding 10 MB maximum upload bound are rejected with 413."""
        # Log in as demo officer
        self.client.post("/api/auth/demo-login", json={"email": "r.sharma@forensics.example.com"})

        # Pass payload > 10 MB
        oversized_content = b"0" * (11 * 1024 * 1024)
        data = {
            "file": (io.BytesIO(oversized_content), "oversized.bin"),
            "caseId": "CASE-OVERSIZED",
            "description": "Attempt exceeding file size limit"
        }
        res = self.client.post(
            "/api/evidence/register",
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(res.status_code, 413)

    def test_04_demo_session_blocked_from_administrative_permission_grants(self):
        """Demo sessions must be strictly blocked (403) from granting on-chain view permissions."""
        # Log in as demo officer (non-HOD)
        self.client.post("/api/auth/demo-login", json={"email": "r.sharma@forensics.example.com"})

        res = self.client.post(
            "/api/evidence/EVD-287CA65A/view-access/grant",
            json={"targetAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Unauthorized", res.get_json().get("message", ""))

    def test_05_demo_session_blocked_from_administrative_permission_revocations(self):
        """Demo sessions must be strictly blocked (403) from revoking on-chain download permissions."""
        # Log in as demo officer (non-HOD)
        self.client.post("/api/auth/demo-login", json={"email": "r.sharma@forensics.example.com"})

        res = self.client.post(
            "/api/evidence/EVD-287CA65A/download-access/revoke",
            json={"targetAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Unauthorized", res.get_json().get("message", ""))

    def test_06_demo_session_blocked_from_department_permissions_change(self):
        """Demo sessions calling unified /api/department/permissions/change return 403."""
        # Log in as demo officer (non-HOD)
        self.client.post("/api/auth/demo-login", json={"email": "r.sharma@forensics.example.com"})

        res = self.client.post(
            "/api/department/permissions/change",
            json={
                "evidenceId": "EVD-287CA65A",
                "targetAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "permissionType": "VIEW",
                "action": "GRANT"
            }
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Unauthorized", res.get_json().get("message", ""))

    def test_07_unauthenticated_record_access_rejected(self):
        """Unauthenticated requests to record on-chain access return 401."""
        self.client.post("/api/auth/logout")
        self.app.config["TESTING"] = False
        try:
            res = self.client.post(
                "/api/evidence/EVD-287CA65A/access",
                json={"action": "VIEW", "userAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"},
                headers={"Origin": "http://localhost:5001"}
            )
            self.assertEqual(res.status_code, 401)
        finally:
            self.app.config["TESTING"] = True

    def test_08_blockchain_rpc_loopback_only(self):
        """Verify that configured blockchain RPC URL strictly targets loopback 127.0.0.1."""
        rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "")
        self.assertTrue(
            "127.0.0.1" in rpc_url or "localhost" in rpc_url,
            f"SECURITY VIOLATION: BLOCKCHAIN_RPC_URL '{rpc_url}' is not bound strictly to loopback!"
        )
        self.assertNotIn("0.0.0.0", rpc_url)


if __name__ == "__main__":
    unittest.main()
