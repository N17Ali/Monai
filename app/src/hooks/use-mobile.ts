import * as React from "react";

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => !window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}
