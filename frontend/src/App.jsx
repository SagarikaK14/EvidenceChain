import { useState } from "react";

import {
  checkBackendHealth,
  registerEvidenceAPI,
  getEvidenceAPI,
  verifyEvidenceAPI,

  checkViewAccessAPI,
  checkDownloadAccessAPI,

  grantViewAccessAPI,
  revokeViewAccessAPI,

  grantDownloadAccessAPI,
  revokeDownloadAccessAPI,

  recordAccessAPI,
  getAccessHistoryAPI,
} from "./api";
import "./App.css";


// ============================================================
// SHA-256 HASH
// ============================================================

async function calculateSHA256(file) {
  const buffer = await file.arrayBuffer();

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    buffer
  );

  const hashArray = Array.from(
    new Uint8Array(hashBuffer)
  );

  return hashArray
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}


// ============================================================
// SHORTEN ADDRESS
// ============================================================

function shortenAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}


// ============================================================
// VALIDATE ETHEREUM ADDRESS
// ============================================================

function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(
    address
  );
}


// ============================================================
// FORMAT BLOCKCHAIN TIMESTAMP
// ============================================================

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "N/A";
  }

  const numericTimestamp =
    Number(timestamp);

  if (!Number.isFinite(numericTimestamp)) {
    return timestamp;
  }

  return new Date(
    numericTimestamp * 1000
  ).toLocaleString();
}


// ============================================================
// APP
// ============================================================

function App() {

  // ==========================================================
  // BACKEND CONNECTION
  // ==========================================================

  const [backendConnected, setBackendConnected] =
    useState(false);

  const [connectionError, setConnectionError] =
    useState("");


  // ==========================================================
  // REGISTER
  // ==========================================================

  const [showRegister, setShowRegister] =
    useState(false);

  const [registerCaseId, setRegisterCaseId] =
    useState("");

  const [registerDescription, setRegisterDescription] =
    useState("");

  const [registerFile, setRegisterFile] =
    useState(null);

  const [registerHash, setRegisterHash] =
    useState("");

  const [registerLoading, setRegisterLoading] =
    useState(false);

  const [registerResult, setRegisterResult] =
    useState(null);

  const [registerError, setRegisterError] =
    useState("");


  // ==========================================================
  // VERIFY
  // ==========================================================

  const [showVerify, setShowVerify] =
    useState(false);

  const [verifyEvidenceId, setVerifyEvidenceId] =
    useState("");

  const [verifyFile, setVerifyFile] =
    useState(null);

  const [verifyHash, setVerifyHash] =
    useState("");

  const [verificationResult, setVerificationResult] =
    useState(null);

  const [blockchainHash, setBlockchainHash] =
    useState("");

  const [verifyLoading, setVerifyLoading] =
    useState(false);

  const [verifyError, setVerifyError] =
    useState("");


  // ==========================================================
  // DETAILS
  // ==========================================================

  const [showDetails, setShowDetails] =
    useState(false);

  const [detailsEvidenceId, setDetailsEvidenceId] =
    useState("");

  const [evidenceDetails, setEvidenceDetails] =
    useState(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState("");

  const [accessHistory, setAccessHistory] =
    useState([]);


  // ==========================================================
  // ACCESS MANAGEMENT
  // ==========================================================

  const [showAccessManagement, setShowAccessManagement] =
    useState(false);

  const [accessEvidenceId, setAccessEvidenceId] =
    useState("");

  const [accessUserAddress, setAccessUserAddress] =
    useState("");

  const [accessLoading, setAccessLoading] =
    useState(false);

  const [accessResult, setAccessResult] =
    useState(null);

  const [accessError, setAccessError] =
    useState("");

  const [viewAccessStatus, setViewAccessStatus] =
    useState(null);

  const [downloadAccessStatus, setDownloadAccessStatus] =
    useState(null);


  // ==========================================================
  // CONNECT BACKEND
  // ==========================================================

  const handleConnect = async () => {
    try {
      setConnectionError("");

      const result =
        await checkBackendHealth();

      if (result.status !== "ok") {
        throw new Error(
          "Backend health check failed."
        );
      }

      setBackendConnected(true);

    } catch (error) {
      console.error(
        "Backend connection error:",
        error
      );

      setBackendConnected(false);

      setConnectionError(
        error?.message ||
        "Unable to connect to EvidenceChain backend."
      );
    }
  };


  // ==========================================================
  // REGISTER FILE
  // ==========================================================

  const handleRegisterFile = async (file) => {

    setRegisterFile(file);

    setRegisterResult(null);
    setRegisterError("");

    if (!file) {
      setRegisterHash("");
      return;
    }

    try {

      const hash =
        await calculateSHA256(file);

      setRegisterHash(hash);

    } catch (error) {

      console.error(error);

      setRegisterHash("");

      setRegisterError(
        "Unable to calculate file hash."
      );
    }
  };


  // ==========================================================
  // REGISTER EVIDENCE
  // ==========================================================

  const handleRegister = async () => {

    setRegisterError("");
    setRegisterResult(null);

    if (!backendConnected) {

      setRegisterError(
        "Please connect to the EvidenceChain backend first."
      );

      return;
    }

    if (!registerCaseId.trim()) {

      setRegisterError(
        "Please enter a Case ID."
      );

      return;
    }

    if (!registerFile) {

      setRegisterError(
        "Please select an evidence file."
      );

      return;
    }

    try {

      setRegisterLoading(true);

      const hash =
        await calculateSHA256(
          registerFile
        );

      setRegisterHash(hash);

      const result =
        await registerEvidenceAPI(
          registerFile,
          registerCaseId.trim(),
          registerDescription.trim()
        );

      setRegisterResult(result);

    } catch (error) {

      console.error(
        "Registration error:",
        error
      );

      setRegisterError(
        error?.message ||
        "Evidence registration failed."
      );

    } finally {

      setRegisterLoading(false);
    }
  };


  // ==========================================================
  // VERIFY FILE SELECTION
  // ==========================================================

  const handleVerifyFile = async (file) => {

    setVerifyFile(file);

    setVerificationResult(null);
    setBlockchainHash("");
    setVerifyError("");

    if (!file) {
      setVerifyHash("");
      return;
    }

    try {

      const hash =
        await calculateSHA256(file);

      setVerifyHash(hash);

    } catch (error) {

      console.error(error);

      setVerifyHash("");

      setVerifyError(
        "Unable to calculate file hash."
      );
    }
  };


  // ==========================================================
  // VERIFY EVIDENCE
  // ==========================================================

  const handleVerify = async () => {

    setVerifyError("");
    setVerificationResult(null);
    setBlockchainHash("");

    if (!backendConnected) {

      setVerifyError(
        "Please connect to the EvidenceChain backend first."
      );

      return;
    }

    if (!verifyEvidenceId.trim()) {

      setVerifyError(
        "Please enter an Evidence ID."
      );

      return;
    }

    if (!verifyFile) {

      setVerifyError(
        "Please select an evidence file."
      );

      return;
    }

    try {

      setVerifyLoading(true);

      // ------------------------------------------------------
      // STEP 1: CALCULATE CURRENT FILE HASH
      // ------------------------------------------------------

      const currentHash =
        await calculateSHA256(
          verifyFile
        );

      setVerifyHash(currentHash);

      // ------------------------------------------------------
      // STEP 2: GET BLOCKCHAIN RECORD THROUGH BACKEND
      // ------------------------------------------------------

      const evidenceResponse =
        await getEvidenceAPI(
          verifyEvidenceId.trim()
        );

      const blockchainEvidence =
        evidenceResponse.evidence;

      const storedHash =
        blockchainEvidence.evidenceHash;

      setBlockchainHash(storedHash);

      // ------------------------------------------------------
      // STEP 3: ASK BACKEND TO VERIFY
      // ------------------------------------------------------

      const result =
        await verifyEvidenceAPI(
          verifyEvidenceId.trim(),
          currentHash
        );

      // ------------------------------------------------------
      // STEP 4: DISPLAY RESULT
      // ------------------------------------------------------

      setVerificationResult(
        Boolean(result.isAuthentic)
      );

    } catch (error) {

      console.error(
        "Verification error:",
        error
      );

      setVerifyError(
        error?.message ||
        "Verification failed. Check the Evidence ID and file."
      );

    } finally {

      setVerifyLoading(false);
    }
  };

  // ==========================================================
  // GET EVIDENCE DETAILS
  // ==========================================================

  const handleGetDetails = async () => {

    setDetailsError("");
    setEvidenceDetails(null);
    setAccessHistory([]);

    if (!backendConnected) {

      setDetailsError(
        "Please connect to the EvidenceChain backend first."
      );

      return;
    }

    if (!detailsEvidenceId.trim()) {

      setDetailsError(
        "Please enter an Evidence ID."
      );

      return;
    }

    try {

      setDetailsLoading(true);

      const evidenceId =
        detailsEvidenceId.trim();

      const result =
        await getEvidenceAPI(evidenceId);

      setEvidenceDetails({
        blockchain: result.evidence,
        metadata: result.database,
      });

      // ------------------------------------------------------
      // RECORD THAT THE EVIDENCE WAS ACCESSED
      // ------------------------------------------------------

      try {

        await recordAccessAPI(
          evidenceId
        );

      } catch (accessError) {

        console.warn(
          "Could not record evidence access:",
          accessError
        );

      }

      // ------------------------------------------------------
      // LOAD ACCESS HISTORY
      // ------------------------------------------------------

      try {

        const accessResult =
          await getAccessHistoryAPI(
            evidenceId
          );

        setAccessHistory(
          accessResult.accessHistory || []
        );

      } catch (accessError) {

        console.warn(
          "Could not load access history:",
          accessError
        );

      }

    } catch (error) {

      console.error(
        "Details error:",
        error
      );

      setDetailsError(
        error?.message ||
        "Evidence not found."
      );

    } finally {

      setDetailsLoading(false);
    }
  };


  // ==========================================================
  // ACCESS MANAGEMENT
  // ==========================================================

  const handleCheckViewAccess = async () => {

    setAccessError("");
    setAccessResult(null);

    if (!backendConnected) {

      setAccessError(
        "Please connect to the EvidenceChain backend first."
      );

      return;
    }

    if (!accessEvidenceId.trim()) {

      setAccessError(
        "Please enter an Evidence ID."
      );

      return;
    }

    if (!accessUserAddress.trim()) {

      setAccessError(
        "Please enter a user Ethereum address."
      );

      return;
    }

    if (
      !isValidEthereumAddress(
        accessUserAddress.trim()
      )
    ) {

      setAccessError(
        "Please enter a valid Ethereum address."
      );

      return;
    }

    try {

      setAccessLoading(true);

      const result =
        await checkViewAccessAPI(
          accessEvidenceId.trim(),
          accessUserAddress.trim()
        );

      setAccessResult({
        type: "VIEW",
        result
      });

    } catch (error) {

      console.error(
        "View access check error:",
        error
      );

      setAccessError(
        error?.message ||
        "Could not check view access."
      );

    } finally {

      setAccessLoading(false);
    }
  };


  const handleCheckDownloadAccess = async () => {

    setAccessError("");
    setAccessResult(null);

    if (!backendConnected) {

      setAccessError(
        "Please connect to the EvidenceChain backend first."
      );

      return;
    }

    if (!accessEvidenceId.trim()) {

      setAccessError(
        "Please enter an Evidence ID."
      );

      return;
    }

    if (!accessUserAddress.trim()) {

      setAccessError(
        "Please enter a user Ethereum address."
      );

      return;
    }

    if (
      !isValidEthereumAddress(
        accessUserAddress.trim()
      )
    ) {

      setAccessError(
        "Please enter a valid Ethereum address."
      );

      return;
    }

    try {

      setAccessLoading(true);

      const result =
        await checkDownloadAccessAPI(
          accessEvidenceId.trim(),
          accessUserAddress.trim()
        );

      setAccessResult({
        type: "DOWNLOAD",
        result
      });

    } catch (error) {

      console.error(
        "Download access check error:",
        error
      );

      setAccessError(
        error?.message ||
        "Could not check download access."
      );

    } finally {

      setAccessLoading(false);
    }
  };


  const handleGrantViewAccess = async () => {

    await handleAccessAction(
      grantViewAccessAPI,
      "View access granted successfully."
    );
  };


  const handleRevokeViewAccess = async () => {

    await handleAccessAction(
      revokeViewAccessAPI,
      "View access revoked successfully."
    );
  };


  const handleGrantDownloadAccess = async () => {

    await handleAccessAction(
      grantDownloadAccessAPI,
      "Download access granted successfully."
    );
  };


  const handleRevokeDownloadAccess = async () => {

    await handleAccessAction(
      revokeDownloadAccessAPI,
      "Download access revoked successfully."
    );
  };


  const handleAccessAction = async (
    apiFunction,
    successMessage
  ) => {

    setAccessError("");
    setAccessResult(null);

    if (!backendConnected) {

      setAccessError(
        "Please connect to the EvidenceChain backend first."
      );

      return;
    }

    if (!accessEvidenceId.trim()) {

      setAccessError(
        "Please enter an Evidence ID."
      );

      return;
    }

    if (!accessUserAddress.trim()) {

      setAccessError(
        "Please enter a user Ethereum address."
      );

      return;
    }

    if (
      !isValidEthereumAddress(
        accessUserAddress.trim()
      )
    ) {

      setAccessError(
        "Please enter a valid Ethereum address."
      );

      return;
    }

    try {

      setAccessLoading(true);

      const result =
        await apiFunction(
          accessEvidenceId.trim(),
          accessUserAddress.trim()
        );

      setAccessResult({
        type: "ACTION",
        message: successMessage,
        result
      });

    } catch (error) {

      console.error(
        "Access management error:",
        error
      );

      setAccessError(
        error?.message ||
        "Access management operation failed."
      );

    } finally {

      setAccessLoading(false);
    }
  };


  // ==========================================================
  // CLOSE PANELS
  // ==========================================================

  const closePanels = () => {

    setShowRegister(false);
    setShowVerify(false);
    setShowDetails(false);
    setShowAccessManagement(false);
  };


  // ==========================================================
  // UI
  // ==========================================================

  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="app">

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <header className="header">

        <div>

          <h1>
            EvidenceChain
          </h1>

          <p>
            Secure Digital Evidence Management
          </p>

        </div>

        <button
          className="connect-button"
          onClick={handleConnect}
        >

          {backendConnected
            ? "Backend Connected"
            : "Connect Backend"}

        </button>

      </header>


      {/* ================================================== */}
      {/* MAIN */}
      {/* ================================================== */}

      <main className="main">


        {/* ================================================== */}
        {/* HERO */}
        {/* ================================================== */}

        <section className="hero-section">

          <h2>
            Digital Evidence Chain of Custody
          </h2>

          <p>
            Register, verify, and track digital
            evidence securely using blockchain
            technology.
          </p>

        </section>


        {/* ================================================== */}
        {/* CONNECTION STATUS */}
        {/* ================================================== */}

        {backendConnected && (

          <div className="connection-status">

            <h3>
              ● EvidenceChain Backend Connected
            </h3>

            <p>
              Flask API: http://127.0.0.1:5001
            </p>

            <p>
              Blockchain: Hardhat Local Network
            </p>

          </div>

        )}


        {/* ================================================== */}
        {/* CONNECTION ERROR */}
        {/* ================================================== */}

        {connectionError && (

          <div className="error-box">

            ✗ {connectionError}

          </div>

        )}


        {/* ================================================== */}
        {/* REGISTER PANEL */}
        {/* ================================================== */}

        {showRegister && (

          <section className="panel">

            <button
              className="close-button"
              onClick={closePanels}
            >
              ×
            </button>


            <h2>
              Register Digital Evidence
            </h2>

            <p>
              Upload evidence and permanently
              record its SHA-256 hash on the
              blockchain.
            </p>


            {/* CASE ID */}

            <div className="form-group">

              <label>
                Case ID
              </label>

              <input
                type="text"
                placeholder="e.g. CASE-004"
                value={registerCaseId}
                onChange={(e) =>
                  setRegisterCaseId(
                    e.target.value
                  )
                }
              />

            </div>


            {/* DESCRIPTION */}

            <div className="form-group">

              <label>
                Description
              </label>

              <input
                type="text"
                placeholder="Brief description of evidence"
                value={registerDescription}
                onChange={(e) =>
                  setRegisterDescription(
                    e.target.value
                  )
                }
              />

            </div>


            {/* FILE */}

            <div className="form-group">

              <label>
                Evidence File
              </label>

              <input
                type="file"
                onChange={(e) =>
                  handleRegisterFile(
                    e.target.files[0]
                  )
                }
              />

            </div>


            {/* HASH */}

            {registerHash && (

              <div className="hash-box">

                <strong>
                  SHA-256 Hash
                </strong>

                <span>
                  {registerHash}
                </span>

              </div>

            )}


            {/* RESULT */}

            {registerResult && (

              <div className="success-box">

                <h3>
                  ✓ Evidence Registered
                </h3>

                <p>
                  Evidence registered successfully
                  on the blockchain.
                </p>

                <p>
                  <strong>
                    Evidence ID:
                  </strong>
                  {" "}
                  {registerResult.evidenceId}
                </p>

                <p>
                  <strong>
                    Case ID:
                  </strong>
                  {" "}
                  {registerResult.caseId}
                </p>

                <p>
                  <strong>
                    SHA-256:
                  </strong>
                  {" "}
                  {registerResult.evidenceHash}
                </p>

                <p>
                  <strong>
                    Block:
                  </strong>
                  {" "}
                  {registerResult.blockNumber}
                </p>

                <p>
                  <strong>
                    Transaction:
                  </strong>
                </p>

                <span>
                  {registerResult.transactionHash}
                </span>

              </div>

            )}


            {/* ERROR */}

            {registerError && (

              <div className="error-box">

                ✗ {registerError}

              </div>

            )}


            {/* BUTTON */}

            <button
              className="primary-button"
              onClick={handleRegister}
              disabled={registerLoading}
            >

              {registerLoading
                ? "Registering..."
                : "Register on Blockchain"}

            </button>

          </section>

        )}


        {/* ================================================== */}
        {/* VERIFY PANEL */}
        {/* ================================================== */}

        {showVerify && (

          <section className="panel">

            <button
              className="close-button"
              onClick={closePanels}
            >
              ×
            </button>


            <h2>
              Verify Digital Evidence
            </h2>

            <p>
              Compare the uploaded file's
              SHA-256 hash with the hash
              stored on the blockchain.
            </p>


            {/* EVIDENCE ID */}

            <div className="form-group">

              <label>
                Evidence ID
              </label>

              <input
                type="text"
                placeholder="e.g. EVD-9FE5BD91"
                value={verifyEvidenceId}
                onChange={(e) => {

                  setVerifyEvidenceId(
                    e.target.value
                  );

                  setVerificationResult(
                    null
                  );

                  setBlockchainHash("");
                  setVerifyError("");

                }}
              />

            </div>


            {/* FILE */}

            <div className="form-group">

              <label>
                Evidence File
              </label>

              <input
                type="file"
                onChange={(e) =>
                  handleVerifyFile(
                    e.target.files[0]
                  )
                }
              />

            </div>


            {/* CURRENT FILE HASH */}

            {verifyHash && (

              <div className="hash-box">

                <strong>
                  Uploaded File SHA-256
                </strong>

                <span>
                  {verifyHash}
                </span>

              </div>

            )}


            {/* BLOCKCHAIN HASH */}

            {blockchainHash && (

              <div className="hash-box">

                <strong>
                  Blockchain Stored Hash
                </strong>

                <span>
                  {blockchainHash}
                </span>

              </div>

            )}


            {/* ERROR */}

            {verifyError && (

              <div className="error-box">

                ✗ {verifyError}

              </div>

            )}


            {/* AUTHENTIC */}

            {verificationResult === true && (

              <div className="success-box">

                <h3>
                  ✓ EVIDENCE AUTHENTIC
                </h3>

                <p>
                  The uploaded file matches
                  the hash stored on the
                  blockchain.
                </p>

                <p>
                  Evidence integrity verified
                  successfully.
                </p>

              </div>

            )}


            {/* TAMPERED */}

            {verificationResult === false && (

              <div className="tampered-box">

                <h3>
                  ✗ TAMPER DETECTED
                </h3>

                <p>
                  The uploaded file does NOT
                  match the hash stored on the
                  blockchain.
                </p>

                <p>
                  The evidence may have been
                  modified after registration.
                </p>

              </div>

            )}


            {/* BUTTON */}

            <button
              className="primary-button"
              onClick={handleVerify}
              disabled={verifyLoading}
            >

              {verifyLoading
                ? "Verifying..."
                : "Verify Against Blockchain"}

            </button>

          </section>

        )}


        {/* ================================================== */}
        {/* DETAILS PANEL */}
        {/* ================================================== */}

        {showDetails && (

          <section className="panel">

            <button
              className="close-button"
              onClick={closePanels}
            >
              ×
            </button>


            <h2>
              Evidence Details
            </h2>

            <p>
              Retrieve evidence information,
              custody history, and access history.
            </p>


            {/* EVIDENCE ID */}

            <div className="form-group">

              <label>
                Evidence ID
              </label>

              <input
                type="text"
                placeholder="e.g. EVD-9FE5BD91"
                value={detailsEvidenceId}
                onChange={(e) =>
                  setDetailsEvidenceId(
                    e.target.value
                  )
                }
              />

            </div>


            {/* ERROR */}

            {detailsError && (

              <div className="error-box">

                ✗ {detailsError}

              </div>

            )}


            {/* BUTTON */}

            <button
              className="primary-button"
              onClick={handleGetDetails}
              disabled={detailsLoading}
            >

              {detailsLoading
                ? "Loading..."
                : "Get Evidence Details"}

            </button>


            {/* DETAILS */}

            {evidenceDetails && (

              <div className="details-table">

                <div>

                  <strong>
                    Evidence ID
                  </strong>

                  <span>
                    {evidenceDetails.blockchain.evidenceId}
                  </span>

                </div>


                <div>

                  <strong>
                    Case ID
                  </strong>

                  <span>
                    {evidenceDetails.blockchain.caseId}
                  </span>

                </div>


                <div>

                  <strong>
                    Blockchain Hash
                  </strong>

                  <span>
                    {evidenceDetails.blockchain.evidenceHash}
                  </span>

                </div>


                <div>

                  <strong>
                    Registered By
                  </strong>

                  <span>
                    {shortenAddress(
                      evidenceDetails.blockchain.registeredBy
                    )}
                  </span>

                </div>


                <div>

                  <strong>
                    Registered At
                  </strong>

                  <span>
                    {formatTimestamp(
                      evidenceDetails.blockchain.timestamp
                    )}
                  </span>

                </div>


                <div>

                  <strong>
                    Current Custodian
                  </strong>

                  <span>
                    {shortenAddress(
                      evidenceDetails.blockchain.currentCustodian
                    )}
                  </span>

                </div>


                {evidenceDetails.metadata && (

                  <>

                    <div>

                      <strong>
                        File Name
                      </strong>

                      <span>
                        {
                          evidenceDetails.metadata.title
                        }
                      </span>

                    </div>


                    <div>

                      <strong>
                        Description
                      </strong>

                      <span>
                        {
                          evidenceDetails.metadata.description ||
                          "N/A"
                        }
                      </span>

                    </div>

                  </>

                )}

              </div>

            )}


            {/* ACCESS HISTORY */}

            {evidenceDetails && (

              <div className="history-section">

                <h3>
                  Access History
                </h3>

                {accessHistory.length === 0 ? (

                  <p>
                    No access history recorded.
                  </p>

                ) : (

                  accessHistory.map(
                    (record, index) => (

                      <div
                        className="history-item"
                        key={index}
                      >

                        <strong>
                          Access {index + 1}
                        </strong>

                        <span>
                          By:{" "}
                          {shortenAddress(
                            record.accessedBy
                          )}
                        </span>

                        <span>
                          Time:{" "}
                          {formatTimestamp(
                            record.timestamp
                          )}
                        </span>

                      </div>

                    )
                  )

                )}

              </div>

            )}
            </section>
        )}



        {/* ================================================== */}
        {/* FEATURE CARDS */}
        {/* ================================================== */}

        <section className="cards">


          {/* REGISTER */}

          <div className="card">

            <div className="card-icon">
              📤
            </div>

            <h2>
              Register Evidence
            </h2>

            <p>
              Upload evidence and permanently
              record its cryptographic hash
              on the blockchain.
            </p>

            <button
              className="primary-button"
              onClick={() => {

                closePanels();
                setShowRegister(true);

              }}
            >
              Register Evidence
            </button>

          </div>


          {/* VERIFY */}

          <div className="card">

            <div className="card-icon">
              🔍
            </div>

            <h2>
              Verify Evidence
            </h2>

            <p>
              Check whether an evidence file
              matches the hash stored on the
              blockchain.
            </p>

            <button
              className="primary-button"
              onClick={() => {

                closePanels();
                setShowVerify(true);

              }}
            >
              Verify Evidence
            </button>

          </div>


          {/* DETAILS */}

          <div className="card">

            <div className="card-icon">
              📋
            </div>

            <h2>
              Evidence Details
            </h2>

            <p>
              View evidence metadata,
              registration details, custody
              information, and access history.
            </p>

            <button
              className="primary-button"
              onClick={() => {

                closePanels();
                setShowDetails(true);

              }}
            >
              View Details
            </button>

          </div>

{/* ACCESS MANAGEMENT */}

<div className="card">

  <div className="card-icon">
    🔐
  </div>

  <h2>
    Access Management
  </h2>

  <p>
    Manage view and download permissions
    for authorized evidence users.
  </p>

  <button
    className="primary-button"
    onClick={() => {

      closePanels();
      setShowAccessManagement(true);

    }}
  >
    Manage Access
  </button>

</div>
        </section>

      </main>

    </div>
  );
}


export default App;
