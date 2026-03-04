import { useState, useEffect } from "react";
import { X, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "plume-theme-suggestion-date";

export function ThemeSuggestionBanner() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if already shown today
    const lastShown = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toDateString();
    if (lastShown === today) return;

    const hour = new Date().getHours();
    const isNight = hour >= 18 || hour < 6;
    const suggestedTheme = isNight ? "dark" : "light";

    // Don't show if already in the right mode
    if (theme === suggestedTheme) return;

    // Show after 3 seconds
    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setShow(true));
    }, 3000);

    return () => clearTimeout(timer);
  }, [theme]);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, new Date().toDateString());
    setTimeout(() => setVisible(false), 300);
  };

  const activate = () => {
    toggleTheme();
    dismiss();
  };

  if (!visible) return null;

  const hour = new Date().getHours();
  const isNight = hour >= 18 || hour < 6;

  return (
    <div
      className={cn(
        "fixed top-20 right-4 z-50 max-w-sm rounded-xl border border-border bg-card p-4 shadow-elegant transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {isNight ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">
            {isNight ? t("theme.nightSuggestion") : t("theme.daySuggestion")}
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={activate} className="h-7 text-xs px-3">
              {t("theme.activate")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} className="h-7 text-xs px-3 text-muted-foreground">
              {t("theme.dismiss")}
            </Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
