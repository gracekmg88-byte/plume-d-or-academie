const ENTRY_SCROLL_PREFIX = "scroll:entry:";
const PATH_SCROLL_PREFIX = "scroll:path:";

export function getCurrentHistoryEntryKey() {
  const historyState = window.history.state as { key?: string } | null;
  if (typeof historyState?.key === "string" && historyState.key.length > 0) {
    return historyState.key;
  }

  return null;
}

export function saveScrollPosition(entryKey?: string, pathname?: string, y = window.scrollY) {
  const value = String(Math.max(0, Math.round(y)));

  if (entryKey) {
    sessionStorage.setItem(`${ENTRY_SCROLL_PREFIX}${entryKey}`, value);
  }

  if (pathname) {
    sessionStorage.setItem(`${PATH_SCROLL_PREFIX}${pathname}`, value);
  }

  if (typeof window.history.replaceState === "function") {
    const currentState = window.history.state ?? {};
    window.history.replaceState({ ...currentState, __scrollY: Number(value) }, "", window.location.href);
  }
}

export function getSavedScrollPosition(entryKey?: string, pathname?: string) {
  const historyState = window.history.state as { __scrollY?: number } | null;
  const fromHistory = typeof historyState?.__scrollY === "number" ? historyState.__scrollY : null;
  if (entryKey) {
    const byEntry = sessionStorage.getItem(`${ENTRY_SCROLL_PREFIX}${entryKey}`);
    if (byEntry) {
      const entryValue = Number.parseInt(byEntry, 10) || 0;
      if (entryValue > 0 || fromHistory === null) {
        return entryValue;
      }
    }
  }

  if (pathname) {
    const byPath = sessionStorage.getItem(`${PATH_SCROLL_PREFIX}${pathname}`);
    if (byPath) {
      const pathValue = Number.parseInt(byPath, 10) || 0;
      if (pathValue > 0 || fromHistory === null) {
        return pathValue;
      }
    }
  }

  if (fromHistory !== null) {
    return fromHistory;
  }

  return 0;
}