"""
Backend Security, Audit, and RBAC Test Suite for System Health & Diagnostics
Validates:
1. Unauthenticated rejection (401) across all diagnostics endpoints
2. Authenticated operational health summary (200) across 5 core services
3. Read-only ledger continuity audit (200) identifying anchored vs historical records
4. Non-HOD restriction (403) on technical telemetry and development tools
5. HOD access (200) to technical diagnostics with sanitized parameters and zero secrets
6. Development tools safety: public addresses only, zero private keys
7. Production hardening and environment enforcement for development tools
8. Safe server-side JSON-RPC ping to consensus node
"""

import os
import unittest
import json
from app import app
from database.db import get_db
from tests.test_isolation_helper import setup_isolated_test_environment, teardown_isolated_test_environment

class TestSystemDiagnostics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_db = setup_isolated_test_environment(prefix="test_diag_")

    @classmethod
    def tearDownClass(cls):
        teardown_isolated_test_environment(cls.temp_db)

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        # Default development environment configuration
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["ALLOW_DEV_DIAGNOSTICS"] = "true"
        os.environ["FLASK_ENV"] = "development"

    def login_as(self, email):
        """Helper to switch session via authenticated demo-switch in development."""
        res = self.client.post("/api/auth/demo-switch", json={"email": email})
        self.assertEqual(res.status_code, 200, f"Failed to authenticate as {email}")
        return res

    def test_01_unauthenticated_requests_rejected(self):
        """Unauthenticated requests to any diagnostics endpoint must return 401."""
        endpoints = [
            ("GET", "/api/diagnostics/summary"),
            ("GET", "/api/diagnostics/consistency"),
            ("GET", "/api/diagnostics/technical"),
            ("GET", "/api/diagnostics/dev-tools"),
            ("POST", "/api/diagnostics/ping-rpc"),
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                res = self.client.get(endpoint)
            else:
                res = self.client.post(endpoint)
            self.assertEqual(res.status_code, 401, f"{endpoint} did not return 401 for unauthenticated request")
            data = res.get_json()
            self.assertEqual(data.get("status"), "unauthenticated")

    def test_02_authenticated_summary_nominal(self):
        """Any authenticated officer can retrieve operational health summary across 5 services."""
        self.login_as("r.sharma@forensics.example.com")

        res = self.client.get("/api/diagnostics/summary")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("systemHealth", data)
        self.assertIn(data["systemHealth"], ["Healthy", "Degraded"])

        services = data.get("services", [])
        self.assertEqual(len(services), 5)

        service_ids = [s["id"] for s in services]
        self.assertIn("flask_api", service_ids)
        self.assertIn("sqlite_database", service_ids)
        self.assertIn("hardhat_node", service_ids)
        self.assertIn("smart_contract", service_ids)
        self.assertIn("evidence_storage", service_ids)

        for s in services:
            self.assertIn(s["status"], ["Healthy", "Degraded", "Unavailable"])
            self.assertGreaterEqual(s["responseTimeMs"], 0)
            self.assertIsNotNone(s["checkedAt"])

    def test_03_authenticated_ledger_consistency_audit(self):
        """Ledger consistency audit correctly inspects SQLite vs active Hardhat ledger."""
        self.login_as("r.sharma@forensics.example.com")

        res = self.client.get("/api/diagnostics/consistency")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

        # Verify factual ledger metrics
        total = data.get("totalDbRecords")
        anchored = data.get("anchoredRecords")
        unanchored = data.get("unanchoredRecords")
        network_errs = data.get("networkErrorRecords")

        self.assertGreater(total, 0)
        self.assertEqual(total, anchored + unanchored + network_errs)
        self.assertEqual(total, 27)
        self.assertEqual(data.get("historicalRecords"), 26)
        self.assertEqual(data.get("neverAnchoredRecords"), 1)
        self.assertEqual(network_errs, 0)

        # Verify historical restart advisory explanation
        self.assertEqual(data.get("ledgerState"), "HISTORICAL_RESTART_DETECTED")
        self.assertIn("Ledger Continuity Advisory", data.get("warning", ""))
        self.assertIn("Historical records preserved", data.get("explanation", ""))

        # Verify samples
        samples = data.get("samples", {})
        self.assertIn("anchored", samples)
        self.assertIn("unanchored", samples)
        self.assertEqual(len(samples["unanchored"]), min(unanchored, 6))

    def test_04_non_hod_technical_and_devtools_restricted(self):
        """Non-HOD officer must receive 403 Forbidden on technical telemetry and dev tools."""
        self.login_as("r.sharma@forensics.example.com") # Senior Forensic Analyst (non-HOD)

        res_tech = self.client.get("/api/diagnostics/technical")
        self.assertEqual(res_tech.status_code, 403)
        data_tech = res_tech.get_json()
        self.assertEqual(data_tech.get("status"), "forbidden")

        res_dev = self.client.get("/api/diagnostics/dev-tools")
        self.assertEqual(res_dev.status_code, 403)
        data_dev = res_dev.get_json()
        self.assertEqual(data_dev.get("status"), "forbidden")

    def test_05_hod_technical_diagnostics_sanitized(self):
        """HOD officer receives technical diagnostics with strictly sanitized data and zero secrets."""
        self.login_as("r.sen@forensics.example.com") # Head of Department

        res = self.client.get("/api/diagnostics/technical")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

        diag = data.get("diagnostics", {})
        self.assertIn("apiGateway", diag)
        self.assertIn("consensusLayer", diag)
        self.assertIn("persistenceLayer", diag)

        # Verify CORS telemetry reflects actual server configuration
        cors = diag["apiGateway"].get("cors", {})
        self.assertFalse(cors.get("wildcardAllowed"))
        self.assertTrue(cors.get("credentialsSupported"))

        # Verify storage vault metrics
        vault = diag["persistenceLayer"].get("storageVault", {})
        self.assertTrue(vault.get("writable"))
        self.assertGreaterEqual(vault.get("fileCount", 0), 0)

        # Verify zero secret leakage in serialized JSON payload
        raw_text = res.get_data(as_text=True).lower()
        self.assertNotIn("private_key", raw_text)
        self.assertNotIn("secret_key", raw_text)
        self.assertNotIn("mnemonic", raw_text)
        self.assertNotIn("password", raw_text)

    def test_06_hod_dev_tools_public_accounts(self):
        """HOD officer can view local testnet accounts, but private keys are never exposed."""
        self.login_as("r.sen@forensics.example.com")

        res = self.client.get("/api/diagnostics/dev-tools")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

        accounts = data.get("accounts", [])
        self.assertGreaterEqual(len(accounts), 5)

        for acc in accounts:
            self.assertIn("index", acc)
            self.assertIn("officer", acc)
            self.assertIn("role", acc)
            self.assertIn("address", acc)
            self.assertIn("testBalance", acc)
            # Critical security verification: zero private key fields
            self.assertNotIn("privateKey", acc)
            self.assertNotIn("private_key", acc)
            self.assertNotIn("secret", acc)

    def test_07_dev_tools_production_or_disabled_flag(self):
        """Development tools must be rejected if ALLOW_DEV_DIAGNOSTICS is false or FLASK_ENV is production."""
        self.login_as("r.sen@forensics.example.com")

        # Test case A: Flag explicitly set to false
        os.environ["ALLOW_DEV_DIAGNOSTICS"] = "false"
        try:
            res = self.client.get("/api/diagnostics/dev-tools")
            self.assertEqual(res.status_code, 403)
        finally:
            os.environ["ALLOW_DEV_DIAGNOSTICS"] = "true"

        # Test case B: Environment set to production
        os.environ["FLASK_ENV"] = "production"
        try:
            res = self.client.get("/api/diagnostics/dev-tools")
            self.assertEqual(res.status_code, 403)
        finally:
            os.environ["FLASK_ENV"] = "development"

    def test_08_safe_rpc_ping(self):
        """Authenticated officer can execute a safe server-side JSON-RPC ping for eth_blockNumber."""
        self.login_as("r.sharma@forensics.example.com")

        res = self.client.post("/api/diagnostics/ping-rpc")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertGreaterEqual(data.get("blockNumber"), 0)
        self.assertTrue(str(data.get("hexBlock")).startswith("0x"))
        self.assertGreaterEqual(data.get("latencyMs"), 0)
        self.assertIn("127.0.0.1:8545", data.get("endpoint"))

if __name__ == "__main__":
    unittest.main()
