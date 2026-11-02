// ============================================================
// EvidenceChain Redesigned Secure Access Portal
// Genuine Authentication Gateway: Password Validation + Dynamic MFA
// Distraction-Free, Single-Column Institutional Portal
// ============================================================

import { useState, useEffect, useRef } from "react";
import { loginAPI, verifyMfaAPI, resendMfaAPI, demoLoginAPI } from "../api";

const SYNTHETIC_DEMO_PERSONAS = [
  {
    name: "Dr. Rajeshwar Sen",
    email: "r.sen@forensics.example.com",
    role: "Head of Department",
    department: "Forensics Headquarters",
    employeeId: "HOD-0001",
    badge: "Executive Oversight, Access Control & Department Governance",
    group: "Executive Leadership & Governance",
    isHOD: true,
  },
  {
    name: "Rahul Sharma",
    email: "r.sharma@forensics.example.com",
    role: "Senior Forensic Officer",
    department: "Cyber Crime Investigation Unit",
    employeeId: "OFF-1024",
    badge: "Forensic Evidence Intake & Chain of Custody Registration",
    group: "Forensic Operations & Intake",
    isHOD: false,
  },
  {
    name: "Ananya Patel",
    email: "a.patel@forensics.example.com",
    role: "Digital Forensics Analyst",
    department: "Digital Evidence Review Board",
    employeeId: "OFF-2048",
    badge: "Artifact Inspection, Bitwise Hash Matching & Cryptographic Auditing",
    group: "Forensic Operations & Intake",
    isHOD: false,
  },
  {
    name: "Sunita Rao",
    email: "s.rao@forensics.example.com",
    role: "Evidence Custodian",
    department: "Central Evidence Vault",
    employeeId: "CUST-4096",
    badge: "Vault Management, Physical Custody Log & Media Retention",
    group: "Specialized Custody & Judicial Directorate",
    isHOD: false,
  },
  {
    name: "Vikram Mehta",
    email: "v.mehta@forensics.example.com",
    role: "Investigating Officer",
    department: "Judicial Forensic Commission",
    employeeId: "EXAM-512",
    badge: "Case Dossier Investigation, Subpoena Discovery & Court Export",
    group: "Specialized Custody & Judicial Directorate",
    isHOD: false,
  },
];

export function LoginView({
  onLoginSuccess,
  onBackToHome,
  backendConnected,
  blockchainConnected,
}) {
  const [step, setStep] = useState("credentials"); // "credentials" | "mfa" | "demo"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic MFA State
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [expirySeconds, setExpirySeconds] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(30);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const otpInputRefs = useRef([]);

  // Countdown timer for MFA expiration and resend cooldown
  useEffect(() => {
    if (step !== "mfa") return;

    const timer = setInterval(() => {
      setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  // Handle credentials submission (Stage 1: Password validation against SQLite PBKDF2 hash)
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!email.trim()) {
      setError("Please enter your official email address or employee ID.");
      return;
    }

    if (!password) {
      setError("Please enter your institutional password.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginAPI(email.trim(), password);

      if (response.status === "mfa_required") {
        setChallengeId(response.challengeId);
        setMaskedEmail(response.maskedEmail || email);
        setOtp(["", "", "", "", "", ""]);
        setExpirySeconds(response.expiresInSeconds || 300);
        setResendCooldown(30);
        setStep("mfa");
        setInfoMessage(
          "Dynamic authentication challenge initiated. For public demonstration evaluation, enter verification code: 123456 (or check server terminal logs)."
        );
      } else if (response.status === "success" && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError(response.message || "Invalid credentials. Please verify your email and password.");
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Handle demonstration sign-in via synthetic personas
  const handleDemoLogin = async (targetEmail) => {
    setError("");
    setInfoMessage("");
    setLoading(true);
    try {
      const response = await demoLoginAPI(targetEmail);
      if (response.status === "success" && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError(response.message || "Demonstration sign-in failed.");
      }
    } catch (err) {
      setError(err.message || "Failed to establish demonstration session.");
    } finally {
      setLoading(false);
    }
  };

  // Handle single digit input or 6-digit paste
  const handleOtpChange = (index, value) => {
    // Handle paste of full 6-digit code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length > 0) {
        const newOtp = [...otp];
        digits.forEach((d, i) => {
          if (index + i < 6) newOtp[index + i] = d;
        });
        setOtp(newOtp);
        const nextFocus = Math.min(index + digits.length, 5);
        if (otpInputRefs.current[nextFocus]) {
          otpInputRefs.current[nextFocus].focus();
        }
        return;
      }
    }

    // Single digit input
    const cleanDigit = value.slice(-1).replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = cleanDigit;
    setOtp(newOtp);

    // Auto-advance focus to next digit box
    if (cleanDigit && index < 5) {
      if (otpInputRefs.current[index + 1]) {
        otpInputRefs.current[index + 1].focus();
      }
    }
  };

  // Handle backspace navigation between OTP input boxes
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      if (otpInputRefs.current[index - 1]) {
        otpInputRefs.current[index - 1].focus();
      }
    }
  };

  // Handle OTP verification (Stage 2: Dynamic server-side OTP check)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter all 6 digits of the verification code.");
      return;
    }

    if (expirySeconds === 0) {
      setError("Verification code has expired. Please request a new code.");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyMfaAPI(challengeId, otpCode);

      if (response.status === "success" && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError(response.message || "Failed to verify security code.");
      }
    } catch (err) {
      setError(err.message || "MFA verification failed. Please check the code.");
    } finally {
      setLoading(false);
    }
  };

  // Handle request for a fresh OTP challenge
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;

    setError("");
    setLoading(true);
    try {
      const res = await resendMfaAPI(challengeId);
      if (res.status === "success") {
        setChallengeId(res.challengeId);
        setOtp(["", "", "", "", "", ""]);
        setExpirySeconds(res.expiresInSeconds || 300);
        setResendCooldown(30);
        setInfoMessage(
          "A fresh verification code has been dispatched. Check the Flask backend terminal."
        );
      } else {
        setError(res.message || "Failed to resend verification code.");
      }
    } catch (err) {
      setError(err.message || "Failed to request fresh security code.");
    } finally {
      setLoading(false);
    }
  };

  // Reset back to credentials form
  const handleBackToCredentials = () => {
    setStep("credentials");
    setChallengeId("");
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setInfoMessage("");
  };

  // Helper to format remaining time
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  return (
    <div className="login-portal-wrapper">
      {/* Top Portal Navigation Header */}
      <header className="portal-header">
        <div className="portal-header-inner">
          <div className="portal-brand" onClick={onBackToHome} role="button" tabIndex={0}>
            <div className="brand-crest-box-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2L4 6V12C4 17.5 7.4 22.6 12 24C16.6 22.6 20 17.5 20 12V6L12 2Z" fill="#0B132B" stroke="#FF9933" strokeWidth="1.5"/>
                <path d="M12 6V18" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 12H17" stroke="#138808" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="portal-brand-text">
              <span className="portal-brand-name">EvidenceChain</span>
              <span className="portal-brand-tag">RESTRICTED ACCESS PORTAL</span>
            </div>
          </div>

          {onBackToHome && (
            <button
              type="button"
              className="btn-back-home"
              onClick={onBackToHome}
              aria-label="Return to EvidenceChain Home Overview"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Home</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Login Workspace */}
      <main className="portal-main-area">
        <div className="portal-card-container">
          {/* Institutional Crest & Identity Header */}
          <div className="portal-card-header">
            <div className="portal-icon-crest">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2L4 6V12C4 17.5 7.4 22.6 12 24C16.6 22.6 20 17.5 20 12V6L12 2Z" fill="#0B132B" stroke="#FF9933" strokeWidth="1.6"/>
                <path d="M12 7V17" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 12H16" stroke="#138808" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="3" fill="#0B132B" stroke="#FF9933" strokeWidth="1.2"/>
              </svg>
            </div>
            <h1 className="portal-card-title">
              {step === "credentials"
                ? "Secure Access Portal"
                : step === "demo"
                ? "Public Demonstration Access"
                : "Identity Verification"}
            </h1>
            <p className="portal-card-subtitle">
              {step === "credentials"
                ? "Sign in to continue to EvidenceChain."
                : step === "demo"
                ? "Select a synthetic personnel identity to evaluate digital evidence workflows."
                : `Enter the dynamic 6-digit verification code dispatched to ${maskedEmail}.`}
            </p>
          </div>

          {/* Error Feedback Banner */}
          {error && (
            <div className="portal-alert portal-alert-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Information Feedback Banner */}
          {infoMessage && (
            <div className="portal-alert portal-alert-info" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* ============================================================
              STAGE 1: CREDENTIALS AUTHENTICATION FORM
              ============================================================ */}
          {step === "credentials" && (
            <form onSubmit={handleCredentialsSubmit} className="portal-form">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="portal-input-email">
                  Official Email Address or Employee ID
                </label>
                <div className="portal-input-wrapper">
                  <span className="input-prefix-icon" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <input
                    id="portal-input-email"
                    type="text"
                    className="portal-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. r.sen@forensics.example.com"
                    autoComplete="username"
                    disabled={loading}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="portal-form-group">
                <div className="portal-label-row">
                  <label className="portal-label" htmlFor="portal-input-password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn-toggle-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="portal-input-wrapper">
                  <span className="input-prefix-icon" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="portal-input-password"
                    type={showPassword ? "text" : "password"}
                    className="portal-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your institutional password"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-portal-submit"
                disabled={loading}
                id="portal-signin-submit-btn"
              >
                {loading ? (
                  <span className="loading-spinner-row">
                    <span className="spinner-dot" />
                    <span>Verifying Credentials...</span>
                  </span>
                ) : (
                  <span>Sign In →</span>
                )}
              </button>

              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>
                  Public Demonstration & Evaluation Mode
                </p>
                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "12px", background: "#F8FAFC", padding: "10px 12px", borderRadius: "6px", border: "1px solid #E2E8F0", textAlign: "left", lineHeight: "1.5" }}>
                  <div><strong>Demo Personas:</strong> <code>r.sen@forensics.example.com</code> (HOD), <code>r.sharma@forensics.example.com</code> (Officer), or shortcuts (<code>hod</code>, <code>officer</code>, <code>analyst</code>, <code>custodian</code>, <code>investigator</code>).</div>
                  <div style={{ marginTop: "4px" }}><strong>Password:</strong> Enter <code>EvidenceChain@Demo2026!</code> (or configured <code>DEMO_USER_PASSWORD</code>).</div>
                  <div style={{ marginTop: "4px" }}><strong>Dynamic MFA Code:</strong> Enter <code>123456</code> (or check terminal).</div>
                </div>
                <button
                  type="button"
                  className="btn-portal-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => {
                    setError("");
                    setInfoMessage("");
                    setStep("demo");
                  }}
                  id="portal-demo-mode-btn"
                >
                  <span>Or Sign In with One-Click Demo Personas →</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================
              STAGE 2: PUBLIC DEMONSTRATION ACCESS (SYNTHETIC PERSONAS)
              ============================================================ */}
          {step === "demo" && (
            <div className="portal-demo-container">
              <div
                style={{
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "var(--radius-xs)",
                  padding: "10px 14px",
                  fontSize: "12px",
                  color: "#92400E",
                  marginBottom: "16px",
                  lineHeight: 1.45,
                }}
              >
                <strong>Temporary Synthetic Demonstration Environment:</strong>
                <div style={{ marginTop: "4px" }}>
                  This public deployment is an isolated evaluation demonstration operating on synthetic demo data, non-durable evidence uploads, and a container-local development blockchain (Foundry Anvil EVM Chain ID 31337). Select an authorized synthetic persona below to evaluate EvidenceChain workflows across all operational roles, including Head of Department (HOD) administrative authority. Dynamic MFA is bypassed for demonstration personas, with role-based permissions and cryptographic audit trails active.
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                {SYNTHETIC_DEMO_PERSONAS.map((p, idx) => {
                  const showGroupHeader = idx === 0 || p.group !== SYNTHETIC_DEMO_PERSONAS[idx - 1].group;
                  return (
                    <div key={p.email}>
                      {showGroupHeader && (
                        <div
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            color: "#64748B",
                            padding: "6px 2px 4px 2px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <span>{p.group}</span>
                          <span style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleDemoLogin(p.email)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          backgroundColor: p.isHOD ? "#F8FAFC" : "#FFFFFF",
                          border: p.isHOD ? "1.5px solid #94A3B8" : "1px solid #CBD5E1",
                          borderRadius: "var(--radius-sm)",
                          cursor: loading ? "wait" : "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "#2563EB")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = p.isHOD ? "#94A3B8" : "#CBD5E1")}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 600, fontSize: "13px", color: "#0F172A" }}>
                              {p.name}
                            </span>
                            {p.isHOD && (
                              <span
                                style={{
                                  fontSize: "9.5px",
                                  fontWeight: 700,
                                  backgroundColor: "#DBEAFE",
                                  color: "#1D4ED8",
                                  padding: "1px 6px",
                                  borderRadius: "3px",
                                  border: "1px solid #BFDBFE"
                                }}
                              >
                                HOD • ADMIN
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                            {p.role} • {p.department}
                          </div>
                          <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                            ID: {p.employeeId} • {p.badge}
                          </div>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#2563EB" }}>
                          Sign In →
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-portal-tertiary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => {
                  setError("");
                  setInfoMessage("");
                  setStep("credentials");
                }}
                disabled={loading}
              >
                ← Return to Institutional Credentials Sign-In
              </button>
            </div>
          )}

          {/* ============================================================
              STAGE 3: DYNAMIC OTP-BASED MFA FORM
              ============================================================ */}
          {step === "mfa" && (
            <form onSubmit={handleVerifyOtp} className="portal-form">
              <div className="portal-mfa-group">
                <div className="portal-label-row">
                  <label className="portal-label" htmlFor="mfa-digit-0">
                    Dynamic Verification Code (6 Digits)
                  </label>
                  <span className={`portal-timer-badge ${expirySeconds < 60 ? "timer-expiring" : ""}`}>
                    Expires in: {formatTime(expirySeconds)}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: "#FAF9F6",
                    border: "1px solid #DCD7CB",
                    borderRadius: "var(--radius-xs)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "#142535",
                    marginBottom: "12px",
                    lineHeight: 1.4,
                  }}
                >
                  <div>
                    <strong>Verification Challenge:</strong> Dynamic 6-digit OTP code dispatched for <code>{maskedEmail || email}</code>. For public demonstration evaluation, enter code <code>123456</code> (or check server terminal logs).
                  </div>
                </div>

                <div className="portal-otp-boxes">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpInputRefs.current[i] = el)}
                      id={`mfa-digit-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="portal-otp-input"
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={loading || expirySeconds === 0}
                      autoFocus={i === 0}
                      aria-label={`Verification code digit ${i + 1}`}
                    />
                  ))}
                </div>

                {expirySeconds === 0 && (
                  <div className="portal-expiry-notice">
                    This verification challenge has expired. Request a new code to proceed.
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-portal-submit"
                disabled={loading || expirySeconds === 0}
                id="portal-mfa-verify-btn"
              >
                {loading ? "Validating Security Code..." : "Verify Code & Authorize Session"}
              </button>

              <div className="portal-mfa-actions">
                <button
                  type="button"
                  className="btn-portal-secondary"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}
                </button>

                <button
                  type="button"
                  className="btn-portal-tertiary"
                  onClick={handleBackToCredentials}
                  disabled={loading}
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Development Notice */}
          <div className="portal-demo-notice">
            <div className="demo-notice-title">Demonstration Environment Notice:</div>
            <div className="demo-notice-text">
              Dynamic OTP verification codes are generated server-side and printed to the <strong>Flask backend terminal</strong>. In production, codes are dispatched via encrypted agency channels.
            </div>
          </div>
        </div>
      </main>

      {/* Portal Footer */}
      <footer className="portal-footer">
        <div className="portal-footer-inner">
          <span>EvidenceChain Security Architecture • EVM Node Active</span>
          <span>Port 5001 REST API • Local Devnet</span>
        </div>
      </footer>
    </div>
  );
}
