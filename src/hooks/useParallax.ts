import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Subtle parallax effect: the background image moves slower than scroll.
 * Returns a ref to attach to the section and a transform style for the image.
 */
export function useParallax(speed = 0.35) {
  const sectionRef = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      const el = sectionRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        // Only calculate when section is in viewport
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          setOffset(rect.top * speed);
        }
      }
      ticking.current = false;
    });
  }, [speed]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // initial position
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const imgStyle: React.CSSProperties = {
    transform: `translateY(${offset}px) scale(1.15)`,
    willChange: "transform",
  };

  return { sectionRef, imgStyle };
}
