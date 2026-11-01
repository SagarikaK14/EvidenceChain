// ============================================================
// EvidenceChain Verify Evidence View - Forensic Integrity Auditor
// Separate Dual-Result Presentation:
// 1. File Binary Integrity Audit (Bitwise SHA-256 Comparison)
// 2. Ledger Registration Provenance Audit (Active vs Historical Ledger)
// Responsive across 320px, 375px, 390px, 430px, 768px, and 1440px
// ============================================================

import { useState } from "react";
import { SearchIcon, XIcon, ShieldCheckIcon, AlertTriangleIcon } from "../components/Icons";
import { getEvidenceStatus } from "../utils/statusLabels";

export function VerifyEvidenceView({
  evidenceList = [],
  initialEvidenceId = "",
  onVerify,
  loading,
  error,
  verificationResult,
  blockchainHash,
  onReset,
  backendConnected,
  onBack,
}) {
  const [evidenceId, setEvidenceId] = useState(initialEvidenceId);
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState("");
  const [file, setFile] = useState(null);
  const [localHash, setLocalHash] = useState("");
  const [copiedHash, setCopiedHash] = useState("");

  const [prevInitialId, setPrevInitialId] = useState(initialEvidenceId);
  if (initialEvidenceId !== prevInitialId) {
    setPrevInitialId(initialEvidenceId);
    setEvidenceId(initialEvidenceId);
  }

  const selectedRecord = (evidenceList || []).find((e) => e.evidenceId === evidenceId);

  const filteredEvidence = (evidenceList || []).filter((item) => {
    if (!evidenceSearchQuery.trim()) return true;
    const q = evidenceSearchQuery.toLowerCase();
    return (
      (item.evidenceId && item.evidenceId.toLowerCase().includes(q)) ||
      (item.caseId && item.caseId.toLowerCase().includes(q)) ||
      (item.originalFilename && item.originalFilename.toLowerCase().includes(q)) ||
      (item.filename && item.filename.toLowerCase().includes(q)) ||
      (item.title && item.title.toLowerCase().includes(q))
    );
  });

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      setLocalHash("");
      return;
    }
    setFile(selectedFile);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setLocalHash(hashHex);
    } catch (err) {
      console.error("Hashing failed", err);
      setLocalHash("");
    }
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (!evidenceId.trim()) return;
    if (!file) return;
    onVerify(evidenceId.trim(), file);
  };

  const copyToClipboard = (tag, text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(tag);
    setTimeout(() => setCopiedHash(""), 1200);
  };

  // Authoritative dual-result analysis
  const isObjectResult = typeof verificationResult === "object" && verificationResult !== null;
  const resultVerdict = isObjectResult ? verificationResult.result : (verificationResult ? "AUTHENTIC" : "TAMPERED");
  const isAuthentic = isObjectResult ? Boolean(verificationResult.isAuthentic) : Boolean(verificationResult);
  const isHistorical = resultVerdict === "AUTHENTIC_HISTORICAL";
  const onChainVerified = isObjectResult ? Boolean(verificationResult.onChainVerified) : isAuthentic;

  // Registered hash source
  const recordedDigest = blockchainHash || (isObjectResult ? verificationResult.recordedHash : "") || selectedRecord?.sha256Hash || "";
  const candidateDigest = localHash || (isObjectResult ? verificationResult.currentHash : "");
  const hashesMatch = Boolean(recordedDigest && candidateDigest && recordedDigest.toLowerCase() === candidateDigest.toLowerCase());

  // Record status evaluation
  const targetStatusInfo = getEvidenceStatus(selectedRecord);

  return (
    <div className="view-container verify-evidence-view" data-testid="verify-evidence-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* 0. Top Return & Breadcrumbs */}
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", minWidth: 0 }}>
        {onBack && (
          <button
            type="button"
            className="btn-tactile-secondary"
            onClick={onBack}
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
        )}
        {evidenceId && (
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 }}>
            Target Evidence: <strong style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{evidenceId}</strong>
            {selectedRecord?.caseId && (
              <>
                <span style={{ margin: "0 6px", opacity: 0.4 }}>|</span>
                Case: <strong style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{selectedRecord.caseId}</strong>
              </>
            )}
          </div>
        )}
      </div>

      {/* 1. Page Header Block */}
      <div className="page-header-block" style={{ marginBottom: "20px" }}>
        <div>
          <h1 className="page-title">Evidence Integrity Verification</h1>
          <p className="page-context-desc">
            Independent dual-result verification: test candidate file binary checksum against the registered intake digest, and inspect ledger custody provenance.
          </p>
        </div>
      </div>

      {!backendConnected && (
        <div className="banner-alert alert-error" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Backend Disconnected:</strong> Cannot retrieve recorded hash or verify against system registry.
          </div>
        </div>
      )}

      {error && (
        <div className="banner-alert alert-error" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Verification Request Failed:</strong> {error}
          </div>
        </div>
      )}

      {/* ============================================================
          2. DUAL-RESULT VERIFICATION REPORT (When verified)
          Result 1: File Binary Integrity Check (Hash Comparison)
          Result 2: Ledger Registration Provenance Check (Ledger Anchor)
          ============================================================ */}
      {verificationResult !== null && (
        <div className="doc-panel" style={{ borderTop: `3px solid ${hashesMatch ? "var(--green-institutional)" : "var(--red-restrained)"}`, padding: "20px 22px", marginBottom: "22px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
          <div className="doc-panel-header" style={{ marginBottom: "16px", minWidth: 0 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: hashesMatch ? "var(--green-deep)" : "var(--red-restrained)", textTransform: "uppercase" }}>
                FORENSIC AUDIT COMPLETE • DUAL-RESULT VERIFICATION REPORT
              </div>
              <h2 className="doc-panel-title" style={{ fontSize: "20px", marginTop: "4px" }}>
                {hashesMatch
                  ? "SHA-256 Digest Match Confirmed"
                  : "Cryptographic Fingerprint Mismatch Detected"}
              </h2>
              <p className="doc-panel-subtitle" style={{ fontSize: "13px" }}>
                Target Record: <strong>{evidenceId}</strong> • Case Docket: <strong>{selectedRecord?.caseId || isObjectResult?.caseId || "CASE-REF"}</strong>
              </p>
            </div>
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={onReset}
              style={{ fontSize: "11.5px", padding: "6px 14px" }}
            >
              Reset Audit
            </button>
          </div>

          {/* DUAL RESULTS GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "16px", marginBottom: "18px", minWidth: 0 }}>
            {/* RESULT 1: File Binary Integrity */}
            <div style={{ padding: "14px 16px", background: "var(--surface-primary)", border: `1.5px solid ${hashesMatch ? "rgba(40, 122, 88, 0.4)" : "rgba(180, 40, 40, 0.4)"}`, borderRadius: "4px", minWidth: 0, boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
                  Result 1: File Binary Integrity
                </span>
                <span className={`badge-clean ${hashesMatch ? "badge-verified" : "badge-revoked"}`} style={{ fontSize: "10px" }}>
                  {hashesMatch ? "SHA-256 MATCH" : "TAMPERED / MISMATCH"}
                </span>
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: hashesMatch ? "var(--green-deep)" : "var(--red-restrained)", marginBottom: "4px" }}>
                {hashesMatch ? "Candidate file SHA-256 matches the recorded intake digest." : "File Content Modified or Corrupted"}
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>
                {hashesMatch
                  ? "The candidate file SHA-256 checksum matches the official recorded intake digest byte-for-byte."
                  : "The computed SHA-256 checksum of the suspect file diverges from the registered intake digest. The file has been altered or damaged."}
              </p>
            </div>

            {/* RESULT 2: Ledger Registration Provenance */}
            <div style={{ padding: "14px 16px", background: "var(--surface-primary)", border: "1.5px solid var(--border-color)", borderRadius: "4px", minWidth: 0, boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
                  Result 2: Ledger Registration Status
                </span>
                <span
                  className={onChainVerified ? "badge-clean badge-verified" : isHistorical ? "badge-clean badge-historical" : "badge-clean badge-neutral"}
                  style={{ fontSize: "10px" }}
                >
                  {onChainVerified ? "Active Ledger Verified" : isHistorical ? "Historical Registration" : "Registration Not Confirmed"}
                </span>
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                {onChainVerified
                  ? "Confirmed on Active Verification Ledger"
                  : isHistorical
                  ? "Historical Registration Reference Recorded"
                  : "Unconfirmed on Verification Ledger"}
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>
                {onChainVerified
                  ? "This record is anchored on the current active ledger and has passed continuous automated integrity reconciliation."
                  : isHistorical
                  ? "Historical registration reference recorded; current-ledger verification unavailable. The record is preserved in the central evidence repository with historical custody provenance."
                  : "This evidence was catalogued in the system repository, but its registration on the verification ledger has not been confirmed."}
              </p>
            </div>
          </div>

          {/* SIDE-BY-SIDE HASH COMPARISON */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px", minWidth: 0 }}>
            {/* Registered Intake Digest */}
            <div style={{ padding: "10px 12px", backgroundColor: "#FFFFFF", border: "1px solid var(--border-color)", borderRadius: "3px", minWidth: 0, boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                  REGISTERED INTAKE DIGEST (OFFICIAL CHECKSUM)
                </span>
                {recordedDigest && (
                  <button
                    type="button"
                    className="btn-subtle-mono"
                    onClick={() => copyToClipboard("stored", recordedDigest)}
                    style={{ fontSize: "9.5px", padding: "1px 5px" }}
                  >
                    {copiedHash === "stored" ? "COPIED" : "COPY"}
                  </button>
                )}
              </div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", wordBreak: "break-all", overflowWrap: "anywhere", color: "var(--text-primary)", display: "block" }}>
                {recordedDigest || "Digest not found on record"}
              </code>
            </div>

            {/* Candidate File Digest */}
            <div style={{ padding: "10px 12px", backgroundColor: "#FFFFFF", border: "1px solid var(--border-color)", borderRadius: "3px", minWidth: 0, boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                  CANDIDATE FILE COMPUTED CHECKSUM (SUSPECT ARTIFACT)
                </span>
                {candidateDigest && (
                  <button
                    type="button"
                    className="btn-subtle-mono"
                    onClick={() => copyToClipboard("local", candidateDigest)}
                    style={{ fontSize: "9.5px", padding: "1px 5px" }}
                  >
                    {copiedHash === "local" ? "COPIED" : "COPY"}
                  </button>
                )}
              </div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", wordBreak: "break-all", overflowWrap: "anywhere", color: hashesMatch ? "var(--green-deep)" : "var(--red-restrained)", display: "block" }}>
                {candidateDigest || "Candidate file digest unavailable"}
              </code>
            </div>
          </div>

          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: "10px", lineHeight: 1.4 }}>
            <strong>Forensic Verification Principle:</strong> File integrity verifies that the suspect file is bitwise identical to the artifact acquired at intake. Ledger verification confirms that the registration transaction remains intact and continuous on the custody ledger.
          </div>
        </div>
      )}

      {/* ============================================================
          3. VERIFICATION PARAMETERS FORM
          ============================================================ */}
      <form onSubmit={handleVerifySubmit} className="doc-panel" style={{ padding: "18px 20px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
        <h2 className="doc-panel-title" style={{ fontSize: "15px", fontFamily: "var(--font-serif)", marginBottom: "14px" }}>
          Candidate Verification Parameters
        </h2>

        {/* Selected Target Banner or Searchable Selector */}
        {evidenceId ? (
          <div className="selected-summary-banner" style={{ marginBottom: "16px", minWidth: 0, boxSizing: "border-box" }}>
            <div className="selected-summary-details" style={{ minWidth: 0 }}>
              <span className="summary-section-label">SELECTED TARGET EVIDENCE RECORD</span>
              <div className="summary-main-ref" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{evidenceId}</span>
                {selectedRecord && (
                  <span className={targetStatusInfo.pillClass} style={{ ...targetStatusInfo.badgeStyle, fontSize: "10.5px", padding: "2px 7px" }}>
                    {targetStatusInfo.label}
                  </span>
                )}
              </div>
              <div className="summary-subtext" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                Case Docket: <strong>{selectedRecord?.caseId || "—"}</strong> • File: <strong>{selectedRecord?.originalFilename || selectedRecord?.filename || selectedRecord?.title || "Evidence Artifact"}</strong>
              </div>
            </div>
            <button
              type="button"
              className="btn-tactile-secondary"
              onClick={() => setEvidenceId("")}
              title="Select a different evidence record"
              style={{ fontSize: "11px", padding: "4px 10px", flexShrink: 0 }}
            >
              Change Target
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: "16px", minWidth: 0 }}>
            <label className="form-label" htmlFor="verify-search-input" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600 }}>
              Select Target Evidence Record <span style={{ color: "var(--red-restrained)" }}>*</span>
            </label>
            <div className="search-field-wrapper" style={{ marginBottom: "8px", minWidth: 0 }}>
              <SearchIcon size={16} className="search-field-icon" />
              <input
                id="verify-search-input"
                type="text"
                className="gov-search-input"
                placeholder="Search by Evidence ID, Case Docket, or filename..."
                value={evidenceSearchQuery}
                onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
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

            {filteredEvidence.length === 0 ? (
              <div className="empty-results-box" style={{ margin: "10px 0", padding: "14px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12.5px" }}>
                <AlertTriangleIcon size={18} />
                <span style={{ marginLeft: "8px" }}>No evidence records match &ldquo;{evidenceSearchQuery}&rdquo;.</span>
              </div>
            ) : (
              <div className="table-wrapper-archival" style={{ maxHeight: "240px", overflowY: "auto", overflowX: "auto", width: "100%", maxWidth: "100%", minWidth: 0, border: "1px solid var(--border-color)", borderRadius: "3px", boxSizing: "border-box" }}>
                <table className="archival-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "24%" }}>Evidence ID</th>
                      <th>Case Docket &amp; File</th>
                      <th style={{ width: "26%", textAlign: "center" }}>Registration Status</th>
                      <th style={{ width: "16%", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvidence.map((item) => {
                      const itemStatus = getEvidenceStatus(item);
                      return (
                        <tr
                          key={item.evidenceId}
                          onClick={() => setEvidenceId(item.evidenceId)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <span className="mono-identifier" style={{ fontWeight: 600 }}>{item.evidenceId}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-primary)" }}>{item.caseId}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-secondary)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                              {item.title || item.originalFilename || item.filename || "Digital evidence"}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={itemStatus.pillClass} style={{ ...itemStatus.badgeStyle, fontSize: "10px", padding: "2px 6px" }}>
                              {itemStatus.shortLabel}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn-tactile-secondary"
                              style={{ fontSize: "11px", padding: "3px 8px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEvidenceId(item.evidenceId);
                              }}
                            >
                              Select &rarr;
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

        {/* File Input Block */}
        <div className="form-group-block" style={{ marginBottom: "16px", minWidth: 0 }}>
          <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600 }}>
            Candidate Evidence File <span style={{ color: "var(--red-restrained)" }}>*</span>
          </label>
          <input
            type="file"
            className="form-input-text"
            style={{ height: "auto", padding: "8px", width: "100%", boxSizing: "border-box", minWidth: 0 }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileChange(e.target.files[0]);
              }
            }}
            required
          />
          <div className="form-hint" style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Select the suspect or working copy from your filesystem to test against the registered intake fingerprint.
          </div>
        </div>

        {/* Local Checksum Display */}
        {localHash && (
          <div style={{ padding: "10px 14px", backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "3px", marginBottom: "16px", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "3px" }}>
              COMPUTED CANDIDATE SHA-256 CHECKSUM:
            </div>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", wordBreak: "break-all", overflowWrap: "anywhere", color: "var(--text-primary)", display: "block" }}>
              {localHash}
            </code>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
          <button
            type="submit"
            className="btn-tactile-primary"
            style={{ fontSize: "12px", padding: "8px 18px" }}
            disabled={loading || !evidenceId.trim() || !file}
          >
            {loading ? "Running Forensic Audit..." : "Execute Integrity Audit"}
          </button>
        </div>
      </form>
    </div>
  );
}
