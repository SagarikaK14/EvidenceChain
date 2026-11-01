// ============================================================
// EvidenceChain Centralized Status & Provenance Label Mapping
// Product-First Presentation of Evidence Registration & Integrity Status
// Truthful, Forensic Terminology without Blockchain Jargon
// ============================================================

/**
 * Evaluates an evidence item's canonical registration status.
 * @param {Object} item Evidence record (from list or details API)
 * @returns {'ACTIVE' | 'HISTORICAL' | 'UNCONFIRMED'}
 */
export function getEvidenceStatusCode(item) {
  if (!item) return "UNCONFIRMED";

  const isOnChain = Boolean(
    item.isOnChain === true ||
    item.blockchain?.isOnChain === true ||
    item.ledgerStatus === "VERIFIED_ACTIVE" ||
    (item.blockchain?.exists === true && !item.blockchain?.isHistorical)
  );

  if (isOnChain) return "ACTIVE";

  const isHistorical = Boolean(
    item.isHistorical === true ||
    item.blockchain?.isHistorical === true ||
    item.ledgerStatus === "HISTORICAL_RECORD" ||
    Boolean(item.metadata?.registrationTxHash || item.blockchainEvidenceId || item.registrationTxHash || item.blockchain_tx_hash)
  );

  if (isHistorical) return "HISTORICAL";

  return "UNCONFIRMED";
}

/**
 * Returns product-first status descriptor for UI rendering.
 * @param {Object} item Evidence record
 */
export function getEvidenceStatus(item) {
  const code = getEvidenceStatusCode(item);

  switch (code) {
    case "ACTIVE":
      return {
        code: "ACTIVE",
        label: "Verified Registration",
        shortLabel: "Verified",
        pillClass: "badge-clean badge-verified",
        badgeStyle: {
          backgroundColor: "#E8F5E9",
          color: "#1E6B52",
          border: "1px solid #C8E6C9",
          fontWeight: 600,
        },
        dotColor: "#1E6B52",
        summary: "Actively registered and verified on the current system ledger.",
        detailsText:
          "This evidence record is anchored on the current active ledger and has passed continuous integrity reconciliation.",
        isVerified: true,
      };

    case "HISTORICAL":
      return {
        code: "HISTORICAL",
        label: "Historical Registration",
        shortLabel: "Historical",
        pillClass: "badge-clean badge-historical",
        badgeStyle: {
          backgroundColor: "#FDF8F0",
          color: "#8A6D3B",
          border: "1px solid #E6D8BA",
          fontWeight: 600,
        },
        dotColor: "#8A6D3B",
        summary: "Recorded in previous ledger environment • Not verified on current active ledger.",
        detailsText:
          "This evidence has a registration record from a previous ledger environment. Its registration has not been verified on the current system ledger.",
        isVerified: false,
      };

    case "UNCONFIRMED":
    default:
      return {
        code: "UNCONFIRMED",
        label: "Registration Not Confirmed",
        shortLabel: "Unconfirmed",
        pillClass: "badge-clean badge-neutral",
        badgeStyle: {
          backgroundColor: "#F1F5F9",
          color: "#475569",
          border: "1px solid #CBD5E1",
          fontWeight: 600,
        },
        dotColor: "#64748B",
        summary: "Catalogued in local database • Verification ledger unconfirmed.",
        detailsText:
          "This evidence was catalogued in the system database, but its registration on the verification ledger has not been confirmed.",
        isVerified: false,
      };
  }
}
