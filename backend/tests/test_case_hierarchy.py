"""
Backend Security, Hierarchy & RBAC Test Suite for Case-Wise Organizational Hierarchy
Validates:
1. Unauthenticated rejection (401) across all case hierarchy endpoints
2. Retrieval of cases with assignment counts and status
3. Clean unconfigured state ("hasAssignments": False) for unassigned cases
4. Server-side RBAC: Non-HOD restriction (403) on assignments, updates, and removals
5. Dynamic case-wise reporting: Case A vs Case B independence
6. Dual role inversion: Officer serving as supervisor in Case A and subordinate in Case B
7. Prevention of circular reporting relationships (HTTP 400)
8. Prevention of self-reporting (HTTP 400)
9. Prevention of cross-case supervisor references (HTTP 400)
10. Prevention of duplicate active assignments in the same case (HTTP 400)
11. Safe removal of supervisor with automatic re-parenting of subordinates to prevent orphans
12. Comprehensive audit logging of all assignment lifecycle operations
"""

import os
import unittest
import json
from app import app
from database.db import get_db
from tests.test_isolation_helper import setup_isolated_test_environment, teardown_isolated_test_environment

class TestCaseHierarchy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_db = setup_isolated_test_environment(prefix="test_hierarchy_")
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO cases (case_id, title) VALUES ('CASE-2026-CYBER-091', 'Cyber Investigation')")
        cursor.execute("INSERT OR IGNORE INTO cases (case_id, title) VALUES ('CASE-2026-PDF-9041', 'Document Forgery')")
        conn.commit()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        teardown_isolated_test_environment(cls.temp_db)

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        os.environ["ALLOW_DEV_DEMO_SWITCH"] = "true"
        os.environ["ALLOW_DEV_DIAGNOSTICS"] = "true"
        os.environ["FLASK_ENV"] = "development"

        # Clean assignments for isolated test cases
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM case_assignments WHERE case_id IN ('CASE-2026-CYBER-091', 'CASE-2026-PDF-9041', 'CASE-TEST-ISOLATED')")
        cursor.execute("DELETE FROM case_hierarchy_audit_log WHERE case_id IN ('CASE-2026-CYBER-091', 'CASE-2026-PDF-9041', 'CASE-TEST-ISOLATED')")
        conn.commit()
        conn.close()

    def login_as(self, email):
        """Helper to switch session via authenticated demo-switch in development."""
        res = self.client.post("/api/auth/demo-switch", json={"email": email})
        self.assertEqual(res.status_code, 200, f"Failed to authenticate as {email}")
        return res

    def test_01_unauthenticated_requests_rejected(self):
        """Unauthenticated requests to any case hierarchy endpoint must return 401."""
        endpoints = [
            ("GET", "/api/department/cases"),
            ("GET", "/api/department/case-hierarchy?caseId=CASE-2026-CYBER-091"),
            ("GET", "/api/department/personnel"),
            ("POST", "/api/department/case-assignments"),
            ("POST", "/api/department/case-assignments/ASG-TEST/update"),
            ("POST", "/api/department/case-assignments/ASG-TEST/remove"),
            ("GET", "/api/department/case-hierarchy/audit-log?caseId=CASE-2026-CYBER-091"),
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                res = self.client.get(endpoint)
            else:
                res = self.client.post(endpoint, json={})
            self.assertEqual(res.status_code, 401, f"{endpoint} did not return 401 for unauthenticated request")
            data = res.get_json()
            self.assertEqual(data.get("status"), "unauthenticated")

    def test_02_cases_listing_and_empty_hierarchy(self):
        """Authenticated officers can query cases list and receive unconfigured hierarchy for unassigned cases."""
        self.login_as("r.sharma@forensics.example.com")

        # 1. List cases
        res = self.client.get("/api/department/cases")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertGreaterEqual(data.get("totalCases", 0), 2)
        cases = data.get("cases", [])
        case_map = {c["caseId"]: c for c in cases}
        self.assertIn("CASE-2026-CYBER-091", case_map)
        self.assertIn("CASE-2026-PDF-9041", case_map)

        # 2. Query unassigned case hierarchy
        res_h = self.client.get("/api/department/case-hierarchy?caseId=CASE-2026-CYBER-091")
        self.assertEqual(res_h.status_code, 200)
        h_data = res_h.get_json()
        self.assertEqual(h_data.get("status"), "success")
        self.assertFalse(h_data.get("hasAssignments"))
        self.assertEqual(h_data.get("totalAssigned"), 0)
        self.assertEqual(len(h_data.get("roots", [])), 0)
        self.assertIn("departmentOversight", h_data)
        self.assertEqual(h_data["departmentOversight"]["role"], "Head of Department")

    def test_03_non_hod_cannot_modify_assignments(self):
        """Non-HOD officers must receive HTTP 403 Forbidden when attempting any assignment modifications."""
        self.login_as("r.sharma@forensics.example.com") # Senior Forensic Officer

        # Attempt to assign officer
        res_assign = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 3,
            "caseRole": "Case Lead",
            "responsibilities": "Unauthorized lead attempt"
        })
        self.assertEqual(res_assign.status_code, 403)
        self.assertEqual(res_assign.get_json().get("status"), "forbidden")

        # Attempt to update assignment
        res_update = self.client.post("/api/department/case-assignments/ASG-FAKE/update", json={
            "caseId": "CASE-2026-CYBER-091",
            "caseRole": "Case Lead"
        })
        self.assertEqual(res_update.status_code, 403)
        self.assertEqual(res_update.get_json().get("status"), "forbidden")

        # Attempt to remove assignment
        res_remove = self.client.post("/api/department/case-assignments/ASG-FAKE/remove", json={
            "caseId": "CASE-2026-CYBER-091"
        })
        self.assertEqual(res_remove.status_code, 403)
        self.assertEqual(res_remove.get_json().get("status"), "forbidden")

    def test_04_independent_hierarchies_and_role_inversion(self):
        """HOD can configure distinct hierarchies where an officer is supervisor in Case A and subordinate in Case B."""
        self.login_as("r.sen@forensics.example.com") # Head of Department

        # --- SETUP CASE A (CASE-2026-CYBER-091) ---
        # 1. Rahul Sharma (id=3) as Case Lead
        res_a1 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 3,
            "caseRole": "Case Lead",
            "reportsToAssignmentId": None,
            "responsibilities": "Overall incident coordination and forensic oversight."
        })
        self.assertEqual(res_a1.status_code, 201)
        asg_a_rahul = res_a1.get_json()["assignmentId"]

        # 2. Ananya Patel (id=4) as Forensic Analyst reporting to Rahul
        res_a2 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 4,
            "caseRole": "Forensic Analyst",
            "reportsToAssignmentId": asg_a_rahul,
            "responsibilities": "Server memory artifact analysis and malware decompilation."
        })
        self.assertEqual(res_a2.status_code, 201)
        asg_a_ananya = res_a2.get_json()["assignmentId"]

        # 3. Vikram Mehta (id=6) as Investigating Officer reporting to Ananya
        res_a3 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 6,
            "caseRole": "Investigating Officer",
            "reportsToAssignmentId": asg_a_ananya,
            "responsibilities": "Field interviews and network device acquisition."
        })
        self.assertEqual(res_a3.status_code, 201)
        asg_a_vikram = res_a3.get_json()["assignmentId"]

        # Verify Case A hierarchy tree structure
        res_tree_a = self.client.get("/api/department/case-hierarchy?caseId=CASE-2026-CYBER-091")
        self.assertEqual(res_tree_a.status_code, 200)
        tree_a = res_tree_a.get_json()
        self.assertTrue(tree_a["hasAssignments"])
        self.assertEqual(tree_a["totalAssigned"], 3)
        self.assertEqual(len(tree_a["roots"]), 1)

        root_a = tree_a["roots"][0]
        self.assertEqual(root_a["officerName"], "Rahul Sharma")
        self.assertEqual(root_a["caseRole"], "Case Lead")
        self.assertEqual(len(root_a["children"]), 1)

        child_ananya = root_a["children"][0]
        self.assertEqual(child_ananya["officerName"], "Ananya Patel")
        self.assertEqual(len(child_ananya["children"]), 1)

        child_vikram = child_ananya["children"][0]
        self.assertEqual(child_vikram["officerName"], "Vikram Mehta")

        # --- SETUP CASE B (CASE-2026-PDF-9041) WITH ROLE INVERSION ---
        # In Case B: Ananya Patel (id=4) is Case Lead!
        res_b1 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-PDF-9041",
            "userId": 4,
            "caseRole": "Case Lead",
            "reportsToAssignmentId": None,
            "responsibilities": "Lead forensic scrutiny of document tampering."
        })
        self.assertEqual(res_b1.status_code, 201)
        asg_b_ananya = res_b1.get_json()["assignmentId"]

        # In Case B: Rahul Sharma (id=3) reports to Ananya!
        res_b2 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-PDF-9041",
            "userId": 3,
            "caseRole": "Digital Evidence Specialist",
            "reportsToAssignmentId": asg_b_ananya,
            "responsibilities": "PDF bytecode and incremental save extraction."
        })
        self.assertEqual(res_b2.status_code, 201)
        asg_b_rahul = res_b2.get_json()["assignmentId"]

        # Verify Case B hierarchy tree structure
        res_tree_b = self.client.get("/api/department/case-hierarchy?caseId=CASE-2026-PDF-9041")
        self.assertEqual(res_tree_b.status_code, 200)
        tree_b = res_tree_b.get_json()
        self.assertTrue(tree_b["hasAssignments"])
        self.assertEqual(tree_b["totalAssigned"], 2)
        self.assertEqual(len(tree_b["roots"]), 1)

        root_b = tree_b["roots"][0]
        self.assertEqual(root_b["officerName"], "Ananya Patel")
        self.assertEqual(root_b["caseRole"], "Case Lead")
        self.assertEqual(len(root_b["children"]), 1)

        sub_rahul = root_b["children"][0]
        self.assertEqual(sub_rahul["officerName"], "Rahul Sharma")
        self.assertEqual(sub_rahul["caseRole"], "Digital Evidence Specialist")

        # Confirm Case A hierarchy remains unchanged (Rahul still Lead in Case A)
        res_tree_a_recheck = self.client.get("/api/department/case-hierarchy?caseId=CASE-2026-CYBER-091")
        tree_a_recheck = res_tree_a_recheck.get_json()
        self.assertEqual(tree_a_recheck["roots"][0]["officerName"], "Rahul Sharma")

    def test_05_integrity_and_anti_circular_validation(self):
        """Backend must reject circular reporting, self-reporting, cross-case references, and duplicates."""
        self.login_as("r.sen@forensics.example.com")

        # 1. Setup chain: Rahul (Lead) -> Ananya -> Vikram in Case A
        res_a1 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 3,
            "caseRole": "Case Lead",
            "reportsToAssignmentId": None
        })
        asg_rahul = res_a1.get_json()["assignmentId"]

        res_a2 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 4,
            "caseRole": "Forensic Analyst",
            "reportsToAssignmentId": asg_rahul
        })
        asg_ananya = res_a2.get_json()["assignmentId"]

        res_a3 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 6,
            "caseRole": "Investigating Officer",
            "reportsToAssignmentId": asg_ananya
        })
        asg_vikram = res_a3.get_json()["assignmentId"]

        # Test A: Duplicate active assignment in same case
        res_dup = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 3,
            "caseRole": "Secondary Role"
        })
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already holds an active assignment", res_dup.get_json()["message"])

        # Test B: Self-reporting
        res_self = self.client.post(f"/api/department/case-assignments/{asg_rahul}/update", json={
            "caseId": "CASE-2026-CYBER-091",
            "caseRole": "Case Lead",
            "reportsToAssignmentId": asg_rahul
        })
        self.assertEqual(res_self.status_code, 400)
        self.assertIn("cannot report to themselves", res_self.get_json()["message"])

        # Test C: Circular reporting (attempting to make Rahul report to Vikram)
        res_circ = self.client.post(f"/api/department/case-assignments/{asg_rahul}/update", json={
            "caseId": "CASE-2026-CYBER-091",
            "caseRole": "Subordinate Lead",
            "reportsToAssignmentId": asg_vikram
        })
        self.assertEqual(res_circ.status_code, 400)
        self.assertIn("Circular reporting", res_circ.get_json()["message"])

        # Test D: Cross-case supervisor reference
        # Create an assignment in Case B
        res_b = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-PDF-9041",
            "userId": 5,
            "caseRole": "Evidence Custodian"
        })
        asg_case_b = res_b.get_json()["assignmentId"]

        # Try to make Vikram in Case A report to assignment in Case B
        res_cross = self.client.post(f"/api/department/case-assignments/{asg_vikram}/update", json={
            "caseId": "CASE-2026-CYBER-091",
            "caseRole": "Investigating Officer",
            "reportsToAssignmentId": asg_case_b
        })
        self.assertEqual(res_cross.status_code, 400)
        self.assertIn("does not exist as an active assignment in case", res_cross.get_json()["message"])

    def test_06_safe_removal_and_subordinate_reparenting(self):
        """When an intermediate supervisor is removed, subordinates must be safely re-parented."""
        self.login_as("r.sen@forensics.example.com")

        # Setup: Rahul (Lead) -> Ananya -> Vikram
        res_a1 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 3,
            "caseRole": "Case Lead"
        })
        asg_rahul = res_a1.get_json()["assignmentId"]

        res_a2 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 4,
            "caseRole": "Forensic Analyst",
            "reportsToAssignmentId": asg_rahul
        })
        asg_ananya = res_a2.get_json()["assignmentId"]

        res_a3 = self.client.post("/api/department/case-assignments", json={
            "caseId": "CASE-2026-CYBER-091",
            "userId": 6,
            "caseRole": "Investigating Officer",
            "reportsToAssignmentId": asg_ananya
        })
        asg_vikram = res_a3.get_json()["assignmentId"]

        # Remove Ananya (intermediate supervisor)
        res_rem = self.client.post(f"/api/department/case-assignments/{asg_ananya}/remove", json={
            "caseId": "CASE-2026-CYBER-091"
        })
        self.assertEqual(res_rem.status_code, 200)

        # Check tree: Vikram should now report directly to Rahul (Ananya's former supervisor)
        res_tree = self.client.get("/api/department/case-hierarchy?caseId=CASE-2026-CYBER-091")
        tree = res_tree.get_json()
        self.assertEqual(tree["totalAssigned"], 2)
        root = tree["roots"][0]
        self.assertEqual(root["officerName"], "Rahul Sharma")
        self.assertEqual(len(root["children"]), 1)
        self.assertEqual(root["children"][0]["officerName"], "Vikram Mehta")
        self.assertEqual(root["children"][0]["reportsToAssignmentId"], asg_rahul)

        # Verify audit log recorded re-parenting
        res_audit = self.client.get("/api/department/case-hierarchy/audit-log?caseId=CASE-2026-CYBER-091")
        self.assertEqual(res_audit.status_code, 200)
        logs = res_audit.get_json().get("auditLog", [])
        actions = [l["action"] for l in logs]
        self.assertIn("REMOVE", actions)
        self.assertIn("REASSIGN_SUPERVISOR", actions)

if __name__ == "__main__":
    unittest.main()
