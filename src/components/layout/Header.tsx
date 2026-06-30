import { useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, BookOpen, Feather, User, LogIn, Crown, Sun, Moon, Globe, MessageCircle, Download } from "lucide-react";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingConfig } from "@/hooks/useBillingConfig";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ensureNavigationReady } from "@/lib/route-preload";
import { getCurrentHistoryEntryKey, saveScrollPosition } from "@/lib/scroll-restoration";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { isPremium } = useSubscription();
  const { hidePremiumUI } = useBillingConfig();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const capacitorBridge = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  const isNativeApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    capacitorBridge.Capacitor?.isNativePlatform?.();

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/bibliotheque", label: t("nav.library") },
    { href: "/depot-memoire", label: "Déposer" },
    { href: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { href: "/a-propos", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
    ...(!isNativeApp ? [{ href: "/installer", label: t("nav.install"), icon: Download }] : []),
  ];

  const handleInternalNavigation = async (href: string, event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    if (href === `${location.pathname}${location.search}`) {
      setMobileMenuOpen(false);
      return;
    }
    saveScrollPosition(getCurrentHistoryEntryKey(), `${location.pathname}${location.search}`, window.scrollY);
    await ensureNavigationReady(href);
    flushSync(() => {
      setMobileMenuOpen(false);
      navigate(href);
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between gap-2 md:h-20">
        {/* Logo */}
        <Link to="/" onClick={(event) => handleInternalNavigation("/", event)} className="flex items-center gap-2 group min-w-0 flex-shrink">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <Feather className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-serif text-base font-bold leading-tight text-foreground truncate sm:text-lg md:text-xl">
              KMG Bibliothèque
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:inline">
              KMG
            </span>
          </div>
        </Link>


        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={(event) => handleInternalNavigation(link.href, event)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors rounded-md",
                location.pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {link.label}
              {location.pathname === link.href && (
                <span className="absolute inset-x-4 -bottom-px h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          ))}
        </nav>

        {/* User Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
            className="h-9 w-9"
            title={language === "fr" ? "Switch to English" : "Passer en français"}
          >
            <Globe className="h-4 w-4" />
            <span className="sr-only">{language === "fr" ? "EN" : "FR"}</span>
          </Button>
          <span className="text-xs font-medium text-muted-foreground uppercase">{language}</span>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <>
              <NotificationCenter />
              <Link to="/profil" onClick={(event) => handleInternalNavigation("/profil", event)}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  {t("nav.profile")}
                  {!hidePremiumUI && isPremium && (
                    <Crown className="h-3 w-3 text-primary" />
                  )}
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/admin/dashboard" onClick={(event) => handleInternalNavigation("/admin/dashboard", event)}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    {t("nav.admin")}
                  </Button>
                </Link>
              )}
            </>
          ) : (
              <Link to="/auth" onClick={(event) => handleInternalNavigation("/auth", event)}>
              <Button variant="ghost" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                {t("nav.login")}
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setLanguage(language === "fr" ? "en" : "fr")} className="h-9 w-9">
            <Globe className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && <NotificationCenter />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={(event) => handleInternalNavigation(link.href, event)}
                className={cn(
                  "block px-4 py-3 rounded-lg text-base font-medium transition-colors",
                  location.pathname === link.href
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-border pt-4 mt-4 space-y-1">
              {user ? (
                <>
                  <Link
                    to="/profil"
                    onClick={(event) => handleInternalNavigation("/profil", event)}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <User className="h-4 w-4" />
                    {t("nav.myProfile")}
                    {!hidePremiumUI && isPremium && <Crown className="h-3 w-3 text-primary ml-auto" />}
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin/dashboard"
                      onClick={(event) => handleInternalNavigation("/admin/dashboard", event)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <BookOpen className="h-4 w-4" />
                      {t("nav.administration")}
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={(event) => handleInternalNavigation("/auth", event)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <LogIn className="h-4 w-4" />
                  {t("nav.login")}
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
