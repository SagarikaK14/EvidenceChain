// ============================================================
// EvidenceChain REST API
// React → Flask Backend → Blockchain
// ============================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5001"
    : "";


// ============================================================
// HELPER
// ============================================================

async function parseResponse(response) {

  const text = await response.text();

  let data;

  try {

    data = text
      ? JSON.parse(text)
      : {};

  } catch {

    data = {

      message:
        text ||
        "Unexpected server response."
    };
  }

  if (!response.ok) {

    const error = new Error(
      data.message ||
      "Request failed."
    );
    error.code = data.code;
    error.status = response.status;
    error.data = data;
    error.onChain = data.onChain;
    throw error;
  }

  return data;
}


// ============================================================
// HEALTH & DIAGNOSTICS CHECK
// ============================================================

export async function checkBackendHealth() {
  const response = await fetch(
    `${API_BASE_URL}/api/health`,
    { credentials: "include" }
  );
  return parseResponse(response);
}

export async function getDiagnosticsSummaryAPI() {
  const response = await fetch(`${API_BASE_URL}/api/diagnostics/summary`, {
    method: "GET",
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getLedgerConsistencyAPI() {
  const response = await fetch(`${API_BASE_URL}/api/diagnostics/consistency`, {
    method: "GET",
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getTechnicalDiagnosticsAPI() {
  const response = await fetch(`${API_BASE_URL}/api/diagnostics/technical`, {
    method: "GET",
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getDevelopmentToolsAPI() {
  const response = await fetch(`${API_BASE_URL}/api/diagnostics/dev-tools`, {
    method: "GET",
    credentials: "include",
  });
  return parseResponse(response);
}

export async function pingRPCAPI() {
  const response = await fetch(`${API_BASE_URL}/api/diagnostics/ping-rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  return parseResponse(response);
}


// ============================================================
// AUTHENTICATION & SESSION MANAGEMENT API
// ============================================================

export async function loginAPI(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return parseResponse(response);
}

export async function verifyMfaAPI(challengeId, otp) {
  const response = await fetch(`${API_BASE_URL}/api/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ challengeId, otp }),
  });
  return parseResponse(response);
}

export async function resendMfaAPI(challengeId) {
  const response = await fetch(`${API_BASE_URL}/api/auth/mfa/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ challengeId }),
  });
  return parseResponse(response);
}

export async function getMeAPI() {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });
  if (response.status === 401) {
    return { status: "unauthenticated", user: null };
  }
  return parseResponse(response);
}

export async function logoutAPI() {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  return parseResponse(response);
}

export async function demoLoginAPI(emailOrPersona) {
  const payload =
    typeof emailOrPersona === "string" && emailOrPersona.includes("@")
      ? { email: emailOrPersona }
      : { persona: emailOrPersona };
  const response = await fetch(`${API_BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function getDemoProfilesAPI() {
  const response = await fetch(`${API_BASE_URL}/api/auth/demo-profiles`, {
    method: "GET",
    credentials: "include",
  });
  return parseResponse(response);
}

export async function demoSwitchAPI(targetEmail) {
  const response = await fetch(`${API_BASE_URL}/api/auth/demo-switch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email: targetEmail }),
  });
  return parseResponse(response);
}


// ============================================================
// LIST EVIDENCE
// ============================================================

export async function listEvidenceAPI() {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence`
  );

  return parseResponse(response);
}


// ============================================================
// REGISTER EVIDENCE
// ============================================================

export async function registerEvidenceAPI(
  file,
  caseId,
  description = "",
  clientHash = ""
) {

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "caseId",
    caseId
  );

  if (description) {

    formData.append(
      "description",
      description
    );
  }

  if (clientHash) {

    formData.append(
      "clientHash",
      clientHash
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/register`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );

  return parseResponse(response);
}


// ============================================================
// GET EVIDENCE
// ============================================================

export async function getEvidenceAPI(
  evidenceId
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}`
  );

  return parseResponse(response);
}


// ============================================================
// VERIFY EVIDENCE
// ============================================================

export async function verifyEvidenceAPI(
  evidenceId,
  currentHash
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/verify`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        currentHash,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// CHECK VIEW ACCESS
// ============================================================

export async function checkViewAccessAPI(
  evidenceId,
  userAddress
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/view-access`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",

      body: JSON.stringify({
        userAddress,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// CHECK DOWNLOAD ACCESS
// ============================================================

export async function checkDownloadAccessAPI(
  evidenceId,
  userAddress
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/download-access`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",

      body: JSON.stringify({
        userAddress,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// GRANT VIEW ACCESS
// ============================================================

export async function grantViewAccessAPI(
  evidenceId,
  userAddress,
  adminAddress = "",
  caseId = "",
  targetName = ""
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/view-access/grant`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",

      body: JSON.stringify({
        userAddress,
        adminAddress,
        caseId,
        targetName,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// REVOKE VIEW ACCESS
// ============================================================

export async function revokeViewAccessAPI(
  evidenceId,
  userAddress,
  adminAddress = "",
  caseId = "",
  targetName = ""
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/view-access/revoke`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",

      body: JSON.stringify({
        userAddress,
        adminAddress,
        caseId,
        targetName,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// GRANT DOWNLOAD ACCESS
// ============================================================

export async function grantDownloadAccessAPI(
  evidenceId,
  userAddress,
  adminAddress = "",
  caseId = "",
  targetName = ""
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/download-access/grant`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",

      body: JSON.stringify({
        userAddress,
        adminAddress,
        caseId,
        targetName,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// REVOKE DOWNLOAD ACCESS
// ============================================================

export async function revokeDownloadAccessAPI(
  evidenceId,
  userAddress,
  adminAddress = "",
  caseId = "",
  targetName = ""
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/download-access/revoke`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",

      body: JSON.stringify({
        userAddress,
        adminAddress,
        caseId,
        targetName,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// DEPARTMENT COMMAND & ACCESS CONTROL API
// ============================================================

export async function getDepartmentHODAPI() {
  const response = await fetch(`${API_BASE_URL}/api/department/hod`, {
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getDepartmentMembersAPI() {
  const response = await fetch(`${API_BASE_URL}/api/department/members`, {
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getOfficersAPI() {
  const response = await fetch(`${API_BASE_URL}/api/officers`, {
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getDepartmentCasesAPI() {
  const response = await fetch(`${API_BASE_URL}/api/department/cases`, {
    credentials: "include",
  });
  return parseResponse(response);
}

export async function getDepartmentCaseEvidenceAPI(caseId) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/case-evidence?caseId=${encodeURIComponent(caseId)}`,
    {
      credentials: "include",
    }
  );
  return parseResponse(response);
}

export async function getDepartmentEvidencePermissionsAPI(evidenceId) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/evidence-permissions?evidenceId=${encodeURIComponent(evidenceId)}`,
    {
      credentials: "include",
    }
  );
  return parseResponse(response);
}

export async function getPermissionsMatrixAPI() {
  const response = await fetch(`${API_BASE_URL}/api/department/permissions-matrix`, {
    credentials: "include",
  });
  return parseResponse(response);
}

export async function changeDepartmentPermissionAPI({
  adminAddress,
  targetAddress,
  evidenceId,
  permissionType,
  action,
  targetName = "",
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/permissions/change`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        adminAddress,
        targetAddress,
        evidenceId,
        permissionType,
        action,
        targetName,
      }),
    }
  );
  return parseResponse(response);
}

export async function getDepartmentAuditLogAPI() {
  const response = await fetch(`${API_BASE_URL}/api/department/audit-log`);
  return parseResponse(response);
}

// ============================================================
// CASE-WISE ORGANIZATIONAL HIERARCHY APIS
// ============================================================

export async function getCaseHierarchyAPI(caseId) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/case-hierarchy?caseId=${encodeURIComponent(caseId)}`,
    {
      credentials: "include",
    }
  );
  return parseResponse(response);
}

export async function getDepartmentPersonnelAPI() {
  const response = await fetch(`${API_BASE_URL}/api/department/personnel`, {
    credentials: "include",
  });
  return parseResponse(response);
}

export async function createCaseAssignmentAPI({
  caseId,
  userId,
  caseRole,
  reportsToAssignmentId = null,
  responsibilities = "",
}) {
  const response = await fetch(`${API_BASE_URL}/api/department/case-assignments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      caseId,
      userId,
      caseRole,
      reportsToAssignmentId,
      responsibilities,
    }),
  });
  return parseResponse(response);
}

export async function updateCaseAssignmentAPI(
  assignmentId,
  { caseId, caseRole, reportsToAssignmentId = null, responsibilities = "" }
) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/case-assignments/${encodeURIComponent(assignmentId)}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        caseId,
        caseRole,
        reportsToAssignmentId,
        responsibilities,
      }),
    }
  );
  return parseResponse(response);
}

export async function removeCaseAssignmentAPI(assignmentId, caseId) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/case-assignments/${encodeURIComponent(assignmentId)}/remove`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        caseId,
      }),
    }
  );
  return parseResponse(response);
}

export async function getCaseHierarchyAuditLogAPI(caseId) {
  const response = await fetch(
    `${API_BASE_URL}/api/department/case-hierarchy/audit-log?caseId=${encodeURIComponent(caseId)}`,
    {
      credentials: "include",
    }
  );
  return parseResponse(response);
}


// ============================================================
// RECORD EVIDENCE ACCESS
// ============================================================

export async function recordAccessAPI(
  evidenceId,
  action
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/access`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        action,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// GET ACCESS HISTORY
// ============================================================

export async function getAccessHistoryAPI(
  evidenceId
) {

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/${encodeURIComponent(
      evidenceId
    )}/access-history`,
    { credentials: "include" }
  );

  return parseResponse(response);
}