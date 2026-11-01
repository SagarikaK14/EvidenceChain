// ============================================================
// EvidenceChain Product-First Landing Page
// Digital Evidence Management & Chain of Custody
// Headline: Every Piece of Evidence. Accounted For.
// Change Set 02: Scroll Reveal, Network Visualization & Interactive Lifecycle
// ============================================================

import { useState, useEffect, useRef } from "react";

export function LandingPageView({ onNavigateToLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live cryptographic hash resolving demonstration in hero
  const [displayedHash, setDisplayedHash] = useState(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
  const [isHashVerified, setIsHashVerified] = useState(true);

  // Interactive Evidence Lifecycle State: Register → Hash → Anchor → Verify → Audit
  const [activeLifecycleIndex, setActiveLifecycleIndex] = useState(0);
  const [isLifecyclePlaying, setIsLifecyclePlaying] = useState(false);
  const lifecycleAutoTimerRef = useRef(null);

  // Scroll Position & Motion Tracking
  const [scrollY, setScrollY] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [lifecycleScrollProgress, setLifecycleScrollProgress] = useState(0);
  const [isManualLifecycleOverride, setIsManualLifecycleOverride] = useState(false);
  const manualOverrideTimerRef = useRef(null);

  // DOM References for scroll tracking
  const heroRef = useRef(null);
  const blockchainVizRef = useRef(null);
  const lifecycleRef = useRef(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // High-performance passive scroll handler via requestAnimationFrame
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
          setScrollY(currentScrollY);

          // Track Lifecycle Section Scroll Progress
          if (lifecycleRef.current) {
            const rect = lifecycleRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const startY = windowHeight * 0.75;
            const endY = -rect.height * 0.25;
            const totalDistance = startY - endY;
            const currentDistance = startY - rect.top;
            const progress = Math.max(0, Math.min(1, currentDistance / totalDistance));
            setLifecycleScrollProgress(progress);

            // If user has not manually pinned a step, drive lifecycle stage from scroll progress
            if (!isManualLifecycleOverride) {
              const stepIndex = Math.min(4, Math.floor(progress * 5));
              setActiveLifecycleIndex(stepIndex);
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [isManualLifecycleOverride]);

  // Scroll reveal IntersectionObserver for section entry
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    const elements = document.querySelectorAll(".ec-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Hero SHA-256 Hash scramble cycle
  useEffect(() => {
    const targetHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const hexChars = "0123456789abcdef";
    let interval = null;
    let stepCount = 0;

    const runCycle = () => {
      stepCount = 0;
      setIsHashVerified(false);
      interval = setInterval(() => {
        stepCount++;
        if (stepCount < 10) {
          const scrambled = targetHash
            .split("")
            .map((char, idx) => {
              if (idx < 12 || idx > 52) return char;
              return hexChars[Math.floor(Math.random() * hexChars.length)];
            })
            .join("");
          setDisplayedHash(scrambled);
        } else {
          setDisplayedHash(targetHash);
          setIsHashVerified(true);
          clearInterval(interval);
        }
      }, 90);
    };

    const loopTimer = setInterval(runCycle, 9000);
    return () => {
      clearInterval(interval);
      clearInterval(loopTimer);
    };
  }, []);

  // Handle manual tab selection on Lifecycle
  const handleSelectLifecycleStep = (index) => {
    setActiveLifecycleIndex(index);
    setIsManualLifecycleOverride(true);
    if (manualOverrideTimerRef.current) clearTimeout(manualOverrideTimerRef.current);
    // Return to scroll-driven control after 6 seconds of inactivity
    manualOverrideTimerRef.current = setTimeout(() => {
      setIsManualLifecycleOverride(false);
    }, 6000);
  };

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Compute scroll-driven visual transformations
  const heroScale = prefersReducedMotion ? 1 : Math.max(0.92, 1 - (scrollY / 600) * 0.08);
  const heroOpacity = prefersReducedMotion ? 1 : Math.max(0.4, 1 - (scrollY / 550) * 0.6);
  const heroTranslateY = prefersReducedMotion ? 0 : Math.min(50, scrollY * 0.12);
  const bgParallaxOrb1 = prefersReducedMotion ? 0 : scrollY * -0.15;
  const bgParallaxOrb2 = prefersReducedMotion ? 0 : scrollY * 0.1;
  const conduitOffset = prefersReducedMotion ? 0 : -(scrollY * 0.35);

  // 5 Stages of Digital Custody: Register → Hash → Anchor → Verify → Audit
  const LIFECYCLE_STAGES = [
    {
      id: "register",
      stepNumber: "01",
      stepName: "Register",
      badge: "CLIENT INTAKE • ZERO FILE EXPOSURE",
      title: "Intake & Case Docket Binding",
      description:
        "Forensic examiners and investigating officers intake digital evidence files (surveillance recordings, memory dumps, disk captures), bind them to verified case dockets, and record chain-of-acquisition metadata in-memory.",
      guarantees: [
        { label: "Zero Raw File Exfiltration", text: "Binary payloads remain strictly inside authorized client memory." },
        { label: "Standardized Docketing", text: "Automated binding of case docket, acquisition time, and examiner ID." },
      ],
      previewTitle: "EVIDENCE DOSSIER INTAKE • CASE #CR-2026-8841",
      previewStatus: "ACQUISITION READY",
      statusColor: "#38BDF8",
      codeSnippet: `FILE: cctv_surveillance_cam04_hd.mp4 (48.6 MB)
CASE_DOCKET: CASE-2026-CYBER-091
EXAMINER: Rahul Sharma (OFF-1024)
INTAKE_STATUS: ACQUIRED_IN_MEMORY
PERMISSIONS: DEFAULT_RESTRICTED (View/Download Locked)`,
    },
    {
      id: "hash",
      stepNumber: "02",
      stepName: "Hash",
      badge: "FIPS 180-4 CRYPTOGRAPHIC DIGEST",
      title: "SHA-256 Bitwise Computation",
      description:
        "EvidenceChain computes an unambiguous 256-bit SHA-256 cryptographic digest before any transaction is submitted. Even a single-bit alteration produces a completely divergent hash, providing mathematical certainty of content.",
      guarantees: [
        { label: "Bitwise Determinism", text: "Mathematical SHA-256 fingerprint computed before ledger dispatch." },
        { label: "Client-Side In-Memory Execution", text: "Zero network transmission of sensitive investigation files." },
      ],
      previewTitle: "FIPS 180-4 HASH ENGINE • 256-BIT CHECKSUM",
      previewStatus: "COMPUTED IN 4.2ms",
      statusColor: "#F59E0B",
      codeSnippet: `ALGORITHM: SHA-256 (FIPS 180-4 Standard)
FILE_SIZE: 50,960,793 bytes
DIGEST: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
EXECUTION_LATENCY: 4.2ms (Zero Network Overhead)
COLLISION_PROBABILITY: 2^-128 (Negligible)`,
    },
    {
      id: "anchor",
      stepNumber: "03",
      stepName: "Anchor",
      badge: "SMART CONTRACT TRANSACTION • BLOCK #113",
      title: "Blockchain Ledger Commitment",
      description:
        "The computed SHA-256 fingerprint, acquisition timestamp, docket identifier, and custodian Ethereum address are committed as an immutable smart contract transaction on the local Foundry/Anvil blockchain.",
      guarantees: [
        { label: "Decentralized Timestamping", text: "Permanent, tamper-proof proof of existence anchored on-chain." },
        { label: "Cryptographic Non-Repudiation", text: "Irrevocably signed by the examiner's authorized key pair." },
      ],
      previewTitle: "FOUNDRY ANVIL TRANSACTION • CHAIN ID 31337",
      previewStatus: "COMMITTED_ON_CHAIN",
      statusColor: "#10B981",
      codeSnippet: `TRANSACTION_HASH: 0x1df56798f438c10de2a048... (Block #113)
CONTRACT_ADDRESS: 0x5FbDB2315678afecb367f032d93F642f64180aa3
EVENT_EMITTED: EvidenceRegistered(EVD-1C836B77)
LEDGER_GAS: 68,421 units
CONSENSUS_FINALITY: 100% IMMUTABLE`,
    },
    {
      id: "verify",
      stepNumber: "04",
      stepName: "Verify",
      badge: "MATHEMATICAL INTEGRITY • 100% MATCH",
      title: "Cryptographic Authenticity Matching",
      description:
        "Judicial authorities, defense counsel, or independent forensic auditors can re-verify any working copy at any time. The system re-hashes the candidate file and compares it bit-for-bit against the immutable blockchain anchor.",
      guarantees: [
        { label: "Zero-Divergence Detection", text: "Instant identification of corrupted or maliciously modified media." },
        { label: "Judicial Admissibility", text: "Satisfies statutory digital evidence verification standards." },
      ],
      previewTitle: "INTEGRITY COMPARISON MATRIX • REAL-TIME",
      previewStatus: "AUTHENTIC • ZERO TAMPERING",
      statusColor: "#10B981",
      codeSnippet: `CANDIDATE_DIGEST: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
LEDGER_ANCHOR:    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
DIVERGENT_BITS:   0 / 256 bits (Exact Bitwise Equality)
VERDICT:          100% AUTHENTIC_HISTORICAL_RECORD`,
    },
    {
      id: "audit",
      stepNumber: "05",
      stepName: "Audit",
      badge: "DUAL-TIER PERMISSIONS • AUDIT TRAIL",
      title: "Custodial Trail & Judicial Export",
      description:
        "Department Authority enforces granular separation between in-browser viewing and binary file export. Every view, custody transfer, permission grant, and verification event is appended to an immutable chronological register.",
      guarantees: [
        { label: "Dual-Tier Access Control", text: "View privileges can be granted without permitting raw downloads." },
        { label: "Permanent Audit Register", text: "Every custodial inspection generates an unalterable audit entry." },
      ],
      previewTitle: "CUSTODY REGISTER & ACCESS CONTROL LOG",
      previewStatus: "AUDIT LOG FINALIZED",
      statusColor: "#C084FC",
      codeSnippet: `HOD_AUTHORIZATION: Dr. Rajeshwar Sen (HOD-0001)
VIEW_PRIVILEGE:     AUTHORIZED (Analyst Ananya Patel)
EXPORT_PRIVILEGE:   RESTRICTED (Supervisor Approval Required)
ACCESS_EVENTS:      Intake -> Hash -> Anchor -> Verified
DISCOVERY_EXPORT:   Courtroom Certificate Generated`,
    },
  ];

  const currentStage = LIFECYCLE_STAGES[activeLifecycleIndex];

  return (
    <div className="landing-container">
      {/* Top Demonstration Notice Banner */}
      <div
        style={{
          backgroundColor: "#0B132B",
          color: "#94A3B8",
          fontSize: "12px",
          padding: "7px 16px",
          textAlign: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          letterSpacing: "0.2px"
        }}
      >
        <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
        <span><strong>Public Demonstration Environment:</strong> Operating on synthetic evidence, non-durable uploads, and an isolated local development blockchain (Anvil EVM Chain ID 31337).</span>
      </div>

      {/* ============================================================
          TOP NAVIGATION BAR
          ============================================================ */}
      <header className="landing-navbar" role="banner">
        <div className="landing-nav-inner">
          {/* Brand Identity */}
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="brand-crest-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L4 6V12C4 17.5 7.4 22.6 12 24C16.6 22.6 20 17.5 20 12V6L12 2Z" fill="#0B132B" stroke="#287A58" strokeWidth="1.5"/>
                <path d="M12 6V18" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 12H17" stroke="#287A58" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="3.5" fill="#0B132B" stroke="#C99436" strokeWidth="1.2"/>
                <circle cx="12" cy="12" r="1.2" fill="#FFFFFF"/>
              </svg>
            </div>
            <div className="brand-text-block">
              <span className="brand-heading">EvidenceChain</span>
              <span className="brand-subheading">DIGITAL EVIDENCE MANAGEMENT & CHAIN OF CUSTODY</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="landing-nav-links" aria-label="Main Navigation">
            <button type="button" className="nav-link-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Overview
            </button>
            <button type="button" className="nav-link-btn" onClick={() => scrollToSection("lifecycle")}>
              Lifecycle
            </button>
            <button type="button" className="nav-link-btn" onClick={() => scrollToSection("features")}>
              Capabilities
            </button>
            <button type="button" className="nav-link-btn" onClick={() => scrollToSection("how-it-works")}>
              Workflow
            </button>
            <button type="button" className="nav-link-btn" onClick={() => scrollToSection("architecture")}>
              Security Architecture
            </button>
          </nav>

          {/* Sign In Control */}
          <div className="landing-nav-actions">
            <button
              type="button"
              className="btn-landing-signin"
              onClick={onNavigateToLogin}
              id="landing-signin-btn"
              aria-label="Sign In to Investigator Portal"
            >
              <span className="btn-signin-text">Sign In</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle Navigation Menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="7" x2="21" y2="7" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="17" x2="21" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="mobile-nav-menu">
            <button type="button" className="mobile-nav-item" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMobileMenuOpen(false); }}>
              Overview
            </button>
            <button type="button" className="mobile-nav-item" onClick={() => scrollToSection("lifecycle")}>
              Lifecycle
            </button>
            <button type="button" className="mobile-nav-item" onClick={() => scrollToSection("features")}>
              Capabilities
            </button>
            <button type="button" className="mobile-nav-item" onClick={() => scrollToSection("how-it-works")}>
              Workflow
            </button>
            <button type="button" className="mobile-nav-item" onClick={() => scrollToSection("architecture")}>
              Security Architecture
            </button>
            <button type="button" className="mobile-nav-item mobile-signin-btn" onClick={onNavigateToLogin}>
              Sign In to Investigator Portal →
            </button>
          </div>
        )}
      </header>

      {/* ============================================================
          HERO SECTION: Every Piece of Evidence. Accounted For.
          ============================================================ */}
      <section className="landing-hero" aria-label="Hero Introduction" ref={heroRef}>
        <div className="hero-ambient-glow" style={{ transform: `translateY(${bgParallaxOrb1}px)` }} aria-hidden="true" />

        <div
          className="landing-hero-content"
          style={{
            transform: `scale(${heroScale}) translateY(${heroTranslateY}px)`,
            opacity: heroOpacity,
            transformOrigin: "top center",
            willChange: "transform, opacity",
          }}
        >
          {/* Left Column: Product Positioning & Value */}
          <div className="hero-text-column ec-reveal is-revealed">
            <div className="hero-tag-badge">
              <span className="hero-tag-dot" />
              <span className="hero-tag-label">DIGITAL EVIDENCE MANAGEMENT • CHAIN OF CUSTODY</span>
            </div>

            <h1 className="hero-headline">
              Every Piece of Evidence.
              <span className="hero-headline-accent"> Accounted For.</span>
            </h1>

            <p className="hero-lead-text">
              Organize, protect, verify, and track digital evidence through every stage of an investigation. EvidenceChain provides investigative agencies, forensic laboratories, and legal teams with a unified environment for evidence intake, granular access governance, and verifiable chain-of-custody tracking.
            </p>

            <div className="hero-action-group">
              <button
                type="button"
                className="btn-hero-primary"
                onClick={onNavigateToLogin}
                id="hero-portal-btn"
              >
                <span>Enter Investigator Portal</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <button
                type="button"
                className="btn-hero-secondary"
                onClick={() => scrollToSection("lifecycle")}
              >
                <span>Explore Lifecycle</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </button>
            </div>

            {/* Platform Specifications Strip */}
            <div className="hero-specs-strip">
              <div className="spec-item">
                <span className="spec-value">Central Repository</span>
                <span className="spec-label">Case Dossiers & Files</span>
              </div>
              <div className="spec-divider" />
              <div className="spec-item">
                <span className="spec-value">Integrity Verification</span>
                <span className="spec-label">Bitwise SHA-256 Matching</span>
              </div>
              <div className="spec-divider" />
              <div className="spec-item">
                <span className="spec-value">Dual-Tier Control</span>
                <span className="spec-label">Separate View & Export</span>
              </div>
              <div className="spec-divider" />
              <div className="spec-item">
                <span className="spec-value">Audit Trail</span>
                <span className="spec-label">Complete Custody Logs</span>
              </div>
            </div>
          </div>

          {/* Right Column: Authentic Digital Evidence Dossier Preview */}
          <div className="hero-artwork-column ec-reveal is-revealed" aria-label="Digital Evidence Dossier Preview">
            <div className="artwork-card-wrapper">
              <div className="floating-evidence-card" style={{ maxWidth: "460px" }}>
                <div
                  className="demo-preview-ribbon"
                  style={{
                    fontSize: "10.5px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    color: "var(--green-deep)",
                    backgroundColor: "rgba(40, 122, 88, 0.12)",
                    border: "1px solid rgba(40, 122, 88, 0.25)",
                    borderRadius: "3px",
                    padding: "3px 10px",
                    marginBottom: "12px",
                    display: "inline-block",
                    textTransform: "uppercase",
                  }}
                >
                  Evidence Dossier Preview • Case File
                </div>

                <div className="card-header-row">
                  <div className="card-title-group">
                    <span className="card-badge-docket">CASE DOCKET</span>
                    <span className="card-docket-id">CASE #CR-2026-8841</span>
                  </div>
                  <div className="card-status-badge">
                    <span className="status-live-dot" />
                    <span>CUSTODY ACTIVE</span>
                  </div>
                </div>

                <div className="card-file-row">
                  <div className="file-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className="file-details">
                    <div className="file-name" style={{ fontWeight: 600 }}>cctv_surveillance_cam04_hd.mp4</div>
                    <div className="file-meta">Digital Video • 48.6 MB • Registered by Examiner Sharma (OFF-1024)</div>
                  </div>
                </div>

                {/* Animated SHA-256 Fingerprint Matching */}
                <div className="card-hash-section">
                  <div className="hash-header-line">
                    <span className="hash-header-title">FILE FINGERPRINT (SHA-256)</span>
                    <span className={`hash-status-pill ${isHashVerified ? "status-verified" : "status-computing"}`}>
                      {isHashVerified ? "✓ FINGERPRINT MATCHED" : "COMPUTING HASH..."}
                    </span>
                  </div>
                  <div className="hash-code-display" title={displayedHash}>
                    <code>{displayedHash}</code>
                  </div>
                </div>

                {/* Dual-Tier Access Permissions Grid */}
                <div className="card-permissions-grid">
                  <div className="perm-box perm-allowed">
                    <div className="perm-label">VIEW PERMISSION</div>
                    <div className="perm-value">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>AUTHORIZED</span>
                    </div>
                  </div>
                  <div className="perm-box perm-restricted">
                    <div className="perm-label">EXPORT PERMISSION</div>
                    <div className="perm-value">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>RESTRICTED</span>
                    </div>
                  </div>
                </div>

                {/* Custody Reference Strip */}
                <div className="card-anchor-footer">
                  <span className="anchor-label">Vault Storage Reference:</span>
                  <code className="anchor-address">vault://evidence/EVD-E1D9268D/cctv_surveillance_cam04_hd.mp4</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          LIGHTWEIGHT ANIMATED BLOCKCHAIN NETWORK VISUALIZATION
          ============================================================ */}
      <section className="blockchain-viz-section" aria-label="Cryptographic Network Topology">
        <div className="blockchain-viz-container ec-reveal">
          <div className="blockchain-viz-header">
            <div className="blockchain-viz-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9933" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              <span>Cryptographic Chain of Custody Network Topology</span>
            </div>
            <div className="blockchain-viz-telemetry">
              <span className="viz-telemetry-badge">
                <span className="viz-pulse-dot" />
                <span>Foundry / Anvil (Chain ID 31337)</span>
              </span>
              <span>Ledger: <strong style={{ color: "#E2E8F0" }}>Active</strong></span>
              <span>Block: <strong style={{ color: "#FF9933" }}>#113</strong></span>
              <span>Gas: <strong style={{ color: "#38BDF8" }}>21,000 avg</strong></span>
            </div>
          </div>

          {/* Scalable SVG Visualization Canvas */}
          <svg className="blockchain-svg-canvas" viewBox="0 0 880 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Interactive Blockchain Conduits Diagram">
            <defs>
              <linearGradient id="conduitGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF9933" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#287A58" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="conduitGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#287A58" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="conduitGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#C084FC" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Connecting Conduits with animated dash flows */}
            <path d="M 110 80 Q 185 30, 260 80" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" />
            <path d="M 110 80 Q 185 30, 260 80" stroke="url(#conduitGrad1)" strokeWidth="2" strokeDasharray="6 6" strokeDashoffset={conduitOffset} fill="none" className="network-data-flow" />

            <path d="M 260 80 Q 355 130, 450 80" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" />
            <path d="M 260 80 Q 355 130, 450 80" stroke="url(#conduitGrad2)" strokeWidth="2" strokeDasharray="6 6" strokeDashoffset={conduitOffset * 1.1} fill="none" className="network-data-flow" />

            <path d="M 450 80 Q 545 30, 640 80" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" />
            <path d="M 450 80 Q 545 30, 640 80" stroke="url(#conduitGrad2)" strokeWidth="2" strokeDasharray="6 6" strokeDashoffset={conduitOffset * 0.9} fill="none" className="network-data-flow" />

            <path d="M 640 80 Q 725 130, 810 80" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" />
            <path d="M 640 80 Q 725 130, 810 80" stroke="url(#conduitGrad3)" strokeWidth="2" strokeDasharray="6 6" strokeDashoffset={conduitOffset * 1.2} fill="none" className="network-data-flow" />

            {/* Node 1: Evidence Intake */}
            <g transform="translate(110, 80)">
              <circle r="22" fill="#0B132B" stroke="#FF9933" strokeWidth="2" />
              <circle r="16" fill="rgba(255, 153, 51, 0.2)" className="pulse-glow-ring" />
              <circle r="6" fill="#FF9933" />
              <text y="-32" textAnchor="middle" fill="#FFFFFF" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">01. INTAKE</text>
              <text y="38" textAnchor="middle" fill="#94A3B8" fontFamily="var(--font-mono)" fontSize="9">Client Memory</text>
            </g>

            {/* Node 2: Cryptographic Engine */}
            <g transform="translate(260, 80)">
              <circle r="22" fill="#0B132B" stroke="#287A58" strokeWidth="2" />
              <circle r="16" fill="rgba(40, 122, 88, 0.2)" className="pulse-glow-ring" />
              <circle r="6" fill="#287A58" />
              <text y="-32" textAnchor="middle" fill="#FFFFFF" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">02. HASH</text>
              <text y="38" textAnchor="middle" fill="#94A3B8" fontFamily="var(--font-mono)" fontSize="9">SHA-256 Engine</text>
            </g>

            {/* Node 3: Smart Contract Anchor */}
            <g transform="translate(450, 80)">
              <circle r="26" fill="#0B132B" stroke="#FF9933" strokeWidth="2.5" />
              <circle r="20" fill="rgba(255, 153, 51, 0.25)" className="pulse-glow-ring" />
              <circle r="7" fill="#FF9933" />
              <text y="-36" textAnchor="middle" fill="#FF9933" fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="700">03. SMART CONTRACT</text>
              <text y="42" textAnchor="middle" fill="#CBD5E1" fontFamily="var(--font-mono)" fontSize="9">0x5FbDB... (Anvil)</text>
            </g>

            {/* Node 4: Block Finality */}
            <g transform="translate(640, 80)">
              <circle r="22" fill="#0B132B" stroke="#38BDF8" strokeWidth="2" />
              <circle r="16" fill="rgba(56, 189, 248, 0.2)" className="pulse-glow-ring" />
              <circle r="6" fill="#38BDF8" />
              <text y="-32" textAnchor="middle" fill="#FFFFFF" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">04. BLOCK #113</text>
              <text y="38" textAnchor="middle" fill="#94A3B8" fontFamily="var(--font-mono)" fontSize="9">Immutable Anchor</text>
            </g>

            {/* Node 5: Judicial Audit */}
            <g transform="translate(810, 80)">
              <circle r="22" fill="#0B132B" stroke="#C084FC" strokeWidth="2" />
              <circle r="16" fill="rgba(192, 132, 252, 0.2)" className="pulse-glow-ring" />
              <circle r="6" fill="#C084FC" />
              <text y="-32" textAnchor="middle" fill="#FFFFFF" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">05. AUDIT</text>
              <text y="38" textAnchor="middle" fill="#94A3B8" fontFamily="var(--font-mono)" fontSize="9">Judicial Discovery</text>
            </g>
          </svg>
        </div>
      </section>

      {/* ============================================================
          INTERACTIVE EVIDENCE LIFECYCLE SECTION
          Register → Hash → Anchor → Verify → Audit
          ============================================================ */}
      <section id="lifecycle" className="landing-section lifecycle-section" aria-label="Evidence Lifecycle Stages" ref={lifecycleRef}>
        <div className="section-container">
          <div className="section-header-centered ec-reveal">
            <span className="section-badge">INTERACTIVE EVIDENCE LIFECYCLE</span>
            <h2 className="section-title">The Five Stages of Cryptographic Custody</h2>
            <p className="section-subtitle">
              Follow how a piece of digital evidence progresses from incident-response intake through judicial presentation with mathematical integrity and dual-tier access controls.
            </p>
          </div>

          {/* Scroll-Driven Dynamic Progress Track Indicator */}
          <div className="lifecycle-scroll-progress-container" title={`Scroll-driven Custody Stage Progress: ${Math.round(lifecycleScrollProgress * 100)}%`}>
            <div
              className="lifecycle-scroll-progress-fill"
              style={{
                width: `${Math.round(lifecycleScrollProgress * 100)}%`,
                backgroundColor: currentStage.statusColor || "#287A58",
              }}
            />
          </div>

          {/* Interactive Navigation Track */}
          <div className="lifecycle-nav-track ec-reveal">
            <div className="lifecycle-nav-line" />
            <div
              className="lifecycle-nav-line-active"
              style={{ width: `${(activeLifecycleIndex / 4) * 85}%` }}
            />

            {LIFECYCLE_STAGES.map((stg, idx) => {
              const isActive = idx === activeLifecycleIndex;
              return (
                <button
                  type="button"
                  key={stg.id}
                  className={`lifecycle-step-item ${isActive ? "is-active" : ""}`}
                  onClick={() => handleSelectLifecycleStep(idx)}
                  aria-selected={isActive}
                  aria-label={`Step ${stg.stepNumber}: ${stg.stepName}`}
                >
                  <div className={`lifecycle-step-node ${isActive ? "is-active" : ""}`}>
                    <span className="lifecycle-node-num">{stg.stepNumber}</span>
                  </div>
                  <span className="lifecycle-step-label">{stg.stepName}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Stage Showcase Card */}
          <div className="lifecycle-showcase-card ec-reveal">
            {/* Left Column: Conceptual Details */}
            <div className="lifecycle-detail-pane">
              <span className="lifecycle-stage-badge">{currentStage.badge}</span>
              <h3 className="lifecycle-stage-title">{currentStage.title}</h3>
              <p className="lifecycle-stage-desc">{currentStage.description}</p>

              <div className="lifecycle-stage-guarantees">
                {currentStage.guarantees.map((g, gIdx) => (
                  <div key={gIdx} className="lifecycle-guarantee-item">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      <strong>{g.label}:</strong> {g.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="lifecycle-controls-row">
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-lifecycle-nav"
                    disabled={activeLifecycleIndex === 0}
                    onClick={() => handleSelectLifecycleStep(activeLifecycleIndex - 1)}
                    aria-label="Previous Lifecycle Step"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    className="btn-lifecycle-nav"
                    disabled={activeLifecycleIndex === LIFECYCLE_STAGES.length - 1}
                    onClick={() => handleSelectLifecycleStep(activeLifecycleIndex + 1)}
                    aria-label="Next Lifecycle Step"
                  >
                    Next →
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-lifecycle-play"
                  onClick={() => setIsLifecyclePlaying(!isLifecyclePlaying)}
                  aria-label={isLifecyclePlaying ? "Pause automatic lifecycle progression" : "Resume automatic lifecycle progression"}
                >
                  {isLifecyclePlaying ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                      <span>Auto-Playing (Pause)</span>
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>Resume Auto-Play</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Live Simulated Tactical Preview */}
            <div className="lifecycle-preview-pane">
              <div className="lifecycle-preview-header">
                <span className="lifecycle-preview-title">{currentStage.previewTitle}</span>
                <span
                  className="lifecycle-preview-status"
                  style={{
                    backgroundColor: `${currentStage.statusColor}20`,
                    color: currentStage.statusColor,
                    border: `1px solid ${currentStage.statusColor}40`,
                  }}
                >
                  {currentStage.previewStatus}
                </span>
              </div>

              <pre className="preview-code-block">
                <code>{currentStage.codeSnippet}</code>
              </pre>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#64748B", fontFamily: "var(--font-mono)" }}>
                <span>Standard: ISO/IEC 27037:2012</span>
                <span style={{ color: "#10B981" }}>● Cryptographically Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: CORE PLATFORM CAPABILITIES
          ============================================================ */}
      <section id="features" className="landing-section features-section" aria-label="Platform Capabilities">
        <div className="section-container">
          <div className="section-header-centered ec-reveal">
            <span className="section-badge">CORE CAPABILITIES</span>
            <h2 className="section-title">Built for Modern Investigative Teams</h2>
            <p className="section-subtitle">
              Engineered to preserve uncompromised chain of custody, streamline team workflows, and provide mathematical certainty in digital evidence management.
            </p>
          </div>

          <div className="features-grid ec-stagger ec-reveal">
            {/* Benefit 1: Centralized Repository */}
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-saffron">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h3 className="feature-heading">Centralized Evidence Repository</h3>
              <p className="feature-description">
                Unify digital media, forensic images, reports, and disk captures in standardized case dockets with structured metadata, immediate search, and quick inspection drawers.
              </p>
              <div className="feature-tag">Unified Catalog • Case Organization</div>
            </div>

            {/* Benefit 2: Integrity Verification */}
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="feature-heading">Integrity Verification</h3>
              <p className="feature-description">
                Calculate standard 256-bit SHA-256 fingerprints during intake. Re-verify evidence at any time to mathematically detect single-bit tampering or unintentional media corruption.
              </p>
              <div className="feature-tag">SHA-256 Verification • Tamper Alerts</div>
            </div>

            {/* Benefit 3: Clear Custody History */}
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="feature-heading">Clear Custody History</h3>
              <p className="feature-description">
                Chronological, tamper-evident audit records track file acquisition, custodian handoffs, viewings, and forensic exports with examiner IDs and timestamped event logs.
              </p>
              <div className="feature-tag">Chronological Logs • Custody Visibility</div>
            </div>

            {/* Benefit 4: Controlled Access Permissions */}
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="feature-heading">Controlled Access Permissions</h3>
              <p className="feature-description">
                Enforce independent separation between in-browser file viewing and raw binary downloading. Authorize investigators with fine-grained privileges to prevent data exfiltration.
              </p>
              <div className="feature-tag">Independent View & Export Control</div>
            </div>

            {/* Benefit 5: Case-Based Collaboration */}
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-ochre">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="feature-heading">Case-Based Collaboration</h3>
              <p className="feature-description">
                Designate investigative team members, supervisory relationships, and supervisory reporting hierarchies under Department Authority for structured multi-officer operations.
              </p>
              <div className="feature-tag">Department Authority • Case Teams</div>
            </div>

            {/* Benefit 6: Transparent Activity Records */}
            <div className="feature-card">
              <div className="feature-icon-wrapper icon-green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className="feature-heading">Transparent Activity Records</h3>
              <p className="feature-description">
                Every action is recorded in immutable audit registers, ensuring full transparency and accountability for internal reviews, supervisory oversight, and courtroom presentation.
              </p>
              <div className="feature-tag">Immutable Audit Register • Accountable</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3: HOW IT WORKS (INVESTIGATIVE WORKFLOW)
          ============================================================ */}
      <section id="how-it-works" className="landing-section workflow-section" aria-label="Investigation Workflow">
        <div className="section-container">
          <div className="section-header-centered ec-reveal">
            <span className="section-badge">INVESTIGATION WORKFLOW</span>
            <h2 className="section-title">Four Stages of Digital Custody</h2>
            <p className="section-subtitle">
              A disciplined, accountable workflow supporting evidence from crime scene intake through judicial presentation.
            </p>
          </div>

          <div className="workflow-steps-grid ec-stagger ec-reveal" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {/* Step 1 */}
            <div className="workflow-step-card">
              <div className="step-indicator">
                <span className="step-number">01</span>
                <span className="step-line" />
              </div>
              <h3 className="step-title">Secure Intake</h3>
              <p className="step-desc">
                Intake digital evidence files, attach case dockets, and automatically compute standard SHA-256 checksums in-browser.
              </p>
              <div className="step-tech-bullet">
                <span>Output:</span> Cryptographic Fingerprint & Metadata Record
              </div>
            </div>

            {/* Step 2 */}
            <div className="workflow-step-card">
              <div className="step-indicator">
                <span className="step-number">02</span>
                <span className="step-line" />
              </div>
              <h3 className="step-title">Custody Registration</h3>
              <p className="step-desc">
                Register evidence into the tamper-evident custody ledger, binding the examiner ID, docket, and acquisition timestamp.
              </p>
              <div className="step-tech-bullet">
                <span>Output:</span> Permanent Custody Entry & Logical Vault ID
              </div>
            </div>

            {/* Step 3 */}
            <div className="workflow-step-card">
              <div className="step-indicator">
                <span className="step-number">03</span>
                <span className="step-line" />
              </div>
              <h3 className="step-title">Access Governance</h3>
              <p className="step-desc">
                Department supervisors independently grant or revoke View and Download permissions to authorized investigators.
              </p>
              <div className="step-tech-bullet">
                <span>Output:</span> Granular View / Export Authorization
              </div>
            </div>

            {/* Step 4 */}
            <div className="workflow-step-card">
              <div className="step-indicator">
                <span className="step-number">04</span>
              </div>
              <h3 className="step-title">Integrity Verification</h3>
              <p className="step-desc">
                Compare any working copy or suspect file against the registered fingerprint to verify authenticity with mathematical certainty.
              </p>
              <div className="step-tech-bullet">
                <span>Output:</span> Verified Authenticity or Tamper Alert
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: SYSTEM & SECURITY ARCHITECTURE
          ============================================================ */}
      <section id="architecture" className="landing-section architecture-section" aria-label="Security Architecture">
        <div className="section-container">
          <div className="section-header-centered ec-reveal">
            <span className="section-badge">SECURITY ARCHITECTURE</span>
            <h2 className="section-title">Multi-Layered Protection Model</h2>
            <p className="section-subtitle">
              Strict separation between investigator workspace, authentication services, relational metadata storage, and tamper-evident verification.
            </p>
          </div>

          <div className="architecture-grid ec-stagger ec-reveal">
            <div className="arch-layer-card">
              <div className="arch-layer-header">
                <span className="arch-layer-tag">TIER 1</span>
                <h4 className="arch-layer-title">Investigator Workspace</h4>
              </div>
              <p className="arch-layer-desc">
                High-contrast, accessible single-page application providing tactile dossier management, document previews, and responsive mobile review.
              </p>
              <div className="arch-tech-list">
                <span>React 19</span>
                <span>Tactile UI</span>
                <span>PDF.js Preview</span>
              </div>
            </div>

            <div className="arch-layer-card">
              <div className="arch-layer-header">
                <span className="arch-layer-tag">TIER 2</span>
                <h4 className="arch-layer-title">Authentication & Identity</h4>
              </div>
              <p className="arch-layer-desc">
                Institutional access portal featuring PBKDF2 password verification, dynamic server-side MFA challenge validation, and encrypted sessions.
              </p>
              <div className="arch-tech-list">
                <span>Python Flask</span>
                <span>Salted PBKDF2</span>
                <span>Dynamic MFA</span>
              </div>
            </div>

            <div className="arch-layer-card">
              <div className="arch-layer-header">
                <span className="arch-layer-tag">TIER 3</span>
                <h4 className="arch-layer-title">Case Metadata Vault</h4>
              </div>
              <p className="arch-layer-desc">
                Structured evidence database managing case dockets, custodian assignments, access permission grants, and chronological activity trails.
              </p>
              <div className="arch-tech-list">
                <span>SQLite</span>
                <span>Case Vault</span>
                <span>Audit Logs</span>
              </div>
            </div>

            <div className="arch-layer-card">
              <div className="arch-layer-header">
                <span className="arch-layer-tag">TIER 4</span>
                <h4 className="arch-layer-title">Verification Ledger</h4>
              </div>
              <p className="arch-layer-desc">
                Tamper-evident decentralized verification layer anchoring cryptographic fingerprints and enforcing immutable access rights in the background.
              </p>
              <div className="arch-tech-list">
                <span>Foundry / Anvil</span>
                <span>Solidity Smart Contracts</span>
                <span>Web3 Verification</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5: CALL TO ACTION BANNER
          ============================================================ */}
      <section className="landing-cta-banner ec-reveal" aria-label="Portal Access Call to Action">
        <div className="section-container cta-banner-inner">
          <div className="cta-content">
            <h2 className="cta-headline">Ready to Access the Evidence Repository?</h2>
            <p className="cta-subheadline">
              Authorized investigators and forensic examiners may proceed to the Secure Access Portal with official credentials and dynamic MFA verification.
            </p>
          </div>
          <div className="cta-action">
            <button
              type="button"
              className="btn-landing-cta"
              onClick={onNavigateToLogin}
              id="cta-signin-btn"
            >
              <span>Access Secure Portal</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer id="about" className="landing-footer" role="contentinfo">
        <div className="section-container footer-inner">
          <div className="footer-brand-column">
            <div className="footer-brand-title">EvidenceChain</div>
            <div className="footer-brand-desc">
              Digital Evidence Management & Cryptographic Chain of Custody System.
            </div>
            <div className="footer-academic-disclaimer">
              <strong>System Notice:</strong> EvidenceChain is designed for professional forensic laboratories, investigative agencies, and institutional evidence management teams.
            </div>
          </div>

          <div className="footer-links-column">
            <div className="footer-column-title">PLATFORM NAVIGATION</div>
            <ul className="footer-link-list">
              <li>
                <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Overview
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection("lifecycle")}>
                  Evidence Lifecycle
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection("features")}>
                  Core Capabilities
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection("how-it-works")}>
                  Investigation Workflow
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection("architecture")}>
                  Security Architecture
                </button>
              </li>
              <li>
                <button type="button" onClick={onNavigateToLogin}>
                  Secure Access Portal
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-meta-column">
            <div className="footer-column-title">SYSTEM STATUS</div>
            <div className="footer-status-pill">
              <span className="footer-status-dot" />
              <span>SERVICES OPERATIONAL</span>
            </div>
            <div className="footer-status-meta">
              Evidence Database: Connected • Verification Engine: Active
            </div>
            <div className="footer-copyright">
              © 2026 EvidenceChain. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
