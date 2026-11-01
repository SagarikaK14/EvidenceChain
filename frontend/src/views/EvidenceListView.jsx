// ============================================================
// EvidenceChain Evidence Repository View - Master Digital Evidence Index
// Product-First Digital Evidence Management & Chain of Custody
// Focus on finding, inspecting, and managing evidence files & case dossiers
// ============================================================

import { useState } from "react";
import { CryptographicFingerprint } from "../components/CryptographicFingerprint";
import { getEvidenceStatus } from "../utils/statusLabels";
import { formatISTDateTime } from "../utils/dateUtils";

export function EvidenceListView({
  evidenceList = [],
  currentUser,
  onSelectEvidence,
  onVerifyEvidence,
  onManageAccess,
  onNavigate,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | HISTORICAL | ACTIVE | UNCONFIRMED | MY_INTAKE
  const [copiedId, setCopiedId] = useState("");
  const [inspectItem, setInspectItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10 | 25 | "ALL"

  const handleCopy = (id, text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1400);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Filter evidence based on search query and category
  const filteredList = (evidenceList || []).filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchId = item.evidenceId?.toLowerCase().includes(q);
      const matchCase = item.caseId?.toLowerCase().includes(q);
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchHash = item.sha256Hash?.toLowerCase().includes(q);
      const matchFile = item.filePath?.toLowerCase().includes(q);
      const matchCust = item.custodian?.toLowerCase().includes(q) || item.registeredBy?.toLowerCase().includes(q);
      if (!matchId && !matchCase && !matchTitle && !matchDesc && !matchHash && !matchFile && !matchCust) {
        return false;
      }
    }

    const st = getEvidenceStatus(item);

    if (activeFilter === "ALL") return true;
    if (activeFilter === "MY_INTAKE") {
      return (
        item.registeredBy?.toLowerCase() === currentUser?.walletAddress?.toLowerCase()
      );
    }
    if (activeFilter === "ACTIVE") {
      return st.code === "ACTIVE";
    }
    if (activeFilter === "HISTORICAL") {
      return st.code === "HISTORICAL";
    }
    if (activeFilter === "UNCONFIRMED") {
      return st.code === "UNCONFIRMED";
    }

    return true;
  });

  const totalCount = evidenceList?.length || 0;
  const activeCount = (evidenceList || []).filter((i) => getEvidenceStatus(i).code === "ACTIVE").length;
  const historicalCount = (evidenceList || []).filter((i) => getEvidenceStatus(i).code === "HISTORICAL").length;
  const unconfirmedCount = (evidenceList || []).filter((i) => getEvidenceStatus(i).code === "UNCONFIRMED").length;
  const myIntakeCount = (evidenceList || []).filter(
    (i) => i.registeredBy?.toLowerCase() === currentUser?.walletAddress?.toLowerCase()
  ).length;

  const quickTags = [
    { label: "Case 2024-001", query: "CASE-2024-001" },
    { label: "Case 2024-002", query: "CASE-2024-002" },
    { label: "PDF Documents", query: ".pdf" },
    { label: "Disk Images", query: ".raw" },
  ];

  // Pagination Calculations
  const totalFiltered = filteredList.length;
  const isAll = pageSize === "ALL";
  const effectivePageSize = isAll ? Math.max(1, totalFiltered) : Number(pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalFiltered / effectivePageSize));
  const safePage = isAll ? 1 : Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = isAll ? 0 : (safePage - 1) * effectivePageSize;
  const endIndex = isAll ? totalFiltered : Math.min(startIndex + effectivePageSize, totalFiltered);
  const paginatedList = isAll ? filteredList : filteredList.slice(startIndex, endIndex);

  return (
    <div className="view-container">
      {/* 1. Page Header Block */}
      <div className="page-header-block" style={{ marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="case-docket-tag" style={{ background: "var(--surface-primary)" }}>
              CENTRAL EVIDENCE VAULT
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {totalCount} Total Catalogued Dossiers
            </span>
          </div>
          <h1 className="page-title" style={{ fontFamily: "var(--font-serif)", fontSize: "24px", margin: "4px 0" }}>
            Evidence Repository & Archival Register
          </h1>
          <p className="page-context-desc" style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Master inventory of {totalCount} registered digital evidence files, case dossiers, cryptographic fingerprints, and custody records.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-tactile-primary"
            onClick={() => onNavigate("register")}
            style={{ fontSize: "12px", padding: "8px 16px" }}
          >
            + Register New Artifact
          </button>
        </div>
      </div>

      {/* 2. Filter Tabs Strip */}
      <div className="folder-tabs-strip">
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "ALL" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("ALL")}
        >
          All Dossiers ({totalCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "HISTORICAL" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("HISTORICAL")}
        >
          Historical Registrations ({historicalCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "ACTIVE" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("ACTIVE")}
        >
          Verified Registrations ({activeCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "UNCONFIRMED" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("UNCONFIRMED")}
        >
          Registration Not Confirmed ({unconfirmedCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "MY_INTAKE" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("MY_INTAKE")}
        >
          My Intakes ({myIntakeCount})
        </button>
      </div>

      {/* 3. Search and Quick Tags Bar */}
      <div className="doc-panel" style={{ padding: "14px 18px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
            <input
              type="text"
              className="search-input-tactile"
              placeholder="Search by Evidence ID, Case Docket, Filename, Custodian, or SHA-256..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", fontSize: "12.5px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Clear [×]
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Quick Filters:</span>
            {quickTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                className="chip-tag"
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  backgroundColor: searchQuery === tag.query ? "var(--green-institutional)" : "var(--surface-primary)",
                  color: searchQuery === tag.query ? "#FAF7F2" : "var(--text-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                onClick={() => handleSearchChange(searchQuery === tag.query ? "" : tag.query)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Desktop Master Archival Table */}
      <div className="desktop-table-container archival-table-desktop">
        {filteredList.length === 0 ? (
          <div className="doc-panel" style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>No Evidence Matches Filter</p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              No dossiers match query "{searchQuery}" under the selected tab.
            </p>
            <button
              type="button"
              className="btn-tactile-secondary"
              style={{ marginTop: "12px", fontSize: "11.5px" }}
              onClick={() => {
                handleSearchChange("");
                handleFilterChange("ALL");
              }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="table-wrapper-archival doc-panel" style={{ padding: 0 }}>
            <table className="archival-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "135px" }}>Case Docket</th>
                  <th style={{ width: "130px" }}>Evidence ID</th>
                  <th>File Name & Title</th>
                  <th style={{ width: "180px" }}>Fingerprint (SHA-256)</th>
                  <th style={{ width: "165px" }}>Registration Status</th>
                  <th style={{ width: "150px" }}>Intake Timestamp</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((item) => {
                  const st = getEvidenceStatus(item);
                  return (
                    <tr
                      key={item.evidenceId}
                      onClick={() => setInspectItem(item)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: inspectItem?.evidenceId === item.evidenceId ? "rgba(40, 122, 88, 0.05)" : "transparent",
                      }}
                      title="Click row to open quick-inspect drawer"
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
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn-tactile-secondary"
                            style={{ padding: "4px 8px", fontSize: "10.5px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectItem(item);
                            }}
                            title="Quick inspect in slide-over drawer"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            className="btn-tactile-primary"
                            style={{ padding: "4px 8px", fontSize: "10.5px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvidence(item.evidenceId);
                            }}
                            title="Open full evidentiary dossier"
                          >
                            Dossier →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Mobile Responsive Dossier Cards (Visible <= 768px) */}
      <div className="mobile-cards-container archival-cards-mobile">
        {paginatedList.map((item) => {
          const st = getEvidenceStatus(item);
          return (
            <div key={item.evidenceId} className="mobile-dossier-card ambient-card" style={{ marginBottom: "10px", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                <div>
                  <span className="case-docket-tag">{item.caseId}</span>
                  <span className="mono-identifier" style={{ marginLeft: "6px", fontWeight: 600 }}>
                    {item.evidenceId}
                  </span>
                </div>
                <span className={st.pillClass} style={{ ...st.badgeStyle, fontSize: "9.5px", padding: "2px 6px" }}>
                  {st.shortLabel}
                </span>
              </div>

              <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text-primary)", marginBottom: "4px" }}>
                {item.title}
              </div>

              {item.description && (
                <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", margin: "0 0 6px 0", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {item.description}
                </p>
              )}

              <div style={{ padding: "6px 8px", background: "var(--surface-primary)", border: "1px solid var(--border-subtle)", borderRadius: "3px", marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                  <span style={{ fontSize: "9.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>SHA-256 FINGERPRINT</span>
                  {item.sha256Hash && (
                    <button
                      type="button"
                      className="btn-subtle-mono"
                      style={{ fontSize: "9.5px", padding: "1px 5px" }}
                      onClick={(e) => handleCopy(item.evidenceId, item.sha256Hash, e)}
                    >
                      {copiedId === item.evidenceId ? "COPIED" : "COPY"}
                    </button>
                  )}
                </div>
                <code style={{ fontSize: "10px", wordBreak: "break-all", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                  {item.sha256Hash ? `${item.sha256Hash.slice(0, 16)}...${item.sha256Hash.slice(-12)}` : "—"}
                </code>
              </div>

              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn-tactile-secondary"
                  style={{ fontSize: "11px", padding: "5px 10px", minHeight: "32px" }}
                  onClick={() => onVerifyEvidence(item.evidenceId)}
                >
                  Verify
                </button>
                <button
                  type="button"
                  className="btn-tactile-secondary"
                  style={{ fontSize: "11px", padding: "5px 10px", minHeight: "32px" }}
                  onClick={() => onManageAccess(item.evidenceId)}
                >
                  Access
                </button>
                <button
                  type="button"
                  className="btn-tactile-primary"
                  style={{ fontSize: "11px", padding: "5px 12px", minHeight: "32px" }}
                  onClick={() => onSelectEvidence(item.evidenceId)}
                >
                  Dossier →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Institutional Repository Pagination */}
      {filteredList.length > 0 && (
        <div className="pagination-bar-archival" data-testid="repository-pagination-bar">
          <div className="pagination-meta-info">
            Showing <strong className="font-mono">{totalFiltered === 0 ? 0 : startIndex + 1}</strong> –{" "}
            <strong className="font-mono">{endIndex}</strong> of{" "}
            <strong className="font-mono">{totalFiltered}</strong> catalogued dossiers
            {totalFiltered < totalCount && (
              <span className="pagination-filtered-note"> (filtered from {totalCount} total)</span>
            )}
          </div>

          <div className="pagination-controls-group">
            <button
              type="button"
              className="btn-pagination-nav"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              data-testid="btn-pagination-prev"
            >
              ← Prev
            </button>

            <div className="pagination-page-chips">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  className={`pagination-page-chip ${safePage === pNum ? "active-page" : ""}`}
                  onClick={() => setCurrentPage(pNum)}
                  data-testid={`btn-page-${pNum}`}
                >
                  {pNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-pagination-nav"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              data-testid="btn-pagination-next"
            >
              Next →
            </button>
          </div>

          <div className="pagination-density-picker">
            <span className="density-label">Per page:</span>
            {[10, 25, "ALL"].map((size) => (
              <button
                key={size}
                type="button"
                className={`density-pill ${pageSize === size ? "active-density" : ""}`}
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                data-testid={`btn-density-${size}`}
              >
                {size === "ALL" ? "All" : size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. Contextual Quick-Inspect Slide-Over Drawer */}
      {inspectItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "420px",
            maxWidth: "90vw",
            backgroundColor: "#FAF7F2",
            borderLeft: "2px solid var(--green-institutional)",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.15)",
            zIndex: 1000,
            padding: "24px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            animation: "slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--green-deep)", textTransform: "uppercase" }}>
                Contextual Dossier Inspector
              </span>
              <button
                type="button"
                className="btn-subtle-mono"
                onClick={() => setInspectItem(null)}
                style={{ fontSize: "12px", padding: "2px 8px" }}
              >
                CLOSE [×]
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span className="case-docket-tag">{inspectItem.caseId}</span>
                <span className="mono-identifier" style={{ fontWeight: 600 }}>{inspectItem.evidenceId}</span>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: "4px 0", color: "var(--text-primary)" }}>
                {inspectItem.title}
              </h2>
              {inspectItem.description && (
                <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                  {inspectItem.description}
                </p>
              )}
            </div>

            {/* Visual Fingerprint Preview */}
            <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
              <CryptographicFingerprint
                hash={inspectItem.sha256Hash}
                size={140}
                label="Cryptographic Seal"
                showMeta={false}
              />
            </div>

            {/* Quick Metadata Grid */}
            {(() => {
              const st = getEvidenceStatus(inspectItem);
              const fileName = inspectItem.filePath ? inspectItem.filePath.split("/").pop() : "evidence_payload.bin";
              return (
                <div style={{ display: "grid", gap: "8px", fontSize: "11.5px", marginBottom: "16px" }}>
                  <div style={{ padding: "8px 10px", background: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "3px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Registration Status</div>
                    <div style={{ fontWeight: 600, marginTop: "2px", color: st.dotColor }}>
                      {st.label}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {st.summary}
                    </div>
                  </div>

                  <div style={{ padding: "8px 10px", background: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "3px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Storage Reference</div>
                    <code style={{ fontSize: "10.5px", wordBreak: "break-all", color: "var(--text-primary)", display: "block", marginTop: "2px" }}>
                      vault://evidence/{inspectItem.evidenceId}/{fileName}
                    </code>
                  </div>

                  <div style={{ padding: "8px 10px", background: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "3px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>SHA-256 Fingerprint</div>
                    <code style={{ fontSize: "10px", wordBreak: "break-all", color: "var(--text-primary)", display: "block", marginTop: "2px" }}>
                      {inspectItem.sha256Hash}
                    </code>
                  </div>

                  <div style={{ padding: "8px 10px", background: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "3px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Custodian Examiner</div>
                    <div style={{ fontWeight: 500, marginTop: "2px", color: "var(--text-primary)" }}>
                      {inspectItem.custodian || "Forensic Officer Rahul Sharma (OFF-1024)"}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ display: "flex", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
            <button
              type="button"
              className="btn-tactile-secondary"
              style={{ flex: 1, fontSize: "11.5px", padding: "8px" }}
              onClick={() => {
                onVerifyEvidence(inspectItem.evidenceId);
                setInspectItem(null);
              }}
            >
              Verify File
            </button>
            <button
              type="button"
              className="btn-tactile-primary"
              style={{ flex: 1.5, fontSize: "11.5px", padding: "8px" }}
              onClick={() => {
                onSelectEvidence(inspectItem.evidenceId);
                setInspectItem(null);
              }}
            >
              Open Full Evidentiary Dossier →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
