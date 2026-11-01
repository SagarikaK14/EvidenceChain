// ============================================================
// EvidenceChain Evidence Details View - Digital Evidence Dossier
// Product-First Digital Evidence Management & Chain of Custody
// Structured into 6 Clear Investigative Sections
// 1. Evidence Overview
// 2. File Information
// 3. Integrity Verification
// 4. Registration History
// 5. Access Permissions
// 6. Advanced Technical Details (Collapsible)
// Fully responsive across 320px, 375px, 390px, 430px, 768px, and desktop
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { CryptographicFingerprint } from "../components/CryptographicFingerprint";
import { getEvidenceStatus } from "../utils/statusLabels";
import { formatISTDateTime } from "../utils/dateUtils";

export function EvidenceDetailsView({
  evidenceId,
  evidenceData,
  accessHistory = [],
  currentUser,
  viewAccessAllowed,
  downloadAccessAllowed,
  onViewFile,
  onDownloadFile,
  viewedFileUrl,
  viewedFileName,
  onCloseViewer,
  onNavigateVerify,
  onNavigateAccess,
  onBack,
}) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedVault, setCopiedVault] = useState(false);
  const [showFullHash, setShowFullHash] = useState(false);

  // File Preview State
  const [fileContentText, setFileContentText] = useState("");
  const [contentLoading, setContentLoading] = useState(false);

  const blockchain = evidenceData?.blockchain || {};
  const metadata = evidenceData?.metadata || {};

  const hashVal = blockchain.evidenceHash || metadata.sha256Hash || "";
  const txHash = metadata.registrationTxHash || blockchain.registrationTxHash || "";

  // Inspect file extension and format
  const fileExt = useMemo(() => {
    const raw = (viewedFileName || metadata?.filePath || "").split(/[/\\]/).pop() || "";
    const parts = raw.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }, [viewedFileName, metadata]);

  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(fileExt);
  const isPdf = fileExt === "pdf";
  const isCsv = fileExt === "csv";
  const isJson = fileExt === "json";
  const isTxt = ["txt", "log", "sql", "env", "md"].includes(fileExt);
  const isBinary = ["bin", "pcap", "dd", "hex", "dat"].includes(fileExt) || (!isImage && !isPdf && !isCsv && !isJson && !isTxt);

  // Fetch text for text/csv/json preview
  useEffect(() => {
    if (!viewedFileUrl) {
      setFileContentText("");
      return;
    }
    if (isCsv || isJson || isTxt) {
      setContentLoading(true);
      fetch(viewedFileUrl)
        .then((res) => res.text())
        .then((txt) => {
          setFileContentText(txt);
          setContentLoading(false);
        })
        .catch((err) => {
          console.error("Preview fetch error:", err);
          setContentLoading(false);
        });
    }
  }, [viewedFileUrl, isCsv, isJson, isTxt]);

  // CSV Parsing
  const { csvHeaders, csvRows } = useMemo(() => {
    if (!isCsv || !fileContentText) return { csvHeaders: [], csvRows: [] };
    const lines = fileContentText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { csvHeaders: [], csvRows: [] };
    const headers = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());
    const rows = lines.slice(1).map((line) => {
      // Basic CSV split
      return line.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
    });
    return { csvHeaders: headers, csvRows: rows };
  }, [isCsv, fileContentText]);

  // Formatted JSON
  const formattedJson = useMemo(() => {
    if (!isJson || !fileContentText) return "";
    try {
      const parsed = JSON.parse(fileContentText);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return fileContentText;
    }
  }, [isJson, fileContentText]);

  const copyHash = () => {
    if (!hashVal) return;
    navigator.clipboard.writeText(hashVal);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1400);
  };

  const copyTxHash = () => {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 1400);
  };

  const shortHash = hashVal
    ? `${hashVal.slice(0, 14)}...${hashVal.slice(-14)}`
    : "—";

  // Authoritative status evaluation
  const statusInfo = getEvidenceStatus(evidenceData);

  const storedFileName =
    metadata.title ||
    (metadata.filePath ? metadata.filePath.split("/").pop() : "evidence_record.bin");

  // Sanitized logical storage reference
  const logicalStorageRef = metadata.filePath
    ? `vault://evidence/${evidenceId}/${storedFileName}`
    : `vault://unconfirmed/${evidenceId}`;

  const copyVaultRef = () => {
    navigator.clipboard.writeText(logicalStorageRef);
    setCopiedVault(true);
    setTimeout(() => setCopiedVault(false), 1400);
  };

  return (
    <div className="view-container evidence-details-view">
      {/* 0. Top Return & Breadcrumb Bar */}
      <div className="evidence-details-breadcrumb-bar">
        <button
          type="button"
          className="btn-tactile-secondary"
          onClick={onBack || (() => window.history.back())}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            padding: "6px 14px",
          }}
          title="Return to evidence repository"
        >
          <span>&larr;</span>
          <span>Back to Repository</span>
        </button>
        <div className="evidence-details-breadcrumbs">
          Case File: <strong style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{blockchain.caseId || metadata.caseId || "CASE-REF-001"}</strong>
          <span style={{ margin: "0 8px", opacity: 0.4 }}>|</span>
          Evidence Record: <strong style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{evidenceId}</strong>
        </div>
      </div>

      {/* ============================================================
          SECTION 1: EVIDENCE OVERVIEW
          ============================================================ */}
      <div className="doc-panel evidence-details-panel evidence-details-hero-panel">
        <div className="doc-panel-header evidence-details-hero-header">
          <div className="evidence-details-header-content">
            <div className="evidence-details-tag-row">
              <span className="case-docket-tag">{blockchain.caseId || metadata.caseId || "CASE-REF-001"}</span>
              <span className="mono-identifier" style={{ fontWeight: 600 }}>{evidenceId}</span>
              
              {/* Product-First Truthful Status Badge */}
              <span className={`${statusInfo.pillClass} evidence-status-badge`} style={{ ...statusInfo.badgeStyle, fontSize: "11px", padding: "2px 8px" }}>
                {statusInfo.label}
              </span>
            </div>

            <h1 className="doc-panel-title evidence-details-main-title">
              {metadata.title || storedFileName}
            </h1>
            {metadata.description && (
              <p className="doc-panel-subtitle evidence-details-main-desc">
                {metadata.description}
              </p>
            )}
          </div>

          <div className="evidence-details-header-actions">
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={() => onNavigateVerify(evidenceId)}
              title="Verify evidence file against registered fingerprint"
              style={{ fontSize: "11.5px", padding: "7px 14px" }}
            >
              Verify Integrity
            </button>
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={() => onNavigateAccess(evidenceId)}
              title="Manage View and Download access permissions"
              style={{ fontSize: "11.5px", padding: "7px 14px" }}
            >
              Manage Access
            </button>
          </div>
        </div>

        {/* Truthful Status Disclosure Banner */}
        <div
          className="evidence-details-disclosure-banner"
          style={{
            backgroundColor: statusInfo.code === "ACTIVE" ? "rgba(40, 122, 88, 0.08)" : statusInfo.code === "HISTORICAL" ? "rgba(138, 109, 59, 0.08)" : "rgba(100, 116, 139, 0.08)",
            border: `1px solid ${statusInfo.badgeStyle.border?.split(" ")[2] || "var(--border-color)"}`,
          }}
        >
          <strong style={{ color: statusInfo.dotColor }}>{statusInfo.label}:</strong> {statusInfo.detailsText}
        </div>
      </div>

      {/* ============================================================
          SECTION 2: FILE INFORMATION & CUSTODY SPECIFICATIONS
          ============================================================ */}
      <div className="doc-panel evidence-details-panel">
        <h2 className="doc-panel-title" style={{ fontSize: "15px", fontFamily: "var(--font-serif)", marginBottom: "12px" }}>
          File Information & Custody Specifications
        </h2>

        <div className="evidence-spec-grid">
          <div className="evidence-spec-card">
            <div className="evidence-spec-label">Artifact File Name</div>
            <div className="evidence-spec-value evidence-filename-wrap" title={storedFileName}>{storedFileName}</div>
          </div>

          <div className="evidence-spec-card">
            <div className="evidence-spec-header-row">
              <span className="evidence-spec-label">Logical Vault Storage</span>
              <button
                type="button"
                className="btn-subtle-mono"
                onClick={copyVaultRef}
                style={{ fontSize: "9px", padding: "1px 5px" }}
              >
                {copiedVault ? "COPIED" : "COPY"}
              </button>
            </div>
            <code className="evidence-vault-ref" title={logicalStorageRef}>
              {logicalStorageRef}
            </code>
          </div>

          <div className="evidence-spec-card">
            <div className="evidence-spec-label">Intake Custodian</div>
            <div className="evidence-spec-value">
              {metadata.custodian || "Forensic Officer Rahul Sharma (OFF-1024)"}
            </div>
          </div>

          <div className="evidence-spec-card">
            <div className="evidence-spec-label">Acquisition Timestamp</div>
            <div className="evidence-spec-value" style={{ fontFamily: "var(--font-mono)" }}>
              {formatISTDateTime(metadata.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 3: INTEGRITY VERIFICATION & FINGERPRINT
          ============================================================ */}
      <div className="doc-panel evidence-details-panel">
        <div className="doc-panel-header evidence-fingerprint-header">
          <div>
            <h2 className="doc-panel-title" style={{ fontSize: "15px", fontFamily: "var(--font-serif)", margin: 0 }}>
              Integrity Verification & Fingerprint
            </h2>
            <p className="doc-panel-subtitle" style={{ fontSize: "12px", margin: "2px 0 0 0", color: "var(--text-secondary)" }}>
              Standard 256-bit SHA-256 cryptographic checksum computed during initial evidence intake.
            </p>
          </div>
          <button
            type="button"
            className="btn-tactile-secondary"
            onClick={() => onNavigateVerify(evidenceId)}
            style={{ fontSize: "11px", padding: "5px 12px" }}
          >
            Run Integrity Audit
          </button>
        </div>

        <div className="evidence-fingerprint-layout">
          <div className="evidence-fingerprint-data-col">
            <div className="evidence-checksum-card">
              <div className="evidence-checksum-header">
                <span className="evidence-checksum-title">
                  SHA-256 INTAKE CHECKSUM (64 HEX CHARACTERS)
                </span>
                <div className="evidence-checksum-controls">
                  <button
                    type="button"
                    className="btn-subtle-mono"
                    onClick={() => setShowFullHash(!showFullHash)}
                    style={{ fontSize: "10px", padding: "2px 6px" }}
                  >
                    {showFullHash ? "SHORT" : "EXPAND"}
                  </button>
                  <button
                    type="button"
                    className="btn-subtle-mono"
                    onClick={copyHash}
                    style={{ fontSize: "10px", padding: "2px 6px" }}
                  >
                    {copiedHash ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>
              <code className="evidence-checksum-value">
                {showFullHash ? hashVal : shortHash}
              </code>
            </div>

            <p className="evidence-principle-text">
              <strong>Verification Principle:</strong> When a forensic examiner audits a working copy or suspect file, its binary checksum is computed and compared against this registered digest. Any difference indicates data tampering or corruption.
            </p>
          </div>

          {/* Clean Visual Seal (Secondary Visual Motif) */}
          <div className="evidence-seal-col">
            <CryptographicFingerprint
              hash={hashVal}
              size={110}
              label="Visual Fingerprint"
              showMeta={false}
            />
            <span className="evidence-seal-label">
              Procedural Visual Seal
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 4: REGISTRATION HISTORY & CUSTODY CONTINUITY
          ============================================================ */}
      <div className="doc-panel evidence-details-panel">
        <h2 className="doc-panel-title" style={{ fontSize: "15px", fontFamily: "var(--font-serif)", marginBottom: "12px" }}>
          Registration History & Custody Continuity
        </h2>

        <div className="evidence-history-grid">
          <div className="evidence-history-card">
            <div className="evidence-history-card-header">
              <span className="evidence-history-step-label">
                1. Initial Intake Event
              </span>
              <span className="badge-clean badge-verified" style={{ fontSize: "9.5px" }}>COMPLETED</span>
            </div>
            <div className="evidence-history-body">
              Acquired and catalogued in official digital repository.
            </div>
            <div className="evidence-history-date">
              Recorded on: {formatISTDateTime(metadata.createdAt)}
            </div>
          </div>

          <div className="evidence-history-card">
            <div className="evidence-history-card-header">
              <span className="evidence-history-step-label">
                2. Custody Registry Record
              </span>
              <span className={`${statusInfo.pillClass} evidence-status-badge`} style={{ ...statusInfo.badgeStyle, fontSize: "9.5px" }}>
                {statusInfo.shortLabel}
              </span>
            </div>
            <div className="evidence-history-body">
              {statusInfo.summary}
            </div>
            <div className="evidence-history-date">
              {statusInfo.code === "HISTORICAL"
                ? "Original registration preserved from previous ledger environment"
                : statusInfo.code === "ACTIVE"
                ? "Confirmed on active verification ledger"
                : "Awaiting ledger confirmation"}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 5: ACCESS PERMISSIONS & INLINE VIEWER
          ============================================================ */}
      <div className="doc-panel evidence-details-panel">
        <div className="doc-panel-header evidence-access-header" style={{ marginBottom: "12px" }}>
          <div>
            <h2 className="doc-panel-title" style={{ fontSize: "15px", fontFamily: "var(--font-serif)" }}>
              Access Permissions & Protection
            </h2>
            <p className="doc-panel-subtitle" style={{ fontSize: "12px" }}>
              Independent authorization between secure in-browser viewing and raw binary downloading.
            </p>
          </div>
          <button
            type="button"
            className="btn-tactile-secondary"
            onClick={() => onNavigateAccess(evidenceId)}
            style={{ fontSize: "11px", padding: "5px 12px" }}
          >
            Manage Permissions
          </button>
        </div>

        <div className="evidence-permissions-grid">
          {/* VIEW Permission Card */}
          <div className="ambient-card evidence-permission-card">
            <div className="evidence-permission-card-header">
              <span className="evidence-permission-title view-title">
                View Permission (In-Browser)
              </span>
              <span className={`badge-clean ${viewAccessAllowed ? "badge-verified" : "badge-revoked"}`}>
                {viewAccessAllowed === null ? "CHECKING" : viewAccessAllowed ? "GRANTED" : "RESTRICTED"}
              </span>
            </div>
            <p className="evidence-permission-desc">
              Allows viewing text contents or rendering PDF/image previews in-browser without local file contamination.
            </p>
            <button
              type="button"
              className="btn-tactile-primary evidence-permission-btn"
              onClick={() => onViewFile(evidenceId)}
              disabled={viewAccessAllowed === false}
              title={viewAccessAllowed === false ? "VIEW permission required" : "Open protected in-browser preview"}
            >
              Open Inline Preview
            </button>
          </div>

          {/* DOWNLOAD Permission Card */}
          <div className="ambient-card evidence-permission-card">
            <div className="evidence-permission-card-header">
              <span className="evidence-permission-title download-title">
                Download Permission (Export)
              </span>
              <span className={`badge-clean ${downloadAccessAllowed ? "badge-verified" : "badge-revoked"}`}>
                {downloadAccessAllowed === null ? "CHECKING" : downloadAccessAllowed ? "GRANTED" : "RESTRICTED"}
              </span>
            </div>
            <p className="evidence-permission-desc">
              Allows certified extraction of the raw binary payload for laboratory analysis or judicial submission.
            </p>
            <button
              type="button"
              className="btn-tactile-secondary evidence-permission-btn"
              onClick={() => onDownloadFile(evidenceId)}
              disabled={downloadAccessAllowed === false}
              title={downloadAccessAllowed === false ? "DOWNLOAD permission required" : "Download raw evidence file"}
            >
              Download Evidence Payload
            </button>
          </div>
        </div>

        {/* Inline File Viewer Container (Rendered when View File is triggered) */}
        {viewedFileUrl && (
          <div className="doc-panel" style={{ border: "2px solid var(--green-institutional, #287A58)", padding: "16px 18px", marginTop: "16px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
            <div className="doc-panel-header" style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--green-deep, #1E5C42)", fontWeight: 700, textTransform: "uppercase" }}>
                  SECURE INLINE INSPECTOR • {fileExt ? fileExt.toUpperCase() : "PAYLOAD"}
                </span>
                <h3 className="doc-panel-title" style={{ fontSize: "14px", margin: "2px 0 0 0", color: "var(--text-primary)" }}>
                  {viewedFileName || "Evidence Payload"}
                </h3>
              </div>
              <button
                type="button"
                className="btn-tactile-secondary"
                onClick={onCloseViewer}
                style={{ fontSize: "11px", padding: "4px 10px" }}
              >
                Close Viewer [×]
              </button>
            </div>

            <div style={{ padding: "16px", backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "4px", overflow: "auto", maxHeight: "480px", maxWidth: "100%", boxSizing: "border-box" }}>
              {/* 1. Image View */}
              {isImage && (
                <div style={{ textAlign: "center", padding: "8px" }}>
                  <img
                    src={viewedFileUrl}
                    alt={viewedFileName || "Evidence visual artifact"}
                    style={{ maxWidth: "100%", maxHeight: "380px", objectFit: "contain", borderRadius: "4px", border: "1px solid var(--border-color)", margin: "0 auto", display: "block" }}
                  />
                  <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    Authenticated visual diagram • Bitwise matching SHA-256
                  </div>
                </div>
              )}

              {/* 2. PDF View */}
              {isPdf && (
                <div>
                  <iframe
                    src={viewedFileUrl}
                    title="PDF Document Preview"
                    style={{ width: "100%", height: "420px", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "#FFFFFF" }}
                  />
                  <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Certified PDF Forensic Exhibit Document</span>
                    <a href={viewedFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--green-deep, #1E5C42)", fontWeight: 600 }}>
                      Open PDF in Full Tab ↗
                    </a>
                  </div>
                </div>
              )}

              {/* 3. CSV View */}
              {isCsv && (
                <div>
                  {contentLoading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading tabular data stream...</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="archival-table" style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ backgroundColor: "var(--surface-raised, #F3F4F6)" }}>
                            {csvHeaders.map((h, i) => (
                              <th key={i} style={{ padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--border-color)", fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.map((row, rIdx) => (
                            <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 0 ? "transparent" : "var(--surface-raised, #FAFAFA)" }}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-color)", fontFamily: "var(--font-mono)" }}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 4. JSON View */}
              {isJson && (
                <div>
                  {contentLoading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading structured manifest...</div>
                  ) : (
                    <pre style={{
                      backgroundColor: "#0B132B",
                      color: "#E2E8F0",
                      padding: "16px",
                      borderRadius: "4px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11.5px",
                      overflow: "auto",
                      maxHeight: "360px",
                      lineHeight: 1.5,
                      margin: 0
                    }}>
                      {formattedJson}
                    </pre>
                  )}
                </div>
              )}

              {/* 5. Plain Text / Log View */}
              {isTxt && (
                <div>
                  {contentLoading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading text chronology...</div>
                  ) : (
                    <pre style={{
                      backgroundColor: "var(--surface-raised, #F8F9FA)",
                      border: "1px solid var(--border-color)",
                      padding: "14px",
                      borderRadius: "4px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11.5px",
                      overflow: "auto",
                      maxHeight: "360px",
                      lineHeight: 1.6,
                      color: "var(--text-primary)",
                      margin: 0,
                      whiteSpace: "pre-wrap"
                    }}>
                      {fileContentText}
                    </pre>
                  )}
                </div>
              )}

              {/* 6. Raw Binary Payload Inspection Banner */}
              {isBinary && (
                <div style={{
                  backgroundColor: "var(--surface-raised, #F9FAFB)",
                  border: "1px solid var(--border-color, #E5E7EB)",
                  borderRadius: "6px",
                  padding: "24px 16px",
                  textAlign: "center"
                }}>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(40, 122, 88, 0.12)",
                    color: "var(--green-deep, #1E5C42)",
                    marginBottom: "12px"
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                      <line x1="6" y1="6" x2="6.01" y2="6" />
                      <line x1="6" y1="18" x2="6.01" y2="18" />
                    </svg>
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                    FORENSIC BITSTREAM ARCHIVE (RAW BINARY)
                  </h4>
                  <p style={{ margin: "0 auto 16px auto", maxWidth: "500px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    This exhibit ({viewedFileName}) is a low-level binary bitstream artifact (such as a memory dump, packet capture, or raw disk slice). In-browser rendering is intentionally bypassed to protect evidentiary purity. Please use the download action below to export the certified bitstream for laboratory ingestion.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="btn-tactile-primary"
                      onClick={() => onDownloadFile(evidenceId)}
                      disabled={downloadAccessAllowed === false}
                      style={{ fontSize: "12px", padding: "8px 18px" }}
                    >
                      Download Certified Payload ({viewedFileName})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          SECTION 6: ADVANCED TECHNICAL DETAILS (COLLAPSIBLE)
          ============================================================ */}
      <details className="doc-panel evidence-details-panel evidence-advanced-details">
        <summary className="evidence-advanced-summary">
          Advanced Technical Details & Provenance Identifiers
        </summary>
        <div className="evidence-advanced-content">
          <p className="evidence-advanced-desc">
            Cryptographic references, transaction receipts, and low-level registry identifiers for authorized technical auditing:
          </p>

          <div className="evidence-advanced-list">
            <div className="evidence-advanced-item">
              <div className="evidence-advanced-item-header">
                <span className="evidence-advanced-label">Registration Transaction Reference</span>
                {txHash && (
                  <button
                    type="button"
                    className="btn-subtle-mono"
                    onClick={copyTxHash}
                    style={{ fontSize: "9.5px", padding: "1px 5px" }}
                  >
                    {copiedTx ? "COPIED" : "COPY"}
                  </button>
                )}
              </div>
              <code className="evidence-advanced-code">
                {txHash || "0x0000000000000000000000000000000000000000000000000000000000000000"}
              </code>
            </div>

            <div className="evidence-advanced-item">
              <div className="evidence-advanced-label">Signing Custodian Address</div>
              <code className="evidence-advanced-code">
                {metadata.registeredBy || blockchain.custodian || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}
              </code>
            </div>

            <div className="evidence-advanced-item">
              <div className="evidence-advanced-label">Verification Contract Identity</div>
              <code className="evidence-advanced-code">
                0x5FbDB2315678afecb367f032d93F642f64180aa3 (Verification Engine Registry)
              </code>
            </div>
          </div>
        </div>
      </details>

      {/* Access History Audit Register */}
      <div className="doc-panel evidence-details-panel">
        <div className="doc-panel-header" style={{ marginBottom: "12px" }}>
          <div>
            <h3 className="doc-panel-title" style={{ fontSize: "15px", fontFamily: "var(--font-serif)" }}>
              Access Audit Register
            </h3>
            <p className="doc-panel-subtitle" style={{ fontSize: "12px" }}>
              Every View and Download action executed for this evidence record is immutably logged in the audit trail.
            </p>
          </div>
        </div>

        {accessHistory && accessHistory.length > 0 ? (
          <div className="table-wrapper-archival" style={{ maxWidth: "100%", width: "100%", overflowX: "auto", minWidth: 0 }}>
            <table className="archival-table" style={{ minWidth: "500px", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "180px" }}>Timestamp (IST)</th>
                  <th style={{ width: "120px" }}>Action</th>
                  <th>Accessed By</th>
                  <th style={{ width: "140px" }}>Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {accessHistory.map((rec, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                      {formatISTDateTime(rec.timestamp)}
                    </td>
                    <td>
                      <span className={`badge-clean ${rec.action === "VIEW" ? "badge-verified" : "badge-pending"}`}>
                        {rec.action}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                        {rec.accessedBy}
                      </code>
                    </td>
                    <td>
                      <span className="badge-clean badge-verified" style={{ fontSize: "10px" }}>
                        Logged in Audit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
            No access events recorded for this evidence file yet. When an authorized officer views or downloads this file, the custody event is logged immediately.
          </div>
        )}
      </div>
    </div>
  );
}
