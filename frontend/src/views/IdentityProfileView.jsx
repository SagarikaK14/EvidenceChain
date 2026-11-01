// ============================================================
// EvidenceChain: My Identity & Authorization View
// Strict Forensic & Institutional Verification Dashboard
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { getMeAPI, getDemoProfilesAPI, demoSwitchAPI } from "../api";

export function IdentityProfileView({
  currentUser,
  onRefreshUser,
  onLogout,
  onSwitchSuccess,
  onOpenLoginModal,
  backendConnected,
}) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

  // Demo Switcher Modal state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [demoProfiles, setDemoProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState(null);
  const [switcherError, setSwitcherError] = useState(null);

  // Load comprehensive profile data from GET /api/auth/me
  const fetchProfile = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await getMeAPI();
      if (res && res.status === "authenticated") {
        setProfileData(res);
        if (onRefreshUser && res.user) {
          // Keep root user synchronized
          onRefreshUser(res.user);
        }
      } else if (res && res.status === "unauthenticated") {
        setProfileData(null);
      } else {
        setError(res?.message || "Failed to load identity profile.");
      }
    } catch (err) {
      console.error("IdentityProfileView fetch error:", err);
      setError("Network or server error while querying identity profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onRefreshUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Open Demo Switcher modal
  const handleOpenSwitcher = async () => {
    setIsSwitcherOpen(true);
    setSwitcherError(null);
    setLoadingProfiles(true);
    try {
      const res = await getDemoProfilesAPI();
      if (res && res.status === "success") {
        setDemoProfiles(res.profiles || []);
      } else {
        setSwitcherError(res?.message || "Failed to retrieve demo profiles.");
      }
    } catch (err) {
      console.error("Failed to fetch demo profiles:", err);
      setSwitcherError("Unable to connect to authorization service.");
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Switch demo profile
  const handleSwitchProfile = async (targetEmail) => {
    setSwitchingEmail(targetEmail);
    setSwitcherError(null);
    try {
      const res = await demoSwitchAPI(targetEmail);
      if (res && res.status === "success") {
        setIsSwitcherOpen(false);
        // Refresh local data and notify App root
        await fetchProfile(true);
        if (onSwitchSuccess && res.user) {
          onSwitchSuccess(res.user);
        }
      } else {
        setSwitcherError(res?.message || "Failed to switch active identity.");
      }
    } catch (err) {
      console.error("Demo switch error:", err);
      setSwitcherError("Request failed while switching server identity.");
    } finally {
      setSwitchingEmail(null);
    }
  };

  // Copy full EVM wallet address to clipboard
  const handleCopyWallet = (address) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const user = profileData?.user || currentUser;
  const permissions = profileData?.permissions || [];
  const sessionMeta = profileData?.sessionMeta || {};
  const signingIdentity = profileData?.signingIdentity || {};

  const fullWalletAddress = signingIdentity.walletAddress || user?.walletAddress || "";
  const allowDemoSwitch = sessionMeta.allowDemoSwitch ?? (sessionMeta.environment !== "production");

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return "Not provided";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return isoString;
    }
  };

  // Format short address helper
  const formatAddress = (addr) => {
    if (!addr) return "Not registered";
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  // Compute session remaining time
  const computeTimeRemaining = (expiryIso) => {
    if (!expiryIso) return null;
    try {
      const diffMs = new Date(expiryIso).getTime() - Date.now();
      if (diffMs <= 0) return "Expired";
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) return `${hours} hr ${minutes} min remaining`;
      return `${minutes} min remaining`;
    } catch {
      return null;
    }
  };

  return (
    <div className="view-container identity-page-wrapper" data-testid="identity-profile-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* 1. Page Header Block */}
      <div className="page-header-block" style={{ marginBottom: "18px" }}>
        <div>
          <div className="system-pill" style={{ display: "inline-flex", marginBottom: "8px" }}>
            <span className="live-indicator"></span>
            INVESTIGATOR CREDENTIALS &amp; RBAC REGISTRY
          </div>
          <h1 className="page-title">Investigator Identity &amp; Authorization Credentials</h1>
          <p className="page-context-desc">
            Officer credential verification, role-based access authorities, advanced signing details, and active session security.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {allowDemoSwitch && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleOpenSwitcher}
              title="Switch demo profile for development and RBAC testing"
              data-testid="btn-demo-switch"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
              Switch Demo Profile
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchProfile(true)}
            disabled={refreshing}
            title="Refresh verified identity state from server"
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
                transform: refreshing ? "rotate(180deg)" : "none",
                transition: "transform 0.4s ease",
              }}
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Backend connection warning if offline */}
      {!backendConnected && (
        <div className="alert-banner alert-warning" style={{ marginBottom: "20px" }}>
          <strong>Gateway Disconnected:</strong> Backend API is currently unreachable. Displaying cached session state.
        </div>
      )}

      {/* Unauthenticated State */}
      {!loading && !user && (
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--navy-900)", marginBottom: "8px" }}>
            No Active Authenticated Session
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px", lineHeight: "1.5" }}>
            You are currently accessing the EvidenceChain portal in unauthenticated guest mode. Please sign in with your official forensic credentials to review your authorized permissions.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenLoginModal}
            style={{ margin: "0 auto" }}
          >
            Sign In with Official Credentials
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !profileData && (
        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }}></div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Querying verified identity, server-enforced permissions, and signing addresses...
          </p>
        </div>
      )}

      {/* Main Authenticated Dashboard */}
      {user && (
        <div className="identity-dashboard-grid">
          {/* ======================================================== */}
          {/* SECTION A: MY OFFICIAL PROFILE                           */}
          {/* ======================================================== */}
          <section className="identity-section" aria-labelledby="section-official-profile">
            <div className="section-header-compact">
              <div>
                <span className="section-kicker">SECTION A</span>
                <h2 id="section-official-profile" className="section-title-sm">
                  My Official Profile
                </h2>
              </div>
              <span className="badge badge-emerald" data-testid="account-status-badge">
                <span className="live-indicator"></span>
                {user.accountStatus || "ACTIVE"}
              </span>
            </div>

            <div className="card profile-overview-card">
              {/* Profile Lead Banner */}
              <div className="profile-lead-banner">
                <div className="profile-avatar">
                  {user.name ? (
                    user.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  ) : (
                    "OF"
                  )}
                </div>
                <div className="profile-lead-meta">
                  <div className="profile-name-row">
                    <h3 className="profile-full-name" data-testid="user-full-name">
                      {user.name || "Not provided"}
                    </h3>
                    <span className="role-pill-badge" data-testid="user-role-badge">
                      {user.role || "Not provided"}
                    </span>
                  </div>
                  <div className="profile-sub-meta">
                    <span>
                      <strong>Employee ID:</strong> {user.employeeId || "Not provided"}
                    </span>
                    <span className="meta-sep">•</span>
                    <span>
                      <strong>Dept:</strong> {user.department || "Not provided"}
                    </span>
                    <span className="meta-sep">•</span>
                    <span>
                      <strong>Org:</strong> {user.organization || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Factual Profile Grid */}
              <div className="profile-details-grid">
                <div className="profile-detail-cell">
                  <span className="detail-label">Full Name</span>
                  <span className="detail-value">{user.name || "Not provided"}</span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Employee / Officer ID</span>
                  <span className="detail-value font-mono">{user.employeeId || "Not provided"}</span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Official Designation</span>
                  <span className="detail-value">{user.designation || user.role || "Not provided"}</span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Assigned Department</span>
                  <span className="detail-value">{user.department || "Not provided"}</span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Parent Organization</span>
                  <span className="detail-value">{user.organization || "Not provided"}</span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Institutional Email</span>
                  <span className="detail-value font-mono">{user.email || "Not provided"}</span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Account Clearance Status</span>
                  <span className="detail-value">
                    <span className="badge badge-emerald" style={{ fontSize: "11px" }}>
                      {user.accountStatus || "ACTIVE"}
                    </span>
                  </span>
                </div>

                <div className="profile-detail-cell">
                  <span className="detail-label">Assigned Authorization Tier</span>
                  <span className="detail-value">
                    {user.role === "Head of Department" ? (
                      <span className="badge badge-primary" style={{ fontSize: "11px" }}>
                        Departmental Administrator (HOD)
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ fontSize: "11px" }}>
                        Forensic Examiner Tier
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* SECTION B: MY AUTHORITY & PERMISSIONS                    */}
          {/* ======================================================== */}
          <section className="identity-section" aria-labelledby="section-authority-matrix">
            <div className="section-header-compact">
              <div>
                <span className="section-kicker">SECTION B</span>
                <h2 id="section-authority-matrix" className="section-title-sm">
                  My Authority & Permissions
                </h2>
              </div>
              <span className="text-muted" style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                ROLE: {user.role?.toUpperCase() || "OFFICER"}
              </span>
            </div>

            <div className="card permissions-matrix-card">
              <div className="permissions-table-header">
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--navy-900)", margin: 0 }}>
                    Server-Enforced Access Control Matrix
                  </h4>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Permissions evaluated server-side by session role and smart-contract state.
                  </p>
                </div>
              </div>

              {/* Zero-Trust Architecture Notice */}
              <div className="zero-trust-callout" data-testid="zero-trust-callout">
                <div className="zero-trust-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="zero-trust-content">
                  <strong>Zero-Trust Access Principle:</strong> Administrative role status (e.g., Head of Department) grants departmental administration privileges, but does <em>not</em> grant automatic blanket access to view or download specific evidence files. File-level inspection and download permissions are explicitly granted per-evidence on the blockchain ledger or bound to active physical custody.
                </div>
              </div>

              {/* Permissions Register - Compact Operational View */}
              <div className="permissions-list">
                {permissions.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                    No explicit permissions mapped for this role configuration.
                  </div>
                ) : (
                  permissions.map((perm) => {
                    const isAllowed = perm.status === "ALLOWED";
                    const isEvidenceSpecific = perm.status === "EVIDENCE_SPECIFIC";
                    const isRestricted = perm.status === "RESTRICTED";

                    return (
                      <div key={perm.id} className="permission-row-item permission-row-compact" data-testid={`perm-${perm.id}`}>
                        <div className="permission-meta-col">
                          <div className="permission-name-line">
                            <span className="permission-name">{perm.name}</span>
                            <span className="permission-category-pill">{perm.category}</span>
                          </div>
                          <p className="permission-description-compact">{perm.description}</p>
                        </div>

                        <div className="permission-status-col">
                          {isAllowed && (
                            <span className="badge badge-emerald" title="Allowed by role credentials">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 4 }}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Allowed
                            </span>
                          )}

                          {isEvidenceSpecific && (
                            <span className="badge badge-azure" title="Evaluated per-evidence item on blockchain">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              Evidence-Specific
                            </span>
                          )}

                          {isRestricted && (
                            <span className="badge badge-amber" title="Restricted: Requires higher administrative authority">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                              Restricted
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Collapsed Technical Enforcement & Contract Methods Disclosure */}
              <details className="technical-enforcement-disclosure" data-testid="technical-enforcement-disclosure">
                <summary className="enforcement-summary-toggle">
                  <span className="summary-title-line">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                      <line x1="6" y1="6" x2="6.01" y2="6" />
                      <line x1="6" y1="18" x2="6.01" y2="18" />
                    </svg>
                    Technical Enforcement & Smart Contract Methods ({permissions.length} Verifiable Rules)
                  </span>
                  <span className="summary-status-hint">Click to expand on-chain method signatures and server rules</span>
                </summary>

                <div className="enforcement-table-container">
                  <table className="enforcement-table">
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>Permission</th>
                        <th style={{ width: "30%" }}>Backend Server Rule</th>
                        <th style={{ width: "34%" }}>Smart Contract Method / Signature</th>
                        <th style={{ width: "14%" }}>Scope</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong style={{ fontSize: "12px", color: "var(--navy-900)" }}>{p.name}</strong>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{p.id}</div>
                          </td>
                          <td style={{ fontSize: "11.5px", color: "var(--text-secondary)" }}>
                            {p.serverRule || p.enforcement}
                          </td>
                          <td style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", color: "#142535" }}>
                            <code>{p.contractMethod || p.enforcement}</code>
                          </td>
                          <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {p.scope || "Global"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>

          {/* ======================================================== */}
          {/* SECTION C: AUTHENTICATION & SESSION SECURITY             */}
          {/* ======================================================== */}
          <section className="identity-section" aria-labelledby="section-session-security">
            <div className="section-header-compact">
              <div>
                <span className="section-kicker">SECTION C</span>
                <h2 id="section-session-security" className="section-title-sm">
                  Authentication & Session Security
                </h2>
              </div>
              <span className="badge badge-outline">
                SECURE HTTP-ONLY
              </span>
            </div>

            <div className="card session-security-card">
              <div className="session-security-grid">
                <div className="session-param-item">
                  <span className="param-label">Session Status</span>
                  <div className="param-value-line">
                    <span className="live-indicator"></span>
                    <strong style={{ color: "var(--emerald-800)" }}>
                      Active (Authenticated)
                    </strong>
                  </div>
                </div>

                <div className="session-param-item">
                  <span className="param-label">Authentication Method</span>
                  <span className="param-value font-mono">
                    {sessionMeta.authMethod || "Development Authentication (Password + Dynamic MFA)"}
                  </span>
                </div>

                <div className="session-param-item">
                  <span className="param-label">Multi-Factor Status</span>
                  <span className="param-value">
                    <span className="badge badge-emerald" style={{ fontSize: "11px" }}>
                      {sessionMeta.mfaType || "Dynamic Challenge Token"} (Verified)
                    </span>
                  </span>
                </div>

                <div className="session-param-item">
                  <span className="param-label">Session Authenticated At</span>
                  <span className="param-value font-mono">
                    {formatDate(sessionMeta.authTime)}
                  </span>
                </div>

                <div className="session-param-item">
                  <span className="param-label">Session Expiration</span>
                  <div className="param-value font-mono">
                    {formatDate(sessionMeta.expiresAt)}
                    {sessionMeta.expiresAt && (
                      <span className="session-countdown-pill">
                        {computeTimeRemaining(sessionMeta.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="session-param-item">
                  <span className="param-label">Cookie Protection Flags</span>
                  <div className="param-value" style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                    <span className="badge badge-neutral" style={{ fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                      HttpOnly: {sessionMeta.cookieFlags?.httpOnly ? "True" : "False"}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                      SameSite: {sessionMeta.cookieFlags?.sameSite || "Lax"}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                      Secure: {sessionMeta.cookieFlags?.secure ? "True (HTTPS)" : "False (HTTP Local)"}
                    </span>
                  </div>
                </div>

                <div className="session-param-item">
                  <span className="param-label">Environment Mode</span>
                  <span className="param-value">
                    <span className="badge badge-neutral" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                      {sessionMeta.environment || "DEVELOPMENT"} (Local Ledger)
                    </span>
                  </span>
                </div>
              </div>

              {/* Session Controls Footer */}
              <div className="session-controls-footer">
                <div className="session-cookie-notice">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>
                    Session cookie is signed server-side with HMAC-SHA256 and protected with <code>HttpOnly=True</code> and <code>SameSite=Lax</code>. Client local storage is never used for credentials or private keys.
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={onLogout}
                  data-testid="btn-session-logout"
                  title="Securely terminate active server session"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Terminate Active Session
                </button>
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* SECTION D: ADVANCED SIGNING DETAILS                      */}
          {/* ======================================================== */}
          <section className="identity-section" aria-labelledby="section-signing-identity">
            <div className="section-header-compact">
              <div>
                <span className="section-kicker">SECTION D</span>
                <h2 id="section-signing-identity" className="section-title-sm">
                  Advanced Signing Details
                </h2>
              </div>
              <span className="badge badge-emerald">
                {signingIdentity.isLinked ? "LINKED (DATABASE REGISTRY)" : "UNLINKED"}
              </span>
            </div>

            <div className="card signing-identity-card">
              <div className="signing-identity-header">
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--navy-900)", margin: 0 }}>
                    Cryptographic Ledger Association
                  </h4>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Public EVM key bound to this personnel account for evidence registration and custody attribution.
                  </p>
                </div>
              </div>

              <div className="signing-address-block">
                <div className="address-display-row">
                  <div className="address-meta-tag">
                    <span className="address-tag-label">EVM PUBLIC ADDRESS</span>
                    <span className="network-tag">Hardhat 31337</span>
                  </div>

                  <div className="address-code-container">
                    <code className="address-code" data-testid="signing-wallet-address">
                      {fullWalletAddress || "No EVM address registered for this personnel profile"}
                    </code>

                    {fullWalletAddress && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs copy-address-btn"
                        onClick={() => handleCopyWallet(fullWalletAddress)}
                        title="Copy complete public address to clipboard"
                        data-testid="btn-copy-address"
                      >
                        {copied ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy Address
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="signing-details-row">
                  <div className="signing-detail-item">
                    <span className="detail-item-label">Binding Type</span>
                    <span className="detail-item-value">{signingIdentity.associationType || "Server Database Registry"}</span>
                  </div>
                  <div className="signing-detail-item">
                    <span className="detail-item-label">Target Network</span>
                    <span className="detail-item-value">{signingIdentity.networkName || "Hardhat Localhost"}</span>
                  </div>
                  <div className="signing-detail-item">
                    <span className="detail-item-label">Chain Identifier</span>
                    <span className="detail-item-value font-mono">Chain ID {signingIdentity.chainId || 31337}</span>
                  </div>
                  <div className="signing-detail-item">
                    <span className="detail-item-label">Core Contract</span>
                    <span className="detail-item-value font-mono" title={signingIdentity.contractAddress}>
                      {formatAddress(signingIdentity.contractAddress)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Architecture & Cryptographic Disclosure Accordion */}
              <div className="technical-disclosure-accordion">
                <button
                  type="button"
                  className="accordion-toggle-btn"
                  onClick={() => setShowDisclosure(!showDisclosure)}
                  aria-expanded={showDisclosure}
                  data-testid="btn-toggle-disclosure"
                >
                  <span className="toggle-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    Technical Architecture & Cryptographic Disclosure
                  </span>
                  <span className="toggle-icon">{showDisclosure ? "▲ Collapse" : "▼ Expand Details"}</span>
                </button>

                {showDisclosure && (
                  <div className="accordion-content-panel" data-testid="disclosure-content">
                    <div className="disclosure-paragraph">
                      <strong>1. Database Mapping vs. Private Key Custody:</strong> This EVM address is mapped to your personnel profile in the institutional database to anchor on-chain transactions and verify custody transfers. The database mapping links identity to an address; in this local development environment, transactions are signed by pre-funded accounts or the backend gateway.
                    </div>
                    <div className="disclosure-paragraph">
                      <strong>2. Signing Key Association:</strong> Personnel signing addresses are associated with verified officer profiles in the system registry to attribute custody events and verification signatures.
                    </div>
                    <div className="disclosure-paragraph">
                      <strong>3. Chain of Custody Attestation:</strong> When you register evidence or accept custody transfers, this public address is committed to the blockchain block as the immutable custodian identifier.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SWITCH DEMO PROFILE (DEVELOPMENT ONLY)            */}
      {/* ======================================================== */}
      {isSwitcherOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="modal-demo-switcher">
          <div className="modal-dialog demo-switcher-modal">
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge badge-amber" style={{ fontSize: "10px" }}>DEVELOPMENT ONLY</span>
                <h3 className="modal-title">Switch Development Profile</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSwitcherOpen(false)}
                aria-label="Close switcher dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-lead-text">
                Select an institutional test profile to simulate different role authorities (HOD vs. Forensic Examiner) and evaluate permission checks. Switching re-issues your server session cookie.
              </p>

              {switcherError && (
                <div className="alert-banner alert-danger" style={{ marginBottom: "16px" }}>
                  {switcherError}
                </div>
              )}

              {loadingProfiles ? (
                <div style={{ padding: "30px", textAlign: "center" }}>
                  <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading configured demo profiles...</span>
                </div>
              ) : (
                <div className="demo-profiles-container">
                  {demoProfiles.map((p) => {
                    const isCurrent = (user?.email && user.email.toLowerCase() === p.email.toLowerCase()) ||
                                      (user?.employeeId && user.employeeId === p.employeeId);
                    const isSwitching = switchingEmail === p.email;

                    return (
                      <div
                        key={p.id}
                        className={`demo-profile-row ${isCurrent ? "active-profile-row" : ""}`}
                        data-testid={`demo-profile-${p.id}`}
                      >
                        <div className="demo-avatar">
                          {p.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>

                        <div className="demo-meta">
                          <div className="demo-title-line">
                            <strong className="demo-name">{p.name}</strong>
                            {isCurrent && (
                              <span className="badge badge-emerald badge-xs" data-testid="badge-current-profile">
                                CURRENT ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="demo-sub-line">
                            <span className="demo-role-tag">{p.role}</span>
                            <span className="demo-emp-id font-mono">ID: {p.employeeId}</span>
                            <span className="demo-dept">{p.department}</span>
                          </div>
                          <div className="demo-wallet-line font-mono">
                            {formatAddress(p.walletAddress)}
                          </div>
                        </div>

                        <div className="demo-action">
                          {isCurrent ? (
                            <button type="button" className="btn btn-secondary btn-xs" disabled>
                              Active
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => handleSwitchProfile(p.email)}
                              disabled={switchingEmail !== null}
                              data-testid={`btn-select-profile-${p.id}`}
                            >
                              {isSwitching ? "Switching..." : "Switch Session"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Note: In production environments, this endpoint and switcher are disabled with HTTP 403.
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsSwitcherOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
