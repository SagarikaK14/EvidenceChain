// ============================================================
// EvidenceChain Evidence Access History View
// Sovereign Digital-Forensics Command Architecture
// Chronological Audit Register & Verifiable Ledger Timeline
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { formatISTDateTime } from "../utils/dateUtils";
import {
  ShieldIcon,
  ShieldCheckIcon,
  LockIcon,
  UnlockIcon,
  EyeIcon,
  DownloadIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SearchIcon,
  XIcon,
  RefreshCwIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  FileTextIcon,
  UserIcon,
  ClockIcon,
  ActivityIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "../components/Icons";
import { getAccessHistoryAPI } from "../api";

export function AccessHistoryView({
  evidenceList = [],
  initialEvidenceId = "",
  onFetchHistory,
  historyRecords,
  loading: parentLoading = false,
  error: parentError = "",
  backendConnected = true,
  currentUser = null,
  onBack,
}) {
  // ------------------------------------------------------------
  // STEP 1 STATE: CASE DOCKET SELECTION
  // ------------------------------------------------------------
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [caseSearchQuery, setCaseSearchQuery] = useState("");

  // Aggregate distinct cases from registered evidence list
  const availableCases = useMemo(() => {
    const map = new Map();
    (evidenceList || []).forEach((ev) => {
      const cid = (ev.caseId || "").trim();
      if (!cid) return;
      if (!map.has(cid)) {
        map.set(cid, {
          caseId: cid,
          title: ev.caseTitle || ev.title || `Case ${cid}`,
          description: ev.caseDescription || ev.description || "Active judicial evidence docket.",
          evidenceCount: 1,
          latestDate: ev.createdAt,
          evidenceRecords: [ev],
        });
      } else {
        const item = map.get(cid);
        item.evidenceCount += 1;
        item.evidenceRecords.push(ev);
        if (ev.createdAt && (!item.latestDate || ev.createdAt > item.latestDate)) {
          item.latestDate = ev.createdAt;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      (b.latestDate || "").localeCompare(a.latestDate || "")
    );
  }, [evidenceList]);

  // Filter cases by search query
  const filteredCases = useMemo(() => {
    const q = caseSearchQuery.trim().toLowerCase();
    if (!q) return availableCases;
    return availableCases.filter(
      (c) =>
        c.caseId.toLowerCase().includes(q) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [availableCases, caseSearchQuery]);

  const activeCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return availableCases.find((c) => c.caseId === selectedCaseId) || null;
  }, [availableCases, selectedCaseId]);

  // ------------------------------------------------------------
  // STEP 2 STATE: EVIDENCE SELECTION
  // ------------------------------------------------------------
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState("");

  // Evidence records filtered by the selected case
  const caseEvidenceRecords = useMemo(() => {
    if (!selectedCaseId) return [];
    return (evidenceList || []).filter(
      (ev) => (ev.caseId || "").trim().toLowerCase() === selectedCaseId.trim().toLowerCase()
    );
  }, [evidenceList, selectedCaseId]);

  const filteredCaseEvidence = useMemo(() => {
    const q = evidenceSearchQuery.trim().toLowerCase();
    if (!q) return caseEvidenceRecords;
    return caseEvidenceRecords.filter(
      (ev) =>
        (ev.title && ev.title.toLowerCase().includes(q)) ||
        (ev.evidenceId && ev.evidenceId.toLowerCase().includes(q)) ||
        (ev.description && ev.description.toLowerCase().includes(q))
    );
  }, [caseEvidenceRecords, evidenceSearchQuery]);

  const activeEvidence = useMemo(() => {
    if (!selectedEvidenceId) return null;
    return (evidenceList || []).find((ev) => ev.evidenceId === selectedEvidenceId) || null;
  }, [evidenceList, selectedEvidenceId]);

  // Support pre-selection if initialEvidenceId is provided via navigation
  useEffect(() => {
    if (initialEvidenceId && (evidenceList || []).length > 0) {
      const match = evidenceList.find((e) => e.evidenceId === initialEvidenceId);
      if (match && match.caseId) {
        setSelectedCaseId(match.caseId);
        setSelectedEvidenceId(match.evidenceId);
      } else if (match) {
        setSelectedEvidenceId(match.evidenceId);
      }
    }
  }, [initialEvidenceId, evidenceList]);

  // ------------------------------------------------------------
  // STEP 3 STATE: AUDIT LOG TIMELINE & QUERY EXECUTION
  // ------------------------------------------------------------
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filters State
  const [activityFilter, setActivityFilter] = useState("ALL"); // ALL | VIEWS | DOWNLOADS | GRANTS | REVOKES
  const [officerFilter, setOfficerFilter] = useState("ALL");
  const [keywordSearch, setKeywordSearch] = useState("");

  // Event Details Modal State
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Load history from backend
  const fetchEvidenceHistory = useCallback(async (evId) => {
    if (!evId) {
      setHistoryData(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await getAccessHistoryAPI(evId);
      setHistoryData(res);
      // Synchronize with parent handler if present
      if (onFetchHistory) {
        onFetchHistory(evId).catch(() => {});
      }
    } catch (err) {
      console.warn("Access history fetch error:", err);
      setError(err.message || "Failed to query on-chain access history.");
      setHistoryData(null);
    } finally {
      setLoading(false);
    }
  }, [onFetchHistory]);

  // Fetch whenever selected evidence changes or refresh is requested
  useEffect(() => {
    if (selectedEvidenceId) {
      fetchEvidenceHistory(selectedEvidenceId);
    } else {
      setHistoryData(null);
      setLoading(false);
      setError("");
    }
  }, [selectedEvidenceId, refreshTrigger, fetchEvidenceHistory]);

  // Reset actions
  const handleSelectCase = (cid) => {
    setSelectedCaseId(cid);
    setSelectedEvidenceId("");
    setEvidenceSearchQuery("");
    setHistoryData(null);
    setError("");
  };

  const handleResetCase = () => {
    setSelectedCaseId("");
    setCaseSearchQuery("");
    setSelectedEvidenceId("");
    setEvidenceSearchQuery("");
    setHistoryData(null);
    setError("");
  };

  const handleSelectEvidence = (evId) => {
    setSelectedEvidenceId(evId);
    setLoading(true);
    setHistoryData(null);
    setActivityFilter("ALL");
    setOfficerFilter("ALL");
    setKeywordSearch("");
  };

  const handleResetEvidence = () => {
    setSelectedEvidenceId("");
    setEvidenceSearchQuery("");
    setHistoryData(null);
    setError("");
  };

  const handleRefresh = () => {
    if (selectedEvidenceId) {
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  // Distinct officers in the loaded audit register
  const availableOfficers = useMemo(() => {
    if (!historyData?.records || historyData.records.length === 0) return [];
    const set = new Set();
    historyData.records.forEach((r) => {
      if (r.officerName) set.add(r.officerName);
    });
    return Array.from(set).sort();
  }, [historyData]);

  // Filtered Records based on Activity, Officer, and Keyword search
  const filteredRecords = useMemo(() => {
    if (!historyData?.records) return [];
    return historyData.records.filter((rec) => {
      // 1. Activity filter
      if (activityFilter === "VIEWS" && rec.eventType !== "EVIDENCE_VIEWED") return false;
      if (activityFilter === "DOWNLOADS" && rec.eventType !== "EVIDENCE_DOWNLOADED") return false;
      if (activityFilter === "GRANTS" && !rec.eventType.includes("GRANTED")) return false;
      if (activityFilter === "REVOKES" && !rec.eventType.includes("REVOKED")) return false;

      // 2. Officer filter
      if (officerFilter !== "ALL" && rec.officerName !== officerFilter) return false;

      // 3. Keyword Search
      if (keywordSearch.trim()) {
        const q = keywordSearch.trim().toLowerCase();
        const matchName = (rec.officerName || "").toLowerCase().includes(q);
        const matchRole = (rec.officerRole || "").toLowerCase().includes(q);
        const matchEmpId = (rec.officerEmployeeId || "").toLowerCase().includes(q);
        const matchDesc = (rec.description || "").toLowerCase().includes(q);
        const matchAction = (rec.actionLabel || "").toLowerCase().includes(q);
        const matchTx = (rec.txHash || "").toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchEmpId && !matchDesc && !matchAction && !matchTx) {
          return false;
        }
      }

      return true;
    });
  }, [historyData, activityFilter, officerFilter, keywordSearch]);

  // Helper: Copy transaction hash
  const handleCopyHash = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Helper: Render Event Type Badge
  const renderEventBadge = (eventType) => {
    switch (eventType) {
      case "EVIDENCE_VIEWED":
        return (
          <span className="history-pill pill-view">
            <EyeIcon size={12} />
            <span>Evidence Viewed</span>
          </span>
        );
      case "EVIDENCE_DOWNLOADED":
        return (
          <span className="history-pill pill-download">
            <DownloadIcon size={12} />
            <span>File Downloaded</span>
          </span>
        );
      case "VIEW_PERMISSION_GRANTED":
        return (
          <span className="history-pill pill-grant">
            <ShieldCheckIcon size={12} />
            <span>View Granted</span>
          </span>
        );
      case "VIEW_PERMISSION_REVOKED":
        return (
          <span className="history-pill pill-revoke">
            <LockIcon size={12} />
            <span>View Revoked</span>
          </span>
        );
      case "DOWNLOAD_PERMISSION_GRANTED":
        return (
          <span className="history-pill pill-grant">
            <ShieldCheckIcon size={12} />
            <span>Download Granted</span>
          </span>
        );
      case "DOWNLOAD_PERMISSION_REVOKED":
        return (
          <span className="history-pill pill-revoke">
            <LockIcon size={12} />
            <span>Download Revoked</span>
          </span>
        );
      default:
        return (
          <span className="history-pill pill-neutral">
            <ActivityIcon size={12} />
            <span>Access Event</span>
          </span>
        );
    }
  };

  // Helper: Format readable timestamp in Asia/Kolkata (IST)
  const formatTimestamp = (ts) => {
    return formatISTDateTime(ts, false);
  };

  return (
    <div className="view-container access-history-view" data-testid="access-history-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* 0. Return to Repository Control */}
      {onBack && (
        <div className="portal-top-bar" style={{ minWidth: 0, flexWrap: "wrap", gap: "10px" }}>
          <button
            type="button"
            className="btn-portal-back"
            onClick={onBack}
            title="Return to evidence repository"
          >
            <span>&larr;</span>
            <span>BACK TO REPOSITORY</span>
          </button>
          <div className="portal-seal-indicator">
            <ShieldCheckIcon size={15} />
            <span>CUSTODY AUDIT &amp; ACCESS LOG REGISTRY</span>
          </div>
        </div>
      )}

      {/* 1. Page Header Block */}
      <div className="page-header-block access-header-clean" style={{ marginBottom: "18px" }}>
        <div>
          <h1 className="page-title">Evidence Access Audit Trail &amp; History</h1>
          <p className="page-context-desc">
            Verifiable chronological log of all access inquiries, viewing sessions, authorized downloads, and permission modifications.
          </p>
        </div>
      </div>

      {/* 2. Authority & Session Status Strip */}
      <div className="authority-banner doc-panel" style={{ marginBottom: "16px" }}>
        <div className="authority-banner-content">
          <div className="authority-badge-row">
            <span className="gov-authority-pill badge-clean pill-hod">
              EVIDENCE AUDIT VERIFICATION GATE ACTIVE
            </span>
          </div>
          <div className="authority-session-text">
            Active Session: <strong>{currentUser?.name || "Dr. Rajeshwar Sen"}</strong> •{" "}
            {currentUser?.role || "Head of Department"} •{" "}
            {currentUser?.department || "Forensics Headquarters"} • All inquiries cryptographically bound to ledger.
          </div>
        </div>
      </div>

      {/* Backend Disconnection Banner */}
      {!backendConnected && (
        <div className="banner-alert alert-error" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Service Disconnected:</strong> Cannot query on-chain audit register. Blockchain service unavailable.
          </div>
        </div>
      )}

      {/* ============================================================
          WORKFLOW CONTAINER: 2-STEP EVIDENCE LOCATOR
          ============================================================ */}
      <div className="access-workflow-container" style={{ marginBottom: "20px" }}>
        {/* --------------------------------------------------------
            STEP 1: SELECT CASE DOCKET
            -------------------------------------------------------- */}
        <section className={`workflow-step-card ${selectedCaseId ? "step-completed" : "step-active"}`}>
          <div className="step-card-header">
            <div className="step-number-badge">01</div>
            <div>
              <h2 className="step-title">Select Case Docket</h2>
              <p className="step-subtitle">Identify the judicial docket containing the target evidence record.</p>
            </div>
          </div>

          {!selectedCaseId ? (
            <div className="step-body-content">
              <div className="search-field-wrapper">
                <SearchIcon size={16} className="search-field-icon" />
                <input
                  type="text"
                  className="gov-search-input"
                  placeholder="Search by case number or title..."
                  value={caseSearchQuery}
                  onChange={(e) => setCaseSearchQuery(e.target.value)}
                  id="history-case-search-input"
                />
                {caseSearchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setCaseSearchQuery("")}
                    title="Clear search"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Case Results List — Compact Searchable Table */}
              {filteredCases.length === 0 ? (
                <div className="empty-results-box" style={{ marginTop: "12px" }}>
                  <AlertTriangleIcon size={20} />
                  <span>No cases match &ldquo;{caseSearchQuery}&rdquo;.</span>
                </div>
              ) : (
                <div className="compact-case-selector-table-wrap">
                  <table className="compact-selector-table">
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>Case Docket ID</th>
                        <th>Case Title & Description</th>
                        <th style={{ width: "18%", textAlign: "center" }}>Evidence Count</th>
                        <th style={{ width: "14%", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCases.map((c) => (
                        <tr
                          key={c.caseId}
                          className="compact-selector-row"
                          onClick={() => handleSelectCase(c.caseId)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") handleSelectCase(c.caseId);
                          }}
                        >
                          <td>
                            <span className="case-ref-tag">{c.caseId}</span>
                          </td>
                          <td>
                            <div className="compact-row-title">{c.title}</div>
                            {c.description && <div className="compact-row-subtitle">{c.description}</div>}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="case-evidence-count-pill">
                              {c.evidenceCount} {c.evidenceCount === 1 ? "Record" : "Records"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn-compact-select"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCase(c.caseId);
                              }}
                            >
                              Select &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="selected-summary-banner case-summary-banner">
              <div className="selected-summary-details">
                <span className="summary-section-label">SELECTED CASE DOCKET</span>
                <div className="summary-main-ref">{activeCase?.caseId}</div>
                <div className="summary-subtext">
                  {activeCase?.title} • {activeCase?.evidenceCount} Evidence {activeCase?.evidenceCount === 1 ? "Record" : "Records"}
                </div>
              </div>
              <button
                type="button"
                className="btn-change-selection"
                onClick={handleResetCase}
                title="Change active case"
              >
                Change Case
              </button>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------
            STEP 2: SELECT EVIDENCE RECORD
            -------------------------------------------------------- */}
        <section
          className={`workflow-step-card ${
            !selectedCaseId
              ? "step-disabled"
              : selectedEvidenceId
              ? "step-completed"
              : "step-active"
          }`}
        >
          <div className="step-card-header">
            <div className="step-number-badge">02</div>
            <div>
              <h2 className="step-title">Select Evidence Record</h2>
              <p className="step-subtitle">Choose the evidence record to retrieve its chronological audit history.</p>
            </div>
          </div>

          {!selectedCaseId ? (
            <div className="step-locked-placeholder">
              <LockIcon size={20} />
              <span>Select a case in Step 1 to load associated evidence records.</span>
            </div>
          ) : !selectedEvidenceId ? (
            <div className="step-body-content">
              <div className="search-field-wrapper">
                <SearchIcon size={16} className="search-field-icon" />
                <input
                  type="text"
                  className="gov-search-input"
                  placeholder="Search by evidence title, filename, or ID..."
                  value={evidenceSearchQuery}
                  onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                  id="history-evidence-search-input"
                />
                {evidenceSearchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setEvidenceSearchQuery("")}
                    title="Clear search"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              <div className="evidence-results-grid">
                {filteredCaseEvidence.length === 0 ? (
                  <div className="empty-results-box">
                    <AlertTriangleIcon size={20} />
                    <span>No evidence records found for {selectedCaseId}.</span>
                  </div>
                ) : (
                  filteredCaseEvidence.map((ev) => (
                    <div
                      key={ev.evidenceId}
                      className="evidence-selection-card"
                      onClick={() => handleSelectEvidence(ev.evidenceId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleSelectEvidence(ev.evidenceId);
                      }}
                    >
                      <div className="evidence-card-top">
                        <span className="evidence-id-tag">{ev.evidenceId}</span>
                        {ev.isOnChain === false ? (
                          <span className="ledger-badge unanchored" title="Record not anchored on active blockchain ledger">
                            Not Anchored
                          </span>
                        ) : ev.isOnChain === true ? (
                          <span className="ledger-badge anchored" title="Anchored on active blockchain ledger">
                            Anchored
                          </span>
                        ) : null}
                        {ev.createdAt && (
                          <span className="evidence-date-text">
                            {ev.createdAt.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      <div className="evidence-card-title">{ev.title || "evidence.bin"}</div>
                      {ev.description && <p className="evidence-card-desc">{ev.description}</p>}
                      <div className="evidence-card-footer">
                        <span className="evidence-card-action">Inspect Access History &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="selected-summary-banner evidence-summary-banner">
              <div className="selected-summary-details">
                <span className="summary-section-label">SELECTED EVIDENCE RECORD</span>
                <div className="summary-main-ref">{activeEvidence?.title}</div>
                <div className="summary-subtext">
                  Evidence ID: <strong>{activeEvidence?.evidenceId}</strong> • Associated Case: <strong>{selectedCaseId}</strong>
                  {activeEvidence?.isOnChain === false && (
                    <span className="unanchored-summary-warning">
                      {" "}• <AlertTriangleIcon size={12} /> <em>Not anchored on active ledger</em>
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn-change-selection"
                onClick={handleResetEvidence}
                title="Change active evidence"
              >
                Change Evidence
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ============================================================
          AUDIT LEDGER PANEL (WHEN EVIDENCE IS SELECTED)
          ============================================================ */}
      {selectedEvidenceId && (
        <div className="history-ledger-container doc-panel">
          {/* Header Card Strip */}
          <div className="history-docket-header">
            <div className="docket-header-left">
              <div className="docket-ref-row">
                <span className="docket-title-text">{activeEvidence?.title || historyData?.title || "evidence.bin"}</span>
                <span className="docket-id-pill">{selectedEvidenceId}</span>
                {historyData?.isOnChain ? (
                  <span className="gov-status-pill status-allowed ledger-badge anchored">
                    <CheckCircleIcon size={13} />
                    <span>Anchored on Blockchain Ledger</span>
                  </span>
                ) : (
                  <span className="gov-status-pill status-unregistered ledger-badge unanchored">
                    <AlertTriangleIcon size={13} />
                    <span>Not Anchored on Active Ledger</span>
                  </span>
                )}
              </div>
              <div className="docket-meta-row">
                <span>Associated Case: <strong>{selectedCaseId || historyData?.caseId}</strong></span>
                {historyData?.sha256Hash && (
                  <>
                    <span className="meta-sep">&bull;</span>
                    <span>
                      SHA-256 Digest: <code>{historyData.sha256Hash.slice(0, 16)}...{historyData.sha256Hash.slice(-8)}</code>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="docket-header-right">
              <button
                type="button"
                className="btn-subtle-refresh"
                onClick={handleRefresh}
                disabled={loading}
                title="Re-query smart contract for updated access logs"
              >
                <RefreshCwIcon size={13} className={loading ? "spin-inline" : ""} />
                <span>{loading ? "Reading Ledger..." : "Refresh Ledger Records"}</span>
              </button>
            </div>
          </div>

          {/* Metrics Ribbon (Only shown if anchored) */}
          {historyData?.isOnChain && (
            <div className="history-metrics-grid">
              <div className="history-metric-card">
                <span className="metric-card-label">TOTAL AUDIT EVENTS</span>
                <span className="metric-card-val">{historyData?.metrics?.total ?? 0}</span>
                <span className="metric-card-sub">Recorded on-chain</span>
              </div>
              <div className="history-metric-card">
                <span className="metric-card-label">INSPECTION VIEWS</span>
                <span className="metric-card-val">{historyData?.metrics?.views ?? 0}</span>
                <span className="metric-card-sub">In-browser sessions</span>
              </div>
              <div className="history-metric-card">
                <span className="metric-card-label">FILE DOWNLOADS</span>
                <span className="metric-card-val">{historyData?.metrics?.downloads ?? 0}</span>
                <span className="metric-card-sub">Binary extractions</span>
              </div>
              <div className="history-metric-card">
                <span className="metric-card-label">PERMISSIONS GRANTED</span>
                <span className="metric-card-val">{historyData?.metrics?.grants ?? 0}</span>
                <span className="metric-card-sub">By HOD authority</span>
              </div>
              <div className="history-metric-card">
                <span className="metric-card-label">PERMISSIONS REVOKED</span>
                <span className="metric-card-val">{historyData?.metrics?.revokes ?? 0}</span>
                <span className="metric-card-sub">By HOD authority</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="banner-alert alert-error" style={{ margin: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <strong>Ledger Query Error:</strong> {error}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "3px 10px", fontSize: "11px" }}
                  onClick={handleRefresh}
                >
                  Retry Query
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loading || !historyData ? (
            <div className="history-loading-box">
              <RefreshCwIcon size={22} className="spin-inline" />
              <span>Querying immutable smart contract audit register...</span>
            </div>
          ) : historyData?.isOnChain === false ? (
            /* Unanchored Evidence State */
            <div className="history-unanchored-box">
              <div className="unanchored-box-icon">
                <AlertTriangleIcon size={24} />
              </div>
              <h3 className="unanchored-box-title">Evidence Record Not Anchored on Active Blockchain Ledger</h3>
              <p className="unanchored-box-desc">
                Record <code>{selectedEvidenceId}</code> exists in the local database registry from an earlier development session,
                but is not anchored on the active smart contract (<code>0x5FbD...aa3</code>).
              </p>
              <p className="unanchored-box-note">
                Immutable access and authorization events can only be queried for evidence records anchored on the active blockchain ledger.
              </p>
            </div>
          ) : historyData?.records?.length === 0 ? (
            /* Anchored Evidence with Zero Events State */
            <div className="history-empty-box">
              <div className="empty-box-icon">
                <ShieldCheckIcon size={24} />
              </div>
              <h3 className="empty-box-title">Zero Access or Authorization Events Recorded</h3>
              <p className="empty-box-desc">
                Evidence record <code>{selectedEvidenceId}</code> is verified and anchored on the blockchain ledger,
                but no access permissions have been granted or revoked, and no authorized officers have viewed or downloaded this file yet.
              </p>
              <p className="empty-box-note">
                When an officer opens or extracts this file, or when the Head of Department modifies access rights in Access Management,
                an indelible on-chain record will be committed here.
              </p>
            </div>
          ) : (
            /* Populated Audit Register Table & Filters */
            <div className="history-table-section">
              {/* Filter Controls Bar */}
              <div className="history-filters-bar">
                {/* Activity Tabs */}
                <div className="history-filter-chips">
                  <button
                    type="button"
                    className={`filter-chip ${activityFilter === "ALL" ? "chip-active" : ""}`}
                    onClick={() => setActivityFilter("ALL")}
                  >
                    All Activities ({historyData?.records?.length || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${activityFilter === "VIEWS" ? "chip-active" : ""}`}
                    onClick={() => setActivityFilter("VIEWS")}
                  >
                    Views ({historyData?.metrics?.views || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${activityFilter === "DOWNLOADS" ? "chip-active" : ""}`}
                    onClick={() => setActivityFilter("DOWNLOADS")}
                  >
                    Downloads ({historyData?.metrics?.downloads || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${activityFilter === "GRANTS" ? "chip-active" : ""}`}
                    onClick={() => setActivityFilter("GRANTS")}
                  >
                    Grants ({historyData?.metrics?.grants || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${activityFilter === "REVOKES" ? "chip-active" : ""}`}
                    onClick={() => setActivityFilter("REVOKES")}
                  >
                    Revokes ({historyData?.metrics?.revokes || 0})
                  </button>
                </div>

                {/* Secondary Filters: Officer Dropdown & Keyword Search */}
                <div className="history-filter-inputs">
                  {availableOfficers.length > 1 && (
                    <div className="filter-select-wrapper">
                      <label htmlFor="history-officer-filter" className="sr-only">Filter by Officer</label>
                      <select
                        id="history-officer-filter"
                        className="gov-filter-select"
                        value={officerFilter}
                        onChange={(e) => setOfficerFilter(e.target.value)}
                      >
                        <option value="ALL">All Officers ({availableOfficers.length})</option>
                        {availableOfficers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="search-field-wrapper filter-search-wrapper" style={{ margin: 0 }}>
                    <SearchIcon size={14} className="search-field-icon" />
                    <input
                      type="text"
                      className="gov-search-input filter-search-input"
                      placeholder="Filter records..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                    />
                    {keywordSearch && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setKeywordSearch("")}
                        title="Clear filter"
                      >
                        <XIcon size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Table Register */}
              <div className="table-wrapper-archival history-table-wrapper">
                <table className="archival-table history-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45px" }}>#</th>
                      <th style={{ width: "150px" }}>Event Classification</th>
                      <th style={{ width: "230px" }}>Officer Identity</th>
                      <th>Activity Description</th>
                      <th style={{ width: "180px" }}>Timestamp (IST)</th>
                      <th style={{ width: "135px" }}>Verification</th>
                      <th style={{ width: "95px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "26px", color: "var(--text-secondary)" }}>
                          No audit events match current filters ({activityFilter !== "ALL" ? `Activity: ${activityFilter}` : ""}{" "}
                          {officerFilter !== "ALL" ? `Officer: ${officerFilter}` : ""}).
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((item, idx) => (
                        <tr key={item.id || idx} className="history-row">
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                            {idx + 1}
                          </td>
                          <td>{renderEventBadge(item.eventType)}</td>
                          <td>
                            <div className="history-officer-cell">
                              <span className="officer-cell-name">{item.officerName}</span>
                              <span className="officer-cell-meta">
                                {item.officerRole} [{item.officerEmployeeId}]
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: "12.5px", color: "#142535" }}>
                            {item.description}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#545752" }}>
                            {formatTimestamp(item.timestamp)}
                          </td>
                          <td>
                            <span className="ledger-verified-tag">
                              <CheckCircleIcon size={12} />
                              <span>Verified On-Chain</span>
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn-history-inspect"
                              onClick={() => {
                                setSelectedEvent(item);
                                setShowTechDetails(false);
                              }}
                              title="Inspect full transaction metadata"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="history-table-footer">
                <span className="footer-count-text">
                  Showing <strong>{filteredRecords.length}</strong> of <strong>{historyData?.records?.length || 0}</strong> recorded on-chain events
                </span>
                <span className="footer-immutable-text">
                  <ShieldCheckIcon size={12} />
                  <span>Non-repudiable audit log immutably anchored in Ethereum block state.</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          EVENT DETAILS SPECIFICATION MODAL
          ============================================================ */}
      {selectedEvent && (
        <div className="modal-overlay-flat" onClick={() => setSelectedEvent(null)}>
          <div
            className="modal-dialog-flat gov-confirm-modal event-details-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header-flat">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="modal-icon-badge">
                  <ShieldCheckIcon size={20} />
                </div>
                <div>
                  <h3 className="modal-title-flat">Audit Event Specification</h3>
                  <div className="modal-subtitle-clean">
                    Immutable Record Reference: {selectedEvent.id}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-subtle-close btn-subtle-mono"
                onClick={() => setSelectedEvent(null)}
                title="Close dialog"
              >
                ESC
              </button>
            </div>

            <div className="modal-body-flat">
              {/* Event Header Banner */}
              <div className="modal-event-lead-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  {renderEventBadge(selectedEvent.eventType)}
                  <span className="ledger-verified-tag">
                    <CheckCircleIcon size={12} />
                    <span>Cryptographically Verified</span>
                  </span>
                </div>
                <p className="modal-event-summary-text">{selectedEvent.description}</p>
              </div>

              {/* Specification Grid */}
              <div className="modal-metadata-card">
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Target Officer:</span>
                  <span className="modal-meta-value">
                    <strong>{selectedEvent.officerName}</strong> • {selectedEvent.officerRole} [{selectedEvent.officerEmployeeId}]
                  </span>
                </div>

                {selectedEvent.authorizedByName && (
                  <div className="modal-meta-row">
                    <span className="modal-meta-label">Authorizing Authority:</span>
                    <span className="modal-meta-value">
                      <strong>{selectedEvent.authorizedByName}</strong> • {selectedEvent.authorizedByRole}
                    </span>
                  </div>
                )}

                <div className="modal-meta-row">
                  <span className="modal-meta-label">Associated Case:</span>
                  <span className="modal-meta-value">{selectedCaseId || historyData?.caseId}</span>
                </div>

                <div className="modal-meta-row">
                  <span className="modal-meta-label">Target Evidence:</span>
                  <span className="modal-meta-value">
                    {activeEvidence?.title || historyData?.title} (<code>{selectedEvidenceId}</code>)
                  </span>
                </div>

                <div className="modal-meta-row">
                  <span className="modal-meta-label">Execution Timestamp:</span>
                  <span className="modal-meta-value" style={{ fontFamily: "var(--font-mono)" }}>
                    {formatTimestamp(selectedEvent.timestamp)}
                  </span>
                </div>

                <div className="modal-meta-row">
                  <span className="modal-meta-label">Audit Record Source:</span>
                  <span className="modal-meta-value">{selectedEvent.source}</span>
                </div>
              </div>

              {/* Technical Details Collapsible Disclosure */}
              <div className="tech-details-disclosure" style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn-disclosure-toggle"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  aria-expanded={showTechDetails}
                >
                  <span>{showTechDetails ? "▼ Hide Technical Ledger Details" : "▶ Technical Details (Audit Disclosure)"}</span>
                </button>
                {showTechDetails && (
                  <div className="tech-details-content">
                    {selectedEvent.blockNumber && (
                      <div className="tech-detail-row">
                        <span className="tech-detail-label">Ethereum Block Number:</span>
                        <code className="tech-detail-code">#{selectedEvent.blockNumber}</code>
                      </div>
                    )}
                    {selectedEvent.txHash && (
                      <div className="tech-detail-row">
                        <span className="tech-detail-label">Transaction Hash:</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <code className="tech-detail-code" style={{ fontSize: "11px" }}>
                            {selectedEvent.txHash}
                          </code>
                          <button
                            type="button"
                            className="btn-copy-hash"
                            onClick={() => handleCopyHash(selectedEvent.txHash)}
                            title="Copy full transaction hash"
                          >
                            <CopyIcon size={12} />
                            <span>{copiedHash ? "Copied" : "Copy"}</span>
                          </button>
                        </span>
                      </div>
                    )}
                    {selectedEvent.officerAddress && (
                      <div className="tech-detail-row">
                        <span className="tech-detail-label">Officer EVM Address:</span>
                        <code className="tech-detail-code">{selectedEvent.officerAddress}</code>
                      </div>
                    )}
                    {selectedEvent.authorizedByAddress && (
                      <div className="tech-detail-row">
                        <span className="tech-detail-label">Authority EVM Address:</span>
                        <code className="tech-detail-code">{selectedEvent.authorizedByAddress}</code>
                      </div>
                    )}
                    <div className="tech-detail-row">
                      <span className="tech-detail-label">Smart Contract:</span>
                      <code className="tech-detail-code">0x5FbDB2315678afecb367f032d93F642f64180aa3</code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-flat">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedEvent(null)}
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
