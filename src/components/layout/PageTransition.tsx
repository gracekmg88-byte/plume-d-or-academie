import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [transitionState, setTransitionState] = useState<"preparing" | "enter">("enter");

  useEffect(() => {
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
  }, [routeKey]);

  return (
    <div className={`page-transition-root page-transition-${transitionState}`}>
      {children}
    </div>
  );
}
