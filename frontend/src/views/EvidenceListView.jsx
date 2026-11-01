// ============================================================
// EvidenceChain Evidence Repository View - Master Digital Evidence Index
// Product-First Digital Evidence Management & Chain of Custody
// Focus on finding, inspecting, and managing evidence files & case dossiers
// ============================================================

import { useState, useMemo } from "react";
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
  loading = false,
  error = null,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | HISTORICAL | ACTIVE | UNCONFIRMED | MY_INTAKE
  const [selectedCase, setSelectedCase] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedCustodian, setSelectedCustodian] = useState("ALL");
  const [copiedId, setCopiedId] = useState("");
  const [inspectItem, setInspectItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10 | 25 | "ALL"

  const handleCopy = (id, text, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(String(text || ""));
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1400);
    }
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setActiveFilter("ALL");
    setSelectedCase("ALL");
    setSelectedType("ALL");
    setSelectedCustodian("ALL");
    setCurrentPage(1);
  };

  // Safe helper to inspect file extension / format
  const getFileCategory = (item) => {
    if (!item) return "OTHER";
    const path = String(item.filePath || item.title || "").toLowerCase();
    if (path.endsWith(".pdf")) return "PDF";
    if (path.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return "IMAGE";
    if (path.match(/\.(csv|json|txt|log|xml)$/)) return "DATA_TEXT";
    if (path.match(/\.(bin|raw|dd|pcap|hex|dat)$/)) return "BINARY_DUMP";
    return "OTHER";
  };

  // Extract unique filter choices from current evidence items
  const { availableCases, availableCustodians } = useMemo(() => {
    const casesSet = new Set();
    const custodiansSet = new Set();

    (evidenceList || []).forEach((item) => {
      if (item?.caseId) casesSet.add(String(item.caseId).trim());
      if (item?.custodian) {
        custodiansSet.add(String(item.custodian).trim());
      } else if (item?.registeredBy) {
        custodiansSet.add(String(item.registeredBy).trim());
      }
    });

    return {
      availableCases: Array.from(casesSet).sort(),
      availableCustodians: Array.from(custodiansSet).sort(),
    };
  }, [evidenceList]);

  // Robust, fail-safe filtering across all dimensions
  const filteredList = useMemo(() => {
    return (evidenceList || []).filter((item) => {
      if (!item) return false;

      const q = String(searchQuery || "").toLowerCase().trim();
      if (q) {
        const idMatch = String(item.evidenceId || "").toLowerCase().includes(q);
        const caseMatch = String(item.caseId || "").toLowerCase().includes(q);
        const titleMatch = String(item.title || "").toLowerCase().includes(q);
        const descMatch = String(item.description || "").toLowerCase().includes(q);
        const hashMatch = String(item.sha256Hash || "").toLowerCase().includes(q);
        const fileMatch = String(item.filePath || "").toLowerCase().includes(q);
        const custMatch =
          String(item.custodian || "").toLowerCase().includes(q) ||
          String(item.registeredBy || "").toLowerCase().includes(q);

        if (!idMatch && !caseMatch && !titleMatch && !descMatch && !hashMatch && !fileMatch && !custMatch) {
          return false;
        }
      }

      // Case Docket filter
      if (selectedCase !== "ALL" && String(item.caseId || "") !== selectedCase) {
        return false;
      }

      // File Format / Type filter
      if (selectedType !== "ALL") {
        const cat = getFileCategory(item);
        if (selectedType === "PDF" && cat !== "PDF") return false;
        if (selectedType === "IMAGE" && cat !== "IMAGE") return false;
        if (selectedType === "DATA_TEXT" && cat !== "DATA_TEXT") return false;
        if (selectedType === "BINARY_DUMP" && cat !== "BINARY_DUMP") return false;
      }

      // Custodian filter
      if (selectedCustodian !== "ALL") {
        const itemCust = String(item.custodian || item.registeredBy || "").trim();
        if (itemCust !== selectedCustodian) return false;
      }

      // Status Tabs filter
      const st = getEvidenceStatus(item);
      if (activeFilter === "ALL") return true;
      if (activeFilter === "MY_INTAKE") {
        const regBy = String(item.registeredBy || "").toLowerCase();
        const userWallet = String(currentUser?.walletAddress || "").toLowerCase();
        const userEmail = String(currentUser?.email || "").toLowerCase();
        const userEmpId = String(currentUser?.employeeId || "").toLowerCase();
        return (
          (userWallet && regBy.includes(userWallet)) ||
          (userEmail && regBy.includes(userEmail)) ||
          (userEmpId && regBy.includes(userEmpId))
        );
      }
      if (activeFilter === "ACTIVE") {
        return st?.code === "ACTIVE";
      }
      if (activeFilter === "HISTORICAL") {
        return st?.code === "HISTORICAL";
      }
      if (activeFilter === "UNCONFIRMED") {
        return st?.code === "UNCONFIRMED";
      }

      return true;
    });
  }, [evidenceList, searchQuery, activeFilter, selectedCase, selectedType, selectedCustodian, currentUser]);

  const totalCount = evidenceList?.length || 0;
  const activeCount = useMemo(
    () => (evidenceList || []).filter((i) => getEvidenceStatus(i)?.code === "ACTIVE").length,
    [evidenceList]
  );
  const historicalCount = useMemo(
    () => (evidenceList || []).filter((i) => getEvidenceStatus(i)?.code === "HISTORICAL").length,
    [evidenceList]
  );
  const unconfirmedCount = useMemo(
    () => (evidenceList || []).filter((i) => getEvidenceStatus(i)?.code === "UNCONFIRMED").length,
    [evidenceList]
  );
  const myIntakeCount = useMemo(() => {
    const userWallet = String(currentUser?.walletAddress || "").toLowerCase();
    const userEmail = String(currentUser?.email || "").toLowerCase();
    return (evidenceList || []).filter((i) => {
      const regBy = String(i?.registeredBy || "").toLowerCase();
      return (userWallet && regBy.includes(userWallet)) || (userEmail && regBy.includes(userEmail));
    }).length;
  }, [evidenceList, currentUser]);

  const quickTags = [
    { label: "Operation Nightfall", query: "CASE-2026-METRO-101" },
    { label: "Payment Terminals", query: "CASE-2026-METRO-102" },
    { label: "PDF Documents", query: ".pdf" },
    { label: "Scene Images", query: ".png" },
    { label: "Data Timelines", query: ".csv" },
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
    <div className="view-container" data-testid="evidence-repository-container">
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
            onClick={() => onNavigate && onNavigate("register")}
            style={{ fontSize: "12px", padding: "8px 16px" }}
            id="btn-register-new-artifact"
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
          id="tab-filter-all"
        >
          All Dossiers ({totalCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "ACTIVE" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("ACTIVE")}
          id="tab-filter-active"
        >
          Verified Registrations ({activeCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "HISTORICAL" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("HISTORICAL")}
          id="tab-filter-historical"
        >
          Historical Registrations ({historicalCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "UNCONFIRMED" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("UNCONFIRMED")}
          id="tab-filter-unconfirmed"
        >
          Registration Not Confirmed ({unconfirmedCount})
        </button>
        <button
          type="button"
          className={`folder-tab-btn ${activeFilter === "MY_INTAKE" ? "tab-active" : ""}`}
          onClick={() => handleFilterChange("MY_INTAKE")}
          id="tab-filter-my-intake"
        >
          My Intakes ({myIntakeCount})
        </button>
      </div>

      {/* 3. Search and Multi-Dimensional Filter Bar */}
      <div className="doc-panel" style={{ padding: "14px 18px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1.5, minWidth: "260px", position: "relative" }}>
            <input
              type="text"
              className="search-input-tactile"
              placeholder="Search by Evidence ID, Case Docket, Filename, Custodian, or SHA-256..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", fontSize: "12.5px" }}
              id="input-evidence-search"
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
                aria-label="Clear search input"
              >
                Clear [×]
              </button>
            )}
          </div>

          {/* Filter: Case Docket */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="select-filter-case" style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
              Case:
            </label>
            <select
              id="select-filter-case"
              value={selectedCase}
              onChange={(e) => {
                setSelectedCase(e.target.value);
                setCurrentPage(1);
              }}
              className="dropdown-tactile"
              style={{ padding: "6px 10px", fontSize: "11.5px" }}
            >
              <option value="ALL">All Cases ({availableCases.length})</option>
              {availableCases.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter: Evidence Format / Type */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="select-filter-type" style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
              Format:
            </label>
            <select
              id="select-filter-type"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="dropdown-tactile"
              style={{ padding: "6px 10px", fontSize: "11.5px" }}
            >
              <option value="ALL">All Formats</option>
              <option value="PDF">PDF Reports (.pdf)</option>
              <option value="IMAGE">Scene Images (.png, .jpg)</option>
              <option value="DATA_TEXT">Data & Timelines (.csv, .json, .txt)</option>
              <option value="BINARY_DUMP">Raw Disk / Binary (.bin, .pcap, .dd)</option>
            </select>
          </div>

          {/* Filter: Custodian / Registering Personnel */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="select-filter-custodian" style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
              Custodian:
            </label>
            <select
              id="select-filter-custodian"
              value={selectedCustodian}
              onChange={(e) => {
                setSelectedCustodian(e.target.value);
                setCurrentPage(1);
              }}
              className="dropdown-tactile"
              style={{ padding: "6px 10px", fontSize: "11.5px" }}
            >
              <option value="ALL">All Personnel</option>
              {availableCustodians.map((cust) => (
                <option key={cust} value={cust}>
                  {cust.length > 28 ? cust.slice(0, 12) + "..." + cust.slice(-8) : cust}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedCase !== "ALL" || selectedType !== "ALL" || selectedCustodian !== "ALL" || activeFilter !== "ALL") && (
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={handleResetFilters}
              style={{ fontSize: "11px", padding: "6px 10px" }}
              title="Reset all active filters"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Quick Tag Pills */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border-color)" }}>
          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 600 }}>Quick Filters:</span>
          {quickTags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              className="chip-tag"
              style={{
                fontSize: "10.5px",
                padding: "2px 8px",
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

      {/* 4. Loading State */}
      {loading && (
        <div className="doc-panel" style={{ padding: "40px", textAlign: "center" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px auto" }} />
          <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Loading Evidence Repository...</p>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Reconciling SQLite catalog with active verification ledger.
          </p>
        </div>
      )}

      {/* 5. Error State */}
      {error && !loading && (
        <div className="doc-panel" style={{ padding: "24px", border: "1px solid #E05252", backgroundColor: "#FDF2F2" }}>
          <h3 style={{ fontSize: "14px", color: "#C81E1E", margin: 0 }}>Evidentiary Vault Synchronization Notice</h3>
          <p style={{ fontSize: "12.5px", color: "#771D1D", marginTop: "6px" }}>{String(error)}</p>
          <button
            type="button"
            className="btn-tactile-secondary"
            onClick={handleResetFilters}
            style={{ marginTop: "12px", fontSize: "11px" }}
          >
            Retry Repository Query
          </button>
        </div>
      )}

      {/* 6. Desktop Master Archival Table */}
      {!loading && (
        <div className="desktop-table-container archival-table-desktop">
          {filteredList.length === 0 ? (
            <div className="doc-panel" style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>No Evidence Matches Current Criteria</p>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Zero dossiers match the selected filters across case, status, format, and search query.
              </p>
              <button
                type="button"
                className="btn-tactile-secondary"
                style={{ marginTop: "14px", fontSize: "11.5px" }}
                onClick={handleResetFilters}
              >
                Reset All Filters ({totalCount} Total Items)
              </button>
            </div>
          ) : (
            <div className="table-wrapper-archival doc-panel" style={{ padding: 0 }}>
              <table className="archival-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: "145px" }}>Case Docket</th>
                    <th style={{ width: "130px" }}>Evidence ID</th>
                    <th>File Name & Title</th>
                    <th style={{ width: "185px" }}>Fingerprint (SHA-256)</th>
                    <th style={{ width: "165px" }}>Registration Status</th>
                    <th style={{ width: "155px" }}>Intake Timestamp</th>
                    <th style={{ width: "165px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((item) => {
                    const st = getEvidenceStatus(item);
                    const fileName = String(item.title || (item.filePath ? item.filePath.split("/").pop() : "evidence_payload.bin"));
                    return (
                      <tr
                        key={item.evidenceId || Math.random()}
                        onClick={() => setInspectItem(item)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: inspectItem?.evidenceId === item.evidenceId ? "rgba(40, 122, 88, 0.05)" : "transparent",
                        }}
                        title="Click row to open quick-inspect drawer"
                      >
                        <td>
                          <span className="case-docket-tag">{item.caseId || "UNASSIGNED"}</span>
                        </td>
                        <td>
                          <span className="mono-identifier" style={{ fontWeight: 600 }}>
                            {item.evidenceId}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          <div style={{ color: "var(--text-primary)" }}>{item.title || fileName}</div>
                          {item.filePath && (
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                              {String(item.filePath).split("/").pop()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="hash-preview-chip">
                            <span>
                              {item.sha256Hash
                                ? `${String(item.sha256Hash).slice(0, 10)}...${String(item.sha256Hash).slice(-8)}`
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
                          <span className={st?.pillClass || "badge-clean"} style={{ ...(st?.badgeStyle || {}), fontSize: "10.5px", padding: "2px 8px" }}>
                            {st?.label || "Catalogued"}
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
                                if (onSelectEvidence) onSelectEvidence(item.evidenceId);
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
      )}

      {/* 7. Mobile Responsive Dossier Cards (Visible <= 768px) */}
      {!loading && (
        <div className="mobile-cards-container archival-cards-mobile">
          {paginatedList.map((item) => {
            const st = getEvidenceStatus(item);
            return (
              <div key={item.evidenceId || Math.random()} className="mobile-dossier-card ambient-card" style={{ marginBottom: "10px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <span className="case-docket-tag">{item.caseId}</span>
                    <span className="mono-identifier" style={{ marginLeft: "6px", fontWeight: 600 }}>
                      {item.evidenceId}
                    </span>
                  </div>
                  <span className={st?.pillClass} style={{ ...(st?.badgeStyle || {}), fontSize: "9.5px", padding: "2px 6px" }}>
                    {st?.shortLabel}
                  </span>
                </div>

                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  {item.title}
                </div>

                {item.description && (
                  <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", margin: "0 0 6px 0", lineHeight: 1.3 }}>
                    {item.description}
                  </p>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{formatISTDateTime(item.createdAt)}</span>
                  <button
                    type="button"
                    className="btn-tactile-primary"
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                    onClick={() => onSelectEvidence && onSelectEvidence(item.evidenceId)}
                  >
                    Open Dossier →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8. Pagination Strip */}
      {totalFiltered > 0 && (
        <div
          className="doc-panel"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            marginTop: "12px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            Showing <strong style={{ color: "var(--text-primary)" }}>{startIndex + 1}</strong> to{" "}
            <strong style={{ color: "var(--text-primary)" }}>{endIndex}</strong> of{" "}
            <strong style={{ color: "var(--text-primary)" }}>{totalFiltered}</strong> dossiers
            {totalFiltered !== totalCount && ` (filtered from ${totalCount} total)`}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span>Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === "ALL" ? "ALL" : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="dropdown-tactile"
                style={{ padding: "2px 6px", fontSize: "11px" }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value="ALL">All ({totalFiltered})</option>
              </select>
            </div>

            {!isAll && totalPages > 1 && (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="btn-tactile-secondary"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                >
                  ← Prev
                </button>
                <span style={{ padding: "3px 8px", fontFamily: "var(--font-mono)" }}>
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-tactile-secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. Slide-Over Quick Inspect Drawer */}
      {inspectItem && (
        <div
          className="inspect-drawer-overlay doc-panel"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "420px",
            maxWidth: "92vw",
            zIndex: 1000,
            boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.2)",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--surface-primary)",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--green-institutional)" }}>
              QUICK INSPECT DOSSIER
            </span>
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={() => setInspectItem(null)}
              style={{ padding: "4px 10px", fontSize: "11px" }}
            >
              Close [×]
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
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

            {/* Metadata Details */}
            {(() => {
              const st = getEvidenceStatus(inspectItem);
              const fileName = String(inspectItem.filePath || inspectItem.title || "evidence_payload.bin").split("/").pop();
              return (
                <div style={{ display: "grid", gap: "8px", fontSize: "11.5px", marginBottom: "16px" }}>
                  <div style={{ padding: "8px 10px", background: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "3px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Registration Status</div>
                    <div style={{ fontWeight: 600, marginTop: "2px", color: st?.dotColor }}>
                      {st?.label}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {st?.summary}
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
                      {inspectItem.custodian || String(inspectItem.registeredBy || "Forensic Custody Officer")}
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
                if (onVerifyEvidence) onVerifyEvidence(inspectItem.evidenceId);
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
                if (onSelectEvidence) onSelectEvidence(inspectItem.evidenceId);
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
