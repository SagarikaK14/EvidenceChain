// ============================================================
// EvidenceChain — Deterministic Cryptographic Visual Fingerprint
// Procedurally generates an immutable geometric cryptographic glyph
// uniquely seeded by the 64-character SHA-256 artifact digest.
// ============================================================

import { useMemo } from "react";

export function CryptographicFingerprint({ hash, size = 180, showMeta = true, label = "Cryptographic Visual Seal" }) {
  const fingerprintData = useMemo(() => {
    const rawHash = (hash || "0000000000000000000000000000000000000000000000000000000000000000").replace(/^0x/, "");
    const cleanHash = rawHash.padEnd(64, "0").slice(0, 64);

    // Slice into eight 8-char byte segments (32-bit integers)
    const segments = [];
    for (let i = 0; i < 8; i++) {
      const chunk = cleanHash.slice(i * 8, (i + 1) * 8);
      segments.push(parseInt(chunk, 16) || 0);
    }

    // Determine algorithmic characteristics
    const primaryHue = (segments[0] % 40) + 160; // Teal/Verdigris range (160 - 200)
    const secondaryHue = (segments[1] % 30) + 38; // Gold/Ochre range (38 - 68)
    const symmetryRings = (segments[2] % 3) + 3; // 3 to 5 concentric rings
    const spokeCount = [8, 12, 16][segments[3] % 3]; // 8, 12, or 16 radial spokes

    // Generate concentric ring nodes
    const rings = [];
    const center = size / 2;
    const maxRadius = center - 18;

    for (let r = 0; r < symmetryRings; r++) {
      const radius = ((r + 1) / symmetryRings) * maxRadius;
      const ringSegments = (segments[r % segments.length] % 6) + 4;
      const strokeWidth = (segments[(r + 2) % segments.length] % 2 === 0 ? 1.5 : 1);
      const isDashed = segments[(r + 1) % segments.length] % 2 === 0;

      const nodes = [];
      for (let s = 0; s < ringSegments; s++) {
        const angle = (s * 2 * Math.PI) / ringSegments + (r * Math.PI) / 8;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        nodes.push({ x, y });
      }

      rings.push({
        radius,
        strokeWidth,
        isDashed,
        dashArray: isDashed ? `${(segments[r] % 4) + 2} ${(segments[r + 1] % 4) + 3}` : "none",
        nodes,
      });
    }

    // Generate core geometric emblem
    const coreSides = (segments[4] % 4) + 3; // 3 to 6 sides polygon
    const coreRadius = 14 + (segments[5] % 8);
    const corePoints = [];
    for (let c = 0; c < coreSides; c++) {
      const angle = (c * 2 * Math.PI) / coreSides - Math.PI / 2;
      corePoints.push(`${center + coreRadius * Math.cos(angle)},${center + coreRadius * Math.sin(angle)}`);
    }

    return {
      cleanHash,
      primaryColor: `hsl(${primaryHue}, 48%, 32%)`,
      secondaryColor: `hsl(${secondaryHue}, 58%, 52%)`,
      accentColor: `hsl(${primaryHue}, 65%, 44%)`,
      rings,
      corePoints: corePoints.join(" "),
      center,
      spokeCount,
      quadrantA: cleanHash.slice(0, 4).toUpperCase(),
      quadrantB: cleanHash.slice(60, 64).toUpperCase(),
    };
  }, [hash, size]);

  const { center, rings, corePoints, primaryColor, secondaryColor, accentColor, quadrantA, quadrantB } = fingerprintData;

  return (
    <div className="crypto-fingerprint-container" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div 
        className="crypto-fingerprint-frame"
        style={{
          width: size,
          height: size,
          position: "relative",
          background: "linear-gradient(145deg, #FAF7F2 0%, #F3EFE6 100%)",
          border: "1px solid var(--border-color)",
          borderRadius: "4px",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.03), 0 2px 8px rgba(20,37,53,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Subtle Archival Grid Background */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {/* Outer Calibration Ring */}
          <circle
            cx={center}
            cy={center}
            r={center - 6}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth="0.75"
            strokeDasharray="2 3"
          />

          {/* Precision Cardinal Hash Crosshairs */}
          <line x1={center} y1={6} x2={center} y2={size - 6} stroke="rgba(20,37,53,0.08)" strokeWidth="0.75" />
          <line x1={6} y1={center} x2={size - 6} y2={center} stroke="rgba(20,37,53,0.08)" strokeWidth="0.75" />

          {/* Concentric Forensic Rings */}
          {rings.map((ring, idx) => (
            <g key={idx}>
              <circle
                cx={center}
                cy={center}
                r={ring.radius}
                fill="none"
                stroke={idx % 2 === 0 ? primaryColor : secondaryColor}
                strokeWidth={ring.strokeWidth}
                strokeDasharray={ring.dashArray}
                opacity={0.7}
              />
              {/* Nodes along ring */}
              {ring.nodes.map((node, nIdx) => (
                <circle
                  key={nIdx}
                  cx={node.x}
                  cy={node.y}
                  r={idx === rings.length - 1 ? 2.5 : 1.75}
                  fill={idx % 2 === 0 ? primaryColor : secondaryColor}
                  opacity={0.85}
                />
              ))}
            </g>
          ))}

          {/* Core Procedural Emblem */}
          <polygon
            points={corePoints}
            fill={accentColor}
            fillOpacity="0.12"
            stroke={primaryColor}
            strokeWidth="1.5"
          />
          <circle cx={center} cy={center} r={4} fill={primaryColor} />
          <circle cx={center} cy={center} r={1.5} fill="#FAF7F2" />
        </svg>

        {/* Quadrant Micro-Stamps */}
        <span
          style={{
            position: "absolute",
            top: "6px",
            left: "8px",
            fontFamily: "var(--font-mono)",
            fontSize: "8.5px",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
          }}
        >
          Q1:{quadrantA}
        </span>
        <span
          style={{
            position: "absolute",
            bottom: "6px",
            right: "8px",
            fontFamily: "var(--font-mono)",
            fontSize: "8.5px",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
          }}
        >
          Q4:{quadrantB}
        </span>
      </div>

      {showMeta && (
        <div style={{ marginTop: "8px", textAlign: "center", maxWidth: "260px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {label}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Deterministic Visual Seal &bull; Procedurally Derived from Digest
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8.5px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.3 }}>
            Visual motif only. Legal integrity is proven exclusively by 64-char bitwise hash verification.
          </div>
        </div>
      )}
    </div>
  );
}
