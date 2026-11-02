// ============================================================
// Institutional Authentication & Identity Verification Modal
// Genuine Authentication Gateway (Password + Dynamic MFA)
// ============================================================

import { useState } from "react";
import { loginAPI, verifyMfaAPI } from "../api";

export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [step, setStep] = useState("credentials"); // "credentials" | "mfa" | "success"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError("Please enter your Official Email or Employee ID.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginAPI(identifier.trim(), password);
      if (res.status === "mfa_required") {
        setChallengeId(res.challengeId);
        setMaskedEmail(res.maskedEmail || identifier);
        setOtp(["", "", "", "", "", ""]);
        setStep("mfa");
      } else if (res.status === "success" && res.user) {
        setStep("success");
        setTimeout(() => {
          onLoginSuccess(res.user);
          setStep("credentials");
          setIdentifier("");
          setPassword("");
          setOtp(["", "", "", "", "", ""]);
          onClose();
        }, 500);
      } else {
        setError(res.message || "Authentication failed.");
      }
    } catch (err) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const clean = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);

    if (clean && index < 5) {
      const nextInput = document.getElementById(`modal-otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits of the verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyMfaAPI(challengeId, code);
      if (res.status === "success" && res.user) {
        setStep("success");
        setTimeout(() => {
          onLoginSuccess(res.user);
          setStep("credentials");
          setIdentifier("");
          setPassword("");
          setOtp(["", "", "", "", "", ""]);
          onClose();
        }, 500);
      } else {
        setError(res.message || "Failed to verify security code.");
      }
    } catch (err) {
      setError(err.message || "Verification code failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay-flat" onClick={onClose}>
      <div className="modal-dialog-flat" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-flat">
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--text-secondary)", letterSpacing: "0.8px" }}>
              AUTHENTICATION GATEWAY
            </div>
            <h3 className="modal-title-flat">EvidenceChain Session Verification</h3>
          </div>
          <button
            type="button"
            className="btn-subtle-mono"
            onClick={onClose}
            title="Close dialog"
          >
            ESC
          </button>
        </div>

        <div className="modal-body-flat">
          {error && (
            <div className="banner-alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {step === "credentials" && (
            <form onSubmit={handleCredentialsSubmit}>
              <div className="form-group-block">
                <label className="form-label" htmlFor="modal-id">Official Email or Employee ID</label>
                <input
                  id="modal-id"
                  type="text"
                  className="form-input-text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. r.sen@forensics.example.com"
                  required
                />
              </div>

              <div className="form-group-block">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="form-label" htmlFor="modal-pwd" style={{ marginBottom: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: "none", border: "none", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer" }}
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
                <input
                  id="modal-pwd"
                  type={showPassword ? "text" : "password"}
                  className="form-input-text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter authorized credential"
                  required
                />
              </div>

              <div className="modal-footer-flat">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Authenticating..." : "Advance to MFA →"}
                </button>
              </div>
            </form>
          )}

          {step === "mfa" && (
            <form onSubmit={handleVerifyOtp}>
              <p style={{ marginBottom: "14px", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                Enter the dynamic 6-digit verification code dispatched for {maskedEmail}. (For public demo evaluation, enter code <code>123456</code> or check terminal).
              </p>

              <div style={{ display: "flex", gap: "8px", justifyContent: "center", margin: "16px 0" }}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`modal-otp-${idx}`}
                    type="text"
                    maxLength={1}
                    className="form-input-text"
                    style={{ width: "42px", height: "46px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "18px" }}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <div className="modal-footer-flat">
                <button type="button" className="btn-secondary" onClick={() => setStep("credentials")}>
                  Back
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Verifying Token..." : "Authorize Session"}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="banner-alert alert-success" style={{ margin: "20px 0" }}>
              <span>Identity verified. Session bound to registered institutional profile.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
