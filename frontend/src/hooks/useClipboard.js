import { useState, useCallback } from "react";

/**
 * useClipboard Hook
 * Provides reusable, accessible clipboard copying with automatic timeout reset.
 *
 * @param {number} resetTimeout - Milliseconds before resetting copied status (default 1400)
 * @returns {{ copiedId: string, copy: (id: string, text: string, event?: Event) => Promise<boolean> }}
 */
export function useClipboard(resetTimeout = 1400) {
  const [copiedId, setCopiedId] = useState("");

  const copy = useCallback(
    async (id, text, event) => {
      if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      if (!text) return false;

      try {
        await navigator.clipboard.writeText(String(text));
        setCopiedId(id);
        setTimeout(() => {
          setCopiedId("");
        }, resetTimeout);
        return true;
      } catch (err) {
        console.warn("Clipboard copy failed:", err);
        return false;
      }
    },
    [resetTimeout]
  );

  return { copiedId, copy };
}
