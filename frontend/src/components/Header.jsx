// ============================================================
// EvidenceChain Top Navigation Header - Contextual Navigation & System Status
// Product-First Digital Evidence Management & Chain of Custody
// ============================================================

import { useState, useEffect } from "react";
import { getLiveISTClockString } from "../utils/dateUtils";

export function Header({
  activeView,
  backendConnected,
  blockchainConnected,
  onRefresh,
}) {
  // Live Clock in Asia/Kolkata (IST, UTC+05:30)
  const [istTime, setIstTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setIstTime(getLiveISTClockString(new Date()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const metadata = {
    dashboard: {
      section: "OPERATIONS",
      title: "Overview",
      subtitle: "Case activity, evidence integrity status, and recent investigation workflows",
    },
    evidence: {
      section: "OPERATIONS",
      title: "Evidence Repository",
      subtitle: "Central registry of digital evidence files, case dossiers, and custody records",
    },
    register: {
      section: "OPERATIONS",
      title: "Register Evidence",
      subtitle: "Securely intake digital evidence files and generate verification fingerprints",
    },
    verify: {
      section: "OPERATIONS",
      title: "Verify Integrity",
      subtitle: "Compare file fingerprints against registered custody records to verify authenticity",
    },
    department: {
      section: "AUTHORITY",
      title: "Department Authority",
      subtitle: "Case assignments, investigative oversight, and supervisory reporting relationships",
    },
    access: {
      section: "SECURITY",
      title: "Access Management",
      subtitle: "Role-based and examiner-specific View and Download permissions",
    },
    history: {
      section: "SECURITY",
      title: "Access History",
      subtitle: "Comprehensive audit records of evidence access, views, and exports",
    },
    status: {
      section: "SYSTEM",
      title: "System Health",
      subtitle: "Service status, database health, and storage availability",
    },
    profile: {
      section: "SYSTEM",
      title: "My Identity & Credentials",
      subtitle: "Examiner credentials, role authorizations, and active session details",
    },
    details: {
      section: "OPERATIONS",
      title: "Evidence Dossier",
      subtitle: "Detailed case information, file specifications, and verification history",
    },
  };

  const current = metadata[activeView] || metadata.dashboard;

  return (
    <header className="app-top-header" style={{ height: "var(--header-height)", borderBottom: "1px solid var(--border-color)", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--surface-primary)" }}>
      {/* Contextual Case & View Breadcrumbs */}
      <div className="header-left-col">
        <div className="header-docket-chain">
          <span>EVIDENCECHAIN</span>
          <span className="docket-divider">//</span>
          <span>{current.section}</span>
          <span className="docket-divider">//</span>
          <span className="docket-current">{current.title.toUpperCase()}</span>
        </div>
      </div>

      {/* Right Telemetry & Actions */}
      <div className="header-right-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Discreet Demo Environment Indicator */}
        <div
          className="demo-env-indicator"
          title="Demo Environment: Operating on an isolated local development blockchain (Anvil EVM Chain ID 31337) with synthetic forensic data."
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 8px",
            borderRadius: "4px",
            backgroundColor: "#F1F5F9",
            border: "1px solid #CBD5E1",
            fontSize: "11px",
            fontWeight: 600,
            color: "#475569",
            letterSpacing: "0.5px"
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3B82F6" }} />
          <span>DEMO ENVIRONMENT</span>
        </div>

        {/* Real-time Custody Clock (IST) */}
        <div className="custody-clock-pill" title="Live System Timestamp (Asia/Kolkata - IST, UTC+05:30)">
          <span style={{ fontSize: "10px", color: "var(--green-deep)" }}>⏱</span>
          <span>{istTime || "IST TIME SYNC"}</span>
        </div>

        {/* Product-First System Status Indicator */}
        <div
          className={`telemetry-consensus-pill ${
            backendConnected
              ? "consensus-online"
              : "sys-offline"
          }`}
          title={
            backendConnected && blockchainConnected
              ? "All core services operational • Database & verification engine connected"
              : backendConnected
              ? "Core application services operational • Database connected"
              : "Application service offline"
          }
        >
          <span
            className="officer-pulse-beacon"
            style={{
              width: "6px",
              height: "6px",
              margin: 0,
              backgroundColor:
                backendConnected
                  ? "var(--green-institutional)"
                  : "var(--red-restrained)",
            }}
          />
          <span>
            {backendConnected
              ? "SYSTEM OPERATIONAL"
              : "SYSTEM OFFLINE"}
          </span>
        </div>

        {/* Refresh Action */}
        <button
          type="button"
          className="btn-tactile-secondary"
          style={{ padding: "5px 10px", fontSize: "11px" }}
          onClick={onRefresh}
          title="Refresh evidence list and service status"
        >
          ↻ REFRESH
        </button>
      </div>
    </header>
  );
}
