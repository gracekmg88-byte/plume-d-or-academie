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
import { getSavedScrollPosition, saveScrollPosition } from "@/lib/scroll-restoration";

// Eager-load the home page for instant first paint
import Index from "./pages/Index";

// Lazy-load all other pages for code-splitting
const Bibliotheque = lazy(() => import("./pages/Bibliotheque"));
const Publication = lazy(() => import("./pages/Publication"));
const APropos = lazy(() => import("./pages/APropos"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profil = lazy(() => import("./pages/Profil"));
const Abonnement = lazy(() => import("./pages/Abonnement"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const PublicationForm = lazy(() => import("./pages/admin/PublicationForm"));
const AdminDevices = lazy(() => import("./pages/admin/AdminDevices"));
const AdminSubmissions = lazy(() => import("./pages/admin/AdminSubmissions"));
const DepotMemoire = lazy(() => import("./pages/DepotMemoire"));
const Chat = lazy(() => import("./pages/Chat"));
const InstallApp = lazy(() => import("./pages/InstallApp"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Pre-load image cache index at startup for instant lookups on native
warmUpCache().catch(() => {});

function ScrollManager() {
  const location = useLocation();
  const { pathname, key } = location;
  const navType = useNavigationType();
  const prevRef = useRef({ pathname, key });
  const isRestoringRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const prev = prevRef.current;
    // Cancel any in-flight restoration
    if (cancelRestoreRef.current) {
      cancelRestoreRef.current();
      cancelRestoreRef.current = null;
    }
    prevRef.current = { pathname, key };

    if ((prev.pathname !== pathname || prev.key !== key) && prev.pathname) {
      saveScrollPosition(prev.key, prev.pathname, window.scrollY);
    }

    if (navType === "POP") {
      const y = getSavedScrollPosition(key, pathname);
      if (y > 0) {
        isRestoringRef.current = true;
        let cancelled = false;
        const start = performance.now();
        const TIMEOUT_MS = 2500;

        const tryRestore = () => {
          if (cancelled) return;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const target = Math.min(y, Math.max(0, maxScroll));
          if (Math.abs(window.scrollY - target) > 2) {
            window.scrollTo({ top: target, left: 0, behavior: "instant" as ScrollBehavior });
          }
          // Keep trying until content is tall enough OR timeout
          if (maxScroll < y && performance.now() - start < TIMEOUT_MS) {
            rafRef.current = window.requestAnimationFrame(tryRestore);
          } else {
            // Final correction then release
            window.setTimeout(() => {
              isRestoringRef.current = false;
            }, 100);
          }
        };

        rafRef.current = window.requestAnimationFrame(tryRestore);
        cancelRestoreRef.current = () => {
          cancelled = true;
          if (rafRef.current !== null) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          isRestoringRef.current = false;
        };
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      }
    } else if (prev.pathname !== pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }

    return () => {
      if (cancelRestoreRef.current) {
        cancelRestoreRef.current();
        cancelRestoreRef.current = null;
      }
    };
  }, [pathname, key, navType]);

  // Continuously save scroll position, but not during restoration
  useEffect(() => {
    const handleScroll = () => {
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
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/bibliotheque" element={<Bibliotheque />} />
        <Route path="/publication/:id" element={<Publication />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PushNotificationInit />
          <BrowserRouter>
            <ScrollManager />
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
