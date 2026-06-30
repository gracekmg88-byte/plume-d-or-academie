import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [animatedRoute, setAnimatedRoute] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    let cancelled = false;

    setAnimatedRoute(null);

    const startAnimation = () => {
      if (cancelled) return;

      if (document.documentElement.classList.contains("route-visual-hold")) {
        timeout = window.setTimeout(startAnimation, 40);
        return;
      }

      setAnimatedRoute(routeKey);
    };

    frame = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(startAnimation, 120);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [routeKey]);

  return (
    <div
      key={routeKey}
      className={animatedRoute === routeKey ? "page-transition-root page-transition-enter" : "page-transition-root"}
    >
      {children}
    </div>
  );
}
