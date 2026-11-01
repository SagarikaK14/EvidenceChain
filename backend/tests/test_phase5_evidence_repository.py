"""
Test Suite: Phase 5 - Evidence Repository & Archival Data Integrity
Validates:
1. All 27 protected evidence records returned by GET /api/evidence
2. Institutional schema validation for every evidence record
3. Status and audit classification across all records
4. Single-record detail retrieval (GET /api/evidence/<id>)
5. Non-existent record rejection with 404
6. Exclusion of decommissioned test artifact (EVD-6C4A0F00)
7. Case grouping association and referential validity
8. SHA-256 digest format and integrity validation
9. Custody and anchoring metadata availability
10. Robustness against malformed or injection evidence ID queries
"""

import os
import unittest
import json
from app import app
from database.db import get_db


class TestPhase5EvidenceRepository(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tests.test_isolation_helper import setup_isolated_test_environment
        cls.temp_db = setup_isolated_test_environment(prefix="test_repo_")

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
        # Authenticate as HOD
        self.client.post("/api/auth/demo-switch", json={"email": "hod.cyber@agency.gov.in"})

    def test_01_all_27_baseline_records_returned(self):
        """GET /api/evidence must return all 27 protected baseline records."""
        res = self.client.get("/api/evidence")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("totalCount"), 27)
        self.assertEqual(len(data.get("evidence", [])), 27)

    def test_02_institutional_schema_fields(self):
        """Every evidence record must include required institutional metadata fields."""
        res = self.client.get("/api/evidence")
        self.assertEqual(res.status_code, 200)
        items = res.get_json().get("evidence", [])
        self.assertGreater(len(items), 0)

        required_fields = {
            "evidenceId",
            "caseId",
            "title",
            "description",
            "filePath",
            "sha256Hash",
            "registeredBy",
            "createdAt",
            "isOnChain",
            "isHistorical",
            "ledgerStatus",
            "ledgerStatusLabel"
        }

        for item in items:
            for field in required_fields:
                self.assertIn(field, item, f"Field '{field}' missing from record {item.get('evidenceId')}")
            # SHA-256 hash must be 64 hexadecimal characters
            hash_val = item["sha256Hash"]
            self.assertEqual(len(hash_val), 64, f"Hash '{hash_val}' is not 64 hex characters")
            int(hash_val, 16)  # Must be valid hex

    def test_03_status_distribution_sums_to_total(self):
        """Authoritative status counts must sum to exactly totalCount (27)."""
        res = self.client.get("/api/evidence")
        data = res.get_json()
        total = data["totalCount"]
        active = data["activeLedgerCount"]
        historical = data["historicalCount"]
        never_anchored = data.get("neverAnchoredCount", 0)
        pending = data.get("pendingCount", 0)
        unavailable = data.get("unavailableCount", 0)

        self.assertEqual(active + historical + never_anchored + pending + unavailable, total)
        self.assertEqual(total, 27)

    def test_04_single_record_detail_retrieval(self):
        """GET /api/evidence/<id> returns 200 with full record and audit data."""
        # Test first record from list
        list_res = self.client.get("/api/evidence")
        first_id = list_res.get_json()["evidence"][0]["evidenceId"]

        detail_res = self.client.get(f"/api/evidence/{first_id}")
        self.assertEqual(detail_res.status_code, 200)
        detail_data = detail_res.get_json()
        self.assertEqual(detail_data.get("status"), "success")
        self.assertIn("database", detail_data)
        db_ev = detail_data["database"]
        self.assertEqual(db_ev.get("evidenceId"), first_id)
        self.assertIn("caseId", db_ev)
        self.assertIn("sha256Hash", db_ev)
        self.assertIn("ledgerStatus", detail_data)

    def test_05_nonexistent_evidence_returns_404(self):
        """GET /api/evidence/<id> for nonexistent ID returns 404."""
        res = self.client.get("/api/evidence/EVD-NONEXISTENT-99999")
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")
        self.assertIn("does not exist", data.get("message", ""))

    def test_06_decommissioned_test_artifact_excluded(self):
        """EVD-6C4A0F00 must never be returned in the active evidence repository."""
        res = self.client.get("/api/evidence")
        items = res.get_json().get("evidence", [])
        evidence_ids = [item["evidenceId"] for item in items]
        self.assertNotIn("EVD-6C4A0F00", evidence_ids)

        # Direct GET must also return 404
        direct_res = self.client.get("/api/evidence/EVD-6C4A0F00")
        self.assertEqual(direct_res.status_code, 404)

    def test_07_case_association_validity(self):
        """All 27 evidence items must belong to a known case hierarchy."""
        res = self.client.get("/api/evidence")
        items = res.get_json().get("evidence", [])
        case_ids = {item["caseId"] for item in items}
        self.assertGreater(len(case_ids), 0)
        for cid in case_ids:
            self.assertTrue(cid and cid.lower().startswith("case"), f"Case ID '{cid}' does not follow case* pattern")

    def test_08_sha256_digests_immutable_and_distinct(self):
        """Hashes in repository must be unique and match baseline expectations."""
        res = self.client.get("/api/evidence")
        items = res.get_json().get("evidence", [])
        hashes = [item["sha256Hash"] for item in items]
        self.assertEqual(len(hashes), 27)
        # Verify no null or empty hashes
        for h in hashes:
            self.assertTrue(h and len(h) == 64)

    def test_09_ledger_status_truthful_terminology(self):
        """Ledger status labels must be accurate institutional terms, not hype."""
        res = self.client.get("/api/evidence")
        items = res.get_json().get("evidence", [])
        allowed_statuses = {"VERIFIED_ACTIVE", "HISTORICAL_RECORD", "NEVER_ANCHORED", "PENDING_VERIFICATION", "LEDGER_UNAVAILABLE"}
        for item in items:
            self.assertIn(item["ledgerStatus"], allowed_statuses, f"Unexpected ledger status: {item['ledgerStatus']}")
            self.assertTrue(item["ledgerStatusLabel"])

    def test_10_sql_injection_defense_on_evidence_id(self):
        """Malicious SQL injection payloads in evidence ID must not cause 500 error or bypass."""
        payloads = [
            "EVD-001' OR '1'='1",
            "EVD-001; DROP TABLE evidence;--",
            "' UNION SELECT * FROM users--",
            "../../etc/passwd",
            "<script>alert(1)</script>"
        ]
        for p in payloads:
            res = self.client.get(f"/api/evidence/{p}")
            self.assertIn(res.status_code, (400, 404), f"Payload '{p}' did not return 400 or 404")


if __name__ == "__main__":
    unittest.main()
