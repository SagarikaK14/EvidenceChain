// ============================================================
// EvidenceChain Navigation Sidebar - Forensic Operations Shell
// Strict Forensic Editorial Architecture & Precision Folio Design
// ============================================================

import { useState } from "react";

export function Sidebar({
  activeView,
  setActiveView,
  currentUser,
  onOpenLogin,
  onLogout,
  backendConnected,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const operationsNav = [
    {
      id: "dashboard",
      label: "Operational Dashboard",
      code: "[01]",
    },
    {
      id: "evidence",
      label: "Evidence Repository",
      code: "[02]",
    },
    {
      id: "register",
      label: "Register Evidence",
      code: "[03]",
    },
    {
      id: "verify",
      label: "Verify Integrity",
      code: "[04]",
    },
  ];

  const authorityNav = [
    {
      id: "department",
      label: "Department Authority",
      code: "[05]",
      badge: "HOD",
    },
  ];

  const securityNav = [
    {
      id: "access",
      label: "Access Management",
      code: "[06]",
    },
    {
      id: "history",
      label: "Access History",
      code: "[07]",
    },
  ];

  const systemNav = [
    {
      id: "profile",
      label: "My Identity & Credentials",
      code: "[08]",
    },
    {
      id: "status",
      label: "System Health",
      code: "[09]",
      statusDot: backendConnected ? "online" : "offline",
    },
  ];

  const renderNavGroup = (title, items) => (
    <div className="nav-group-block" key={title} style={{ marginBottom: "16px" }}>
      <div 
        className="nav-group-title" 
        style={{ 
          fontFamily: "var(--font-mono)", 
          fontSize: "9.5px", 
          letterSpacing: "0.1em", 
          color: "var(--text-muted)", 
          padding: "0 12px 6px 12px",
          fontWeight: 700 
        }}
      >
        {title}
      </div>
      <ul className="nav-items-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item) => {
          const isActive = activeView === item.id;
          return (
            <li key={item.id} style={{ marginBottom: "2px" }}>
              <button
                type="button"
                className={`sidebar-nav-btn-v2 ${isActive ? "nav-active-v2" : ""}`}
                data-testid={`nav-${item.id}`}
                onClick={() => {
                  setActiveView(item.id);
                  setMobileMenuOpen(false);
                }}
                title={item.label}
              >
                {isActive && <span className="nav-active-rail" />}
                <span className="nav-folio-code">{item.code}</span>
                <span className="sidebar-nav-label" style={{ flex: 1, letterSpacing: "-0.01em" }}>
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      padding: "1px 5px",
                      backgroundColor: "var(--ochre-subtle)",
                      color: "var(--ochre-archival)",
                      border: "1px solid var(--ochre-border)",
                      borderRadius: "2px",
                      marginLeft: "auto",
                      fontWeight: 600,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.statusDot && (
                  <span
                    className={`nav-status-indicator ${
                      item.statusDot === "online" ? "dot-online" : "dot-offline"
                    }`}
                    title={`Backend status: ${item.statusDot}`}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <aside className="app-sidebar">
      {/* Brand Header with Precision Forensic Crest & Mobile Menu Toggle */}
      <div className="sidebar-brand" style={{ padding: "16px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          className="brand-header-link-v2"
          onClick={() => {
            setActiveView("dashboard");
            setMobileMenuOpen(false);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="brand-crest-frame">
            {/* Heraldic Cryptographic Seal SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z"
                stroke="#E2EAE5"
                strokeWidth="1.5"
                fill="rgba(40, 122, 88, 0.25)"
              />
              <path
                d="M12 7V17M7 12H17"
                stroke="#FAF7F2"
                strokeWidth="1.2"
                strokeDasharray="2 1"
              />
              <circle cx="12" cy="12" r="2.5" fill="#FAF7F2" />
            </svg>
          </div>
          <div>
            <div className="brand-title" style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 700, letterSpacing: "0.02em", color: "var(--text-primary)" }}>
              EvidenceChain
            </div>
            <div className="brand-subtitle" style={{ fontFamily: "var(--font-mono)", fontSize: "8.5px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              DIGITAL EVIDENCE & CUSTODY
            </div>
          </div>
        </div>

        {/* Mobile View Toggle */}
        <button
          type="button"
          className="sidebar-mobile-toggle btn-tactile-secondary"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          style={{ padding: "4px 8px", fontSize: "10px", fontFamily: "var(--font-mono)" }}
        >
          {mobileMenuOpen ? "✕ CLOSE" : "☰ MENU"}
        </button>
      </div>

      {/* Navigation Folios */}
      <div className={`sidebar-nav-container ${mobileMenuOpen ? "mobile-nav-visible" : "mobile-nav-hidden"}`} style={{ padding: "16px 8px", flex: 1, overflowY: "auto" }}>
        {renderNavGroup("OPERATIONS", operationsNav)}
        {renderNavGroup("COMMAND & AUTHORITY", authorityNav)}
        {renderNavGroup("ACCESS CONTROL", securityNav)}
        {renderNavGroup("SYSTEM", systemNav)}
      </div>

      {/* Officer Credential Card with Live Status Beacon */}
      <div className={`sidebar-footer-card ${mobileMenuOpen ? "mobile-nav-visible" : "mobile-nav-hidden"}`} style={{ padding: "14px 16px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--surface-primary)" }}>
        <div
          className="officer-badge-link"
          onClick={() => {
            setActiveView("profile");
            setMobileMenuOpen(false);
          }}
          title="Inspect verified officer credentials"
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer", marginBottom: "8px" }}
        >
          <div className="officer-name" style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
            {currentUser?.name || "Rahul Sharma"}
          </div>
          <div className="officer-role" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            {currentUser?.role || "Digital Forensics Officer"}
          </div>
          <div className="officer-unit" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
            {currentUser?.department || "Cyber Crime Unit"} • {currentUser?.employeeId || "OFF-1024"}
          </div>
        </div>

        <div className="officer-status-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span 
            className={`badge-clean ${currentUser?.identityStatus === "VERIFIED" ? "badge-verified" : "badge-neutral"}`}
            style={{ fontSize: "9.5px", padding: "2px 6px", display: "inline-flex", alignItems: "center" }}
            title={`Session identity status: ${currentUser?.identityStatus || "UNVERIFIED"}`}
          >
            {currentUser?.identityStatus === "VERIFIED" && <span className="officer-pulse-beacon" />}
            {currentUser?.identityStatus || "UNVERIFIED"}
          </span>
          <button
            type="button"
            className="btn-session-switch"
            onClick={onLogout}
            title="Securely terminate session and return to portal"
            style={{ fontSize: "10px", fontFamily: "var(--font-mono)", padding: "2px 8px" }}
          >
            LOGOUT
          </button>
        </div>
      </div>
    </aside>
  );
}
