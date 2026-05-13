const ENTRY_SCROLL_PREFIX = "scroll:entry:";
const PATH_SCROLL_PREFIX = "scroll:path:";

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
  if (typeof historyState?.__scrollY === "number") {
    return historyState.__scrollY;
  }

  if (entryKey) {
    const byEntry = sessionStorage.getItem(`${ENTRY_SCROLL_PREFIX}${entryKey}`);
    if (byEntry) {
      return Number.parseInt(byEntry, 10) || 0;
    }
  }

  if (pathname) {
    const byPath = sessionStorage.getItem(`${PATH_SCROLL_PREFIX}${pathname}`);
    if (byPath) {
      return Number.parseInt(byPath, 10) || 0;
    }
  }

  return 0;
}