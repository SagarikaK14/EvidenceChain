#!/usr/bin/env python3
"""
Seed realistic case-specific reporting hierarchies for all 5 demo cases:
- CASE-2026-METRO-101: Operation Nightfall — Corporate Infrastructure Exfiltration
- CASE-2026-METRO-102: Operation Blue Ridge — Counterfeit Payment Terminals
- CASE-2026-METRO-103: Operation Sentinel — Vehicle Sensor Telemetry Tampering
- CASE-2026-METRO-104: Operation Deep Water — Supervisory Control Intrusion
- CASE-2026-M101: Forensic Docket CASE-2026-M101

Utilizes the 5 institutional personas:
1. Dr. Rajeshwar Sen (HOD-0001, Head of Department / Departmental Oversight)
2. Rahul Sharma (OFF-1024, Senior Forensic Officer / Lead)
3. Ananya Patel (OFF-2048, Digital Forensics Analyst)
4. Sunita Rao (CUST-4096, Evidence Custodian)
5. Vikram Mehta (EXAM-512, Investigating Officer / Lead)
"""

import os
import sys
import sqlite3

DEMO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(DEMO_ROOT, "demo_data", "demo_evidence.db")

def seed_case_hierarchies(db_path=DB_PATH):
    if not os.path.exists(db_path):
        print(f"[!] Database not found at: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Verify users
    cursor.execute("SELECT id, name, role, employee_id FROM users")
    users = {r["employee_id"]: dict(r) for r in cursor.fetchall()}

    sen = users.get("HOD-0001")
    sharma = users.get("OFF-1024")
    patel = users.get("OFF-2048")
    rao = users.get("CUST-4096")
    mehta = users.get("EXAM-512")

    if not all([sen, sharma, patel, rao, mehta]):
        print("[!] Missing required persona in users table.")
        conn.close()
        return False

    # Define hierarchy structures per case
    hierarchies = [
        # CASE 1: CASE-2026-METRO-101
        # Root: Vikram Mehta (Lead Investigator)
        #   -> Rahul Sharma (Senior Forensic Officer)
        #        -> Ananya Patel (Digital Forensics Analyst)
        #   -> Sunita Rao (Evidence Custodian)
        {
            "case_id": "CASE-2026-METRO-101",
            "assignments": [
                {
                    "assignment_id": "ASG-101-MEHTA",
                    "user_id": mehta["id"],
                    "case_role": "Lead Investigator",
                    "reports_to": None,
                    "desc": "Directs overall field search, coordinates judicial warrants, and leads interrogation interviews.",
                },
                {
                    "assignment_id": "ASG-101-SHARMA",
                    "user_id": sharma["id"],
                    "case_role": "Senior Forensic Officer",
                    "reports_to": "ASG-101-MEHTA",
                    "desc": "Supervises cloud server disk image acquisition and provides forensic cryptographic affidavits.",
                },
                {
                    "assignment_id": "ASG-101-PATEL",
                    "user_id": patel["id"],
                    "case_role": "Digital Forensics Analyst",
                    "reports_to": "ASG-101-SHARMA",
                    "desc": "Conducts deep packet flow analysis, reconstructs exfiltration timelines, and decodes encrypted channels.",
                },
                {
                    "assignment_id": "ASG-101-RAO",
                    "user_id": rao["id"],
                    "case_role": "Evidence Custodian",
                    "reports_to": "ASG-101-MEHTA",
                    "desc": "Maintains physical air-gap custody, manages cryptographic vault tokens, and tracks transfer manifests.",
                },
            ],
        },
        # CASE 2: CASE-2026-METRO-102
        # Root: Rahul Sharma (Lead Forensic Examiner)
        #   -> Ananya Patel (Firmware Reverse Engineer)
        #   -> Vikram Mehta (Merchant Premise Investigator)
        #   -> Sunita Rao (Terminal Hardware Vault Custodian)
        {
            "case_id": "CASE-2026-METRO-102",
            "assignments": [
                {
                    "assignment_id": "ASG-102-SHARMA",
                    "user_id": sharma["id"],
                    "case_role": "Lead Forensic Examiner",
                    "reports_to": None,
                    "desc": "Principal technical investigator for counterfeit POS terminal extraction and bus tampering analysis.",
                },
                {
                    "assignment_id": "ASG-102-PATEL",
                    "user_id": patel["id"],
                    "case_role": "Digital Forensics Analyst",
                    "reports_to": "ASG-102-SHARMA",
                    "desc": "Disassembles tampered SPI flash binaries and identifies covert skimmer data exfiltration routines.",
                },
                {
                    "assignment_id": "ASG-102-MEHTA",
                    "user_id": mehta["id"],
                    "case_role": "Investigating Officer",
                    "reports_to": "ASG-102-SHARMA",
                    "desc": "Liaises with commercial banking victims, conducts retail site inspections, and secures CCTV records.",
                },
                {
                    "assignment_id": "ASG-102-RAO",
                    "user_id": rao["id"],
                    "case_role": "Evidence Custodian",
                    "reports_to": "ASG-102-SHARMA",
                    "desc": "Secures 14 seized point-of-sale terminals in Faraday isolation containers with tamper-evident seals.",
                },
            ],
        },
        # CASE 3: CASE-2026-METRO-103
        # Root: Vikram Mehta (Crash Investigation Lead)
        #   -> Rahul Sharma (Vehicle Telemetry Specialist)
        #        -> Ananya Patel (Sensor & Telemetry Analyst)
        #   -> Sunita Rao (ECU Hardware Custodian)
        {
            "case_id": "CASE-2026-METRO-103",
            "assignments": [
                {
                    "assignment_id": "ASG-103-MEHTA",
                    "user_id": mehta["id"],
                    "case_role": "Lead Investigator",
                    "reports_to": None,
                    "desc": "Coordinates crash reconstruction team, vehicle impound preservation, and regulatory safety briefings.",
                },
                {
                    "assignment_id": "ASG-103-SHARMA",
                    "user_id": sharma["id"],
                    "case_role": "Senior Forensic Officer",
                    "reports_to": "ASG-103-MEHTA",
                    "desc": "Captures live CAN bus logs and audits electronic control unit (ECU) cryptographic signatures.",
                },
                {
                    "assignment_id": "ASG-103-PATEL",
                    "user_id": patel["id"],
                    "case_role": "Digital Forensics Analyst",
                    "reports_to": "ASG-103-SHARMA",
                    "desc": "Synchronizes time-series radar and camera sensor logs to identify millisecond timestamp tampering.",
                },
                {
                    "assignment_id": "ASG-103-RAO",
                    "user_id": rao["id"],
                    "case_role": "Evidence Custodian",
                    "reports_to": "ASG-103-MEHTA",
                    "desc": "Stores extracted vehicle black box storage modules in secure physical biometric lockers.",
                },
            ],
        },
        # CASE 4: CASE-2026-METRO-104
        # Root: Rahul Sharma (Industrial Cyber Incident Lead)
        #   -> Ananya Patel (SCADA / PLC Forensic Analyst)
        #   -> Sunita Rao (Industrial Media Custodian)
        {
            "case_id": "CASE-2026-METRO-104",
            "assignments": [
                {
                    "assignment_id": "ASG-104-SHARMA",
                    "user_id": sharma["id"],
                    "case_role": "Lead Investigator",
                    "reports_to": None,
                    "desc": "Supervises electrical grid substation intrusion response and coordinates forensic network isolation.",
                },
                {
                    "assignment_id": "ASG-104-PATEL",
                    "user_id": patel["id"],
                    "case_role": "Digital Forensics Analyst",
                    "reports_to": "ASG-104-SHARMA",
                    "desc": "Performs diffing of PLC ladder logic against baseline firmware and inspects Modbus traffic captures.",
                },
                {
                    "assignment_id": "ASG-104-RAO",
                    "user_id": rao["id"],
                    "case_role": "Evidence Custodian",
                    "reports_to": "ASG-104-SHARMA",
                    "desc": "Maintains chain of custody for emergency triage flash media and industrial serial tap recorders.",
                },
            ],
        },
        # CASE 5: CASE-2026-M101
        # Root: Vikram Mehta (Lead Investigator)
        #   -> Rahul Sharma (Senior Forensic Officer)
        #        -> Ananya Patel (Digital Forensics Analyst)
        #   -> Sunita Rao (Evidence Custodian)
        {
            "case_id": "CASE-2026-M101",
            "assignments": [
                {
                    "assignment_id": "ASG-M101-MEHTA",
                    "user_id": mehta["id"],
                    "case_role": "Lead Investigator",
                    "reports_to": None,
                    "desc": "Primary investigative commander responsible for court dossier compilation and procedural compliance.",
                },
                {
                    "assignment_id": "ASG-M101-SHARMA",
                    "user_id": sharma["id"],
                    "case_role": "Senior Forensic Officer",
                    "reports_to": "ASG-M101-MEHTA",
                    "desc": "Conducts technical verification of forensic disk images and issues cryptographically anchored certificates.",
                },
                {
                    "assignment_id": "ASG-M101-PATEL",
                    "user_id": patel["id"],
                    "case_role": "Digital Forensics Analyst",
                    "reports_to": "ASG-M101-SHARMA",
                    "desc": "Extracts filesystem timeline artifacts and indexes registry user activity logs.",
                },
                {
                    "assignment_id": "ASG-M101-RAO",
                    "user_id": rao["id"],
                    "case_role": "Evidence Custodian",
                    "reports_to": "ASG-M101-MEHTA",
                    "desc": "Administers long-term cold storage cryptographic seals and physical evidence registry ledgers.",
                },
            ],
        },
    ]

    total_added = 0
    for h in hierarchies:
        case_id = h["case_id"]
        for asg in h["assignments"]:
            cursor.execute(
                """
                INSERT OR REPLACE INTO case_assignments
                (assignment_id, case_id, user_id, case_role, reports_to_assignment_id, responsibility_description, assignment_status, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'Dr. Rajeshwar Sen (HOD-0001)', 'Dr. Rajeshwar Sen (HOD-0001)')
                """,
                (
                    asg["assignment_id"],
                    case_id,
                    asg["user_id"],
                    asg["case_role"],
                    asg["reports_to"],
                    asg["desc"],
                ),
            )
            total_added += 1

            # Also log to case_hierarchy_audit_log
            cursor.execute(
                """
                INSERT INTO case_hierarchy_audit_log
                (case_id, action, target_user_id, target_user_name, assignment_id, new_values, performed_by_id, performed_by_name, details)
                VALUES (?, 'ASSIGN_OFFICER', ?, ?, ?, ?, ?, 'Dr. Rajeshwar Sen', ?)
                """,
                (
                    case_id,
                    asg["user_id"],
                    users.get(
                        [k for k, v in users.items() if v["id"] == asg["user_id"]][0]
                    )["name"],
                    asg["assignment_id"],
                    f'{{"caseRole": "{asg["case_role"]}", "reportsTo": "{asg["reports_to"]}"}}',
                    sen["id"],
                    f"Initial case hierarchy assignment established by HOD under Department Authority.",
                ),
            )

    conn.commit()
    conn.close()
    print(f"[✓] Successfully seeded {total_added} case assignments across 5 cases into {db_path}")
    return True

if __name__ == "__main__":
    seed_case_hierarchies()
