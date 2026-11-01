"""
Backend Security, Audit, and RBAC Test Suite for Department Authority
Validates:
1. Unauthenticated rejection (401) across all department authority endpoints
2. HOD details with "Department Administrator" and zero-trust capability separation
3. Department personnel listing with distinct registered vs custody evidence metrics
4. Case listing with case-level anchored counts
5. Case-evidence lookup with safe file size calculation
6. Evidence permissions query distinguishing Anchored (Allowed/Denied) vs Unanchored (Unavailable)
7. Permission change RBAC: strict 403 for non-HOD, successful execution for HOD
8. Guard rails preventing permission modification on unanchored evidence
"""

import os
import unittest
import json
from app import app

class TestDepartmentAuthority(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_dept_")

    @classmethod
    def tearDownClass(cls):
        from tests.test_isolation_helper import teardown_isolated_test_environment
        teardown_isolated_test_environment(cls.temp_db)

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["ALLOW_DEV_DIAGNOSTICS"] = "true"
        os.environ["BLOCKCHAIN_RPC_URL"] = "http://127.0.0.1:8546"
        os.environ["DATABASE_PATH"] = self.temp_db
        os.environ["FLASK_ENV"] = "testing"

    def login_as(self, email):
        """Helper to switch session via authenticated demo-switch in development."""
        res = self.client.post("/api/auth/demo-switch", json={"email": email})
        self.assertEqual(res.status_code, 200, f"Failed to authenticate as {email}")
        return res

    def test_01_unauthenticated_requests_rejected(self):
        """Unauthenticated requests to any department authority endpoint must return 401."""
        endpoints = [
            ("GET", "/api/department/hod"),
            ("GET", "/api/department/members"),
            ("GET", "/api/department/cases"),
            ("GET", "/api/department/case-evidence?caseId=CASE-2026-CYBER-091"),
            ("GET", "/api/department/evidence-permissions?evidenceId=EVD-35703AEE"),
            ("POST", "/api/department/permissions/change"),
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                res = self.client.get(endpoint)
            else:
                res = self.client.post(endpoint, json={})
            self.assertEqual(res.status_code, 401, f"{endpoint} did not return 401 for unauthenticated request")
            data = res.get_json()
            self.assertEqual(data.get("status"), "unauthenticated")

    def test_02_hod_capability_separation_and_admin_title(self):
        """HOD profile must display Department Administrator and zero-trust capability separation."""
        # 1. Login as HOD
        self.login_as("r.sen@forensics.example.com")
        res = self.client.get("/api/department/hod")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        hod = data.get("hod", {})
        self.assertEqual(hod.get("authorizationTitle"), "Department Administrator")
        self.assertNotEqual(hod.get("authorizationTitle"), "All Privileges")
        self.assertTrue(hod.get("isCurrentSessionHOD"))
        self.assertEqual(hod.get("name"), "Dr. Rajeshwar Sen")
        self.assertEqual(hod.get("badgeNumber"), "DFS-DIR-001")

        caps = hod.get("capabilities", {})
        self.assertTrue(caps.get("canAdministerPersonnel"))
        self.assertTrue(caps.get("canGrantRevokeEvidenceAccess"))
        self.assertFalse(caps.get("universalAccessGranted"))
        self.assertIn("Zero Trust", caps.get("evidenceAccessEnforcement", ""))

        # 2. Login as non-HOD (e.g., Senior Forensic Analyst)
        self.login_as("r.sharma@forensics.example.com")
        res2 = self.client.get("/api/department/hod")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        hod2 = data2.get("hod", {})
        self.assertFalse(hod2.get("isCurrentSessionHOD"))

    def test_03_department_members_metrics(self):
        """Department members must return distinct registeredEvidenceCount and custodyEvidenceCount."""
        self.login_as("r.sen@forensics.example.com")
        res = self.client.get("/api/department/members")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        members = data.get("members", [])
        self.assertGreaterEqual(len(members), 4)

        for m in members:
            self.assertIn("name", m)
            self.assertIn("role", m)
            self.assertIn("walletAddress", m)
            self.assertIn("registeredEvidenceCount", m)
            self.assertIn("custodyEvidenceCount", m)
            self.assertIsInstance(m["registeredEvidenceCount"], int)
            self.assertIsInstance(m["custodyEvidenceCount"], int)
            self.assertGreaterEqual(m["registeredEvidenceCount"], 0)
            self.assertGreaterEqual(m["custodyEvidenceCount"], 0)

    def test_04_department_cases_list(self):
        """Case listing must return aggregated distinct cases with total and anchored evidence counts."""
        self.login_as("r.sen@forensics.example.com")
        res = self.client.get("/api/department/cases")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        cases = data.get("cases", [])
        self.assertGreater(len(cases), 0)

        case_map = {c["case_id"]: c for c in cases}
        self.assertIn("CASE-2026-CYBER-091", case_map)
        self.assertIn("CASE-E2E-1791140413912", case_map)

        cyber_case = case_map["CASE-2026-CYBER-091"]
        self.assertGreater(cyber_case["totalEvidenceCount"], 0)
        self.assertGreaterEqual(cyber_case["anchoredEvidenceCount"], 0)

    def _create_temp_anchored_evidence(self, prefix="TEST-EVD-DEPT"):
        import uuid
        ev_id = f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
        from blockchain import register_evidence
        from database.db import save_evidence, get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM blockchain_deployments WHERE is_active = 1")
        deploy = dict(cursor.fetchone() or {})
        conn.close()

        test_hash = "b" * 64
        tx_res = register_evidence(ev_id, "CASE-2026-CYBER-091", test_hash)
        save_evidence(
            evidence_id=ev_id,
            case_id="CASE-2026-CYBER-091",
            title="dept_test_active.txt",
            description="Active evidence for department test",
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
        return ev_id

    def _cleanup_temp_evidence(self, ev_id):
        from database.db import get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM evidence WHERE evidence_id = ?", (ev_id,))
        cursor.execute("DELETE FROM evidence_anchoring_events WHERE evidence_id = ?", (ev_id,))
        cursor.execute("DELETE FROM department_audit_log WHERE evidence_id = ?", (ev_id,))
        conn.commit()
        conn.close()

    def test_05_case_evidence_details(self):
        """Case evidence lookup must validate parameters and return evidence details with onChainStatus."""
        self.login_as("r.sen@forensics.example.com")

        # Missing caseId
        res_bad = self.client.get("/api/department/case-evidence")
        self.assertEqual(res_bad.status_code, 400)

        # Valid anchored case
        res = self.client.get("/api/department/case-evidence?caseId=CASE-2026-CYBER-091")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        items = data.get("evidenceItems", [])
        self.assertGreater(len(items), 0)
        item_ids = [it["evidence_id"] for it in items]
        self.assertIn("EVD-35703AEE", item_ids)

        for it in items:
            self.assertIn("onChainStatus", it)
            self.assertIn(it["onChainStatus"], ["Anchored", "Unanchored"])
            self.assertIn("file_size_bytes", it)
            self.assertGreaterEqual(it["file_size_bytes"], 0)

    def test_06_evidence_permissions_anchored_vs_unanchored(self):
        """Permissions query must accurately show Allowed/Denied for anchored and Unavailable for unanchored."""
        self.login_as("r.sen@forensics.example.com")

        # Missing evidenceId
        res_bad = self.client.get("/api/department/evidence-permissions")
        self.assertEqual(res_bad.status_code, 400)

        # 1. Anchored Evidence (dynamically anchored for test)
        anchored_ev = self._create_temp_anchored_evidence("TEST-EVD-DEPT-06")
        try:
            res_anchored = self.client.get(f"/api/department/evidence-permissions?evidenceId={anchored_ev}")
            self.assertEqual(res_anchored.status_code, 200)
            data_a = res_anchored.get_json()
            self.assertEqual(data_a.get("status"), "success")
            ev_a = data_a.get("evidence", {})
            self.assertEqual(ev_a.get("onChainStatus"), "Anchored")
            self.assertTrue(ev_a.get("isAnchored"))

            perms_a = data_a.get("permissions", [])
            self.assertGreater(len(perms_a), 0)
            for p in perms_a:
                self.assertIn(p["statusView"], ["Allowed", "Denied"])
                self.assertIn(p["statusDownload"], ["Allowed", "Denied"])
                self.assertNotEqual(p["statusView"], "Unavailable")
                self.assertNotEqual(p["statusDownload"], "Unavailable")

            metrics_a = data_a.get("summaryMetrics", {})
            self.assertEqual(metrics_a.get("unavailableCount"), 0)
            self.assertEqual(metrics_a.get("totalOfficers"), len(perms_a))

            # 2. Unanchored / Historical Evidence (EVD-287CA65A)
            res_unanchored = self.client.get("/api/department/evidence-permissions?evidenceId=EVD-287CA65A")
            self.assertEqual(res_unanchored.status_code, 200)
            data_u = res_unanchored.get_json()
            self.assertEqual(data_u.get("status"), "success")
            ev_u = data_u.get("evidence", {})
            self.assertEqual(ev_u.get("onChainStatus"), "Unanchored")
            self.assertFalse(ev_u.get("isAnchored"))

            perms_u = data_u.get("permissions", [])
            self.assertGreater(len(perms_u), 0)
            for p in perms_u:
                # MUST be Unavailable, NEVER Denied
                self.assertEqual(p["statusView"], "Unavailable")
                self.assertEqual(p["statusDownload"], "Unavailable")
                self.assertFalse(p["canView"])
                self.assertFalse(p["canDownload"])

            metrics_u = data_u.get("summaryMetrics", {})
            self.assertEqual(metrics_u.get("unavailableCount"), len(perms_u))
            self.assertEqual(metrics_u.get("allowedViewCount"), 0)
            self.assertEqual(metrics_u.get("allowedDownloadCount"), 0)
        finally:
            self._cleanup_temp_evidence(anchored_ev)

    def test_07_permission_change_rbac_and_execution(self):
        """Permission change must enforce HOD-only RBAC (403 for others) and execute on-chain for HOD."""
        target_wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" # Rahul Sharma
        anchored_ev = self._create_temp_anchored_evidence("TEST-EVD-DEPT-07")
        unanchored_ev = "EVD-287CA65A"

        try:
            # 1. Non-HOD attempt -> 403 Forbidden
            self.login_as("r.sharma@forensics.example.com")
            res_non_hod = self.client.post("/api/department/permissions/change", json={
                "evidenceId": anchored_ev,
                "officerWallet": target_wallet,
                "permissionType": "view",
                "action": "grant"
            })
            self.assertEqual(res_non_hod.status_code, 403)
            self.assertEqual(res_non_hod.get_json().get("status"), "forbidden")

            # 2. HOD attempt on unanchored evidence -> 400 Bad Request
            self.login_as("r.sen@forensics.example.com")
            res_unanchored_change = self.client.post("/api/department/permissions/change", json={
                "evidenceId": unanchored_ev,
                "officerWallet": target_wallet,
                "permissionType": "view",
                "action": "grant"
            })
            self.assertEqual(res_unanchored_change.status_code, 400)
            self.assertIn("not anchored", res_unanchored_change.get_json().get("error", "").lower())

            # 3. HOD valid Grant on anchored evidence
            res_grant = self.client.post("/api/department/permissions/change", json={
                "evidenceId": anchored_ev,
                "officerWallet": target_wallet,
                "permissionType": "view",
                "action": "grant"
            })
            self.assertEqual(res_grant.status_code, 200)
            grant_data = res_grant.get_json()
            self.assertEqual(grant_data.get("status"), "success")
            self.assertTrue(grant_data.get("canView"))
            self.assertIsNotNone(grant_data.get("txHash"))

            # Verify on-chain permission reflected
            res_check = self.client.get(f"/api/department/evidence-permissions?evidenceId={anchored_ev}")
            data_check = res_check.get_json()
            rahul_perm = next((p for p in data_check["permissions"] if p["walletAddress"].lower() == target_wallet.lower()), None)
            self.assertIsNotNone(rahul_perm)
            self.assertEqual(rahul_perm["statusView"], "Allowed")
            self.assertTrue(rahul_perm["canView"])

            # 4. HOD valid Revoke on anchored evidence to restore original state
            res_revoke = self.client.post("/api/department/permissions/change", json={
                "evidenceId": anchored_ev,
                "officerWallet": target_wallet,
                "permissionType": "view",
                "action": "revoke"
            })
            self.assertEqual(res_revoke.status_code, 200)
            revoke_data = res_revoke.get_json()
            self.assertEqual(revoke_data.get("status"), "success")
            self.assertFalse(revoke_data.get("canView"))

            # Verify revoked on-chain
            res_check2 = self.client.get(f"/api/department/evidence-permissions?evidenceId={anchored_ev}")
            data_check2 = res_check2.get_json()
            rahul_perm2 = next((p for p in data_check2["permissions"] if p["walletAddress"].lower() == target_wallet.lower()), None)
            self.assertIsNotNone(rahul_perm2)
            self.assertEqual(rahul_perm2["statusView"], "Denied")
            self.assertFalse(rahul_perm2["canView"])
        finally:
            self._cleanup_temp_evidence(anchored_ev)

if __name__ == "__main__":
    unittest.main()
