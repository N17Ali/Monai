import { useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}
