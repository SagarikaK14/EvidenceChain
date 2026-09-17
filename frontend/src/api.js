// ============================================================
// EvidenceChain REST API
// React → Flask Backend → Blockchain
// ============================================================

const API_BASE_URL = "http://127.0.0.1:5001";


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

    throw new Error(
      data.message ||
      "Request failed."
    );
  }

  return data;
}


// ============================================================
// HEALTH CHECK
// ============================================================

export async function checkBackendHealth() {

  const response = await fetch(
    `${API_BASE_URL}/api/health`
  );

  return parseResponse(response);
}


// ============================================================
// REGISTER EVIDENCE
// ============================================================

export async function registerEvidenceAPI(
  file,
  caseId,
  description = ""
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

  const response = await fetch(
    `${API_BASE_URL}/api/evidence/register`,
    {
      method: "POST",
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
  userAddress
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

      body: JSON.stringify({
        userAddress,
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
  userAddress
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

      body: JSON.stringify({
        userAddress,
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
  userAddress
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

      body: JSON.stringify({
        userAddress,
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
  userAddress
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

      body: JSON.stringify({
        userAddress,
      }),
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
    )}/access-history`
  );

  return parseResponse(response);
}