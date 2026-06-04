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

import { AdminGuard } from "@/components/auth/AdminGuard";

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

function ScrollManager() {
  const location = useLocation();
  const { pathname, key } = location;
  const navType = useNavigationType();
  const prevRef = useRef({ pathname, key });
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
    prevRef.current = { pathname, key };

    if ((prev.pathname !== pathname || prev.key !== key) && prev.pathname) {
      saveScrollPosition(prev.key, prev.pathname, lastScrollYRef.current);
    }

    const navState = location.state as {
      restoredFromPublication?: boolean;
      returnKey?: string | null;
      returnPublicationId?: string | null;
    } | null;
    const isReturnFromPublication = Boolean(navState?.restoredFromPublication);
    const shouldRestore = navType === "POP" || isReturnFromPublication;

    if (shouldRestore) {
      const restoreKey = isReturnFromPublication && navState?.returnKey ? navState.returnKey : key;
      const savedY = getSavedScrollPosition(restoreKey, pathname);
      const targetCardId = isReturnFromPublication ? navState?.returnPublicationId ?? null : null;

      isRestoringRef.current = true;
      let cancelled = false;
      const start = performance.now();
      const TIMEOUT_MS = 3000;

      const computeCardTarget = (): number | null => {
        if (!targetCardId) return null;
        const card = document.querySelector<HTMLElement>(`[data-publication-card-id="${targetCardId}"]`);
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        const cardTop = rect.top + window.scrollY;
        const stickyOffset = window.innerWidth >= 768 ? 112 : 96;
        return Math.max(0, cardTop - stickyOffset - 12);
      };

      const tryRestore = () => {
        if (cancelled) return;
        const cardTarget = computeCardTarget();
        const desired = cardTarget !== null ? cardTarget : savedY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.min(desired, Math.max(0, maxScroll));

        if (target > 0 && Math.abs(window.scrollY - target) > 2) {
          window.scrollTo({ top: target, left: 0, behavior: "instant" as ScrollBehavior });
          lastScrollYRef.current = target;
        }

        const needMoreHeight = maxScroll < desired;
        const cardNotFoundYet = targetCardId && cardTarget === null;
        if ((needMoreHeight || cardNotFoundYet) && performance.now() - start < TIMEOUT_MS) {
          rafRef.current = window.requestAnimationFrame(tryRestore);
        } else {
          window.setTimeout(() => {
            isRestoringRef.current = false;
          }, 100);
        }
      };

      if (savedY > 0 || targetCardId) {
        rafRef.current = window.requestAnimationFrame(tryRestore);
        cancelRestoreRef.current = () => {
          cancelled = true;
          if (rafRef.current !== null) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          isRestoringRef.current = false;
        };
      } else if (!isReturnFromPublication) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        lastScrollYRef.current = 0;
        isRestoringRef.current = false;
      } else {
        isRestoringRef.current = false;
      }
    } else if (prev.pathname !== pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      lastScrollYRef.current = 0;
    }

    return () => {
      if (cancelRestoreRef.current) {
        cancelRestoreRef.current();
        cancelRestoreRef.current = null;
      }
    };
  }, [pathname, key, navType, location.state]);

  // Continuously save scroll position, but not during restoration
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      lastScrollYRef.current = window.scrollY;
      if (!isRestoringRef.current) {
        saveScrollPosition(key, pathname, window.scrollY);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname, key]);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen w-full bg-background" aria-hidden="true">
      <div className="container py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="h-64 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

function NavigationWarmup() {
  useEffect(() => {
    preloadCommonRoutes();
  }, []);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/bibliotheque" element={<Bibliotheque />} />
        <Route path="/publication/:id" element={<Publication />} />
        <Route path="/livre/:slug" element={<Publication />} />
        <Route path="/memoire/:slug" element={<Publication />} />
        <Route path="/tfc/:slug" element={<Publication />} />
        <Route path="/article/:slug" element={<Publication />} />
        <Route path="/auteur/:slug" element={<Auteur />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/abonnement" element={<Abonnement />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/messages" element={<AdminMessages />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/publication/:id" element={<PublicationForm />} />
        <Route path="/admin/devices" element={<AdminDevices />} />
        <Route path="/admin/submissions" element={<AdminSubmissions />} />
        <Route path="/depot-memoire" element={<DepotMemoire />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/installer" element={<InstallApp />} />
        <Route path="/verify/:number" element={<VerifyCertificate />} />
        <Route path="/verification" element={<VerifyHome />} />
        <Route path="/admin/certificates" element={<AdminCertificates />} />
        <Route path="/admin/seo" element={<AdminSeo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
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
              <ScrollManager />
              <AnimatedRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
