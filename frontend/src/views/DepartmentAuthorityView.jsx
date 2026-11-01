// ============================================================
// EvidenceChain: Department Authority View
// Case-Wise Organizational Hierarchy & Responsibility Management
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDepartmentCasesAPI,
  getCaseHierarchyAPI,
  getDepartmentPersonnelAPI,
  createCaseAssignmentAPI,
  updateCaseAssignmentAPI,
  removeCaseAssignmentAPI,
  getCaseHierarchyAuditLogAPI,
} from "../api";

export function DepartmentAuthorityView({
  currentUser,
  backendConnected,
}) {
  // -------------------------------------------------------------
  // State: Case Selection (Section A)
  // -------------------------------------------------------------
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [caseSearchQuery, setCaseSearchQuery] = useState("");

  // -------------------------------------------------------------
  // State: Case Command Hierarchy (Section B)
  // -------------------------------------------------------------
  const [hierarchyData, setHierarchyData] = useState(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [hierarchyError, setHierarchyError] = useState("");
  const [viewMode, setViewMode] = useState("tree"); // "tree" | "list"

  // -------------------------------------------------------------
  // State: Selected Officer Details (Section C)
  // -------------------------------------------------------------
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [collapsedNodes, setCollapsedNodes] = useState({});

  // -------------------------------------------------------------
  // State: Department Personnel for Assignment
  // -------------------------------------------------------------
  const [personnelList, setPersonnelList] = useState([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);

  // -------------------------------------------------------------
  // State: Management Modals (Section D)
  // -------------------------------------------------------------
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form states for modals
  const [assignForm, setAssignForm] = useState({
    userId: "",
    caseRole: "Forensic Analyst",
    reportsToAssignmentId: "",
    responsibilities: "",
    submitting: false,
    error: "",
  });

  const [editForm, setEditForm] = useState({
    assignmentId: "",
    officerName: "",
    caseRole: "",
    reportsToAssignmentId: "",
    responsibilities: "",
    submitting: false,
    error: "",
  });

  const [removeForm, setRemoveForm] = useState({
    assignmentId: "",
    officerName: "",
    subordinates: [],
    submitting: false,
    error: "",
  });

  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // -------------------------------------------------------------
  // User Authorization Check
  // -------------------------------------------------------------
  const isCallerHOD = useMemo(() => {
    if (hierarchyData?.currentUser && typeof hierarchyData.currentUser.isHOD === "boolean") {
      return hierarchyData.currentUser.isHOD;
    }
    return currentUser?.role === "Head of Department";
  }, [currentUser?.role, hierarchyData?.currentUser]);

  // -------------------------------------------------------------
  // 1. Fetch Cases
  // -------------------------------------------------------------
  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const res = await getDepartmentCasesAPI();
      if (res?.status === "success" && Array.isArray(res.cases)) {
        setCases(res.cases);
        // Default to first case if not yet selected
        setSelectedCaseId((prev) => {
          if (prev && res.cases.some((c) => c.caseId === prev)) return prev;
          return res.cases[0]?.caseId || "";
        });
      }
    } catch (err) {
      console.error("fetchCases error:", err);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  // -------------------------------------------------------------
  // 2. Fetch Personnel Directory for assignment choices
  // -------------------------------------------------------------
  const fetchPersonnel = useCallback(async () => {
    setLoadingPersonnel(true);
    try {
      const res = await getDepartmentPersonnelAPI();
      if (res?.status === "success" && Array.isArray(res.personnel)) {
        setPersonnelList(res.personnel);
      }
    } catch (err) {
      console.error("fetchPersonnel error:", err);
    } finally {
      setLoadingPersonnel(false);
    }
  }, []);

  // -------------------------------------------------------------
  // 3. Fetch Case Hierarchy for selected case
  // -------------------------------------------------------------
  const fetchHierarchy = useCallback(async (caseId) => {
    if (!caseId) {
      setHierarchyData(null);
      return;
    }
    setLoadingHierarchy(true);
    setHierarchyError("");
    try {
      const res = await getCaseHierarchyAPI(caseId);
      if (res?.status === "success") {
        setHierarchyData(res);
        // Auto-select Case Lead or first officer if not selected
        if (res.assignments?.length > 0) {
          setSelectedOfficerId((prev) => {
            const exists = res.assignments.some((a) => a.assignmentId === prev);
            if (exists) return prev;
            // Prefer Case Lead root
            const rootLead = res.roots?.[0];
            return rootLead?.assignmentId || res.assignments[0].assignmentId;
          });
        } else {
          setSelectedOfficerId("");
        }
      } else {
        setHierarchyError(res?.message || "Failed to load case hierarchy.");
      }
    } catch (err) {
      console.error("fetchHierarchy error:", err);
      setHierarchyError("Failed to communicate with case hierarchy service.");
    } finally {
      setLoadingHierarchy(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchPersonnel();
  }, [fetchCases, fetchPersonnel]);

  useEffect(() => {
    if (selectedCaseId) {
      fetchHierarchy(selectedCaseId);
    }
  }, [selectedCaseId, fetchHierarchy]);

  // Filtered cases for Section A search
  const filteredCases = useMemo(() => {
    if (!caseSearchQuery.trim()) return cases;
    const q = caseSearchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.caseId?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [cases, caseSearchQuery]);

  // Active selected case object
  const activeCase = useMemo(() => {
    return cases.find((c) => c.caseId === selectedCaseId) || null;
  }, [cases, selectedCaseId]);

  // Selected officer assignment object
  const selectedOfficer = useMemo(() => {
    if (!hierarchyData?.assignments || !selectedOfficerId) return null;
    return (
      hierarchyData.assignments.find((a) => a.assignmentId === selectedOfficerId) ||
      null
    );
  }, [hierarchyData?.assignments, selectedOfficerId]);

  // Direct subordinates of selected officer
  const selectedOfficerSubordinates = useMemo(() => {
    if (!hierarchyData?.assignments || !selectedOfficerId) return [];
    return hierarchyData.assignments.filter(
      (a) => a.reportsToAssignmentId === selectedOfficerId
    );
  }, [hierarchyData?.assignments, selectedOfficerId]);

  // Unassigned personnel eligible for addition to this case
  const availableOfficersForCase = useMemo(() => {
    if (!personnelList || !hierarchyData?.assignments) return personnelList;
    const assignedUserIds = new Set(
      hierarchyData.assignments.map((a) => a.userId)
    );
    return personnelList.filter((p) => !assignedUserIds.has(p.userId));
  }, [personnelList, hierarchyData?.assignments]);

  // Active assignments in this case eligible to be supervisors
  const potentialSupervisors = useMemo(() => {
    return hierarchyData?.assignments || [];
  }, [hierarchyData?.assignments]);

  // Copy helper
  const handleCopy = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2200);
  };

  // -------------------------------------------------------------
  // Section D Handlers: Manage Case Team
  // -------------------------------------------------------------
  const handleOpenAssignModal = () => {
    setAssignForm({
      userId: availableOfficersForCase[0]?.userId || "",
      caseRole: hierarchyData?.hasAssignments ? "Forensic Analyst" : "Case Lead",
      reportsToAssignmentId: hierarchyData?.roots?.[0]?.assignmentId || "",
      responsibilities: "",
      submitting: false,
      error: "",
    });
    setAssignModalOpen(true);
  };

  const handleExecuteAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.userId) {
      setAssignForm((prev) => ({ ...prev, error: "Please select an officer." }));
      return;
    }
    if (!assignForm.caseRole.trim()) {
      setAssignForm((prev) => ({ ...prev, error: "Case role is required." }));
      return;
    }

    setAssignForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await createCaseAssignmentAPI({
        caseId: selectedCaseId,
        userId: assignForm.userId,
        caseRole: assignForm.caseRole.trim(),
        reportsToAssignmentId: assignForm.reportsToAssignmentId || null,
        responsibilities: assignForm.responsibilities.trim(),
      });

      if (res?.status === "success") {
        setAssignModalOpen(false);
        setFeedbackNotice(`✓ Officer successfully assigned to ${selectedCaseId}.`);
        setTimeout(() => setFeedbackNotice(null), 4000);
        await fetchHierarchy(selectedCaseId);
        await fetchCases();
        if (res.assignmentId) setSelectedOfficerId(res.assignmentId);
      } else {
        setAssignForm((prev) => ({
          ...prev,
          submitting: false,
          error: res?.message || "Failed to create assignment.",
        }));
      }
    } catch (err) {
      setAssignForm((prev) => ({
        ...prev,
        submitting: false,
        error: "Network error creating case assignment.",
      }));
    }
  };

  const handleOpenEditModal = (officer) => {
    const target = officer || selectedOfficer;
    if (!target) return;
    setEditForm({
      assignmentId: target.assignmentId,
      officerName: target.officerName,
      caseRole: target.caseRole,
      reportsToAssignmentId: target.reportsToAssignmentId || "",
      responsibilities: target.responsibilities || "",
      submitting: false,
      error: "",
    });
    setEditModalOpen(true);
  };

  const handleExecuteEdit = async (e) => {
    e.preventDefault();
    if (!editForm.caseRole.trim()) {
      setEditForm((prev) => ({ ...prev, error: "Case role is required." }));
      return;
    }

    setEditForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await updateCaseAssignmentAPI(editForm.assignmentId, {
        caseId: selectedCaseId,
        caseRole: editForm.caseRole.trim(),
        reportsToAssignmentId: editForm.reportsToAssignmentId || null,
        responsibilities: editForm.responsibilities.trim(),
      });

      if (res?.status === "success") {
        setEditModalOpen(false);
        setFeedbackNotice(`✓ Assignment for ${editForm.officerName} updated successfully.`);
        setTimeout(() => setFeedbackNotice(null), 4000);
        await fetchHierarchy(selectedCaseId);
      } else {
        setEditForm((prev) => ({
          ...prev,
          submitting: false,
          error: res?.message || "Failed to update assignment.",
        }));
      }
    } catch (err) {
      setEditForm((prev) => ({
        ...prev,
        submitting: false,
        error: "Network error updating assignment.",
      }));
    }
  };

  const handleOpenRemoveModal = (officer) => {
    const target = officer || selectedOfficer;
    if (!target) return;
    // Find direct subordinates
    const subs = hierarchyData?.assignments?.filter(
      (a) => a.reportsToAssignmentId === target.assignmentId
    ) || [];

    setRemoveForm({
      assignmentId: target.assignmentId,
      officerName: target.officerName,
      subordinates: subs,
      submitting: false,
      error: "",
    });
    setRemoveModalOpen(true);
  };

  const handleExecuteRemove = async () => {
    setRemoveForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await removeCaseAssignmentAPI(
        removeForm.assignmentId,
        selectedCaseId
      );

      if (res?.status === "success") {
        setRemoveModalOpen(false);
        setFeedbackNotice(
          `✓ Officer ${removeForm.officerName} removed from case. Subordinates safely re-parented.`
        );
        setTimeout(() => setFeedbackNotice(null), 4000);
        await fetchHierarchy(selectedCaseId);
        await fetchCases();
        setSelectedOfficerId("");
      } else {
        setRemoveForm((prev) => ({
          ...prev,
          submitting: false,
          error: res?.message || "Failed to remove officer from case.",
        }));
      }
    } catch (err) {
      setRemoveForm((prev) => ({
        ...prev,
        submitting: false,
        error: "Network error removing officer assignment.",
      }));
    }
  };

  const handleOpenAuditModal = async () => {
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await getCaseHierarchyAuditLogAPI(selectedCaseId);
      if (res?.status === "success") {
        setAuditLogs(res.auditLog || []);
      }
    } catch (err) {
      console.error("fetchAuditLog error:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Helper to render tree nodes recursively
  const renderTreeNode = (node, isLead = false) => {
    const isSelected = selectedOfficerId === node.assignmentId;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div
        key={node.assignmentId}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          margin: "0 10px",
        }}
      >
        {/* Officer Card Node */}
        <div
          onClick={() => setSelectedOfficerId(node.assignmentId)}
          data-testid={`hierarchy-node-${node.assignmentId}`}
          className={`hierarchy-card-node ${isSelected ? "node-selected" : ""}`}
          style={{
            cursor: "pointer",
            width: "220px",
            background: isSelected ? "#F3EFE6" : "#FFFFFF",
            border: isSelected
              ? "2px solid var(--navy-900, #142535)"
              : isLead
              ? "1.5px solid var(--green-institutional, #287A58)"
              : "1px solid var(--border-color, #D6D0C4)",
            borderRadius: "3px",
            padding: "10px 12px",
            boxShadow: isSelected
              ? "0 3px 8px rgba(0,0,0,0.12)"
              : "0 1px 3px rgba(0,0,0,0.05)",
            position: "relative",
            transition: "all 0.15s ease",
          }}
        >
          {/* Case Role Pill */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span
              className={`badge ${
                isLead
                  ? "badge-emerald"
                  : (node.isJointInvestigator || node.caseRole.toLowerCase().includes("joint") || node.caseRole.toLowerCase().includes("peer"))
                  ? "badge-indigo"
                  : node.caseRole.toLowerCase().includes("analyst")
                  ? "badge-amber"
                  : "badge-neutral"
              }`}
              style={{ fontSize: "9.5px", padding: "2px 6px" }}
            >
              {(node.isJointInvestigator || node.caseRole.toLowerCase().includes("joint") || node.caseRole.toLowerCase().includes("peer"))
                ? `↔ ${node.caseRole.toUpperCase()}`
                : node.caseRole.toUpperCase()}
            </span>
            <span className="badge badge-clean badge-verified" style={{ fontSize: "9px" }}>
              ACTIVE
            </span>
          </div>

          {/* Name & ID */}
          <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--navy-900, #142535)" }}>
            {node.officerName}
          </div>
          <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>
            ID: {node.employeeId}
          </div>

          {/* Official Designation */}
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {node.officialDesignation}
          </div>

          {/* Peer / Subordinate count badge & Progressive Disclosure Toggle */}
          {hasChildren && (
            <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                ↳ <strong>{node.children.length}</strong> subordinate{node.children.length > 1 ? "s" : ""}
              </div>
              <button
                type="button"
                className="btn-tactile-secondary"
                style={{ fontSize: "9px", padding: "1px 6px", height: "auto", minHeight: "unset", lineHeight: 1.4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedNodes((prev) => ({
                    ...prev,
                    [node.assignmentId]: !prev[node.assignmentId],
                  }));
                }}
                title={collapsedNodes[node.assignmentId] ? "Expand subordinates" : "Collapse subordinates"}
              >
                {collapsedNodes[node.assignmentId] ? "+ Expand" : "− Hide"}
              </button>
            </div>
          )}
        </div>

        {/* Connector Pipe to Children */}
        {hasChildren && !collapsedNodes[node.assignmentId] && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            {/* Vertical stem down from parent */}
            <div style={{ width: "2px", height: "18px", background: "var(--border-subtle, #D6D0C4)" }} />

            {/* Horizontal bar spanning across children if multiple */}
            {node.children.length > 1 && (
              <div
                style={{
                  height: "2px",
                  background: "var(--border-subtle, #D6D0C4)",
                  width: `${(node.children.length - 1) * 240}px`,
                  maxWidth: "96%",
                }}
              />
            )}

            {/* Children row */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "nowrap",
                marginTop: node.children.length > 1 ? "0px" : "0px",
              }}
            >
              {node.children.map((child) => (
                <div key={child.assignmentId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* Stem down to child */}
                  <div style={{ width: "2px", height: "14px", background: "var(--border-subtle, #D6D0C4)" }} />
                  {renderTreeNode(child, false)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="view-container department-authority-view" data-testid="department-authority-view" style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* ======================================================== */}
      {/* 1. Header Block                                          */}
      {/* ======================================================== */}
      <div className="page-header-block" style={{ marginBottom: "18px" }}>
        <div>
          <div className="system-pill" style={{ display: "inline-flex", marginBottom: "6px" }}>
            <span className="live-indicator"></span>
            CASE INVESTIGATION REPORTING STRUCTURE
          </div>
          <h1 className="page-title">Department Authority &amp; Case Hierarchy</h1>
          <p className="page-context-desc">
            Case-specific supervisory reporting structures, officer role assignments, and investigative oversight lines.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <span
            className={`badge ${isCallerHOD ? "badge-emerald" : "badge-neutral"}`}
            style={{ fontSize: "11px", padding: "5px 12px" }}
            data-testid="hod-authorization-label"
          >
            {isCallerHOD ? "DEPARTMENT ADMINISTRATOR" : "READ-ONLY OVERSIGHT"}
          </span>

          {isCallerHOD && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAssignModal}
              disabled={!selectedCaseId}
              data-testid="btn-add-officer-to-case"
            >
              + Assign Officer to Case
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenAuditModal}
            disabled={!selectedCaseId}
            data-testid="btn-view-case-audit"
          >
            Case Audit Log
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchCases();
              if (selectedCaseId) fetchHierarchy(selectedCaseId);
            }}
            title="Refresh case reporting hierarchy"
            data-testid="btn-refresh-hierarchy"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Case Governance Specification Notice */}
      <div
        className="authority-governance-note"
        style={{
          padding: "10px 14px",
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "4px",
          fontSize: "12px",
          color: "var(--text-secondary)",
          marginBottom: "18px",
          lineHeight: 1.5,
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <strong style={{ color: "var(--text-primary)" }}>Case Governance Specification:</strong> Department Authority establishes case-specific supervisory reporting structures, investigator assignments, and supervisory chains for this case docket. Evidence-level View and Download file permissions are governed independently under <strong>Access Management</strong>.
      </div>

      {/* Global Alerts */}
      {!backendConnected && (
        <div className="alert-banner alert-danger" style={{ marginBottom: "16px" }}>
          <strong>Service Offline:</strong> Cannot communicate with backend on port 5001. Ensure Flask service is running.
        </div>
      )}

      {feedbackNotice && (
        <div className="alert-banner alert-clean" style={{ marginBottom: "16px", background: "#E7EFEA", borderColor: "#9AB2A4", color: "#1F5F44" }}>
          {feedbackNotice}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION A: CASE SELECTION                                */}
      {/* ======================================================== */}
      <section className="diagnostics-section" aria-labelledby="section-case-selection" style={{ marginBottom: "22px" }}>
        <div className="section-header-compact">
          <div>
            <span className="section-kicker">SECTION A</span>
            <h2 id="section-case-selection" className="section-title-sm">
              Case Selection
            </h2>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            SELECT ONE CASE AT A TIME TO INSPECT INDEPENDENT REPORTING LINES
          </span>
        </div>

        <div className="card" style={{ padding: "16px 18px", minWidth: 0, boxSizing: "border-box" }}>
          {/* Case search filter & dropdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "14px", alignItems: "center", minWidth: 0 }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Search Cases
              </label>
              <input
                type="text"
                className="form-input-text"
                placeholder="Filter by case number or keyword..."
                value={caseSearchQuery}
                onChange={(e) => setCaseSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                data-testid="case-search-input"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Active Case Docket
              </label>
              <select
                className="form-input-text"
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                disabled={loadingCases || cases.length === 0}
                style={{ width: "100%", padding: "7px 10px", fontSize: "12px", fontWeight: 600 }}
                data-testid="select-case-dropdown"
              >
                {loadingCases ? (
                  <option value="">Loading cases...</option>
                ) : filteredCases.length === 0 ? (
                  <option value="">No cases match search query</option>
                ) : (
                  filteredCases.map((c) => (
                    <option key={c.caseId} value={c.caseId}>
                      {c.caseId} — {c.title} ({c.assignedOfficerCount} officers assigned • {c.status})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Active Case Banner */}
          {activeCase && (
            <div
              style={{
                marginTop: "14px",
                padding: "10px 14px",
                background: "#FAF8F4",
                border: "1px solid var(--border-subtle)",
                borderRadius: "2px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
              data-testid="active-case-banner"
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong className="font-mono" style={{ fontSize: "13px", color: "var(--navy-900, #142535)" }}>
                    {activeCase.caseId}
                  </strong>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {activeCase.title}
                  </span>
                  <span className="badge badge-outline" style={{ fontSize: "10px" }}>
                    STATUS: {activeCase.status}
                  </span>
                </div>
                {activeCase.description && (
                  <p style={{ margin: "3px 0 0 0", fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {activeCase.description}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", fontSize: "11px" }}>
                <span className="badge badge-neutral" style={{ fontSize: "10.5px" }}>
                  Assigned Team: <strong>{hierarchyData?.totalAssigned ?? activeCase.assignedOfficerCount ?? 0}</strong> officers
                </span>
                <span className="badge badge-neutral" style={{ fontSize: "10.5px" }}>
                  Evidence Items: <strong>{activeCase.evidenceCount ?? 0}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION B: CASE COMMAND HIERARCHY                        */}
      {/* ======================================================== */}
      <section className="diagnostics-section" aria-labelledby="section-case-hierarchy" style={{ marginBottom: "22px" }}>
        <div className="section-header-compact">
          <div>
            <span className="section-kicker">SECTION B</span>
            <h2 id="section-case-hierarchy" className="section-title-sm">
              Case Command Hierarchy
            </h2>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {hierarchyData?.hasAssignments && (
              <div style={{ display: "flex", border: "1px solid var(--border-color)", borderRadius: "2px", overflow: "hidden" }}>
                <button
                  type="button"
                  className={`btn ${viewMode === "tree" ? "btn-primary" : "btn-secondary"} btn-xs`}
                  onClick={() => setViewMode("tree")}
                  style={{ borderRadius: 0 }}
                  data-testid="btn-viewmode-tree"
                >
                  Visual Tree
                </button>
                <button
                  type="button"
                  className={`btn ${viewMode === "list" ? "btn-primary" : "btn-secondary"} btn-xs`}
                  onClick={() => setViewMode("list")}
                  style={{ borderRadius: 0 }}
                  data-testid="btn-viewmode-list"
                >
                  Hierarchical List
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }} data-testid="case-hierarchy-container">
          {loadingHierarchy ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Evaluating case supervisory hierarchy...
            </div>
          ) : hierarchyError ? (
            <div className="alert-banner alert-danger">
              <strong>Error:</strong> {hierarchyError}
            </div>
          ) : !hierarchyData || !hierarchyData.hasAssignments ? (
            /* Empty State: No Case Team Assigned */
            <div
              style={{
                padding: "36px 20px",
                textAlign: "center",
                background: "#FAF8F4",
                border: "1px dashed var(--border-color)",
                borderRadius: "3px",
              }}
              data-testid="no-team-assigned-state"
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>⚖</div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--navy-900, #142535)", fontWeight: 700 }}>
                No case team assigned
              </h3>
              <p style={{ margin: "0 auto 16px auto", maxWidth: "520px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This investigation ({selectedCaseId || "selected docket"}) currently has no configured reporting hierarchy or assigned forensic personnel. Case assignments and supervisory trees are independent across cases.
              </p>
              {isCallerHOD ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenAssignModal}
                  data-testid="btn-setup-case-team"
                >
                  + Assign Case Lead & Configure Team
                </button>
              ) : (
                <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                  Awaiting team designation by Department Administrator
                </span>
              )}
            </div>
          ) : (
            <div>
              {/* Executive Department Oversight Anchor */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    background: "#F5F3ED",
                    border: "1.5px solid var(--border-color, #C8D3CC)",
                    borderRadius: "3px",
                    padding: "8px 16px",
                    textAlign: "center",
                    maxWidth: "340px",
                  }}
                  data-testid="executive-oversight-anchor"
                >
                  <span className="section-kicker" style={{ fontSize: "9px" }}>
                    EXECUTIVE DEPARTMENTAL OVERSIGHT
                  </span>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--navy-900, #142535)" }}>
                    {hierarchyData.departmentOversight?.name || "Dr. Rajeshwar Sen"}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                    Head of Department • Forensics Headquarters
                  </div>
                </div>

                {/* Vertical Stem going down to Case Lead(s) */}
                <div style={{ width: "2px", height: "16px", background: "var(--border-subtle, #D6D0C4)" }} />

                {/* Horizontal bar across roots if multiple top-level leads / joint investigators */}
                {hierarchyData.roots && hierarchyData.roots.length > 1 && (
                  <div
                    style={{
                      height: "2px",
                      background: "var(--border-subtle, #D6D0C4)",
                      width: `${(hierarchyData.roots.length - 1) * 260}px`,
                      maxWidth: "96%",
                    }}
                  />
                )}
              </div>

              {/* View Mode A: Visual Tree */}
              {viewMode === "tree" ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    overflowX: "auto",
                    padding: "10px 0 20px 0",
                  }}
                  data-testid="hierarchy-visual-tree"
                >
                  {hierarchyData.roots.map((rootNode) => (
                    <div key={rootNode.assignmentId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {hierarchyData.roots.length > 1 && (
                        <div style={{ width: "2px", height: "14px", background: "var(--border-subtle, #D6D0C4)" }} />
                      )}
                      {renderTreeNode(rootNode, true)}
                    </div>
                  ))}
                </div>
              ) : (
                /* View Mode B: Accessible Hierarchical List */
                <div className="table-wrapper-archival" data-testid="hierarchy-accessible-list">
                  <table className="archival-table">
                    <thead>
                      <tr>
                        <th style={{ width: "28%" }}>Officer & Case Role</th>
                        <th style={{ width: "22%" }}>Official Designation</th>
                        <th style={{ width: "24%" }}>Reports To (Supervisor)</th>
                        <th style={{ width: "16%" }}>Hierarchy Level</th>
                        <th style={{ width: "10%", textAlign: "right" }}>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hierarchyData.assignments.map((asg) => {
                        const isSelected = selectedOfficerId === asg.assignmentId;
                        const isLead = anyRoleIsLead(asg.caseRole);

                        return (
                          <tr
                            key={asg.assignmentId}
                            style={{
                              backgroundColor: isSelected ? "#F3EFE6" : undefined,
                              cursor: "pointer",
                            }}
                            onClick={() => setSelectedOfficerId(asg.assignmentId)}
                          >
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--navy-900, #142535)", fontSize: "13px" }}>
                                {asg.officerName} {isLead && <span className="badge badge-emerald badge-xs">LEAD</span>}
                              </div>
                              <span className="badge badge-neutral" style={{ fontSize: "9.5px", marginTop: "2px" }}>
                                {asg.caseRole}
                              </span>
                            </td>

                            <td>
                              <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                                {asg.officialDesignation}
                              </div>
                              <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                                ID: {asg.officerEmployeeId}
                              </div>
                            </td>

                            <td>
                              {asg.supervisorName ? (
                                <div>
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                                    {asg.supervisorName}
                                  </span>
                                  <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                                    {asg.supervisorRole}
                                  </div>
                                </div>
                              ) : (
                                <span className="badge badge-outline" style={{ fontSize: "10px" }}>
                                  TOP-LEVEL (CASE LEAD)
                                </span>
                              )}
                            </td>

                            <td>
                              <span className="badge badge-neutral" style={{ fontSize: "10px" }}>
                                {asg.reportsToAssignmentId ? "Subordinate Level" : "Root Executive Lead"}
                              </span>
                            </td>

                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className={`btn ${isSelected ? "btn-primary" : "btn-secondary"} btn-xs`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOfficerId(asg.assignmentId);
                                }}
                              >
                                {isSelected ? "Active" : "Inspect"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION C: SELECTED OFFICER RESPONSIBILITIES             */}
      {/* ======================================================== */}
      {selectedOfficer && (
        <section className="diagnostics-section" aria-labelledby="section-officer-responsibilities" style={{ marginBottom: "22px" }}>
          <div className="section-header-compact">
            <div>
              <span className="section-kicker">SECTION C</span>
              <h2 id="section-officer-responsibilities" className="section-title-sm">
                Selected Officer Responsibilities
              </h2>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {isCallerHOD && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => handleOpenEditModal(selectedOfficer)}
                    data-testid="btn-edit-selected-officer"
                  >
                    Edit Role & Supervisor
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    style={{ color: "var(--red-restrained, #9C2A2A)" }}
                    onClick={() => handleOpenRemoveModal(selectedOfficer)}
                    data-testid="btn-remove-selected-officer"
                  >
                    Remove from Case
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }} data-testid="selected-officer-detail-panel">
            {/* Header / Title block */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px", marginBottom: "14px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--navy-900, #142535)", fontWeight: 700 }}>
                    {selectedOfficer.officerName}
                  </h3>
                  <span className="badge badge-emerald" style={{ fontSize: "10.5px" }}>
                    CASE ROLE: {selectedOfficer.caseRole}
                  </span>
                  <span className="badge badge-neutral font-mono" style={{ fontSize: "10px" }}>
                    EMP ID: {selectedOfficer.officerEmployeeId}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {selectedOfficer.officialDesignation} • {selectedOfficer.officerDepartment} • {selectedOfficer.officerOrganization}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span className="badge badge-clean badge-verified" style={{ fontSize: "10.5px" }}>
                  STATUS: {selectedOfficer.assignmentStatus}
                </span>
              </div>
            </div>

            {/* Reporting Supervisor & Subordinates Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "12px", marginBottom: "14px", minWidth: 0 }}>
              <div style={{ background: "#FAF8F4", border: "1px solid var(--border-subtle)", padding: "10px 12px", borderRadius: "2px" }}>
                <span className="metadata-field-label">REPORTING SUPERVISOR IN THIS CASE</span>
                {selectedOfficer.supervisorName ? (
                  <div style={{ marginTop: "4px" }}>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--navy-900, #142535)" }}>
                      {selectedOfficer.supervisorName}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      Role: {selectedOfficer.supervisorRole} • ID: {selectedOfficer.supervisorEmployeeId}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "4px" }}>
                    <span className="badge badge-outline" style={{ fontSize: "10px" }}>
                      TOP-LEVEL CASE INVESTIGATION LEAD
                    </span>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Reports directly to Executive Departmental Oversight ({hierarchyData?.departmentOversight?.name})
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: "#FAF8F4", border: "1px solid var(--border-subtle)", padding: "10px 12px", borderRadius: "2px" }}>
                <span className="metadata-field-label">DIRECT SUBORDINATES IN THIS CASE</span>
                {selectedOfficerSubordinates.length > 0 ? (
                  <div style={{ marginTop: "4px" }}>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--navy-900, #142535)" }}>
                      {selectedOfficerSubordinates.length} Officer{selectedOfficerSubordinates.length > 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      {selectedOfficerSubordinates.map((s) => `${s.officerName} (${s.caseRole})`).join(", ")}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "4px", fontSize: "11.5px", color: "var(--text-muted)" }}>
                    No subordinate officers report to this assignment.
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Responsibilities */}
            <div style={{ background: "#FFFFFF", border: "1px solid var(--border-subtle)", padding: "12px 14px", borderRadius: "2px", marginBottom: "14px" }}>
              <span className="metadata-field-label" style={{ display: "block", marginBottom: "4px" }}>
                ASSIGNED CASE RESPONSIBILITIES & FORENSIC DUTIES
              </span>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {selectedOfficer.responsibilities || "General forensic investigation duties as assigned by the Case Lead."}
              </p>
            </div>

            {/* Restricted Technical Disclosure */}
            <details style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "10px" }}>
              <summary style={{ fontSize: "11.5px", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}>
                ▸ Technical Assignment & Audit Identifiers
              </summary>
              <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Assignment ID:</span>{" "}
                  <code className="font-mono">{selectedOfficer.assignmentId}</code>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Created By:</span>{" "}
                  <strong>{selectedOfficer.createdBy || "System"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Created At:</span>{" "}
                  <span>{selectedOfficer.createdAt}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Signing Identity:</span>{" "}
                  <code className="font-mono">{selectedOfficer.officerWallet ? `${selectedOfficer.officerWallet.slice(0, 10)}...` : "—"}</code>{" "}
                  {selectedOfficer.officerWallet && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleCopy("sel-officer-wallet", selectedOfficer.officerWallet)}
                    >
                      {copiedKey === "sel-officer-wallet" ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>
            </details>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ASSIGN OFFICER TO CASE                          */}
      {/* ======================================================== */}
      {assignModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="modal-assign-officer">
          <div className="modal-dialog" style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <div>
                <span className="section-kicker" style={{ color: "var(--green-institutional)" }}>
                  DEPARTMENTAL GOVERNANCE
                </span>
                <h3 className="modal-title" style={{ fontSize: "16px", marginTop: "2px" }}>
                  Assign Officer to {selectedCaseId}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAssignModalOpen(false)}
                disabled={assignForm.submitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteAssign}>
              <div className="modal-body" style={{ padding: "16px 20px" }}>
                {assignForm.error && (
                  <div className="alert-banner alert-danger" style={{ marginBottom: "14px" }}>
                    <strong>Error:</strong> {assignForm.error}
                  </div>
                )}

                {/* 1. Officer Selection */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Select Officer *
                  </label>
                  <select
                    className="form-input-text"
                    value={assignForm.userId}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, userId: e.target.value }))}
                    disabled={assignForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-assign-officer-select"
                  >
                    <option value="">— Select an Officer —</option>
                    {availableOfficersForCase.map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.name} ({p.officialDesignation} • {p.employeeId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Case-Specific Role */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Case Role in this Investigation *
                  </label>
                  <input
                    type="text"
                    className="form-input-text"
                    placeholder="e.g. Case Lead, Forensic Analyst, Investigating Officer"
                    value={assignForm.caseRole}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, caseRole: e.target.value }))}
                    disabled={assignForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-assign-role"
                  />
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                    {["Case Lead", "Joint Investigator", "Investigating Officer", "Supporting Investigator", "Forensic Analyst", "Evidence Custodian"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="btn btn-secondary btn-xs"
                        style={{ fontSize: "10px" }}
                        onClick={() => setAssignForm((prev) => ({ ...prev, caseRole: r }))}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Reporting Supervisor */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Reporting Supervisor (In this Case)
                  </label>
                  <select
                    className="form-input-text"
                    value={assignForm.reportsToAssignmentId}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, reportsToAssignmentId: e.target.value }))}
                    disabled={assignForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-assign-supervisor"
                  >
                    <option value="">— None (Top-Level / Case Lead) —</option>
                    {potentialSupervisors.map((s) => (
                      <option key={s.assignmentId || s.assignment_id} value={s.assignmentId || s.assignment_id}>
                        {s.officerName || s.officer_name} ({s.caseRole || s.case_role})
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block", marginTop: "3px" }}>
                    Select another active officer in this case, or leave blank if designating a Case Lead.
                  </span>
                </div>

                {/* 4. Assigned Responsibilities */}
                <div style={{ marginBottom: "6px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Assigned Responsibilities & Duties
                  </label>
                  <textarea
                    className="form-input-text"
                    rows={3}
                    placeholder="Specify forensic duties, analysis scope, and evidence handling responsibilities..."
                    value={assignForm.responsibilities}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, responsibilities: e.target.value }))}
                    disabled={assignForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-assign-responsibilities"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAssignModalOpen(false)}
                  disabled={assignForm.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={assignForm.submitting}
                  data-testid="btn-submit-assign-officer"
                >
                  {assignForm.submitting ? "Assigning..." : "Confirm Case Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT ASSIGNMENT & SUPERVISOR                    */}
      {/* ======================================================== */}
      {editModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="modal-edit-assignment">
          <div className="modal-dialog" style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <div>
                <span className="section-kicker" style={{ color: "var(--navy-900)" }}>
                  UPDATE RESPONSIBILITIES
                </span>
                <h3 className="modal-title" style={{ fontSize: "16px", marginTop: "2px" }}>
                  Edit Assignment: {editForm.officerName}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditModalOpen(false)}
                disabled={editForm.submitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteEdit}>
              <div className="modal-body" style={{ padding: "16px 20px" }}>
                {editForm.error && (
                  <div className="alert-banner alert-danger" style={{ marginBottom: "14px" }}>
                    <strong>Error:</strong> {editForm.error}
                  </div>
                )}

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Case Role in this Investigation *
                  </label>
                  <input
                    type="text"
                    className="form-input-text"
                    value={editForm.caseRole}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, caseRole: e.target.value }))}
                    disabled={editForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-edit-role"
                  />
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                    {["Case Lead", "Joint Investigator", "Investigating Officer", "Supporting Investigator", "Forensic Analyst", "Evidence Custodian"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="btn btn-secondary btn-xs"
                        style={{ fontSize: "10px" }}
                        onClick={() => setEditForm((prev) => ({ ...prev, caseRole: r }))}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Reporting Supervisor (In this Case)
                  </label>
                  <select
                    className="form-input-text"
                    value={editForm.reportsToAssignmentId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, reportsToAssignmentId: e.target.value }))}
                    disabled={editForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-edit-supervisor"
                  >
                    <option value="">— None (Top-Level / Case Lead) —</option>
                    {potentialSupervisors
                      .filter((s) => (s.assignmentId || s.assignment_id) !== editForm.assignmentId)
                      .map((s) => (
                        <option key={s.assignmentId || s.assignment_id} value={s.assignmentId || s.assignment_id}>
                          {s.officerName || s.officer_name} ({s.caseRole || s.case_role})
                        </option>
                      ))}
                  </select>
                  <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block", marginTop: "3px" }}>
                    Self-reporting and circular reporting loops are rejected server-side.
                  </span>
                </div>

                <div style={{ marginBottom: "6px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Assigned Responsibilities & Duties
                  </label>
                  <textarea
                    className="form-input-text"
                    rows={3}
                    value={editForm.responsibilities}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, responsibilities: e.target.value }))}
                    disabled={editForm.submitting}
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
                    data-testid="input-edit-responsibilities"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editForm.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={editForm.submitting}
                  data-testid="btn-submit-edit-assignment"
                >
                  {editForm.submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: REMOVE OFFICER CONFIRMATION                     */}
      {/* ======================================================== */}
      {removeModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="modal-remove-officer">
          <div className="modal-dialog" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <div>
                <span className="section-kicker" style={{ color: "var(--red-restrained)" }}>
                  CONSEQUENTIAL MODIFICATION GATE
                </span>
                <h3 className="modal-title" style={{ fontSize: "16px", marginTop: "2px" }}>
                  Confirm Removal from {selectedCaseId}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRemoveModalOpen(false)}
                disabled={removeForm.submitting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: "16px 20px" }}>
              {removeForm.error && (
                <div className="alert-banner alert-danger" style={{ marginBottom: "14px" }}>
                  <strong>Error:</strong> {removeForm.error}
                </div>
              )}

              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--navy-900, #142535)" }}>
                Are you sure you want to remove <strong>{removeForm.officerName}</strong> from this case investigation team?
              </p>

              {removeForm.subordinates.length > 0 && (
                <div
                  style={{
                    background: "var(--amber-subtle, #FDF9F3)",
                    border: "1px solid var(--ochre-border, #CCBAA2)",
                    padding: "10px 12px",
                    borderRadius: "2px",
                    marginBottom: "12px",
                  }}
                >
                  <strong style={{ fontSize: "11.5px", color: "var(--amber-deep, #8C6A2E)" }}>
                    ⚠ Safe Subordinate Re-parenting:
                  </strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11.5px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {removeForm.subordinates.length} subordinate officer(s) (
                    {removeForm.subordinates.map((s) => s.officerName).join(", ")}) currently report to this officer. Upon removal, they will be safely and automatically re-parented to the deleted officer&apos;s supervisor to prevent orphaned reporting lines.
                  </p>
                </div>
              )}

              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                This action is audited and will be permanently recorded in the case hierarchy log.
              </div>
            </div>

            <div className="modal-footer" style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRemoveModalOpen(false)}
                disabled={removeForm.submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: "var(--red-restrained, #9C2A2A)", borderColor: "var(--red-restrained, #9C2A2A)" }}
                onClick={handleExecuteRemove}
                disabled={removeForm.submitting}
                data-testid="btn-confirm-remove-officer"
              >
                {removeForm.submitting ? "Removing..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: CASE HIERARCHY AUDIT LOG TRAIL                  */}
      {/* ======================================================== */}
      {auditModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="modal-case-audit-trail">
          <div className="modal-dialog" style={{ maxWidth: "640px" }}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">HISTORICAL RECORD</span>
                <h3 className="modal-title" style={{ fontSize: "16px", marginTop: "2px" }}>
                  Case Team Audit Trail: {selectedCaseId}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAuditModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: "16px 20px", maxHeight: "400px", overflowY: "auto" }}>
              {loadingAudit ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  Loading case audit trail...
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  No assignment modifications recorded yet for this case.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "10px 12px",
                        background: "#FAF8F4",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "2px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="badge badge-emerald" style={{ fontSize: "9px" }}>
                          {log.action}
                        </span>
                        <span className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          {log.created_at}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--navy-900, #142535)", marginTop: "4px" }}>
                        {log.details || `Operation on ${log.target_user_name || log.assignment_id}`}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Executed by: <strong>{log.performed_by_name}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAuditModalOpen(false)}
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

// Helper to determine if a case role corresponds to a lead
function anyRoleIsLead(role) {
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower.includes("lead") || lower.includes("head") || lower.includes("director");
}
