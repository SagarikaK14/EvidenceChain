"""
Backend Security and RBAC Test Suite for Identity & Authorization
Validates:
1. Unauthenticated rejection (401)
2. Enriched profile schema (/api/auth/me) with factual cookie flags and rules
3. Server-enforced permissions for HOD vs non-HOD
4. Server-controlled demo switching (session re-issuance)
5. Production hardening (403 when FLASK_ENV=production)
6. Anti-spoofing verification
7. Safe session termination (/api/auth/logout)
8. Default-disabled server configuration for demo switching
9. Rejection when FLASK_ENV is missing or unrecognized
10. Prevention of privilege escalation to unapproved accounts
"""

import os
import unittest
import json
from app import app
from database.db import get_db
from tests.test_isolation_helper import setup_isolated_test_environment, teardown_isolated_test_environment

class TestIdentitySecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_db = setup_isolated_test_environment(prefix="test_identity_")
        conn = get_db()
        c = conn.cursor()
        c.execute("INSERT OR IGNORE INTO users (id, name, email, role) VALUES (1, 'Test Officer', 'officer@example.com', 'officer')")
        conn.commit()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        teardown_isolated_test_environment(cls.temp_db)

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        # Ensure default test environment allows demo switch unless specifically tested
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["FLASK_ENV"] = "development"

    def test_01_unauthenticated_me_rejected(self):
        """GET /api/auth/me must reject unauthenticated requests with 401."""
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)
        data = response.get_json()
        self.assertEqual(data.get("status"), "unauthenticated")

    def test_02_demo_profiles_listing(self):
        """GET /api/auth/demo-profiles must list available test personas."""
        response = self.client.get("/api/auth/demo-profiles")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "success")
        profiles = data.get("profiles", [])
        self.assertGreaterEqual(len(profiles), 4)
        emails = [p["email"].lower() for p in profiles]
        self.assertIn("r.sen@forensics.example.com", emails)
        self.assertIn("r.sharma@forensics.example.com", emails)

    def test_03_hod_permissions_matrix(self):
        """HOD role must have administrative permissions allowed, but zero-trust evidence-specific access."""
        # Switch session to HOD Dr. Rajeshwar Sen
        switch_res = self.client.post("/api/auth/demo-switch", json={
            "email": "r.sen@forensics.example.com"
        })
        self.assertEqual(switch_res.status_code, 200)

        # Query /api/auth/me
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        data = me_res.get_json()

        self.assertEqual(data["status"], "authenticated")
        user = data["user"]
        self.assertEqual(user["role"], "Head of Department")
        self.assertEqual(user["name"], "Dr. Rajeshwar Sen")
        self.assertEqual(user["employeeId"], "HOD-0001")
        self.assertEqual(user["walletAddress"], "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")

        # Check permissions
        perms = {p["id"]: p for p in data["permissions"]}
        self.assertEqual(perms["register_evidence"]["status"], "ALLOWED")
        self.assertEqual(perms["verify_evidence"]["status"], "ALLOWED")
        self.assertEqual(perms["review_access_history"]["status"], "ALLOWED")
        self.assertEqual(perms["manage_evidence_access"]["status"], "ALLOWED")
        self.assertEqual(perms["manage_department_authority"]["status"], "ALLOWED")

        # Technical disclosures: verify contractMethod and serverRule exist
        for pid, p in perms.items():
            self.assertTrue(p.get("serverRule"), f"Missing serverRule for {pid}")
            self.assertTrue(p.get("contractMethod"), f"Missing contractMethod for {pid}")

        # Zero-trust verification: File access is STILL evidence-specific!
        self.assertEqual(perms["view_evidence"]["status"], "EVIDENCE_SPECIFIC")
        self.assertEqual(perms["download_evidence"]["status"], "EVIDENCE_SPECIFIC")
        self.assertEqual(perms["transfer_custody"]["status"], "EVIDENCE_SPECIFIC")

        # Session metadata & factual cookie flags
        session_meta = data["sessionMeta"]
        self.assertEqual(session_meta["status"], "ACTIVE")
        self.assertTrue(session_meta["authTime"])
        self.assertTrue(session_meta["expiresAt"])
        self.assertIn("cookieFlags", session_meta)
        self.assertTrue(session_meta["cookieFlags"]["httpOnly"])
        self.assertEqual(session_meta["cookieFlags"]["sameSite"], "Lax")

        # Signing identity
        signing = data["signingIdentity"]
        self.assertTrue(signing["isLinked"])
        self.assertEqual(signing["walletAddress"].lower(), user["walletAddress"].lower())
        self.assertEqual(signing["chainId"], 31337)

    def test_04_non_hod_permissions_matrix(self):
        """Non-HOD officer must have administrative rights RESTRICTED."""
        # Switch session to Rahul Sharma (Senior Forensic Officer)
        switch_res = self.client.post("/api/auth/demo-switch", json={
            "email": "r.sharma@forensics.example.com"
        })
        self.assertEqual(switch_res.status_code, 200)

        # Query /api/auth/me
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        data = me_res.get_json()

        self.assertEqual(data["status"], "authenticated")
        user = data["user"]
        self.assertEqual(user["role"], "Senior Forensic Officer")
        self.assertEqual(user["name"], "Rahul Sharma")

        perms = {p["id"]: p for p in data["permissions"]}
        self.assertEqual(perms["register_evidence"]["status"], "ALLOWED")
        self.assertEqual(perms["verify_evidence"]["status"], "ALLOWED")
        self.assertEqual(perms["review_access_history"]["status"], "ALLOWED")

        # HOD actions must be restricted for non-HOD
        self.assertEqual(perms["manage_evidence_access"]["status"], "RESTRICTED")
        self.assertEqual(perms["manage_department_authority"]["status"], "RESTRICTED")

        # File actions are evidence-specific
        self.assertEqual(perms["view_evidence"]["status"], "EVIDENCE_SPECIFIC")
        self.assertEqual(perms["download_evidence"]["status"], "EVIDENCE_SPECIFIC")

    def test_05_production_disables_demo_switch(self):
        """In FLASK_ENV=production, demo switching endpoints must return 403 Forbidden."""
        old_env = os.environ.get("FLASK_ENV")
        try:
            os.environ["FLASK_ENV"] = "production"

            # Test GET /api/auth/demo-profiles
            res_profiles = self.client.get("/api/auth/demo-profiles")
            self.assertEqual(res_profiles.status_code, 403)

            # Test POST /api/auth/demo-switch
            res_switch = self.client.post("/api/auth/demo-switch", json={
                "email": "r.sen@forensics.example.com"
            })
            self.assertEqual(res_switch.status_code, 403)
            data_switch = res_switch.get_json()
            self.assertIn("disabled", data_switch.get("message", "").lower())
        finally:
            if old_env is not None:
                os.environ["FLASK_ENV"] = old_env
            else:
                os.environ.pop("FLASK_ENV", None)

    def test_06_anti_spoofing_session_integrity(self):
        """Client cannot spoof identity via URL params, headers, or request body."""
        # Authenticate as Rahul Sharma
        switch_res = self.client.post("/api/auth/demo-switch", json={
            "email": "r.sharma@forensics.example.com"
        })
        self.assertEqual(switch_res.status_code, 200)

        # Attempt to spoof HOD via query params
        spoof_res = self.client.get("/api/auth/me?role=Head+of+Department&email=r.sen@forensics.example.com")
        self.assertEqual(spoof_res.status_code, 200)
        data = spoof_res.get_json()
        self.assertEqual(data["user"]["email"], "r.sharma@forensics.example.com")
        self.assertEqual(data["user"]["role"], "Senior Forensic Officer")

    def test_07_logout_terminates_session(self):
        """POST /api/auth/logout must invalidate session cookie."""
        self.client.post("/api/auth/demo-switch", json={
            "email": "r.sharma@forensics.example.com"
        })

        logout_res = self.client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)

        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 401)

    def test_08_demo_switch_default_disabled(self):
        """When ALLOW_DEV_DEMO_SWITCH is missing or false, demo switching must return 403."""
        old_val = os.environ.get("ALLOW_DEV_DEMO_SWITCH")
        old_legacy = os.environ.get("ALLOW_DEMO_SWITCH")
        try:
            os.environ.pop("ALLOW_DEV_DEMO_SWITCH", None)
            os.environ.pop("ALLOW_DEMO_SWITCH", None)

            res = self.client.post("/api/auth/demo-switch", json={
                "email": "r.sen@forensics.example.com"
            })
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertIn("disabled by server security policy", data.get("message", "").lower())
        finally:
            if old_val is not None:
                os.environ["ALLOW_DEV_DEMO_SWITCH"] = old_val
            if old_legacy is not None:
                os.environ["ALLOW_DEMO_SWITCH"] = old_legacy

    def test_09_demo_switch_missing_or_invalid_flask_env(self):
        """When FLASK_ENV is missing or set to staging/other, demo switching must return 403."""
        old_env = os.environ.get("FLASK_ENV")
        try:
            # Test when FLASK_ENV is staging
            os.environ["FLASK_ENV"] = "staging"
            # Temporarily turn off app TESTING flag to exercise environment verification
            self.app.config["TESTING"] = False
            res = self.client.post("/api/auth/demo-switch", json={
                "email": "r.sen@forensics.example.com"
            })
            self.assertEqual(res.status_code, 403)

            # Test when FLASK_ENV is empty
            os.environ["FLASK_ENV"] = ""
            res2 = self.client.post("/api/auth/demo-switch", json={
                "email": "r.sen@forensics.example.com"
            })
            self.assertEqual(res2.status_code, 403)
        finally:
            self.app.config["TESTING"] = True
            if old_env is not None:
                os.environ["FLASK_ENV"] = old_env
            else:
                os.environ["FLASK_ENV"] = "development"

    def test_10_privilege_escalation_to_unapproved_account(self):
        """Attempting to switch to an unapproved custom account must be rejected."""
        res = self.client.post("/api/auth/demo-switch", json={
            "email": "officer@example.com"  # id=1, has no employee_id and not in approved demo set
        })
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertIn("restricted", data.get("message", "").lower())

if __name__ == "__main__":
    unittest.main()
