import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Routes where the button is hidden (short pages with no scroll need)
const HIDDEN_ROUTES = ["/auth", "/reset-password", "/install-app", "/admin/login"];

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();

  const isHidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    if (isHidden) {
      setVisible(false);
      return;
    }
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHidden]);

  if (isHidden) return null;

  return (
    <Button
      size="icon"
      variant="secondary"
      className={cn(
        "fixed bottom-6 right-6 z-50 rounded-full shadow-lg transition-all duration-300",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Retour en haut"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
