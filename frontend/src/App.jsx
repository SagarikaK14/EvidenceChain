// ============================================================
// EvidenceChain Main Application Controller
// Professional Institutional Redesign & Authentication Gate
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  checkBackendHealth,
  getDiagnosticsSummaryAPI,
  listEvidenceAPI,
  registerEvidenceAPI,
  getEvidenceAPI,
  verifyEvidenceAPI,
  checkViewAccessAPI,
  checkDownloadAccessAPI,
  grantViewAccessAPI,
  revokeViewAccessAPI,
  grantDownloadAccessAPI,
  revokeDownloadAccessAPI,
  getAccessHistoryAPI,
  getMeAPI,
  logoutAPI,
} from "./api";

import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";
import { Toast } from "./components/Toast";

import { LoginView } from "./views/LoginView";
import { LandingPageView } from "./views/LandingPageView";
import { DashboardView } from "./views/DashboardView";
import { EvidenceListView } from "./views/EvidenceListView";
import { RegisterEvidenceView } from "./views/RegisterEvidenceView";
import { VerifyEvidenceView } from "./views/VerifyEvidenceView";
import { EvidenceDetailsView } from "./views/EvidenceDetailsView";
import { DepartmentAuthorityView } from "./views/DepartmentAuthorityView";
import { AccessManagementView } from "./views/AccessManagementView";
import { AccessHistoryView } from "./views/AccessHistoryView";
import { IdentityProfileView } from "./views/IdentityProfileView";
import { SystemStatusView } from "./views/SystemStatusView";

import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5001"
    : "";

// Default Forensic Officer Profile (Institutional Identity Model)
const DEFAULT_OFFICER = {
  name: "Rahul Sharma",
  role: "Digital Forensics Officer",
  employeeId: "OFF-1024",
  department: "Cyber Crime Unit",
  organization: "ABC Police Department",
  email: "r.sharma@cybercrime.gov.in",
  walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  identityStatus: "VERIFIED",
  walletStatus: "REGISTERED",
  mfaStatus: "ENABLED",
};

export default function App() {
  // Authentication & Public Navigation Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [publicPage, setPublicPage] = useState("landing"); // "landing" | "login"

  // Navigation & View State
  const [activeView, setActiveView] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Global Forensic Toast Notification State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info", txHash = null, title = null) => {
    setToast({ message, type, txHash, title });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Current Logged-in Officer Session
  const [currentUser, setCurrentUser] = useState(DEFAULT_OFFICER);

  // System Telemetry State
  const [backendConnected, setBackendConnected] = useState(false);
  const [blockchainConnected, setBlockchainConnected] = useState(false);

  // Evidence Repository Data
  const [evidenceList, setEvidenceList] = useState([]);

  // Selected Evidence State (For Details & Actions)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [evidenceDetails, setEvidenceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsAccessHistory, setDetailsAccessHistory] = useState([]);

  // File Viewing & Downloading in Details View
  const [detailsViewAllowed, setDetailsViewAllowed] = useState(null);
  const [detailsDownloadAllowed, setDetailsDownloadAllowed] = useState(null);
  const [viewedFileUrl, setViewedFileUrl] = useState("");
  const [viewedFileName, setViewedFileName] = useState("");

  // Registration Flow State
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerResult, setRegisterResult] = useState(null);

  // Verification Flow State
  const [verifyEvidenceId, setVerifyEvidenceId] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyBlockchainHash, setVerifyBlockchainHash] = useState("");
  const [verifyCurrentHash, setVerifyCurrentHash] = useState("");

  // Access Management Flow State
  const [accessViewStatus, setAccessViewStatus] = useState(null);
  const [accessDownloadStatus, setAccessDownloadStatus] = useState(null);
  const [accessActionResult, setAccessActionResult] = useState(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");

  // Access History View State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // -------------------------------------------------------------
  // Initial Boot & Telemetry Check
  // -------------------------------------------------------------
  const checkHealthAndLoadData = async () => {
    try {
      const health = await checkBackendHealth();
      if (health && health.status === "ok") {
        setBackendConnected(true);
      } else {
        setBackendConnected(false);
      }
    } catch {
      setBackendConnected(false);
    }

    // Authoritative Consensus Layer Check via /api/diagnostics/summary
    try {
      const diag = await getDiagnosticsSummaryAPI();
      if (diag && diag.status === "success" && diag.services) {
        const hardhat = diag.services.find(
          (s) => s.id === "hardhat_node" || s.category === "Consensus Layer"
        );
        setBlockchainConnected(hardhat?.status === "Healthy");
      } else {
        setBlockchainConnected(false);
      }
    } catch {
      setBlockchainConnected(false);
    }

    // Load registered evidence list
    try {
      const res = await listEvidenceAPI();
      if (res && res.evidence) {
        setEvidenceList(res.evidence);
      }
    } catch (err) {
      console.warn("Could not load evidence list from API:", err);
    }
  };

  useEffect(() => {
    let active = true;

    // Verify existing server-side authenticated session on mount (survives page refresh)
    getMeAPI()
      .then((res) => {
        if (active && res?.status === "authenticated" && res?.user) {
          setCurrentUser(res.user);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        if (active) {
          setIsAuthenticated(false);
        }
      })
      .finally(() => {
        if (active) {
          setAuthChecking(false);
        }
      });

    checkBackendHealth()
      .then((health) => {
        if (active) setBackendConnected(health?.status === "ok");
      })
      .catch(() => {
        if (active) setBackendConnected(false);
      });

    listEvidenceAPI()
      .then((res) => {
        if (active && res?.evidence) setEvidenceList(res.evidence);
      })
      .catch((err) => {
        console.warn("Initial load error:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  // Hardware-accelerated ambient illumination spotlight tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      const card = e.target.closest?.(".ambient-card");
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      }
    };
    window.addEventListener("pointermove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMouseMove);
  }, []);

  // Subtle magnetic attraction for primary action controls
  useEffect(() => {
    // Only apply if user does not prefer reduced motion
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const magneticBtns = document.querySelectorAll(".btn-tactile-primary, .btn-magnetic");
    const cleanupFns = [];

    magneticBtns.forEach((btn) => {
      const onMouseMove = (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        const maxDist = 36;
        const dist = Math.hypot(x, y);

        if (dist < maxDist) {
          const pullX = (x / maxDist) * 4;
          const pullY = (y / maxDist) * 4;
          btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
        } else {
          btn.style.transform = "translate(0px, 0px)";
        }
      };

      const onMouseLeave = () => {
        btn.style.transform = "translate(0px, 0px)";
      };

      btn.addEventListener("mousemove", onMouseMove);
      btn.addEventListener("mouseleave", onMouseLeave);

      cleanupFns.push(() => {
        btn.removeEventListener("mousemove", onMouseMove);
        btn.removeEventListener("mouseleave", onMouseLeave);
      });
    });

    return () => cleanupFns.forEach((fn) => fn());
  }, [activeView]);

  // -------------------------------------------------------------
  // Authentication Handlers
  // -------------------------------------------------------------
  const handleLoginSuccess = (officer) => {
    if (officer) {
      setCurrentUser(officer);
    }
    setIsAuthenticated(true);
    setPublicPage("landing");
    setActiveView("dashboard");
    showToast(`Authenticated as ${officer?.name || "Forensic Officer"}. Session established.`, "success");
    fetchSystemData();
  };

  const handleLogout = async () => {
    closeFileViewer();
    try {
      await logoutAPI();
    } catch (err) {
      console.warn("Server-side logout error:", err);
    }
    setIsAuthenticated(false);
    setPublicPage("landing");
    setCurrentUser(DEFAULT_OFFICER);
    showToast("Institutional session terminated securely.", "info");
  };

  // -------------------------------------------------------------
  // Evidence Selection & Details Fetching
  // -------------------------------------------------------------
  const handleSelectEvidence = async (evidenceId) => {
    setSelectedEvidenceId(evidenceId);
    setActiveView("details");
    setDetailsError("");
    setEvidenceDetails(null);
    setDetailsAccessHistory([]);
    setDetailsViewAllowed(null);
    setDetailsDownloadAllowed(null);
    closeFileViewer();

    try {
      setDetailsLoading(true);
      const res = await getEvidenceAPI(evidenceId);
      setEvidenceDetails({
        ...res,
        blockchain: res.evidence || {},
        metadata: res.database || {},
        isOnChain: Boolean(res.isOnChain),
        isHistorical: Boolean(res.isHistorical),
        ledgerStatus: res.ledgerStatus || (res.isHistorical ? "HISTORICAL_RECORD" : res.isOnChain ? "VERIFIED_ACTIVE" : "NEVER_ANCHORED"),
        ledgerStatusLabel: res.ledgerStatusLabel || (res.isHistorical ? "Historical Ledger Record" : res.isOnChain ? "Active Ledger Record" : "Never Anchored"),
      });

      // Check current user view and download permissions
      const officerAddr = currentUser.walletAddress;
      try {
        const vRes = await checkViewAccessAPI(evidenceId, officerAddr);
        setDetailsViewAllowed(Boolean(vRes.canView));
      } catch {
        setDetailsViewAllowed(null);
      }

      try {
        const dRes = await checkDownloadAccessAPI(evidenceId, officerAddr);
        setDetailsDownloadAllowed(Boolean(dRes.canDownload));
      } catch {
        setDetailsDownloadAllowed(null);
      }

      // Fetch on-chain access history
      try {
        const hRes = await getAccessHistoryAPI(evidenceId);
        setDetailsAccessHistory(hRes.accessHistory || []);
      } catch {
        setDetailsAccessHistory([]);
      }
    } catch (err) {
      setDetailsError(err.message || "Failed to load evidence details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // View File Content (In-App Protected Viewer)
  // -------------------------------------------------------------
  const handleViewFile = async (evidenceId) => {
    const targetId = typeof evidenceId === "string" && evidenceId ? evidenceId : selectedEvidenceId;
    if (!targetId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/evidence/${encodeURIComponent(
          targetId
        )}/view?userAddress=${encodeURIComponent(currentUser.walletAddress)}`
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "View access denied.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (viewedFileUrl) {
        URL.revokeObjectURL(viewedFileUrl);
      }

      setViewedFileUrl(objectUrl);

      const disposition = response.headers.get("Content-Disposition");
      let filename = "evidence-file";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/i);
        if (match?.[1]) filename = match[1];
      }
      setViewedFileName(filename);

      // Refresh access history for this item
      const hRes = await getAccessHistoryAPI(targetId);
      setDetailsAccessHistory(hRes.accessHistory || []);
    } catch (err) {
      showToast("View Error: " + err.message, "error");
    }
  };

  // -------------------------------------------------------------
  // Download Evidence File
  // -------------------------------------------------------------
  const handleDownloadFile = async (evidenceId) => {
    const targetId = typeof evidenceId === "string" && evidenceId ? evidenceId : selectedEvidenceId;
    if (!targetId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/evidence/${encodeURIComponent(
          targetId
        )}/download?userAddress=${encodeURIComponent(currentUser.walletAddress)}`
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Download access denied.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const disposition = response.headers.get("Content-Disposition");
      let filename = "evidence-file";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/i);
        if (match?.[1]) filename = match[1];
      }

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      // Refresh access history
      const hRes = await getAccessHistoryAPI(evidenceId);
      setDetailsAccessHistory(hRes.accessHistory || []);
    } catch (err) {
      showToast("Download Error: " + err.message, "error");
    }
  };

  const closeFileViewer = () => {
    if (viewedFileUrl) {
      URL.revokeObjectURL(viewedFileUrl);
    }
    setViewedFileUrl("");
    setViewedFileName("");
  };

  // -------------------------------------------------------------
  // Evidence Registration
  // -------------------------------------------------------------
  const handleRegisterEvidence = async (file, caseId, description, clientHash = "") => {
    setRegisterLoading(true);
    setRegisterError("");
    setRegisterResult(null);

    try {
      const res = await registerEvidenceAPI(file, caseId, description, clientHash);
      setRegisterResult(res);
      showToast(
        `Evidence record ${res.evidenceId || ""} catalogued and registered successfully.`,
        "success",
        res.transactionHash,
        "CUSTODY REGISTRATION CONFIRMED"
      );
      // Reload evidence repository list
      const listRes = await listEvidenceAPI();
      if (listRes?.evidence) {
        setEvidenceList(listRes.evidence);
      }
    } catch (err) {
      setRegisterError(err.message || "Registration failed.");
      showToast(err.message || "Registration failed.", "error", null, "REGISTRATION FAILED");
    } finally {
      setRegisterLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Evidence Integrity Verification
  // -------------------------------------------------------------
  const handleVerifyEvidence = async (evidenceId, file) => {
    setVerifyLoading(true);
    setVerifyError("");
    setVerificationResult(null);
    setVerifyBlockchainHash("");
    setVerifyCurrentHash("");

    try {
      // Calculate file SHA-256
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setVerifyCurrentHash(hashHex);

      // Fetch on-chain hash
      const evRes = await getEvidenceAPI(evidenceId);
      const onChainHash = evRes.evidence?.evidenceHash;
      setVerifyBlockchainHash(onChainHash || "");

      // Execute on-chain verify check
      const vResult = await verifyEvidenceAPI(evidenceId, hashHex);
      setVerificationResult(vResult);

      if (vResult.result === "AUTHENTIC") {
        showToast(
          "Candidate file SHA-256 matches recorded intake digest; active ledger anchor confirmed.",
          "success",
          null,
          "SHA-256 MATCH (ACTIVE LEDGER)"
        );
      } else if (vResult.result === "AUTHENTIC_HISTORICAL") {
        showToast(
          "Candidate file SHA-256 matches recorded intake digest; historical registration reference recorded; current-ledger verification unavailable.",
          "warning",
          null,
          "SHA-256 MATCH (HISTORICAL RECORD)"
        );
      } else {
        showToast(
          "Cryptographic hash mismatch! Candidate file has been altered.",
          "error",
          null,
          "TAMPERING DETECTED"
        );
      }
    } catch (err) {
      setVerifyError(err.message || "Integrity verification failed.");
      showToast(err.message || "Verification request failed.", "error", null, "VERIFICATION ERROR");
    } finally {
      setVerifyLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Access Management (Grant / Revoke / Check)
  // -------------------------------------------------------------
  const handleCheckViewAccess = async (evidenceId, userAddress) => {
    setAccessLoading(true);
    setAccessError("");
    try {
      const res = await checkViewAccessAPI(evidenceId, userAddress);
      setAccessViewStatus(Boolean(res.canView));
    } catch (err) {
      setAccessError(err.message || "Failed to check VIEW permission.");
    } finally {
      setAccessLoading(false);
    }
  };

  const handleCheckDownloadAccess = async (evidenceId, userAddress) => {
    setAccessLoading(true);
    setAccessError("");
    try {
      const res = await checkDownloadAccessAPI(evidenceId, userAddress);
      setAccessDownloadStatus(Boolean(res.canDownload));
    } catch (err) {
      setAccessError(err.message || "Failed to check DOWNLOAD permission.");
    } finally {
      setAccessLoading(false);
    }
  };

  const handleGrantViewAccess = async (evidenceId, userAddress, caseId = "", targetName = "") => {
    setAccessLoading(true);
    setAccessError("");
    setAccessActionResult(null);
    try {
      const res = await grantViewAccessAPI(evidenceId, userAddress, currentUser.walletAddress, caseId, targetName);
      setAccessActionResult({
        success: true,
        message: `VIEW permission granted on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        transactionHash: res.transactionHash,
        blockNumber: res.blockNumber,
      });
      setAccessViewStatus(true);
      showToast(
        `VIEW access granted on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        "success",
        null,
        "VIEW ACCESS GRANTED"
      );
      return res;
    } catch (err) {
      setAccessError(err.message || "Failed to grant VIEW permission.");
      showToast(err.message || "Failed to grant VIEW permission.", "error", null, "OPERATION DENIED");
      throw err;
    } finally {
      setAccessLoading(false);
    }
  };

  const handleRevokeViewAccess = async (evidenceId, userAddress, caseId = "", targetName = "") => {
    setAccessLoading(true);
    setAccessError("");
    setAccessActionResult(null);
    try {
      const res = await revokeViewAccessAPI(evidenceId, userAddress, currentUser.walletAddress, caseId, targetName);
      setAccessActionResult({
        success: true,
        message: `VIEW permission revoked on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        transactionHash: res.transactionHash,
        blockNumber: res.blockNumber,
      });
      setAccessViewStatus(false);
      showToast(
        `VIEW access revoked on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        "warning",
        null,
        "VIEW ACCESS REVOKED"
      );
      return res;
    } catch (err) {
      setAccessError(err.message || "Failed to revoke VIEW permission.");
      showToast(err.message || "Failed to revoke VIEW permission.", "error", null, "OPERATION DENIED");
      throw err;
    } finally {
      setAccessLoading(false);
    }
  };

  const handleGrantDownloadAccess = async (evidenceId, userAddress, caseId = "", targetName = "") => {
    setAccessLoading(true);
    setAccessError("");
    setAccessActionResult(null);
    try {
      const res = await grantDownloadAccessAPI(evidenceId, userAddress, currentUser.walletAddress, caseId, targetName);
      setAccessActionResult({
        success: true,
        message: `DOWNLOAD permission granted on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        transactionHash: res.transactionHash,
        blockNumber: res.blockNumber,
      });
      setAccessDownloadStatus(true);
      showToast(
        `DOWNLOAD access granted on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        "success",
        null,
        "DOWNLOAD ACCESS GRANTED"
      );
      return res;
    } catch (err) {
      setAccessError(err.message || "Failed to grant DOWNLOAD permission.");
      showToast(err.message || "Failed to grant DOWNLOAD permission.", "error", null, "OPERATION DENIED");
      throw err;
    } finally {
      setAccessLoading(false);
    }
  };

  const handleRevokeDownloadAccess = async (evidenceId, userAddress, caseId = "", targetName = "") => {
    setAccessLoading(true);
    setAccessError("");
    setAccessActionResult(null);
    try {
      const res = await revokeDownloadAccessAPI(evidenceId, userAddress, currentUser.walletAddress, caseId, targetName);
      setAccessActionResult({
        success: true,
        message: `DOWNLOAD permission revoked on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        transactionHash: res.transactionHash,
        blockNumber: res.blockNumber,
      });
      setAccessDownloadStatus(false);
      showToast(
        `DOWNLOAD access revoked on blockchain for ${targetName || userAddress.slice(0, 8) + "..."}`,
        "warning",
        null,
        "DOWNLOAD ACCESS REVOKED"
      );
      return res;
    } catch (err) {
      setAccessError(err.message || "Failed to revoke DOWNLOAD permission.");
      showToast(err.message || "Failed to revoke DOWNLOAD permission.", "error", null, "OPERATION DENIED");
      throw err;
    } finally {
      setAccessLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Access History Fetching
  // -------------------------------------------------------------
  const handleFetchAccessHistory = useCallback(async (evidenceId) => {
    if (!evidenceId) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await getAccessHistoryAPI(evidenceId);
      setHistoryRecords(res.records || res.accessHistory || []);
      return res;
    } catch (err) {
      setHistoryError(err.message || "Failed to fetch access history.");
      setHistoryRecords([]);
      throw err;
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // -------------------------------------------------------------
  // RENDER: Session Pre-Flight Verification
  // -------------------------------------------------------------
  if (authChecking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--bg-app)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--text-secondary)",
          gap: "12px",
        }}
      >
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>
          EvidenceChain
        </div>
        <div>VERIFYING INSTITUTIONAL SECURITY CREDENTIALS...</div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Unauthenticated -> Landing Page or Secure Access Portal
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    if (publicPage === "login") {
      return (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onBackToHome={() => setPublicPage("landing")}
          backendConnected={backendConnected}
          blockchainConnected={blockchainConnected}
        />
      );
    }

    return (
      <LandingPageView
        onNavigateToLogin={() => setPublicPage("login")}
      />
    );
  }

  // -------------------------------------------------------------
  // RENDER: Authenticated -> Main Forensic Operations Console
  // -------------------------------------------------------------
  return (
    <div className="app-layout">
      {/* Sidebar Shell */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        backendConnected={backendConnected}
      />

      {/* Main View Area */}
      <div className="app-main-wrapper">
        <Header
          activeView={activeView}
          backendConnected={backendConnected}
          blockchainConnected={blockchainConnected}
          onRefresh={checkHealthAndLoadData}
        />

        <main className="app-content-area">
          {activeView === "dashboard" && (
            <DashboardView
              evidenceList={evidenceList}
              backendConnected={backendConnected}
              blockchainConnected={blockchainConnected}
              currentUser={currentUser}
              onNavigate={setActiveView}
              onSelectEvidence={handleSelectEvidence}
            />
          )}

          {activeView === "evidence" && (
            <EvidenceListView
              evidenceList={evidenceList}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onNavigate={setActiveView}
              onSelectEvidence={handleSelectEvidence}
              onVerifyEvidence={(id) => {
                setVerifyEvidenceId(id);
                setActiveView("verify");
              }}
              onManageAccess={(id) => {
                setSelectedEvidenceId(id);
                setActiveView("access");
              }}
              currentUser={currentUser}
            />
          )}

          {activeView === "register" && (
            <RegisterEvidenceView
              onRegister={handleRegisterEvidence}
              loading={registerLoading}
              error={registerError}
              result={registerResult}
              evidenceList={evidenceList}
              onReset={() => {
                setRegisterResult(null);
                setRegisterError("");
              }}
              backendConnected={backendConnected}
              currentUser={currentUser}
              onBack={() => setActiveView("evidence")}
              onNavigateHistory={(evId) => {
                if (evId) setSelectedEvidenceId(evId);
                setActiveView("history");
              }}
            />
          )}

          {activeView === "verify" && (
            <VerifyEvidenceView
              evidenceList={evidenceList}
              initialEvidenceId={verifyEvidenceId || selectedEvidenceId}
              onVerify={handleVerifyEvidence}
              loading={verifyLoading}
              error={verifyError}
              verificationResult={verificationResult}
              blockchainHash={verifyBlockchainHash}
              currentHash={verifyCurrentHash}
              onReset={() => {
                setVerificationResult(null);
                setVerifyError("");
                setVerifyBlockchainHash("");
                setVerifyCurrentHash("");
              }}
              backendConnected={backendConnected}
              onBack={() => setActiveView("evidence")}
            />
          )}

          {activeView === "details" && (
            <EvidenceDetailsView
              evidenceId={selectedEvidenceId || (evidenceList[0]?.evidenceId || "EVD-DA7FA47B")}
              evidenceData={evidenceDetails}
              accessHistory={detailsAccessHistory}
              loading={detailsLoading}
              error={detailsError}
              currentUser={currentUser}
              onCheckViewAccess={handleCheckViewAccess}
              onCheckDownloadAccess={handleCheckDownloadAccess}
              viewAccessAllowed={detailsViewAllowed}
              downloadAccessAllowed={detailsDownloadAllowed}
              onViewFile={handleViewFile}
              onDownloadFile={handleDownloadFile}
              viewedFileUrl={viewedFileUrl}
              viewedFileName={viewedFileName}
              onCloseViewer={closeFileViewer}
              onNavigateVerify={(id) => {
                setVerifyEvidenceId(id);
                setActiveView("verify");
              }}
              onNavigateAccess={(id) => {
                setSelectedEvidenceId(id);
                setActiveView("access");
              }}
              onBack={() => setActiveView("evidence")}
            />
          )}

          {activeView === "department" && (
            <DepartmentAuthorityView
              currentUser={currentUser}
              backendConnected={backendConnected}
              onNavigateAccess={(evId) => {
                if (evId) setSelectedEvidenceId(evId);
                setActiveView("access");
              }}
            />
          )}

          {activeView === "access" && (
            <AccessManagementView
              evidenceList={evidenceList}
              initialEvidenceId={selectedEvidenceId}
              onCheckViewAccess={handleCheckViewAccess}
              onCheckDownloadAccess={handleCheckDownloadAccess}
              onGrantViewAccess={handleGrantViewAccess}
              onRevokeViewAccess={handleRevokeViewAccess}
              onGrantDownloadAccess={handleGrantDownloadAccess}
              onRevokeDownloadAccess={handleRevokeDownloadAccess}
              viewStatus={accessViewStatus}
              downloadStatus={accessDownloadStatus}
              actionResult={accessActionResult}
              loading={accessLoading}
              error={accessError}
              backendConnected={backendConnected}
              currentUser={currentUser}
              onBack={() => setActiveView("evidence")}
              onNavigateHistory={(evId) => {
                if (evId) setSelectedEvidenceId(evId);
                setActiveView("history");
              }}
            />
          )}

          {activeView === "history" && (
            <AccessHistoryView
              evidenceList={evidenceList}
              initialEvidenceId={selectedEvidenceId}
              onFetchHistory={handleFetchAccessHistory}
              historyRecords={historyRecords}
              loading={historyLoading}
              error={historyError}
              backendConnected={backendConnected}
              currentUser={currentUser}
              onBack={() => setActiveView("evidence")}
            />
          )}

          {activeView === "profile" && (
            <IdentityProfileView
              currentUser={currentUser}
              onRefreshUser={async () => {
                try {
                  const res = await getMeAPI();
                  if (res?.status === "authenticated" && res?.user) {
                    setCurrentUser(res.user);
                    return res;
                  }
                } catch (e) {
                  console.warn("Failed to refresh user:", e);
                }
              }}
              onLogout={handleLogout}
              onSwitchSuccess={(newOfficer) => {
                setCurrentUser(newOfficer);
                showToast(`Active session switched to ${newOfficer?.name || "officer"}.`, "success");
              }}
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              backendConnected={backendConnected}
            />
          )}

          {activeView === "status" && (
            <SystemStatusView
              backendConnected={backendConnected}
              blockchainConnected={blockchainConnected}
              onRefreshHealth={checkHealthAndLoadData}
              currentUser={currentUser}
              onSwitchUserAddress={() => {
                showToast(
                  "Session Identity Locked: Local testnet accounts are for RPC diagnostics. Switch examiner by logging out and authenticating.",
                  "warning"
                );
              }}
            />
          )}
        </main>
      </div>

      {/* Institutional Re-Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(newOfficer) => {
          setCurrentUser(newOfficer);
        }}
        currentUser={currentUser}
      />

      {/* Global Forensic Operation Feedback Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
