// ============================================================
// EvidenceChain Register Evidence View — Premium Document Intake
// Guided 3-Stage Forensic Workflow with Live Multi-Format File Preview
// (PDF via Mozilla PDF.js, DOCX via Mammoth, Images, Text, Media, & Forensic Fallback)
// ============================================================

import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";
import DOMPurify from "dompurify";
import {
  ShieldIcon,
  ShieldCheckIcon,
  FileTextIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XIcon,
  CopyIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  SearchIcon,
  PlusIcon,
} from "../components/Icons";
import { getDepartmentCasesAPI } from "../api";

// Configure Mozilla PDF.js worker via Vite asset URL
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export function RegisterEvidenceView({
  onRegister,
  loading,
  error,
  result,
  onReset,
  backendConnected,
  currentUser,
  evidenceList = [],
  onBack,
}) {
  const [caseId, setCaseId] = useState("");
  const [description, setDescription] = useState("");
  const [caseIdTouched, setCaseIdTouched] = useState(false);
  const [availableCases, setAvailableCases] = useState([]);
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [isNewCaseMode, setIsNewCaseMode] = useState(false);
  const [selectedCaseTitle, setSelectedCaseTitle] = useState("");
  const [file, setFile] = useState(null);
  const [calculatedHash, setCalculatedHash] = useState("");
  const [isHashing, setIsHashing] = useState(false);
  const [hashError, setHashError] = useState(null);
  const [fileValidationError, setFileValidationError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showTechnicalHash, setShowTechnicalHash] = useState(false);

  // Load registered cases for searchable docket selector
  useEffect(() => {
    let isCancelled = false;
    async function loadCases() {
      try {
        const res = await getDepartmentCasesAPI();
        if (!isCancelled && res?.cases && Array.isArray(res.cases) && res.cases.length > 0) {
          setAvailableCases(res.cases);
          return;
        }
      } catch (err) {
        // Fall back to evidenceList prop
      }

      if (!isCancelled && evidenceList && evidenceList.length > 0) {
        const caseMap = new Map();
        evidenceList.forEach((ev) => {
          if (ev.caseId && !caseMap.has(ev.caseId)) {
            caseMap.set(ev.caseId, {
              caseId: ev.caseId,
              title: ev.caseTitle || `Case Docket ${ev.caseId}`,
              status: "ACTIVE_INVESTIGATION",
              evidenceCount: 1,
            });
          } else if (ev.caseId) {
            const existing = caseMap.get(ev.caseId);
            existing.evidenceCount += 1;
          }
        });
        setAvailableCases(Array.from(caseMap.values()));
      }
    }
    loadCases();
    return () => {
      isCancelled = true;
    };
  }, [evidenceList]);

  // Reset errors and result on view unmount
  useEffect(() => {
    return () => {
      if (onReset) onReset();
    };
  }, [onReset]);

  // File Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [imageZoom, setImageZoom] = useState(1);

  // DOCX Rendering State
  const [docxHtml, setDocxHtml] = useState("");
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState(null);
  const [docxWarnings, setDocxWarnings] = useState([]);

  // PDF.js Rendering State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const fileInputRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const currentRenderTaskRef = useRef(null);

  // Safe HTML Sanitizer using DOMPurify
  const sanitizeDocxHtml = (dirtyHtml) => {
    if (!dirtyHtml) return "";
    try {
      const purify = typeof DOMPurify === "function" ? DOMPurify : (DOMPurify?.default || DOMPurify);
      if (purify && typeof purify.sanitize === "function") {
        return purify.sanitize(dirtyHtml, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: [
            "script", "iframe", "object", "embed", "link", "style",
            "form", "input", "button", "textarea", "select", "meta", "base"
          ],
          FORBID_ATTR: [
            "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
            "onkeydown", "onkeyup", "onchange", "onsubmit", "formaction"
          ],
          ADD_DATA_URI_TAGS: ["img"],
        });
      }
    } catch (e) {
      console.warn("DOMPurify warning:", e);
    }
    return dirtyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  };

  // Determine file category for preview and badge purposes
  const getFileCategory = (targetFile) => {
    if (!targetFile) return "none";
    const name = targetFile.name.toLowerCase();
    const type = targetFile.type ? targetFile.type.toLowerCase() : "";

    // Specialized forensic archives, container formats, and raw disk images are always unsupported for in-browser preview
    if (/\.(raw|dd|e01|bin|img|iso|vmdk|aff|aff4|dmg|tar|gz|zip|7z|exe|dll|elf)$/i.test(name)) {
      return "unsupported";
    }

    if (name.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return "docx";
    }
    if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (type.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg|bmp|ico)$/i.test(name)) return "image";
    if (type.startsWith("text/") || /\.(txt|log|csv|json|md|xml|yaml|yml|tsv|ini|conf|sql)$/i.test(name)) return "text";
    if (type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return "audio";
    if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(name)) return "video";
    return "unsupported";
  };

  // Human-readable file type label
  const getFileTypeLabel = (targetFile) => {
    if (!targetFile) return "";
    const name = targetFile.name.toLowerCase();
    const type = targetFile.type;

    if (name.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word Document (.docx)";
    if (name.endsWith(".doc")) return "Legacy Word Document (.doc)";
    if (name.endsWith(".pdf") || type === "application/pdf") return "PDF Document";
    if (name.endsWith(".png")) return "PNG Image";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPEG Image";
    if (name.endsWith(".webp")) return "WebP Image";
    if (name.endsWith(".gif")) return "GIF Animation";
    if (name.endsWith(".svg")) return "SVG Vector";
    if (name.endsWith(".txt")) return "Plain Text File";
    if (name.endsWith(".log")) return "System Log File";
    if (name.endsWith(".csv")) return "CSV Data Sheet";
    if (name.endsWith(".json")) return "JSON Data";
    if (name.endsWith(".mp4")) return "MP4 Video Recording";
    if (name.endsWith(".mov")) return "QuickTime Video";
    if (name.endsWith(".mp3")) return "MP3 Audio Recording";
    if (name.endsWith(".wav")) return "WAV Audio Recording";
    if (name.endsWith(".raw") || name.endsWith(".dd")) return "Forensic Disk Image (.raw/.dd)";
    if (name.endsWith(".e01")) return "Expert Witness Forensic Image (.e01)";
    if (name.endsWith(".bin")) return "Binary Memory Dump (.bin)";
    if (type) return type;
    return "Digital Evidence File";
  };

  // Safe resource lifecycle: Object URL creation and cleanup
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      setPreviewText("");
      setDocxHtml("");
      setDocxLoading(false);
      setDocxError(null);
      setDocxWarnings([]);
      setPdfDoc(null);
      setPdfNumPages(0);
      setPdfCurrentPage(1);
      setPdfLoading(false);
      setPdfError(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageZoom(1);

    const category = getFileCategory(file);

    // Text File Reader
    if (category === "text") {
      const slice = file.slice(0, 256 * 1024);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewText(e.target?.result || "");
      };
      reader.onerror = () => {
        setPreviewText("Unable to read plain text preview.");
      };
      reader.readAsText(slice);
    } else {
      setPreviewText("");
    }

    // DOCX Word Document Converter (Client-Side via Mammoth)
    if (category === "docx") {
      let isCancelled = false;
      setDocxLoading(true);
      setDocxError(null);
      setDocxHtml("");
      setDocxWarnings([]);

      file.arrayBuffer()
        .then(async (arrayBuffer) => {
          if (isCancelled) return;
          try {
            const convertFn = mammoth.convertToHtml || mammoth.default?.convertToHtml;
            if (!convertFn) {
              throw new Error("Mammoth DOCX conversion engine is unavailable.");
            }
            const convResult = await convertFn({ arrayBuffer });
            if (isCancelled) return;

            const cleanHtml = sanitizeDocxHtml(convResult.value);
            setDocxHtml(cleanHtml || "<p><em>[Empty Document]</em></p>");
            if (convResult.messages && convResult.messages.length > 0) {
              setDocxWarnings(convResult.messages.map((m) => m.message));
            }
            setDocxLoading(false);
          } catch (err) {
            if (isCancelled) return;
            console.error("DOCX conversion failed:", err);
            setDocxError(err.message || "Failed to parse Word document structure.");
            setDocxLoading(false);
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error("File arrayBuffer read failed:", err);
          setDocxError("Unable to read file bytes from local selection.");
          setDocxLoading(false);
        });

      return () => {
        isCancelled = true;
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setDocxHtml("");
      setDocxError(null);
      setDocxLoading(false);
      setDocxWarnings([]);
    }

    // PDF Document Loader (Client-Side via Mozilla PDF.js)
    if (category === "pdf") {
      let isCancelled = false;
      setPdfLoading(true);
      setPdfError(null);
      setPdfDoc(null);
      setPdfNumPages(0);
      setPdfCurrentPage(1);

      file.arrayBuffer()
        .then(async (arrayBuffer) => {
          if (isCancelled) return;
          try {
            const loadingTask = pdfjsLib.getDocument({
              data: new Uint8Array(arrayBuffer),
              isEvalSupported: false,
            });
            const loadedDoc = await loadingTask.promise;
            if (isCancelled) {
              loadedDoc.destroy();
              return;
            }
            setPdfDoc(loadedDoc);
            setPdfNumPages(loadedDoc.numPages);
            setPdfCurrentPage(1);
            setPdfLoading(false);
          } catch (err) {
            if (isCancelled) return;
            console.error("PDF.js document load error:", err);
            setPdfError(err.message || "Failed to parse PDF document.");
            setPdfLoading(false);
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error("PDF arrayBuffer read error:", err);
          setPdfError("Unable to read PDF file bytes.");
          setPdfLoading(false);
        });

      return () => {
        isCancelled = true;
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setPdfDoc(null);
      setPdfNumPages(0);
      setPdfCurrentPage(1);
      setPdfLoading(false);
      setPdfError(null);
    }

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // PDF Canvas Rendering Hook (Renders current page with High-DPI support)
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current || !isPreviewOpen) return;

    let isCancelled = false;
    setPdfRendering(true);

    if (currentRenderTaskRef.current) {
      try {
        currentRenderTaskRef.current.cancel();
      } catch (e) {}
      currentRenderTaskRef.current = null;
    }

    pdfDoc.getPage(pdfCurrentPage)
      .then((page) => {
        if (isCancelled || !pdfCanvasRef.current) return;
        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext("2d");

        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: pdfScale * pixelRatio });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        currentRenderTaskRef.current = renderTask;

        renderTask.promise
          .then(() => {
            if (!isCancelled) {
              setPdfRendering(false);
              currentRenderTaskRef.current = null;
            }
          })
          .catch((err) => {
            if (err?.name !== "RenderingCancelledException") {
              console.error("PDF page render error:", err);
            }
            if (!isCancelled) {
              setPdfRendering(false);
            }
          });
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Get PDF page error:", err);
          setPdfRendering(false);
        }
      });

    return () => {
      isCancelled = true;
      if (currentRenderTaskRef.current) {
        try {
          currentRenderTaskRef.current.cancel();
        } catch (e) {}
        currentRenderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pdfCurrentPage, pdfScale, isPreviewOpen]);

  // Keyboard accessibility: Close preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isPreviewOpen) {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen]);

  // Client-side SHA-256 calculation via Web Crypto API
  const processFile = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      setCalculatedHash("");
      setFileValidationError(null);
      return;
    }

    if (selectedFile.size === 0) {
      setFileValidationError("The selected file is empty (0 bytes). Please select a valid evidence file.");
      setFile(null);
      setCalculatedHash("");
      return;
    }

    setFileValidationError(null);
    setFile(selectedFile);
    setIsHashing(true);
    setHashError(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setCalculatedHash(hashHex);
      setIsHashing(false);
    } catch (err) {
      console.error("Hashing failed:", err);
      setCalculatedHash("");
      setHashError("Unable to compute file checksum in browser.");
      setIsHashing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setCalculatedHash("");
    setFileValidationError(null);
    setHashError(null);
    setIsPreviewOpen(false);
    setDocxHtml("");
    setDocxError(null);
    setDocxLoading(false);
    setDocxWarnings([]);
    if (pdfDoc) {
      try {
        pdfDoc.destroy();
      } catch (e) {}
    }
    setPdfDoc(null);
    setPdfNumPages(0);
    setPdfCurrentPage(1);
    setPdfLoading(false);
    setPdfError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setCaseIdTouched(true);
    if (!caseId.trim()) return;
    if (!file) return;
    if (isHashing || fileValidationError) return;
    onRegister(file, caseId.trim(), description.trim(), calculatedHash);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1400);
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "—";
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredCases = availableCases.filter((c) => {
    if (!caseSearchQuery.trim()) return true;
    const q = caseSearchQuery.toLowerCase();
    return (
      (c.caseId && c.caseId.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  // Determine intake workflow stage completion
  const stage1Complete = Boolean(file && calculatedHash && !fileValidationError && !isHashing);
  const stage2Complete = Boolean(caseId.trim());
  const stage3Ready = stage1Complete && stage2Complete && !loading;

  // Accurate File Check status messaging
  const getFileCheckStatus = () => {
    if (fileValidationError) {
      return { label: "Unable to check file", state: "error", desc: fileValidationError };
    }
    if (!file) {
      return { label: "Waiting for file", state: "neutral", desc: "Select an evidence file to begin." };
    }
    if (isHashing) {
      return { label: "Computing fingerprint...", state: "checking", desc: "Computing local cryptographic SHA-256 fingerprint..." };
    }
    if (hashError) {
      return { label: "Fingerprint failed", state: "error", desc: hashError };
    }
    if (stage1Complete && stage2Complete) {
      return { label: "Ready to register", state: "ready", desc: "Local fingerprint computed and Case ID docket assigned. Ready for on-chain anchoring." };
    }
    if (stage1Complete) {
      return { label: "Fingerprint calculated", state: "complete", desc: "Local SHA-256 fingerprint generated. Enter Case ID to proceed." };
    }
    return { label: "Waiting for file", state: "neutral", desc: "" };
  };

  const fileCheckStatus = getFileCheckStatus();
  const fileCategory = getFileCategory(file);

  return (
    <div className="view-container register-evidence-view" data-testid="register-evidence-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* 1. Page Header Block */}
      <div className="page-header-block" style={{ marginBottom: "20px" }}>
        <div>
          {onBack && (
            <button
              type="button"
              className="btn-subtle-mono"
              onClick={onBack}
              style={{ marginBottom: "10px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              ← Back to Evidence Repository
            </button>
          )}
          <h1 className="page-title">Digital Evidence Intake &amp; Registration</h1>
          <p className="page-context-desc">
            Catalog a new digital evidence artifact, compute local cryptographic checksums, assign custody parameters, and record into the system chain of custody.
          </p>
        </div>
      </div>

      {!backendConnected && (
        <div className="banner-alert alert-error" style={{ marginBottom: "20px" }}>
          <div>
            <strong>Backend Disconnected:</strong> Cannot upload evidence file or write to verification registry until backend service is restored.
          </div>
        </div>
      )}

      {/* 2. Registration Confirmation Dossier */}
      {result ? (
        <div className="doc-panel" style={{ borderLeft: "4px solid var(--green-institutional)" }}>
          <div className="doc-panel-header">
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green-deep)", fontWeight: 600 }}>
                EVIDENCE REGISTRATION CONFIRMED • CUSTODY RECORD RECORDED
              </div>
              <h2 className="doc-panel-title">Digital Evidence Dossier Registered Successfully</h2>
              <p className="doc-panel-subtitle">
                The evidence record has been catalogued in the central evidence repository and registered on the verification ledger.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {onBack && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onBack}
                >
                  VIEW IN REPOSITORY
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={onReset}
              >
                REGISTER ANOTHER RECORD
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "16px", marginBottom: "20px" }}>
            <div style={{ padding: "14px", backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-xs)" }}>
              <div className="doc-section-title">EVIDENCE IDENTIFIER</div>
              <div className="mono-identifier" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                {result.evidenceId}
              </div>
            </div>

            <div style={{ padding: "14px", backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-xs)" }}>
              <div className="doc-section-title">CASE DOCKET NUMBER</div>
              <div className="case-docket-tag" style={{ fontSize: "14px", fontWeight: 600 }}>
                {result.caseId}
              </div>
            </div>
          </div>

          <div style={{ padding: "14px", backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-xs)", marginBottom: "16px" }}>
            <div className="doc-section-title">SHA-256 INTAKE CHECKSUM (IMMUTABLE DIGEST)</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <code className="confirmed-hash-code" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", wordBreak: "break-all", color: "var(--text-primary)" }}>
                {result.sha256Hash}
              </code>
              <button
                type="button"
                className="btn-subtle-mono"
                onClick={() => copyToClipboard(result.sha256Hash)}
              >
                {copiedHash ? "COPIED" : "COPY HASH"}
              </button>
            </div>
          </div>

          <div style={{ padding: "14px", backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-xs)" }}>
            <div className="doc-section-title">REGISTRY &amp; LEDGER CONFIRMATION DETAILS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "12px", overflowWrap: "anywhere", wordBreak: "break-word" }}>
              <div><span style={{ color: "var(--text-secondary)" }}>Registry Tx Reference: </span>{result.transactionHash}</div>
              <div><span style={{ color: "var(--text-secondary)" }}>Ledger Block Height: </span>#{result.blockNumber}</div>
              <div><span style={{ color: "var(--text-secondary)" }}>Registering Custodian: </span>{result.registeredBy}</div>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Guided 3-Stage Intake Experience */
        <div>
          {/* Refined Progress Indicator */}
          <div className="intake-stepper-container" style={{ marginBottom: "24px" }}>
            <div className="intake-stepper">
              {/* Step 1 */}
              <div className={`intake-step ${stage1Complete ? "step-complete" : "step-active"}`}>
                <div className="intake-step-badge">
                  {stage1Complete ? "✓" : "01"}
                </div>
                <div className="intake-step-meta">
                  <div className="intake-step-title">Upload Evidence</div>
                  <div className="intake-step-sub">Select evidence file</div>
                </div>
              </div>

              <div className={`intake-step-divider ${stage1Complete ? "divider-active" : ""}`} />

              {/* Step 2 */}
              <div className={`intake-step ${stage2Complete ? "step-complete" : stage1Complete ? "step-active" : "step-pending"}`}>
                <div className="intake-step-badge">
                  {stage2Complete ? "✓" : "02"}
                </div>
                <div className="intake-step-meta">
                  <div className="intake-step-title">Case Details</div>
                  <div className="intake-step-sub">Docket & description</div>
                </div>
              </div>

              <div className={`intake-step-divider ${stage2Complete ? "divider-active" : ""}`} />

              {/* Step 3 */}
              <div className={`intake-step ${stage3Ready ? "step-ready" : "step-pending"}`}>
                <div className="intake-step-badge">
                  03
                </div>
                <div className="intake-step-meta">
                  <div className="intake-step-title">Review & Register</div>
                  <div className="intake-step-sub">File check & record</div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="banner-alert alert-error" style={{ marginBottom: "20px" }}>
                <span>{error}</span>
              </div>
            )}

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFile(e.target.files[0]);
                }
              }}
            />

            {/* STAGE 1: Upload Evidence */}
            <div className="doc-panel intake-panel-card">
              <div className="intake-stage-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div className="stage-num-pill">Stage 01</div>
                  <div>
                    <h2 className="doc-panel-title" style={{ fontSize: "16px", marginBottom: "2px" }}>
                      Upload Evidence
                    </h2>
                    <p className="doc-panel-subtitle" style={{ fontSize: "13px" }}>
                      Choose the digital evidence file you want to register.
                    </p>
                  </div>
                </div>
                {file && (
                  <span className="badge-clean badge-verified" style={{ fontSize: "10px" }}>
                    ✓ Ingested
                  </span>
                )}
              </div>

              {!file ? (
                /* Empty Dropzone State */
                <div>
                  <div
                    className={`form-dropzone premium-dropzone ${isDragging ? "dropzone-active" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px", color: "var(--text-secondary)" }}>
                      <FileTextIcon size={32} />
                    </div>
                    <div className="dropzone-label-bold" style={{ fontSize: "15px", marginBottom: "6px" }}>
                      Click to choose an evidence file or drag and drop here
                    </div>
                    <div className="dropzone-sub" style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                      Accepted formats include Word Documents (.docx), PDFs, Media (Images, Video, Audio), Plain Text, and Forensic Containers (.raw, .e01, .dd, .bin)
                    </div>
                  </div>

                  {fileValidationError && (
                    <div className="field-error-notice" style={{ marginTop: "10px" }}>
                      <AlertTriangleIcon size={16} />
                      <span>{fileValidationError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected File Card with Working File Preview Action */
                <div className="selected-evidence-card">
                  <div className="selected-file-main">
                    <div className="file-avatar-box">
                      <FileTextIcon size={28} />
                    </div>
                    <div className="file-info-col">
                      <div className="selected-file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="selected-file-specs">
                        <span className="spec-item">{formatFileSize(file.size)}</span>
                        <span className="spec-dot">•</span>
                        <span className="spec-tag">{getFileTypeLabel(file)}</span>
                        {isHashing ? (
                          <>
                            <span className="spec-dot">•</span>
                            <span className="spec-status checking">
                              <RefreshCwIcon size={12} className="spin-inline" /> Computing fingerprint...
                            </span>
                          </>
                        ) : calculatedHash ? (
                          <>
                            <span className="spec-dot">•</span>
                            <span className="spec-status verified">
                              ✓ Fingerprint calculated
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="file-card-actions">
                    {/* Required Feature: Functional Preview File Button */}
                    <button
                      type="button"
                      className="btn-secondary btn-preview-action"
                      onClick={() => setIsPreviewOpen(true)}
                      title="Inspect selected evidence file before registering"
                    >
                      <EyeIcon size={16} />
                      <span>Preview File</span>
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      title="Select a different evidence file"
                    >
                      Replace File
                    </button>

                    <button
                      type="button"
                      className="btn-subtle-mono btn-remove-file"
                      onClick={handleRemoveFile}
                      title="Clear selected file"
                    >
                      <XIcon size={14} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STAGE 2: Case Details */}
            <div className="doc-panel intake-panel-card">
              <div className="intake-stage-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div className="stage-num-pill">Stage 02</div>
                  <div>
                    <h2 className="doc-panel-title" style={{ fontSize: "16px", marginBottom: "2px" }}>
                      Case Details
                    </h2>
                    <p className="doc-panel-subtitle" style={{ fontSize: "13px" }}>
                      Associate this evidence with an official case docket.
                    </p>
                  </div>
                </div>
                {caseId && (
                  <span className="badge-clean badge-verified" style={{ fontSize: "10px" }}>
                    ✓ Case Linked
                  </span>
                )}
              </div>

              {/* Case Selection Mode */}
              {caseId && !isNewCaseMode ? (
                /* Selected Case Summary View */
                <div className="selected-summary-banner case-summary-banner" style={{ marginBottom: "16px" }}>
                  <div className="selected-summary-details">
                    <span className="summary-section-label">SELECTED CASE DOCKET</span>
                    <div className="summary-main-ref">{caseId}</div>
                    <div className="summary-subtext">
                      {selectedCaseTitle || "Active Judicial Case Docket"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-change-selection"
                    onClick={() => {
                      setCaseId("");
                      setSelectedCaseTitle("");
                    }}
                    title="Change active case docket"
                  >
                    Change Case
                  </button>
                </div>
              ) : !isNewCaseMode ? (
                /* Searchable Existing Cases Table */
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <div className="search-field-wrapper" style={{ flex: 1, marginBottom: 0 }}>
                      <SearchIcon size={16} className="search-field-icon" />
                      <input
                        type="text"
                        className="gov-search-input"
                        placeholder="Search existing case dockets (e.g. CASE-2026-001)..."
                        value={caseSearchQuery}
                        onChange={(e) => setCaseSearchQuery(e.target.value)}
                        id="register-case-search"
                      />
                      {caseSearchQuery && (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => setCaseSearchQuery("")}
                          title="Clear search"
                        >
                          <XIcon size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap", height: "36px", fontSize: "12px", fontFamily: "var(--font-mono)" }}
                      onClick={() => {
                        setIsNewCaseMode(true);
                        setCaseId("");
                        setSelectedCaseTitle("");
                      }}
                      title="Register into a new case docket reference"
                    >
                      <PlusIcon size={13} />
                      <span>NEW DOCKET</span>
                    </button>
                  </div>

                  {filteredCases.length === 0 ? (
                    <div className="empty-results-box" style={{ margin: "10px 0" }}>
                      <AlertTriangleIcon size={18} />
                      <span>No cases match &ldquo;{caseSearchQuery}&rdquo;. Click &ldquo;NEW DOCKET&rdquo; above to register with a new case ID.</span>
                    </div>
                  ) : (
                    <div className="compact-case-selector-table-wrap" style={{ maxHeight: "200px", overflowX: "auto", maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
                      <table className="compact-selector-table">
                        <thead>
                          <tr>
                            <th style={{ width: "26%" }}>Case ID</th>
                            <th>Case Title / Description</th>
                            <th style={{ width: "16%", textAlign: "center" }}>Evidence</th>
                            <th style={{ width: "16%", textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCases.map((c) => (
                            <tr
                              key={c.caseId}
                              className="compact-selector-row"
                              onClick={() => {
                                setCaseId(c.caseId);
                                setSelectedCaseTitle(c.title || "");
                                setCaseIdTouched(true);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  setCaseId(c.caseId);
                                  setSelectedCaseTitle(c.title || "");
                                  setCaseIdTouched(true);
                                }
                              }}
                            >
                              <td>
                                <span className="case-ref-tag">{c.caseId}</span>
                              </td>
                              <td>
                                <div className="compact-row-title">{c.title}</div>
                                {c.description && <div className="compact-row-subtitle">{c.description}</div>}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <span className="case-evidence-count-pill">{c.evidenceCount || 0}</span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className="btn-compact-select"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCaseId(c.caseId);
                                    setSelectedCaseTitle(c.title || "");
                                    setCaseIdTouched(true);
                                  }}
                                >
                                  Select &rarr;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {caseIdTouched && !caseId.trim() && (
                    <div className="field-error-text" style={{ marginTop: "6px" }}>
                      Please select an existing case docket or click &ldquo;NEW DOCKET&rdquo; to proceed.
                    </div>
                  )}
                </div>
              ) : (
                /* New Case Docket Manual Entry */
                <div className="form-group-block">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label className="form-label" htmlFor="case-id-input" style={{ marginBottom: 0 }}>
                      New Case Reference ID <span style={{ color: "var(--red-restrained)" }}>*</span>
                    </label>
                    <button
                      type="button"
                      className="btn-subtle-mono"
                      style={{ fontSize: "11px" }}
                      onClick={() => {
                        setIsNewCaseMode(false);
                        setCaseId("");
                        setSelectedCaseTitle("");
                      }}
                    >
                      ← Select Existing Docket
                    </button>
                  </div>
                  <input
                    id="case-id-input"
                    type="text"
                    className={`form-input-text ${caseIdTouched && !caseId.trim() ? "input-field-error" : ""}`}
                    placeholder="Enter judicial docket reference (e.g. CASE-2026-NEW)"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    onBlur={() => setCaseIdTouched(true)}
                    required
                  />
                  <div className="form-hint">Enter the new case identifier to be created.</div>
                  {caseIdTouched && !caseId.trim() && (
                    <div className="field-error-text">
                      Case reference number is required to register digital evidence.
                    </div>
                  )}
                </div>
              )}

              <div className="form-group-block" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="case-desc-input">
                  Description (Optional)
                </label>
                <textarea
                  id="case-desc-input"
                  className="form-input-textarea"
                  placeholder="Briefly describe the evidence or where it came from..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <div className="form-hint">Provide intake notes, source device information, or seizure context.</div>
              </div>
            </div>

            {/* STAGE 3: Review & Register */}
            <div className="doc-panel intake-panel-card">
              <div className="intake-stage-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div className="stage-num-pill">Stage 03</div>
                  <div>
                    <h2 className="doc-panel-title" style={{ fontSize: "16px", marginBottom: "2px" }}>
                      Review &amp; Register Dossier
                    </h2>
                    <p className="doc-panel-subtitle" style={{ fontSize: "13px" }}>
                      Verify the complete evidence dossier specifications before recording into the custody registry.
                    </p>
                  </div>
                </div>
                {file && caseId && (
                  <span className="badge-clean badge-verified" style={{ fontSize: "10px" }}>
                    Ready for Intake
                  </span>
                )}
              </div>

              {/* Review Summary Grid */}
              <div className="review-summary-box">
                <div className="review-grid">
                  <div className="review-item">
                    <span className="review-label">Selected File</span>
                    <span className="review-value" title={file?.name || "None"}>
                      {file ? file.name : <em style={{ color: "var(--text-muted)" }}>Waiting for file</em>}
                    </span>
                  </div>

                  <div className="review-item">
                    <span className="review-label">File Size</span>
                    <span className="review-value">
                      {file ? formatFileSize(file.size) : <em style={{ color: "var(--text-muted)" }}>—</em>}
                    </span>
                  </div>

                  <div className="review-item">
                    <span className="review-label">Case Docket</span>
                    <span className="review-value">
                      {caseId.trim() ? (
                        <span>
                          <strong className="case-docket-tag" style={{ display: "inline-block", marginRight: "6px" }}>{caseId.trim()}</strong>
                          {selectedCaseTitle && <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{selectedCaseTitle}</span>}
                        </span>
                      ) : (
                        <em style={{ color: "var(--text-muted)" }}>Not specified</em>
                      )}
                    </span>
                  </div>

                  <div className="review-item">
                    <span className="review-label">Registering Custodian</span>
                    <span className="review-value">
                      <strong style={{ color: "var(--text-primary)" }}>
                        {currentUser?.fullName || currentUser?.name || currentUser?.username || "Authorized Forensic Officer"}
                      </strong>
                      <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginLeft: "6px" }}>
                        ({currentUser?.badge || currentUser?.role || "Investigator"})
                      </span>
                    </span>
                  </div>

                  <div className="review-item review-item-full">
                    <span className="review-label">SHA-256 Intake Fingerprint</span>
                    <span className="review-value">
                      {calculatedHash ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "3px" }}>
                          <code style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", background: "var(--surface-primary)", padding: "4px 8px", border: "1px solid var(--border-color)", borderRadius: "3px", wordBreak: "break-all" }}>
                            {calculatedHash}
                          </code>
                          <button
                            type="button"
                            className="btn-tiny-copy"
                            onClick={() => copyToClipboard(calculatedHash)}
                          >
                            {copiedHash ? "COPIED" : "COPY HASH"}
                          </button>
                        </div>
                      ) : (
                        <em style={{ color: "var(--text-muted)" }}>Fingerprint pending file selection</em>
                      )}
                    </span>
                  </div>

                  {description.trim() && (
                    <div className="review-item review-item-full">
                      <span className="review-label">Intake Notes / Description</span>
                      <span className="review-value review-desc-text">
                        {description.trim()}
                      </span>
                    </div>
                  )}

                  <div className="review-item review-item-full">
                    <span className="review-label">Intake Readiness Status</span>
                    <span className="review-value">
                      <span className={`status-pill status-${fileCheckStatus.state}`}>
                        {fileCheckStatus.label}
                      </span>
                    </span>
                  </div>
                </div>

                {/* File Check Subtext & Background Verification */}
                <div className="file-check-strip">
                  <div className="file-check-msg">
                    <ShieldCheckIcon size={18} className="shield-icon-subtle" />
                    <span>
                      {fileCheckStatus.desc || "Browser and server dual-verify the SHA-256 checksum prior to custody registration."}
                    </span>
                  </div>

                  {calculatedHash && (
                    <button
                      type="button"
                      className="btn-subtle-mono"
                      onClick={() => setShowTechnicalHash(!showTechnicalHash)}
                      style={{ fontSize: "11px" }}
                    >
                      {showTechnicalHash ? "Hide Cryptographic Details" : "View Cryptographic Details"}
                    </button>
                  )}
                </div>

                {/* Subtle Cryptographic Details Accordion */}
                {showTechnicalHash && calculatedHash && (
                  <div className="technical-hash-drawer">
                    <div className="tech-hash-label">LOCAL SHA-256 INTAKE FINGERPRINT:</div>
                    <div className="tech-hash-row">
                      <code className="tech-hash-code">{calculatedHash}</code>
                      <button
                        type="button"
                        className="btn-tiny-copy"
                        onClick={() => copyToClipboard(calculatedHash)}
                      >
                        {copiedHash ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Submitter & Primary Action */}
              <div className="submit-section-row">
                <div className="submit-authority-info">
                  <div className="authority-label">Authorized Submitter</div>
                  <div className="authority-name">
                    {currentUser?.name || "Forensic Officer"} {currentUser?.walletAddress ? `(${currentUser.walletAddress.slice(0, 8)}...${currentUser.walletAddress.slice(-4)})` : ""}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-submit-registration"
                  disabled={loading || !stage3Ready}
                  title={!stage3Ready ? "Upload a file and enter a Case ID to register" : "Register evidence record"}
                >
                  {loading ? (
                    <>
                      <RefreshCwIcon size={16} className="spin-inline" />
                      <span>Registering Evidence Dossier...</span>
                    </>
                  ) : (
                    <>
                      <ShieldIcon size={16} />
                      <span>Register Evidence Dossier</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. MODAL: Functional Evidence File Preview Dialog             */}
      {/* Safe in-browser rendering with zero side effects on form data */}
      {/* ============================================================ */}
      {isPreviewOpen && file && (
        <div
          className="modal-overlay-flat preview-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsPreviewOpen(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          <div className="modal-dialog-flat preview-modal-window">
            {/* Modal Header */}
            <div className="modal-header-flat preview-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <EyeIcon size={20} className="preview-header-icon" />
                <div style={{ minWidth: 0 }}>
                  <h3 id="preview-modal-title" className="modal-title-flat preview-title-text" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="preview-header-meta">
                    <span>{getFileTypeLabel(file)}</span>
                    <span className="spec-dot">•</span>
                    <span>{formatFileSize(file.size)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Close preview"
                title="Close preview (Esc)"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body: Type-Specific Rendering */}
            <div className="preview-modal-body">
              {/* DOCX Word Document Preview */}
              {fileCategory === "docx" && (
                <div className="preview-content-box preview-docx-container">
                  {docxLoading ? (
                    <div className="docx-loading-state">
                      <RefreshCwIcon size={32} className="spin-inline" style={{ color: "var(--text-secondary)", marginBottom: "14px" }} />
                      <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                        Rendering Word Document...
                      </h4>
                      <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                        Extracting paragraphs, headings, tables, and document styles in browser sandbox...
                      </p>
                    </div>
                  ) : docxError ? (
                    <div className="docx-error-state">
                      <div className="fallback-shield-avatar" style={{ color: "var(--red-restrained)", borderColor: "var(--red-border)" }}>
                        <AlertTriangleIcon size={32} />
                      </div>
                      <h4 className="fallback-title" style={{ color: "var(--red-restrained)" }}>
                        Unable to Render Document
                      </h4>
                      <p className="fallback-description">
                        {docxError}
                      </p>
                      <div className="fallback-meta-table" style={{ marginTop: "16px" }}>
                        <div className="fallback-meta-row">
                          <span className="fallback-meta-label">File Name:</span>
                          <span className="fallback-meta-value">{file.name}</span>
                        </div>
                        <div className="fallback-meta-row">
                          <span className="fallback-meta-label">File Size:</span>
                          <span className="fallback-meta-value">{formatFileSize(file.size)}</span>
                        </div>
                        <div className="fallback-meta-row">
                          <span className="fallback-meta-label">Integrity Status:</span>
                          <span className="fallback-meta-value">
                            {calculatedHash ? "Fingerprint calculated" : "Computing..."}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>
                        The original file remains unmodified. If this is an encrypted, corrupted, or legacy document, you can still register it as an evidence artifact.
                      </p>
                    </div>
                  ) : (
                    <div className="docx-document-canvas">
                      <div
                        className="docx-rendered-content"
                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                      />
                      {docxWarnings && docxWarnings.length > 0 && (
                        <div className="docx-warnings-banner">
                          <strong>Note:</strong> Some advanced document elements may be simplified for browser display ({docxWarnings.slice(0, 2).join("; ")}).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PDF Preview via Mozilla PDF.js (Independent of Chrome's built-in PDF viewer) */}
              {fileCategory === "pdf" && (
                <div className="preview-content-box preview-pdf-container">
                  {pdfLoading ? (
                    <div className="docx-loading-state">
                      <RefreshCwIcon size={32} className="spin-inline" style={{ color: "var(--text-secondary)", marginBottom: "14px" }} />
                      <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                        Parsing PDF Document...
                      </h4>
                      <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                        Reading page catalog and font streams with Mozilla PDF.js...
                      </p>
                    </div>
                  ) : pdfError ? (
                    <div className="docx-error-state">
                      <div className="fallback-shield-avatar" style={{ color: "var(--red-restrained)", borderColor: "var(--red-border)" }}>
                        <AlertTriangleIcon size={32} />
                      </div>
                      <h4 className="fallback-title" style={{ color: "var(--red-restrained)" }}>
                        Unable to Render PDF
                      </h4>
                      <p className="fallback-description">
                        {pdfError}
                      </p>
                      <div className="fallback-meta-table" style={{ marginTop: "16px" }}>
                        <div className="fallback-meta-row">
                          <span className="fallback-meta-label">File Name:</span>
                          <span className="fallback-meta-value">{file.name}</span>
                        </div>
                        <div className="fallback-meta-row">
                          <span className="fallback-meta-label">File Size:</span>
                          <span className="fallback-meta-value">{formatFileSize(file.size)}</span>
                        </div>
                        <div className="fallback-meta-row">
                          <span className="fallback-meta-label">Integrity Status:</span>
                          <span className="fallback-meta-value">
                            {calculatedHash ? "Fingerprint calculated" : "Computing..."}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>
                        The original PDF file remains unmodified. If this is an encrypted, corrupted, or password-protected document, you can still register it as an evidence artifact.
                      </p>
                    </div>
                  ) : (
                    <div className="pdf-viewer-wrapper">
                      {/* PDF Navigation & Zoom Toolbar */}
                      <div className="pdf-toolbar">
                        <div className="pdf-toolbar-group">
                          <button
                            type="button"
                            className="btn-toolbar-tool btn-page-nav"
                            onClick={() => setPdfCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={pdfCurrentPage <= 1 || pdfRendering}
                            title="Previous Page"
                          >
                            ◀ Prev
                          </button>
                          <span className="pdf-page-indicator">
                            Page <strong className="pdf-current-page-num">{pdfCurrentPage}</strong> of <strong className="pdf-total-page-num">{pdfNumPages || 1}</strong>
                          </span>
                          <button
                            type="button"
                            className="btn-toolbar-tool btn-page-nav"
                            onClick={() => setPdfCurrentPage((p) => Math.min(pdfNumPages || 1, p + 1))}
                            disabled={pdfCurrentPage >= pdfNumPages || pdfRendering}
                            title="Next Page"
                          >
                            Next ▶
                          </button>
                        </div>

                        <div className="pdf-toolbar-group">
                          <button
                            type="button"
                            className="btn-toolbar-tool"
                            onClick={() => setPdfScale((s) => Math.max(0.5, Number((s - 0.2).toFixed(1))))}
                            title="Zoom Out"
                            disabled={pdfRendering}
                          >
                            −
                          </button>
                          <span className="zoom-level-text">{Math.round(pdfScale * 100)}%</span>
                          <button
                            type="button"
                            className="btn-toolbar-tool"
                            onClick={() => setPdfScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(1))))}
                            title="Zoom In"
                            disabled={pdfRendering}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn-toolbar-tool"
                            onClick={() => setPdfScale(1.0)}
                            title="Reset 100%"
                            disabled={pdfRendering}
                          >
                            Fit
                          </button>
                        </div>
                      </div>

                      {/* PDF Canvas Viewport */}
                      <div className="pdf-canvas-viewport">
                        {pdfRendering && (
                          <div className="pdf-rendering-overlay">
                            <span className="pdf-rendering-pill">
                              <RefreshCwIcon size={12} className="spin-inline" /> Rendering page {pdfCurrentPage}...
                            </span>
                          </div>
                        )}
                        <canvas ref={pdfCanvasRef} className="pdf-page-canvas" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image Preview with Zoom Controls */}
              {fileCategory === "image" && (
                <div className="preview-content-box preview-image-container">
                  <div className="image-zoom-toolbar">
                    <button
                      type="button"
                      className="btn-zoom-tool"
                      onClick={() => setImageZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(1))))}
                      title="Zoom Out"
                    >
                      −
                    </button>
                    <span className="zoom-level-text">{Math.round(imageZoom * 100)}%</span>
                    <button
                      type="button"
                      className="btn-zoom-tool"
                      onClick={() => setImageZoom((z) => Math.min(3.0, Number((z + 0.2).toFixed(1))))}
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn-zoom-tool"
                      onClick={() => setImageZoom(1)}
                      title="Reset 100%"
                    >
                      Fit
                    </button>
                  </div>
                  <div className="image-viewport-scroll">
                    <img
                      src={previewUrl}
                      alt={file.name}
                      style={{
                        transform: `scale(${imageZoom})`,
                        transformOrigin: "center center",
                        maxWidth: "100%",
                        maxHeight: "480px",
                        objectFit: "contain",
                        display: "block",
                        margin: "0 auto",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Plain Text Preview */}
              {fileCategory === "text" && (
                <div className="preview-content-box preview-text-container">
                  <div className="text-preview-header">
                    <span>Text Contents ({previewText.length} characters)</span>
                  </div>
                  <pre className="text-preview-scroll">
                    {previewText || "Loading text contents..."}
                  </pre>
                </div>
              )}

              {/* Audio Preview */}
              {fileCategory === "audio" && (
                <div className="preview-content-box preview-media-container">
                  <div style={{ textAlign: "center", padding: "30px 20px" }}>
                    <div style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                      <FileTextIcon size={44} />
                    </div>
                    <h4 style={{ fontSize: "15px", marginBottom: "8px" }}>Audio Evidence Playback</h4>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                      Browser-native audio stream playback
                    </p>
                    <audio
                      controls
                      src={previewUrl}
                      style={{ width: "100%", maxWidth: "460px" }}
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                </div>
              )}

              {/* Video Preview */}
              {fileCategory === "video" && (
                <div className="preview-content-box preview-media-container">
                  <video
                    controls
                    src={previewUrl}
                    style={{ width: "100%", maxHeight: "480px", display: "block", margin: "0 auto" }}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )}

              {/* Forensic & Unsupported Binary Format Fallback */}
              {fileCategory === "unsupported" && (
                <div className="preview-content-box preview-fallback-box">
                  <div className="fallback-shield-avatar">
                    <ShieldIcon size={36} />
                  </div>
                  <h4 className="fallback-title">In-Browser Preview Unavailable</h4>
                  <p className="fallback-description">
                    In-browser rendering is unavailable for this specialized file format. To preserve forensic integrity and avoid unintended script or binary execution, raw disk images (.raw, .dd), forensic container files (.e01), and executable or binary archives (.bin) are not rendered directly in the web browser.
                  </p>

                  <div className="fallback-meta-table">
                    <div className="fallback-meta-row">
                      <span className="fallback-meta-label">File Name:</span>
                      <span className="fallback-meta-value">{file.name}</span>
                    </div>
                    <div className="fallback-meta-row">
                      <span className="fallback-meta-label">File Size:</span>
                      <span className="fallback-meta-value">{formatFileSize(file.size)}</span>
                    </div>
                    <div className="fallback-meta-row">
                      <span className="fallback-meta-label">Detected Type:</span>
                      <span className="fallback-meta-value">{getFileTypeLabel(file)}</span>
                    </div>
                    <div className="fallback-meta-row">
                      <span className="fallback-meta-label">Integrity Status:</span>
                      <span className="fallback-meta-value" style={{ color: "var(--green-deep)", fontWeight: 600 }}>
                        {calculatedHash ? "Fingerprint calculated (SHA-256 ready)" : "Computing..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer-flat preview-modal-footer">
              <div className="preview-footer-status">
                <span className="status-indicator-dot" />
                <span>
                  {calculatedHash
                    ? `Pre-registration inspection • Local SHA-256: ${calculatedHash.slice(0, 16)}... • Ready for intake`
                    : "Pre-registration inspection active • Computing fingerprint..."}
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsPreviewOpen(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
