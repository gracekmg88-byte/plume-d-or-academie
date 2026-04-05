import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";

import { lazy, Suspense, useEffect } from "react";
import { warmUpCache } from "@/lib/image-cache";
import { preloadImage } from "@/components/ui/cached-image";
import heroImage from "@/assets/hero-library.webp";
import heroBiblioImage from "@/assets/hero-bibliotheque.webp";
import heroContactImage from "@/assets/hero-contact.webp";
import heroAProposImage from "@/assets/hero-apropos.webp";
import { PushNotificationInit } from "@/components/PushNotificationInit";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

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

// Preload all hero images at startup for instant display
[heroImage, heroBiblioImage, heroContactImage, heroAProposImage].forEach(src => {
  preloadImage(src).catch(() => {});
});

function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, navType]);
  return null;
}

function ScrollRestorer() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === "POP") {
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      if (saved) {
        const y = parseInt(saved, 10);
        // Retry multiple times to handle lazy-loaded content
        let attempts = 0;
        const tryRestore = () => {
          window.scrollTo({ top: y, left: 0, behavior: "instant" });
          attempts++;
          if (attempts < 5 && document.documentElement.scrollHeight < y + window.innerHeight) {
            setTimeout(tryRestore, 100);
          }
        };
        requestAnimationFrame(tryRestore);
      }
    }

    return () => {
      sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
    };
  }, [pathname, navType]);

  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={location.pathname}>
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
            <ScrollToTop />
            <ScrollRestorer />
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
