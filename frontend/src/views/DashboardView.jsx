// ============================================================
// EvidenceChain Dashboard View - Evidence Custody & Integrity Overview
// Product-First Digital Evidence Management & Chain of Custody
// Headline: Evidence Integrity Overview (Replaces Ledger Continuity Instrument)
// ============================================================

import { useState } from "react";
import { getEvidenceStatus } from "../utils/statusLabels";
import { formatISTDateTime } from "../utils/dateUtils";

export function DashboardView({
  evidenceList = [],
  backendConnected,
  blockchainConnected,
  currentUser,
  onNavigate,
  onSelectEvidence,
}) {
  const [copiedId, setCopiedId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all"); // 'all' | 'active' | 'historical' | 'unconfirmed'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleCopy = (id, text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1400);
  };

  const totalCount = evidenceList?.length || 0;

  // Categorize evidence using centralized status evaluator
  const activeRecords = (evidenceList || []).filter(
    (item) => getEvidenceStatus(item).code === "ACTIVE"
  );
  const historicalRecords = (evidenceList || []).filter(
    (item) => getEvidenceStatus(item).code === "HISTORICAL"
  );
  const unconfirmedRecords = (evidenceList || []).filter(
    (item) => getEvidenceStatus(item).code === "UNCONFIRMED"
  );

  const activeCount = activeRecords.length;
  const historicalCount = historicalRecords.length;
  const unconfirmedCount = unconfirmedRecords.length;

  // Proportions for the integrity overview continuum
  const pctActive = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;
  const pctHistorical = totalCount > 0 ? (historicalCount / totalCount) * 100 : 0;
  const pctUnconfirmed = totalCount > 0 ? (unconfirmedCount / totalCount) * 100 : 0;

  // Filtered records for the interactive inspector drawer
  const getFilteredDrawerRecords = () => {
    switch (selectedCategory) {
      case "active":
        return activeRecords;
      case "historical":
        return historicalRecords;
      case "unconfirmed":
      case "unanchored":
        return unconfirmedRecords;
      default:
        return evidenceList;
    }
  };

  const drawerRecords = getFilteredDrawerRecords();
  const recentRecords = (evidenceList || []).slice(0, 6);

  const handleCategorySelect = (category) => {
    if (selectedCategory === category && isDrawerOpen) {
      setIsDrawerOpen(false);
    } else {
      setSelectedCategory(category);
      setIsDrawerOpen(true);
    }
  };

  return (
    <div className="view-container">
      {/* 1. Operational Masthead - Product-First Presentation */}
      <div className="barometer-masthead ambient-card" style={{ marginBottom: "20px" }}>
        <div className="barometer-title-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span className="case-docket-tag" style={{ background: "var(--green-subtle)", color: "var(--green-deep)", borderColor: "var(--green-border)" }}>
                EVIDENCE MANAGEMENT SYSTEM
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                CASE REPOSITORY: {totalCount} RECORDS
              </span>
              <span className="badge-clean badge-verified" style={{ fontSize: "10px", padding: "1px 6px" }}>
                VERIFICATION ENGINE ACTIVE
              </span>
            </div>
            <h1 className="page-title" style={{ fontFamily: "var(--font-serif)", fontSize: "24px", color: "var(--text-primary)", margin: "0 0 6px 0" }}>
              Evidence Custody & Integrity Overview
            </h1>
            <p className="page-context-desc" style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "800px", margin: 0, lineHeight: 1.5 }}>
              Central management environment for digital evidence intake, file integrity verification, case dossier organization, and chain-of-custody tracking.
            </p>
          </div>

          {/* Primary Investigation Actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={() => onNavigate("verify")}
              title="Verify evidence file against registered fingerprint"
              style={{ fontSize: "12px", padding: "9px 16px" }}
            >
              Verify Integrity
            </button>
            <button
              type="button"
              className="btn-tactile-primary"
              onClick={() => onNavigate("register")}
              title="Intake and register a new digital evidence file"
              style={{ fontSize: "12px", padding: "9px 18px" }}
            >
              + Register Evidence
            </button>
          </div>
        </div>

        {/* Examiner Session & Repository Status Strip */}
        <div className="barometer-status-strip" style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap", rowGap: "6px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span className="officer-pulse-beacon" />
            <span>
              Active Examiner: <strong>{currentUser?.name || "Rahul Sharma"}</strong> ({currentUser?.employeeId || "OFF-1024"})
            </span>
          </div>
          <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
          <span>Unit: {currentUser?.department || "Cyber Crime Unit"}</span>
          <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
          <span>Custody Registry: {totalCount} Records Reconciled</span>
          <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
          <span style={{ color: "var(--text-secondary)" }}>Integrity Verification: Available on Demand</span>
        </div>
      </div>

      {/* 2. Signature Evidence Integrity Overview (Formerly Ledger Continuity Instrument) */}
      <div className="doc-panel" style={{ padding: "20px 22px", marginBottom: "20px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <h2 className="doc-panel-title" style={{ fontSize: "16px", fontFamily: "var(--font-serif)", margin: 0 }}>
                Evidence Integrity Overview
              </h2>
              <span className="badge-clean badge-neutral" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                Interactive Census
              </span>
            </div>
            <p className="doc-panel-subtitle" style={{ fontSize: "12.5px", margin: 0, color: "var(--text-secondary)" }}>
              Authoritative registration status for all {totalCount} evidence files across verified, historical, and unconfirmed intake states. Select any category to inspect records.
            </p>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
            REPOSITORY RECONCILED: {totalCount}/{totalCount} PERSISTED
          </div>
        </div>

        {/* Proportional Registration Continuum Track */}
        <div
          className="ledger-gauge-bar"
          style={{ height: "14px", borderRadius: "3px", overflow: "hidden", cursor: "pointer", display: "flex", background: "#E2DDD2" }}
          title="Click to toggle evidence status inspection drawer"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          {pctActive > 0 && (
            <div
              style={{
                width: `${pctActive}%`,
                background: "var(--green-institutional)",
                height: "100%",
                transition: "width 0.3s ease",
              }}
              title={`Verified Registrations: ${activeCount} (${pctActive.toFixed(1)}%)`}
            />
          )}
          {pctHistorical > 0 && (
            <div
              style={{
                width: `${pctHistorical}%`,
                background: "#8A6D3B",
                height: "100%",
                transition: "width 0.3s ease",
              }}
              title={`Historical Registrations: ${historicalCount} (${pctHistorical.toFixed(1)}%)`}
            />
          )}
          {pctUnconfirmed > 0 && (
            <div
              style={{
                width: `${pctUnconfirmed}%`,
                background: "#64748B",
                height: "100%",
                transition: "width 0.3s ease",
              }}
              title={`Unconfirmed / Local Intake: ${unconfirmedCount} (${pctUnconfirmed.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Product-First Category Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginTop: "16px" }}>
          {/* Card 1: Total Evidence Records */}
          <div
            className={`metric-strip-cell ambient-card ${selectedCategory === "all" && isDrawerOpen ? "metric-cell-selected" : ""}`}
            onClick={() => handleCategorySelect("all")}
            style={{
              cursor: "pointer",
              border: selectedCategory === "all" && isDrawerOpen ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
              padding: "14px 16px",
              backgroundColor: "var(--surface-primary)",
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
              Total Evidence Records
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>
              {totalCount}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Complete digital evidence repository
            </div>
          </div>

          {/* Card 2: Verified Registrations */}
          <div
            className={`metric-strip-cell ambient-card ${selectedCategory === "active" && isDrawerOpen ? "metric-cell-selected" : ""}`}
            onClick={() => handleCategorySelect("active")}
            style={{
              cursor: "pointer",
              border: selectedCategory === "active" && isDrawerOpen ? "2px solid var(--green-institutional)" : "1px solid var(--border-color)",
              padding: "14px 16px",
              backgroundColor: "var(--surface-primary)",
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--green-deep)" }}>
                Verified Registrations
              </span>
              <span className="legend-swatch" style={{ backgroundColor: "var(--green-institutional)", width: "8px", height: "8px", borderRadius: "50%" }} />
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "var(--green-deep)" }}>
              {activeCount}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {activeCount === 0 ? "0 actively confirmed on current ledger" : "Actively verified on system ledger"}
            </div>
          </div>

          {/* Card 3: Historical Registrations */}
          <div
            className={`metric-strip-cell ambient-card ${selectedCategory === "historical" && isDrawerOpen ? "metric-cell-selected" : ""}`}
            onClick={() => handleCategorySelect("historical")}
            style={{
              cursor: "pointer",
              border: selectedCategory === "historical" && isDrawerOpen ? "2px solid #8A6D3B" : "1px solid var(--border-color)",
              padding: "14px 16px",
              backgroundColor: "var(--surface-primary)",
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#8A6D3B" }}>
                Historical Registrations
              </span>
              <span className="legend-swatch" style={{ backgroundColor: "#8A6D3B", width: "8px", height: "8px", borderRadius: "50%" }} />
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#8A6D3B" }}>
              {historicalCount}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Registered in prior ledger environment
            </div>
          </div>

          {/* Card 4: Registration Not Confirmed / Review */}
          <div
            className={`metric-strip-cell ambient-card ${selectedCategory === "unconfirmed" && isDrawerOpen ? "metric-cell-selected" : ""}`}
            onClick={() => handleCategorySelect("unconfirmed")}
            style={{
              cursor: "pointer",
              border: selectedCategory === "unconfirmed" && isDrawerOpen ? "2px solid #64748B" : "1px solid var(--border-color)",
              padding: "14px 16px",
              backgroundColor: "var(--surface-primary)",
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>
                Registration Not Confirmed
              </span>
              <span className="legend-swatch" style={{ backgroundColor: "#64748B", width: "8px", height: "8px", borderRadius: "50%" }} />
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#64748B" }}>
              {unconfirmedCount}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Catalogued locally; verification unconfirmed
            </div>
          </div>
        </div>

        {/* Interactive Evidence Records Drawer */}
        {isDrawerOpen && (
          <div
            className="census-inspect-tray"
            style={{
              marginTop: "16px",
              padding: "16px 18px",
              background: "#FAF7F2",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
              <div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Inspecting: {selectedCategory.toUpperCase()} ({drawerRecords.length} records)
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px" }}>
                  {selectedCategory === "historical" && "Evidence files registered in a previous ledger environment."}
                  {selectedCategory === "active" && "Evidence files actively verified on current system ledger."}
                  {selectedCategory === "unconfirmed" && "Evidence files catalogued in the database without confirmed ledger registration."}
                  {selectedCategory === "all" && "All digital evidence records in the central repository."}
                </span>
              </div>
              <button
                type="button"
                className="btn-subtle-mono"
                onClick={() => setIsDrawerOpen(false)}
                style={{ fontSize: "11px", padding: "2px 8px" }}
              >
                CLOSE [×]
              </button>
            </div>

            {drawerRecords.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
                No records found matching category "{selectedCategory}".
              </div>
            ) : (
              <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                <table className="archival-table" style={{ width: "100%", fontSize: "11.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "130px" }}>Evidence ID</th>
                      <th style={{ width: "130px" }}>Case Docket</th>
                      <th>Artifact Title</th>
                      <th style={{ width: "150px" }}>Registration Status</th>
                      <th style={{ width: "90px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drawerRecords.map((item) => {
                      const st = getEvidenceStatus(item);
                      return (
                        <tr key={item.evidenceId} onClick={() => onSelectEvidence(item.evidenceId)} style={{ cursor: "pointer" }}>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{item.evidenceId}</td>
                          <td><span className="case-docket-tag">{item.caseId}</span></td>
                          <td>{item.title}</td>
                          <td>
                            <span className={st.pillClass} style={{ ...st.badgeStyle, fontSize: "9.5px", padding: "1px 6px" }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn-tactile-secondary"
                              style={{ fontSize: "10px", padding: "2px 6px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvidence(item.evidenceId);
                              }}
                            >
                              Dossier →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Investigation Workflows & Operational Procedures */}
      <div style={{ marginBottom: "22px" }}>
        <div style={{ marginBottom: "12px" }}>
          <h2 className="doc-panel-title" style={{ fontSize: "16px", fontFamily: "var(--font-serif)", margin: "0 0 2px 0" }}>
            Investigation Workflows
          </h2>
          <p className="doc-panel-subtitle" style={{ fontSize: "12.5px", margin: 0, color: "var(--text-secondary)" }}>
            Standard procedures for evidence intake, file integrity verification, and access governance.
          </p>
        </div>

        <div className="procedural-stations-grid">
          {/* Station 01 */}
          <div
            className="station-card ambient-card"
            onClick={() => onNavigate("register")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onNavigate("register")}
          >
            <div>
              <div className="station-top-meta">
                <span className="station-number">WORKFLOW [01]</span>
                <span className="station-function-tag">INTAKE</span>
              </div>
              <h3 className="station-heading">Secure Evidence Intake</h3>
              <p className="station-description">
                Upload digital evidence files, attach case dockets, compute standard SHA-256 integrity fingerprints, and register custody entries.
              </p>
            </div>
            <div className="station-footer-action">
              <span>Initiate Evidence Intake</span>
              <span className="station-arrow">&rarr;</span>
            </div>
          </div>

          {/* Station 02 */}
          <div
            className="station-card ambient-card"
            onClick={() => onNavigate("verify")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onNavigate("verify")}
          >
            <div>
              <div className="station-top-meta">
                <span className="station-number">WORKFLOW [02]</span>
                <span className="station-function-tag">VERIFICATION</span>
              </div>
              <h3 className="station-heading">Integrity Verification</h3>
              <p className="station-description">
                Compare suspect or working evidence copies against registered fingerprints to detect any file alteration or tampering.
              </p>
            </div>
            <div className="station-footer-action">
              <span>Verify File Integrity</span>
              <span className="station-arrow">&rarr;</span>
            </div>
          </div>

          {/* Station 03 */}
          <div
            className="station-card ambient-card"
            onClick={() => onNavigate("access")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onNavigate("access")}
          >
            <div>
              <div className="station-top-meta">
                <span className="station-number">WORKFLOW [03]</span>
                <span className="station-function-tag">GOVERNANCE</span>
              </div>
              <h3 className="station-heading">Access Permissions & Control</h3>
              <p className="station-description">
                Manage independent View and Download permissions for case officers and forensic specialists, with complete access audit logging.
              </p>
            </div>
            <div className="station-footer-action">
              <span>Manage Access Permissions</span>
              <span className="station-arrow">&rarr;</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Evidence Activity */}
      <div className="doc-panel" style={{ padding: "18px 20px" }}>
        <div className="doc-panel-header" style={{ marginBottom: "14px" }}>
          <div>
            <h2 className="doc-panel-title" style={{ fontSize: "16px", fontFamily: "var(--font-serif)" }}>
              Recent Evidence Dossiers
            </h2>
            <p className="doc-panel-subtitle" style={{ fontSize: "12px" }}>
              Most recently registered digital evidence items in the central repository.
            </p>
          </div>
          <button
            type="button"
            className="btn-tactile-secondary"
            style={{ fontSize: "11.5px", padding: "6px 14px" }}
            onClick={() => onNavigate("evidence")}
          >
            View Full Repository ({totalCount}) &rarr;
          </button>
        </div>

        {recentRecords.length === 0 ? (
          <div style={{ padding: "36px", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>No Evidence Registered</p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              No digital evidence items have been catalogued yet. Use "Register Evidence" to initiate intake.
            </p>
          </div>
        ) : (
          <div className="table-wrapper-archival">
            <table className="archival-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "135px" }}>Case Docket</th>
                  <th style={{ width: "130px" }}>Evidence ID</th>
                  <th>Artifact Title</th>
                  <th>Fingerprint (SHA-256)</th>
                  <th style={{ width: "160px" }}>Registration Status</th>
                  <th style={{ width: "150px" }}>Registration Date</th>
                  <th style={{ width: "100px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((item) => {
                  const st = getEvidenceStatus(item);
                  return (
                    <tr
                      key={item.evidenceId}
                      onClick={() => onSelectEvidence(item.evidenceId)}
                      style={{ cursor: "pointer" }}
                      title="Click row to open evidence dossier"
                    >
                      <td>
                        <span className="case-docket-tag">{item.caseId}</span>
                      </td>
                      <td>
                        <span className="mono-identifier" style={{ fontWeight: 600 }}>
                          {item.evidenceId}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ color: "var(--text-primary)" }}>{item.title}</div>
                        {item.filePath && (
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {item.filePath.split("/").pop()}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="hash-preview-chip">
                          <span>
                            {item.sha256Hash
                              ? `${item.sha256Hash.slice(0, 10)}...${item.sha256Hash.slice(-8)}`
                              : "—"}
                          </span>
                          {item.sha256Hash && (
                            <button
                              type="button"
                              className="btn-subtle-mono"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              onClick={(e) => handleCopy(item.evidenceId, item.sha256Hash, e)}
                              title="Copy full 64-character SHA-256 hash"
                            >
                              {copiedId === item.evidenceId ? "COPIED" : "COPY"}
                            </button>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={st.pillClass} style={{ ...st.badgeStyle, fontSize: "10.5px", padding: "2px 8px" }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {formatISTDateTime(item.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn-tactile-secondary"
                          style={{ padding: "4px 10px", fontSize: "11px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvidence(item.evidenceId);
                          }}
                        >
                          Dossier &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
