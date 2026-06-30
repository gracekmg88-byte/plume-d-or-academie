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
  const [transitionState, setTransitionState] = useState<"preparing" | "enter">(
    animated ? "preparing" : "enter"
  );

  useEffect(() => {
    if (!animated) {
      setTransitionState("enter");
      return;
    }

    let frame = 0;
    let timeout = 0;
    let cancelled = false;

    setTransitionState("preparing");

    const startAnimation = () => {
      if (cancelled) return;
      if (document.documentElement.classList.contains("route-visual-hold")) {
        timeout = window.setTimeout(startAnimation, 40);
        return;
      }
      setTransitionState("enter");
    };

    frame = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(startAnimation, 40);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [routeKey, animated]);

  if (!animated) {
    return <div className="page-transition-root">{children}</div>;
  }

  return (
    <div className={`page-transition-root page-transition-${transitionState}`}>
      {children}
    </div>
  );
}
