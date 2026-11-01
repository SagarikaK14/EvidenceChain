// ============================================================
// EvidenceChain: System Health & Diagnostics View
// Professional Sovereign Forensic Telemetry Dashboard
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  getDiagnosticsSummaryAPI,
  getLedgerConsistencyAPI,
  getTechnicalDiagnosticsAPI,
  getDevelopmentToolsAPI,
  pingRPCAPI,
} from "../api";

export function SystemStatusView({
  backendConnected,
  blockchainConnected,
  currentUser,
  onNavigateToEvidence,
}) {
  // Operational Health Summary state
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Ledger Consistency state
  const [consistencyData, setConsistencyData] = useState(null);
  const [loadingConsistency, setLoadingConsistency] = useState(true);

  // Technical Diagnostics (Admin) state
  const [technicalData, setTechnicalData] = useState(null);
  const [loadingTechnical, setLoadingTechnical] = useState(false);
  const [technicalError, setTechnicalError] = useState(null);

  // Development Tools state
  const [devToolsData, setDevToolsData] = useState(null);
  const [loadingDevTools, setLoadingDevTools] = useState(false);

  // Safe Server-side RPC Ping state
  const [pingingRPC, setPingingRPC] = useState(false);
  const [rpcPingResult, setRpcPingResult] = useState(null);

  // Copy feedback state
  const [copiedTag, setCopiedTag] = useState("");

  const isHOD = currentUser?.role === "Head of Department" || summaryData?.isAdmin;

  // Load Operational Health Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await getDiagnosticsSummaryAPI();
      if (res && res.status === "success") {
        setSummaryData(res);
        setSummaryError(null);
      } else {
        setSummaryError(res?.message || "Failed to query system health summary.");
      }
    } catch (err) {
      console.error("fetchSummary error:", err);
      setSummaryError("Unable to reach backend diagnostics service.");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Load Ledger Consistency Audit
  const fetchConsistency = useCallback(async () => {
    try {
      const res = await getLedgerConsistencyAPI();
      if (res && res.status === "success") {
        setConsistencyData(res);
      }
    } catch (err) {
      console.warn("fetchConsistency error:", err);
    } finally {
      setLoadingConsistency(false);
    }
  }, []);

  // Load Technical Diagnostics (Admin only)
  const fetchTechnical = useCallback(async () => {
    setLoadingTechnical(true);
    setTechnicalError(null);
    try {
      const res = await getTechnicalDiagnosticsAPI();
      if (res && res.status === "success") {
        setTechnicalData(res.diagnostics);
      } else {
        setTechnicalError(res?.message || "Technical diagnostics unavailable.");
      }
    } catch (err) {
      setTechnicalError("Technical diagnostics restricted or network unavailable.");
    } finally {
      setLoadingTechnical(false);
    }
  }, []);

  // Load Development Tools (Dev mode only)
  const fetchDevTools = useCallback(async () => {
    setLoadingDevTools(true);
    try {
      const res = await getDevelopmentToolsAPI();
      if (res && res.status === "success") {
        setDevToolsData(res);
      } else {
        setDevToolsData(null);
      }
    } catch (err) {
      setDevToolsData(null);
    } finally {
      setLoadingDevTools(false);
    }
  }, []);

  // Run full diagnostics suite across all layers
  const handleRunFullDiagnostics = async () => {
    if (runningDiagnostics) return;
    setRunningDiagnostics(true);
    setRpcPingResult(null);

    await Promise.allSettled([
      fetchSummary(),
      fetchConsistency(),
      isHOD ? fetchTechnical() : Promise.resolve(),
      isHOD ? fetchDevTools() : Promise.resolve(),
    ]);

    setRunningDiagnostics(false);
  };

  // Safe server-side RPC ping
  const handlePingRPC = async () => {
    setPingingRPC(true);
    setRpcPingResult(null);
    try {
      const res = await pingRPCAPI();
      if (res && res.status === "success") {
        setRpcPingResult({
          success: true,
          blockNumber: res.blockNumber,
          hexBlock: res.hexBlock,
          latencyMs: res.latencyMs,
          endpoint: res.endpoint,
        });
      } else {
        setRpcPingResult({
          success: false,
          error: res?.message || "RPC query failed.",
        });
      }
    } catch (err) {
      setRpcPingResult({
        success: false,
        error: "Server network timeout querying JSON-RPC node.",
      });
    } finally {
      setPingingRPC(false);
    }
  };

  const handleCopy = (tag, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(""), 1600);
  };

  // Initial mount load
  useEffect(() => {
    fetchSummary();
    fetchConsistency();
    if (isHOD) {
      fetchTechnical();
      fetchDevTools();
    }
  }, [fetchSummary, fetchConsistency, fetchTechnical, fetchDevTools, isHOD]);

  // Format date helper
  const formatDate = (isoStr) => {
    if (!isoStr) return "Never";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const services = summaryData?.services || [];
  const systemHealth = summaryData?.systemHealth || (backendConnected ? "Healthy" : "Unavailable");
  const allowDevTools = summaryData?.allowDevTools;

  return (
    <div className="view-container system-diagnostics-container" data-testid="system-status-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* 1. Header Block with System Status & Diagnostics Actions */}
      <div className="page-header-block" style={{ marginBottom: "18px" }}>
        <div>
          <div className="system-pill" style={{ display: "inline-flex", marginBottom: "8px" }}>
            <span className="live-indicator"></span>
            INFRASTRUCTURE TELEMETRY &amp; DIAGNOSTICS CONSOLE
          </div>
          <h1 className="page-title">System Health &amp; Ledger Continuity Diagnostics</h1>
          <p className="page-context-desc">
            Real-time infrastructure health, verification ledger connectivity, custody database reconciliation, and cryptographic telemetry.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Status Badge in Header */}
          <span
            className={`badge ${
              systemHealth === "Healthy"
                ? "badge-emerald"
                : systemHealth === "Degraded"
                ? "badge-amber"
                : "badge-danger"
            }`}
            style={{ fontSize: "12px", padding: "5px 12px" }}
            data-testid="overall-system-health-badge"
          >
            <span className="live-indicator"></span>
            {systemHealth.toUpperCase()}
          </span>

          {/* Run Diagnostics Action */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleRunFullDiagnostics}
            disabled={runningDiagnostics}
            title="Execute comprehensive health checks across API, SQLite, Web3 node, contract, and storage"
            data-testid="btn-run-diagnostics"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                marginRight: 6,
                transform: runningDiagnostics ? "rotate(180deg)" : "none",
                transition: "transform 0.4s ease",
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {runningDiagnostics ? "Checking All Services..." : "Run Diagnostics"}
          </button>
        </div>
      </div>

      {/* Global Connection Warning if Backend is Unreachable */}
      {!backendConnected && (
        <div className="alert-banner alert-danger" style={{ marginBottom: "18px" }}>
          <strong>Critical Service Unreachable:</strong> Flask API Gateway is offline or unreachable on port 5001. Ensure the Python backend daemon is started.
        </div>
      )}

      {/* Summary Error Banner */}
      {summaryError && backendConnected && (
        <div className="alert-banner alert-warning" style={{ marginBottom: "18px" }}>
          <strong>Telemetry Notice:</strong> {summaryError}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION A: SYSTEM HEALTH OVERVIEW                        */}
      {/* ======================================================== */}
      <section className="diagnostics-section" aria-labelledby="section-services-health">
        <div className="section-header-compact">
          <div>
            <span className="section-kicker">SECTION A</span>
            <h2 id="section-services-health" className="section-title-sm">
              System Health Overview
            </h2>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            LAST CHECKED: {formatDate(summaryData?.checkedAt)}
          </span>
        </div>

        <div className="services-health-grid">
          {loadingSummary && services.length === 0 ? (
            <div className="card" style={{ padding: "30px", textAlign: "center", gridColumn: "1 / -1" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Testing telemetry across API gateway, SQLite, consensus node, contract, and disk vault...
              </span>
            </div>
          ) : (
            services.map((svc) => {
              const isHealthy = svc.status === "Healthy";
              const isDegraded = svc.status === "Degraded";
              const isUnavailable = svc.status === "Unavailable";

              return (
                <div
                  key={svc.id}
                  className={`service-card ${
                    isHealthy ? "service-healthy" : isDegraded ? "service-degraded" : "service-unavailable"
                  }`}
                  data-testid={`service-card-${svc.id}`}
                >
                  <div className="service-card-header">
                    <div>
                      <span className="service-category">{svc.category}</span>
                      <h3 className="service-name">{svc.name}</h3>
                    </div>
                    <span
                      className={`badge ${
                        isHealthy ? "badge-emerald" : isDegraded ? "badge-amber" : "badge-danger"
                      }`}
                      style={{ fontSize: "10.5px" }}
                    >
                      {isHealthy ? "HEALTHY • NOMINAL" : isDegraded ? "DEGRADED" : "UNAVAILABLE"}
                    </span>
                  </div>

                  <p className="service-summary-text">{svc.summary}</p>

                  {svc.error && (
                    <div className="service-error-box">
                      <span className="error-title">Failure Detail:</span>
                      <span className="error-message">{svc.error}</span>
                    </div>
                  )}

                  <div className="service-card-footer">
                    <span className="service-latency font-mono">
                      Latency: <strong>{svc.responseTimeMs} ms</strong>
                    </span>
                    <span className="service-checked-time font-mono">
                      Checked: {formatDate(svc.checkedAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION B: LEDGER CONTINUITY & EVIDENCE CONSISTENCY      */}
      {/* ======================================================== */}
      <section className="diagnostics-section" aria-labelledby="section-ledger-consistency" style={{ marginTop: "24px" }}>
        <div className="section-header-compact">
          <div>
            <span className="section-kicker">SECTION B</span>
            <h2 id="section-ledger-consistency" className="section-title-sm">
              Ledger Continuity & Evidence Consistency
            </h2>
          </div>
          <span className="badge badge-outline">
            READ-ONLY INTEGRITY AUDIT
          </span>
        </div>

        <div className="card consistency-card">
          {/* Consistency Metrics Ribbon */}
          <div className="consistency-metrics-ribbon">
            <div className="consistency-metric-cell">
              <span className="metric-label">Total SQLite Records</span>
              <span className="metric-value font-mono" data-testid="metric-total-db">
                {consistencyData?.totalDbRecords ?? "—"}
              </span>
              <span className="metric-caption">Metadata in evidencechain.db</span>
            </div>

            <div className="consistency-metric-cell">
              <span className="metric-label">Anchored on Active Ledger</span>
              <span className="metric-value font-mono text-emerald" data-testid="metric-anchored">
                {consistencyData?.anchoredRecords ?? "—"}
              </span>
              <span className="metric-caption">Cryptographically verified</span>
            </div>

            <div className="consistency-metric-cell">
              <span className="metric-label">Unanchored Historical Records</span>
              <span className="metric-value font-mono text-amber" data-testid="metric-unanchored">
                {consistencyData?.unanchoredRecords ?? "—"}
              </span>
              <span className="metric-caption">Pre-restart development records</span>
            </div>

            <div className="consistency-metric-cell">
              <span className="metric-label">Network Verification Errors</span>
              <span className="metric-value font-mono" data-testid="metric-net-errors">
                {consistencyData?.networkErrorRecords ?? 0}
              </span>
              <span className="metric-caption">RPC timeouts or socket errors</span>
            </div>
          </div>

          {/* Historical Restart Advisory Banner */}
          {consistencyData?.warning && (
            <div className="consistency-warning-banner" data-testid="consistency-advisory-banner">
              <div className="warning-banner-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="warning-banner-content">
                <h4 className="warning-banner-title">{consistencyData.warning}</h4>
                <p className="warning-banner-desc">{consistencyData.explanation}</p>
                <div className="warning-banner-actions">
                  <span className="reassurance-pill">
                    Preservation Policy: SQLite records are permanent on disk and never overwritten or deleted.
                  </span>
                  {onNavigateToEvidence && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={onNavigateToEvidence}
                      style={{ marginLeft: "auto" }}
                    >
                      Inspect Evidence Repository &rarr;
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Consistent Ledger Banner (Clean State) */}
          {!consistencyData?.warning && consistencyData?.ledgerState === "CONSISTENT" && (
            <div className="consistency-clean-banner">
              <div className="clean-banner-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="clean-banner-content">
                <strong>Full Ledger Alignment:</strong> {consistencyData.explanation}
              </div>
            </div>
          )}

          {/* Sample Evidence Records Audit Breakdown */}
          {consistencyData?.samples && (
            <div className="consistency-samples-row">
              <div className="samples-col">
                <span className="samples-col-title">
                  Verified Anchored on Active Ledger ({consistencyData.anchoredRecords})
                </span>
                <div className="samples-tags-wrapper">
                  {consistencyData.samples.anchored.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>None on active node</span>
                  ) : (
                    consistencyData.samples.anchored.map((id) => (
                      <span key={id} className="sample-id-pill pill-anchored font-mono">
                        {id}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="samples-col">
                <span className="samples-col-title">
                  Historical Records from Prior Blockchain Sessions ({consistencyData.unanchoredRecords})
                </span>
                <div className="samples-tags-wrapper">
                  {consistencyData.samples.unanchored.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>None (Fully synced)</span>
                  ) : (
                    consistencyData.samples.unanchored.map((id) => (
                      <span key={id} className="sample-id-pill pill-unanchored font-mono" title="Historical SQLite record from prior Hardhat session">
                        {id} <small>(pre-restart)</small>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION C: TECHNICAL DIAGNOSTICS (ADMIN RESTRICTED)      */}
      {/* ======================================================== */}
      <section className="diagnostics-section" aria-labelledby="section-technical-diagnostics" style={{ marginTop: "24px" }}>
        <div className="section-header-compact">
          <div>
            <span className="section-kicker">SECTION C</span>
            <h2 id="section-technical-diagnostics" className="section-title-sm">
              Technical Diagnostics
            </h2>
          </div>
          <span className="badge badge-neutral" style={{ fontSize: "10px" }}>
            {isHOD ? "AUTHORIZED ADMINISTRATOR" : "RESTRICTED (HOD ONLY)"}
          </span>
        </div>

        <div className="card technical-diagnostics-card">
          {!isHOD ? (
            <div className="technical-restricted-box" data-testid="technical-restricted-notice">
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔒</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--navy-900)" }}>
                Administrative Access Required
              </h4>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", maxWidth: "540px" }}>
                Detailed infrastructure telemetry, CORS cross-origin policies, and contract deployment internals are restricted to Head of Department credentials to prevent internal reconnaissance.
              </p>
            </div>
          ) : (
            <details className="technical-diagnostics-accordion" data-testid="technical-diagnostics-accordion">
              <summary className="accordion-summary-bar">
                <span className="summary-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Inspect Infrastructure Telemetry & Network Policies
                </span>
                <span className="summary-toggle-icon">▼ Click to Expand Technical Details</span>
              </summary>

              <div className="accordion-content-box">
                {loadingTechnical && !technicalData ? (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <div className="spinner" style={{ margin: "0 auto 8px" }}></div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading technical parameters...</span>
                  </div>
                ) : technicalError ? (
                  <div className="alert-banner alert-warning">{technicalError}</div>
                ) : (
                  <div className="technical-grid">
                    {/* Column 1: API & Session */}
                    <div className="tech-col">
                      <h4 className="tech-col-title">REST Gateway & Security</h4>
                      <div className="tech-item">
                        <span className="tech-label">API Gateway:</span>
                        <code className="tech-value font-mono">{technicalData?.apiGateway?.endpoint}</code>
                      </div>
                      <div className="tech-item">
                        <span className="tech-label">CORS Origin Policy:</span>
                        <span className="tech-value">
                          Restricted ({technicalData?.apiGateway?.cors?.allowedOrigins?.join(", ")})
                        </span>
                      </div>
                      <div className="tech-item">
                        <span className="tech-label">Wildcard CORS (*):</span>
                        <span className="tech-value font-mono">
                          {technicalData?.apiGateway?.cors?.wildcardAllowed ? "Enabled" : "Disabled (Enforced)"}
                        </span>
                      </div>
                      <div className="tech-item">
                        <span className="tech-label">Session Protection:</span>
                        <span className="tech-value">
                          HttpOnly={String(technicalData?.apiGateway?.sessionSecurity?.cookieHttpOnly)}, SameSite=
                          {technicalData?.apiGateway?.sessionSecurity?.cookieSameSite}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: Blockchain & Storage */}
                    <div className="tech-col">
                      <h4 className="tech-col-title">Consensus & Persistence</h4>
                      <div className="tech-item">
                        <span className="tech-label">RPC Endpoint:</span>
                        <code className="tech-value font-mono">{technicalData?.consensusLayer?.rpcEndpoint}</code>
                      </div>
                      <div className="tech-item">
                        <span className="tech-label">Network Chain ID:</span>
                        <code className="tech-value font-mono">{technicalData?.consensusLayer?.chainId} (Local Testnet)</code>
                      </div>
                      <div className="tech-item">
                        <span className="tech-label">Core Contract:</span>
                        <code className="tech-value font-mono" style={{ fontSize: "11px" }}>
                          {technicalData?.consensusLayer?.contractAddress}
                        </code>
                      </div>
                      <div className="tech-item">
                        <span className="tech-label">Storage Vault:</span>
                        <span className="tech-value">
                          backend/uploads/ ({technicalData?.persistenceLayer?.storageVault?.fileCount} files, Read/Write OK)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION D: LOCAL DEVELOPMENT TOOLS (DEVELOPMENT ONLY)    */}
      {/* ======================================================== */}
      {allowDevTools && isHOD && (
        <section className="diagnostics-section" aria-labelledby="section-dev-tools" style={{ marginTop: "24px" }}>
          <div className="section-header-compact">
            <div>
              <span className="section-kicker">SECTION D</span>
              <h2 id="section-dev-tools" className="section-title-sm">
                Local Development Tools
              </h2>
            </div>
            <span className="badge badge-amber" style={{ fontSize: "10px" }}>
              DEVELOPMENT TESTNET ONLY
            </span>
          </div>

          <div className="card dev-tools-card">
            {/* Safe Testnet Notice */}
            <div className="dev-tools-notice">
              <strong>LOCAL DEVELOPMENT NOTICE:</strong> The accounts listed below are pre-seeded on the local Hardhat consensus node (Chain ID 31337) with mock test balances for automated regression testing and JSON-RPC diagnostics. Test ETH has zero monetary value. Private keys are never exposed in this interface or transmitted across API boundaries.
            </div>

            {/* Test Accounts Table */}
            <div className="table-wrapper-archival" style={{ border: "1px solid var(--border-subtle)", borderRadius: "2px" }}>
              <table className="archival-table" data-testid="dev-accounts-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>Idx</th>
                    <th style={{ width: "230px" }}>Officer Persona & Role</th>
                    <th>Public EVM Address</th>
                    <th style={{ width: "160px" }}>Test Balance</th>
                    <th style={{ width: "90px", textAlign: "right" }}>Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {devToolsData?.accounts ? (
                    devToolsData.accounts.map((acc) => (
                      <tr key={acc.index}>
                        <td className="font-mono" style={{ color: "var(--text-muted)" }}>
                          #{acc.index}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--navy-900)" }}>{acc.officer}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{acc.role}</div>
                        </td>
                        <td>
                          <code className="font-mono" style={{ fontSize: "12px", color: "var(--navy-900)" }}>
                            {acc.address}
                          </code>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)" }}>
                            {acc.testBalance}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleCopy(`acc-${acc.index}`, acc.address)}
                            data-testid={`btn-copy-acc-${acc.index}`}
                          >
                            {copiedTag === `acc-${acc.index}` ? "Copied" : "Copy"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>
                        Loading development accounts...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Safe Server-Side RPC Connectivity Tool */}
            <div className="safe-rpc-ping-tool" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "12.5px", color: "var(--navy-900)" }}>
                    Safe Server-Side JSON-RPC Query
                  </h4>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>
                    Queries <code>eth_blockNumber</code> via backend Web3 without browser CORS issues or ledger state mutation.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePingRPC}
                  disabled={pingingRPC}
                  data-testid="btn-ping-rpc"
                >
                  {pingingRPC ? "Querying Node..." : "Query eth_blockNumber"}
                </button>
              </div>

              {rpcPingResult && (
                <div
                  className={`rpc-result-box ${rpcPingResult.success ? "result-success" : "result-failure"}`}
                  data-testid="rpc-ping-result"
                  style={{ marginTop: "10px" }}
                >
                  {rpcPingResult.success ? (
                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                      <span>
                        Block Height: <strong className="font-mono">#{rpcPingResult.blockNumber}</strong> ({rpcPingResult.hexBlock})
                      </span>
                      <span>•</span>
                      <span>
                        Latency: <strong className="font-mono">{rpcPingResult.latencyMs} ms</strong>
                      </span>
                      <span>•</span>
                      <span style={{ color: "var(--emerald-800)" }}>
                        ✓ JSON-RPC 2.0 Nominal
                      </span>
                    </div>
                  ) : (
                    <div style={{ color: "var(--red-restrained)" }}>
                      RPC Query Error: {rpcPingResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
