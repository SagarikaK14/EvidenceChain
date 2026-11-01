import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("EvidenceChain Component ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="view-container" style={{ padding: "40px 24px" }}>
          <div
            className="doc-panel"
            style={{
              maxWidth: "680px",
              margin: "40px auto",
              border: "2px solid #E05252",
              padding: "24px",
              backgroundColor: "var(--surface-primary, #FFFFFF)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "#FDE8E8",
                  color: "#E05252",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "18px",
                }}
              >
                !
              </div>
              <div>
                <span className="case-docket-tag" style={{ background: "#FDE8E8", color: "#C81E1E" }}>
                  COMPONENT RECOVERY PROTOCOL
                </span>
                <h2 style={{ fontSize: "16px", margin: "4px 0 0 0", color: "var(--text-primary, #111827)" }}>
                  Evidentiary View Rendering Exception
                </h2>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.5 }}>
              A rendering exception occurred in this forensic sub-module. The application session remains secure, and
              protected chain-of-custody data is unmodified.
            </p>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: "#FAF9F6",
                  border: "1px solid var(--border-color, #E5E7EB)",
                  borderRadius: "4px",
                  padding: "10px 14px",
                  margin: "16px 0",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "11px",
                  color: "#991B1B",
                  overflowX: "auto",
                }}
              >
                <strong>Exception:</strong> {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn-tactile-primary"
                onClick={this.handleReset}
                style={{ fontSize: "12px", padding: "8px 16px" }}
              >
                Reload Component
              </button>
              <button
                type="button"
                className="btn-tactile-secondary"
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  if (typeof window !== "undefined") {
                    window.location.hash = "#dashboard";
                    window.location.reload();
                  }
                }}
                style={{ fontSize: "12px", padding: "8px 16px" }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
