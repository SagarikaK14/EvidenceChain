// ============================================================
// EvidenceChain Accessible Toast Notification Component
// Forensic Institutional Feedback System
// ============================================================

export function Toast({ toast, onClose }) {
  if (!toast || !toast.message) return null;

  const typeStyles = {
    success: {
      borderLeft: "4px solid var(--green-institutional)",
      color: "var(--green-deep)",
      title: "OPERATION CONFIRMED",
    },
    error: {
      borderLeft: "4px solid var(--red-restrained)",
      color: "var(--red-restrained)",
      title: "SECURITY EXCEPTION / ERROR",
    },
    warning: {
      borderLeft: "4px solid var(--ochre-archival)",
      color: "var(--ochre-archival)",
      title: "AUTHORIZATION WARNING",
    },
    info: {
      borderLeft: "4px solid var(--blue-grey)",
      color: "var(--blue-grey)",
      title: "FORENSIC SYSTEM TELEMETRY",
    },
  };

  const style = typeStyles[toast.type] || typeStyles.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        minWidth: "320px",
        maxWidth: "460px",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-color)",
        borderLeft: style.borderLeft,
        padding: "14px 18px",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            color: style.color,
            letterSpacing: "0.05em",
          }}
        >
          {toast.title || style.title}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              color: "var(--text-muted)",
              padding: "0 4px",
            }}
            aria-label="Dismiss Notification"
          >
            ×
          </button>
        )}
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
        {toast.message}
      </div>
      {toast.txHash && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
          Tx: {toast.txHash.slice(0, 10)}...{toast.txHash.slice(-8)}
        </div>
      )}
    </div>
  );
}
