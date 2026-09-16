import { useState } from "react";
import {
  connectBlockchain,
  registerEvidence,
  getEvidence,
  verifyEvidence,
  transferCustody,
} from "./blockchain";
import "./App.css";

// ==================================================
// SHA-256 HASH
// ==================================================

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
    .join("")
    .toUpperCase();
}

// ==================================================
// SHORTEN ADDRESS
// ==================================================

function shortenAddress(address) {
  if (!address) return "";

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

// ==================================================
// VALIDATE ETHEREUM ADDRESS
// ==================================================

function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ==================================================
// APP
// ==================================================

function App() {

  // =================================================
  // BLOCKCHAIN
  // =================================================

  const [blockchain, setBlockchain] = useState(null);
  const [connectionError, setConnectionError] =
    useState("");

  // =================================================
  // REGISTER
  // =================================================

  const [showRegister, setShowRegister] =
    useState(false);

  const [registerCaseId, setRegisterCaseId] =
    useState("");

  const [registerEvidenceId, setRegisterEvidenceId] =
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

  // =================================================
  // VERIFY
  // =================================================

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

  // =================================================
  // DETAILS
  // =================================================

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

  // =================================================
  // CUSTODY
  // =================================================

  const [showCustody, setShowCustody] =
    useState(false);

  const [custodyEvidenceId, setCustodyEvidenceId] =
    useState("");

  const [newCustodian, setNewCustodian] =
    useState("");

  const [custodyLoading, setCustodyLoading] =
    useState(false);

  const [custodyResult, setCustodyResult] =
    useState(null);

  const [custodyError, setCustodyError] =
    useState("");

  // =================================================
  // CONNECT BLOCKCHAIN
  // =================================================

  const handleConnect = async () => {
    try {
      setConnectionError("");

      const connection =
        await connectBlockchain();

      setBlockchain(connection);

    } catch (error) {
      console.error(
        "Blockchain connection error:",
        error
      );

      setConnectionError(
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Unable to connect to blockchain."
      );
    }
  };

  // =================================================
  // REGISTER FILE
  // =================================================

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

      setRegisterError(
        "Unable to calculate file hash."
      );
    }
  };

  // =================================================
  // REGISTER EVIDENCE
  // =================================================

  const handleRegister = async () => {

    setRegisterError("");
    setRegisterResult(null);

    if (!blockchain) {
      setRegisterError(
        "Please connect to the blockchain first."
      );
      return;
    }

    if (!registerCaseId.trim()) {
      setRegisterError(
        "Please enter a Case ID."
      );
      return;
    }

    if (!registerEvidenceId.trim()) {
      setRegisterError(
        "Please enter an Evidence ID."
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

      const tx =
        await registerEvidence(
          blockchain.contract,
          registerEvidenceId.trim(),
          registerCaseId.trim(),
          hash
        );

      setRegisterResult({
        success: true,
        txHash: tx.hash,
      });

    } catch (error) {

      console.error(
        "Registration error:",
        error
      );

      setRegisterError(
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Evidence registration failed."
      );

    } finally {

      setRegisterLoading(false);

    }
  };

  // =================================================
  // VERIFY FILE SELECTION
  // =================================================

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

      setVerifyError(
        "Unable to calculate file hash."
      );
    }
  };

  // =================================================
  // VERIFY EVIDENCE
  // =================================================

  const handleVerify = async () => {

    setVerifyError("");
    setVerificationResult(null);
    setBlockchainHash("");

    // ---------------------------------------------
    // CHECK BLOCKCHAIN CONNECTION
    // ---------------------------------------------

    if (!blockchain) {
      setVerifyError(
        "Please connect to the blockchain first."
      );
      return;
    }

    // ---------------------------------------------
    // CHECK EVIDENCE ID
    // ---------------------------------------------

    if (!verifyEvidenceId.trim()) {
      setVerifyError(
        "Please enter an Evidence ID."
      );
      return;
    }

    // ---------------------------------------------
    // CHECK FILE
    // ---------------------------------------------

    if (!verifyFile) {
      setVerifyError(
        "Please select an evidence file."
      );
      return;
    }

    try {

      setVerifyLoading(true);

      // -------------------------------------------
      // STEP 1:
      // Calculate SHA-256 of uploaded file
      // -------------------------------------------

      const currentHash =
        await calculateSHA256(
          verifyFile
        );

      setVerifyHash(currentHash);

      console.log(
        "Current uploaded file hash:",
        currentHash
      );

      // -------------------------------------------
      // STEP 2:
      // Retrieve evidence from blockchain
      // -------------------------------------------

      const evidence =
        await getEvidence(
          blockchain.contract,
          verifyEvidenceId.trim()
        );

      const storedHash =
        evidence.evidenceHash.toUpperCase();

      setBlockchainHash(storedHash);

      console.log(
        "Blockchain stored hash:",
        storedHash
      );

      // -------------------------------------------
      // STEP 3:
      // Ask the SMART CONTRACT to verify
      // -------------------------------------------

      const isAuthentic =
        await verifyEvidence(
          blockchain.contract,
          verifyEvidenceId.trim(),
          currentHash
        );

      console.log(
        "Smart contract verification:",
        isAuthentic
      );

      // -------------------------------------------
      // STEP 4:
      // Display blockchain result
      // -------------------------------------------

      setVerificationResult(
        Boolean(isAuthentic)
      );

    } catch (error) {

      console.error(
        "Verification error:",
        error
      );

      setVerifyError(
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Verification failed. Check the Evidence ID."
      );

    } finally {

      setVerifyLoading(false);

    }
  };

  // =================================================
  // GET EVIDENCE DETAILS
  // =================================================

  const handleGetDetails = async () => {

    setDetailsError("");
    setEvidenceDetails(null);

    if (!blockchain) {
      setDetailsError(
        "Please connect to the blockchain first."
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

      const result =
        await getEvidence(
          blockchain.contract,
          detailsEvidenceId.trim()
        );

      setEvidenceDetails(result);

    } catch (error) {

      console.error(
        "Details error:",
        error
      );

      setDetailsError(
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Evidence not found."
      );

    } finally {

      setDetailsLoading(false);

    }
  };

  // =================================================
  // TRANSFER CUSTODY
  // =================================================

  const handleTransferCustody = async () => {

    setCustodyError("");
    setCustodyResult(null);

    if (!blockchain) {
      setCustodyError(
        "Please connect to the blockchain first."
      );
      return;
    }

    if (!custodyEvidenceId.trim()) {
      setCustodyError(
        "Please enter an Evidence ID."
      );
      return;
    }

    if (!newCustodian.trim()) {
      setCustodyError(
        "Please enter the new custodian address."
      );
      return;
    }

    if (
      !isValidEthereumAddress(
        newCustodian.trim()
      )
    ) {
      setCustodyError(
        "Please enter a valid Ethereum address."
      );
      return;
    }

    try {

      setCustodyLoading(true);

      const tx =
        await transferCustody(
          blockchain.contract,
          custodyEvidenceId.trim(),
          newCustodian.trim()
        );

      setCustodyResult({
        success: true,
        txHash: tx.hash,
      });

    } catch (error) {

      console.error(
        "Custody transfer error:",
        error
      );

      setCustodyError(
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Custody transfer failed."
      );

    } finally {

      setCustodyLoading(false);

    }
  };

  // =================================================
  // CLOSE PANELS
  // =================================================

  const closePanels = () => {

    setShowRegister(false);
    setShowVerify(false);
    setShowDetails(false);
    setShowCustody(false);

  };

  // =================================================
  // UI
  // =================================================

  return (
    <div className="app">

      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}

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
          {blockchain
            ? "Blockchain Connected"
            : "Connect Blockchain"}
        </button>

      </header>

      {/* ============================================ */}
      {/* MAIN */}
      {/* ============================================ */}

      <main className="main">

        {/* ========================================== */}
        {/* HERO */}
        {/* ========================================== */}

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

        {/* ========================================== */}
        {/* BLOCKCHAIN STATUS */}
        {/* ========================================== */}

        {blockchain && (

          <div className="connection-status">

            <h3>
              ● Blockchain Connected
            </h3>

            <p>
              Account: {blockchain.address}
            </p>

            <p>
              Chain ID: {blockchain.chainId}
            </p>

          </div>

        )}

        {/* ========================================== */}
        {/* CONNECTION ERROR */}
        {/* ========================================== */}

        {connectionError && (

          <div className="error-box">

            ✗ {connectionError}

          </div>

        )}

        {/* ========================================== */}
        {/* REGISTER PANEL */}
        {/* ========================================== */}

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
              Add evidence to the blockchain by
              storing its cryptographic hash.
            </p>

            {/* CASE ID */}

            <div className="form-group">

              <label>
                Case ID
              </label>

              <input
                type="text"
                placeholder="e.g. case002"
                value={registerCaseId}
                onChange={(e) =>
                  setRegisterCaseId(
                    e.target.value
                  )
                }
              />

            </div>

            {/* EVIDENCE ID */}

            <div className="form-group">

              <label>
                Evidence ID
              </label>

              <input
                type="text"
                placeholder="e.g. evidence002"
                value={registerEvidenceId}
                onChange={(e) =>
                  setRegisterEvidenceId(
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

            {/* ERROR */}

            {registerError && (

              <div className="error-box">

                ✗ {registerError}

              </div>

            )}

            {/* SUCCESS */}

            {registerResult && (

              <div className="success-box">

                <h3>
                  ✓ Evidence Registered
                </h3>

                <p>
                  Evidence registered
                  successfully on the
                  blockchain!
                </p>

                <p>
                  Transaction:
                </p>

                <span>
                  {registerResult.txHash}
                </span>

              </div>

            )}

            {/* REGISTER BUTTON */}

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

        {/* ========================================== */}
        {/* VERIFY PANEL */}
        {/* ========================================== */}

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
                placeholder="e.g. evidence002"
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

            {/* VERIFY BUTTON */}

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

        {/* ========================================== */}
        {/* DETAILS PANEL */}
        {/* ========================================== */}

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
              Retrieve evidence information
              directly from the blockchain.
            </p>

            {/* EVIDENCE ID */}

            <div className="form-group">

              <label>
                Evidence ID
              </label>

              <input
                type="text"
                placeholder="e.g. evidence002"
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
                    {evidenceDetails.evidenceId}
                  </span>

                </div>

                <div>

                  <strong>
                    Case ID
                  </strong>

                  <span>
                    {evidenceDetails.caseId}
                  </span>

                </div>

                <div>

                  <strong>
                    Blockchain Hash
                  </strong>

                  <span>
                    {evidenceDetails.evidenceHash}
                  </span>

                </div>

                <div>

                  <strong>
                    Registered By
                  </strong>

                  <span>
                    {evidenceDetails.registeredBy}
                  </span>

                </div>

                <div>

                  <strong>
                    Timestamp
                  </strong>

                  <span>
                    {evidenceDetails.timestamp}
                  </span>

                </div>

                <div>

                  <strong>
                    Current Custodian
                  </strong>

                  <span>
                    {evidenceDetails.currentCustodian}
                  </span>

                </div>

              </div>

            )}

          </section>

        )}

        {/* ========================================== */}
        {/* CUSTODY PANEL */}
        {/* ========================================== */}

        {showCustody && (

          <section className="panel">

            <button
              className="close-button"
              onClick={closePanels}
            >
              ×
            </button>

            <h2>
              Transfer Evidence Custody
            </h2>

            <p>
              Transfer custody of an evidence
              record to another blockchain
              address.
            </p>

            {/* EVIDENCE ID */}

            <div className="form-group">

              <label>
                Evidence ID
              </label>

              <input
                type="text"
                placeholder="e.g. evidence002"
                value={custodyEvidenceId}
                onChange={(e) =>
                  setCustodyEvidenceId(
                    e.target.value
                  )
                }
              />

            </div>

            {/* NEW CUSTODIAN */}

            <div className="form-group">

              <label>
                New Custodian Address
              </label>

              <input
                type="text"
                placeholder="0x..."
                value={newCustodian}
                onChange={(e) =>
                  setNewCustodian(
                    e.target.value
                  )
                }
              />

            </div>

            {/* ERROR */}

            {custodyError && (

              <div className="error-box">

                ✗ {custodyError}

              </div>

            )}

            {/* SUCCESS */}

            {custodyResult && (

              <div className="success-box">

                <h3>
                  ✓ Custody Transferred
                </h3>

                <p>
                  Evidence custody was
                  transferred successfully.
                </p>

                <p>
                  Transaction:
                </p>

                <span>
                  {custodyResult.txHash}
                </span>

              </div>

            )}

            {/* BUTTON */}

            <button
              className="primary-button"
              onClick={handleTransferCustody}
              disabled={custodyLoading}
            >
              {custodyLoading
                ? "Transferring..."
                : "Transfer Custody"}
            </button>

          </section>

        )}

        {/* ========================================== */}
        {/* FEATURE CARDS */}
        {/* ========================================== */}

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
              registration details, and
              current custodian information.
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

          {/* CUSTODY */}

          <div className="card">

            <div className="card-icon">
              🔄
            </div>

            <h2>
              Transfer Custody
            </h2>

            <p>
              Transfer evidence custody and
              maintain a transparent chain
              of custody.
            </p>

            <button
              className="primary-button"
              onClick={() => {

                closePanels();

                setShowCustody(true);

              }}
            >
              Transfer Custody
            </button>

          </div>

        </section>

      </main>

    </div>
  );
}

export default App;