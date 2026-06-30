import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

// Only these routes get the smooth title transition.
const ANIMATED_ROUTES = new Set<string>([
  "/",
  "/bibliotheque",
  "/a-propos",
  "/contact",
]);

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const animated = ANIMATED_ROUTES.has(location.pathname);
  // Start directly in "enter" so the animation plays immediately on mount,
  // in sync with the page's background/images — no preparing delay.
  const [state, setState] = useState<"enter">("enter");

  useEffect(() => {
    if (!animated) return;
    // Force a re-trigger of the CSS animation on route change by toggling
    // the class off then on within the same frame.
    setState("enter");
  }, [routeKey, animated]);

  if (!animated) {
    return <div className="page-transition-root">{children}</div>;
  }

  return (
    <div
      key={routeKey}
      className={`page-transition-root page-transition-${state}`}
    >
      {children}
    </div>
  );
}
