// ============================================================
// EvidenceChain Unified IST (Asia/Kolkata, UTC+05:30) Formatter
// Keeps backend/stored timestamps in UTC, formats in IST for display
// ============================================================

/**
 * Safely parse any date/timestamp representation.
 * Handles:
 *  - Unix epoch in seconds (e.g. 1793582400 or "1793582400")
 *  - Unix epoch in milliseconds
 *  - ISO-8601 strings (e.g. "2026-11-02T00:55:36Z")
 *  - SQLite datetime strings (e.g. "2026-10-13 17:47:09", assumed UTC)
 *  - Date instances
 */
export function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === "number") {
    return new Date(val < 1e11 ? val * 1000 : val);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      return new Date(num < 1e11 ? num * 1000 : num);
    }
    // SQLite UTC format: YYYY-MM-DD HH:MM:SS
    let iso = trimmed.replace(" ", "T");
    if (!iso.endsWith("Z") && !iso.includes("+") && !iso.slice(10).includes("-")) {
      iso += "Z";
    }
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format a date/timestamp to standard IST format:
 * Example: "02 Nov 2026, 12:53 AM IST" (or with seconds: "02 Nov 2026, 12:53:20 AM IST")
 */
export function formatISTDateTime(val, includeSeconds = false) {
  const d = parseDate(val);
  if (!d) return "—";

  try {
    const options = {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    if (includeSeconds) {
      options.second = "2-digit";
    }

    const formatter = new Intl.DateTimeFormat("en-IN", options);
    const parts = formatter.formatToParts(d);
    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const timeStr = includeSeconds
      ? `${map.hour}:${map.minute}:${map.second} ${map.dayPeriod.toUpperCase()}`
      : `${map.hour}:${map.minute} ${map.dayPeriod.toUpperCase()}`;

    return `${map.day} ${map.month} ${map.year}, ${timeStr} IST`;
  } catch {
    return d.toUTCString();
  }
}

/**
 * Format current time in IST for live custody clock.
 * Example: "02 Nov 2026, 12:53:45 AM IST"
 */
export function getLiveISTClockString(date = new Date()) {
  return formatISTDateTime(date, true);
}
