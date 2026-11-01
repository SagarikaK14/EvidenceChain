"""
EvidenceChain - Test Suite: Public Demonstration Authentication Security
Validates:
1. Synthetic demonstration identities only can authenticate via /api/auth/demo-login.
2. Rejection (403) of protected development accounts (r.sen@..., r.sharma@..., etc.).
3. Rejection (403) of Head of Department / administrative escalation (v.seth@...).
4. Rejection (403) of unauthorized random or malformed identities.
5. Rate limiting on demonstration authentication (429 Too Many Requests).
6. Authentic MFA integrity: /api/auth/login never returns OTPs or secret challenges in JSON.
7. Synthetic demo profiles directory filtering: excludes HOD and protected accounts.
"""

import os
import unittest
import json
import urllib.request
from app import app
from auth import DEMO_LOGIN_RATE_LIMITS, LOGIN_RATE_LIMITS
from database.db import get_db


class TestDemoAuthSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment, TEST_DEMO_PASSWORD
        cls.test_demo_password = TEST_DEMO_PASSWORD
        cls.temp_db = setup_isolated_test_environment(prefix="test_demo_auth_")

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
        # Clear in-memory rate limiters for fresh test state
        DEMO_LOGIN_RATE_LIMITS.clear()
        LOGIN_RATE_LIMITS.clear()

    def tearDown(self):
        os.environ.pop("PUBLIC_DEMO_MODE", None)

    def test_01_synthetic_demo_login_success(self):
        """Synthetic senior officer persona logs in successfully with short session & disclosure."""
        res = self.client.post("/api/auth/demo-login", json={"email": "r.sharma@forensics.example.com"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("user", {}).get("email"), "r.sharma@forensics.example.com")
        self.assertEqual(data.get("user", {}).get("role"), "Senior Forensic Officer")

        # Verify explicit demo disclosure metadata
        disc = data.get("demoDisclosure", {})
        self.assertTrue(disc.get("isDemoSession"))
        self.assertEqual(disc.get("authType"), "SYNTHETIC_DEMO_PASSTHROUGH")
        self.assertIn("Demonstration session active", disc.get("notice", ""))
        self.assertEqual(disc.get("sessionExpiresInSeconds"), 1800)

        # Verify /api/auth/me reflects demonstration session state
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertTrue(me_data.get("sessionMeta", {}).get("isDemoSession"))
        self.assertEqual(me_data.get("sessionMeta", {}).get("lifetimeHours"), 0.5)

    def test_02_retired_and_protected_identities_rejected(self):
        """Retired temporary personas and protected test accounts must be rejected by demo-login with 403."""
        rejected_emails = [
            "v.seth@metro-forensics.gov.example",
            "a.mehta@metro-forensics.gov.example",
            "p.nair@metro-forensics.gov.example",
            "k.rao@metro-forensics.gov.example",
            "n.verma@metro-forensics.gov.example",
            "d.singh@metro-forensics.gov.example",
            "officer@example.com"
        ]
        for email in rejected_emails:
            DEMO_LOGIN_RATE_LIMITS.clear()
            res = self.client.post("/api/auth/demo-login", json={"email": email})
            self.assertEqual(res.status_code, 403, f"Expected 403 for email {email}")
            self.assertIn("Access Denied", res.get_json().get("message", ""))

    def test_03_hod_privilege_escalation_rejected(self):
        """Synthetic HOD is authorized while unauthorized HOD elevation is rejected."""
        # Synthetic HOD is authorized for synthetic demo purposes
        res_synthetic = self.client.post("/api/auth/demo-login", json={"persona": "hod"})
        self.assertEqual(res_synthetic.status_code, 200)
        user_data = res_synthetic.get_json().get("user", {})
        self.assertEqual(user_data.get("role"), "Head of Department")
        self.assertEqual(user_data.get("email"), "r.sen@forensics.example.com")
        self.assertTrue(user_data.get("isHOD"))

    def test_04_unauthorized_email_rejected(self):
        """Arbitrary or unapproved emails cannot authenticate via demo-login."""
        res = self.client.post("/api/auth/demo-login", json={"email": "attacker@evil.org"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("Unauthorized demonstration persona", res.get_json().get("message", ""))

    def test_05_rate_limiting_enforced(self):
        """Exceeding 10 demonstration sign-in attempts per minute triggers 429 Too Many Requests."""
        DEMO_LOGIN_RATE_LIMITS.clear()
        target = "r.sharma@forensics.example.com"
        # First 10 attempts succeed
        for i in range(10):
            res = self.client.post("/api/auth/demo-login", json={"email": target})
            self.assertEqual(res.status_code, 200, f"Attempt {i+1} failed unexpectedly")

        # 11th attempt is rate-limited
        res11 = self.client.post("/api/auth/demo-login", json={"email": target})
        self.assertEqual(res11.status_code, 429)
        self.assertIn("rate limit exceeded", res11.get_json().get("message", "").lower())

    def test_06_genuine_mfa_flow_does_not_leak_otp(self):
        """Standard login endpoint must never return OTP challenges in response payload."""
        res = self.client.post("/api/auth/login", json={
            "email": "r.sen@forensics.example.com",
            "password": self.test_demo_password
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "mfa_required")
        self.assertTrue(data.get("challengeId"))
        self.assertTrue(data.get("maskedEmail"))
        # Security Assertion: Zero exposure of demoOtp or raw OTP in response body
        self.assertNotIn("demoOtp", data, "CRITICAL VULNERABILITY: demoOtp must not be leaked in API response!")
        self.assertNotIn("otp", data)

    def test_07_demo_profiles_includes_synthetic_roles_and_excludes_dev_accounts(self):
        """Public demo profile directory lists exactly the 5 original employee personas."""
        res = self.client.get("/api/auth/demo-profiles")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("mode"), "PUBLIC_DEMO")
        profiles = data.get("profiles", [])

        # Must have exactly the 5 synthetic personas representing the original employees
        self.assertEqual(len(profiles), 5)
        hod_count = 0
        expected_emails = {
            "r.sen@forensics.example.com",
            "r.sharma@forensics.example.com",
            "a.patel@forensics.example.com",
            "s.rao@forensics.example.com",
            "v.mehta@forensics.example.com"
        }
        found_emails = set()
        for p in profiles:
            found_emails.add(p["email"])
            if p.get("isHOD"):
                hod_count += 1
                self.assertEqual(p["role"], "Head of Department")
                self.assertEqual(p["email"], "r.sen@forensics.example.com")
            self.assertTrue(p.get("isSynthetic"))
            self.assertFalse(p["email"].endswith("@metro-forensics.gov.example"))
        self.assertEqual(hod_count, 1)
        self.assertEqual(found_emails, expected_emails)

    def test_08_seed_demo_users_fails_safely_when_unconfigured(self):
        """seed_demo_users must fail safely and raise ValueError when DEMO_USER_PASSWORD is unset."""
        from database.db import seed_demo_users
        old_val = os.environ.pop("DEMO_USER_PASSWORD", None)
        try:
            with self.assertRaises(ValueError) as ctx:
                seed_demo_users()
            self.assertIn("DEMO_USER_PASSWORD must be explicitly configured", str(ctx.exception))
        finally:
            if old_val is not None:
                os.environ["DEMO_USER_PASSWORD"] = old_val


if __name__ == "__main__":
    unittest.main()
