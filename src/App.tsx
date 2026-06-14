import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";

import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { warmUpCache } from "@/lib/image-cache";
import { PushNotificationInit } from "@/components/PushNotificationInit";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { getSavedScrollPosition, saveScrollPosition } from "@/lib/scroll-restoration";
import {
  loadAProposPage,
  loadAbonnementPage,
  loadAdminDashboardPage,
  loadAdminDevicesPage,
  loadAdminLoginPage,
  loadAdminMessagesPage,
  loadAdminSettingsPage,
  loadAdminSubmissionsPage,
  loadAdminUsersPage,
  loadAuthPage,
  loadBibliothequePage,
  loadChatPage,
  loadContactPage,
  loadDepotMemoirePage,
  loadInstallAppPage,
  loadNotFoundPage,
  loadProfilPage,
  loadPublicationFormPage,
  loadPublicationPage,
  loadResetPasswordPage,
  preloadCommonRoutes,
} from "@/lib/route-preload";

// Eager-load the home page for instant first paint
import Index from "./pages/Index";

// Lazy-load all other pages for code-splitting
const Bibliotheque = lazy(loadBibliothequePage);
const Publication = lazy(loadPublicationPage);
const APropos = lazy(loadAProposPage);
const Contact = lazy(loadContactPage);
const Auth = lazy(loadAuthPage);
const ResetPassword = lazy(loadResetPasswordPage);
const Profil = lazy(loadProfilPage);
const Abonnement = lazy(loadAbonnementPage);
const AdminLogin = lazy(loadAdminLoginPage);
const AdminDashboard = lazy(loadAdminDashboardPage);
const AdminMessages = lazy(loadAdminMessagesPage);
const AdminSettings = lazy(loadAdminSettingsPage);
const AdminUsers = lazy(loadAdminUsersPage);
const PublicationForm = lazy(loadPublicationFormPage);
const AdminDevices = lazy(loadAdminDevicesPage);
const AdminSubmissions = lazy(loadAdminSubmissionsPage);
const DepotMemoire = lazy(loadDepotMemoirePage);
const Chat = lazy(loadChatPage);
const InstallApp = lazy(loadInstallAppPage);
const NotFound = lazy(loadNotFoundPage);
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate"));
const VerifyHome = lazy(() => import("./pages/VerifyHome"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates"));
const AdminSeo = lazy(() => import("./pages/admin/AdminSeo"));
const Auteur = lazy(() => import("./pages/Auteur"));
const AdminAuthLogs = lazy(() => import("./pages/admin/AdminAuthLogs"));
const CatalogDiagnostic = lazy(() => import("./pages/CatalogDiagnostic"));

import { AdminGuard } from "@/components/auth/AdminGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Aggressive caching for instant back-navigation & route reuse
      staleTime: 5 * 60 * 1000, // 5 min — data is "fresh" for 5 min, no auto-refetch
      gcTime: 30 * 60 * 1000, // 30 min — keep in memory for snappy returns
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

// Pre-load image cache index at startup for instant lookups on native
warmUpCache().catch(() => {});

function ScrollManager({ location }: { location: ReturnType<typeof useLocation> }) {
  const { pathname, search, key } = location;
  const routeId = `${pathname}${search}`;
  const navType = useNavigationType();
  const prevRef = useRef({ pathname, search, key });
  const lastScrollYRef = useRef(0);
  const isRestoringRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const prev = prevRef.current;
    // Cancel any in-flight restoration
    if (cancelRestoreRef.current) {
      cancelRestoreRef.current();
      cancelRestoreRef.current = null;
    }
    prevRef.current = { pathname, search, key };

    if ((prev.pathname !== pathname || prev.search !== search || prev.key !== key) && prev.pathname) {
      saveScrollPosition(prev.key, `${prev.pathname}${prev.search}`, lastScrollYRef.current);
    }

    const navState = location.state as {
      restoredFromPublication?: boolean;
      returnKey?: string | null;
    } | null;
    const isReturnFromPublication = Boolean(navState?.restoredFromPublication);
    const shouldRestore = navType === "POP" || isReturnFromPublication;

    if (shouldRestore) {
      const restoreKey = isReturnFromPublication && navState?.returnKey ? navState.returnKey : key;
      const savedY = getSavedScrollPosition(restoreKey, routeId);

      isRestoringRef.current = true;
      if (savedY > 0) {
        let cancelled = false;
        let resizeObserver: ResizeObserver | null = null;
        let mutationObserver: MutationObserver | null = null;
        let settleTimeout: number | null = null;
        let hardTimeout: number | null = null;

        const cleanup = () => {
          if (rafRef.current !== null) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          if (settleTimeout !== null) {
            window.clearTimeout(settleTimeout);
            settleTimeout = null;
          }
          if (hardTimeout !== null) {
            window.clearTimeout(hardTimeout);
            hardTimeout = null;
          }
          resizeObserver?.disconnect();
          mutationObserver?.disconnect();
          isRestoringRef.current = false;
        };

        const scheduleAttempt = () => {
          if (cancelled) return;
          if (rafRef.current !== null) {
            window.cancelAnimationFrame(rafRef.current);
          }
          rafRef.current = window.requestAnimationFrame(() => {
            if (cancelled) return;

            const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const target = Math.min(savedY, maxScroll);

            if (Math.abs(window.scrollY - target) > 2) {
              window.scrollTo({ top: target, left: 0, behavior: "instant" as ScrollBehavior });
            }

            lastScrollYRef.current = target;

            if (maxScroll >= savedY || Math.abs(window.scrollY - target) <= 2) {
              if (settleTimeout !== null) {
                window.clearTimeout(settleTimeout);
              }
              settleTimeout = window.setTimeout(() => {
                if (!cancelled) {
                  cleanup();
                }
              }, 120);
            }
          });
        };

        scheduleAttempt();

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            scheduleAttempt();
          });
          resizeObserver.observe(document.documentElement);
          if (document.body) {
            resizeObserver.observe(document.body);
          }
        }

        if (typeof MutationObserver !== "undefined" && document.body) {
          mutationObserver = new MutationObserver(() => {
            scheduleAttempt();
          });
          mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
          });
        }

        hardTimeout = window.setTimeout(() => {
          if (!cancelled) {
            cleanup();
          }
        }, 8000);

        cancelRestoreRef.current = () => {
          cancelled = true;
          cleanup();
        };
      } else if (!isReturnFromPublication) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        lastScrollYRef.current = 0;
        isRestoringRef.current = false;
      } else {
        isRestoringRef.current = false;
      }
    } else if (prev.pathname !== pathname || prev.search !== search) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      lastScrollYRef.current = 0;
    }

    return () => {
      if (cancelRestoreRef.current) {
        cancelRestoreRef.current();
        cancelRestoreRef.current = null;
      }
    };
  }, [pathname, search, key, navType, routeId, location.state]);

  // Continuously save scroll position, but not during restoration
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      lastScrollYRef.current = window.scrollY;
      if (!isRestoringRef.current) {
        saveScrollPosition(key, routeId, window.scrollY);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [routeId, key]);

  return null;
}

function PublicationRoute() {
  const location = useLocation();

  return <Publication key={location.pathname} />;
}

function PageLoader() {
  return (
    <div className="flex min-h-screen flex-col bg-background" aria-hidden="true">
      <div className="h-16 w-full border-b border-border bg-card/80 backdrop-blur" />
      <div className="flex-1">
        <div className="container py-10 md:py-14">
          <div className="animate-pulse space-y-8">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-10 w-full max-w-xl rounded bg-muted" />
              <div className="h-4 w-full max-w-2xl rounded bg-muted" />
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-h-[320px] rounded-lg bg-muted" />
              <div className="hidden rounded-lg bg-muted md:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavigationWarmup() {
  useEffect(() => {
    preloadCommonRoutes();

    // Global prefetch: any internal <a> link warms its route bundle on
    // hover / focus / touch so the next click feels instant.
    let prefetchRouteFn: ((to: string) => void) | null = null;
    import("@/lib/route-preload").then((m) => {
      prefetchRouteFn = m.prefetchRoute;
    });

    const extractPath = (target: EventTarget | null): string | null => {
      if (!(target instanceof Element)) return null;
      const anchor = target.closest("a");
      if (!anchor) return null;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return null;
      }
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        return url.pathname;
      } catch {
        return null;
      }
    };

    const handler = (e: Event) => {
      const path = extractPath(e.target);
      if (path && prefetchRouteFn) prefetchRouteFn(path);
    };

    document.addEventListener("mouseover", handler, { passive: true });
    document.addEventListener("focusin", handler, { passive: true });
    document.addEventListener("touchstart", handler, { passive: true });

    return () => {
      document.removeEventListener("mouseover", handler);
      document.removeEventListener("focusin", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <>
      <ScrollManager location={location} />
      <ErrorBoundary resetKey={location.key}>
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/bibliotheque" element={<Bibliotheque />} />
          <Route path="/diagnostic-catalogue" element={<CatalogDiagnostic />} />
          <Route path="/publication/:id" element={<PublicationRoute />} />
          <Route path="/livre/:slug" element={<PublicationRoute />} />
          <Route path="/memoire/:slug" element={<PublicationRoute />} />
          <Route path="/tfc/:slug" element={<PublicationRoute />} />
          <Route path="/article/:slug" element={<PublicationRoute />} />
          <Route path="/auteur/:slug" element={<Auteur />} />
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/abonnement" element={<Abonnement />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/messages" element={<AdminGuard><AdminMessages /></AdminGuard>} />
          <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
          <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
          <Route path="/admin/publication/:id" element={<AdminGuard><PublicationForm /></AdminGuard>} />
          <Route path="/admin/devices" element={<AdminGuard><AdminDevices /></AdminGuard>} />
          <Route path="/admin/submissions" element={<AdminGuard><AdminSubmissions /></AdminGuard>} />
          <Route path="/depot-memoire" element={<DepotMemoire />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/installer" element={<InstallApp />} />
          <Route path="/verify/:number" element={<VerifyCertificate />} />
          <Route path="/verification" element={<VerifyHome />} />
          <Route path="/admin/certificates" element={<AdminGuard><AdminCertificates /></AdminGuard>} />
          <Route path="/admin/seo" element={<AdminGuard><AdminSeo /></AdminGuard>} />
          <Route path="/admin/auth-logs" element={<AdminGuard><AdminAuthLogs /></AdminGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PushNotificationInit />
              <BrowserRouter>
                <NavigationWarmup />
                <AnimatedRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
