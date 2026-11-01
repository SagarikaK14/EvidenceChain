// ============================================================
// EvidenceChain Access Management View
// Sovereign Indian Government Digital-Services Portal Architecture
// Four-Step Progressive Permission Governance:
// 1. Select Case -> 2. Select Evidence -> 3. Select Officer -> 4. Manage Permissions
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
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
  UserIcon,
  FileTextIcon,
} from "../components/Icons";
import {
  getOfficersAPI,
  checkViewAccessAPI,
  checkDownloadAccessAPI,
} from "../api";

export function AccessManagementView({
  evidenceList = [],
  initialEvidenceId = "",
  onCheckViewAccess,
  onCheckDownloadAccess,
  onGrantViewAccess,
  onRevokeViewAccess,
  onGrantDownloadAccess,
  onRevokeDownloadAccess,
  backendConnected = true,
  currentUser = null,
  onBack,
  onNavigateHistory,
}) {
  // Determine if active user holds Head of Department command privileges
  const isCallerHOD =
    currentUser?.role === "Head of Department" ||
    currentUser?.walletAddress?.toLowerCase() === "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

  // ------------------------------------------------------------
  // STEP 1 STATE: CASE SELECTION
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

  // Filter cases by search query (case number, title, description)
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

  // Selected case object
  const activeCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return availableCases.find((c) => c.caseId === selectedCaseId) || null;
  }, [availableCases, selectedCaseId]);

  // Support pre-selection if initialEvidenceId is provided via navigation
  useEffect(() => {
    if (initialEvidenceId && (evidenceList || []).length > 0) {
      const match = evidenceList.find((e) => e.evidenceId === initialEvidenceId);
      if (match && match.caseId) {
        setSelectedCaseId(match.caseId);
        setSelectedEvidenceId(match.evidenceId);
      }
    }
  }, [initialEvidenceId, evidenceList]);

  // ------------------------------------------------------------
  // STEP 2 STATE: LINKED EVIDENCE SELECTION
  // ------------------------------------------------------------
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState("");

  // Evidence records belonging exclusively to the selected case
  const caseEvidenceRecords = useMemo(() => {
    if (!selectedCaseId) return [];
    return (evidenceList || []).filter(
      (ev) => (ev.caseId || "").trim().toLowerCase() === selectedCaseId.trim().toLowerCase()
    );
  }, [evidenceList, selectedCaseId]);

  // Filter evidence by search query (title, filename, short ID)
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

  // Selected evidence record object
  const activeEvidence = useMemo(() => {
    if (!selectedEvidenceId) return null;
    return (evidenceList || []).find((ev) => ev.evidenceId === selectedEvidenceId) || null;
  }, [evidenceList, selectedEvidenceId]);

  // ------------------------------------------------------------
  // STEP 3 STATE: OFFICER DIRECTORY
  // ------------------------------------------------------------
  const [officers, setOfficers] = useState([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officersError, setOfficersError] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [officerSearchQuery, setOfficerSearchQuery] = useState("");
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Fetch verified officer directory from backend
  useEffect(() => {
    let isMounted = true;
    setOfficersLoading(true);
    setOfficersError("");

    getOfficersAPI()
      .then((res) => {
        if (!isMounted) return;
        const list = res?.officers || res?.members || [];
        setOfficers(list);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Failed to load officer directory:", err);
        setOfficersError("Unable to load officer directory from backend.");
      })
      .finally(() => {
        if (isMounted) setOfficersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter officers by search query (name, designation, employeeId, department)
  const filteredOfficers = useMemo(() => {
    const q = officerSearchQuery.trim().toLowerCase();
    if (!q) return officers;
    return officers.filter(
      (off) =>
        (off.name && off.name.toLowerCase().includes(q)) ||
        (off.designation && off.designation.toLowerCase().includes(q)) ||
        (off.role && off.role.toLowerCase().includes(q)) ||
        (off.employeeId && off.employeeId.toLowerCase().includes(q)) ||
        (off.department && off.department.toLowerCase().includes(q))
    );
  }, [officers, officerSearchQuery]);

  // ------------------------------------------------------------
  // STEP 4 STATE: ACCESS PERMISSIONS MATRIX
  // States: "IDLE" | "CHECKING" | "ALLOWED" | "NOT_ALLOWED" | "ERROR" | "UPDATING"
  // ------------------------------------------------------------
  const [viewState, setViewState] = useState("IDLE");
  const [downloadState, setDownloadState] = useState("IDLE");
  const [viewErrorMessage, setViewErrorMessage] = useState("");
  const [downloadErrorMessage, setDownloadErrorMessage] = useState("");

  // Operation Feedback & Confirmation Dialogs
  const [operationSuccess, setOperationSuccess] = useState(null);
  const [operationError, setOperationError] = useState("");

  const [confirmRevokeModal, setConfirmRevokeModal] = useState({
    isOpen: false,
    permissionType: "", // "VIEW" or "DOWNLOAD"
    officer: null,
    evidence: null,
    caseId: "",
    isSubmitting: false,
  });

  // Query permissions from backend on selection change
  const refreshPermissions = useCallback(
    async (evId, officerWallet) => {
      if (!evId || !officerWallet) {
        setViewState("IDLE");
        setDownloadState("IDLE");
        return;
      }

      setViewState("CHECKING");
      setDownloadState("CHECKING");
      setViewErrorMessage("");
      setDownloadErrorMessage("");
      setOperationError("");

      // Query VIEW permission independently
      checkViewAccessAPI(evId, officerWallet)
        .then((res) => {
          setViewState(res.canView ? "ALLOWED" : "NOT_ALLOWED");
        })
        .catch((err) => {
          console.warn("View access query error:", err);
          if (
            err.code === "EVIDENCE_NOT_ON_CHAIN" ||
            err.onChain === false ||
            (err.message && err.message.toLowerCase().includes("not anchored")) ||
            (err.message && err.message.toLowerCase().includes("does not exist"))
          ) {
            setViewState("UNREGISTERED");
            setViewErrorMessage(
              "This evidence record is not anchored on the active blockchain ledger."
            );
          } else if (
            err.name === "TypeError" ||
            (err.message && err.message.toLowerCase().includes("network")) ||
            (err.message && err.message.toLowerCase().includes("failed to fetch"))
          ) {
            setViewState("NETWORK_ERROR");
            setViewErrorMessage(
              "Network communication error: unable to reach backend service."
            );
          } else {
            setViewState("ERROR");
            setViewErrorMessage(
              err.message || "Failed to retrieve on-chain view authorization."
            );
          }
        });

      // Query DOWNLOAD permission independently
      checkDownloadAccessAPI(evId, officerWallet)
        .then((res) => {
          setDownloadState(res.canDownload ? "ALLOWED" : "NOT_ALLOWED");
        })
        .catch((err) => {
          console.warn("Download access query error:", err);
          if (
            err.code === "EVIDENCE_NOT_ON_CHAIN" ||
            err.onChain === false ||
            (err.message && err.message.toLowerCase().includes("not anchored")) ||
            (err.message && err.message.toLowerCase().includes("does not exist"))
          ) {
            setDownloadState("UNREGISTERED");
            setDownloadErrorMessage(
              "This evidence record is not anchored on the active blockchain ledger."
            );
          } else if (
            err.name === "TypeError" ||
            (err.message && err.message.toLowerCase().includes("network")) ||
            (err.message && err.message.toLowerCase().includes("failed to fetch"))
          ) {
            setDownloadState("NETWORK_ERROR");
            setDownloadErrorMessage(
              "Network communication error: unable to reach backend service."
            );
          } else {
            setDownloadState("ERROR");
            setDownloadErrorMessage(
              err.message || "Failed to retrieve on-chain download authorization."
            );
          }
        });
    },
    []
  );

  // Trigger permission refresh when evidence + officer are both selected
  useEffect(() => {
    if (selectedEvidenceId && selectedOfficer?.walletAddress) {
      refreshPermissions(selectedEvidenceId, selectedOfficer.walletAddress);
    } else {
      setViewState("IDLE");
      setDownloadState("IDLE");
    }
  }, [selectedEvidenceId, selectedOfficer, refreshPermissions]);

  // ------------------------------------------------------------
  // SELECTION HANDLERS WITH STRICT STATE INVALIDATION
  // ------------------------------------------------------------
  const handleSelectCase = (cid) => {
    setSelectedCaseId(cid);
    // Clear evidence and permission states
    setSelectedEvidenceId("");
    setEvidenceSearchQuery("");
    setSelectedOfficer(null);
    setViewState("IDLE");
    setDownloadState("IDLE");
    setOperationSuccess(null);
    setOperationError("");
  };

  const handleResetCase = () => {
    setSelectedCaseId("");
    setCaseSearchQuery("");
    setSelectedEvidenceId("");
    setEvidenceSearchQuery("");
    setSelectedOfficer(null);
    setViewState("IDLE");
    setDownloadState("IDLE");
    setOperationSuccess(null);
    setOperationError("");
  };

  const handleSelectEvidence = (evId) => {
    setSelectedEvidenceId(evId);
    setSelectedOfficer(null);
    setViewState("IDLE");
    setDownloadState("IDLE");
    setOperationSuccess(null);
    setOperationError("");
  };

  const handleResetEvidence = () => {
    setSelectedEvidenceId("");
    setEvidenceSearchQuery("");
    setSelectedOfficer(null);
    setViewState("IDLE");
    setDownloadState("IDLE");
    setOperationSuccess(null);
    setOperationError("");
  };

  const handleSelectOfficer = (officer) => {
    setSelectedOfficer(officer);
    setOperationSuccess(null);
    setOperationError("");
  };

  const handleResetOfficer = () => {
    setSelectedOfficer(null);
    setViewState("IDLE");
    setDownloadState("IDLE");
    setOperationSuccess(null);
    setOperationError("");
  };

  // ------------------------------------------------------------
  // PERMISSION GRANT & REVOCATION ACTIONS
  // ------------------------------------------------------------
  const handleTriggerGrant = async (permissionType) => {
    if (!isCallerHOD) {
      alert(
        "HOD Authority Required: Only the Head of Department is authorized to modify evidence access permissions."
      );
      return;
    }
    if (!selectedEvidenceId || !selectedOfficer?.walletAddress) return;

    setOperationSuccess(null);
    setOperationError("");

    if (permissionType === "VIEW") {
      setViewState("UPDATING");
      try {
        const res = await onGrantViewAccess(
          selectedEvidenceId,
          selectedOfficer.walletAddress,
          selectedCaseId,
          selectedOfficer.name
        );
        setViewState("ALLOWED");
        setOperationSuccess({
          message: "View access granted successfully.",
          permissionType: "VIEW",
          evidenceId: selectedEvidenceId,
          officerName: selectedOfficer.name,
          txHash: res?.transactionHash,
          blockNumber: res?.blockNumber,
        });
      } catch (err) {
        setOperationError(err.message || "Failed to grant View access on blockchain.");
        // Refresh actual ledger state
        refreshPermissions(selectedEvidenceId, selectedOfficer.walletAddress);
      }
    } else if (permissionType === "DOWNLOAD") {
      setDownloadState("UPDATING");
      try {
        const res = await onGrantDownloadAccess(
          selectedEvidenceId,
          selectedOfficer.walletAddress,
          selectedCaseId,
          selectedOfficer.name
        );
        setDownloadState("ALLOWED");
        setOperationSuccess({
          message: "Download access granted successfully.",
          permissionType: "DOWNLOAD",
          evidenceId: selectedEvidenceId,
          officerName: selectedOfficer.name,
          txHash: res?.transactionHash,
          blockNumber: res?.blockNumber,
        });
      } catch (err) {
        setOperationError(err.message || "Failed to grant Download access on blockchain.");
        refreshPermissions(selectedEvidenceId, selectedOfficer.walletAddress);
      }
    }
  };

  const handleOpenRevokeModal = (permissionType) => {
    if (!isCallerHOD) {
      alert(
        "HOD Authority Required: Only the Head of Department is authorized to revoke evidence access permissions."
      );
      return;
    }
    setConfirmRevokeModal({
      isOpen: true,
      permissionType,
      officer: selectedOfficer,
      evidence: activeEvidence,
      caseId: selectedCaseId,
      isSubmitting: false,
    });
  };

  const handleConfirmRevoke = async () => {
    const { permissionType, officer, evidence, caseId } = confirmRevokeModal;
    if (!officer?.walletAddress || !evidence?.evidenceId) return;

    setConfirmRevokeModal((prev) => ({ ...prev, isSubmitting: true }));
    setOperationSuccess(null);
    setOperationError("");

    if (permissionType === "VIEW") {
      setViewState("UPDATING");
      try {
        const res = await onRevokeViewAccess(
          evidence.evidenceId,
          officer.walletAddress,
          caseId,
          officer.name
        );
        setViewState("NOT_ALLOWED");
        setConfirmRevokeModal({ isOpen: false, permissionType: "", officer: null, evidence: null, caseId: "", isSubmitting: false });
        setOperationSuccess({
          message: "View access revoked successfully.",
          permissionType: "VIEW",
          evidenceId: evidence.evidenceId,
          officerName: officer.name,
          txHash: res?.transactionHash,
          blockNumber: res?.blockNumber,
        });
      } catch (err) {
        setConfirmRevokeModal({ isOpen: false, permissionType: "", officer: null, evidence: null, caseId: "", isSubmitting: false });
        setOperationError(err.message || "Failed to revoke View access on blockchain.");
        refreshPermissions(evidence.evidenceId, officer.walletAddress);
      }
    } else if (permissionType === "DOWNLOAD") {
      setDownloadState("UPDATING");
      try {
        const res = await onRevokeDownloadAccess(
          evidence.evidenceId,
          officer.walletAddress,
          caseId,
          officer.name
        );
        setDownloadState("NOT_ALLOWED");
        setConfirmRevokeModal({ isOpen: false, permissionType: "", officer: null, evidence: null, caseId: "", isSubmitting: false });
        setOperationSuccess({
          message: "Download access revoked successfully.",
          permissionType: "DOWNLOAD",
          evidenceId: evidence.evidenceId,
          officerName: officer.name,
          txHash: res?.transactionHash,
          blockNumber: res?.blockNumber,
        });
      } catch (err) {
        setConfirmRevokeModal({ isOpen: false, permissionType: "", officer: null, evidence: null, caseId: "", isSubmitting: false });
        setOperationError(err.message || "Failed to revoke Download access on blockchain.");
        refreshPermissions(evidence.evidenceId, officer.walletAddress);
      }
    }
  };

  const handleCancelRevoke = () => {
    setConfirmRevokeModal({
      isOpen: false,
      permissionType: "",
      officer: null,
      evidence: null,
      caseId: "",
      isSubmitting: false,
    });
  };

  // ------------------------------------------------------------
  // HELPER: RENDER PERMISSION STATUS BADGE
  // ------------------------------------------------------------
  const renderPermissionBadge = (state) => {
    switch (state) {
      case "ALLOWED":
        return (
          <span className="gov-status-pill status-allowed">
            <CheckCircleIcon size={14} />
            <span>Allowed</span>
          </span>
        );
      case "NOT_ALLOWED":
        return (
          <span className="gov-status-pill status-not-allowed">
            <LockIcon size={13} />
            <span>Not allowed</span>
          </span>
        );
      case "CHECKING":
        return (
          <span className="gov-status-pill status-checking">
            <RefreshCwIcon size={13} className="spin-inline" />
            <span>Checking</span>
          </span>
        );
      case "UPDATING":
        return (
          <span className="gov-status-pill status-updating">
            <RefreshCwIcon size={13} className="spin-inline" />
            <span>Updating</span>
          </span>
        );
      case "UNREGISTERED":
        return (
          <span
            className="gov-status-pill status-unregistered"
            title="This evidence record is not anchored on the active blockchain ledger."
          >
            <AlertTriangleIcon size={13} />
            <span>Not anchored on ledger</span>
          </span>
        );
      case "NETWORK_ERROR":
        return (
          <span
            className="gov-status-pill status-network-error"
            title="Network communication failure to backend service."
          >
            <AlertTriangleIcon size={13} />
            <span>Network error</span>
          </span>
        );
      case "ERROR":
        return (
          <span
            className="gov-status-pill status-error"
            title="Smart contract ledger query failed"
          >
            <AlertTriangleIcon size={13} />
            <span>Query failed</span>
          </span>
        );
      case "IDLE":
      default:
        return (
          <span className="gov-status-pill status-idle">
            <span>Awaiting selection</span>
          </span>
        );
    }
  };

  return (
    <div className="view-container access-management-view" data-testid="access-management-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
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
            <span>EVIDENCECHAIN SECURE ACCESS CONTROL REGISTRY</span>
          </div>
        </div>
      )}

      {/* 1. Page Header Block */}
      <div className="page-header-block access-header-clean" style={{ marginBottom: "18px" }}>
        <div>
          <h1 className="page-title">Evidence Access Control &amp; Permissions</h1>
          <p className="page-context-desc">
            Govern investigator permissions for case evidence dossiers. Cryptographically grant or revoke View and Download rights across verified personnel.
          </p>
        </div>
      </div>

      {/* 2. Authority Status Strip */}
      <div className={`authority-banner doc-panel ${isCallerHOD ? "hod-active" : "hod-restricted"}`}>
        <div className="authority-banner-content">
          <div className="authority-badge-row">
            <span className={`gov-authority-pill badge-clean ${isCallerHOD ? "pill-hod" : "pill-inquiry"}`}>
              {isCallerHOD
                ? "AUTHORITY: HEAD OF DEPARTMENT (HOD COMMAND PRIVILEGES ACTIVE)"
                : "READ-ONLY INQUIRY MODE (NON-HOD SESSION)"}
            </span>
          </div>
          <div className="authority-session-text">
            Active Session: <strong>{currentUser?.name || "Rahul Sharma"}</strong>{" "}
            ({currentUser?.role || currentUser?.designation || "Senior Forensic Officer"})
            {!isCallerHOD && (
              <span className="authority-warning-note">
                {" "}• Grant and revoke operations require Head of Department authority.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Backend Disconnection Banner */}
      {!backendConnected && (
        <div className="banner-alert alert-error" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Service Disconnected:</strong> Cannot query or update evidence access rights.
          </div>
        </div>
      )}

      {/* Global Operation Error Alert */}
      {operationError && (
        <div className="banner-alert alert-error" style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div>
              <strong>Access Operation Failed:</strong> {operationError}
            </div>
            <button
              type="button"
              className="btn-subtle-close"
              onClick={() => setOperationError("")}
              title="Dismiss error"
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Confirmed Operation Success Banner */}
      {operationSuccess && (
        <div className="banner-alert alert-success" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", width: "100%" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircleIcon size={18} />
                <strong style={{ fontSize: "14px" }}>{operationSuccess.message}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Target Officer: <strong>{operationSuccess.officerName}</strong> • Evidence ID: <code>{operationSuccess.evidenceId}</code>
                {operationSuccess.blockNumber && (
                  <span> • Anchored in Ethereum Block #{operationSuccess.blockNumber}</span>
                )}
              </div>
            </div>
            {onNavigateHistory && (
              <button
                type="button"
                className="btn-portal-history-link"
                onClick={() => onNavigateHistory(operationSuccess.evidenceId)}
                title="Inspect non-repudiable audit log for this evidence record"
              >
                <span>View in Access History</span>
                <ArrowRightIcon size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          WORKFLOW CONTAINER: 4 PROGRESSIVE STEPS
          ============================================================ */}
      <div className="access-workflow-container">
        {/* --------------------------------------------------------
            STEP 1: SELECT CASE
            -------------------------------------------------------- */}
        <section className={`workflow-step-card ${selectedCaseId ? "step-completed" : "step-active"}`}>
          <div className="step-card-header">
            <div className="step-number-badge">01</div>
            <div>
              <h2 className="step-title">Select Case</h2>
              <p className="step-subtitle">Identify the judicial case docket containing the target evidence.</p>
            </div>
          </div>

          {!selectedCaseId ? (
            <div className="step-body-content">
              {/* Search Bar */}
              <div className="search-field-wrapper">
                <SearchIcon size={16} className="search-field-icon" />
                <input
                  type="text"
                  className="gov-search-input"
                  placeholder="Search by case number or case name/description..."
                  value={caseSearchQuery}
                  onChange={(e) => setCaseSearchQuery(e.target.value)}
                  id="case-search-input"
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
                  <span>No cases match &ldquo;{caseSearchQuery}&rdquo;. Verify the case ID or docket number.</span>
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
            /* Selected Case Summary View */
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
            STEP 2: SELECT EVIDENCE
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
              <h2 className="step-title">Select Evidence</h2>
              <p className="step-subtitle">Choose the registered evidence artifact within the selected case.</p>
            </div>
          </div>

          {!selectedCaseId ? (
            <div className="step-locked-placeholder">
              <LockIcon size={20} />
              <span>Select a case in Step 1 to load its registered evidence records.</span>
            </div>
          ) : !selectedEvidenceId ? (
            <div className="step-body-content">
              {/* Evidence Search */}
              <div className="search-field-wrapper">
                <SearchIcon size={16} className="search-field-icon" />
                <input
                  type="text"
                  className="gov-search-input"
                  placeholder="Search by evidence title, filename, or ID..."
                  value={evidenceSearchQuery}
                  onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                  id="evidence-search-input"
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

              {/* Evidence Results Grid */}
              <div className="evidence-results-grid">
                {filteredCaseEvidence.length === 0 ? (
                  <div className="empty-results-box">
                    <AlertTriangleIcon size={20} />
                    <span>
                      {caseEvidenceRecords.length === 0
                        ? `No evidence records registered under case ${selectedCaseId}.`
                        : `No evidence matches "${evidenceSearchQuery}".`}
                    </span>
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
                          <span
                            className="ledger-badge unanchored"
                            title="Record exists in local database but is not anchored on active blockchain ledger"
                          >
                            Not Anchored
                          </span>
                        ) : ev.isOnChain === true ? (
                          <span
                            className="ledger-badge anchored"
                            title="Cryptographically anchored on active blockchain ledger"
                          >
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
                      {ev.description && (
                        <p className="evidence-card-desc">{ev.description}</p>
                      )}
                      <div className="evidence-card-footer">
                        <span className="evidence-card-action">Select Evidence &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected Evidence Summary View */
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
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                {onNavigateHistory && (
                  <button
                    type="button"
                    className="btn-portal-history-link"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                    onClick={() => onNavigateHistory(activeEvidence?.evidenceId)}
                    title="Inspect non-repudiable audit log for this evidence record"
                  >
                    <span>View in Access History</span>
                    <ArrowRightIcon size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn-change-selection"
                  onClick={handleResetEvidence}
                  title="Change active evidence"
                >
                  Change Evidence
                </button>
              </div>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------
            STEP 3: SELECT OFFICER (EMPLOYEE DIRECTORY)
            -------------------------------------------------------- */}
        <section
          className={`workflow-step-card ${
            !selectedEvidenceId
              ? "step-disabled"
              : selectedOfficer
              ? "step-completed"
              : "step-active"
          }`}
        >
          <div className="step-card-header">
            <div className="step-number-badge">03</div>
            <div>
              <h2 className="step-title">Select Officer</h2>
              <p className="step-subtitle">Choose an authorized officer from the departmental directory.</p>
            </div>
          </div>

          {!selectedEvidenceId ? (
            <div className="step-locked-placeholder">
              <LockIcon size={20} />
              <span>Select an evidence record in Step 2 to proceed to officer directory.</span>
            </div>
          ) : !selectedOfficer ? (
            <div className="step-body-content">
              {/* Officer Search */}
              <div className="search-field-wrapper">
                <SearchIcon size={16} className="search-field-icon" />
                <input
                  type="text"
                  className="gov-search-input"
                  placeholder="Search by officer name, designation, Employee ID, or department..."
                  value={officerSearchQuery}
                  onChange={(e) => setOfficerSearchQuery(e.target.value)}
                  id="officer-search-input"
                />
                {officerSearchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setOfficerSearchQuery("")}
                    title="Clear search"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {officersLoading ? (
                <div className="loading-state-box">
                  <RefreshCwIcon size={20} className="spin-inline" />
                  <span>Loading official departmental directory...</span>
                </div>
              ) : officersError ? (
                <div className="empty-results-box">
                  <AlertTriangleIcon size={20} />
                  <span>{officersError}</span>
                </div>
              ) : (
                <div className="officer-results-grid">
                  {filteredOfficers.length === 0 ? (
                    <div className="empty-results-box">
                      <AlertTriangleIcon size={20} />
                      <span>No officers found matching &ldquo;{officerSearchQuery}&rdquo;.</span>
                    </div>
                  ) : (
                    filteredOfficers.map((off) => (
                      <div
                        key={off.walletAddress || off.id}
                        className="officer-selection-card"
                        onClick={() => handleSelectOfficer(off)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") handleSelectOfficer(off);
                        }}
                      >
                        <div className="officer-card-header">
                          <div className="officer-avatar-circle">
                            {off.name
                              ? off.name
                                  .split(" ")
                                  .filter(Boolean)
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()
                              : "OF"}
                          </div>
                          <div className="officer-header-meta">
                            <span className="officer-emp-tag">{off.employeeId || "OFF-VERIFIED"}</span>
                            {off.isHOD && <span className="officer-hod-pill">HOD</span>}
                          </div>
                        </div>

                        <div className="officer-name-text">{off.name}</div>
                        <div className="officer-designation-text">
                          {off.designation || off.role || "Forensic Investigator"}
                        </div>
                        <div className="officer-department-text">
                          {off.department || "Cyber Crime Investigation Unit"}
                        </div>

                        <div className="officer-card-bottom">
                          <span className="verified-badge">
                            <ShieldCheckIcon size={13} />
                            <span>Verified Identity</span>
                          </span>
                          <span className="officer-card-action">Select Officer &rarr;</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Selected Officer Summary View */
            <div className="selected-summary-banner officer-summary-banner">
              <div className="selected-summary-details">
                <span className="summary-section-label">SELECTED OFFICER</span>
                <div className="summary-main-ref">{selectedOfficer?.name}</div>
                <div className="summary-subtext">
                  Designation: <strong>{selectedOfficer?.designation || selectedOfficer?.role}</strong> • Employee ID: <strong>{selectedOfficer?.employeeId}</strong> • Department: <strong>{selectedOfficer?.department}</strong>
                </div>

                {/* Collapsible Technical Details Disclosure */}
                <div className="tech-details-disclosure">
                  <button
                    type="button"
                    className="btn-disclosure-toggle"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    aria-expanded={showTechDetails}
                  >
                    <span>{showTechDetails ? "▼ Hide Technical Details" : "▶ Technical Details (Audit Disclosure)"}</span>
                  </button>
                  {showTechDetails && (
                    <div className="tech-details-content">
                      <div className="tech-detail-row">
                        <span className="tech-detail-label">Verified Blockchain Wallet:</span>
                        <code className="tech-detail-code">{selectedOfficer?.walletAddress}</code>
                      </div>
                      <div className="tech-detail-row">
                        <span className="tech-detail-label">Identity Attestation:</span>
                        <span className="tech-detail-val">Cryptographically verified against State Directorate Database</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn-change-selection"
                onClick={handleResetOfficer}
                title="Change active officer"
              >
                Change Officer
              </button>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------
            STEP 4: ACCESS PERMISSIONS MANAGEMENT
            -------------------------------------------------------- */}
        <section
          className={`workflow-step-card ${
            !selectedOfficer ? "step-disabled" : "step-active"
          }`}
        >
          <div className="step-card-header">
            <div className="step-number-badge">04</div>
            <div>
              <h2 className="step-title">Access Permissions</h2>
              <p className="step-subtitle">Configure independent inspection and extraction authorizations.</p>
            </div>
          </div>

          <div className="step-body-content permissions-body-content">
            {/* Context Summary Bar */}
            <div className="permission-context-bar">
              <div className="context-item">
                <span className="context-label">Case:</span>
                <span className="context-value">{selectedCaseId || "None selected"}</span>
              </div>
              <span className="context-sep">&bull;</span>
              <div className="context-item">
                <span className="context-label">Evidence:</span>
                <span className="context-value">
                  {activeEvidence ? `${activeEvidence.title} (${activeEvidence.evidenceId})` : "None selected"}
                </span>
              </div>
              <span className="context-sep">&bull;</span>
              <div className="context-item">
                <span className="context-label">Officer:</span>
                <span className="context-value">
                  {selectedOfficer ? `${selectedOfficer.name} [${selectedOfficer.employeeId}]` : "None selected"}
                </span>
              </div>
            </div>

            {/* Two Independent Permission Rows */}
            <div className="permissions-rows-list">
              {/* --------------------------------------------------
                  PERMISSION A: VIEW EVIDENCE
                  -------------------------------------------------- */}
              <div className="permission-row-card doc-panel">
                <h2 className="doc-panel-title" style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}>
                  VIEW Access
                </h2>
                <div className="permission-row-left">
                  <div className="permission-icon-box perm-icon-view">
                    <EyeIcon size={22} />
                  </div>
                  <div className="permission-text-block">
                    <h3 className="permission-item-title">View Evidence</h3>
                    <p className="permission-item-desc">
                      Allows the officer to open and inspect evidence within EvidenceChain.
                    </p>
                    {viewErrorMessage && (
                      <div className="permission-inline-error">
                        <AlertTriangleIcon size={12} />
                        <span>{viewErrorMessage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="permission-row-right">
                  <div className="permission-status-zone">
                    {renderPermissionBadge(viewState)}
                  </div>

                  <div className="permission-action-zone">
                    {viewState === "ALLOWED" ? (
                      <button
                        type="button"
                        className="btn-permission-action btn-perm-revoke"
                        onClick={() => handleOpenRevokeModal("VIEW")}
                        disabled={!isCallerHOD || viewState === "UPDATING"}
                        title={
                          !isCallerHOD
                            ? "HOD Authority Required: Only the Head of Department is authorized to modify access permissions."
                            : "Revoke in-browser view authorization"
                        }
                      >
                        Revoke access
                      </button>
                    ) : viewState === "NOT_ALLOWED" ? (
                      <button
                        type="button"
                        className="btn-permission-action btn-perm-grant"
                        onClick={() => handleTriggerGrant("VIEW")}
                        disabled={!isCallerHOD || viewState === "UPDATING"}
                        title={
                          !isCallerHOD
                            ? "HOD Authority Required: Only the Head of Department is authorized to modify access permissions."
                            : "Grant in-browser view authorization"
                        }
                      >
                        Grant access
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-permission-action btn-perm-disabled"
                        disabled
                        title={
                          !isCallerHOD
                            ? "HOD Authority Required: Only the Head of Department is authorized to modify access permissions."
                            : !selectedOfficer
                            ? "Select an officer in Step 3 to configure permissions."
                            : viewState === "UPDATING"
                            ? "Updating authorization on blockchain..."
                            : viewState === "CHECKING"
                            ? "Checking authorization on blockchain..."
                            : viewState === "UNREGISTERED"
                            ? "Permission modification disabled: evidence is not anchored on ledger."
                            : viewState === "NETWORK_ERROR"
                            ? "Network communication error: please verify connection and retry."
                            : viewState === "ERROR"
                            ? "Smart contract query failed. Check blockchain connection."
                            : "Unavailable"
                        }
                      >
                        {viewState === "UPDATING"
                          ? "Updating..."
                          : viewState === "CHECKING"
                          ? "Checking..."
                          : viewState === "UNREGISTERED"
                          ? "Not Anchored"
                          : viewState === "NETWORK_ERROR"
                          ? "Network Error"
                          : viewState === "ERROR"
                          ? "Query Failed"
                          : "Unavailable"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------
                  PERMISSION B: DOWNLOAD EVIDENCE
                  -------------------------------------------------- */}
              <div className="permission-row-card doc-panel">
                <h2 className="doc-panel-title" style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}>
                  DOWNLOAD Access
                </h2>
                <div className="permission-row-left">
                  <div className="permission-icon-box perm-icon-download">
                    <DownloadIcon size={22} />
                  </div>
                  <div className="permission-text-block">
                    <h3 className="permission-item-title">Download Evidence</h3>
                    <p className="permission-item-desc">
                      Allows the officer to save an authorized copy of the evidence to their device.
                    </p>
                    {downloadErrorMessage && (
                      <div className="permission-inline-error">
                        <AlertTriangleIcon size={12} />
                        <span>{downloadErrorMessage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="permission-row-right">
                  <div className="permission-status-zone">
                    {renderPermissionBadge(downloadState)}
                  </div>

                  <div className="permission-action-zone">
                    {downloadState === "ALLOWED" ? (
                      <button
                        type="button"
                        className="btn-permission-action btn-perm-revoke"
                        onClick={() => handleOpenRevokeModal("DOWNLOAD")}
                        disabled={!isCallerHOD || downloadState === "UPDATING"}
                        title={
                          !isCallerHOD
                            ? "HOD Authority Required: Only the Head of Department is authorized to modify access permissions."
                            : "Revoke binary file download authorization"
                        }
                      >
                        Revoke access
                      </button>
                    ) : downloadState === "NOT_ALLOWED" ? (
                      <button
                        type="button"
                        className="btn-permission-action btn-perm-grant"
                        onClick={() => handleTriggerGrant("DOWNLOAD")}
                        disabled={!isCallerHOD || downloadState === "UPDATING"}
                        title={
                          !isCallerHOD
                            ? "HOD Authority Required: Only the Head of Department is authorized to modify access permissions."
                            : "Grant binary file download authorization"
                        }
                      >
                        Grant access
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-permission-action btn-perm-disabled"
                        disabled
                        title={
                          !isCallerHOD
                            ? "HOD Authority Required: Only the Head of Department is authorized to modify access permissions."
                            : !selectedOfficer
                            ? "Select an officer in Step 3 to configure permissions."
                            : downloadState === "UPDATING"
                            ? "Updating authorization on blockchain..."
                            : downloadState === "CHECKING"
                            ? "Checking authorization on blockchain..."
                            : downloadState === "UNREGISTERED"
                            ? "Permission modification disabled: evidence is not anchored on ledger."
                            : downloadState === "NETWORK_ERROR"
                            ? "Network communication error: please verify connection and retry."
                            : downloadState === "ERROR"
                            ? "Smart contract query failed. Check blockchain connection."
                            : "Unavailable"
                        }
                      >
                        {downloadState === "UPDATING"
                          ? "Updating..."
                          : downloadState === "CHECKING"
                          ? "Checking..."
                          : downloadState === "UNREGISTERED"
                          ? "Not Anchored"
                          : downloadState === "NETWORK_ERROR"
                          ? "Network Error"
                          : downloadState === "ERROR"
                          ? "Query Failed"
                          : "Unavailable"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Refresh Status Bar */}
            <div className="permissions-refresh-row">
              <button
                type="button"
                className="btn-subtle-refresh"
                onClick={() => {
                  if (selectedEvidenceId && selectedOfficer?.walletAddress) {
                    refreshPermissions(selectedEvidenceId, selectedOfficer.walletAddress);
                  }
                }}
                disabled={!selectedOfficer || viewState === "CHECKING" || downloadState === "CHECKING"}
              >
                <RefreshCwIcon size={13} className={viewState === "CHECKING" ? "spin-inline" : ""} />
                <span>Refresh On-Chain Status</span>
              </button>
              <span className="permissions-audit-note">
                All permission changes are immutably signed and committed to the blockchain.
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ============================================================
          SAFE REVOCATION CONFIRMATION MODAL
          ============================================================ */}
      {confirmRevokeModal.isOpen && (
        <div className="modal-overlay-flat" onClick={handleCancelRevoke}>
          <div
            className="modal-dialog-flat gov-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header-flat">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="modal-danger-badge">
                  <AlertTriangleIcon size={20} />
                </div>
                <div>
                  <h3 className="modal-title-flat">
                    {confirmRevokeModal.permissionType === "DOWNLOAD"
                      ? "Revoke download access?"
                      : "Revoke view access?"}
                  </h3>
                  <div className="modal-subtitle-clean">
                    Formal Permission Revocation Confirmation
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-subtle-mono"
                onClick={handleCancelRevoke}
                title="Cancel"
              >
                ESC
              </button>
            </div>

            <div className="modal-body-flat">
              <p className="modal-explanation-text">
                {confirmRevokeModal.permissionType === "DOWNLOAD"
                  ? `${confirmRevokeModal.officer?.name} will no longer be able to download this evidence through EvidenceChain.`
                  : `${confirmRevokeModal.officer?.name} will no longer be able to open or view this evidence within EvidenceChain.`}
              </p>

              {/* Specific Record Metadata Identification */}
              <div className="modal-metadata-card">
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Affected Officer:</span>
                  <span className="modal-meta-value">
                    <strong>{confirmRevokeModal.officer?.name}</strong> • {confirmRevokeModal.officer?.designation || confirmRevokeModal.officer?.role} [ID: {confirmRevokeModal.officer?.employeeId}]
                  </span>
                </div>
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Target Evidence:</span>
                  <span className="modal-meta-value">
                    <strong>{confirmRevokeModal.evidence?.title}</strong> [ID: {confirmRevokeModal.evidence?.evidenceId}]
                  </span>
                </div>
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Associated Case:</span>
                  <span className="modal-meta-value">{confirmRevokeModal.caseId}</span>
                </div>
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Permission to Revoke:</span>
                  <span className="modal-meta-value" style={{ color: "var(--red-restrained)", fontWeight: 700 }}>
                    {confirmRevokeModal.permissionType === "DOWNLOAD" ? "Download Evidence" : "View Evidence"}
                  </span>
                </div>
              </div>

              {/* Irreversibility & Local Copy Warning */}
              <div className="modal-warning-callout">
                <AlertTriangleIcon size={16} />
                <span>
                  <strong>Important:</strong> Revoking access does not delete copies that may already have been downloaded.
                </span>
              </div>
            </div>

            <div className="modal-footer-flat">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelRevoke}
                disabled={confirmRevokeModal.isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmRevoke}
                disabled={confirmRevokeModal.isSubmitting}
              >
                {confirmRevokeModal.isSubmitting ? (
                  <>
                    <RefreshCwIcon size={14} className="spin-inline" />
                    <span>Revoking Access...</span>
                  </>
                ) : (
                  <span>Revoke access</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
